import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { dbService } from './server-db';

interface AuthenticatedRequest extends Request {
  user?: any;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Log requests for diagnostic purposes
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  });

  // Bearer Token Authn Middleware
  const authMiddleware = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required. Please log in.' });
    }

    const token = authHeader.split(' ')[1];
    const user = dbService.getUserByToken(token);

    if (!user) {
      return res.status(401).json({ error: 'Session expired or invalid. Please log in again.' });
    }

    req.user = user;
    next();
  };

  // --- API Routes ---

  // Auth Status check
  app.get('/api/auth/me', (req: AuthenticatedRequest, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.json({ user: null });
    }
    const token = authHeader.split(' ')[1];
    const user = dbService.getUserByToken(token);
    if (!user) {
      return res.json({ user: null });
    }
    res.json({
      user: {
        id: user.id,
        email: user.email,
        handle: user.handle,
        emailVerified: user.emailVerified
      }
    });
  });

  // Register Endpoint
  app.post('/api/auth/register', (req, res) => {
    try {
      const { email, password, handle } = req.body;
      if (!email || !password || !handle) {
        return res.status(400).json({ error: 'Please provide email, password, and @handle.' });
      }

      const cleanHandle = handle.trim().toLowerCase().replace(/^@/, '');
      if (!/^[a-zA-Z0-9_]{2,20}$/.test(cleanHandle)) {
        return res.status(400).json({ error: 'Handle can only contain alphanumeric letters and underscores (2-20 characters).' });
      }

      if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
      }

      if (!email.includes('@')) {
        return res.status(400).json({ error: 'Please enter a valid email address.' });
      }

      const { user, email: sentEmail } = dbService.createUser(email, password, cleanHandle);
      res.status(201).json({
        message: 'Account created! Please check your verification email.',
        user: {
          id: user.id,
          email: user.email,
          handle: user.handle,
          emailVerified: user.emailVerified
        },
        email: sentEmail
      });
    } catch (e: any) {
      res.status(400).json({ error: e.message || 'An error occurred during registration.' });
    }
  });

  // Login Endpoint
  app.post('/api/auth/login', (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: 'Please provide email and password.' });
      }

      const { user, token } = dbService.login(email, password);
      res.json({
        user: {
          id: user.id,
          email: user.email,
          handle: user.handle,
          emailVerified: user.emailVerified
        },
        token
      });
    } catch (e: any) {
      res.status(400).json({ error: e.message || 'An error occurred during log in.' });
    }
  });

  // Logout Endpoint
  app.post('/api/auth/logout', (req, res) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      dbService.logout(token);
    }
    res.json({ success: true, message: 'Logged out successfully.' });
  });

  // Verify Email Endpoint
  app.post('/api/auth/verify', (req, res) => {
    try {
      const { token } = req.body;
      if (!token) {
        return res.status(400).json({ error: 'Verification token is required.' });
      }

      const user = dbService.verifyEmail(token);
      res.json({
        success: true,
        message: `Email verified successfully! Profile @${user.handle} is now active.`,
        user: {
          id: user.id,
          email: user.email,
          handle: user.handle,
          emailVerified: user.emailVerified
        }
      });
    } catch (e: any) {
      res.status(400).json({ error: e.message || 'Verification failed.' });
    }
  });

  // --- Bookmarks APIs (Protected) ---

  // Get current user bookmarks
  app.get('/api/bookmarks', authMiddleware, (req: AuthenticatedRequest, res) => {
    try {
      const bookmarks = dbService.getBookmarks(req.user.id);
      res.json({ bookmarks });
    } catch (e: any) {
      res.status(500).json({ error: e.message || 'Could not fetch your bookmarks.' });
    }
  });

  // Reorder bookmarks
  app.post('/api/bookmarks/reorder', authMiddleware, (req: AuthenticatedRequest, res) => {
    try {
      const { bookmarkIds } = req.body;
      if (!Array.isArray(bookmarkIds)) {
        return res.status(400).json({ error: 'bookmarkIds array is required.' });
      }
      dbService.reorderBookmarks(req.user.id, bookmarkIds);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message || 'Could not reorder bookmarks.' });
    }
  });

  // Create standard bookmark
  app.post('/api/bookmarks', authMiddleware, (req: AuthenticatedRequest, res) => {
    try {
      const { title, url, isPublic, category } = req.body;
      if (!url) {
        return res.status(400).json({ error: 'Bookmark URL is required.' });
      }

      const bookmark = dbService.addBookmark(req.user.id, title, url, !!isPublic, category);
      res.status(201).json({ bookmark });
    } catch (e: any) {
      res.status(400).json({ error: e.message || 'Could not create bookmark.' });
    }
  });

  // Update bookmark (strictly secures that ownerId === req.user.id inside database utility)
  app.put('/api/bookmarks/:id', authMiddleware, (req: AuthenticatedRequest, res) => {
    try {
      const { title, url, isPublic, category } = req.body;
      const { id } = req.params;
      if (!url) {
        return res.status(400).json({ error: 'Bookmark URL is required.' });
      }

      const bookmark = dbService.updateBookmark(req.user.id, id, title || '', url, !!isPublic, category);
      res.json({ bookmark });
    } catch (e: any) {
      res.status(403).json({ error: e.message || 'Unauthorized modification.' });
    }
  });

  // Delete bookmark (strictly secures that ownerId === req.user.id inside database utility)
  app.delete('/api/bookmarks/:id', authMiddleware, (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      dbService.deleteBookmark(req.user.id, id);
      res.json({ success: true, message: 'Bookmark removed successfully.' });
    } catch (e: any) {
      res.status(403).json({ error: e.message || 'Unauthorized removal.' });
    }
  });

  // --- Public Handles (OOTB access!) ---
  app.get('/api/profile/:handle', (req, res) => {
    try {
      const { handle } = req.params;
      const data = dbService.getPublicBookmarksByHandle(handle);
      res.json(data);
    } catch (e: any) {
      res.status(404).json({ error: e.message || 'Profile not found.' });
    }
  });

  // --- Virtual Mailbox (Inbox Logs) ---
  app.get('/api/emails', (req, res) => {
    res.json({ emails: dbService.getEmailLogs() });
  });

  // --- Vite & SPA Static Serves Middleware ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server starting securely on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal Server Boot Error:', err);
});
