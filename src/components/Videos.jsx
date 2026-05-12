import { Box } from '@mui/material';
import VideoCard from './VideoCard.jsx';
import ChannelCard from './ChannelCard.jsx';
import { EmptyState } from './Loader.jsx';

function itemKey(item, idx) {
  return item?.id?.videoId || item?.id?.channelId || item?.id || `i-${idx}`;
}

export default function Videos({ videos }) {
  if (!Array.isArray(videos)) return null;
  if (videos.length === 0) return <EmptyState />;
  return (
    <div className="grid">
      {videos.map((item, idx) => (
        <Box key={itemKey(item, idx)}>
          {item?.id?.videoId && <VideoCard video={item} />}
          {item?.id?.channelId && <ChannelCard video={item} />}
        </Box>
      ))}
    </div>
  );
}
