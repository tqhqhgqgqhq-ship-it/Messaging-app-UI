import { createClient, type Client } from "@libsql/client/web";

/* ════════════════════════════════════════════════════════════════
   TURSO DATABASE — single source of truth
   ════════════════════════════════════════════════════════════════ */

const TURSO_URL = "libsql://messaging-app-templr.aws-ap-south-1.turso.io";

// ── AUTH TOKEN ──────────────────────────────────────────────────
// Token for: libsql://messaging-app-templr.aws-ap-south-1.turso.io
// Also falls back to localStorage if blank (for future token rotation)
const TURSO_AUTH_TOKEN = "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODExNzg2MDEsImlkIjoiMDE5ZWI2NmItOGYwMS03NjNiLTgxOTktNzJlNzYzNjI5NGZmIiwicmlkIjoiYzI0ZGEyNWEtZDI2Zi00N2IwLWFlNDMtYWJiNWIyMTFkY2UwIn0.B0LVoAj7bh_wpf1Mlk6VmAE53Cx0zCmSWU_zhSe1kqtvnpawCFyY0jq1EJxu5hR3JMCBChWQ-FTMleYjz4NDAQ";

function resolveAuthToken(): string {
  if (TURSO_AUTH_TOKEN) return TURSO_AUTH_TOKEN;
  try {
    return localStorage.getItem("turso_auth_token") || "";
  } catch {
    return "";
  }
}

let _client: Client | null = null;
export function dbClient(): Client {
  if (!_client) {
    _client = createClient({
      url: TURSO_URL,
      authToken: resolveAuthToken() || undefined,
    });
  }
  return _client;
}

/* ============================ SCHEMA ============================ */

let _schemaReady: Promise<void> | null = null;

export function ensureSchema(): Promise<void> {
  if (!_schemaReady) {
    _schemaReady = (async () => {
      const c = dbClient();
      await c.batch([
        `CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          salt TEXT NOT NULL,
          avatar TEXT,
          contact_token TEXT UNIQUE NOT NULL,
          recovery_hash TEXT,
          last_active INTEGER DEFAULT 0,
          created_at INTEGER DEFAULT 0
        )`,
        `CREATE TABLE IF NOT EXISTS sessions (
          token TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          created_at INTEGER DEFAULT 0,
          expires_at INTEGER DEFAULT 0
        )`,
        `CREATE TABLE IF NOT EXISTS chats (
          id TEXT PRIMARY KEY,
          user_a TEXT NOT NULL,
          user_b TEXT NOT NULL,
          last_message TEXT DEFAULT '',
          last_message_by TEXT DEFAULT '',
          updated_at INTEGER DEFAULT 0,
          created_at INTEGER DEFAULT 0,
          UNIQUE(user_a, user_b)
        )`,
        `CREATE TABLE IF NOT EXISTS messages (
          id TEXT PRIMARY KEY,
          chat_id TEXT NOT NULL,
          from_user TEXT NOT NULL,
          text TEXT NOT NULL,
          created_at INTEGER DEFAULT 0,
          status TEXT DEFAULT 'sent',
          read INTEGER DEFAULT 0
        )`,
        `CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages(chat_id, created_at)`,
        `CREATE TABLE IF NOT EXISTS typing (
          chat_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          updated_at INTEGER DEFAULT 0,
          PRIMARY KEY (chat_id, user_id)
        )`,
        `CREATE TABLE IF NOT EXISTS nudges (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          user_name TEXT NOT NULL,
          user_avatar TEXT NOT NULL,
          text TEXT NOT NULL,
          font_id TEXT NOT NULL,
          font_size INTEGER DEFAULT 26,
          font_weight INTEGER DEFAULT 700,
          text_color TEXT NOT NULL,
          bg_color TEXT NOT NULL,
          gradient_bg TEXT NOT NULL,
          border_style TEXT NOT NULL,
          border_radius INTEGER DEFAULT 20,
          text_shadow TEXT NOT NULL,
          text_align TEXT DEFAULT 'center',
          glassmorphism INTEGER DEFAULT 0,
          layout_style TEXT DEFAULT 'standard',
          image_url TEXT,
          image_opacity REAL DEFAULT 1,
          image_blend TEXT DEFAULT 'normal',
          created_at INTEGER DEFAULT 0,
          updated_at INTEGER DEFAULT 0,
          expires_at INTEGER DEFAULT 0
        )`,
      ], "write");

      // ── MIGRATIONS ──
      // Older deployments of the nudges table may be missing columns that
      // the current `createNudge` / `listNudges` / `updateNudge` functions
      // write/read. SQLite does not support `ALTER TABLE ... ADD COLUMN IF NOT
      // EXISTS` (older versions), so we attempt every additive column and
      // swallow the "duplicate column name" error that happens when it
      // already exists. This keeps the schema in sync for every existing
      // and new column without ever throwing.
      const expectedNudgeColumns: Array<[string, string]> = [
        ['user_id', 'TEXT NOT NULL DEFAULT ""'],
        ['user_name', 'TEXT NOT NULL DEFAULT ""'],
        ['user_avatar', 'TEXT NOT NULL DEFAULT ""'],
        ['text', 'TEXT NOT NULL DEFAULT ""'],
        ['font_id', 'TEXT NOT NULL DEFAULT ""'],
        ['font_size', 'INTEGER DEFAULT 26'],
        ['font_weight', 'INTEGER DEFAULT 700'],
        ['text_color', 'TEXT NOT NULL DEFAULT ""'],
        ['bg_color', 'TEXT NOT NULL DEFAULT ""'],
        ['gradient_bg', 'TEXT NOT NULL DEFAULT ""'],
        ['border_style', 'TEXT NOT NULL DEFAULT ""'],
        ['border_radius', 'INTEGER DEFAULT 20'],
        ['text_shadow', 'TEXT NOT NULL DEFAULT ""'],
        ['text_align', 'TEXT DEFAULT "center"'],
        ['glassmorphism', 'INTEGER DEFAULT 0'],
        ['layout_style', 'TEXT DEFAULT "standard"'],
        ['image_url', 'TEXT'],
        ['image_opacity', 'REAL DEFAULT 1'],
        ['image_blend', 'TEXT DEFAULT "normal"'],
        ['created_at', 'INTEGER DEFAULT 0'],
        ['updated_at', 'INTEGER DEFAULT 0'],
        ['expires_at', 'INTEGER DEFAULT 0'],
      ];
      for (const [col, def] of expectedNudgeColumns) {
        try {
          await c.execute({
            sql: `ALTER TABLE nudges ADD COLUMN ${col} ${def}`,
          });
        } catch (err: any) {
          // "duplicate column name: <col>" is the expected case for already-migrated DBs.
          if (!/duplicate column/i.test(String(err?.message || err))) {
            // Real error — rethrow so the outer catch can surface it
            throw err;
          }
        }
      }

      // Indexes for the nudges table — wrap each in try/catch so they
      // don't crash older DBs that already created them.
      for (const idx of [
        `CREATE INDEX IF NOT EXISTS idx_nudges_updated ON nudges(updated_at DESC)`,
        `CREATE INDEX IF NOT EXISTS idx_nudges_author ON nudges(author_id, updated_at DESC)`,
        `CREATE INDEX IF NOT EXISTS idx_nudges_expires ON nudges(expires_at)`,
      ]) {
        try { await c.execute({ sql: idx }); } catch { /* ignore */ }
      }
    })().catch((e) => {
      _schemaReady = null; // allow retry
      throw friendlyDbError(e);
    });
  }
  return _schemaReady;
}

function friendlyDbError(e: any): Error {
  const msg = String(e?.message || e);
  if (/401|403|auth|token/i.test(msg)) {
    return new Error(
      "Database auth failed. Create a Turso token (`turso db tokens create messaging-app-templr`) " +
      "and set it via localStorage.setItem('turso_auth_token', '<token>') then reload."
    );
  }
  return new Error("Database error: " + msg);
}

/* ============================ CRYPTO HELPERS ============================ */

function hex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function randomHex(bytes: number): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return Array.from(buf).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hashPassword(password: string, salt: string): Promise<string> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: enc.encode(salt), iterations: 100_000, hash: "SHA-256" },
    keyMaterial,
    256
  );
  return hex(bits);
}

async function sha256(text: string): Promise<string> {
  return hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
}

/** Deterministic, globally unique contact token derived from user id. */
export async function deriveContactToken(userId: string): Promise<string> {
  const h = await sha256("nudgel-contact-v1::" + userId);
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 12; i++) {
    out += chars[parseInt(h.slice(i * 2, i * 2 + 2), 16) % chars.length];
  }
  return `MW-${out.slice(0, 4)}-${out.slice(4, 8)}-${out.slice(8, 12)}`;
}

function generateRecoveryToken(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const seg = () => {
    let s = "";
    for (let i = 0; i < 4; i++) {
      const buf = new Uint32Array(1);
      crypto.getRandomValues(buf);
      s += chars[buf[0] % chars.length];
    }
    return s;
  };
  return `NUDGEL-${seg()}-${seg()}-${seg()}`;
}

/* ============================ AUTH ============================ */

export type AuthUser = {
  uid: string;
  name: string;
  email: string;
  emailVerified: boolean;
  photoURL: string | null;
  createdAt: string;
  lastSignIn: string;
  recoveryToken: string | null;
  contactToken?: string;
};

const SESSION_KEY = "nudgel_session";

type AuthListener = (user: AuthUser | null) => void;
const listeners: AuthListener[] = [];
let currentUser: AuthUser | null = null;

function notifyAuth(user: AuthUser | null) {
  currentUser = user;
  for (const l of listeners) l(user);
}

export function getCurrentUser(): AuthUser | null {
  return currentUser;
}

function rowToAuthUser(row: any): AuthUser {
  return {
    uid: String(row.id),
    name: String(row.name),
    email: String(row.email),
    emailVerified: true,
    photoURL: row.avatar ? String(row.avatar) : null,
    createdAt: new Date(Number(row.created_at) || Date.now()).toISOString(),
    lastSignIn: new Date().toISOString(),
    recoveryToken: null,
    contactToken: row.contact_token ? String(row.contact_token) : undefined,
  };
}

export async function signUp(name: string, email: string, password: string): Promise<AuthUser> {
  await ensureSchema();
  const c = dbClient();
  const normEmail = email.toLowerCase().trim();

  // Check email not taken
  const existing = await c.execute({ sql: "SELECT id FROM users WHERE email = ?", args: [normEmail] });
  if (existing.rows.length > 0) throw new Error("An account with this email already exists.");

  const id = crypto.randomUUID();
  const salt = randomHex(16);
  const passwordHash = await hashPassword(password, salt);
  const contactToken = await deriveContactToken(id);
  const recoveryToken = generateRecoveryToken();
  const recoveryHash = await sha256(recoveryToken.toUpperCase());
  const avatar = `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(name)}&backgroundColor=f1ede7,ebe4d7&fontWeight=600`;
  const now = Date.now();

  await c.execute({
    sql: `INSERT INTO users (id, name, email, password_hash, salt, avatar, contact_token, recovery_hash, last_active, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [id, name, normEmail, passwordHash, salt, avatar, contactToken, recoveryHash, now, now],
  });

  // Create session
  await createSession(id);

  const user: AuthUser = {
    uid: id,
    name,
    email: normEmail,
    emailVerified: true,
    photoURL: avatar,
    createdAt: new Date(now).toISOString(),
    lastSignIn: new Date(now).toISOString(),
    recoveryToken,
    contactToken,
  };
  notifyAuth(user);
  return user;
}

export async function signIn(email: string, password: string, _remember: boolean): Promise<AuthUser> {
  await ensureSchema();
  const c = dbClient();
  const normEmail = email.toLowerCase().trim();

  const res = await c.execute({ sql: "SELECT * FROM users WHERE email = ?", args: [normEmail] });
  if (res.rows.length === 0) throw new Error("No account found with this email.");
  const row: any = res.rows[0];

  const candidateHash = await hashPassword(password, String(row.salt));
  if (candidateHash !== String(row.password_hash)) throw new Error("Incorrect password.");

  await createSession(String(row.id));
  c.execute({ sql: "UPDATE users SET last_active = ? WHERE id = ?", args: [Date.now(), String(row.id)] }).catch(() => {});

  const user = rowToAuthUser(row);
  notifyAuth(user);
  return user;
}

export async function logout(): Promise<void> {
  const token = localStorage.getItem(SESSION_KEY);
  localStorage.removeItem(SESSION_KEY);
  if (token) {
    try {
      await ensureSchema();
      await dbClient().execute({ sql: "DELETE FROM sessions WHERE token = ?", args: [token] });
    } catch { /* ignore */ }
  }
  notifyAuth(null);
}

async function createSession(userId: string): Promise<void> {
  const token = randomHex(32);
  const now = Date.now();
  await dbClient().execute({
    sql: "INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
    args: [token, userId, now, now + 30 * 24 * 3600 * 1000],
  });
  localStorage.setItem(SESSION_KEY, token);
}

async function restoreSession(): Promise<AuthUser | null> {
  const token = localStorage.getItem(SESSION_KEY);
  if (!token) return null;
  try {
    await ensureSchema();
    const c = dbClient();
    const res = await c.execute({
      sql: `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
            WHERE s.token = ? AND s.expires_at > ?`,
      args: [token, Date.now()],
    });
    if (res.rows.length === 0) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    const row: any = res.rows[0];
    c.execute({ sql: "UPDATE users SET last_active = ? WHERE id = ?", args: [Date.now(), String(row.id)] }).catch(() => {});
    return rowToAuthUser(row);
  } catch (e) {
    console.warn("Session restore failed:", e);
    return null;
  }
}

export function onAuthChange(cb: AuthListener): () => void {
  listeners.push(cb);
  // Restore session on first subscription
  restoreSession().then((user) => {
    currentUser = user;
    cb(user);
  }).catch(() => cb(null));
  return () => {
    const i = listeners.indexOf(cb);
    if (i >= 0) listeners.splice(i, 1);
  };
}

/* ============================ RECOVERY TOKENS ============================ */

export async function verifyRecoveryToken(email: string, token: string): Promise<{ uid: string }> {
  await ensureSchema();
  const normEmail = email.toLowerCase().trim();
  const normToken = token.trim().toUpperCase().replace(/\s/g, "");
  if (!/^NUDGEL-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(normToken)) {
    throw new Error("Invalid token format. It should look like NUDGEL-XXXX-XXXX-XXXX.");
  }
  const res = await dbClient().execute({ sql: "SELECT id, recovery_hash FROM users WHERE email = ?", args: [normEmail] });
  if (res.rows.length === 0) throw new Error("No account found with this email.");
  const row: any = res.rows[0];
  const providedHash = await sha256(normToken);
  if (providedHash !== String(row.recovery_hash)) throw new Error("Invalid recovery token.");
  return { uid: String(row.id) };
}

export async function resetPasswordWithRecoveryToken(
  email: string,
  token: string,
  newPassword: string
): Promise<{ uid: string; newRecoveryToken: string }> {
  if (newPassword.length < 8) throw new Error("Password must be at least 8 characters.");
  if (!/[A-Z]/.test(newPassword)) throw new Error("Include at least one uppercase letter.");
  if (!/[0-9]/.test(newPassword)) throw new Error("Include at least one number.");

  const { uid } = await verifyRecoveryToken(email, token);

  const salt = randomHex(16);
  const passwordHash = await hashPassword(newPassword, salt);
  const newRecoveryToken = generateRecoveryToken();
  const newRecoveryHash = await sha256(newRecoveryToken.toUpperCase());

  await dbClient().execute({
    sql: "UPDATE users SET password_hash = ?, salt = ?, recovery_hash = ? WHERE id = ?",
    args: [passwordHash, salt, newRecoveryHash, uid],
  });

  return { uid, newRecoveryToken };
}

export async function regenerateRecoveryToken(currentPassword?: string): Promise<string> {
  const user = currentUser;
  if (!user) throw new Error("You must be signed in to regenerate your token.");
  await ensureSchema();
  const c = dbClient();

  if (currentPassword) {
    const res = await c.execute({ sql: "SELECT password_hash, salt FROM users WHERE id = ?", args: [user.uid] });
    if (res.rows.length === 0) throw new Error("Account not found.");
    const row: any = res.rows[0];
    const candidate = await hashPassword(currentPassword, String(row.salt));
    if (candidate !== String(row.password_hash)) throw new Error("Incorrect password.");
  }

  const newToken = generateRecoveryToken();
  const newHash = await sha256(newToken.toUpperCase());
  await c.execute({ sql: "UPDATE users SET recovery_hash = ? WHERE id = ?", args: [newHash, user.uid] });
  return newToken;
}

/* ============================ PRESENCE ============================ */

const ONLINE_WINDOW_MS = 60_000;

export async function heartbeat(userId: string): Promise<void> {
  try {
    await ensureSchema();
    await dbClient().execute({ sql: "UPDATE users SET last_active = ? WHERE id = ?", args: [Date.now(), userId] });
  } catch { /* ignore */ }
}

export function isOnline(lastActive: number): boolean {
  return Date.now() - lastActive < ONLINE_WINDOW_MS;
}

export function formatLastActive(lastActive: number): string {
  if (isOnline(lastActive)) return "Online";
  if (!lastActive) return "Offline";
  const diff = Date.now() - lastActive;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `Last seen ${mins <= 1 ? "1 min" : mins + " mins"} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Last seen ${hours === 1 ? "1 hour" : hours + " hours"} ago`;
  const days = Math.floor(hours / 24);
  return `Last seen ${days === 1 ? "1 day" : days + " days"} ago`;
}

/* ============================ CONTACTS ============================ */

export type FoundUser = {
  uid: string;
  name: string;
  email: string;
  avatar: string;
  contactToken: string;
};

export async function findUserByContactToken(token: string): Promise<FoundUser | null> {
  const normalized = token.trim().toUpperCase().replace(/\s/g, "");
  if (!/^MW-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(normalized)) return null;
  await ensureSchema();
  const res = await dbClient().execute({
    sql: "SELECT id, name, email, avatar, contact_token FROM users WHERE contact_token = ?",
    args: [normalized],
  });
  if (res.rows.length === 0) return null;
  const row: any = res.rows[0];
  return {
    uid: String(row.id),
    name: String(row.name),
    email: String(row.email),
    avatar: String(row.avatar || ""),
    contactToken: String(row.contact_token),
  };
}

/* ============================ CHATS ============================ */

export type ChatSummary = {
  id: string;
  otherUid: string;
  otherName: string;
  otherAvatar: string;
  lastMessage: string;
  lastMessageBy: string;
  updatedAt: number;
  unread: number;
  online: boolean;
  lastActive: number;
};

export async function getOrCreateChat(uidA: string, uidB: string): Promise<string> {
  await ensureSchema();
  const c = dbClient();
  const [u1, u2] = [uidA, uidB].sort();

  const existing = await c.execute({
    sql: "SELECT id FROM chats WHERE user_a = ? AND user_b = ?",
    args: [u1, u2],
  });
  if (existing.rows.length > 0) return String((existing.rows[0] as any).id);

  const id = crypto.randomUUID();
  const now = Date.now();
  try {
    await c.execute({
      sql: "INSERT INTO chats (id, user_a, user_b, last_message, last_message_by, updated_at, created_at) VALUES (?, ?, ?, '', '', ?, ?)",
      args: [id, u1, u2, now, now],
    });
  } catch (e: any) {
    // UNIQUE collision means another device created it concurrently — fetch it
    const retry = await c.execute({ sql: "SELECT id FROM chats WHERE user_a = ? AND user_b = ?", args: [u1, u2] });
    if (retry.rows.length > 0) return String((retry.rows[0] as any).id);
    throw e;
  }
  return id;
}

export async function listChats(myUid: string): Promise<ChatSummary[]> {
  await ensureSchema();
  const res = await dbClient().execute({
    sql: `SELECT c.id, c.last_message, c.last_message_by, c.updated_at,
                 u.id AS other_id, u.name AS other_name, u.avatar AS other_avatar, u.last_active AS other_last_active,
                 (SELECT COUNT(*) FROM messages m WHERE m.chat_id = c.id AND m.from_user != ? AND m.read = 0) AS unread
          FROM chats c
          JOIN users u ON u.id = CASE WHEN c.user_a = ? THEN c.user_b ELSE c.user_a END
          WHERE c.user_a = ? OR c.user_b = ?
          ORDER BY c.updated_at DESC
          LIMIT 50`,
    args: [myUid, myUid, myUid, myUid],
  });
  return res.rows.map((r: any) => ({
    id: String(r.id),
    otherUid: String(r.other_id),
    otherName: String(r.other_name),
    otherAvatar: String(r.other_avatar || ""),
    lastMessage: String(r.last_message || ""),
    lastMessageBy: String(r.last_message_by || ""),
    updatedAt: Number(r.updated_at) || 0,
    unread: Number(r.unread) || 0,
    online: isOnline(Number(r.other_last_active) || 0),
    lastActive: Number(r.other_last_active) || 0,
  }));
}

/* ============================ MESSAGES ============================ */

export type DbMessage = {
  id: string;
  chatId: string;
  from: string;
  text: string;
  createdAt: number;
  status: "sent" | "delivered" | "read";
  read: boolean;
};

export async function sendMessage(chatId: string, fromUid: string, text: string): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) return;
  await ensureSchema();
  const c = dbClient();
  const now = Date.now();
  await c.batch([
    {
      sql: "INSERT INTO messages (id, chat_id, from_user, text, created_at, status, read) VALUES (?, ?, ?, ?, ?, 'sent', 0)",
      args: [crypto.randomUUID(), chatId, fromUid, trimmed, now],
    },
    {
      sql: "UPDATE chats SET last_message = ?, last_message_by = ?, updated_at = ? WHERE id = ?",
      args: [trimmed, fromUid, now, chatId],
    },
  ], "write");
}

/** Fetch messages + mark incoming ones as delivered/read (I'm viewing the chat). */
export async function fetchMessages(chatId: string, myUid: string, markRead: boolean): Promise<DbMessage[]> {
  await ensureSchema();
  const c = dbClient();

  if (markRead) {
    // Everything sent to me in this chat is now read (read receipt)
    c.execute({
      sql: "UPDATE messages SET read = 1, status = 'read' WHERE chat_id = ? AND from_user != ? AND read = 0",
      args: [chatId, myUid],
    }).catch(() => {});
  }

  const res = await c.execute({
    sql: "SELECT * FROM messages WHERE chat_id = ? ORDER BY created_at ASC LIMIT 200",
    args: [chatId],
  });
  return res.rows.map((r: any) => ({
    id: String(r.id),
    chatId: String(r.chat_id),
    from: String(r.from_user),
    text: String(r.text),
    createdAt: Number(r.created_at) || 0,
    status: (String(r.status) as any) || "sent",
    read: Number(r.read) === 1,
  }));
}

/* ============================ TYPING INDICATOR ============================ */

export async function setTyping(chatId: string, userId: string): Promise<void> {
  try {
    await ensureSchema();
    await dbClient().execute({
      sql: `INSERT INTO typing (chat_id, user_id, updated_at) VALUES (?, ?, ?)
            ON CONFLICT(chat_id, user_id) DO UPDATE SET updated_at = excluded.updated_at`,
      args: [chatId, userId, Date.now()],
    });
  } catch { /* ignore */ }
}

export async function getTyping(chatId: string, otherUid: string): Promise<boolean> {
  try {
    await ensureSchema();
    const res = await dbClient().execute({
      sql: "SELECT updated_at FROM typing WHERE chat_id = ? AND user_id = ?",
      args: [chatId, otherUid],
    });
    if (res.rows.length === 0) return false;
    return Date.now() - Number((res.rows[0] as any).updated_at) < 4000;
  } catch {
    return false;
  }
}

/* ============================ PROFILE ============================ */

export async function getMyProfile(uid: string): Promise<{ contactToken: string; avatar: string; name: string } | null> {
  try {
    await ensureSchema();
    const res = await dbClient().execute({
      sql: "SELECT name, avatar, contact_token FROM users WHERE id = ?",
      args: [uid],
    });
    if (res.rows.length === 0) return null;
    const row: any = res.rows[0];
    return {
      contactToken: String(row.contact_token),
      avatar: String(row.avatar || ""),
      name: String(row.name),
    };
  } catch {
    return null;
  }
}

/* ============================ SOCIAL NUDGES ============================ */

export type SocialNudge = {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  text: string;
  fontId: string;
  fontSize: number;
  fontWeight: number;
  textColor: string;
  bgColor: string;
  gradientBg: string;
  borderStyle: string;
  borderRadius: number;
  textShadow: string;
  textAlign: 'left' | 'center' | 'right' | 'justify';
  glassmorphism: number;
  layoutStyle: string;
  imageUrl?: string;
  imageOpacity?: number;
  imageBlend?: string;
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
};

export async function publishSocialNudge(n: SocialNudge): Promise<void> {
  await ensureSchema();
  const c = dbClient();
  const sql = `INSERT INTO nudges (
    id, user_id, user_name, user_avatar, text, font_id, font_size, font_weight,
    text_color, bg_color, gradient_bg, border_style, border_radius, text_shadow,
    text_align, glassmorphism, layout_style, image_url, image_opacity, image_blend,
    created_at, updated_at, expires_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    text = excluded.text, font_id = excluded.font_id, font_size = excluded.font_size,
    font_weight = excluded.font_weight, text_color = excluded.text_color,
    bg_color = excluded.bg_color, gradient_bg = excluded.gradient_bg,
    border_style = excluded.border_style, border_radius = excluded.border_radius,
    text_shadow = excluded.text_shadow, text_align = excluded.text_align,
    glassmorphism = excluded.glassmorphism, layout_style = excluded.layout_style,
    image_url = excluded.image_url, image_opacity = excluded.image_opacity,
    image_blend = excluded.image_blend, updated_at = excluded.updated_at,
    expires_at = excluded.expires_at`;

  await c.execute({
    sql,
    args: [
      n.id, n.userId, n.userName, n.userAvatar || '', n.text, n.fontId, n.fontSize, n.fontWeight,
      n.textColor, n.bgColor, n.gradientBg, n.borderStyle, n.borderRadius, n.textShadow,
      n.textAlign, n.glassmorphism, n.layoutStyle, n.imageUrl || null, n.imageOpacity ?? 1, n.imageBlend || 'normal',
      n.createdAt, n.updatedAt, n.expiresAt
    ]
  });
}

export async function deleteSocialNudge(id: string, userId: string): Promise<void> {
  await ensureSchema();
  await dbClient().execute({
    sql: "DELETE FROM nudges WHERE id = ? AND user_id = ?",
    args: [id, userId]
  });
}

export async function listSocialNudges(): Promise<SocialNudge[]> {
  await ensureSchema();
  const now = Date.now();
  // Fetch non-expired nudges, sorted by updatedAt DESC
  const res = await dbClient().execute({
    sql: "SELECT * FROM nudges WHERE expires_at = 0 OR expires_at > ? ORDER BY updated_at DESC LIMIT 100",
    args: [now]
  });

  return res.rows.map((r: any) => ({
    id: String(r.id),
    userId: String(r.user_id),
    userName: String(r.user_name),
    userAvatar: String(r.user_avatar || ''),
    text: String(r.text || ''),
    fontId: String(r.font_id),
    fontSize: Number(r.font_size) || 26,
    fontWeight: Number(r.font_weight) || 700,
    textColor: String(r.text_color),
    bgColor: String(r.bg_color || ''),
    gradientBg: String(r.gradient_bg || ''),
    borderStyle: String(r.border_style || 'none'),
    borderRadius: Number(r.border_radius) || 20,
    textShadow: String(r.text_shadow || 'none'),
    textAlign: (String(r.text_align) as any) || 'center',
    glassmorphism: Number(r.glassmorphism) || 0,
    layoutStyle: String(r.layout_style || 'standard'),
    imageUrl: r.image_url ? String(r.image_url) : undefined,
    imageOpacity: r.image_opacity != null ? Number(r.image_opacity) : 1,
    imageBlend: r.image_blend ? String(r.image_blend) : 'normal',
    createdAt: Number(r.created_at) || 0,
    updatedAt: Number(r.updated_at) || 0,
    expiresAt: Number(r.expires_at) || 0,
  }));
}

/* ============================ GLIMMER — LOCAL MEMORY ENGINE ============================
 * Glimmer is NOT an AI. It is a memory companion that searches the user's
 * own conversations stored in Turso and presents them beautifully.
 *
 * No LLMs, no external APIs, no network calls beyond Turso itself.
 * It searches the `messages` table directly using keyword LIKE matching
 * across every chat the user is part of.
 * ===================================================================== */

export type MemoryMatch = {
  id: string;
  chatId: string;
  text: string;
  context: string;
  createdAt: number;
  fromMe: boolean;
  /** The other person in the conversation this memory came from. */
  withName: string;
  withAvatar: string;
  /** Relevance score — how many query keywords this message matched. */
  score: number;
};

/**
 * Search every message in the user's conversations for the given keywords.
 *
 *   - Joins messages -> chats so only the user's own conversations are searched.
 *   - Each keyword is matched with a case-insensitive LIKE.
 *   - Results are ranked by how many distinct keywords they contain, then
 *     by recency.
 *
 * Returns up to `limit` matches.
 */
export async function searchUserMessages(args: {
  userId: string;
  keywords: string[];
  limit?: number;
}): Promise<MemoryMatch[]> {
  await ensureSchema();
  const limit = args.limit ?? 12;

  const tokens = args.keywords
    .map((k) => k.trim().toLowerCase())
    .filter((k) => k.length >= 2)
    .slice(0, 10);

  if (!tokens.length) return [];

  // OR over each keyword; restrict to chats the user belongs to.
  const likeClauses = tokens.map(() => "LOWER(m.text) LIKE ?").join(" OR ");

  const sql = `
    SELECT m.id, m.chat_id, m.from_user, m.text, m.created_at,
           u.name AS with_name, u.avatar AS with_avatar,
           (
             SELECT p.text FROM messages p
             WHERE p.chat_id = m.chat_id
               AND p.created_at < m.created_at
               AND p.text NOT LIKE '[img]%'
               AND p.text NOT LIKE '[story_%'
               AND p.text NOT LIKE '[nudge]%'
             ORDER BY p.created_at DESC
             LIMIT 1
           ) AS prev_text,
           (
             SELECT n.text FROM messages n
             WHERE n.chat_id = m.chat_id
               AND n.created_at > m.created_at
               AND n.text NOT LIKE '[img]%'
               AND n.text NOT LIKE '[story_%'
               AND n.text NOT LIKE '[nudge]%'
             ORDER BY n.created_at ASC
             LIMIT 1
           ) AS next_text
    FROM messages m
    JOIN chats c ON c.id = m.chat_id
    JOIN users u ON u.id = CASE WHEN c.user_a = ? THEN c.user_b ELSE c.user_a END
    WHERE (c.user_a = ? OR c.user_b = ?)
      AND (${likeClauses})
    ORDER BY m.created_at DESC
    LIMIT 80`;

  const res = await dbClient().execute({
    sql,
    args: [args.userId, args.userId, args.userId, ...tokens.map((t) => `%${t}%`)],
  });

  const matches: MemoryMatch[] = res.rows
    .map((r: any) => {
      const text = String(r.text || "");
      const lower = text.toLowerCase();
      // Skip non-text payloads (images, stories, nudges).
      if (
        lower.startsWith("[img]") ||
        lower.startsWith("[story_") ||
        lower.startsWith("[nudge]")
      ) {
        return null;
      }
      const score = tokens.reduce((acc, t) => (lower.includes(t) ? acc + 1 : acc), 0);
      return {
        id: String(r.id),
        chatId: String(r.chat_id),
        text,
        context: [String(r.prev_text || ''), String(r.next_text || '')]
          .filter(Boolean)
          .join(' / '),
        createdAt: Number(r.created_at) || 0,
        fromMe: String(r.from_user) === args.userId,
        withName: String(r.with_name || "someone"),
        withAvatar: String(r.with_avatar || ""),
        score,
      } as MemoryMatch;
    })
    .filter((m): m is MemoryMatch => m !== null && m.score > 0);

  // Rank: more keyword hits first, then most recent.
  matches.sort((a, b) => b.score - a.score || b.createdAt - a.createdAt);

  return matches.slice(0, limit);
}

/**
 * Recent text messages across all the user's conversations — used to power
 * Glimmer's Memory Timeline, Important Moments, Funny Moments and
 * Friendship Highlights on the full-screen Home world.
 */
export async function recentUserMessages(args: {
  userId: string;
  limit?: number;
}): Promise<MemoryMatch[]> {
  await ensureSchema();
  const limit = args.limit ?? 60;
  const res = await dbClient().execute({
    sql: `
      SELECT m.id, m.chat_id, m.from_user, m.text, m.created_at,
             u.name AS with_name, u.avatar AS with_avatar
      FROM messages m
      JOIN chats c ON c.id = m.chat_id
      JOIN users u ON u.id = CASE WHEN c.user_a = ? THEN c.user_b ELSE c.user_a END
      WHERE (c.user_a = ? OR c.user_b = ?)
      ORDER BY m.created_at DESC
      LIMIT 200`,
    args: [args.userId, args.userId, args.userId],
  });

  return res.rows
    .map((r: any) => {
      const text = String(r.text || "");
      const lower = text.toLowerCase();
      if (
        lower.startsWith("[img]") ||
        lower.startsWith("[story_") ||
        lower.startsWith("[nudge]")
      ) {
        return null;
      }
      return {
        id: String(r.id),
        chatId: String(r.chat_id),
        text,
        context: '',
        createdAt: Number(r.created_at) || 0,
        fromMe: String(r.from_user) === args.userId,
        withName: String(r.with_name || "someone"),
        withAvatar: String(r.with_avatar || ""),
        score: 0,
      } as MemoryMatch;
    })
    .filter((m): m is MemoryMatch => m !== null)
    .slice(0, limit);
}
