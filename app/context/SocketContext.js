import React, { createContext, useContext, useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export const useSocket = () => useContext(SocketContext);

const SOCKET_URL = process.env.EXPO_PUBLIC_SOCKET_URL || '';

export function SocketProvider({ children }) {
  const { token, user } = useAuth();
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const currentProjectRef = useRef(null);

  useEffect(() => {
    if (!token || !SOCKET_URL) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setConnected(false);
      return;
    }

    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      auth: { token },
      reconnection: true,
      reconnectionAttempts: 20,
      reconnectionDelay: 1000,
      timeout: 20000,
    });

    socket.on('connect', () => {
      setConnected(true);
      
      if (currentProjectRef.current) {
        socket.emit('join:project', currentProjectRef.current);
      }

      if (user?.id || user?._id) {
        socket.emit('join:user', user.id || user._id);
      }
    });

    socket.on('disconnect', (reason) => {
      setConnected(false);
    });

    socket.on('connect_error', (err) => {
      console.warn('[socket] connect error:', err.message);
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [token, user]);

  const joinProject = useCallback((projectId) => {
    if (projectId) {
      currentProjectRef.current = projectId;
      socketRef.current?.emit('join:project', projectId);
    }
  }, []);

  const leaveProject = useCallback((projectId) => {
    if (projectId) {
      if (currentProjectRef.current === projectId) currentProjectRef.current = null;
      socketRef.current?.emit('leave:project', projectId);
    }
  }, []);

  const joinOrg = useCallback((orgId) => {
    if (orgId) socketRef.current?.emit('join:org', orgId);
  }, []);

  const contextValue = useMemo(() => ({
    socket: socketRef.current,
    connected,
    joinProject,
    leaveProject,
    joinOrg,
  }), [connected, joinProject, leaveProject, joinOrg]);

  return (
    <SocketContext.Provider value={contextValue}>
      {children}
    </SocketContext.Provider>
  );
}


