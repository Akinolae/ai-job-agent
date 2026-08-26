/**
 * NotificationService — broadcasts real-time notifications to all open browser tabs.
 *
 * The pipeline calls NotificationService.send() when an application is submitted.
 * The browser subscribes to /api/notifications via Server-Sent Events (SSE).
 */

export interface AppNotification {
  type:
    | "APPLICATION_SUBMITTED"
    | "APPLICATION_FAILED"
    | "SCAN_COMPLETE"
    | "INFO";
  title: string;
  body: string;
  company?: string;
  role?: string;
  timestamp: string;
}

// In-memory queue of pending notifications (cleared once delivered)
const pendingNotifications: AppNotification[] = [];

// Active SSE response writers
const sseClients = new Set<ReadableStreamController<Uint8Array>>();

export const NotificationService = {
  /**
   * Queue a notification and push it to all active SSE clients immediately.
   */
  send(notification: AppNotification) {
    pendingNotifications.push(notification);
    const payload = `data: ${JSON.stringify(notification)}\n\n`;
    const encoder = new TextEncoder();

    const deadClients: ReadableStreamController<Uint8Array>[] = [];
    for (const client of sseClients) {
      try {
        client.enqueue(encoder.encode(payload));
      } catch {
        deadClients.push(client);
      }
    }
    for (const dead of deadClients) {
      sseClients.delete(dead);
    }
  },

  /**
   * Register a new SSE client controller and return the initial heartbeat payload.
   */
  addClient(controller: ReadableStreamController<Uint8Array>) {
    sseClients.add(controller);
    // Deliver any queued (unread) notifications to the new client
    const encoder = new TextEncoder();
    for (const n of pendingNotifications) {
      try {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(n)}\n\n`));
      } catch {
        break;
      }
    }
  },

  removeClient(controller: ReadableStreamController<Uint8Array>) {
    sseClients.delete(controller);
  },
};
