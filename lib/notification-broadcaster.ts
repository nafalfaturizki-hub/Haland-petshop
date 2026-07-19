/**
 * In-memory notification broadcaster for server-sent events
 * Manages active SSE connections and broadcasts notifications to subscribed clients
 * 
 * Note: This is a simple in-memory solution suitable for single-instance deployments.
 * For multi-instance/serverless deployments, consider using Redis Pub/Sub or a message queue.
 */

import { logger } from './logger';

type NotificationListener = {
  userId: string;
  send: (data: unknown) => void;
};

const activeListeners: Map<string, Set<NotificationListener>> = new Map();

export function registerNotificationListener(userId: string, send: (data: unknown) => void) {
  if (!activeListeners.has(userId)) {
    activeListeners.set(userId, new Set());
  }
  
  const listener: NotificationListener = { userId, send };
  activeListeners.get(userId)!.add(listener);

  // Return unsubscribe function
  return () => {
    activeListeners.get(userId)?.delete(listener);
    if (activeListeners.get(userId)?.size === 0) {
      activeListeners.delete(userId);
    }
  };
}

export function broadcastNotification(
  userId: string,
  notification: {
    id: string;
    title: string;
    message: string;
    type?: string | null;
    isRead: boolean;
    date: Date;
  }
) {
  const listeners = activeListeners.get(userId);
  if (!listeners || listeners.size === 0) {
    return;
  }

  const data = {
    type: 'notification',
    notification,
    timestamp: new Date().toISOString(),
  };

  listeners.forEach((listener) => {
    try {
      listener.send(data);
    } catch (error) {
      logger.error('Failed to broadcast notification', { userId, error: error instanceof Error ? error.message : String(error) });
      listeners.delete(listener);
    }
  });
}

export function broadcastUnreadCount(userId: string, count: number) {
  const listeners = activeListeners.get(userId);
  if (!listeners || listeners.size === 0) {
    return;
  }

  const data = {
    type: 'unread-count',
    count,
    timestamp: new Date().toISOString(),
  };

  listeners.forEach((listener) => {
    try {
      listener.send(data);
    } catch (error) {
      logger.error('Failed to broadcast unread count', { userId, error: error instanceof Error ? error.message : String(error) });
      listeners.delete(listener);
    }
  });
}

export function getActiveListenerCount(userId?: string) {
  if (userId) {
    return activeListeners.get(userId)?.size ?? 0;
  }
  return Array.from(activeListeners.values()).reduce((sum, set) => sum + set.size, 0);
}
