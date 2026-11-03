import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  identifyUser: (customName?: string) => void;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
  identifyUser: () => {},
});

export function SocketProvider({ children }: { children: ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const { user, profile } = useAuth();

  useEffect(() => {
    const socketUrl = import.meta.env.VITE_SOCKET_URL || window.location.origin;
    const newSocket = io(socketUrl, {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      transports: ['websocket', 'polling'],
    });

    newSocket.on('connect', () => {
      setIsConnected(true);
    });

    newSocket.on('disconnect', () => setIsConnected(false));
    
    newSocket.on('server:force_refresh', () => {
      console.log('Server commanded a forced refresh!');
      window.location.reload();
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  const identifyUser = useCallback((customName?: string) => {
    if (!socket) return;
    const userName = (customName || localStorage.getItem('mmi_user_name') || user?.email || 'Guest Trader').trim();
    const isAdmin =
      localStorage.getItem('mmi_admin_authorized') === 'true' ||
      profile?.is_admin ||
      ['harsh', 'harsh patel', 'admin', 'drakula', 'dhruvil', 'karan'].includes(userName.toLowerCase());
    const avatar = localStorage.getItem('mmi-user-avatar') || undefined;

    socket.emit('auth:identify', {
      name: userName,
      email: userName,
      isAdmin: !!isAdmin,
      avatar,
      adminKey: isAdmin ? 'mmiadmin' : undefined
    });
  }, [socket, user?.email, profile?.is_admin]);

  // Identify user on connection or auth change
  useEffect(() => {
    if (socket && isConnected) {
      identifyUser();
    }
  }, [socket, isConnected, identifyUser]);

  // Listen for local name changes or admin authorizations
  useEffect(() => {
    const handleNameChange = (e: any) => {
      const detailName = e?.detail?.name;
      identifyUser(detailName);
    };

    const handleAdminAuth = () => {
      identifyUser();
    };

    window.addEventListener('mmi:name_changed', handleNameChange);
    window.addEventListener('mmi:admin_authorized', handleAdminAuth);

    return () => {
      window.removeEventListener('mmi:name_changed', handleNameChange);
      window.removeEventListener('mmi:admin_authorized', handleAdminAuth);
    };
  }, [identifyUser]);

  return (
    <SocketContext.Provider value={{ socket, isConnected, identifyUser }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocketContext() {
  return useContext(SocketContext);
}
