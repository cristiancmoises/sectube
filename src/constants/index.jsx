import {
  AddBusiness,
  AddShoppingCart,
  Article,
  Code,
  DeveloperMode,
  FaceRetouchingNatural,
  FilterDrama,
  FitnessCenter,
  Flag,
  GraphicEq,
  Home,
  LiveTv,
  Movie,
  MusicNote,
  OndemandVideo,
  Restaurant,
  School,
  Science,
  SportsEsports,
  SportsSoccer,
  TheaterComedy,
  TravelExplore,
} from '@mui/icons-material';

export const logo = '/sec-logo.svg';

/**
 * Categories drive the home-page feed. `query` is what's sent to the
 * /search endpoint; defaults to `name` if omitted.
 */
export const category = [
  { name: 'New',         icon: <Home /> },
  { name: 'Tech',        icon: <Code />,            query: 'tech news' },
  { name: 'News',        icon: <Article /> },
  { name: 'JP News',     icon: <Flag />,            query: '日本 ニュース' },
  { name: 'Anime',       icon: <Movie />,           query: 'anime' },
  { name: 'Science',     icon: <Science /> },
  { name: 'Documentary', icon: <OndemandVideo />,   query: 'documentary' },
  { name: 'Movie',       icon: <Movie /> },
  { name: 'Live',        icon: <LiveTv /> },
  { name: 'Gaming',      icon: <SportsEsports /> },
  { name: 'Education',   icon: <School /> },
  { name: 'Sport',       icon: <FitnessCenter /> },
  { name: 'Football',    icon: <SportsSoccer /> },
  { name: 'Comedy',      icon: <TheaterComedy /> },
  { name: 'Podcast',     icon: <GraphicEq /> },
  { name: 'Crypto',      icon: <DeveloperMode /> },
  { name: 'Music',       icon: <MusicNote /> },
  { name: 'Drama',       icon: <FilterDrama /> },
  { name: 'Food',        icon: <Restaurant /> },
  { name: 'Travel',      icon: <TravelExplore /> },
  { name: 'Gym',         icon: <FitnessCenter /> },
  { name: 'Beauty',      icon: <FaceRetouchingNatural /> },
  { name: 'Shopping',    icon: <AddShoppingCart /> },
  { name: 'Business',    icon: <AddBusiness /> },
];

// Get the actual search query for a category. Falls back to the display name.
export function queryFor(name) {
  const c = category.find((x) => x.name === name);
  return (c && c.query) || name;
}
