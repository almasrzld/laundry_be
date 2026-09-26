import { EventEmitter } from 'events';

export const notificationEvents = new EventEmitter();
notificationEvents.setMaxListeners(200);

export interface NotificationEventPayload {
  action: 'created' | 'read' | 'read_all';
  userId?: number | string | null;
  targetRole?: string | null;
  notificationId?: number | string;
}

export function emitNotificationEvent(payload: NotificationEventPayload): void {
  try {
    notificationEvents.emit('notification', payload);
  } catch (err) {
    console.warn('[NotificationEvent] Failed to emit event:', err);
  }
}
