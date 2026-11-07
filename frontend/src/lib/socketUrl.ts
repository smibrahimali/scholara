/** Derive Socket.IO HTTP origin from VITE_API_URL (strips trailing /api). */
export function getSocketOrigin(): string {
  const api =
    (import.meta.env.VITE_API_URL as string | undefined) ??
    'http://localhost:3000/api';
  return api.replace(/\/api\/?$/, '');
}
