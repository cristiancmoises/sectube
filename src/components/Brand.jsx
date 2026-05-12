import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { logo } from '../constants/index.jsx';

const FIRST_VISIT_KEY = 'sectube.firstVisitShown';

export default function Brand() {
  const [mode, setMode] = useState('static');

  useEffect(() => {
    let firstVisit = false;
    try {
      firstVisit = sessionStorage.getItem(FIRST_VISIT_KEY) !== '1';
      if (firstVisit) sessionStorage.setItem(FIRST_VISIT_KEY, '1');
    } catch { /* private mode */ }
    setMode(firstVisit ? 'typewriter' : 'sweep');
  }, []);

  return (
    <Link to="/" aria-label="SecTube — home" className={`brand brand--${mode}`}>
      <img src={logo} alt="" className="brand-logo" aria-hidden="true" />
      <span className="brand-text">
        <span className="sec">Sec</span>
        <span className="tube">Tube</span>
      </span>
      {mode === 'typewriter' && <span className="cursor" aria-hidden="true" />}
    </Link>
  );
}
