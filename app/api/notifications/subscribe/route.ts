export const runtime = 'nodejs';
export const maxDuration = 60;

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getActorId } from '@/lib/utils';
import { SSE } from '@/lib/constants';
import { registerNotificationListener } from '@/lib/notification-broadcaster';

/**
 * Server-Sent Events (SSE) endpoint for real-time notifications
 * Clients connect here to receive live notification updates
 */
export async function GET(request: Request) {
  const session = await auth();
  const userId = getActorId(session);

  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Set up SSE headers
  const headers = {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  };

  // Create a custom response with streaming support
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(ctrl) {

      // Send initial connection message
      const message = `data: ${JSON.stringify({
        type: 'connected',
        timestamp: new Date().toISOString(),
      })}\n\n`;
      ctrl.enqueue(encoder.encode(message));

      // Send current unread count
      const unreadCount = await prisma.notification.count({
        where: { userId, isRead: false },
      });
      const unreadMsg = `data: ${JSON.stringify({
        type: 'unread-count',
        count: unreadCount,
        timestamp: new Date().toISOString(),
      })}\n\n`;
      ctrl.enqueue(encoder.encode(unreadMsg));

      // Register this connection as an active listener for notifications
      const unsubscribe = registerNotificationListener(userId, (data: unknown) => {
        try {
          const eventMessage = `data: ${JSON.stringify(data)}\n\n`;
          ctrl.enqueue(encoder.encode(eventMessage));
        } catch {
          console.error('Failed to send notification to client');
        }
      });

      // Set up heartbeat to keep connection alive and detect disconnects
      const heartbeatInterval = setInterval(() => {
        try {
          const heartbeat = `data: ${JSON.stringify({
            type: 'heartbeat',
            timestamp: new Date().toISOString(),
          })}\n\n`;
          ctrl.enqueue(encoder.encode(heartbeat));
        } catch {
          clearInterval(heartbeatInterval);
          unsubscribe();
          try { ctrl.close(); } catch { /* stream already closed */ }
        }
      }, SSE.HEARTBEAT_INTERVAL_MS);

      // Clean up on client disconnect
      request.signal.addEventListener('abort', () => {
        clearInterval(heartbeatInterval);
        unsubscribe();
        try { ctrl.close(); } catch { /* stream already closed */ }
      });
    },
  });

  return new Response(stream, { headers });
}
