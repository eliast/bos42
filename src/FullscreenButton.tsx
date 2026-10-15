import { useEffect, useRef, useState } from 'react';

export function FullscreenButton() {
  const button = useRef<HTMLButtonElement>(null);
  const [active, setActive] = useState(!!document.fullscreenElement);
  const [error, setError] = useState('');
  const supported = !import.meta.env.VITE_TIZEN_APP && !!document.documentElement.requestFullscreen;

  useEffect(() => {
    const update = () => setActive(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', update);
    // Let the TV remote activate this control after a page load or live update.
    if (supported && /smart-tv|smarttv|tizen/i.test(navigator.userAgent)) button.current?.focus();
    return () => document.removeEventListener('fullscreenchange', update);
  }, [supported]);

  if (!supported) return null;
  const toggle = async () => {
    setError('');
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      setError('Full screen unavailable. Try selecting the button with your remote.');
    }
  };
  const label = active ? 'Exit full screen' : 'Full screen';
  return <>
    <button ref={button} className="icon-button" aria-label={label} title={label} aria-pressed={active} onClick={toggle}
      onKeyDown={event => {
        if (event.key === 'Enter' && !event.repeat) { event.preventDefault(); void toggle(); }
      }}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
        <path d={active ? 'M9 3v6H3m18 0h-6V3M3 15h6v6m6 0v-6h6' : 'M9 3H3v6m12-6h6v6M3 15v6h6m6 0h6v-6'}/>
      </svg>
    </button>
    {error && <span role="status">{error}</span>}
  </>;
}
