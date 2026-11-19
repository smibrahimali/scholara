import type { Location } from 'react-router-dom';

export type NavFromState = {
  from?: string;
};

function readNavFrom(
  location: Location,
): string | undefined {
  const from = (location.state as NavFromState | null | undefined)?.from;
  if (typeof from === 'string' && from.startsWith('/app')) {
    return from;
  }
  return undefined;
}

/** True when this screen was opened via an in-app cross-page redirect. */
export function hasNavFrom(location: Location): boolean {
  return readNavFrom(location) !== undefined;
}

/** Safe app-internal back target from location.state, else fallback. */
export function getBackPath(location: Location, fallback: string): string {
  return readNavFrom(location) ?? fallback;
}

export function withFrom(pathname: string): { state: NavFromState } {
  return { state: { from: pathname } };
}
