import { useEffect, useRef, useCallback } from 'react';

interface NotificationEvent {
  type: 'connected' | 'notification' | 'unread-count' | 'heartbeat';
  notification?: {
    id: string;
    title: string;
    message: string;
    type?: string | null;
    isRead: boolean;
    date: Date;
  };
  count?: number;
  timestamp: string;
}

type NotificationListener = (event: NotificationEvent) => void;

/**
 * Hook to subscribe to real-time notifications via SSE
 * Automatically handles connection/disconnection and reconnection on failure
 */
export function useNotifications(onNotification?: NotificationListener) {
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isConnectingRef = useRef(false);

  const connect = useCallback(() => {
    if (isConnectingRef.current || eventSourceRef.current?.readyState === EventSource.OPEN) {
      return;
    }

    isConnectingRef.current = true;

    try {
      const eventSource = new EventSource('/api/notifications/subscribe');

      eventSource.onopen = () => {
        console.log('[Notifications] Connected to SSE');
        isConnectingRef.current = false;
      };

      eventSource.addEventListener('message', (event) => {
        try {
          const data = JSON.parse(event.data);
          onNotification?.(data);
        } catch (error) {
          console.error('[Notifications] Failed to parse event:', error);
        }
      });

      eventSource.onerror = (error) => {
        console.error('[Notifications] SSE connection error:', error);
        isConnectingRef.current = false;

        if (eventSource.readyState === EventSource.CLOSED) {
          eventSource.close();
          eventSourceRef.current = null;

          // Attempt to reconnect after 5 seconds
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, 5000);
        }
      };

      eventSourceRef.current = eventSource;
    } catch (error) {
      console.error('[Notifications] Failed to create SSE connection:', error);
      isConnectingRef.current = false;

      // Retry after 5 seconds
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, 5000);
    }
  }, [onNotification]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    isConnectingRef.current = false;
  }, []);

  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return { isConnected: eventSourceRef.current?.readyState === EventSource.OPEN };
}
