import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { User, Bookmark, EmailNotification } from './src/types';

const DB_FILE = path.join(process.cwd(), 'data-store.json');

interface Schema {
  users: Record<string, User>;         // userId -> User
  bookmarks: Record<string, Bookmark>; // bookmarkId -> Bookmark
  emails: EmailNotification[];
  tokens: Record<string, string>;      // sessionToken -> userId
}

class ServerDatabase {
  private data: Schema = {
    users: {},
    bookmarks: {},
    emails: [],
    tokens: {}
  };

  constructor() {
    this.load();
  }

  private load() {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        this.data = {
          users: parsed.users || {},
          bookmarks: parsed.bookmarks || {},
          emails: parsed.emails || [],
          tokens: parsed.tokens || {}
        };
        console.log('Database loaded successfully from', DB_FILE);
      } else {
        this.save();
      }
    } catch (e) {
      console.error('Error loading database, using empty state:', e);
    }
  }

  private save() {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (e) {
      console.error('Error writing to database:', e);
    }
  }

  // --- Password Hashing ---
  hashPassword(password: string): string {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
    return `${salt}:${hash}`;
  }

  verifyPassword(password: string, stored: string): boolean {
    try {
      const [salt, hash] = stored.split(':');
      const checkHash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
      return hash === checkHash;
    } catch (e) {
      return false;
    }
  }

  // --- User Operations ---
  createUser(email: string, passwordPlain: string, rawHandle: string): { user: User; email: EmailNotification } {
    const handle = rawHandle.trim().toLowerCase().replace(/^@/, '');
    const emailKey = email.trim().toLowerCase();

    // Check pre-existence of email
    const existingEmail = Object.values(this.data.users).find(u => u.email.toLowerCase() === emailKey);
    if (existingEmail) {
      throw new Error('An account with this email already exists.');
    }

    // Check pre-existence of handle
    const existingHandle = Object.values(this.data.users).find(u => u.handle.toLowerCase() === handle);
    if (existingHandle) {
      throw new Error(`The handle @${rawHandle} is already claimed.`);
    }

    const userId = crypto.randomUUID();
    const verificationToken = crypto.randomBytes(16).toString('hex');
    const passwordHash = this.hashPassword(passwordPlain);

    const newUser: User = {
      id: userId,
      email: email.trim(),
      passwordHash,
      handle,
      emailVerified: false,
      verificationToken,
      createdAt: new Date().toISOString()
    };

    this.data.users[userId] = newUser;

    // Create confirmation welcome email
    const emailId = crypto.randomUUID();
    const welcomeEmail: EmailNotification = {
      id: emailId,
      toEmail: newUser.email,
      subject: 'Welcome to Personal Bookmarks! Confirm Your Email',
      body: `Hi @${newUser.handle},\n\nWelcome to Personal Bookmarks — your neat, custom link sharing tree and reader inbox!\n\nTo activate your account and start adding bookmarks, please confirm your email address by clicking the link below:\n\n👉 [Confirm Email Link]\n(Use verification code: ${verificationToken})\n\nThank you for signing up!\n- Personal Bookmarks Team`,
      token: verificationToken,
      status: 'sent',
      createdAt: new Date().toISOString()
    };

    this.data.emails.push(welcomeEmail);
    this.save();

    return { user: newUser, email: welcomeEmail };
  }

  verifyEmail(token: string): User {
    const user = Object.values(this.data.users).find(u => u.verificationToken === token);
    if (!user) {
      throw new Error('Invalid or expired verification token.');
    }

    user.emailVerified = true;
    user.verificationToken = ''; // Mark used
    
    // Update linked email status
    const email = this.data.emails.find(e => e.token === token);
    if (email) {
      email.status = 'verified';
    }

    this.save();
    return user;
  }

  login(email: string, passwordPlain: string): { user: User; token: string } {
    const emailKey = email.trim().toLowerCase();
    const user = Object.values(this.data.users).find(u => u.email.toLowerCase() === emailKey);

    if (!user) {
      throw new Error('Invalid email or password.');
    }

    // Checking email verify status can be toggled, but let's encourage them to verify.
    // Allow login but restrict access or show warning, or block login if pending.
    // The requirement says: "New sign-ups receive a welcome / confirmation email."
    // Let's allow them to log in but warn if unverified, or we can just require verification to proceed or let them click confirm. Let's make verification super slick!

    if (!this.verifyPassword(passwordPlain, user.passwordHash)) {
      throw new Error('Invalid email or password.');
    }

    const sessionToken = crypto.randomBytes(32).toString('hex');
    this.data.tokens[sessionToken] = user.id;
    this.save();

    return { user, token: sessionToken };
  }

  logout(token: string) {
    if (this.data.tokens[token]) {
      delete this.data.tokens[token];
      this.save();
    }
  }

  getUserByToken(token: string): User | null {
    const userId = this.data.tokens[token];
    if (!userId) return null;
    return this.data.users[userId] || null;
  }

  getUserByHandle(handle: string): User | null {
    const queryHandle = handle.trim().toLowerCase();
    return Object.values(this.data.users).find(u => u.handle.toLowerCase() === queryHandle) || null;
  }

  getUserById(id: string): User | null {
    return this.data.users[id] || null;
  }

  // --- Bookmark Operations ---
  getBookmarks(userId: string): Bookmark[] {
    return Object.values(this.data.bookmarks)
      .filter(b => b.userId === userId)
      .sort((a, b) => {
        const posA = a.position ?? 999999;
        const posB = b.position ?? 999999;
        if (posA !== posB) return posA - posB;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }

  getPublicBookmarksByHandle(handle: string): { user: Omit<User, 'passwordHash' | 'verificationToken'>; bookmarks: Bookmark[] } {
    const user = this.getUserByHandle(handle);
    if (!user) {
      throw new Error('User not found.');
    }

    const bookmarks = Object.values(this.data.bookmarks)
      .filter(b => b.userId === user.id && b.isPublic)
      .sort((a, b) => {
        const posA = a.position ?? 999999;
        const posB = b.position ?? 999999;
        if (posA !== posB) return posA - posB;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    
    // Return safe user structure
    const safeUser = {
      id: user.id,
      email: user.email,
      handle: user.handle,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt
    };

    return { user: safeUser, bookmarks };
  }

  addBookmark(userId: string, title: string, urlStr: string, isPublic: boolean, category?: string): Bookmark {
    let url = urlStr.trim();
    if (!/^https?:\/\//i.test(url)) {
      url = 'https://' + url; // auto format
    }

    const user = this.getUserById(userId);
    if (!user) {
      throw new Error('User does not exist.');
    }

    // New items default to first position by shifting existing positions or simply setting to minimum or leaving room
    const userBookmarks = this.getBookmarks(userId);
    // Let's shift all other bookmark positions up by 1 to put the new one at position 0
    userBookmarks.forEach(b => {
      if (b.position !== undefined) {
        b.position += 1;
      } else {
        b.position = 1;
      }
    });

    const id = crypto.randomUUID();
    const bookmark: Bookmark = {
      id,
      userId,
      title: title.trim() || url,
      url,
      isPublic,
      category: category ? category.trim() : undefined,
      position: 0,
      createdAt: new Date().toISOString()
    };

    this.data.bookmarks[id] = bookmark;
    this.save();
    return bookmark;
  }

  reorderBookmarks(userId: string, bookmarkIds: string[]) {
    bookmarkIds.forEach((id, index) => {
      const bookmark = this.data.bookmarks[id];
      if (bookmark && bookmark.userId === userId) {
        bookmark.position = index;
      }
    });
    this.save();
  }

  updateBookmark(userId: string, bookmarkId: string, title: string, urlStr: string, isPublic: boolean, category?: string): Bookmark {
    const existing = this.data.bookmarks[bookmarkId];
    if (!existing) {
      throw new Error('Bookmark not found.');
    }

    // PRIVACY SECURITY CHECK - Must belong to calling user!
    if (existing.userId !== userId) {
      throw new Error('Access denied: You do not own this bookmark.');
    }

    let url = urlStr.trim();
    if (!/^https?:\/\//i.test(url)) {
      url = 'https://' + url;
    }

    existing.title = title.trim() || url;
    existing.url = url;
    existing.isPublic = isPublic;
    existing.category = category ? category.trim() : undefined;

    this.save();
    return existing;
  }

  deleteBookmark(userId: string, bookmarkId: string) {
    const existing = this.data.bookmarks[bookmarkId];
    if (!existing) {
      throw new Error('Bookmark not found.');
    }

    // PRIVACY SECURITY CHECK - Must belong to calling user!
    if (existing.userId !== userId) {
      throw new Error('Access denied: You do not own this bookmark.');
    }

    delete this.data.bookmarks[bookmarkId];
    this.save();
  }

  // --- Email Log Viewer (Virtual Mailbox) ---
  getEmailLogs(): EmailNotification[] {
    return this.data.emails;
  }

  clearEmailLogs() {
    this.data.emails = [];
    this.save();
  }
}

export const dbService = new ServerDatabase();
