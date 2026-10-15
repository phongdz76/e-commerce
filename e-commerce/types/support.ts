export interface SupportContext {
  kind: "PRODUCT" | "ORDER";
  id: string;
  variantId?: string;
}
export interface SupportMessageView {
  id: string;
  sequence: number;
  role: "CUSTOMER" | "ADMIN";
  mine: boolean;
  label: string;
  text: string;
  createdAt: string;
  seen: boolean;
  context: { title: string; href: string } | null;
  imageUrl: string | null;
}
export interface SupportThread {
  conversation: {
    id: string;
    status: string;
    version: number;
    assigned: boolean;
    canClaim?: boolean;
    assignedTo?: { id: string; name: string } | null;
    unread: number;
    lastSequence: number;
    customer?: { name: string; email: string | null };
  } | null;
  messages: SupportMessageView[];
  hasOlder: boolean;
}
export interface SupportInbox {
  conversations: {
    id: string;
    status: string;
    version: number;
    unread: number;
    customer: { name: string; email: string | null };
    assignedTo: { id: string; name: string } | null;
    lastMessageAt: string;
  }[];
  page: number;
  totalPages: number;
  total: number;
}
