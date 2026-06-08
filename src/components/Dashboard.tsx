import React, { useState, useEffect, FormEvent } from 'react';
import { 
  LogOut, Globe, Lock, ExternalLink, Plus, Edit2, Trash2, Check, X, 
  Copy, Link, Mail, CheckCircle, Sparkles, FolderHeart, ShieldCheck,
  Search, GripVertical
} from 'lucide-react';
import { Bookmark, User } from '../types';

interface DashboardProps {
  user: {
    id: string;
    email: string;
    handle: string;
    emailVerified: boolean;
  };
  token: string;
  onLogout: () => void;
  onRefreshUserStatus: () => Promise<void>;
  onTriggerMailboxRefresh: () => void;
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

export default function Dashboard({ 
  user, 
  token, 
  onLogout, 
  onRefreshUserStatus,
  onTriggerMailboxRefresh
}: DashboardProps) {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMess, setErrorMess] = useState<string | null>(null);

  // New Bookmark Form State
  const [newTitle, setNewTitle] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newIsPublic, setNewIsPublic] = useState(true);
  const [newCategory, setNewCategory] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Editing Bookmark State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const [editIsPublic, setEditIsPublic] = useState(true);
  const [editCategory, setEditCategory] = useState('');

  // Search and Filtering State
  const [searchQueryText, setSearchQueryText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  // Link copy visual feedback
  const [copied, setCopied] = useState(false);

  // Drag and Drop States for Bookmark reordering
  const [draggedBookmarkId, setDraggedBookmarkId] = useState<string | null>(null);
  const [dragOverBookmarkId, setDragOverBookmarkId] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedBookmarkId(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    if (draggedBookmarkId !== id) {
      setDragOverBookmarkId(id);
    }
  };

  const handleDragEnd = () => {
    setDraggedBookmarkId(null);
    setDragOverBookmarkId(null);
  };

  const handleDrop = async (e: React.DragEvent, id: string) => {
    e.preventDefault();
    if (!draggedBookmarkId || draggedBookmarkId === id) {
      setDraggedBookmarkId(null);
      setDragOverBookmarkId(null);
      return;
    }

    const visibleIds = filteredBookmarks.map(b => b.id);
    const fromIndex = visibleIds.indexOf(draggedBookmarkId);
    const toIndex = visibleIds.indexOf(id);

    if (fromIndex === -1 || toIndex === -1) {
      setDraggedBookmarkId(null);
      setDragOverBookmarkId(null);
      return;
    }

    const updatedVisibleIds = [...visibleIds];
    const [draggedId] = updatedVisibleIds.splice(fromIndex, 1);
    updatedVisibleIds.splice(toIndex, 0, draggedId);

    const visibleSet = new Set(visibleIds);
    const finalIds: string[] = [];
    
    bookmarks.forEach(b => {
      if (!visibleSet.has(b.id)) {
        finalIds.push(b.id);
      }
    });

    const allSortedIds = [...updatedVisibleIds, ...finalIds];

    const idToBookmark = new Map<string, Bookmark>(bookmarks.map(b => [b.id, b]));
    const reorderedBookmarks = allSortedIds
      .map((sid, index) => {
        const b = idToBookmark.get(sid);
        if (b) {
          return { ...(b as Bookmark), position: index } as Bookmark;
        }
        return null;
      })
      .filter((b): b is Bookmark => b !== null);

    setBookmarks(reorderedBookmarks);
    setDraggedBookmarkId(null);
    setDragOverBookmarkId(null);

    try {
      const res = await fetch('/api/bookmarks/reorder', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ bookmarkIds: allSortedIds })
      });
      if (!res.ok) {
        console.error('Failed to save bookmark sorting order');
      }
    } catch (err) {
      console.error('Network error during bookmark reordering:', err);
    }
  };

  const fetchBookmarks = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/bookmarks', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (res.ok) {
        setBookmarks(data.bookmarks || []);
      } else {
        setErrorMess(data.error || 'Could not load your bookmarks.');
      }
    } catch (e) {
      setErrorMess('An error occurred during bookmarks query.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookmarks();
  }, [token]);

  const handleCreateBookmark = async (e: FormEvent) => {
    e.preventDefault();
    if (!newUrl.trim()) return;

    setSubmitting(true);
    setErrorMess(null);

    try {
      const res = await fetch('/api/bookmarks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: newTitle.trim(),
          url: newUrl.trim(),
          isPublic: newIsPublic,
          category: newCategory.trim()
        })
      });

      const data = await res.json();
      if (res.ok) {
        // Appends to list
        setBookmarks([data.bookmark, ...bookmarks]);
        setNewTitle('');
        setNewUrl('');
        setNewCategory('');
        setNewIsPublic(true);
      } else {
        setErrorMess(data.error || 'Failed to add bookmark.');
      }
    } catch (e) {
      setErrorMess('Could not reach the database server.');
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (b: Bookmark) => {
    setEditingId(b.id);
    setEditTitle(b.title);
    setEditUrl(b.url);
    setEditIsPublic(b.isPublic);
    setEditCategory(b.category || '');
  };

  const handleUpdateBookmark = async (id: string) => {
    if (!editUrl.trim()) return;
    setErrorMess(null);

    try {
      const res = await fetch(`/api/bookmarks/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: editTitle.trim(),
          url: editUrl.trim(),
          isPublic: editIsPublic,
          category: editCategory.trim()
        })
      });

      const data = await res.json();
      if (res.ok) {
        setBookmarks(bookmarks.map(b => b.id === id ? data.bookmark : b));
        setEditingId(null);
      } else {
        setErrorMess(data.error || 'Failed to update bookmark.');
      }
    } catch (e) {
      setErrorMess('Error updating bookmark.');
    }
  };

  const handleDeleteBookmark = async (id: string) => {
    if (!confirm('Are you sure you want to delete this bookmark?')) return;
    setErrorMess(null);

    try {
      const res = await fetch(`/api/bookmarks/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (res.ok) {
        setBookmarks(bookmarks.filter(b => b.id !== id));
      } else {
        setErrorMess(data.error || 'Failed to delete bookmark.');
      }
    } catch (e) {
      setErrorMess('Error deleting bookmark.');
    }
  };

  const handleCopyLink = () => {
    const publicProfileUrl = `${window.location.origin}/${user.handle}`;
    navigator.clipboard.writeText(publicProfileUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const existingCategories = Array.from(
    new Set(bookmarks.map(b => b.category?.trim()).filter(Boolean))
  ) as string[];

  // 1. Filter by category
  let filteredBookmarks = bookmarks;
  if (selectedCategory !== 'All') {
    if (selectedCategory === 'Uncategorized') {
      filteredBookmarks = filteredBookmarks.filter(b => !b.category);
    } else {
      filteredBookmarks = filteredBookmarks.filter(b => b.category?.toLowerCase().trim() === selectedCategory.toLowerCase().trim());
    }
  }

  // 2. Filter by Search Query
  if (searchQueryText.trim()) {
    const query = searchQueryText.toLowerCase().trim();
    filteredBookmarks = filteredBookmarks.filter(b => 
      b.title.toLowerCase().includes(query) || 
      b.url.toLowerCase().includes(query) ||
      (b.category && b.category.toLowerCase().includes(query))
    );
  }

  return (
    <div className="min-h-screen bg-[#FFF9F5] text-[#2D3436] flex flex-col font-sans" id="dashboard-root">
      
      {/* Upper Navigation Rail */}
      <header className="bg-white border-b-4 border-[#2D3436] py-4 px-6 shrink-0 relative z-10 shadow-[0_4px_0px_rgba(45,52,54,0.1)] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[#FFD93D] border-2 border-[#2D3436] flex items-center justify-center font-black shadow-[2px_2px_0px_#2D3436]">
            L
          </div>
          <h1 className="font-black text-xl text-[#2D3436] uppercase tracking-tight">Personal <span className="text-[#FF6B6B]">Bookmarks</span></h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="hidden sm:inline-block text-xs font-black text-[#2D3436] uppercase tracking-wide bg-[#FFD93D]/30 border-2 border-[#2D3436] px-3 py-1 rounded-xl">
            Signed in: @{user.handle}
          </span>
          <button
            id="btn-logout"
            onClick={onLogout}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#FF6B6B] hover:bg-[#ff5252] border-2 border-[#2D3436] text-white text-xs font-black uppercase tracking-wider transition-all shadow-[3px_3px_0px_#2D3436] hover:shadow-[1px_1px_0px_#2D3436] hover:translate-x-0.5 hover:translate-y-0.5"
          >
            <LogOut className="h-3.5 w-3.5" /> Sign Out
          </button>
        </div>
      </header>

      {/* Primary Container space */}
      <main className="max-w-6xl w-full mx-auto px-4 md:px-8 py-8 flex-grow flex flex-col md:flex-row gap-8">
        
        {/* Left Side: Bio profile and dynamic settings */}
        <section className="w-full md:w-80 shrink-0 space-y-6">
          
          {/* Public Claim profile view Card container */}
          <div className="bg-white rounded-3xl border-3 border-[#2D3436] p-6 shadow-[6px_6px_0px_#2D3436] text-left relative overflow-hidden">
            <div className="absolute top-0 right-0 p-3">
              <span className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-black px-2.5 py-0.5 rounded-lg border-2 border-[#2D3436] ${user.emailVerified ? 'bg-[#6BCB77] text-[#2D3436]' : 'bg-[#FFD93D] text-[#2D3436]'}`}>
                {user.emailVerified ? 'Active portal' : 'Pending Verification'}
              </span>
            </div>

            <div className="h-16 w-16 rounded-full bg-[#FFD93D] text-[#2D3436] flex items-center justify-center border-3 border-[#2D3436] shadow-[3px_3px_0px_#2D3436] relative font-black text-xl uppercase">
              {user.handle.substring(0, 2)}
            </div>

            <h2 className="text-xl font-black text-[#2D3436] mt-5 tracking-tight">@{user.handle}</h2>
            <p className="text-[11px] font-bold text-slate-500 font-mono mt-0.5">{user.email}</p>

            <div className="mt-6 space-y-3">
              <button
                id="btn-visit-own-profile"
                onClick={() => {
                  window.location.pathname = `/${user.handle}`;
                }}
                className="w-full bg-[#FFF] hover:bg-[#FFF9F5] text-[#2D3436] border-2 border-[#2D3436] rounded-xl py-2.5 px-3 text-xs font-black uppercase tracking-wide transition-colors flex items-center justify-center gap-1.5 shadow-[3px_3px_0px_#2D3436] hover:shadow-[1px_1px_0px_#2D3436] hover:translate-x-0.5 hover:translate-y-0.5"
              >
                <Link className="h-3.5 w-3.5" /> Visit Public Page
              </button>

              <button
                id="btn-copy-public-link"
                onClick={handleCopyLink}
                className="w-full bg-[#4D96FF] hover:bg-[#3485ff] text-white border-2 border-[#2D3436] rounded-xl py-2.5 px-3 text-xs font-black uppercase tracking-wide transition-colors flex items-center justify-center gap-1.5 shadow-[3px_3px_0px_#2D3436] hover:shadow-[1px_1px_0px_#2D3436] hover:translate-x-0.5 hover:translate-y-0.5"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-white" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Link Copied!' : 'Copy Sharing URL'}
              </button>
            </div>
          </div>

          {/* Verification Box Alert banner in unconfirmed state */}
          {!user.emailVerified && (
            <div id="verify-notification-alert" className="bg-[#FFF] rounded-3xl border-3 border-[#2D3436] p-5 text-left space-y-2.5 shadow-[6px_6px_0px_#2D3436]">
              <div className="flex items-center gap-2 bg-[#FFD93D] p-1.5 px-3 rounded-lg border-2 border-[#2D3436] w-fit">
                <Mail className="h-4 w-4 text-[#2D3436] animate-bounce" />
                <h3 className="text-xs font-black text-[#2D3436] uppercase tracking-wide">Confirm Email</h3>
              </div>
              <p className="text-xs text-slate-700 font-bold leading-relaxed">
                We've simulated a welcome / confirmation email for your address!
              </p>
              <p className="text-xs text-slate-500 font-bold leading-relaxed font-mono">
                Click the <span className="font-black text-[#FF6B6B]">Logs</span> pill below (lower right corner) and confirm your email to activate public view.
              </p>
              <button
                id="btn-refresh-user"
                onClick={async () => {
                  await onRefreshUserStatus();
                  onTriggerMailboxRefresh();
                }}
                className="w-full bg-[#FFD93D] hover:bg-[#ffd11a] border-2 border-[#2D3436] text-[#2D3436] rounded-xl font-black uppercase tracking-wider text-xs py-2 shadow-[2px_2px_0px_#2D3436] transition-all text-center mt-2 cursor-pointer"
              >
                Refresh Account Status
              </button>
            </div>
          )}

          {user.emailVerified && (
            <div className="bg-[#6BCB77]/20 rounded-3xl border-3 border-[#2D3436] p-5 text-left shadow-[6px_6px_0px_#2D3436] flex items-start gap-3">
              <ShieldCheck className="h-5 w-5 text-[#2D3436] shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-black text-[#2D3436] uppercase">Portal Link Active</h4>
                <p className="text-[11px] font-bold text-slate-700 mt-1.5 leading-relaxed">
                  Your public list is fully accessible to anyone at <span className="font-mono bg-[#FFF] border border-slate-300 px-1 py-0.5 rounded text-[#2D3436]">/{user.handle}</span>. Use this to share your links publically!
                </p>
              </div>
            </div>
          )}

        </section>

        {/* Right Side: Add forms and Bookmarks List */}
        <section className="flex-grow space-y-6">
          
          {/* Add New Link Card Form */}
          <div className="bg-white rounded-3xl border-3 border-[#2D3436] p-6 shadow-[8px_8px_0px_#2D3436] text-left">
            <h3 className="text-sm font-black text-[#2D3436] uppercase tracking-wider mb-4 flex items-center gap-2">
              <Sparkles className="h-4.5 w-4.5 text-[#FF6B6B]" /> Add New Bookmark
            </h3>

            <form onSubmit={handleCreateBookmark} className="space-y-4" id="add-bookmark-form">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Title */}
                <div className="space-y-1 text-left">
                  <label htmlFor="bookmark-title-input" className="text-xs font-black uppercase text-slate-500 tracking-wider pl-1 font-bold">
                    Title (Optional)
                  </label>
                  <input
                    id="bookmark-title-input"
                    type="text"
                    placeholder="e.g. Mid-Century Modern"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="block w-full px-3.5 py-3 bg-[#FFF] border-2 border-[#2D3436] rounded-xl text-sm font-bold focus:outline-none focus:bg-[#FFF9F5] placeholder-slate-400 text-[#2D3436] transition-all font-sans"
                  />
                </div>

                {/* URL */}
                <div className="space-y-1 text-left">
                  <label htmlFor="bookmark-url-input" className="text-xs font-black uppercase text-slate-500 tracking-wider pl-1 font-bold">
                    URL Address
                  </label>
                  <input
                    id="bookmark-url-input"
                    type="text"
                    required
                    placeholder="e.g. pinterest.com/board/mcm"
                    value={newUrl}
                    onChange={(e) => setNewUrl(e.target.value)}
                    className="block w-full px-3.5 py-3 bg-[#FFF] border-2 border-[#2D3436] rounded-xl text-sm font-bold focus:outline-none focus:bg-[#FFF9F5] placeholder-slate-400 text-[#2D3436] transition-all font-sans"
                  />
                </div>

                {/* Category */}
                <div className="space-y-1 text-left">
                  <label htmlFor="bookmark-category-input" className="text-xs font-black uppercase text-slate-500 tracking-wider pl-1 font-bold">
                    Category (Optional)
                  </label>
                  <input
                    id="bookmark-category-input"
                    type="text"
                    placeholder="e.g. Design, Work, Dev"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="block w-full px-3.5 py-3 bg-[#FFF] border-2 border-[#2D3436] rounded-xl text-sm font-bold focus:outline-none focus:bg-[#FFF9F5] placeholder-slate-400 text-[#2D3436] transition-all font-sans"
                  />
                  {existingCategories.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5 px-0.5 max-h-12 overflow-y-auto">
                      <span className="text-[9px] uppercase font-black text-slate-400 self-center mr-1">Fill:</span>
                      {existingCategories.slice(0, 5).map(cat => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setNewCategory(cat)}
                          className="text-[9px] px-1.5 py-0.5 font-bold uppercase rounded-md bg-[#FFD93D]/25 border border-[#2D3436]/20 text-[#2D3436] hover:bg-[#FFD93D] transition-all cursor-pointer"
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* public / private toggler bar and submit */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-t-2 border-[#2D3436]/10 pt-4 gap-4">
                <div className="flex items-center gap-2 bg-[#FFF9F5] p-2 px-3 border-2 border-[#2D3436] rounded-xl shadow-[2px_2px_0px_#2D3436]">
                  <input
                    id="bookmark-privacy-checkbox"
                    type="checkbox"
                    checked={newIsPublic}
                    onChange={(e) => setNewIsPublic(e.target.checked)}
                    className="h-4.5 w-4.5 rounded border-2 border-[#2D3436] text-[#4D96FF] focus:ring-0"
                  />
                  <label htmlFor="bookmark-privacy-checkbox" className="text-xs font-black text-[#2D3436] uppercase tracking-wide flex items-center gap-1.5 select-none pl-1 cursor-pointer">
                    {newIsPublic ? (
                      <>
                        <Globe className="h-4 w-4 text-[#6BCB77]" /> Public Profile (Active)
                      </>
                    ) : (
                      <>
                        <Lock className="h-4 w-4 text-[#FF6B6B]" /> Private (Only Me)
                      </>
                    )}
                  </label>
                </div>

                <button
                  id="btn-add-bookmark-submit"
                  type="submit"
                  disabled={submitting}
                  className="bg-[#4D96FF] hover:bg-[#3485ff] border-2 border-[#2D3436] text-white rounded-xl py-2.5 px-6 font-black uppercase tracking-wider text-xs transition-colors flex items-center justify-center gap-1.5 shadow-[3px_3px_0px_#2D3436] hover:shadow-[1px_1px_0px_#2D3436] hover:translate-x-0.5 hover:translate-y-0.5"
                >
                  <Plus className="h-4 w-4" /> Save Bookmark
                </button>
              </div>
            </form>
          </div>

          {/* Diagnostic API error banners */}
          {errorMess && (
            <div id="db-error-alert" className="p-4 rounded-xl bg-[#FF6B6B] border-2 border-[#2D3436] text-white text-xs text-left shadow-[4px_4px_0px_#2D3436]">
              <p className="font-black uppercase tracking-wider">Database Alert Notice</p>
              <p className="font-bold mt-1 text-[#FFF9F5]">{errorMess}</p>
            </div>
          )}

          {/* Bookmarks Directory list space */}
          <div className="space-y-4 text-left">
            <h3 className="text-xs font-black text-[#2D3436] uppercase tracking-widest px-1">
              Your Bookmarks Directory ({bookmarks.length})
            </h3>

            {loading ? (
              <div className="bg-white rounded-3xl border-3 border-[#2D3436] p-8 text-center space-y-3 shadow-[4px_4px_0px_#2D3436]">
                <div className="h-10 bg-[#FFF9F5] border border-[#2D3436]/10 rounded-xl animate-pulse" />
                <div className="h-10 bg-[#FFF9F5] border border-[#2D3436]/10 rounded-xl animate-pulse" />
              </div>
            ) : bookmarks.length === 0 ? (
              <div className="bg-white rounded-3xl border-3 border-[#2D3436] p-12 text-center shadow-[6px_6px_0px_#2D3436]">
                <FolderHeart className="h-12 w-12 text-[#FF6B6B] mx-auto mb-3 stroke-[2]" />
                <p className="text-sm font-black uppercase text-[#2D3436]">Collection Board is Empty</p>
                <p className="text-xs text-slate-500 font-bold mt-1.5 max-w-[250px] mx-auto">
                  Add links starting with standard formats above, and toggle whether to display them publicly!
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Search and Category Filter Section */}
                <div className="bg-white rounded-3xl border-3 border-[#2D3436] p-5 shadow-[4px_4px_0px_#2D3436] space-y-4">
                  {/* Real-time Search Input */}
                  <div className="space-y-1.5">
                    <label htmlFor="bookmarks-search-bar" className="text-xs font-black uppercase text-[#2D3436] tracking-wider pl-1">
                      Search Bookmarks
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#2D3436]">
                        <Search className="h-4 w-4 stroke-[2.5]" />
                      </div>
                      <input
                        id="bookmarks-search-bar"
                        type="text"
                        placeholder="Search by title, url or category..."
                        value={searchQueryText}
                        onChange={(e) => setSearchQueryText(e.target.value)}
                        className="block w-full pl-10 pr-3.5 py-3 bg-[#FFF] border-2 border-[#2D3436] rounded-xl text-sm font-bold focus:outline-none focus:bg-[#FFF9F5] placeholder-slate-400 text-[#2D3436] transition-all font-sans"
                      />
                    </div>
                  </div>

                  {/* Category Filters Pills */}
                  <div className="space-y-2">
                    <span className="text-xs font-black uppercase text-[#2D3436] tracking-wider pl-1 block">
                      Filter by Category
                    </span>
                    
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedCategory('All')}
                        className={`px-3 py-1.5 text-xs font-black uppercase tracking-wider rounded-xl border-2 border-[#2D3436] transition-all cursor-pointer shadow-[2px_2px_0px_#2D3436] ${
                          selectedCategory === 'All'
                            ? 'bg-[#FFD93D] text-[#2D3436]'
                            : 'bg-[#FFF] text-[#2D3436]/70 hover:bg-[#FFF9F5] hover:text-[#2D3436]'
                        }`}
                      >
                        All ({bookmarks.length})
                      </button>

                      {existingCategories.map(cat => {
                        const count = bookmarks.filter(b => b.category?.toLowerCase().trim() === cat.toLowerCase().trim()).length;
                        return (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => setSelectedCategory(cat)}
                            className={`px-3 py-1.5 text-xs font-black uppercase tracking-wider rounded-xl border-2 border-[#2D3436] transition-all cursor-pointer shadow-[2px_2px_0px_#2D3436] ${
                              selectedCategory.toLowerCase().trim() === cat.toLowerCase().trim()
                                ? 'bg-[#FFD93D] text-[#2D3436]'
                                : 'bg-[#FFF] text-[#2D3436]/70 hover:bg-[#FFF9F5] hover:text-[#2D3436]'
                            }`}
                          >
                            {cat} ({count})
                          </button>
                        );
                      })}

                      {bookmarks.some(b => !b.category) && (
                        <button
                          type="button"
                          onClick={() => setSelectedCategory('Uncategorized')}
                          className={`px-3 py-1.5 text-xs font-black uppercase tracking-wider rounded-xl border-2 border-[#2D3436] transition-all cursor-pointer shadow-[2px_2px_0px_#2D3436] ${
                            selectedCategory === 'Uncategorized'
                              ? 'bg-[#FF6B6B] text-white'
                              : 'bg-[#FFF] text-[#2D3436]/70 hover:bg-[#FFF9F5] hover:text-[#2D3436]'
                          }`}
                        >
                          Uncategorized ({bookmarks.filter(b => !b.category).length})
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {filteredBookmarks.length === 0 ? (
                  <div className="bg-white rounded-3xl border-3 border-[#2D3436] p-12 text-center shadow-[6px_6px_0px_#2D3436]">
                    <FolderHeart className="h-12 w-12 text-[#FF6B6B] mx-auto mb-3 stroke-[2]" />
                    <p className="text-sm font-black uppercase text-[#2D3436]">No matches found</p>
                    <p className="text-xs text-slate-500 font-bold mt-1.5 max-w-[250px] mx-auto">
                      Try adjusting your search query or selecting a different category filter.
                    </p>
                    <button
                      onClick={() => {
                        setSearchQueryText('');
                        setSelectedCategory('All');
                      }}
                      className="mt-4 px-4 py-2 bg-[#FFD93D] hover:bg-[#ffd11a] border-2 border-[#2D3436] rounded-xl font-black uppercase text-xs shadow-[2px_2px_0px_#2D3436] transition-all cursor-pointer"
                    >
                      Clear Filters
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Reordering manual guide text header */}
                    <div className="flex items-center justify-between px-1">
                      <span className="text-xs font-black uppercase text-slate-500 tracking-wider">
                        Bookmarks ({filteredBookmarks.length})
                      </span>
                      <span className="hidden md:inline-flex items-center gap-1 text-[11px] text-slate-400 font-bold lowercase">
                        <GripVertical className="h-3.5 w-3.5 shrink-0 stroke-[2.5]" /> drag handle to manually reorder
                      </span>
                    </div>

                    <div className="grid gap-4">
                      {filteredBookmarks.map((bookmark) => (
                        <div
                          key={bookmark.id}
                          id={`bookmark-item-${bookmark.id}`}
                          draggable={editingId !== bookmark.id}
                          onDragStart={(e) => handleDragStart(e, bookmark.id)}
                          onDragOver={(e) => handleDragOver(e, bookmark.id)}
                          onDragEnd={handleDragEnd}
                          onDrop={(e) => handleDrop(e, bookmark.id)}
                          className={`bg-white p-5 rounded-3xl border-3 border-[#2D3436] transition-all text-left pointer-events-auto ${
                            draggedBookmarkId === bookmark.id
                              ? 'opacity-40 scale-[0.98] border-dashed bg-slate-50'
                              : dragOverBookmarkId === bookmark.id
                              ? 'border-[#FFD93D] shadow-[6px_6px_0px_#2D3436] translate-y-[-2px]'
                              : 'shadow-[4px_4px_0px_#2D3436] hover:shadow-[6px_6px_0px_#2D3436]'
                          }`}
                        >
                          {editingId === bookmark.id ? (
                            /* Inline Bookmark Edit Mode */
                            <div className="space-y-3">
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <input
                                  id="edit-title-input"
                                  type="text"
                                  placeholder="Link Title"
                                  value={editTitle}
                                  onChange={(e) => setEditTitle(e.target.value)}
                                  className="bg-[#FFF] border-2 border-[#2D3436] rounded-xl px-3.5 py-2.5 text-xs font-bold transition-all text-[#2D3436]"
                                />
                                <input
                                  id="edit-url-input"
                                  type="text"
                                  placeholder="URL Address"
                                  value={editUrl}
                                  onChange={(e) => setEditUrl(e.target.value)}
                                  className="bg-[#FFF] border-2 border-[#2D3436] rounded-xl px-3.5 py-2.5 text-xs font-bold transition-all text-[#2D3436]"
                                />
                                <input
                                  id="edit-category-input"
                                  type="text"
                                  placeholder="Category (Optional)"
                                  value={editCategory}
                                  onChange={(e) => setEditCategory(e.target.value)}
                                  className="bg-[#FFF] border-2 border-[#2D3436] rounded-xl px-3.5 py-2.5 text-xs font-bold transition-all text-[#2D3436]"
                                />
                              </div>

                              <div className="flex items-center justify-between pt-2.5 border-t-2 border-[#2D3436]/10">
                                <div className="flex items-center gap-1.5">
                                  <input
                                    id="edit-privacy-check"
                                    type="checkbox"
                                    checked={editIsPublic}
                                    onChange={(e) => setEditIsPublic(e.target.checked)}
                                    className="h-4.5 w-4.5 rounded border-2 border-[#2D3436] text-[#4D96FF] focus:ring-0"
                                  />
                                  <label htmlFor="edit-privacy-check" className="text-xs font-black uppercase tracking-wider text-slate-600 select-none pl-1 cursor-pointer font-bold">
                                    Visible to Visitors (Public)
                                  </label>
                                </div>

                                <div className="flex gap-2">
                                  <button
                                    id={`btn-edit-cancel-${bookmark.id}`}
                                    onClick={() => setEditingId(null)}
                                    className="px-3 py-1.5 border-2 border-[#2D3436] hover:bg-slate-50 text-[#2D3436] rounded-lg text-xs font-black uppercase transition-colors pointer-events-auto"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    id={`btn-edit-save-${bookmark.id}`}
                                    onClick={() => handleUpdateBookmark(bookmark.id)}
                                    className="px-3.5 py-1.5 bg-[#FFD93D] hover:bg-[#ffd11a] border-2 border-[#2D3436] text-[#2D3436] rounded-lg text-xs font-black uppercase transition-colors shadow-[2px_2px_0px_#2D3436]"
                                  >
                                    Save Changes
                                  </button>
                                </div>
                              </div>
                            </div>
                          ) : (
                            /* Standard Bookmark View Mode */
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 font-sans text-left">
                              <div className="flex items-center gap-3.5 min-w-0 flex-1">
                                {/* Neo-brutalist drag handle */}
                                <div 
                                  className="shrink-0 h-8 w-8 bg-white border-2 border-[#2D3436]/20 rounded-lg flex items-center justify-center cursor-grab active:cursor-grabbing text-slate-400 hover:text-[#2D3436] hover:border-[#2D3436] hover:bg-[#FFF9F5] transition-colors shadow-[1px_1px_0px_#2D3436]/20 hover:shadow-[1px_1px_0px_#2D3436]"
                                  title="Drag handle to reorder override"
                                >
                                  <GripVertical className="h-4 w-4 stroke-[2.5]" />
                                </div>

                                {/* Neo-brutalist favicon container */}
                                <div className="shrink-0 h-10 w-10 bg-white border-2 border-[#2D3436] rounded-xl flex items-center justify-center overflow-hidden shadow-[2px_2px_0px_#2D3436]">
                                  <Favicon url={bookmark.url} title={bookmark.title} />
                                </div>

                                <div className="min-w-0 flex-1 space-y-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <h4 className="text-base font-black text-[#2D3436] truncate">
                                      {bookmark.title || bookmark.url}
                                    </h4>
                                    <span className={`inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-lg border-2 border-[#2D3436] ${bookmark.isPublic ? 'bg-[#6BCB77] text-[#2D3436]' : 'bg-[#FF6B6B] text-white'}`}>
                                      {bookmark.isPublic ? (
                                        <>
                                          <Globe className="h-2.5 w-2.5" /> Public
                                        </>
                                      ) : (
                                        <>
                                          <Lock className="h-2.5 w-2.5" /> Private
                                        </>
                                      )}
                                    </span>
                                    {bookmark.category && (
                                      <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-lg border-2 border-[#2D3436] bg-[#FFD93D] text-[#2D3436]">
                                        🏷️ {bookmark.category}
                                      </span>
                                    )}
                                  </div>
                                  
                                  <div className="flex items-center gap-1.5">
                                    <p className="text-xs text-slate-500 font-bold font-mono truncate">
                                      {bookmark.url}
                                    </p>
                                    <a
                                      id={`visit-bookmark-anchor-${bookmark.id}`}
                                      href={bookmark.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-[#4D96FF] hover:text-[#3485ff] transition-colors p-0.5 hover:scale-110"
                                      title="Visit link"
                                    >
                                      <ExternalLink className="h-3.5 w-3.5 shrink-0 stroke-[2.5]" />
                                    </a>
                                  </div>
                                </div>
                              </div>

                              {/* Actions block */}
                              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                                <a
                                  id={`btn-bookmark-visit-direct-${bookmark.id}`}
                                  href={bookmark.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-2 text-[#2D3436] bg-[#4D96FF]/15 hover:bg-[#4D96FF] hover:text-white border-2 border-[#2D3436] rounded-xl shadow-[2px_2px_0px_#2D3436] hover:shadow-[1px_1px_0px_#2D3436] transition-all hover:translate-x-0.5 hover:translate-y-0.5 flex items-center justify-center shrink-0 pointer-events-auto"
                                  title="Visit Link Directly"
                                >
                                  <ExternalLink className="h-3.5 w-3.5 stroke-[2.5]" />
                                </a>
                                <button
                                  id={`btn-bookmark-edit-trigger-${bookmark.id}`}
                                  onClick={() => startEdit(bookmark)}
                                  className="p-2 text-[#2D3436] bg-white hover:bg-[#FFD93D] border-2 border-[#2D3436] rounded-xl shadow-[2px_2px_0px_#2D3436] hover:shadow-[1px_1px_0px_#2D3436] transition-colors hover:translate-x-0.5 hover:translate-y-0.5"
                                  title="Edit Settings"
                                >
                                  <Edit2 className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  id={`btn-bookmark-delete-${bookmark.id}`}
                                  onClick={() => handleDeleteBookmark(bookmark.id)}
                                  className="p-2 text-white bg-[#FF6B6B] hover:bg-[#ff5252] border-2 border-[#2D3436] rounded-xl shadow-[2px_2px_0px_#2D3436] hover:shadow-[1px_1px_0px_#2D3436] transition-colors hover:translate-x-0.5 hover:translate-y-0.5"
                                  title="Remove Link"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

        </section>
      </main>
    </div>
  );
}
