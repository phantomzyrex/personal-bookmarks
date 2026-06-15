import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { User, Bookmark, EmailNotification } from './src/types';
import postgres from 'postgres';

const DB_FILE = process.env.VERCEL
  ? path.join('/tmp', 'data-store.json')
  : path.join(process.cwd(), 'data-store.json');

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

  private isPostgres = false;
  private sql: any = null;

  constructor() {
    const pgUrl = process.env.POSTGRES_URL || 
                  process.env.POSTGRES_PRISMA_URL || 
                  process.env.DATABASE_URL || 
                  process.env.SUPABASE_DATABASE_URL;
    if (pgUrl) {
      this.isPostgres = true;
      console.log('Postgres connection string found. Running in Postgres mode.');
      this.sql = postgres(pgUrl, { ssl: 'require' });
      this.initPostgres().catch(err => {
        console.error('Failed to run Postgres initialization:', err);
      });
    } else {
      console.log('No Postgres connection string found. Running in local JSON database mode.');
      this.load();
    }
  }

  private async initPostgres() {
    try {
      await this.sql`
        CREATE TABLE IF NOT EXISTS users (
          id UUID PRIMARY KEY,
          email VARCHAR(255) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          handle VARCHAR(50) UNIQUE NOT NULL,
          email_verified BOOLEAN DEFAULT FALSE,
          verification_token VARCHAR(255),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `;
      await this.sql`
        CREATE TABLE IF NOT EXISTS bookmarks (
          id UUID PRIMARY KEY,
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          title VARCHAR(255) NOT NULL,
          url TEXT NOT NULL,
          is_public BOOLEAN DEFAULT FALSE,
          category VARCHAR(100),
          position INTEGER NOT NULL DEFAULT 0,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `;
      await this.sql`
        CREATE TABLE IF NOT EXISTS emails (
          id UUID PRIMARY KEY,
          to_email VARCHAR(255) NOT NULL,
          subject VARCHAR(255) NOT NULL,
          body TEXT NOT NULL,
          token VARCHAR(255),
          status VARCHAR(50) NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `;
      await this.sql`
        CREATE TABLE IF NOT EXISTS sessions (
          token VARCHAR(255) PRIMARY KEY,
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `;
      console.log('Database tables verified/created successfully.');
    } catch (e) {
      console.error('Error verifying database tables:', e);
      throw e;
    }
  }

  private load() {
    try {
      if (process.env.VERCEL && !fs.existsSync(DB_FILE)) {
        const seedFile = path.join(process.cwd(), 'data-store.json');
        if (fs.existsSync(seedFile)) {
          fs.copyFileSync(seedFile, DB_FILE);
          console.log('Seeded database to /tmp/data-store.json from', seedFile);
        }
      }

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

  // --- Helper DB Mappers ---
  private mapDbUser(row: any): User | null {
    if (!row) return null;
    return {
      id: row.id,
      email: row.email,
      passwordHash: row.password_hash,
      handle: row.handle,
      emailVerified: !!row.email_verified,
      verificationToken: row.verification_token || '',
      createdAt: new Date(row.created_at).toISOString()
    };
  }

  private mapDbBookmark(row: any): Bookmark {
    return {
      id: row.id,
      userId: row.user_id,
      title: row.title,
      url: row.url,
      isPublic: !!row.is_public,
      category: row.category || undefined,
      position: row.position,
      createdAt: new Date(row.created_at).toISOString()
    };
  }

  private mapDbEmail(row: any): EmailNotification {
    return {
      id: row.id,
      toEmail: row.to_email,
      subject: row.subject,
      body: row.body,
      token: row.token || '',
      status: row.status as 'sent' | 'verified',
      createdAt: new Date(row.created_at).toISOString()
    };
  }

  // --- User Operations ---
  async createUser(email: string, passwordPlain: string, rawHandle: string): Promise<{ user: User; email: EmailNotification }> {
    const handle = rawHandle.trim().toLowerCase().replace(/^@/, '');
    const emailKey = email.trim().toLowerCase();

    if (this.isPostgres) {
      // Check pre-existence of email
      const emailCheck = await this.sql`SELECT 1 FROM users WHERE LOWER(email) = LOWER(${emailKey}) LIMIT 1`;
      if (emailCheck.length > 0) {
        throw new Error('An account with this email already exists.');
      }

      // Check pre-existence of handle
      const handleCheck = await this.sql`SELECT 1 FROM users WHERE LOWER(handle) = LOWER(${handle}) LIMIT 1`;
      if (handleCheck.length > 0) {
        throw new Error(`The handle @${rawHandle} is already claimed.`);
      }

      const userId = crypto.randomUUID();
      const verificationToken = crypto.randomBytes(16).toString('hex');
      const passwordHash = this.hashPassword(passwordPlain);
      const createdAt = new Date().toISOString();

      const [newUserRow] = await this.sql`
        INSERT INTO users (id, email, password_hash, handle, email_verified, verification_token, created_at)
        VALUES (${userId}, ${email.trim()}, ${passwordHash}, ${handle}, false, ${verificationToken}, ${createdAt})
        RETURNING *
      `;

      const newUser = this.mapDbUser(newUserRow)!;

      // Create confirmation welcome email
      const emailId = crypto.randomUUID();
      const welcomeEmailBody = `Hi @${newUser.handle},\n\nWelcome to Personal Bookmarks — your neat, custom link sharing tree and reader inbox!\n\nTo activate your account and start adding bookmarks, please confirm your email address by clicking the link below:\n\n👉 [Confirm Email Link]\n(Use verification code: ${verificationToken})\n\nThank you for signing up!\n- Personal Bookmarks Team`;
      
      const [newEmailRow] = await this.sql`
        INSERT INTO emails (id, to_email, subject, body, token, status, created_at)
        VALUES (${emailId}, ${newUser.email}, 'Welcome to Personal Bookmarks! Confirm Your Email', ${welcomeEmailBody}, ${verificationToken}, 'sent', ${createdAt})
        RETURNING *
      `;

      const welcomeEmail = this.mapDbEmail(newEmailRow);

      return { user: newUser, email: welcomeEmail };
    } else {
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
  }

  async verifyEmail(token: string): Promise<User> {
    if (this.isPostgres) {
      const [userRow] = await this.sql`SELECT * FROM users WHERE verification_token = ${token} LIMIT 1`;
      if (!userRow) {
        throw new Error('Invalid or expired verification token.');
      }

      const [updatedUserRow] = await this.sql`
        UPDATE users
        SET email_verified = true, verification_token = ''
        WHERE id = ${userRow.id}
        RETURNING *
      `;

      await this.sql`
        UPDATE emails
        SET status = 'verified'
        WHERE token = ${token}
      `;

      return this.mapDbUser(updatedUserRow)!;
    } else {
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
  }

  async login(email: string, passwordPlain: string): Promise<{ user: User; token: string }> {
    const emailKey = email.trim().toLowerCase();

    if (this.isPostgres) {
      const [userRow] = await this.sql`SELECT * FROM users WHERE LOWER(email) = LOWER(${emailKey}) LIMIT 1`;
      if (!userRow) {
        throw new Error('Invalid email or password.');
      }

      const user = this.mapDbUser(userRow)!;

      if (!this.verifyPassword(passwordPlain, user.passwordHash)) {
        throw new Error('Invalid email or password.');
      }

      const sessionToken = crypto.randomBytes(32).toString('hex');
      const createdAt = new Date().toISOString();
      await this.sql`
        INSERT INTO sessions (token, user_id, created_at)
        VALUES (${sessionToken}, ${user.id}, ${createdAt})
      `;

      return { user, token: sessionToken };
    } else {
      const user = Object.values(this.data.users).find(u => u.email.toLowerCase() === emailKey);

      if (!user) {
        throw new Error('Invalid email or password.');
      }

      if (!this.verifyPassword(passwordPlain, user.passwordHash)) {
        throw new Error('Invalid email or password.');
      }

      const sessionToken = crypto.randomBytes(32).toString('hex');
      this.data.tokens[sessionToken] = user.id;
      this.save();

      return { user, token: sessionToken };
    }
  }

  async logout(token: string): Promise<void> {
    if (this.isPostgres) {
      await this.sql`DELETE FROM sessions WHERE token = ${token}`;
    } else {
      if (this.data.tokens[token]) {
        delete this.data.tokens[token];
        this.save();
      }
    }
  }

  async getUserByToken(token: string): Promise<User | null> {
    if (this.isPostgres) {
      const [userRow] = await this.sql`
        SELECT u.* FROM users u
        JOIN sessions s ON u.id = s.user_id
        WHERE s.token = ${token}
        LIMIT 1
      `;
      return this.mapDbUser(userRow);
    } else {
      const userId = this.data.tokens[token];
      if (!userId) return null;
      return this.data.users[userId] || null;
    }
  }

  async getUserByHandle(handle: string): Promise<User | null> {
    const queryHandle = handle.trim().toLowerCase();
    if (this.isPostgres) {
      const [userRow] = await this.sql`SELECT * FROM users WHERE LOWER(handle) = LOWER(${queryHandle}) LIMIT 1`;
      return this.mapDbUser(userRow);
    } else {
      return Object.values(this.data.users).find(u => u.handle.toLowerCase() === queryHandle) || null;
    }
  }

  async getUserById(id: string): Promise<User | null> {
    if (this.isPostgres) {
      const [userRow] = await this.sql`SELECT * FROM users WHERE id = ${id} LIMIT 1`;
      return this.mapDbUser(userRow);
    } else {
      return this.data.users[id] || null;
    }
  }

  // --- Bookmark Operations ---
  async getBookmarks(userId: string): Promise<Bookmark[]> {
    if (this.isPostgres) {
      const rows = await this.sql`
        SELECT * FROM bookmarks
        WHERE user_id = ${userId}
        ORDER BY position ASC, created_at DESC
      `;
      return rows.map((r: any) => this.mapDbBookmark(r));
    } else {
      return Object.values(this.data.bookmarks)
        .filter(b => b.userId === userId)
        .sort((a, b) => {
          const posA = a.position ?? 999999;
          const posB = b.position ?? 999999;
          if (posA !== posB) return posA - posB;
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
    }
  }

  async getPublicBookmarksByHandle(handle: string): Promise<{ user: Omit<User, 'passwordHash' | 'verificationToken'>; bookmarks: Bookmark[] }> {
    const user = await this.getUserByHandle(handle);
    if (!user) {
      throw new Error('User not found.');
    }

    if (this.isPostgres) {
      const rows = await this.sql`
        SELECT * FROM bookmarks
        WHERE user_id = ${user.id} AND is_public = true
        ORDER BY position ASC, created_at DESC
      `;
      const bookmarks = rows.map((r: any) => this.mapDbBookmark(r));
      
      const safeUser = {
        id: user.id,
        email: user.email,
        handle: user.handle,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt
      };

      return { user: safeUser, bookmarks };
    } else {
      const bookmarks = Object.values(this.data.bookmarks)
        .filter(b => b.userId === user.id && b.isPublic)
        .sort((a, b) => {
          const posA = a.position ?? 999999;
          const posB = b.position ?? 999999;
          if (posA !== posB) return posA - posB;
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
      
      const safeUser = {
        id: user.id,
        email: user.email,
        handle: user.handle,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt
      };

      return { user: safeUser, bookmarks };
    }
  }

  async addBookmark(userId: string, title: string, urlStr: string, isPublic: boolean, category?: string): Promise<Bookmark> {
    let url = urlStr.trim();
    if (!/^https?:\/\//i.test(url)) {
      url = 'https://' + url;
    }

    const user = await this.getUserById(userId);
    if (!user) {
      throw new Error('User does not exist.');
    }

    if (this.isPostgres) {
      // Shift other positions up
      await this.sql`
        UPDATE bookmarks
        SET position = position + 1
        WHERE user_id = ${userId}
      `;

      const bookmarkId = crypto.randomUUID();
      const createdAt = new Date().toISOString();
      const cleanTitle = title.trim() || url;
      const cleanCategory = category ? category.trim() : null;

      const [newBookmarkRow] = await this.sql`
        INSERT INTO bookmarks (id, user_id, title, url, is_public, category, position, created_at)
        VALUES (${bookmarkId}, ${userId}, ${cleanTitle}, ${url}, ${isPublic}, ${cleanCategory}, 0, ${createdAt})
        RETURNING *
      `;

      return this.mapDbBookmark(newBookmarkRow);
    } else {
      const userBookmarks = await this.getBookmarks(userId);
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
  }

  async reorderBookmarks(userId: string, bookmarkIds: string[]): Promise<void> {
    if (this.isPostgres) {
      await this.sql.begin(async (sql: any) => {
        for (let index = 0; index < bookmarkIds.length; index++) {
          const id = bookmarkIds[index];
          await sql`
            UPDATE bookmarks
            SET position = ${index}
            WHERE id = ${id} AND user_id = ${userId}
          `;
        }
      });
    } else {
      bookmarkIds.forEach((id, index) => {
        const bookmark = this.data.bookmarks[id];
        if (bookmark && bookmark.userId === userId) {
          bookmark.position = index;
        }
      });
      this.save();
    }
  }

  async updateBookmark(userId: string, bookmarkId: string, title: string, urlStr: string, isPublic: boolean, category?: string): Promise<Bookmark> {
    let url = urlStr.trim();
    if (!/^https?:\/\//i.test(url)) {
      url = 'https://' + url;
    }

    if (this.isPostgres) {
      const [existing] = await this.sql`SELECT * FROM bookmarks WHERE id = ${bookmarkId} LIMIT 1`;
      if (!existing) {
        throw new Error('Bookmark not found.');
      }

      if (existing.user_id !== userId) {
        throw new Error('Access denied: You do not own this bookmark.');
      }

      const cleanTitle = title.trim() || url;
      const cleanCategory = category ? category.trim() : null;

      const [updatedRow] = await this.sql`
        UPDATE bookmarks
        SET title = ${cleanTitle}, url = ${url}, is_public = ${isPublic}, category = ${cleanCategory}
        WHERE id = ${bookmarkId}
        RETURNING *
      `;

      return this.mapDbBookmark(updatedRow);
    } else {
      const existing = this.data.bookmarks[bookmarkId];
      if (!existing) {
        throw new Error('Bookmark not found.');
      }

      if (existing.userId !== userId) {
        throw new Error('Access denied: You do not own this bookmark.');
      }

      existing.title = title.trim() || url;
      existing.url = url;
      existing.isPublic = isPublic;
      existing.category = category ? category.trim() : undefined;

      this.save();
      return existing;
    }
  }

  async deleteBookmark(userId: string, bookmarkId: string): Promise<void> {
    if (this.isPostgres) {
      const [existing] = await this.sql`SELECT * FROM bookmarks WHERE id = ${bookmarkId} LIMIT 1`;
      if (!existing) {
        throw new Error('Bookmark not found.');
      }

      if (existing.user_id !== userId) {
        throw new Error('Access denied: You do not own this bookmark.');
      }

      await this.sql`DELETE FROM bookmarks WHERE id = ${bookmarkId}`;
    } else {
      const existing = this.data.bookmarks[bookmarkId];
      if (!existing) {
        throw new Error('Bookmark not found.');
      }

      if (existing.userId !== userId) {
        throw new Error('Access denied: You do not own this bookmark.');
      }

      delete this.data.bookmarks[bookmarkId];
      this.save();
    }
  }

  // --- Email Log Viewer (Virtual Mailbox) ---
  async getEmailLogs(): Promise<EmailNotification[]> {
    if (this.isPostgres) {
      const rows = await this.sql`SELECT * FROM emails ORDER BY created_at DESC`;
      return rows.map((r: any) => this.mapDbEmail(r));
    } else {
      return this.data.emails;
    }
  }

  async clearEmailLogs(): Promise<void> {
    if (this.isPostgres) {
      await this.sql`DELETE FROM emails`;
    } else {
      this.data.emails = [];
      this.save();
    }
  }
}

export const dbService = new ServerDatabase();

