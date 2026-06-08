import React, { useState, FormEvent } from 'react';
import { ShieldCheck, ArrowRight, Lock, Mail, AtSign, Sparkles, BookOpen, LogIn, UserPlus } from 'lucide-react';

interface WelcomeViewProps {
  onLoginSuccess: (user: any, token: string) => void;
  claimPreselectedHandle?: string;
  onNavigateToPublicProfile: (handle: string) => void;
}

export default function WelcomeView({ onLoginSuccess, claimPreselectedHandle = '', onNavigateToPublicProfile }: WelcomeViewProps) {
  const [isLoginView, setIsLoginView] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [handle, setHandle] = useState(claimPreselectedHandle);
  
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Simple query search to look up public handles straight from home
  const [searchQuery, setSearchQuery] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setLoading(true);

    const endpoint = isLoginView ? '/api/auth/login' : '/api/auth/register';
    const payload = isLoginView 
      ? { email, password } 
      : { email, password, handle };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (res.ok) {
        if (isLoginView) {
          // Token is returned
          onLoginSuccess(data.user, data.token);
        } else {
          // Register successful
          setMessage({
            text: 'Registration successful! 📬 A verification link has arrived in your sandbox inbox below. Open it to activate your account and start bookmarking!',
            type: 'success'
          });
          // Transition to login view so they can sign in after activation
          setIsLoginView(true);
          setPassword(''); // reset password
        }
      } else {
        setMessage({ text: data.error || 'An error occurred.', type: 'error' });
      }
    } catch (e: any) {
      setMessage({ text: 'Could not connect to authentication server.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleSearchProfile = (e: FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      const targetHandle = searchQuery.trim().toLowerCase().replace(/^@/, '');
      onNavigateToPublicProfile(targetHandle);
    }
  };

  return (
    <div className="min-h-screen bg-[#FFF9F5] text-[#2D3436] flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8 font-sans" id="welcome-view-root">
      
      {/* Decorative Brand Top Banner */}
      <div className="text-center mb-8 max-w-lg">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-[#FFD93D] border-3 border-[#2D3436] rounded-xl text-xs font-black text-[#2D3436] mb-5 shadow-[3px_3px_0px_#2D3436]">
          <div className="w-2.5 h-2.5 bg-[#4D96FF] rounded-full border border-[#2D3436]"></div>
          <span>LNKLY • LINKTREE MEETS POCKET</span>
        </div>
        
        <h1 className="text-4xl sm:text-5xl font-black text-[#2D3436] tracking-tight leading-none uppercase">
          Personal <span className="text-[#FF6B6B]">Bookmarks</span>
        </h1>
        <p className="text-sm font-semibold text-[#666666] mt-3 max-w-md mx-auto">
          Curate a list of your favourite links, read lists, and share public portals. Built with real privacy, simplicity, and speed.
        </p>
      </div>

      <div className="max-w-md w-full space-y-6">
        
        {/* Auth Card */}
        <div className="bg-white rounded-3xl border-3 border-[#2D3436] shadow-[8px_8px_0px_#2D3436] p-8 relative overflow-hidden">
          
          {/* Decorative Corner Strip */}
          <div className="absolute top-0 right-0 bg-[#FF6B6B] border-b-3 border-l-3 border-[#2D3436] px-3 py-1 font-black text-[9px] uppercase tracking-wider text-white">
            SECURE PORTAL
          </div>

          {/* Selector Tabs */}
          <div className="flex border-b-3 border-[#2D3436] pb-4 mb-6 select-none gap-2">
            <button
              id="tab-select-login"
              onClick={() => {
                setIsLoginView(true);
                setMessage(null);
              }}
              className={`flex-1 text-center py-2 text-sm font-black rounded-lg transition-all border-2 ${
                isLoginView
                  ? 'bg-[#FFD93D] border-[#2D3436] text-[#2D3436] shadow-[2px_2px_0px_#2D3436]'
                  : 'bg-transparent border-transparent text-[#2D3436]/60 hover:text-[#2D3436]'
              }`}
            >
              Sign In
            </button>
            <button
              id="tab-select-register"
              onClick={() => {
                setIsLoginView(false);
                setMessage(null);
              }}
              className={`flex-1 text-center py-2 text-sm font-black rounded-lg transition-all border-2  ${
                !isLoginView
                  ? 'bg-[#FFD93D] border-[#2D3436] text-[#2D3436] shadow-[2px_2px_0px_#2D3436]'
                  : 'bg-transparent border-transparent text-[#2D3436]/60 hover:text-[#2D3436]'
              }`}
            >
              Claim @Handle
            </button>
          </div>

          {/* Informational Message Status Alert */}
          {message && (
            <div
              id="auth-status-message"
              className={`p-4 rounded-xl text-xs mb-5 border-2 border-[#2D3436] font-bold shadow-[2px_2px_0px_#2D3436] leading-relaxed ${
                message.type === 'success'
                  ? 'bg-[#6BCB77] text-[#2D3436]'
                  : 'bg-[#FF6B6B] text-white'
              }`}
            >
              <div className="flex items-start gap-2">
                <ShieldCheck className="h-4.5 w-4.5 shrink-0 mt-0.5" />
                <span>{message.text}</span>
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4" id="auth-form">
            
            {/* Email Field */}
            <div className="space-y-1.5 text-left">
              <label htmlFor="email-input" className="text-xs font-black uppercase text-[#2D3436] tracking-wider pl-1">
                Email Address
              </label>
              <div className="relative rounded-xl">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#2D3436]">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  id="email-input"
                  name="email"
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-10 pr-3.5 py-3 bg-[#FFF] border-3 border-[#2D3436] rounded-2xl text-sm font-bold focus:outline-none focus:bg-[#FFF9F5] placeholder-slate-400 text-[#2D3436] transition-all font-sans"
                />
              </div>
            </div>

            {/* Handle Field (Register Only) */}
            {!isLoginView && (
              <div className="space-y-1.5 text-left">
                <label htmlFor="handle-input" className="text-xs font-black uppercase text-[#2D3436] tracking-wider flex items-center justify-between pl-1">
                  <span>Unique Handle</span>
                  <span className="text-[10px] text-[#FF6B6B] font-extrabold uppercase">shares public links</span>
                </label>
                <div className="relative rounded-xl">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#2D3436]">
                    <AtSign className="h-4 w-4" />
                  </div>
                  <input
                    id="handle-input"
                    name="handle"
                    type="text"
                    required={!isLoginView}
                    placeholder="myhandle"
                    value={handle}
                    onChange={(e) => setHandle(e.target.value)}
                    className="block w-full pl-10 pr-3.5 py-3 bg-[#FFF] border-3 border-[#2D3436] rounded-2xl text-sm font-bold focus:outline-none focus:bg-[#FFF9F5] placeholder-slate-400 text-[#2D3436] transition-all font-sans"
                  />
                </div>
                <p className="text-[10px] text-slate-500 font-bold mt-1 pl-1">
                  Public Portal: <span className="font-mono bg-[#FFD93D]/30 border border-[#2D3436]/20 px-1 py-0.5 rounded text-[#2D3436]">/{handle || 'handle'}</span>
                </p>
              </div>
            )}

            {/* Password Field */}
            <div className="space-y-1.5 text-left">
              <label htmlFor="password-input" className="text-xs font-black uppercase text-[#2D3436] tracking-wider pl-1 font-bold">
                Password
              </label>
              <div className="relative rounded-xl">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#2D3436]">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  id="password-input"
                  name="password"
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-3.5 py-3 bg-[#FFF] border-3 border-[#2D3436] rounded-2xl text-sm font-bold focus:outline-none focus:bg-[#FFF9F5] placeholder-slate-400 text-[#2D3436] transition-all font-sans"
                />
              </div>
              {!isLoginView && (
                <p className="text-[10px] text-slate-500 font-bold mt-1 pl-1">Min. 6 alphanumeric characters</p>
              )}
            </div>

            {/* Submit Button */}
            <button
              id="btn-auth-submit"
              type="submit"
              disabled={loading}
              className="w-full bg-[#4D96FF] hover:bg-[#3485ff] text-white rounded-2xl py-3.5 border-3 border-[#2D3436] font-black uppercase tracking-wider text-sm transition-all flex items-center justify-center gap-1.5 shadow-[4px_4px_0px_#2D3436] hover:shadow-[2px_2px_0px_#2D3436] active:translate-x-0.5 active:translate-y-0.5 disabled:opacity-50 mt-6"
            >
              {loading ? (
                <div className="h-5 w-5 border-3 border-white border-t-transparent rounded-full animate-spin" />
              ) : isLoginView ? (
                <>
                  <LogIn className="h-4.5 w-4.5" /> Sign In to Dashboard
                </>
              ) : (
                <>
                  <UserPlus className="h-4.5 w-4.5" /> Claim Handle & Register
                </>
              )}
            </button>
          </form>

        </div>

        {/* Public Profile Directory Lookup search */}
        <div className="bg-white rounded-2xl border-3 border-[#2D3436] shadow-[4px_4px_0px_#2D3436] p-5 text-left space-y-3">
          <h3 className="text-xs font-black uppercase text-[#2D3436] tracking-wider flex items-center gap-1.5">
            <BookOpen className="h-4 w-4 text-[#FF6B6B]" /> Explore Public Portals
          </h3>
          <p className="text-xs text-slate-600 font-medium">
            Search handles or visit any user's profile instantly. No login needed for public directories!
          </p>

          <form onSubmit={handleSearchProfile} className="flex gap-2">
            <div className="relative flex-grow">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-[#2D3436] font-black text-xs">
                @
              </span>
              <input
                id="search-handle-input"
                type="text"
                placeholder="design_alex"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-7 pr-3 py-2 text-xs font-bold bg-[#FFF] border-2 border-[#2D3436] rounded-xl focus:outline-none focus:bg-[#FFF9F5]"
              />
            </div>
            <button
              id="btn-search-profile"
              type="submit"
              className="bg-[#FFD93D] hover:bg-[#ffd11a] border-2 border-[#2D3436] text-[#2D3436] px-4 py-2 rounded-xl text-xs font-black transition-all shadow-[2px_2px_0px_#2D3436] active:translate-x-0.5 active:translate-y-0.5 shrink-0"
            >
              Go Visit
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
