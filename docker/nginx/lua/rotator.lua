-- rotator.lua — server-side YouTube Data API key rotation + response cache.
--
-- Why this exists
--   A single Google API key is capped at 10,000 quota units/day (~100 searches).
--   SecTube lets the operator configure MANY keys; this module spreads load
--   across them round-robin and, when a key reports quotaExceeded / rate-limit /
--   bad-key, takes it out of rotation for a cooldown and retries the SAME request
--   on the next healthy key — so the site keeps working until EVERY key is dry.
--
-- Why it's also a cache
--   The biggest quota multiplier is not having more keys, it's not spending quota
--   twice. Identical upstream requests (same path+args, minus the key) are served
--   from a shared in-memory cache for a short TTL, so N concurrent users browsing
--   the same feed cost ONE upstream call, not N.
--
-- Security
--   Keys arrive via the environment (read with os.getenv in init_by_lua) and live
--   only in worker memory. Unlike the old sed approach, they are never written
--   into a config file on disk, and they never reach the browser — the proxy
--   appends key=… to the *upstream* request only.
--
-- Dependencies: OpenResty core only (ngx.location.capture, lua-cjson, shared
-- dicts). No third-party Lua modules, so the image needs no opm/luarocks network
-- fetch at build time.

local cjson = require "cjson.safe"

local _M = {}

-- Populated in init(). Read-only after init → safe to share across workers via
-- the fork that happens after init_by_lua.
_M.keys = {}

-- Tunables (overridable via env, resolved in init()).
local cfg = {
  quota_cooldown = 1800,   -- s a key sits out after quotaExceeded/dailyLimit
  rate_cooldown  = 30,     -- s a key sits out after a rate-limit (recovers fast)
  bad_cooldown   = 3600,   -- s a key sits out after keyInvalid/referer/etc.
  cache_ttl      = 300,    -- s an upstream 200 response is reused
  upstream_loc   = "/__yt/", -- internal proxy location prefix
}

-- Shared dicts (declared in nginx.sectube.conf). Resolved lazily so the module
-- can still be required in contexts where ngx.shared isn't ready.
local function state() return ngx.shared.yt_state end
local function rcache() return ngx.shared.yt_cache end

-- ---------------------------------------------------------------------------
-- init: parse keys + config from the environment. Called from init_by_lua.
-- ---------------------------------------------------------------------------
local function split_keys(raw)
  local out, seen = {}, {}
  if not raw then return out end
  -- Accept comma, whitespace, semicolon or newline as separators so operators
  -- can paste keys however is convenient.
  for tok in string.gmatch(raw, "[^,%s;]+") do
    if tok ~= "" and not seen[tok] then
      seen[tok] = true
      out[#out + 1] = tok
    end
  end
  return out
end

local function num_env(name, default)
  local v = tonumber(os.getenv(name) or "")
  if v and v > 0 then return v end
  return default
end

function _M.init()
  local keys = split_keys(os.getenv("GOOGLE_API_KEYS"))
  -- Back-compat: a single GOOGLE_API_KEY is merged in (deduped).
  local single = os.getenv("GOOGLE_API_KEY")
  if single and single ~= "" then
    local seen = {}
    for _, k in ipairs(keys) do seen[k] = true end
    for _, k in ipairs(split_keys(single)) do
      if not seen[k] then keys[#keys + 1] = k; seen[k] = true end
    end
  end
  _M.keys = keys

  cfg.quota_cooldown = num_env("GOOGLE_KEY_QUOTA_COOLDOWN", cfg.quota_cooldown)
  cfg.rate_cooldown  = num_env("GOOGLE_KEY_RATE_COOLDOWN",  cfg.rate_cooldown)
  cfg.bad_cooldown   = num_env("GOOGLE_KEY_BAD_COOLDOWN",   cfg.bad_cooldown)
  cfg.cache_ttl      = num_env("GOOGLE_API_CACHE_TTL",      cfg.cache_ttl)

  if #keys == 0 then
    ngx.log(ngx.WARN, "[sectube] no API keys configured — /api calls will error")
  else
    ngx.log(ngx.NOTICE, "[sectube] rotator ready with ", #keys, " API key(s), ",
            "cache_ttl=", cfg.cache_ttl, "s")
  end
end

-- ---------------------------------------------------------------------------
-- Key health bookkeeping (shared across workers via ngx.shared.yt_state).
-- A key index is "down" while a TTL'd marker exists for it.
-- ---------------------------------------------------------------------------
local function mark_down(idx, cooldown, reason)
  -- `add` only sets when no marker exists, so re-marking a key that's already
  -- cooling does NOT reset its countdown — without this, traffic more frequent
  -- than the cooldown would push recovery out indefinitely. When the marker
  -- later expires the key is re-probed and (if still failing) re-cooled.
  local ok = state():add("down:" .. idx, reason or "down", cooldown)
  if ok then
    -- WARN level so operators actually see rotation events (error_log is `warn`).
    ngx.log(ngx.WARN, "[sectube] key #", idx, " cooling down ", cooldown,
            "s (", reason or "?", ")")
  end
end

-- Clear a key's cooldown the moment it serves a good response, so a recovered
-- key (e.g. after the midnight quota reset) rejoins healthy rotation at once
-- instead of waiting out a stale marker.
local function clear_down(idx)
  state():delete("down:" .. idx)
end

local function is_down(idx)
  return state():get("down:" .. idx) ~= nil
end

-- Ordered list of key indices to try this request: healthy keys first in
-- round-robin order, then cooling keys as a fallback.
--
-- When NO key is healthy we deliberately return just ONE cooling key (rotated by
-- the cursor) instead of all of them: fanning out N upstream subrequests at an
-- already-exhausted fleet only hammers Google while we're rate-limited. One
-- re-probe per request still recovers keys promptly (a 2xx clears the cooldown).
local function candidates()
  local n = #_M.keys
  if n == 0 then return {} end
  local start = (state():incr("cursor", 1, 0) or 1) % n
  local healthy, cooling = {}, {}
  for i = 0, n - 1 do
    local idx = ((start + i) % n) + 1
    if is_down(idx) then cooling[#cooling + 1] = idx
    else healthy[#healthy + 1] = idx end
  end
  if #healthy > 0 then
    for _, idx in ipairs(cooling) do healthy[#healthy + 1] = idx end
    return healthy
  end
  if #cooling > 0 then return { cooling[1] } end
  return {}
end

-- ---------------------------------------------------------------------------
-- Error classification from an upstream 4xx body.
-- ---------------------------------------------------------------------------
-- Reasons appear in two places in a Google error body: the legacy
-- error.errors[].reason (often just "badRequest" for a bad key) and the modern
-- error.details[].reason (ErrorInfo, e.g. "API_KEY_INVALID", "RESOURCE_EXHAUSTED").
-- We classify both styles.
local QUOTA   = { quotaExceeded = true, dailyLimitExceeded = true,
                  RESOURCE_EXHAUSTED = true }
local RATE    = { rateLimitExceeded = true, userRateLimitExceeded = true,
                  userRateLimitExceededUnreg = true, RATE_LIMIT_EXCEEDED = true }
local BADKEY  = { keyInvalid = true, keyExpired = true, ipRefererBlocked = true,
                  accessNotConfigured = true, forbidden = true,
                  API_KEY_INVALID = true, API_KEY_SERVICE_BLOCKED = true,
                  API_KEY_HTTP_REFERRER_BLOCKED = true, API_KEY_IP_ADDRESS_BLOCKED = true,
                  API_KEY_ANDROID_APP_BLOCKED = true, API_KEY_IOS_APP_BLOCKED = true,
                  SERVICE_DISABLED = true }

local function classified(r)
  return r and (QUOTA[r] or RATE[r] or BADKEY[r]) and r or nil
end

local function reason_of(body)
  if not body or body == "" then return nil end
  local data = cjson.decode(body)
  if type(data) == "table" and type(data.error) == "table" then
    local e = data.error
    -- Prefer a key/quota/rate reason from the modern ErrorInfo details, since
    -- the legacy errors[].reason for a bad key is just "badRequest".
    if type(e.details) == "table" then
      for _, d in ipairs(e.details) do
        if type(d) == "table" and classified(d.reason) then return d.reason end
      end
    end
    if type(e.errors) == "table" and type(e.errors[1]) == "table" and e.errors[1].reason then
      return e.errors[1].reason
    end
    if e.status then return e.status end
  end
  -- Fallback: substring scan for the common reasons.
  for r in pairs(QUOTA) do if body:find(r, 1, true) then return r end end
  for r in pairs(RATE)  do if body:find(r, 1, true) then return r end end
  for r in pairs(BADKEY) do if body:find(r, 1, true) then return r end end
  return nil
end

-- Returns cooldown seconds for a (status, reason), or nil if this error is not
-- key-related and should be passed straight back to the client.
local function cooldown_for(status, reason)
  if reason and QUOTA[reason]  then return cfg.quota_cooldown, "quota" end
  if reason and RATE[reason]   then return cfg.rate_cooldown,  "rate"  end
  if reason and BADKEY[reason] then return cfg.bad_cooldown,   reason  end
  if status == 429             then return cfg.rate_cooldown,  "http429" end
  if status == 403             then return cfg.rate_cooldown,  "http403" end
  return nil
end

-- ---------------------------------------------------------------------------
-- Response helpers.
-- ---------------------------------------------------------------------------
local function send(status, body, content_type, cache_state)
  ngx.status = status
  ngx.header["Content-Type"] = content_type or "application/json; charset=utf-8"
  ngx.header["X-Cache"] = cache_state or "MISS"
  if body and body ~= "" then ngx.print(body) end
  return ngx.exit(status)
end

local function send_json_error(status, reason, message)
  local body = cjson.encode({
    error = {
      code = status,
      message = message or "API error",
      errors = { { reason = reason, message = message or "API error" } },
    },
  })
  return send(status, body, "application/json; charset=utf-8", "MISS")
end

-- Canonical query string for the upstream call + cache key. Built from parsed
-- args (not the raw string) so we can:
--   * strip any client-supplied `key` — the client must never shadow or set the
--     API key, and it must not leak into the (key-less) cache key;
--   * sort params for a stable cache key, so ?a=1&b=2 and ?b=2&a=1 share a hit.
local function canonical_args()
  local a = ngx.req.get_uri_args(100)
  a.key = nil
  local names = {}
  for k in pairs(a) do names[#names + 1] = k end
  table.sort(names)
  local parts = {}
  for _, k in ipairs(names) do
    local v = a[k]
    if type(v) == "table" then
      table.sort(v)
      for _, vv in ipairs(v) do
        parts[#parts + 1] = ngx.escape_uri(k) .. "=" .. ngx.escape_uri(tostring(vv))
      end
    elseif v == true then
      parts[#parts + 1] = ngx.escape_uri(k)
    else
      parts[#parts + 1] = ngx.escape_uri(k) .. "=" .. ngx.escape_uri(tostring(v))
    end
  end
  return table.concat(parts, "&")
end

-- ---------------------------------------------------------------------------
-- Main entry — runs in content_by_lua for the /api/ location.
-- ---------------------------------------------------------------------------
function _M.handle()
  if #_M.keys == 0 then
    return send_json_error(403, "keyInvalid",
      "No API key configured. The server admin must set GOOGLE_API_KEYS.")
  end

  local proxy_path = ngx.var.proxy_path or ""
  local base = canonical_args()
  local cache_key = proxy_path .. "?" .. base

  -- 1) Shared cache (keyed without the API key so all keys share one entry).
  local cached = rcache():get(cache_key)
  if cached then
    return send(200, cached, "application/json; charset=utf-8", "HIT")
  end

  -- 2) Rotate through keys, retrying the same request on quota/rate/bad-key
  --    and on transient upstream failures.
  local last = nil
  for _, idx in ipairs(candidates()) do
    local key = _M.keys[idx]
    local sub_args = (base ~= "" and (base .. "&") or "") .. "key=" .. key

    local res = ngx.location.capture(cfg.upstream_loc .. proxy_path, {
      method = ngx.HTTP_GET,
      args = sub_args,
    })

    if res and res.status then
      local st = res.status
      if st >= 200 and st < 300 then
        clear_down(idx)       -- key works → return it to healthy rotation
        if st == 200 and res.body and res.body ~= "" then
          rcache():set(cache_key, res.body, cfg.cache_ttl)
        end
        local ct = res.header and res.header["Content-Type"]
        return send(st, res.body, ct, "MISS")
      end

      local ct = res.header and res.header["Content-Type"]
      local cd, label = cooldown_for(st, reason_of(res.body))
      if cd then
        mark_down(idx, cd, label)
        last = res            -- remember so we can surface a real error later
        -- …and rotate to the next key.
      elseif st >= 500 then
        -- Transient upstream/transport failure (DNS, connect, TLS, timeout and
        -- 5xx all surface here as a 5xx capture result, NOT res == nil). Not the
        -- key's fault — don't cool it; a fresh attempt on the next key may work.
        last = res
      else
        -- Genuine client error (400 badRequest, 404…). Pass straight back.
        return send(st, res.body, ct, "MISS")
      end
    end
    -- res == nil → defensive: treat like a transport failure and try the next.
  end

  -- 3) Every key failed. Surface the last real Google error JSON if we have one
  --    (so the frontend maps it to the correct "quota reached" message). For a
  --    transport/5xx failure the body is nginx HTML, not JSON — synthesize a
  --    clean JSON error instead so the client always gets a parseable shape.
  if last then
    local ct = last.header and last.header["Content-Type"] or ""
    if last.status < 500 and ct:find("json", 1, true) then
      return send(last.status, last.body, ct, "MISS")
    end
    return send_json_error(502, "backendError", "Upstream temporarily unavailable.")
  end
  return send_json_error(502, "backendError", "All API keys are unavailable.")
end

return _M
