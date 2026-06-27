import { category } from '../constants/index.jsx';

export default function Category({ selected, onSelect }) {
  return (
    <nav className="cats" aria-label="Video categories">
      {category.map((item) => {
        const active = item.name === selected;
        return (
          <button
            key={item.name}
            type="button"
            className="cat-pill"
            aria-pressed={active}
            onClick={() => onSelect(item.name)}
          >
            {item.name}
          </button>
        );
      })}
    </nav>
  );
}
