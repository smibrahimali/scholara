type Disconnectable = { disconnect: () => void };

const active = new Set<Disconnectable>();

/** Track live Socket.IO clients so logout can tear them down. */
export function trackSocket(socket: Disconnectable): () => void {
  active.add(socket);
  return () => {
    active.delete(socket);
  };
}

export function disconnectAllSockets(): void {
  for (const socket of [...active]) {
    try {
      socket.disconnect();
    } catch {
      // ignore disconnect errors during cleanup
    }
  }
  active.clear();
}

/** Test helper — active socket count. */
export function trackedSocketCount(): number {
  return active.size;
}
