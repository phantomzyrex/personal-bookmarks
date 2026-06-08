export interface User {
  id: string;
  email: string;
  passwordHash: string;
  handle: string; // unique handle
  emailVerified: boolean;
  verificationToken: string;
  createdAt: string;
}

export interface Bookmark {
  id: string;
  userId: string;
  title: string;
  url: string;
  isPublic: boolean;
  category?: string; // category of the bookmark
  position?: number; // ordering position for custom layout drag-and-drop
  createdAt: string;
}

export interface EmailNotification {
  id: string;
  toEmail: string;
  subject: string;
  body: string;
  token: string;
  status: 'sent' | 'verified';
  createdAt: string;
}

export interface AuthState {
  user: {
    id: string;
    email: string;
    handle: string;
    emailVerified: boolean;
  } | null;
  token: string | null;
}
