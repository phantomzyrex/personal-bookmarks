import { useState, useEffect } from 'react';
import { Mail, ArrowRight, CheckCircle, RefreshCw, Layers, ShieldAlert, Sparkles } from 'lucide-react';
import { EmailNotification } from '../types';

interface VirtualMailboxProps {
  onVerifySuccess: (user: any) => void;
  triggerRefreshTrigger?: number;
}

export default function VirtualMailbox({ onVerifySuccess, triggerRefreshTrigger = 0 }: VirtualMailboxProps) {
  const [emails, setEmails] = useState<EmailNotification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<EmailNotification | null>(null);
  const [verifyingToken, setVerifyingToken] = useState<string | null>(null);
  const [verificationSuccessMessage, setVerificationSuccessMessage] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fetchEmails = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/emails');
      if (res.ok) {
        const data = await res.json();
        // Sort descending by time
        const sorted = (data.emails || []).sort(
          (a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        setEmails(sorted);
      }
    } catch (e) {
      console.error('Error fetching mock emails:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmails();
  }, [triggerRefreshTrigger]);

  const handleVerify = async (token: string) => {
    setVerifyingToken(token);
    try {
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });
      const data = await res.json();
      if (res.ok) {
        setVerificationSuccessMessage(data.message || 'Email confirmed successfully!');
        if (data.user) {
          onVerifySuccess(data.user);
        }
        await fetchEmails();
      } else {
        alert(data.error || 'Verification failed');
      }
    } catch (e) {
      alert('An error occurred during verification.');
    } finally {
      setVerifyingToken(null);
    }
  };

  const unreadCount = emails.filter((e) => e.status === 'sent').length;

  return (
    <div className="fixed bottom-4 right-4 z-50 font-sans" id="virtual-mailbox-root">
      {/* Floating Pill Trigger */}
      <button
        id="btn-inbox-trigger"
        onClick={() => {
          setIsOpen(!isOpen);
          fetchEmails();
          setVerificationSuccessMessage(null);
        }}
        className={`flex items-center gap-2 px-5 py-3.5 rounded-2xl border-3 border-[#2D3436] transition-all transform hover:scale-[1.02] active:scale-[0.98] cursor-pointer shadow-[4px_4px_0px_#2D3436] hover:shadow-[2px_2px_0px_#2D3436] ${
          isOpen
            ? 'bg-[#2D3436] text-white'
            : unreadCount > 0
            ? 'bg-[#FFD93D] text-[#2D3436] animate-pulse'
            : 'bg-white text-[#2D3436] hover:bg-[#FFF9F5]'
        }`}
      >
        <div className="relative">
          <Mail className="h-5 w-5 stroke-[2.5]" />
          {unreadCount > 0 && (
            <span className="absolute -top-3 -right-3 bg-[#FF6B6B] text-white text-[9px] font-black h-5 w-5 flex items-center justify-center rounded-full border-2 border-[#2D3436] shadow-[1px_1px_0px_#2D3436]">
              {unreadCount}
            </span>
          )}
        </div>
        <span className="text-xs font-black uppercase tracking-wider">
          {isOpen ? 'Close Outbox Gateway' : unreadCount > 0 ? '📬 New Welcome Email!' : 'Server Outbox Gateway'}
        </span>
      </button>

      {/* Slide-Up Panel */}
      {isOpen && (
        <div
          id="inbox-panel"
          className="absolute bottom-16 right-0 w-96 max-w-[calc(100vw-2rem)] bg-white rounded-3xl border-3 border-[#2D3436] p-4 transition-all duration-300 overflow-hidden flex flex-col max-h-[500px] shadow-[8px_8px_0px_#2D3436]"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b-2 border-[#2D3436]/10">
            <div>
              <h3 className="text-xs font-black text-[#2D3436] uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="h-4 w-4 text-[#FF6B6B]" /> Sandbox Outbox
              </h3>
              <p className="text-[10px] text-slate-500 font-bold font-mono">Simulated mail delivery logger</p>
            </div>
            <button
              id="btn-inbox-refresh"
              onClick={fetchEmails}
              disabled={loading}
              className="p-1.5 rounded-xl border-2 border-[#2D3436] hover:bg-[#FFD93D] text-[#2D3436] transition-colors"
            >
              <RefreshCw className={`h-3.5 w-3.5 stroke-[2.5] ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Verification Success Feedback */}
          {verificationSuccessMessage && (
            <div className="bg-[#6BCB77]/20 border-2 border-[#2D3436] rounded-xl p-3.5 my-2.5 text-[#2D3436] flex items-start gap-2 text-xs shadow-[2px_2px_0px_#2D3436]">
              <CheckCircle className="h-4.5 w-4.5 text-[#2D3436] shrink-0 mt-0.5" />
              <div>
                <p className="font-black uppercase tracking-wide text-[10px]">Activated!</p>
                <p className="font-semibold text-slate-700 mt-0.5">{verificationSuccessMessage}</p>
              </div>
            </div>
          )}

          {/* Empty State */}
          {emails.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center flex-grow">
              <Mail className="h-12 w-12 text-[#FF6B6B] mb-2.5 stroke-[2]" />
              <p className="text-xs font-black uppercase text-[#2D3436]">No simulated emails yet</p>
              <p className="text-[11px] text-slate-500 font-semibold mt-1.5 max-w-[200px] leading-relaxed">
                Create an account or register. The confirmation sequence letter will arrive instantly here!
              </p>
            </div>
          ) : (
            <div className="overflow-y-auto flex-grow my-2 divide-y divide-[#2D3436]/10">
              {emails.map((email) => (
                <div
                  key={email.id}
                  id={`email-item-${email.id}`}
                  className={`p-3 text-left transition-colors cursor-pointer ${
                    selectedEmail?.id === email.id
                      ? 'bg-[#FFD93D]/10'
                      : 'hover:bg-[#FFF9F5]'
                  }`}
                  onClick={() => {
                    setSelectedEmail(selectedEmail?.id === email.id ? null : email);
                    setVerificationSuccessMessage(null);
                  }}
                >
                  <div className="flex items-start justify-between gap-1">
                    <span className="text-[10px] font-black uppercase text-[#2D3436] bg-[#FFD93D]/30 border border-[#2D3436]/20 px-1.5 py-0.5 rounded">
                      To: {email.toEmail}
                    </span>
                    <span className="text-[9px] text-slate-400 font-bold font-mono">
                      {new Date(email.createdAt).toLocaleTimeString()}
                    </span>
                  </div>

                  <h4 className="text-xs font-black text-[#2D3436] mt-2 line-clamp-1">
                    {email.subject}
                  </h4>

                  {/* Collapsible details */}
                  {selectedEmail?.id === email.id ? (
                    <div className="mt-2.5 text-xs text-[#2D3436] bg-[#FFF9F5] p-3 rounded-2xl border-2 border-[#2D3436] shadow-[2px_2px_0px_#2D3436]">
                      <pre className="font-sans whitespace-pre-wrap leading-relaxed text-slate-700 text-[11px] font-semibold">
                        {email.body}
                      </pre>

                      {email.status === 'sent' ? (
                        <button
                          id={`btn-email-verify-${email.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleVerify(email.token);
                          }}
                          disabled={verifyingToken !== null}
                          className="w-full mt-3 bg-[#4D96FF] hover:bg-[#3485ff] text-white border-2 border-[#2D3436] py-2 px-3 rounded-xl font-black uppercase text-[10px] tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-[2px_2px_0px_#2D3436] hover:shadow-[1px_1px_0px_#2D3436] hover:translate-x-0.5 hover:translate-y-0.5"
                        >
                          {verifyingToken === email.token ? (
                            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <CheckCircle className="h-3.5 w-3.5 stroke-[2.5]" />
                          )}
                          Activate Account Now
                        </button>
                      ) : (
                        <div className="mt-3 flex items-center gap-1 text-[#6BCB77] text-[10px] font-black uppercase tracking-wider pl-1">
                          <CheckCircle className="h-3.5 w-3.5 stroke-[2.5]" /> Already Activated / Verified
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-[10px] text-slate-500 font-bold mt-1.5 pl-0.5">
                      <span className="truncate">Token: {email.token}</span>
                      <span className="text-slate-300">•</span>
                      <span className={email.status === 'verified' ? 'text-[#6BCB77]' : 'text-[#FF6B6B]'}>
                        {email.status === 'verified' ? 'VERIFIED' : 'PENDING'}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Footer informational banner */}
          <div className="text-[9px] font-black uppercase tracking-wider text-slate-400 border-t-2 border-[#2D3436]/10 pt-2 flex items-center justify-center gap-1">
            <Layers className="h-3 w-3 text-slate-400" />
            Active Session sandbox storage
          </div>
        </div>
      )}
    </div>
  );
}
