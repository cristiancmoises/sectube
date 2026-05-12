import { useState, useRef } from 'react';
import { IconButton } from '@mui/material';
import { Search as SearchIcon, Close } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

export default function SearchBar() {
  const navigate = useNavigate();
  const [value, setValue] = useState('');
  const inputRef = useRef(null);

  const onSubmit = (e) => {
    e.preventDefault();
    const q = value.trim();
    if (!q) return;
    navigate(`/search/${encodeURIComponent(q)}`);
  };

  const onClear = () => { setValue(''); inputRef.current?.focus(); };

  return (
    <form className="search-wrap" onSubmit={onSubmit} role="search" aria-label="Search videos">
      <SearchIcon sx={{ fontSize: 18, color: 'var(--c-text-dim)' }} />
      <input
        ref={inputRef}
        className="search-input"
        type="search"
        placeholder="Search videos…"
        aria-label="Search videos"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        maxLength={200}
        autoComplete="off"
        spellCheck="false"
      />
      {value && (
        <IconButton type="button" size="small" onClick={onClear} aria-label="Clear search"
          sx={{ p: 0.25, color: 'var(--c-text-dim)' }}>
          <Close fontSize="small" />
        </IconButton>
      )}
    </form>
  );
}
