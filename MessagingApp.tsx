import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from './context/AuthContext';
import {
  findUserByContactToken,
  getOrCreateChat,
  sendMessage as dbSendMessage,
  listChats,
  fetchMessages,
  setTyping as dbSetTyping,
  getTyping,
  heartbeat,
  getMyProfile,
  formatLastActive,
  listSocialNudges,
  type ChatSummary,
  type SocialNudge,
} from './lib/turso';
import {
  encodeImageMessage,
  isImageMessage,
  decodeImageMessage,
} from './lib/jscord-upload';
import { uploadImageHybrid } from './lib/image-upload';
import { isNudgeMessage } from './components/NudgeComposer';
import { UniversalStoryCard, StoryCanvasComposer } from './components/StoryCanvasComposer';
import { ImmersiveNudgeViewer } from './components/PremiumNudgesSystem';
import { GlimmerOrb } from './components/Glimmer';


/* ============================ ICONS ============================ */
const I = {
  Search: ({ s = 16 }: { s?: number }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <circle cx="11" cy="11" r="7.5"/><path d="m20.5 20.5-4-4"/>
    </svg>
  ),
  Plus: ({ s = 18 }: { s?: number }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round">
      <path d="M12 5v14M5 12h14"/>
    </svg>
  ),
  ChevronLeft: ({ s = 24 }: { s?: number }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="m15 18-6-6 6-6"/>
    </svg>
  ),
  Video: ({ s = 20 }: { s?: number }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m22 8-6 4 6 4V8Z"/><rect width="14" height="12" x="2" y="6" rx="2" ry="2"/>
    </svg>
  ),
  More: ({ s = 20 }: { s?: number }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/>
    </svg>
  ),
  Lock: ({ s = 12 }: { s?: number }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  ),
  Smile: ({ s = 20 }: { s?: number }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" x2="9.01" y1="9" y2="9"/><line x1="15" x2="15.01" y1="9" y2="9"/>
    </svg>
  ),
  Camera: ({ s = 20 }: { s?: number }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>
    </svg>
  ),
  Mic: ({ s = 20 }: { s?: number }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/>
    </svg>
  ),
  DoubleCheck: ({ s = 14 }: { s?: number }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 7 17l-5-5"/><path d="m22 10-7.5 7.5L13 16"/>
    </svg>
  ),
  X: ({ s = 14 }: { s?: number }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M18 6 6 18M6 6l12 12"/>
    </svg>
  ),
  Send: ({ s = 18 }: { s?: number }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor">
      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
    </svg>
  ),
  Star: ({ s = 12, filled }: { s?: number; filled?: boolean }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={filled ? "0" : "2"}>
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  ),
  Chat: ({ s = 20 }: { s?: number }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
      <circle cx="8.5" cy="11.5" r="0.9" fill="currentColor" stroke="none"/>
      <circle cx="12" cy="11.5" r="0.9" fill="currentColor" stroke="none"/>
      <circle cx="15.5" cy="11.5" r="0.9" fill="currentColor" stroke="none"/>
    </svg>
  ),
  Phone: ({ s = 20 }: { s?: number }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
    </svg>
  ),
  People: ({ s = 20 }: { s?: number }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  Gear: ({ s = 20 }: { s?: number }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.72v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  ),
  Sparkle: ({ s = 12 }: { s?: number }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 1.5l1.8 5.7 5.7 1.8-5.7 1.8L12 16.5l-1.8-5.7L4.5 9l5.7-1.8zM19.5 14l.9 2.85 2.85.9-2.85.9-.9 2.85-.9-2.85-2.85-.9 2.85-.9z"/>
    </svg>
  ),
  Check: ({ s = 14 }: { s?: number }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5"/>
    </svg>
  ),
};

/* ============================ TYPES ============================ */
type Chat = {
  id: string;
  uid: string;
  img: string;
  name: string;
  msg: string;
  time: string;
  unread?: number;
  online?: boolean;
  lastActive?: number;
};

type Message = {
  id: string;
  text: string;
  time: string;
  sender: 'me' | 'them';
  status?: 'sent' | 'delivered' | 'read';
  /** Optimistic flag while an attached image is uploading to jscord-storage. */
  uploading?: boolean;
  /** Local object URL used while an attachment is uploading (for instant preview). */
  localPreview?: string;
};

/* ============================ UTILS ============================ */
const formatTime = (ms: number): string => {
  if (!ms) return '';
  const d = new Date(ms);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    let h = d.getHours();
    const m = d.getMinutes().toString().padStart(2, '0');
    const ap = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${m} ${ap}`;
  }
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days[d.getDay()];
  }
  return `${d.getMonth() + 1}/${d.getDate()}`;
};

const fallbackAvatar = (name: string) =>
  `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(name || 'U')}&backgroundColor=f1ede7,ebe4d7&fontWeight=600`;

const summaryToChat = (s: ChatSummary): Chat => ({
  id: s.id,
  uid: s.otherUid,
  name: s.otherName,
  img: s.otherAvatar || fallbackAvatar(s.otherName),
  msg: isNudgeMessage(s.lastMessage)
    ? '✨ Nudge'
    : isImageMessage(s.lastMessage)
    ? '📷 Photo'
    : (s.lastMessage || 'No messages yet'),
  time: formatTime(s.updatedAt),
  unread: s.unread,
  online: s.online,
  lastActive: s.lastActive,
});

/* ============================ ATOMS ============================ */
export const GoldAvatar = ({ img, size, online, dim, flow }: { img: string; size: number; online?: boolean; dim?: boolean; flow?: boolean }) => (
  <div className="relative flex-shrink-0">
    <div
      className={!dim && flow ? 'gold-ring-flow' : undefined}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        padding: 2,
        background: dim
          ? 'linear-gradient(160deg, #3A332A, #221E18)'
          : flow
            ? undefined
            : 'conic-gradient(from 210deg, #8F6420 0%, #D9AE5F 12%, #FFF0CC 25%, #E2B566 38%, #9C7126 52%, #C8963F 68%, #F3D392 80%, #B07F2C 92%, #8F6420 100%)',
        boxShadow: dim
          ? 'none'
          : flow
            ? undefined
            : '0 0 8px rgba(216,173,90,0.15), 0 2px 6px rgba(0,0,0,0.5)',
      }}
    >
      <div style={{ width: '100%', height: '100%', borderRadius: '50%', padding: 1.5, background: '#0C0A07' }}>
        <img src={img} alt="" className="w-full h-full object-cover rounded-full" draggable={false} />
      </div>
    </div>
    {online && (
      <span
        className="online-dot absolute rounded-full"
        style={{ width: size * 0.24, height: size * 0.24, bottom: size * 0.02, right: size * 0.02, border: '2px solid #0B0907' }}
      />
    )}
  </div>
);

const GoldBadge = ({ n, small }: { n: number; small?: boolean }) => (
  <span
    className="gold-solid inline-flex items-center justify-center rounded-full font-extrabold text-black flex-shrink-0"
    style={{
      minWidth: small ? 17 : 22, height: small ? 17 : 22,
      fontSize: small ? 10 : 11, padding: '0 5px',
      textShadow: '0 1px 0 rgba(255,243,214,0.55)',
    }}
  >
    {n}
  </span>
);

/* ============================ SECTIONS ============================ */
const SearchRow = () => (
  <div className="px-4 pb-2.5 flex-shrink-0">
    <div className="luxe-surface flex items-center gap-3 rounded-2xl px-4 h-[42px]">
      <span className="text-[#8A7D67]"><I.Search s={17} /></span>
      <input
        type="text"
        placeholder="Search Nudges or people"
        className="flex-1 bg-transparent text-[13px] font-medium text-[#F3EADB] placeholder-[#6E6353] outline-none min-w-0"
      />
    </div>
  </div>
);

const Stories = ({
  contacts,
  nudgeUserIds,
  myNudgeCount,
  myAvatar,
  myUid,
  onNewNudge,
  onViewNudges,
}: {
  contacts: Chat[];
  nudgeUserIds: Set<string>;
  myNudgeCount: number;
  myAvatar: string;
  myUid: string;
  onNewNudge: () => void;
  onViewNudges: (uid: string) => void;
}) => {
  // Contacts who have published an active Nudge are shown first (golden stroke),
  // so tapping them opens the immersive Nudge viewer.
  const withNudge = contacts.filter((c) => nudgeUserIds.has(c.uid));
  const withoutNudge = contacts.filter((c) => !nudgeUserIds.has(c.uid));
  const ordered = [...withNudge, ...withoutNudge].slice(0, 6);

  return (
    <div className="flex-shrink-0">
      <div className="scroll-x flex gap-4 px-4 pb-1.5 items-start">
        <button onClick={onNewNudge} className="tappable-soft flex flex-col items-center gap-1.5 flex-shrink-0 w-[64px]">
          <div className="relative">
            <div className="gold-stroke-flow rounded-[19px] p-[1.5px] shadow-[0_0_12px_rgba(216,173,90,0.18),0_4px_10px_rgba(0,0,0,0.5)]">
              <div
                className="w-[58px] h-[58px] rounded-[18px] flex items-center justify-center"
                style={{
                  background: 'linear-gradient(165deg, #221D15 0%, #161209 100%)',
                  boxShadow: '0 1px 0 rgba(255,235,190,0.08) inset',
                }}
              >
                <span className="text-[#EFC878]"><I.Chat s={24} /></span>
              </div>
            </div>
            <span className="absolute -top-1 -right-1 text-[#FFE9B8]" style={{ filter: 'drop-shadow(0 0 4px rgba(255,233,184,0.7))' }}>
              <I.Sparkle s={14} />
            </span>
          </div>
          <span className="text-[10.5px] font-semibold leading-tight truncate w-full text-center text-[#EFC878]">New Nudge</span>
        </button>

        {/* Your own published Nudge — golden stroke, tap to view */}
        {myNudgeCount > 0 && (
          <button
            onClick={() => onViewNudges(myUid)}
            className="tappable-soft flex flex-col items-center gap-1.5 flex-shrink-0 w-[64px]"
          >
            <GoldAvatar img={myAvatar} size={58} flow />
            <span className="text-[10.5px] font-semibold leading-tight truncate w-full text-center text-[#EFC878]">
              Your Nudge
            </span>
          </button>
        )}

        {ordered.map((c, i) => {
          const hasNudge = nudgeUserIds.has(c.uid);
          return (
            <button
              key={c.id + i}
              onClick={hasNudge ? () => onViewNudges(c.uid) : undefined}
              className="tappable-soft flex flex-col items-center gap-1.5 flex-shrink-0 w-[64px]"
            >
              <GoldAvatar img={c.img} size={58} online={c.online} flow={hasNudge || !!c.online} dim={!hasNudge && !c.online} />
              <span
                className={`text-[10.5px] font-semibold leading-tight truncate w-full text-center ${hasNudge ? 'text-[#EFC878]' : 'text-[#9B8F7C]'}`}
              >
                {c.name.split(' ')[0]}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

const ChatRow = ({ c, delay }: { c: Chat; delay: number }) => (
  <button
    className="chat-row rise-in w-full flex items-center gap-3 px-3 py-[10px] rounded-[18px] text-left"
    style={{ animationDelay: `${delay}ms` }}
  >
    <GoldAvatar img={c.img} size={48} online={c.online} dim={!c.unread} />
    <div className="flex-1 min-w-0">
      <div className="flex items-center justify-between gap-2 mb-[2px]">
        <span className="flex items-center gap-1.5 min-w-0">
          <span className="text-[13.5px] font-bold text-[#F3EADB] truncate tracking-[-0.01em]">{c.name}</span>
        </span>
        <span className={`text-[10.5px] font-semibold flex-shrink-0 ${c.unread ? 'text-[#C9A969]' : 'text-[#6E6353]'}`}>
          {c.time}
        </span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className={`text-[12px] truncate ${c.unread ? 'text-[#C9BCA6] font-semibold' : 'text-[#80755F] font-medium'}`}>
          {c.msg || 'No messages yet'}
        </span>
        <span className="flex items-center gap-1.5 flex-shrink-0">
          {c.unread ? <GoldBadge n={c.unread} /> : null}
        </span>
      </div>
    </div>
  </button>
);

/* ============================ CHAT INTERFACE (REAL TURSO) ============================ */
const ChatInterface = ({ chat, onBack }: { chat: Chat; onBack: () => void }) => {
  const { user } = useAuth();
  const [msg, setMsg] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [typing, setTypingState] = useState(false);
  const [showNudgeComposer, setShowNudgeComposer] = useState(false);
  const presence = chat.online ? 'Online' : formatLastActive(chat.lastActive || 0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastCountRef = useRef(0);
  const lastTypingSentRef = useRef(0);

  // Poll messages + typing — fast enough to feel real-time
  useEffect(() => {
    if (!user) return;
    let stopped = false;

    const poll = async () => {
      try {
        const [msgs, otherTyping] = await Promise.all([
          fetchMessages(chat.id, user.uid, true),
          getTyping(chat.id, chat.uid),
        ]);
        if (stopped) return;
        const fresh: Message[] = msgs.map((m) => ({
          id: m.id,
          text: m.text,
          time: formatTime(m.createdAt),
          sender: m.from === user.uid ? 'me' : 'them',
          status: m.status,
        }));
        // Preserve any optimistic image messages that are still uploading and
        // have not yet been persisted (so the preview doesn't flicker away).
        setMessages((prev) => {
          const stillUploading = prev.filter((p) => p.uploading);
          return stillUploading.length ? [...fresh, ...stillUploading] : fresh;
        });
        setTypingState(otherTyping);
      } catch (e) {
        console.warn('Poll failed:', e);
      }
    };

    poll();
    const interval = setInterval(poll, 2000);
    return () => { stopped = true; clearInterval(interval); };
  }, [user, chat.id, chat.uid]);

  // Auto-scroll when new messages arrive
  useEffect(() => {
    if (messages.length !== lastCountRef.current) {
      lastCountRef.current = messages.length;
      const el = scrollRef.current;
      if (el) {
        requestAnimationFrame(() => {
          el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
        });
      }
    }
  }, [messages, typing]);

  const sendMessage = useCallback(async () => {
    const text = msg.trim();
    if (!text || !user) return;
    setMsg('');
    // Optimistic UI — show instantly
    const optimistic: Message = {
      id: 'tmp-' + Date.now(),
      text,
      time: formatTime(Date.now()),
      sender: 'me',
      status: 'sent',
    };
    setMessages((prev) => [...prev, optimistic]);
    try {
      await dbSendMessage(chat.id, user.uid, text);
    } catch (e) {
      console.warn('Send failed:', e);
    }
  }, [msg, user, chat.id]);

  /* ============================ IMAGE SENDING ============================
   * Image bytes go to jscord-storage (Discord-backed CDN). Only the resulting
   * URL is sent through the normal Turso messaging pipeline using the
   * existing `[img]<url>` text marker — no schema change, no Turso blobs. */
  const fileInputRef = useRef<HTMLInputElement>(null);

  const openImagePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleImageSelected = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset so picking the same file twice re-fires `onChange`.
    e.target.value = '';
    if (!file || !user) return;
    if (!file.type.startsWith('image/')) return;

    const tmpId = 'tmp-img-' + Date.now();
    const localPreview = URL.createObjectURL(file);

    // Optimistic bubble — instantly renders the local image with an
    // "uploading" overlay so the user sees feedback right away.
    const optimistic: Message = {
      id: tmpId,
      text: encodeImageMessage(localPreview),
      time: formatTime(Date.now()),
      sender: 'me',
      status: 'sent',
      uploading: true,
      localPreview,
    };
    setMessages((prev) => [...prev, optimistic]);

    try {
      const result = await uploadImageHybrid(file);
      console.log('[ImageUpload] Result:', result);
      if (!result.success || !result.url) {
        // Mark as failed by dropping the optimistic bubble.
        setMessages((prev) => prev.filter((m) => m.id !== tmpId));
        URL.revokeObjectURL(localPreview);
        console.warn('Image upload failed:', result.raw);
        return;
      }

      // Swap the local preview for the real CDN URL while we wait for the DB
      // to persist; the next poll cycle will replace this with the canonical
      // server-side row. We embed the provider so the chat shows which backend
      // (Discord / UploadMe / Picser) actually served the image.
      const encoded = encodeImageMessage(result.url, result.provider || undefined);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === tmpId
            ? { ...m, text: encoded, uploading: false }
            : m,
        ),
      );

      await dbSendMessage(chat.id, user.uid, encoded);
      // Keep object URL alive a tick so the <img> swap is seamless.
      setTimeout(() => URL.revokeObjectURL(localPreview), 1500);
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== tmpId));
      URL.revokeObjectURL(localPreview);
      console.warn('Image send failed:', err);
    }
  }, [user, chat.id]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMsg(e.target.value);
    // Broadcast typing at most every 2s
    if (user && Date.now() - lastTypingSentRef.current > 2000) {
      lastTypingSentRef.current = Date.now();
      dbSetTyping(chat.id, user.uid).catch(() => {});
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const hasText = msg.trim().length > 0;

  return (
    <div className="absolute inset-0 z-[60] flex flex-col bg-[#050403] rise-in overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-3 py-3 flex-shrink-0" style={{ background: 'rgba(11, 9, 7, 0.95)', backdropFilter: 'blur(10px)', borderBottom: '1px solid rgba(216,173,90,0.1)' }}>
        <div className="flex items-center gap-1.5 min-w-0">
          <button onClick={onBack} className="tappable-soft p-1 text-[#D4A853] flex-shrink-0">
            <I.ChevronLeft s={26} />
          </button>
          <div className="flex items-center gap-2.5 min-w-0">
            <GoldAvatar img={chat.img} size={40} online={chat.online} />
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-[14.5px] font-bold text-[#F3EADB] truncate">{chat.name}</span>
              </div>
              <span className={`text-[11px] font-medium ${typing ? 'text-[#EFC878]' : presence === 'Online' ? 'text-[#34B45E]' : 'text-[#6E6353]'}`}>
                {typing ? 'typing...' : presence}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 text-[#D4A853] flex-shrink-0">
          <button className="tappable-soft w-9 h-9 flex items-center justify-center"><I.Phone s={20} /></button>
          <button className="tappable-soft w-9 h-9 flex items-center justify-center"><I.Video s={21} /></button>
          <button className="tappable-soft w-9 h-9 flex items-center justify-center"><I.More s={20} /></button>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 scroll-area px-4 py-4 min-h-0">
        <div className="flex flex-col items-center gap-2 mb-6">
          <div className="flex items-center gap-1.5 text-[#D4A853]">
            <I.Lock s={12} />
            <span className="text-[11px] font-bold uppercase tracking-wider">End-to-end encrypted</span>
          </div>
          <p className="text-[11px] text-[#6E6353] text-center max-w-[240px] leading-relaxed">
            Messages are secured with end-to-end encryption. <span className="text-[#D4A853]">Learn more</span>
          </p>
        </div>

        <div className="flex justify-center mb-6">
          <span className="px-4 py-1 rounded-full bg-[#1A1814] text-[11px] font-bold text-[#6E6353]">Today</span>
        </div>

        <div className="space-y-5">
          {messages.map((m) => {
            const isImg = isImageMessage(m.text);
            const imgUrl = isImg ? decodeImageMessage(m.text) : '';
            const hasStory = isNudgeMessage(m.text) || m.text.startsWith('[story_v1]');

            return (
            <div key={m.id} className={`flex flex-col msg-in ${m.sender === 'me' ? 'items-end' : 'items-start'}`}>
              <div className="relative" style={hasStory ? { maxWidth: '92%', width: '100%' } : { maxWidth: '85%' }}>
                {hasStory ? (
                  <UniversalStoryCard nudgeText={m.text} compact />
                ) : isImg ? (
                  <div
                    className={`relative overflow-hidden rounded-[22px] ${
                      m.sender === 'me'
                        ? 'gold-solid rounded-tr-md'
                        : 'bg-[#1A1814] rounded-tl-md'
                    }`}
                    style={{
                      padding: 3,
                      ...(m.sender === 'me'
                        ? { textShadow: 'none' }
                        : { border: '1px solid rgba(255,255,255,0.05)' }),
                    }}
                  >
                    {imgUrl ? (
                      <img
                        src={imgUrl}
                        alt=""
                        draggable={false}
                        onClick={() => window.open(imgUrl, '_blank', 'noopener')}
                        onError={(e) => {
                          // Graceful fallback if URL is broken or still uploading
                          const target = e.currentTarget;
                          target.style.display = 'none';
                          const parent = target.parentElement;
                          if (parent) {
                            const fallback = document.createElement('div');
                            fallback.className = 'flex flex-col items-center justify-center gap-2 py-6';
                            fallback.style.cssText = 'min-width:160px;min-height:120px;background:rgba(15,13,10,0.6);border-radius:16px;border:1px solid rgba(216,173,90,0.1);';
                            fallback.innerHTML = '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(214,178,110,0.4)" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg><span style="font-size:11px;color:rgba(214,178,110,0.5);font-weight:600;">Upload failed</span>';
                            parent.insertBefore(fallback, target);
                          }
                        }}
                        className="block rounded-[19px] cursor-zoom-in select-none"
                        style={{
                          maxWidth: 300,
                          maxHeight: 400,
                          width: 'auto',
                          height: 'auto',
                          objectFit: 'cover',
                          background: '#0F0D0A',
                        }}
                      />
                    ) : (
                      <div className="flex items-center justify-center py-4" style={{ minWidth: 160, minHeight: 100 }}>
                        <span className="text-[11px] text-[#6E6353] font-semibold">Invalid image</span>
                      </div>
                    )}
                    {m.uploading && (
                      <div
                        className="absolute inset-[3px] rounded-[19px] flex items-center justify-center"
                        style={{ background: 'rgba(5,4,3,0.55)', backdropFilter: 'blur(2px)' }}
                      >
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full" style={{ background: 'rgba(26,24,20,0.85)', border: '1px solid rgba(216,173,90,0.25)' }}>
                          <span className="typing-dot" />
                          <span className="typing-dot" style={{ animationDelay: '0.18s' }} />
                          <span className="typing-dot" style={{ animationDelay: '0.36s' }} />
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div
                    className={`px-4 py-2.5 rounded-[22px] text-[14px] leading-relaxed whitespace-pre-wrap break-words ${
                      m.sender === 'me'
                        ? 'gold-solid text-black rounded-tr-md font-medium'
                        : 'bg-[#1A1814] text-[#F3EADB] rounded-tl-md font-medium'
                    }`}
                    style={m.sender === 'me' ? { textShadow: 'none' } : { border: '1px solid rgba(255,255,255,0.05)' }}
                  >
                    {m.text}
                  </div>
                )}

                <div className={`flex items-center gap-1.5 mt-1.5 ${m.sender === 'me' ? 'justify-end' : 'justify-start'}`}>
                  <span className="text-[10px] font-bold text-[#6E6353]">{m.time}</span>
                  {m.sender === 'me' && (
                    <span className={m.status === 'read' ? 'text-[#34B45E]' : 'text-[#6E6353]'} style={{ transition: 'color 0.4s ease' }}>
                      <I.DoubleCheck s={14} />
                    </span>
                  )}
                </div>
              </div>
            </div>
            );
          })}

          {typing && (
            <div className="flex items-start msg-in">
              <div className="bg-[#1A1814] rounded-[22px] rounded-tl-md px-4 py-3.5 flex items-center gap-1.5" style={{ border: '1px solid rgba(255,255,255,0.05)' }}>
                <span className="typing-dot" />
                <span className="typing-dot" style={{ animationDelay: '0.18s' }} />
                <span className="typing-dot" style={{ animationDelay: '0.36s' }} />
              </div>
            </div>
          )}

          {messages.length === 0 && !typing && (
            <div className="flex flex-col items-center gap-2 py-8 text-[#6E6353]">
              <span className="text-[12px] font-semibold">Say hi to {chat.name.split(' ')[0]} 👋</span>
            </div>
          )}
        </div>
      </div>

      <div className="px-3 pb-6 pt-2 flex-shrink-0" style={{ background: 'rgba(5,4,3,0.97)' }}>
        <div className="flex items-center gap-2.5">
          <button onClick={() => setShowNudgeComposer(true)} className="tappable-soft w-[42px] h-[42px] rounded-full flex items-center justify-center text-[#D4A853] flex-shrink-0" style={{ border: '1.5px solid rgba(216,173,90,0.35)' }}>
            <I.Plus s={20} />
          </button>
          <div className="flex-1 luxe-surface h-[44px] rounded-full pl-4 pr-2 flex items-center gap-2 min-w-0">
            <input
              type="text"
              value={msg}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              className="flex-1 bg-transparent text-[14px] font-medium text-[#F3EADB] placeholder-[#6E6353] outline-none min-w-0"
            />
            <button className="tappable-soft w-8 h-8 flex items-center justify-center text-[#6E6353] hover:text-[#D4A853] transition-colors flex-shrink-0"><I.Smile s={19} /></button>
            <button
              type="button"
              onClick={openImagePicker}
              aria-label="Send image"
              className="tappable-soft w-8 h-8 flex items-center justify-center text-[#6E6353] hover:text-[#D4A853] transition-colors flex-shrink-0"
            >
              <I.Camera s={19} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={handleImageSelected}
            />
          </div>
          <button
            onClick={sendMessage}
            className="gold-solid tappable w-[44px] h-[44px] rounded-full flex items-center justify-center text-black flex-shrink-0"
            aria-label={hasText ? 'Send message' : 'Voice message'}
          >
            <span className={`send-swap ${hasText ? 'send-mode' : ''}`}>
              {hasText ? <I.Send s={18} /> : <I.Mic s={20} />}
            </span>
          </button>
        </div>
        <div className="flex justify-center pt-3">
          <span className="w-[110px] h-[4px] rounded-full" style={{ background: 'rgba(243,234,219,0.28)' }} />
        </div>
      </div>

      {/* ── NUDGE COMPOSER OVERLAY ── */}
      <AnimatePresence>
        {showNudgeComposer && (
          <StoryCanvasComposer
            onClose={() => setShowNudgeComposer(false)}
            onSuccess={() => setShowNudgeComposer(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

/* ============================ BOTTOM NAV — LIQUID GLASS ============================ */

const NAV_ITEMS = [
  {
    id: 'chats',
    label: 'Chats',
    icon: ({ active }: { active: boolean }) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    ),
  },
  {
    id: 'calls',
    label: 'Calls',
    icon: ({ active }: { active: boolean }) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.61 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.57a16 16 0 0 0 6.29 6.29l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
      </svg>
    ),
  },
  {
    id: 'plus',
    label: 'New',
    isAction: true,
    icon: ({ active }: { active: boolean }) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.4 : 2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 5v14M5 12h14"/>
      </svg>
    ),
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: ({ active }: { active: boolean }) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
      </svg>
    ),
  },
];

const BottomNav = ({
  active,
  onChange,
  onPlus,
}: {
  active: string;
  onChange: (id: string) => void;
  onPlus: () => void;
}) => {
  const pillRef = useRef<HTMLSpanElement>(null);
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const barRef = useRef<HTMLDivElement>(null);
  const glareRef = useRef<HTMLDivElement>(null);

  // Slide the active pill to the correct position whenever `active` changes.
  useEffect(() => {
    const idx = NAV_ITEMS.findIndex(n => n.id === active);
    const btn = btnRefs.current[idx];
    const pill = pillRef.current;
    if (!btn || !pill) return;
    const bRect = btn.getBoundingClientRect();
    const pRect = btn.closest('[data-nav-bar]')?.getBoundingClientRect();
    if (!pRect) return;
    const left = bRect.left - pRect.left + 6;
    const width = bRect.width - 12;
    pill.style.left = `${left}px`;
    pill.style.width = `${width}px`;
  }, [active]);

  // Mouse glare: update CSS vars for the radial spotlight.
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const bar = barRef.current;
    const glare = glareRef.current;
    if (!bar || !glare) return;
    const rect = bar.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    glare.style.background = `radial-gradient(circle at ${x}% ${y}%, rgba(255,248,224,0.13) 0%, transparent 62%)`;
  };

  const handleMouseLeave = () => {
    if (glareRef.current) glareRef.current.style.background = 'transparent';
  };

  return (
    <div className="flex-shrink-0 relative z-30 px-3 pb-1.5 pt-1.5">
      {/* LIQUID GLASS PILL BAR */}
      <div
        ref={barRef}
        data-nav-bar=""
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="relative flex items-center rounded-[28px] h-[62px] overflow-hidden"
        style={{
          /* Deep glass material */
          background: 'rgba(18,14,10,0.42)',
          backdropFilter: 'blur(52px) saturate(210%) brightness(1.08)',
          WebkitBackdropFilter: 'blur(52px) saturate(210%) brightness(1.08)',
          /* Layered caustic shadows + rim light */
          border: '1px solid rgba(255,243,210,0.16)',
          boxShadow: [
            /* Inner top specular */
            'inset 0 1px 0 rgba(255,248,224,0.28)',
            /* Inner bottom caustic (light refracting at base) */
            'inset 0 -1px 0 rgba(255,232,170,0.10)',
            /* Inner left rim */
            'inset 1px 0 0 rgba(255,248,224,0.07)',
            /* Inner right rim */
            'inset -1px 0 0 rgba(255,248,224,0.07)',
            /* Ambient drop shadow */
            '0 8px 32px rgba(0,0,0,0.55)',
            '0 2px 8px rgba(0,0,0,0.38)',
            /* Outer gold glow — matches the app palette */
            '0 0 0 0.5px rgba(216,173,90,0.22)',
          ].join(', '),
        }}
      >
        {/* Specular highlight — top-half white curve */}
        <span
          className="absolute inset-x-0 top-0 pointer-events-none"
          style={{
            height: '52%',
            borderRadius: '28px 28px 60% 60% / 28px 28px 40% 40%',
            background: 'linear-gradient(180deg, rgba(255,252,238,0.18) 0%, rgba(255,248,224,0.04) 60%, transparent 100%)',
          }}
        />

        {/* Interactive mouse glare spotlight */}
        <div
          ref={glareRef}
          className="absolute inset-0 pointer-events-none"
          style={{ mixBlendMode: 'overlay', transition: 'background 0.05s linear' }}
        />

        {/* Sliding active pill — sits behind icon+label */}
        <span
          ref={pillRef}
          className="absolute top-[7px] bottom-[7px] pointer-events-none"
          style={{
            borderRadius: 18,
            background: 'linear-gradient(180deg, rgba(255,241,196,0.16) 0%, rgba(216,173,90,0.09) 100%)',
            border: '1px solid rgba(216,173,90,0.30)',
            boxShadow: 'inset 0 1px 0 rgba(255,248,220,0.24), 0 4px 14px rgba(0,0,0,0.32)',
            transition: 'left 0.5s cubic-bezier(0.34,1.2,0.64,1), width 0.5s cubic-bezier(0.34,1.2,0.64,1)',
            willChange: 'left, width',
          }}
        />

        {/* Nav items */}
        <div className="relative flex-1 flex items-center justify-around h-full">
          {NAV_ITEMS.map((item, idx) => {
            const isAction = (item as any).isAction === true;
            const on = active === item.id;
            const Icon = item.icon;
            const handleClick = () => {
              if (isAction) {
                onPlus();
                return;
              }
              onChange(item.id);
            };
            return (
              <button
                key={item.id}
                ref={el => { btnRefs.current[idx] = el; }}
                onClick={handleClick}
                aria-label={item.label}
                className="relative flex flex-col items-center justify-center gap-[3px] flex-1 h-full"
                style={{
                  cursor: 'pointer',
                  userSelect: 'none',
                  WebkitTapHighlightColor: 'transparent',
                  transition: 'transform 0.18s cubic-bezier(0.34,1.56,0.64,1)',
                  color: on ? '#EFC878' : 'rgba(160,142,110,0.72)',
                }}
                onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.92)')}
                onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
                onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
                onTouchStart={e => (e.currentTarget.style.transform = 'scale(0.92)')}
                onTouchEnd={e => (e.currentTarget.style.transform = 'scale(1)')}
              >
                <span
                  style={{
                    filter: on ? 'drop-shadow(0 0 5px rgba(239,200,120,0.52))' : 'none',
                    transition: 'filter 0.3s ease, color 0.3s ease',
                  }}
                >
                  <Icon active={on} />
                </span>
                <span
                  style={{
                    fontSize: 9.5,
                    fontWeight: on ? 700 : 500,
                    letterSpacing: '0.03em',
                    transition: 'color 0.3s ease, font-weight 0.2s ease',
                  }}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Home indicator */}
      <div className="flex justify-center pt-2">
        <span
          className="rounded-full"
          style={{ width: 112, height: 4, background: 'rgba(243,234,219,0.26)' }}
        />
      </div>
    </div>
  );
};

/* ============================ BOTTOM SHEET (EXPANDABLE ADD FRIEND — REAL TURSO) ============================ */
const BottomSheet = ({
  isOpen,
  onClose,
  onAdded,
}: {
  isOpen: boolean;
  onClose: () => void;
  onAdded: () => void;
}) => {
  const { user } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [tokens, setTokens] = useState<{ id: number; uid?: string; label: string; avatar?: string }[]>([]);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const nextId = useRef(1);

  useEffect(() => {
    if (isOpen && expanded) {
      const t = setTimeout(() => inputRef.current?.focus(), 350);
      return () => clearTimeout(t);
    }
  }, [isOpen, expanded]);

  useEffect(() => {
    if (!isOpen) {
      const t = setTimeout(() => {
        setExpanded(false);
        setInputValue('');
        setTokens([]);
        setRemovingId(null);
        setSearchError(null);
      }, 500);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  const handleAddToken = useCallback(async () => {
    const v = inputValue.trim().toUpperCase();
    if (!v || !user) return;
    setSearching(true);
    setSearchError(null);
    try {
      const found = await findUserByContactToken(v);
      if (!found) {
        setSearchError("No user found with this token.");
        return;
      }
      if (found.uid === user.uid) {
        setSearchError("You can't add yourself.");
        return;
      }
      if (tokens.some((t) => t.uid === found.uid)) {
        setSearchError("This person is already in your list.");
        setInputValue('');
        return;
      }
      setTokens((prev) => [...prev, { id: nextId.current++, uid: found.uid, label: found.name, avatar: found.avatar }]);
      setInputValue('');
    } catch (e: any) {
      setSearchError(e.message || "Search failed.");
    } finally {
      setSearching(false);
    }
  }, [inputValue, tokens, user]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddToken();
    }
    if (e.key === 'Backspace' && !inputValue && tokens.length > 0) {
      const last = tokens[tokens.length - 1];
      setRemovingId(last.id);
      setTimeout(() => {
        setTokens((prev) => prev.filter((t) => t.id !== last.id));
        setRemovingId(null);
      }, 250);
    }
  }, [inputValue, tokens, handleAddToken]);

  const removeToken = useCallback((id: number) => {
    setRemovingId(id);
    setTimeout(() => {
      setTokens((prev) => prev.filter((t) => t.id !== id));
      setRemovingId(null);
    }, 250);
  }, []);

  const handleSend = useCallback(async () => {
    if (!user) return;
    try {
      for (const token of tokens) {
        if (!token.uid) continue;
        await getOrCreateChat(user.uid, token.uid);
      }
      onAdded();
      onClose();
    } catch (e: any) {
      alert("Failed to add contact: " + (e.message || "Unknown error"));
    }
  }, [onClose, onAdded, tokens, user]);

  const tokenCount = tokens.length;

  return (
    <>
      <div
        className={`absolute inset-0 z-40 transition-opacity duration-[500ms] ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
        onClick={() => { onClose(); }}
      />

      <div
        className={`absolute inset-x-0 bottom-0 z-50 transition-transform duration-[550ms] cubic-bezier(0.32, 0.72, 0, 1) ${isOpen ? 'translate-y-0' : 'translate-y-full'}`}
        style={{ willChange: 'transform' }}
      >
        <div
          className="relative px-5 pb-7 pt-3"
          style={{
            background: 'linear-gradient(178deg, #1E1A14 0%, #14110D 40%, #0F0D0A 100%)',
            borderRadius: '32px 32px 0 0',
            border: '1px solid rgba(216,173,90,0.15)',
            borderBottom: 'none',
            boxShadow: '0 -4px 30px rgba(0,0,0,0.6), 0 -12px 60px rgba(0,0,0,0.35), 0 1px 0 rgba(255,235,190,0.08) inset',
            maxHeight: '60vh',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-center pb-4">
            <span className="w-10 h-1 rounded-full" style={{ background: 'rgba(243,234,219,0.3)' }} />
          </div>

          <div className="mb-5 px-1">
            <h2 className="text-[18px] font-bold text-[#F3EADB] tracking-tight">
              {expanded ? 'Add People' : 'New Nudge'}
            </h2>
            <p className="text-[12px] text-[#8A7D67] mt-0.5 font-medium">
              {expanded ? 'Enter a contact token to add someone.' : 'Start a conversation or add people to a circle.'}
            </p>
          </div>

          <div className="transition-all duration-400 ease-out">
            <AnimatePresence mode="wait">
              {!expanded ? (
                <motion.div
                  key="button"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
                  className="flex flex-col items-center gap-4"
                >
                  <div className="w-full">
                    <p className="text-[11px] font-semibold text-[#6E6353] uppercase tracking-wider mb-3 px-1">Add by Token</p>
                    <p className="text-[12px] text-[#8A7D67] mb-3 px-1 leading-relaxed">
                      Every Nudgel user has a unique contact token. Ask someone for their token and enter it below.
                    </p>
                  </div>
                  <motion.button
                    layout
                    onClick={() => setExpanded(true)}
                    className="gold-solid tappable w-full h-[52px] rounded-2xl flex items-center justify-center gap-2.5 text-black"
                    style={{ textShadow: '0 1px 0 rgba(255,243,214,0.55)' }}
                    whileTap={{ scale: 0.96 }}
                  >
                    <I.Plus s={20} />
                    <span className="text-[15px] font-bold">Add Friend</span>
                  </motion.button>
                </motion.div>
              ) : (
                <motion.div
                  key="input"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
                  className="flex flex-col gap-3"
                >
                  <motion.div
                    layout
                    className="min-h-[50px] p-3 rounded-2xl flex flex-wrap gap-2 items-start content-start"
                    style={{
                      background: 'linear-gradient(178deg, #1B1814 0%, #14110D 100%)',
                      border: `1.5px solid ${tokenCount > 0 ? 'rgba(216,173,90,0.3)' : 'rgba(216,173,90,0.14)'}`,
                      boxShadow: tokenCount > 0 ? '0 0 16px rgba(216,173,90,0.12)' : 'none',
                    }}
                    onClick={() => inputRef.current?.focus()}
                  >
                    {tokens.map((token) => (
                      <span
                        key={token.id}
                        className={`inline-flex items-center gap-1.5 pl-0.5 pr-1 py-1 rounded-full text-[12px] font-bold text-[#F3EADB] transition-all duration-[300ms] ease-out ${
                          removingId === token.id ? 'token-exit' : 'token-enter'
                        }`}
                        style={{
                          background: 'linear-gradient(178deg, #2A2520 0%, #1E1A14 100%)',
                          border: '1.5px solid rgba(216,173,90,0.35)',
                          boxShadow: '0 0 10px rgba(216,173,90,0.15), 0 2px 6px rgba(0,0,0,0.4)',
                        }}
                      >
                        {token.avatar ? (
                          <img src={token.avatar} alt="" className="w-[22px] h-[22px] rounded-full object-cover" draggable={false} />
                        ) : (
                          <span className="w-[22px] h-[22px] rounded-full gold-solid flex items-center justify-center">
                            <span className="text-[10px] text-black font-black leading-none">{token.label[0]?.toUpperCase()}</span>
                          </span>
                        )}
                        <span>{token.label}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); removeToken(token.id); }}
                          className="ml-0.5 w-[18px] h-[18px] rounded-full flex items-center justify-center text-[#8A7D67] hover:text-[#EFC878] hover:bg-[#EFC878]/10 transition-colors flex-shrink-0"
                        >
                          <I.X s={11} />
                        </button>
                      </span>
                    ))}

                    <input
                      ref={inputRef}
                      type="text"
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder={tokens.length === 0 ? 'MW-XXXX-XXXX-XXXX' : 'Add another token...'}
                      className="flex-1 min-w-[120px] bg-transparent text-[13px] font-medium text-[#F3EADB] placeholder-[#6E6353] outline-none py-1 uppercase tracking-wider"
                    />
                  </motion.div>

                  {searchError && (
                    <div className="text-[12px] text-rose-300 px-1">{searchError}</div>
                  )}

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setExpanded(false)}
                      className="flex-shrink-0 px-4 h-[42px] rounded-xl text-[#8A7D67] text-[13px] font-semibold tappable-soft"
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                    >
                      Back
                    </button>
                    <div className="flex-1" />
                    <button
                      onClick={handleAddToken}
                      disabled={!inputValue.trim() || searching}
                      className="flex-shrink-0 w-[42px] h-[42px] rounded-xl flex items-center justify-center tappable-soft transition-opacity"
                      style={{
                        background: inputValue.trim()
                          ? 'linear-gradient(170deg, #FFF1CC 0%, #E3B25D 42%, #A87527 82%)'
                          : 'rgba(255,255,255,0.06)',
                        color: inputValue.trim() ? '#1A1206' : '#3A332A',
                        opacity: inputValue.trim() ? 1 : 0.4,
                      }}
                    >
                      {searching ? (
                        <div className="w-4 h-4 border-2 border-[#1A1206] border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <I.Plus s={18} />
                      )}
                    </button>
                    <button
                      onClick={handleSend}
                      disabled={tokens.length === 0}
                      className="gold-solid tappable flex-shrink-0 h-[42px] px-6 rounded-xl flex items-center justify-center gap-2 text-black"
                      style={{
                        textShadow: '0 1px 0 rgba(255,243,214,0.55)',
                        opacity: tokens.length > 0 ? 1 : 0.35,
                        boxShadow: tokens.length > 0
                          ? '0 2px 8px rgba(216,173,90,0.35), inset 0 1px 0 rgba(255,248,220,0.5) inset, 0 -1px 3px rgba(90,62,14,0.4) inset'
                          : 'none',
                      }}
                    >
                      <span className="text-[13px] font-bold">Add</span>
                      <I.Send s={15} />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </>
  );
};

/* ============================ SETTINGS VIEW ============================ */
const SettingsView = ({ onBack }: { onBack?: () => void }) => {
  const { user, signOut } = useAuth();
  const [copied, setCopied] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [liveToken, setLiveToken] = useState<string | null>((user as any)?.contactToken || null);
  const [liveAvatar, setLiveAvatar] = useState<string | null>(null);

  // Refresh profile from DB if token wasn't in memory
  useEffect(() => {
    if (!user || liveToken) return;
    getMyProfile(user.uid).then((p) => {
      if (p) {
        setLiveToken(p.contactToken);
        if (p.avatar) setLiveAvatar(p.avatar);
      }
    });
  }, [user?.uid, liveToken]);

  const contactToken = liveToken;
  const avatarUrl = liveAvatar || user?.photoURL || fallbackAvatar(user?.name || 'U');

  const copyToken = async () => {
    if (!contactToken) return;
    try {
      await navigator.clipboard.writeText(contactToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  };

  const shareToken = async () => {
    if (!contactToken) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'My Nudgel Token', text: `Add me on Nudgel! My contact token: ${contactToken}` });
      } catch { /* cancelled */ }
    } else {
      copyToken();
    }
  };

  const handleSignOut = async () => {
    setLoggingOut(true);
    try {
      await signOut();
    } catch {
      setLoggingOut(false);
    }
  };

  return (
    <div className="h-full w-full flex flex-col bg-[#050403] rise-in overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-4 py-3 flex-shrink-0" style={{ background: 'rgba(11, 9, 7, 0.95)', backdropFilter: 'blur(10px)', borderBottom: '1px solid rgba(216,173,90,0.1)' }}>
        <div className="flex items-center gap-1.5 min-w-0">
          {onBack && (
            <button onClick={onBack} className="tappable-soft p-1 text-[#D4A853] flex-shrink-0">
              <I.ChevronLeft s={26} />
            </button>
          )}
          <span className="text-[17px] font-bold text-[#F3EADB] tracking-tight">Profile</span>
        </div>
      </div>

      <div className="scroll-area flex-1 min-h-0 px-4 py-6">
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="relative">
            <GoldAvatar img={avatarUrl} size={80} />
          </div>
          <div className="text-center">
            <div className="text-[18px] font-bold text-[#F3EADB]">{user?.name || 'User'}</div>
            <div className="text-[12px] text-[#8A7D67] mt-0.5">{user?.email}</div>
          </div>
        </div>

        <div className="mb-6">
          <p className="text-[11px] font-semibold text-[#6E6353] uppercase tracking-wider mb-3 px-1">Your Contact Token</p>
          <div
            className="rounded-2xl p-4"
            style={{
              background: 'linear-gradient(178deg, #1B1814 0%, #14110D 100%)',
              border: '1.5px solid rgba(216,173,90,0.2)',
              boxShadow: '0 0 16px rgba(216,173,90,0.08)',
            }}
          >
            <div className="text-center mb-3 min-h-[27px] flex items-center justify-center">
              {contactToken ? (
                <span className="text-[18px] font-bold tracking-[3px] text-[#EFC878] font-mono">{contactToken}</span>
              ) : (
                <span className="flex items-center gap-2 text-[#8A7D67] text-[13px] font-semibold">
                  <span className="w-4 h-4 border-2 border-[#D4A853] border-t-transparent rounded-full animate-spin inline-block" />
                  Loading your token...
                </span>
              )}
            </div>
            <p className="text-[11px] text-[#6E6353] text-center mb-4 leading-relaxed">
              Share this token with others so they can add you on Nudgel.
            </p>
            <div className="flex gap-2">
              <button
                onClick={copyToken}
                disabled={!contactToken}
                className="flex-1 h-[42px] rounded-xl flex items-center justify-center gap-2 text-[13px] font-bold tappable-soft"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#C9BCA6', opacity: contactToken ? 1 : 0.4 }}
              >
                {copied ? (
                  <><I.Check s={14} /> <span>Copied!</span></>
                ) : (
                  <><span>📋</span> <span>Copy</span></>
                )}
              </button>
              <button
                onClick={shareToken}
                disabled={!contactToken}
                className="flex-1 gold-solid tappable h-[42px] rounded-xl flex items-center justify-center gap-2 text-[13px] font-bold text-black"
                style={{ textShadow: '0 1px 0 rgba(255,243,214,0.55)', opacity: contactToken ? 1 : 0.4 }}
              >
                <span>🔗</span> <span>Share</span>
              </button>
            </div>
          </div>
        </div>

        <div className="mb-6">
          <p className="text-[11px] font-semibold text-[#6E6353] uppercase tracking-wider mb-3 px-1">Account</p>
          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: 'linear-gradient(178deg, #1B1814 0%, #14110D 100%)', border: '1px solid rgba(216,173,90,0.12)' }}
          >
            <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <span className="text-[13px] text-[#C9BCA6] font-medium">Database</span>
              <span className="text-[12px] font-bold text-[#34B45E]">Turso</span>
            </div>
            <div className="px-4 py-3 flex items-center justify-between">
              <span className="text-[13px] text-[#C9BCA6] font-medium">User ID</span>
              <span className="text-[11px] text-[#6E6353] font-mono">{user?.uid.slice(0, 12)}...</span>
            </div>
          </div>
        </div>

        <button
          onClick={handleSignOut}
          disabled={loggingOut}
          className="w-full h-[48px] rounded-2xl flex items-center justify-center gap-2 text-[14px] font-bold tappable"
          style={{
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.2)',
            color: '#F87171',
            opacity: loggingOut ? 0.5 : 1,
          }}
        >
          {loggingOut ? (
            <div className="w-5 h-5 border-2 border-[#F87171] border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
              </svg>
              Sign Out
            </>
          )}
        </button>
      </div>

      <div className="flex justify-center pb-4 pt-2 flex-shrink-0">
        <span className="w-[110px] h-[4px] rounded-full" style={{ background: 'rgba(243,234,219,0.28)' }} />
      </div>
    </div>
  );
};

/* ============================ APP (REAL TURSO) ============================ */
export default function MessagingApp() {
  const { user } = useAuth();
  const [tab, setTab] = useState('chats');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  const [showComposer, setShowComposer] = useState(false);
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [nudges, setNudges] = useState<SocialNudge[]>([]);
  const [viewerNudges, setViewerNudges] = useState<SocialNudge[] | null>(null);

  const avatarUrl = user?.photoURL || fallbackAvatar(user?.name || 'U');

  // Set of users who currently have an active (published, non-expired) Nudge.
  const nudgeUserIds = new Set(nudges.map((n) => n.userId));
  const myNudgeCount = user ? nudges.filter((n) => n.userId === user.uid).length : 0;

  // Open the immersive viewer with every active Nudge published by `uid`.
  const handleViewNudges = (uid: string) => {
    const list = nudges.filter((n) => n.userId === uid);
    if (list.length) setViewerNudges(list);
  };

  // Poll published Nudges so freshly-uploaded ones appear right away.
  useEffect(() => {
    if (!user) return;
    let stopped = false;
    const fetchNudges = async () => {
      try {
        const data = await listSocialNudges();
        if (!stopped) setNudges(data);
      } catch (e) {
        console.warn('Nudge poll failed:', e);
      }
    };
    fetchNudges();
    const iv = setInterval(fetchNudges, 4000);
    return () => { stopped = true; clearInterval(iv); };
  }, [user, refreshKey]);

  // Poll the chat list + heartbeat presence
  useEffect(() => {
    if (!user) return;
    let stopped = false;

    const poll = async () => {
      try {
        const summaries = await listChats(user.uid);
        if (stopped) return;
        setChats(summaries.map(summaryToChat));
        setLoading(false);
      } catch (e) {
        console.warn('Chat list poll failed:', e);
        if (!stopped) setLoading(false);
      }
    };

    poll();
    const interval = setInterval(poll, 3000);

    // Presence heartbeat every 30s
    heartbeat(user.uid);
    const hb = setInterval(() => heartbeat(user.uid), 30_000);

    return () => { stopped = true; clearInterval(interval); clearInterval(hb); };
  }, [user, refreshKey]);

  const handleTabChange = (id: string) => {
    // Every primary destination is just a tab now — the bottom nav and the
    // surrounding app shell persist across all of them.
    setTab(id);
  };

  const handleAdded = () => {
    setRefreshKey((k) => k + 1);
  };

  return (
    <div className="messaging-shell h-full w-full flex items-center justify-center overflow-hidden" style={{ background: '#050403' }}>
      <div
        className="relative w-full max-w-[420px] h-full max-h-[900px] flex flex-col overflow-hidden sm:rounded-[44px]"
        style={{
          background: 'linear-gradient(178deg, #131009 0%, #0B0907 38%, #080606 100%)',
          boxShadow: '0 0 0 1px rgba(216,173,90,0.1), 0 30px 90px rgba(0,0,0,0.9)',
        }}
      >
        <div
          className="absolute top-0 inset-x-0 h-[220px] pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 90% 100% at 30% 0%, rgba(216,173,90,0.085) 0%, transparent 65%)' }}
        />
        <div
          className="absolute bottom-0 inset-x-0 h-[180px] pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 80% 100% at 50% 100%, rgba(216,173,90,0.06) 0%, transparent 65%)' }}
        />

        {/* ─────────────────────────────────────────────────────────────
            APP SHELL
              ├── Main Content Area  (swaps between primary pages)
              └── Persistent Bottom Navigation
            The bottom nav lives in the shell, NOT inside any page, so it
            stays visible across Home / Settings / every primary page.
            Only Chat & Nudge-creation overlays (rendered later) cover it.
           ───────────────────────────────────────────────────────────── */}
        <motion.div
          initial={false}
          animate={{
            scale: showComposer ? 0.92 : 1,
            rotateX: showComposer ? -10 : 0,
            y: showComposer ? 30 : 0,
            opacity: showComposer ? 0 : 1,
            filter: showComposer ? 'blur(8px)' : 'blur(0px)',
          }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="flex-1 flex flex-col min-h-0 pointer-events-auto overflow-hidden relative"
        >
          {/* ── MAIN CONTENT AREA ── */}
          <div className="flex-1 flex flex-col min-h-0 relative">
            <AnimatePresence mode="wait" initial={false}>
              {tab === 'settings' ? (
                <motion.div key="page-settings" className="absolute inset-0 flex flex-col min-h-0">
                  <SettingsView />
                </motion.div>
              ) : (
                <motion.div
                  key="page-home"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                  className="absolute inset-0 flex flex-col min-h-0"
                >
                  <div className="pt-6" />
                  <SearchRow />
                  <Stories
                    contacts={chats}
                    nudgeUserIds={nudgeUserIds}
                    myNudgeCount={myNudgeCount}
                    myAvatar={avatarUrl}
                    myUid={user?.uid || ''}
                    onNewNudge={() => setShowComposer(true)}
                    onViewNudges={handleViewNudges}
                  />

                  <div className="flex-shrink-0 px-4 pt-2">
                    <div className="h-px w-full" style={{ background: 'linear-gradient(90deg, transparent, rgba(216,173,90,0.22) 50%, transparent)' }} />
                  </div>

                  {/* Chats list — from Turso */}
                  <div className="scroll-area flex-1 min-h-0 relative px-2">
                    <div className="sticky top-0 h-3 -mx-2 z-10 pointer-events-none"
                      style={{ background: 'linear-gradient(180deg, #0B0907 0%, transparent 100%)' }} />
                    <div className="space-y-0.5 pt-1 pb-2">
                      {loading && chats.length === 0 ? (
                        <div className="flex flex-col items-center gap-3 pt-16 text-[#6E6353]">
                          <div className="w-6 h-6 border-2 border-[#D4A853] border-t-transparent rounded-full animate-spin" />
                          <span className="text-[12px] font-semibold">Loading conversations...</span>
                        </div>
                      ) : (
                        chats.map((c, i) => (
                          <div key={c.id} onClick={() => setActiveChat(c)}>
                            <ChatRow c={c} delay={i * 40} />
                          </div>
                        ))
                      )}

                      {!loading && chats.length === 0 && (
                        <div className="flex flex-col items-center gap-3 pt-16 text-[#6E6353] px-4 text-center">
                          <I.Chat s={34} />
                          <span className="text-[12px] font-semibold">No conversations yet</span>
                          <span className="text-[11px] text-[#8A7D67] leading-relaxed max-w-[260px]">
                            Tap the gold + button below to add someone by their contact token.
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex-shrink-0 h-2 -mb-2 relative z-10 pointer-events-none"
                    style={{ background: 'linear-gradient(0deg, #0B0907 0%, transparent 100%)' }} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── PERSISTENT BOTTOM NAVIGATION ── */}
          <BottomNav active={tab} onChange={handleTabChange} onPlus={() => setSheetOpen(true)} />
        </motion.div>

        <BottomSheet isOpen={sheetOpen} onClose={() => setSheetOpen(false)} onAdded={handleAdded} />

        <AnimatePresence>
          {showComposer && (
            <StoryCanvasComposer
              onClose={() => setShowComposer(false)}
              onSuccess={() => { setShowComposer(false); setRefreshKey((k) => k + 1); }}
            />
          )}
        </AnimatePresence>

        {/* ── IMMERSIVE NUDGE VIEWER (opened from golden-stroke contacts) ── */}
        <AnimatePresence>
          {viewerNudges && (
            <ImmersiveNudgeViewer
              nudges={viewerNudges}
              initialIndex={0}
              onClose={() => setViewerNudges(null)}
            />
          )}
        </AnimatePresence>

        {activeChat && (
          <ChatInterface
            chat={activeChat}
            onBack={() => setActiveChat(null)}
          />
        )}

        <GlimmerOrb surface={activeChat ? 'chat' : 'home'} />
      </div>
    </div>
  );
}
