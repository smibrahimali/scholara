import type { Location } from 'react-router-dom';

export type NavFromState = {
  from?: string;
};

/** Safe app-internal back target from location.state, else fallback. */
export function getBackPath(location: Location, fallback: string): string {
  const from = (location.state as NavFromState | null | undefined)?.from;
  if (typeof from === 'string' && from.startsWith('/app')) {
    return from;
  }
  return fallback;
}

export function withFrom(pathname: string): { state: NavFromState } {
  return { state: { from: pathname } };
}
