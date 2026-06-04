import { useState, useEffect } from 'react';
import { useSocketContext } from '../context/SocketContext';

export function useSocket() {
  const { socket, isConnected } = useSocketContext();
  const [lastUpdate, setLastUpdate] = useState<string>('');
  const [stockCount, setStockCount] = useState<number>(0);

  useEffect(() => {
    if (!socket) return;

    const handleStatus = (data: { stockCount?: number; lastUpdate?: string }) => {
      if (data.stockCount !== undefined) setStockCount(data.stockCount);
      if (data.lastUpdate) setLastUpdate(data.lastUpdate);
    };

    socket.on('connection:status', handleStatus);

    return () => {
      socket.off('connection:status', handleStatus);
    };
  }, [socket]);

  return { socket, isConnected, lastUpdate, stockCount };
}
