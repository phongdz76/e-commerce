export type NotificationAudience = "CUSTOMER" | "ADMIN";
export interface NotificationView { id: string; sequence: number; title: string; href: string; createdAt: string; read: boolean; }
export interface NotificationList { items: NotificationView[]; unread: number; through: number; hasOlder: boolean; }
