import { useEffect, useState } from 'react';
import { transitionMascot } from '../components/IcarusMascot/mascotFsm';

/** Fire a presentation-only mascot event (web CustomEvent). */
export function dispatchMascotEvent(eventName, detail = {}) {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(
      new CustomEvent('icarus:mascot', { detail: { event: eventName, type: eventName, ...detail } })
    );
  } catch {
    /* non-DOM */
  }
}

export function useMascotEvents(initial = 'idle') {
  const [state, setState] = useState(initial);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onEvt = (e) => {
      setState((cur) => transitionMascot(cur, e.detail?.event || e.detail?.type));
    };
    window.addEventListener('icarus:mascot', onEvt);
    return () => window.removeEventListener('icarus:mascot', onEvt);
  }, []);

  return { state, setState, dispatchMascotEvent };
}

export default useMascotEvents;
