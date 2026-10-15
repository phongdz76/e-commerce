export type SupportTicketView = {
  returnCaseId?: string;
  id: string; reference: string; category: string; subject: string; state: string; version: number;
  createdAt: string; updatedAt: string; conversationId: string; context: { title: string; href: string } | null;
  assigned: boolean; canManage: boolean; actions: string[]; customer?: { name: string; email: string | null };
};
export type SupportTicketList = { items: SupportTicketView[]; page: number; total: number; totalPages: number };
export type SupportTicketDetail = { ticket: SupportTicketView; initialMessage: { text: string; imageUrl: string | null } | null; notes?: { id: string; text: string; createdAt: string; author: string }[]; notesPage?: number; hasMoreNotes?: boolean };
