import { useEffect } from 'react';

export function usePolling(callback: () => void | Promise<void>, intervalMs: number) {
  useEffect(() => {
    const id = setInterval(() => {
      void callback();
    }, intervalMs);

    return () => clearInterval(id);
  }, [callback, intervalMs]);
}
