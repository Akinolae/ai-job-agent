import { NextRequest } from 'next/server';
import { NotificationService } from '../../../services/notification-service';

// Prevent Next.js from statically prerendering this streaming endpoint
export const dynamic = 'force-dynamic';


/**
 * GET /api/notifications
 *
 * Server-Sent Events endpoint. The browser connects here and receives
 * real-time notifications whenever the pipeline submits an application.
 */
export async function GET(request: NextRequest) {
  const encoder = new TextEncoder();
  let controller: ReadableStreamController<Uint8Array>;

  const stream = new ReadableStream<Uint8Array>({
    start(ctrl) {
      controller = ctrl;
      // Send initial connection confirmation
      ctrl.enqueue(encoder.encode('data: {"type":"CONNECTED","title":"Live","body":"Notification stream connected."}\n\n'));
      NotificationService.addClient(ctrl);
    },
    cancel() {
      NotificationService.removeClient(controller);
    },
  });

  // Heartbeat every 25s to keep the connection alive through proxies
  const heartbeatInterval = setInterval(() => {
    try {
      controller.enqueue(encoder.encode(': heartbeat\n\n'));
    } catch {
      clearInterval(heartbeatInterval);
    }
  }, 25000);

  request.signal.addEventListener('abort', () => {
    clearInterval(heartbeatInterval);
    NotificationService.removeClient(controller);
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
