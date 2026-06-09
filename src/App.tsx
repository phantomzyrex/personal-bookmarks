import { useState, useEffect } from 'react';
import { apiUrl } from './api';
import WelcomeView from './components/WelcomeView';
import Dashboard from './components/Dashboard';
import ProfileView from './components/ProfileView';
import VirtualMailbox from './components/VirtualMailbox';

type ViewType = 'welcome' | 'dashboard' | 'profile';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<ViewType>('welcome');
  const [profileHandle, setProfileHandle] = useState('');
  const [claimPreselectedHandle, setClaimPreselectedHandle] = useState('');
  const [mailboxRefreshTrigger, setMailboxRefreshTrigger] = useState(0);
  const [authLoading, setAuthLoading] = useState(true);

  // Parse path and route initially
  const getInitialRouteFromPath = (path: string): { view: ViewType; handle: string } => {
    if (path === '/' || path === '') {
      return { view: 'welcome', handle: '' };
    }
    if (path === '/dashboard') {
      return { view: 'dashboard', handle: '' };
    }
    // Any other alphanumeric path is treated as public profile query, e.g. "/sparky" -> sparky
    const cleanHandle = path.substring(1);
    return { view: 'profile', handle: cleanHandle };
  };

  const syncStateFromPathname = () => {
    const { view, handle } = getInitialRouteFromPath(window.location.pathname);
    setCurrentView(view);
    setProfileHandle(handle);
  };

  // Navigates securely with standard browser navigation pushState triggers
  const navigateTo = (view: ViewType, handle: string = '', preselectedHandleClaim: string = '') => {
    let targetPath = '/';
    if (view === 'dashboard') {
      targetPath = '/dashboard';
    } else if (view === 'profile') {
      targetPath = `/${handle}`;
    }

    if (window.location.pathname !== targetPath) {
      window.history.pushState({}, '', targetPath);
    }

    setCurrentView(view);
    setProfileHandle(handle);
    if (preselectedHandleClaim) {
      setClaimPreselectedHandle(preselectedHandleClaim);
    }
  };

  // 1. Initial Authentication Loop on Setup Mount
  useEffect(() => {
    const checkAuthStatus = async () => {
      const storedToken = localStorage.getItem('auth_token');
      if (storedToken) {
        try {
          const res = await fetch(apiUrl('/api/auth/me'), {
            headers: {
              'Authorization': `Bearer ${storedToken}`
            }
          });
          const data = await res.json();
          if (res.ok && data.user) {
            setUser(data.user);
            setToken(storedToken);
            
            // If logged in and on landing page view, navigate to dashboard automatically
            const { view } = getInitialRouteFromPath(window.location.pathname);
            if (view === 'welcome') {
              navigateTo('dashboard');
            }
          } else {
            // Invalid/expired token
            localStorage.removeItem('auth_token');
          }
        } catch (e) {
          console.error('Session authentication failed:', e);
        }
      }
      setAuthLoading(false);
    };

    checkAuthStatus();
    syncStateFromPathname();

    // Browser navigation (back/forward keys) listener
    const handlePopState = () => {
      syncStateFromPathname();
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleLoginSuccess = (loggedInUser: any, sessionToken: string) => {
    setUser(loggedInUser);
    setToken(sessionToken);
    localStorage.setItem('auth_token', sessionToken);
    navigateTo('dashboard');
    // Bump mailbox list refresh
    setMailboxRefreshTrigger(prev => prev + 1);
  };

  const handleLogout = async () => {
    try {
      if (token) {
        await fetch(apiUrl('/api/auth/logout'), {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
      }
    } catch (e) {
      console.error('Logout request was ignored:', e);
    } finally {
      setUser(null);
      setToken(null);
      localStorage.removeItem('auth_token');
      navigateTo('welcome');
    }
  };

  const refreshUserStatus = async () => {
    if (!token) return;
    try {
      const res = await fetch(apiUrl('/api/auth/me'), {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (res.ok && data.user) {
        setUser(data.user);
      }
    } catch (e) {
      console.error('Could not refresh account verify status:', e);
    }
  };

  const handleMailboxVerifySuccess = (verifiedUser: any) => {
    // If the verified user matches the currently signed in user, sync status immediately!
    if (user && user.id === verifiedUser.id) {
      setUser(verifiedUser);
    }
  };

  // Guard routing if logged out
  useEffect(() => {
    if (!authLoading) {
      if (currentView === 'dashboard' && !user) {
        navigateTo('welcome');
      }
    }
  }, [currentView, user, authLoading]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center font-sans">
        <div className="h-10 w-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mt-4">
          Personal Bookmarks Loading
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 relative flex flex-col justify-between">
      
      {/* Route Render Module switch */}
      <div className="flex-grow">
        {currentView === 'dashboard' && user && token ? (
          <Dashboard
            user={user}
            token={token}
            onLogout={handleLogout}
            onRefreshUserStatus={refreshUserStatus}
            onTriggerMailboxRefresh={() => setMailboxRefreshTrigger(prev => prev + 1)}
          />
        ) : currentView === 'profile' ? (
          <ProfileView
            handle={profileHandle}
            onNavigateHome={() => navigateTo(user ? 'dashboard' : 'welcome')}
            onNavigateRegisterWithHandle={(claimedHandle) => {
              navigateTo('welcome', '', claimedHandle);
            }}
          />
        ) : (
          <WelcomeView
            onLoginSuccess={handleLoginSuccess}
            claimPreselectedHandle={claimPreselectedHandle}
            onNavigateToPublicProfile={(h) => navigateTo('profile', h)}
          />
        )}
      </div>

      {/* Embedded Virtual Sandbox Email Inbox drawer */}
      <VirtualMailbox 
        onVerifySuccess={handleMailboxVerifySuccess} 
        triggerRefreshTrigger={mailboxRefreshTrigger} 
      />

    </div>
  );
}
