import { useState, useEffect } from 'react';
import { ExternalLink, BookOpen, Sparkles, User, ShieldAlert, ArrowLeft, PlusCircle } from 'lucide-react';
import { Bookmark } from '../types';

interface ProfileViewProps {
  handle: string;
  onNavigateHome: () => void;
  onNavigateRegisterWithHandle?: (claimedHandle: string) => void;
}

function Favicon({ url, title }: { url: string; title: string }) {
  const [imgError, setImgError] = useState(false);

  let hostname = '';
  try {
    hostname = new URL(url).hostname;
  } catch {
    hostname = '';
  }

  const faviconSrc = hostname ? `https://www.google.com/s2/favicons?sz=64&domain=${hostname}` : null;

  if (imgError || !faviconSrc) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#FFD93D]/20 text-[#2D3436] font-black uppercase text-sm select-none">
        {title ? title.substring(0, 1) : '?'}
      </div>
    );
  }

  return (
    <img
      src={faviconSrc}
      alt="favicon"
      className="w-5 h-5 object-contain"
      referrerPolicy="no-referrer"
      onError={() => setImgError(true)}
    />
  );
}

export default function ProfileView({ handle, onNavigateHome, onNavigateRegisterWithHandle }: ProfileViewProps) {
  const [profile, setProfile] = useState<any>(null);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMess, setErrorMess] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      setErrorMess(null);
      try {
        const res = await fetch(`/api/profile/${handle}`);
        const data = await res.json();
        if (res.ok) {
          setProfile(data.user);
          setBookmarks(data.bookmarks || []);
        } else {
          setErrorMess(data.error || 'This handle could not be loaded.');
        }
      } catch (e) {
        setErrorMess('An error occurred while loading this public profile.');
      } finally {
        setLoading(false);
      }
    };

    if (handle) {
      fetchProfile();
    }
  }, [handle]);

  return (
    <div className="min-h-screen bg-[#FFF9F5] text-[#2D3436] flex flex-col font-sans" id="profile-view-root">
      {/* Visual background splash */}
      <div className="h-40 bg-[#FF6B6B] border-b-4 border-[#2D3436] w-full relative shrink-0">
        <div className="absolute top-4 left-4">
          <button
            id="btn-back-home"
            onClick={onNavigateHome}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white hover:bg-[#FFD93D] border-2 border-[#2D3436] text-[#2D3436] text-xs font-black uppercase tracking-wider shadow-[3px_3px_0px_#2D3436] hover:shadow-[1px_1px_0px_#2D3436] hover:translate-x-0.5 hover:translate-y-0.5 transition-all duration-200"
          >
            <ArrowLeft className="h-3.5 w-3.5 stroke-[2.5]" /> Back Home
          </button>
        </div>
      </div>

      <div className="max-w-2xl w-full mx-auto px-4 -mt-16 flex-grow pb-16">
        {loading ? (
          <div className="bg-white rounded-3xl border-3 border-[#2D3436] shadow-[6px_6px_0px_#2D3436] p-8 text-center animate-pulse">
            <div className="h-20 w-20 rounded-full bg-[#FFF9F5] border-2 border-[#2D3436]/10 mx-auto mb-4" />
            <div className="h-6 w-36 bg-[#FFF9F5] border border-[#2D3436]/10 mx-auto rounded mb-2" />
            <div className="h-4 w-48 bg-[#FFF9F5] border border-[#2D3436]/10 mx-auto rounded mb-8" />
            <div className="space-y-3">
              <div className="h-12 bg-[#FFF9F5] border border-[#2D3436]/10 rounded-xl" />
              <div className="h-12 bg-[#FFF9F5] border border-[#2D3436]/10 rounded-xl" />
            </div>
          </div>
        ) : errorMess ? (
          /* unclaimed profiles display a clever claim screen */
          <div className="bg-white rounded-3xl border-3 border-[#2D3436] shadow-[8px_8px_0px_#2D3436] p-8 text-center">
            <div className="h-12 w-12 rounded-full bg-[#FFD93D] border-2 border-[#2D3436] flex items-center justify-center mx-auto mb-4 shadow-[2px_2px_0px_#2D3436]">
              <ShieldAlert className="h-6 w-6 text-[#2D3436]" />
            </div>
            <h2 className="text-xl font-black text-[#2D3436] uppercase tracking-tight">
              Handle @{handle} is unclaimed!
            </h2>
            <p className="text-sm text-slate-600 font-bold mt-3 max-w-sm mx-auto leading-relaxed">
              This space is completely yours to own. Register this unique handle now to share your favorite sites, reads, files, and links with anyone!
            </p>
            <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                id="btn-claim-handle"
                onClick={() => onNavigateRegisterWithHandle?.(handle)}
                className="w-full sm:w-auto bg-[#4D96FF] hover:bg-[#3485ff] text-white font-black uppercase tracking-wider text-xs px-5 py-3 rounded-xl border-2 border-[#2D3436] shadow-[3px_3px_0px_#2D3436] hover:shadow-[1px_1px_0px_#2D3436] hover:translate-x-0.5 hover:translate-y-0.5 transition-all duration-200 flex items-center justify-center gap-2"
              >
                <PlusCircle className="h-4 w-4" /> Claim @{handle} Now
              </button>
              <button
                id="btn-register-home"
                onClick={onNavigateHome}
                className="w-full sm:w-auto bg-white hover:bg-[#FFF9F5] text-[#2D3436] border-2 border-[#2D3436] font-black uppercase tracking-wider text-xs px-5 py-3 rounded-xl shadow-[3px_3px_0px_#2D3436] hover:shadow-[1px_1px_0px_#2D3436] hover:translate-x-0.5 hover:translate-y-0.5 transition-all duration-200"
              >
                Go to Homepage
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* User Bio Card */}
            <div className="bg-white rounded-3xl border-3 border-[#2D3436] shadow-[8px_8px_0px_#2D3436] p-6 text-center relative overflow-hidden">
              <div className="absolute top-0 right-0 p-3">
                <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest font-black text-[#2D3436] bg-[#FFD93D] border-2 border-[#2D3436] px-2.5 py-0.5 rounded-lg shadow-[2px_2px_0px_#2D3436]">
                  Public List
                </span>
              </div>
 
              <div className="h-20 w-20 rounded-full bg-[#FFD93D] text-[#2D3436] flex items-center justify-center mx-auto border-3 border-[#2D3436] shadow-[4px_4px_0px_#2D3436] relative">
                <span className="text-2xl font-black uppercase">{profile?.handle?.substring(0, 2) || handle.substring(0,2)}</span>
                {profile?.emailVerified && (
                  <span className="absolute -bottom-1 -right-1 bg-[#6BCB77] text-[#2D3436] rounded-full p-1 border-2 border-[#2D3436]" title="Verified User">
                    <svg className="h-3 w-3 stroke-[3]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                )}
              </div>
 
              <h2 className="text-2xl font-black text-[#2D3436] mt-4 tracking-tight animate-none">
                @{profile?.handle}
              </h2>
              <p className="text-xs text-slate-500 font-bold font-mono mt-1">
                Active member since {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short' }) : 'June 2026'}
              </p>
 
              <div className="mt-5 border-t-2 border-[#2D3436]/10 pt-4 flex items-center justify-center gap-1.5 text-xs font-black uppercase text-slate-600">
                <BookOpen className="h-4.5 w-4.5 text-[#6BCB77] stroke-[3.5]" />
                <span>{bookmarks.length} Bookmarks Shared</span>
              </div>
            </div>
 
            {/* Public Links List */}
            <div className="space-y-3">
              <h3 className="text-xs font-black text-[#2D3436] uppercase tracking-widest px-1">
                Shared Directory Links
              </h3>
 
              {bookmarks.length === 0 ? (
                <div className="bg-white rounded-3xl border-3 border-[#2D3436] p-8 text-center shadow-[4px_4px_0px_#2D3436]">
                  <p className="text-sm text-slate-600 font-bold uppercase">No bookmarks shared yet!</p>
                  <p className="text-xs text-slate-400 font-semibold mt-1">Check back later or register to build your own directory.</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {bookmarks.map((bookmark) => (
                    <a
                      key={bookmark.id}
                      id={`public-bookmark-${bookmark.id}`}
                      href={bookmark.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-center justify-between p-5 bg-white border-3 border-[#2D3436] rounded-3xl shadow-[4px_4px_0px_#2D3436] hover:shadow-[6px_6px_0px_#2D3436] transition-all transform hover:-translate-y-0.5 active:translate-y-0 text-left"
                    >
                      <div className="flex items-center gap-3.5 min-w-0 flex-1">
                        {/* Neo-brutalist favicon container */}
                        <div className="shrink-0 h-10 w-10 bg-white border-2 border-[#2D3436] rounded-xl flex items-center justify-center overflow-hidden shadow-[2px_2px_0px_#2D3436] group-hover:bg-[#FFF9F5] transition-colors">
                          <Favicon url={bookmark.url} title={bookmark.title} />
                        </div>

                        <div className="min-w-0 flex-1 space-y-1 font-sans">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="text-base font-black text-[#2D3436] group-hover:text-[#4D96FF] transition-colors line-clamp-1">
                              {bookmark.title || bookmark.url}
                            </h4>
                            {bookmark.category && (
                              <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-lg border-2 border-[#2D3436] bg-[#FFD93D] text-[#2D3436]">
                                🏷️ {bookmark.category}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 font-black font-mono truncate">
                            {bookmark.url}
                          </p>
                        </div>
                      </div>
                      <span className="shrink-0 h-9 w-9 rounded-xl bg-[#FFF9F5] text-[#2D3436] border-2 border-[#2D3436] transition-colors flex items-center justify-center shadow-[2px_2px_0px_#2D3436] ml-3">
                        <ExternalLink className="h-4.5 w-4.5 stroke-[2.5]" />
                      </span>
                    </a>
                  ))}
                </div>
              )}
            </div>
 
            {/* Dynamic visual launcher cue */}
            <div className="text-center pt-8">
              <button
                id="btn-profile-cta"
                onClick={onNavigateHome}
                className="inline-flex items-center gap-2 bg-[#FFD93D] hover:bg-[#ffd11a] text-[#2D3436] font-black uppercase tracking-wider text-xs px-6 py-3.5 border-3 border-[#2D3436] rounded-2xl shadow-[4px_4px_0px_#2D3436] hover:shadow-[2px_2px_0px_#2D3436] active:translate-x-0.5 active:translate-y-0.5 transition-all duration-200"
              >
                <Sparkles className="h-4 w-4 fill-current" /> Build Your Own Linktree Directory
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
