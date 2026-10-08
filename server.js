/* ============================================================================
 * CoCo-Voice Chat Room v5 - server
 * Node.js + Express + Socket.io. JSON-file persistence, in-memory rooms.
 * Prototype: auth is salted hashes in a JSON file (NOT production-grade).
 * ========================================================================== */
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const config = require('./config');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*', methods: ['GET', 'POST'] } });
app.use(express.static(path.join(__dirname, 'public'), {
  // index.html must always be fresh (it carries the ?v= cache-busting params);
  // versioned assets (app.js?v=N) can be cached aggressively.
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('index.html')) res.setHeader('Cache-Control', 'no-cache');
  }
}));
// Flat-deploy fallback: if the repo was uploaded with ALL files at the root
// (no public/ folder), also serve the frontend files from the project root.
// NOTHING else from the root is served: server.js, config.js, data/, etc.
// stay private because only these explicit routes exist.
for (const f of ['index.html', 'style.css', 'app.js', 'logo.webp']) {
  app.get('/' + f, (req, res) => {
    const pub = path.join(__dirname, 'public', f);
    // index.html gets `Cache-Control: public, max-age=0` by default → the WebView
    // must revalidate it every time, so new ?v= params are always picked up.
    res.sendFile(fs.existsSync(pub) ? pub : path.join(__dirname, f));
  });
}
app.get('/', (req, res) => {
  const pub = path.join(__dirname, 'public', 'index.html');
  res.sendFile(fs.existsSync(pub) ? pub : path.join(__dirname, 'index.html'));
});
// First-time setup probe: true once any OWNER exists (client hides the standalone super setup card then)
app.get('/api/has-owner', (req, res) => {
  res.json({ hasOwner: users.some(u => hasTag(u, 'OWNER')) });
});

/* ============================ persistence ============================ */
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
function jload(name, fallback) {
  try { return JSON.parse(fs.readFileSync(path.join(DATA_DIR, name), 'utf8')); }
  catch (e) { return fallback; }
}
function jsave(name, obj) {
  fs.writeFileSync(path.join(DATA_DIR, name), JSON.stringify(obj, null, 2));
}
let users = jload('users.json', []);
function saveUsers() { jsave('users.json', users); }

let settings = jload('settings.json', {});
function saveSettings() { jsave('settings.json', settings); }
if (!settings.ownerCode) { settings.ownerCode = config.OWNER_CODE; saveSettings(); }
// SUPER key: the Render env var (SUPER_CODE) only SEEDS the code on first run —
// afterwards the app-stored value wins, so an in-app reset by the OWNER survives redeploys.
if (!settings.superCode) {
  settings.superCode = process.env.SUPER_CODE || config.SUPER_CODE;
  saveSettings();
}
const currentOwnerCode = () => settings.ownerCode;
const currentSuperCode = () => settings.superCode;

let agencies = jload('agencies.json', []);
function saveAgencies() { jsave('agencies.json', agencies); }
let messages = jload('messages.json', []);
function saveMessages() { jsave('messages.json', messages); }
let requests = jload('requests.json', []);
function saveRequests() { jsave('requests.json', requests); }
let codes = jload('codes.json', []);
function saveCodes() { jsave('codes.json', codes); }

// Weekly gift points: { weekId, points: {userId: n}, giftsByDay: {'YYYY-MM-DD': n} }
function weekId(d = new Date()) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = (t.getUTCDay() + 6) % 7;
  t.setUTCDate(t.getUTCDate() - day + 3);
  const firstThu = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
  const fday = (firstThu.getUTCDay() + 6) % 7;
  firstThu.setUTCDate(firstThu.getUTCDate() - fday + 3);
  const w = 1 + Math.round((t - firstThu) / (7 * 864e5));
  return `${t.getUTCFullYear()}-W${String(w).padStart(2, '0')}`;
}
function todayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
let weekly = jload('weekly.json', null);
if (!weekly || weekly.weekId !== weekId()) { weekly = { weekId: weekId(), points: {}, giftsByDay: {} }; jsave('weekly.json', weekly); }
function saveWeekly() { jsave('weekly.json', weekly); }
function addWeeklyPoints(userId, pts) {
  if (weekly.weekId !== weekId()) { weekly = { weekId: weekId(), points: {}, giftsByDay: {} }; }
  weekly.points[userId] = (weekly.points[userId] || 0) + pts;
  const k = todayKey();
  weekly.giftsByDay[k] = (weekly.giftsByDay[k] || 0) + 1;
  saveWeekly();
}

// Weekly targets set by the owner.
// { roles: { adminPlus|manager|bd|vip1..vip8: { points, rewards } },
//   special: [ {id,targetId,vip,vipDays,frameId,frameDays,entryId,entryDays,coins,note,ts,byId} ] }
// reward = { vip, vipDays, frameId, frameDays, entryId, entryDays, coins }
function blankReward() { return { vip: 0, vipDays: 0, frameId: '', frameDays: 0, entryId: '', entryDays: 0, coins: 0 }; }
let targets = jload('targets.json', null);
if (!targets) {
  targets = { roles: {}, special: [] };
  for (const k of ['adminPlus', 'manager', 'bd', 'vip1', 'vip2', 'vip3', 'vip4', 'vip5', 'vip6', 'vip7', 'vip8'])
    targets.roles[k] = { points: 0, rewards: blankReward() };
  jsave('targets.json', targets);
}
function saveTargets() { jsave('targets.json', targets); }

// Reseller audit log: every coin grant by a reseller/owner-sale is appended here.
function logResellerGrant(entry) {
  const line = JSON.stringify({ timestamp: new Date().toISOString(), ...entry }) + '\n';
  fs.appendFileSync(path.join(DATA_DIR, 'reseller_log.json'), line);
}

let nextCoCoId = Math.max(config.FIRST_COCO_ID - 1, users.reduce((m, u) => Math.max(m, u.id || 0), 0)) + 1;
let nextRoomId = 1, nextAgencyId = 1, nextMsgId = 1, nextReqId = 1;
nextAgencyId = Math.max(1, agencies.reduce((m, a) => Math.max(m, a.id || 0), 0)) + 1;
nextMsgId = Math.max(1, messages.reduce((m, x) => Math.max(m, x.id || 0), 0)) + 1;
nextReqId = Math.max(1, requests.reduce((m, x) => Math.max(m, x.id || 0), 0)) + 1;

/* ============================ catalogs ============================ */
// 55 gifts. cat: popular|lucky|couple|relationship|funny|premium
// currency: 'coin' (default) or 'diamond'. lucky: receiver gets 10-30% bonus.
// coupleOnly: only sendable between couples.
const GIFTS = [
  { id: 'rose',       emoji: '🌹', name: 'Rose',         price: 10,     cat: 'popular' },
  { id: 'coffee',     emoji: '☕', name: 'Coffee',       price: 30,     cat: 'popular' },
  { id: 'icecream',   emoji: '🍦', name: 'Ice Cream',    price: 50,     cat: 'popular' },
  { id: 'balloon',    emoji: '🎈', name: 'Balloon',      price: 99,     cat: 'popular' },
  { id: 'teddy',      emoji: '🧸', name: 'Teddy',        price: 199,    cat: 'popular' },
  { id: 'crown',      emoji: '👑', name: 'Crown',        price: 299,    cat: 'popular' },
  { id: 'bouquet',    emoji: '💐', name: 'Bouquet',      price: 499,    cat: 'popular' },
  { id: 'watch',      emoji: '⌚', name: 'Watch',        price: 999,    cat: 'popular' },
  { id: 'rocket',     emoji: '🚀', name: 'Rocket',       price: 1999,   cat: 'popular' },
  { id: 'sportscar',  emoji: '🏎️', name: 'Sports Car',   price: 9999,   cat: 'popular' },
  { id: 'yacht',      emoji: '🛥️', name: 'Yacht',        price: 50000,  cat: 'popular' },
  { id: 'castle',     emoji: '🏰', name: 'CoCo Castle',  price: 300000, cat: 'popular' },
  { id: 'luckystar',  emoji: '🌟', name: 'Lucky Star',   price: 30,     cat: 'lucky', lucky: true },
  { id: 'luckyclover',emoji: '🍀', name: 'Lucky Clover', price: 50,     cat: 'lucky', lucky: true },
  { id: 'luckycat',   emoji: '🐱', name: 'Lucky Cat',    price: 100,    cat: 'lucky', lucky: true },
  { id: 'luckymoon',  emoji: '🌙', name: 'Lucky Moon',   price: 200,    cat: 'lucky', lucky: true },
  { id: 'luckybell',  emoji: '🔔', name: 'Lucky Bell',   price: 300,    cat: 'lucky', lucky: true },
  { id: 'luckycoin',  emoji: '🪙', name: 'Lucky Coin',   price: 500,    cat: 'lucky', lucky: true },
  { id: 'luckygem',   emoji: '💠', name: 'Lucky Gem',    price: 1000,   cat: 'lucky', lucky: true },
  { id: 'luckychest', emoji: '🎁', name: 'Lucky Chest',  price: 2000,   cat: 'lucky', lucky: true },
  { id: 'heart',      emoji: '💘', name: 'Heart',        price: 99,     cat: 'couple', coupleOnly: true },
  { id: 'rings',      emoji: '💍', name: 'Couple Rings', price: 299,    cat: 'couple', coupleOnly: true },
  { id: 'chocbox',    emoji: '💝', name: 'Choco Box',    price: 499,    cat: 'couple', coupleOnly: true },
  { id: 'kiss',       emoji: '💋', name: 'Kiss',         price: 699,    cat: 'couple', coupleOnly: true },
  { id: 'loveletter', emoji: '💌', name: 'Love Letter',  price: 999,    cat: 'couple', coupleOnly: true },
  { id: 'wedding',    emoji: '💒', name: 'Wedding',      price: 1999,   cat: 'couple', coupleOnly: true },
  { id: 'eternallove',emoji: '💞', name: 'Eternal Love', price: 2999,   cat: 'couple', coupleOnly: true },
  { id: 'soulmates',  emoji: '💑', name: 'Soulmates',    price: 4999,   cat: 'couple', coupleOnly: true },
  { id: 'handshake',  emoji: '🤝', name: 'Handshake',    price: 30,     cat: 'relationship' },
  { id: 'brofist',    emoji: '✊', name: 'Bro Fist',     price: 50,     cat: 'relationship' },
  { id: 'besties',    emoji: '👯', name: 'Besties',      price: 100,    cat: 'relationship' },
  { id: 'family',     emoji: '🏠', name: 'Family',       price: 200,    cat: 'relationship' },
  { id: 'teamhug',    emoji: '🫂', name: 'Team Hug',     price: 500,    cat: 'relationship' },
  { id: 'mentor',     emoji: '🎓', name: 'Mentor',       price: 1000,   cat: 'relationship' },
  { id: 'guardian',   emoji: '🛡️', name: 'Guardian',     price: 2000,   cat: 'relationship' },
  { id: 'cheer',      emoji: '📣', name: 'Cheer',        price: 5000,   cat: 'relationship' },
  { id: 'trophy',     emoji: '🏆', name: 'Trophy',       price: 10000,  cat: 'relationship' },
  { id: 'crownjewel', emoji: '💎', name: 'Crown Jewel',  price: 20000,  cat: 'relationship' },
  { id: 'clown',      emoji: '🤡', name: 'Clown',        price: 10,     cat: 'funny' },
  { id: 'duck',       emoji: '🦆', name: 'Duck',         price: 30,     cat: 'funny' },
  { id: 'frog',       emoji: '🐸', name: 'Frog',         price: 50,     cat: 'funny' },
  { id: 'monkey',     emoji: '🙈', name: 'Monkey',       price: 99,     cat: 'funny' },
  { id: 'poop',       emoji: '💩', name: 'Poop',         price: 199,    cat: 'funny' },
  { id: 'ghost',      emoji: '👻', name: 'Ghost',        price: 299,    cat: 'funny' },
  { id: 'alien',      emoji: '👽', name: 'Alien',        price: 499,    cat: 'funny' },
  { id: 'd_rose',     emoji: '🌹', name: 'Diamond Rose',   price: 10,    cat: 'premium', currency: 'diamond' },
  { id: 'd_crown',    emoji: '👑', name: 'Diamond Crown',  price: 50,    cat: 'premium', currency: 'diamond' },
  { id: 'd_throne',   emoji: '🪑', name: 'Diamond Throne', price: 100,   cat: 'premium', currency: 'diamond' },
  { id: 'd_jet',      emoji: '🛩️', name: 'Private Jet',    price: 200,   cat: 'premium', currency: 'diamond' },
  { id: 'd_lion',     emoji: '🦁', name: 'Golden Lion',    price: 500,   cat: 'premium', currency: 'diamond' },
  { id: 'd_palace',   emoji: '🕌', name: 'Diamond Palace', price: 1000,  cat: 'premium', currency: 'diamond' },
  { id: 'd_phoenix',  emoji: '🐦‍🔥', name: 'Phoenix',      price: 2000,  cat: 'premium', currency: 'diamond' },
  { id: 'd_dragon',   emoji: '🐉', name: 'Dragon King',    price: 5000,  cat: 'premium', currency: 'diamond' },
  { id: 'd_universe', emoji: '🌌', name: 'Universe',       price: 10000, cat: 'premium', currency: 'diamond' },
  { id: 'd_legend',   emoji: '🎖️', name: 'CoCo Legend',    price: 20000, cat: 'premium', currency: 'diamond' },
];
const GIFT_MAP = Object.fromEntries(GIFTS.map(g => [g.id, g]));

// VIP shop: level -> {price coins, days}
const VIP_PRICES = { 1: 12600, 2: 28000, 3: 94500, 4: 210000, 5: 350000, 6: 630000, 7: 980000, 8: 1610000 };
const VIP_DAYS = 30;

// Dress-up shop: 30 avatar frames + 25 entry effects (pure CSS art, no images).
// price = 7-day price in coins; 15d = x1.8, 30d = x3 (rounded).
const FRAMES = [
  { id: 'f1',  name: 'Golden Ring',   price: 500 }, { id: 'f2',  name: 'Silver Halo',   price: 400 },
  { id: 'f3',  name: 'Neon Pulse',    price: 600 }, { id: 'f4',  name: 'Royal Crown',   price: 1500 },
  { id: 'f5',  name: 'Ocean Wave',    price: 700 }, { id: 'f6',  name: 'Flame Ring',    price: 800 },
  { id: 'f7',  name: 'Starlight',     price: 900 }, { id: 'f8',  name: 'Diamond Edge',  price: 2000 },
  { id: 'f9',  name: 'Emerald Glow',  price: 1200 },{ id: 'f10', name: 'Ruby Fire',     price: 1300 },
  { id: 'f11', name: 'Sapphire Shine',price: 1100 },{ id: 'f12', name: 'Galaxy Spin',   price: 2500 },
  { id: 'f13', name: 'Thunder Bolt',  price: 1800 },{ id: 'f14', name: 'Angel Wings',   price: 3000 },
  { id: 'f15', name: 'Demon Horns',   price: 2800 },{ id: 'f16', name: 'Flower Crown',  price: 600 },
  { id: 'f17', name: 'Butterfly',     price: 700 }, { id: 'f18', name: 'Snowflake',     price: 800 },
  { id: 'f19', name: 'Sunset Glow',   price: 900 }, { id: 'f20', name: 'Midnight',      price: 1000 },
  { id: 'f21', name: 'Rainbow',       price: 1500 },{ id: 'f22', name: 'Crystal',       price: 2200 },
  { id: 'f23', name: 'Phoenix',       price: 3500 },{ id: 'f24', name: 'Dragon',        price: 4000 },
  { id: 'f25', name: 'Tiger Stripes', price: 1600 },{ id: 'f26', name: 'Lion Mane',     price: 2400 },
  { id: 'f27', name: 'Peacock',       price: 2000 },{ id: 'f28', name: 'Cherry Blossom',price: 1100 },
  { id: 'f29', name: 'Bamboo',        price: 900 }, { id: 'f30', name: 'CoCo Star',     price: 5000 },
];
const ENTRIES = [
  { id: 'e1',  name: 'Royal Entry',    price: 800 }, { id: 'e2',  name: 'Golden Shower', price: 1200 },
  { id: 'e3',  name: 'Neon Arrival',  price: 900 }, { id: 'e4',  name: 'Storm Entry',   price: 1500 },
  { id: 'e5',  name: 'Flower Rain',   price: 700 }, { id: 'e6',  name: 'Star Fall',     price: 1100 },
  { id: 'e7',  name: 'Diamond Rain',  price: 2000 },{ id: 'e8',  name: 'Fire Walk',     price: 1300 },
  { id: 'e9',  name: 'Ocean Wave',    price: 800 }, { id: 'e10', name: 'Thunder',       price: 1600 },
  { id: 'e11', name: 'Angel Descent', price: 2500 },{ id: 'e12', name: 'Dragon Rise',   price: 3000 },
  { id: 'e13', name: 'Phoenix Cry',   price: 2800 },{ id: 'e14', name: 'Rainbow Road',  price: 1400 },
  { id: 'e15', name: 'Snow Storm',    price: 900 }, { id: 'e16', name: 'Meteor',        price: 1800 },
  { id: 'e17', name: 'Volcano',       price: 2200 },{ id: 'e18', name: 'Tsunami',       price: 2000 },
  { id: 'e19', name: 'Aurora',        price: 1700 },{ id: 'e20', name: 'Lightning',     price: 1500 },
  { id: 'e21', name: 'Crown Parade',  price: 2600 },{ id: 'e22', name: 'Balloon Pop',   price: 600 },
  { id: 'e23', name: 'Confetti',      price: 500 }, { id: 'e24', name: 'Spotlight',     price: 1000 },
  { id: 'e25', name: 'CoCo Parade',   price: 4000 },
];
const FRAME_MAP = Object.fromEntries(FRAMES.map(f => [f.id, f]));
const ENTRY_MAP = Object.fromEntries(ENTRIES.map(e => [e.id, e]));
function dressPrice(base, days) {
  if (days === 15) return Math.round(base * 1.8);
  if (days === 30) return Math.round(base * 3);
  return base; // 7
}

/* ============================ in-memory state ============================ */
const sessions = new Map();   // token -> userId
const owners = new Set();      // userIds with owner panel unlocked (OWNER tag + owner code, or super)
const supers = new Set();      // userIds with super owner unlocked (hidden top tier)
const pendingKeyChanges = new Map(); // userId -> { which, newValue, code, expiresAt, attempts }
const KEY_CHANGE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const conns = new Map();       // socketId -> { userId, roomId, seat, muted, hand }
const rooms = new Map();       // roomId -> room

/* ============================ user helpers ============================ */
const getUser = id => users.find(u => u.id === id);
const getUserByName = n => users.find(u => u.username.toLowerCase() === String(n || '').toLowerCase());
function findUserQ(q) {
  q = String(q || '').trim();
  if (!q) return null;
  const n = Number(q);
  return (Number.isFinite(n) && n > 0 ? getUser(n) : null) || getUserByName(q);
}
function normalizeTags(u) {
  if (!Array.isArray(u.tags)) u.tags = [];
  u.tags = [...new Set(u.tags.map(x => String(x).toUpperCase() === 'ADMIN' ? 'ADMIN_PLUS' : String(x).toUpperCase()))];
}
function hasTag(u, t) { return !!u && Array.isArray(u.tags) && u.tags.includes(t); }
const isOwnerTag = u => hasTag(u, 'OWNER');
const isAdminPlus = u => hasTag(u, 'ADMIN_PLUS');
const isManager = u => hasTag(u, 'MANAGER');
const isBD = u => hasTag(u, 'BD');
const isAgent = u => hasTag(u, 'AGENT');
const isReseller = u => hasTag(u, 'RESELLER');
const isHost = u => hasTag(u, 'HOST');
const isSuperId = id => supers.has(id);

// Expire VIP / dress items when stale. Returns true if anything changed.
function sweepExpiry(u) {
  let changed = false;
  const now = Date.now();
  if (u.vip > 0 && u.vipExpires && u.vipExpires < now) { u.vip = 0; u.vipExpires = null; changed = true; }
  for (const k of ['frames', 'entries']) {
    if (Array.isArray(u[k])) {
      const before = u[k].length;
      u[k] = u[k].filter(x => x.expires > now);
      if (u[k].length !== before) changed = true;
    }
  }
  if (u.activeFrame && !(u.frames || []).some(f => f.id === u.activeFrame)) { u.activeFrame = null; changed = true; }
  if (u.activeEntry && !(u.entries || []).some(e => e.id === u.activeEntry)) { u.activeEntry = null; changed = true; }
  return changed;
}
function activeFrameDef(u) { return u.activeFrame && FRAME_MAP[u.activeFrame] ? u.activeFrame : null; }

// Public user object. full=true for self / owner dashboard (includes balances & dress).
function publicUser(u, full = false) {
  if (!u) return null;
  sweepExpiry(u);
  const o = {
    id: u.id, username: u.username, displayName: u.displayName, avatar: u.avatar,
    vip: u.vip || 0, tags: u.tags || [],
    frame: activeFrameDef(u), coupleWith: u.coupleWith || null,
    followers: (u.followers || []).length, following: (u.following || []).length,
    sentGifts: u.sentGifts || 0, receivedCount: u.receivedGifts ? Object.values(u.receivedGifts).reduce((a, b) => a + b, 0) : 0,
  };
  if (full) {
    o.coins = u.coins || 0; o.diamonds = u.diamonds || 0; o.beans = u.beans || 0;
    o.vipExpires = u.vipExpires || null;
    o.frames = u.frames || []; o.entries = u.entries || [];
    o.activeFrame = u.activeFrame || null;
    o.activeEntry = u.activeEntry || null;
    o.receivedGifts = u.receivedGifts || {};
    o.blocked = !!u.blocked;
  }
  return o;
}
function pushUserUpdate(userId, full = true) {
  const u = getUser(userId); if (!u) return;
  for (const [sid, c] of conns) if (c.userId === userId) io.to(sid).emit('userUpdate', publicUser(u, true));
}
const makeToken = () => crypto.randomBytes(24).toString('hex');
function userFromToken(tok) { const id = sessions.get(tok); return id ? getUser(id) : null; }
function agencyName(id) { const a = agencies.find(x => x.id === Number(id)); return a ? a.name : ''; }

/* ============================ room helpers ============================ */
function roomPublic(r) {
  const h = r.hostId ? getUser(r.hostId) : null;
  return {
    id: r.id, name: r.name, locked: !!r.password,
    host: h ? h.displayName : '—', hostId: r.hostId, online: r.members.size,
    agencyId: r.agencyId || null, agencyName: agencyName(r.agencyId),
  };
}
function roomState(r) {
  return {
    id: r.id, name: r.name, locked: !!r.password, hostId: r.hostId,
    agencyId: r.agencyId || null, agencyName: agencyName(r.agencyId),
    seats: r.seats.map(s => s ? { userId: s.userId, muted: s.muted, hand: !!s.hand, user: publicUser(getUser(s.userId)) } : null),
    chat: r.chat.slice(-60)
  };
}
function emitRooms() { io.emit('rooms', [...rooms.values()].map(roomPublic)); }
function broadcastRoom(r) { io.to('room:' + r.id).emit('roomState', roomState(r)); emitRooms(); }
function cleanText(t) { return String(t || '').slice(0, 300); }

function leaveRoomSocket(socket) {
  const c = conns.get(socket.id);
  if (!c || !c.roomId) return;
  const r = rooms.get(c.roomId);
  if (r) {
    if (c.seat != null && r.seats[c.seat] && r.seats[c.seat].socketId === socket.id) {
      r.seats[c.seat] = null;
      for (const sid of r.members) if (sid !== socket.id) io.to(sid).emit('peer-left', { socketId: socket.id });
    }
    r.members.delete(socket.id);
    socket.leave('room:' + r.id);
    if (r.members.size === 0) { rooms.delete(r.id); }
    else broadcastRoom(r);
  }
  c.roomId = null; c.seat = null; c.hand = false;
  emitRooms();
}
function joinRoomDo(socket, user, r, password) {
  if (user.blocked) return socket.emit('roomError', 'Your account is blocked.');
  if (r.password && r.password !== String(password || '') && r.hostId !== user.id)
    return socket.emit('roomError', 'Wrong room password.');
  const c = conns.get(socket.id);
  if (c.roomId) leaveRoomSocket(socket);
  c.roomId = r.id; c.seat = null; c.hand = false;
  r.members.add(socket.id);
  socket.join('room:' + r.id);
  if (user.id === r.hostId && !r.seats[0]) {
    r.seats[0] = { userId: user.id, socketId: socket.id, muted: false, hand: false };
    c.seat = 0;
  }
  socket.emit('roomJoined', roomState(r));
  broadcastRoom(r);
  if ((user.vip || 0) > 0) {
    io.to('room:' + r.id).emit('vipBanner', { text: `VIP ${user.vip} ${user.displayName} entered the room ✨`, vip: user.vip });
  }
  const entryId = user.activeEntry && ENTRY_MAP[user.activeEntry] ? user.activeEntry : null;
  if (entryId) {
    io.to('room:' + r.id).emit('entryEffect', { user: publicUser(user), entry: ENTRY_MAP[entryId] });
  }
  const jt = `${user.displayName} joined the room`;
  r.chat.push({ sys: true, text: jt, ts: Date.now() });
  io.to('room:' + r.id).emit('chatMsg', { sys: true, text: jt, ts: Date.now() });
}

/* ============================ socket handlers ============================ */
io.on('connection', (socket) => {
  conns.set(socket.id, { userId: null, roomId: null, seat: null, muted: false, hand: false });

  const me = (token) => userFromToken(token);
  const emitCatalog = () => socket.emit('catalog', { gifts: GIFTS, vipPrices: VIP_PRICES, vipDays: VIP_DAYS, frames: FRAMES, entries: ENTRIES });
  emitCatalog();
  socket.on('catalog', emitCatalog);

  /* ----- auth ----- */
  socket.on('register', ({ username, password }) => {
    username = String(username || '').trim();
    password = String(password || '');
    if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) return socket.emit('auth', { ok: false, error: 'Username: 3-20 letters/numbers/_ only.' });
    if (password.length < 4) return socket.emit('auth', { ok: false, error: 'Password must be 4+ characters.' });
    if (getUserByName(username)) return socket.emit('auth', { ok: false, error: 'Username already taken.' });
    const user = {
      id: nextCoCoId++,
      username,
      passHash: bcrypt.hashSync(password, 10),
      displayName: username,
      avatar: '🙂',
      vip: 0, vipExpires: null, tags: [],
      coins: config.STARTING_COINS, diamonds: config.STARTING_DIAMONDS, beans: config.STARTING_BEANS,
      frames: [], entries: [], activeFrame: null, activeEntry: null,
      coupleWith: null, receivedGifts: {}, sentGifts: 0,
      followers: [], following: [], blocked: false,
    };
    // Bootstrap: the designated OWNER_USERNAME always gets OWNER (survives data wipes).
    // Otherwise, the first registered user becomes OWNER only if no users exist at all.
    const designatedOwner = (process.env.OWNER_USERNAME || config.OWNER_USERNAME || '').trim().toLowerCase();
    if (designatedOwner && user.username.toLowerCase() === designatedOwner) {
      if (!hasTag(user, 'OWNER')) user.tags.push('OWNER');
    } else if (users.length === 0 && !users.some(u => hasTag(u, 'OWNER'))) {
      user.tags.push('OWNER');
    }
    users.push(user); saveUsers();
    const tok = makeToken(); sessions.set(tok, user.id);
    conns.get(socket.id).userId = user.id;
    emitCatalog();
    socket.emit('auth', { ok: true, token: tok, user: publicUser(user, true) });
  });

  socket.on('login', ({ username, password }) => {
    const user = getUserByName(username);
    if (!user || !bcrypt.compareSync(String(password || ''), user.passHash))
      return socket.emit('auth', { ok: false, error: 'Wrong username or password.' });
    if (user.blocked) return socket.emit('auth', { ok: false, error: 'This account is blocked. Contact support.' });
    // Designated owner always keeps OWNER tag on login (survives data wipes).
    const designatedOwner = (process.env.OWNER_USERNAME || config.OWNER_USERNAME || '').trim().toLowerCase();
    if (designatedOwner && user.username.toLowerCase() === designatedOwner && !hasTag(user, 'OWNER')) {
      user.tags.push('OWNER'); saveUsers();
    }
    if (sweepExpiry(user)) saveUsers();
    const tok = makeToken(); sessions.set(tok, user.id);
    conns.get(socket.id).userId = user.id;
    emitCatalog();
    socket.emit('auth', { ok: true, token: tok, user: publicUser(user, true) });
  });

  socket.on('resume', ({ token }) => {
    const user = me(token);
    if (!user) return socket.emit('auth', { ok: false, error: 'Session expired — please log in again.', sessionExpired: true });
    if (user.blocked) { sessions.delete(token); return socket.emit('auth', { ok: false, error: 'This account is blocked.' }); }
    if (sweepExpiry(user)) saveUsers();
    conns.get(socket.id).userId = user.id;
    emitCatalog();
    socket.emit('auth', { ok: true, token, user: publicUser(user, true), resumed: true });
  });

  socket.on('logout', ({ token }) => { sessions.delete(token); conns.get(socket.id).userId = null; });

  socket.on('updateProfile', ({ token, displayName, avatar }) => {
    const user = me(token); if (!user) return;
    if (displayName) user.displayName = String(displayName).slice(0, 24);
    if (avatar) user.avatar = String(avatar).slice(0, 4);
    saveUsers(); pushUserUpdate(user.id);
    socket.emit('profileSaved', publicUser(user, true));
  });

  socket.on('viewUser', ({ token, userId }) => {
    const viewer = me(token); if (!viewer) return;
    const u = getUser(Number(userId)); if (!u) return socket.emit('userCard', { ok: false });
    const card = publicUser(u);
    card.isFollowing = (u.followers || []).includes(viewer.id);
    socket.emit('userCard', { ok: true, user: card });
  });

  socket.on('follow', ({ token, userId }) => {
    const user = me(token); if (!user) return;
    const t = getUser(Number(userId));
    if (!t || t.id === user.id) return;
    t.followers = t.followers || []; user.following = user.following || [];
    const i = t.followers.indexOf(user.id);
    if (i >= 0) { t.followers.splice(i, 1); user.following = user.following.filter(x => x !== t.id); }
    else { t.followers.push(user.id); user.following.push(t.id); }
    saveUsers(); pushUserUpdate(t.id); pushUserUpdate(user.id);
    socket.emit('followResult', { ok: true, following: i < 0, user: publicUser(t) });
  });

  /* ----- lobby ----- */
  socket.on('listRooms', () => socket.emit('rooms', [...rooms.values()].map(roomPublic)));

  socket.on('createRoom', ({ token, name, password, agencyId }) => {
    const user = me(token);
    if (!user) return socket.emit('roomError', 'Please log in first.');
    if (user.blocked) return socket.emit('roomError', 'Your account is blocked.');
    name = String(name || '').trim().slice(0, 30) || (user.displayName + "'s Room");
    let ag = null;
    if (agencyId) {
      ag = agencies.find(a => a.id === Number(agencyId));
      const canUse = ag && (ag.ownerId === user.id || (ag.members || []).includes(user.id) || isOwnerTag(user) || isSuperId(user.id));
      if (!canUse) return socket.emit('roomError', 'You are not a member of that agency.');
    }
    const r = {
      id: nextRoomId++, name, password: String(password || '').slice(0, 20),
      hostId: user.id, agencyId: ag ? ag.id : null,
      members: new Set(), seats: Array(9).fill(null), chat: []
    };
    rooms.set(r.id, r);
    joinRoomDo(socket, user, r, '');
  });

  socket.on('joinRoom', ({ token, roomId, password }) => {
    const user = me(token);
    if (!user) return socket.emit('roomError', 'Please log in first.');
    const r = rooms.get(Number(roomId));
    if (!r) return socket.emit('roomError', 'Room no longer exists.');
    joinRoomDo(socket, user, r, password);
  });

  socket.on('leaveRoom', () => { leaveRoomSocket(socket); socket.emit('roomLeft'); });

  /* ----- seats ----- */
  socket.on('takeSeat', ({ token, seat }) => {
    const user = me(token); if (!user) return;
    const c = conns.get(socket.id); const r = rooms.get(c.roomId); if (!r) return;
    seat = Number(seat);
    if (!(seat >= 0 && seat <= 8)) return;
    if (r.seats[seat]) return socket.emit('roomError', 'Seat is taken.');
    if (c.seat != null && r.seats[c.seat]) r.seats[c.seat] = null;
    r.seats[seat] = { userId: user.id, socketId: socket.id, muted: c.muted, hand: false };
    c.seat = seat;
    const peers = [];
    r.seats.forEach(s => { if (s && s.socketId !== socket.id) peers.push({ socketId: s.socketId, userId: s.userId }); });
    socket.emit('peers', peers);
    peers.forEach(p => io.to(p.socketId).emit('peer-joined', { socketId: socket.id, userId: user.id }));
    broadcastRoom(r);
  });

  socket.on('leaveSeat', ({ token }) => {
    const user = me(token); if (!user) return;
    const c = conns.get(socket.id); const r = rooms.get(c.roomId); if (!r) return;
    if (c.seat != null && r.seats[c.seat] && r.seats[c.seat].socketId === socket.id) {
      r.seats[c.seat] = null; c.seat = null;
      for (const sid of r.members) if (sid !== socket.id) io.to(sid).emit('peer-left', { socketId: socket.id });
      broadcastRoom(r);
    }
  });

  socket.on('setMuted', ({ token, muted }) => {
    const user = me(token); if (!user) return;
    const c = conns.get(socket.id); c.muted = !!muted;
    const r = rooms.get(c.roomId);
    if (r && c.seat != null && r.seats[c.seat]) { r.seats[c.seat].muted = !!muted; broadcastRoom(r); }
  });

  /* ----- host controls ----- */
  const isRoomHost = (user, r) => user && r && r.hostId === user.id;
  socket.on('hostMute', ({ token, seat, muted }) => {
    const user = me(token); const c = conns.get(socket.id); const r = rooms.get(c.roomId);
    if (!isRoomHost(user, r)) return;
    seat = Number(seat);
    if (r.seats[seat]) { r.seats[seat].muted = !!muted; broadcastRoom(r); io.to(r.seats[seat].socketId).emit('forceMute', { muted: !!muted }); }
  });
  socket.on('hostKick', ({ token, seat }) => {
    const user = me(token); const c = conns.get(socket.id); const r = rooms.get(c.roomId);
    if (!isRoomHost(user, r)) return;
    seat = Number(seat);
    const s = r.seats[seat]; if (!s || s.userId === r.hostId) return;
    const target = io.sockets.sockets.get(s.socketId);
    if (target) { leaveRoomSocket(target); target.emit('kicked'); target.emit('roomLeft'); }
  });
  socket.on('lockRoom', ({ token, locked, password }) => {
    const user = me(token); const c = conns.get(socket.id); const r = rooms.get(c.roomId);
    if (!isRoomHost(user, r)) return;
    if (locked) { if (password !== undefined) r.password = String(password || '').slice(0, 20); }
    else r.password = '';
    broadcastRoom(r);
  });

  /* ----- chat / hand ----- */
  socket.on('chat', ({ token, text }) => {
    const user = me(token); if (!user) return;
    const c = conns.get(socket.id); const r = rooms.get(c.roomId); if (!r) return;
    text = cleanText(text); if (!text) return;
    const msg = { user: publicUser(user), text, ts: Date.now() };
    r.chat.push(msg);
    io.to('room:' + r.id).emit('chatMsg', msg);
  });

  socket.on('raiseHand', ({ token, raised }) => {
    const user = me(token); if (!user) return;
    const c = conns.get(socket.id); const r = rooms.get(c.roomId); if (!r) return;
    const want = raised === undefined ? !c.hand : !!raised;
    c.hand = want;
    if (c.seat != null && r.seats[c.seat]) r.seats[c.seat].hand = want;
    broadcastRoom(r);
  });

  /* ----- gifts ----- */
  socket.on('sendGift', ({ token, toUserId, giftId }) => {
    const user = me(token); if (!user) return;
    const c = conns.get(socket.id); const r = rooms.get(c.roomId); if (!r) return;
    const gift = GIFT_MAP[giftId]; if (!gift) return;
    const target = getUser(Number(toUserId));
    if (!target || target.id === user.id) return socket.emit('giftError', 'Pick another user on a mic seat.');
    const seated = r.seats.some(s => s && s.userId === target.id);
    if (!seated) return socket.emit('giftError', 'That user is not on a mic seat.');
    if (gift.coupleOnly && user.coupleWith !== target.id)
      return socket.emit('giftError', 'Couple gifts can only be sent to your partner 💑');
    const currency = gift.currency || 'coin';
    if (currency === 'coin') {
      if ((user.coins || 0) < gift.price) return socket.emit('giftError', 'Not enough coins.');
      user.coins -= gift.price;
    } else {
      if ((user.diamonds || 0) < gift.price) return socket.emit('giftError', 'Not enough diamonds 💎');
      user.diamonds -= gift.price;
    }
    // receiver gets the gift value added to their collection + stats
    target.receivedGifts = target.receivedGifts || {};
    target.receivedGifts[gift.id] = (target.receivedGifts[gift.id] || 0) + 1;
    user.sentGifts = (user.sentGifts || 0) + 1;
    // lucky bonus: receiver gets 10-30% of price back as bonus
    let bonus = 0;
    if (gift.lucky) {
      bonus = Math.max(1, Math.round(gift.price * (0.10 + Math.random() * 0.20)));
      if (currency === 'coin') target.coins = (target.coins || 0) + bonus;
      else target.diamonds = (target.diamonds || 0) + bonus;
    }
    // weekly points (diamonds count as price*100 points)
    addWeeklyPoints(user.id, currency === 'coin' ? gift.price : gift.price * 100);
    saveUsers(); pushUserUpdate(user.id); pushUserUpdate(target.id);
    io.to('room:' + r.id).emit('giftEvent', {
      from: publicUser(user), to: publicUser(target), gift, bonus,
      currency: currency === 'diamond' ? '💎' : '🪙'
    });
    let txt = `${user.displayName} sent ${gift.emoji} ${gift.name} to ${target.displayName}`;
    if (bonus) txt += ` — 🍀 Lucky! ${target.displayName} got ${bonus} bonus ${currency === 'diamond' ? 'diamonds' : 'coins'}!`;
    io.to('room:' + r.id).emit('chatMsg', { sys: true, text: txt, ts: Date.now() });
  });

  /* ----- VIP shop ----- */
  function applyVipPurchase(u, level) {
    const now = Date.now();
    if (u.vip === level && u.vipExpires && u.vipExpires > now) u.vipExpires += VIP_DAYS * 864e5;
    else { u.vip = level; u.vipExpires = now + VIP_DAYS * 864e5; }
  }
  socket.on('buyVip', ({ token, level }) => {
    const user = me(token); if (!user) return socket.emit('vipResult', { ok: false, error: 'Login first.' });
    level = Number(level);
    const price = VIP_PRICES[level];
    if (!price) return socket.emit('vipResult', { ok: false, error: 'Invalid VIP level.' });
    if ((user.coins || 0) < price) return socket.emit('vipResult', { ok: false, error: 'Not enough coins.' });
    user.coins -= price;
    applyVipPurchase(user, level);
    saveUsers(); pushUserUpdate(user.id);
    socket.emit('vipResult', { ok: true, user: publicUser(user, true), action: 'buy' });
  });
  socket.on('giftVip', ({ token, toUserId, level }) => {
    const user = me(token); if (!user) return socket.emit('vipResult', { ok: false, error: 'Login first.' });
    level = Number(level);
    const price = VIP_PRICES[level];
    if (!price) return socket.emit('vipResult', { ok: false, error: 'Invalid VIP level.' });
    const t = getUser(Number(toUserId));
    if (!t || t.id === user.id) return socket.emit('vipResult', { ok: false, error: 'Pick another user.' });
    if ((user.coins || 0) < price) return socket.emit('vipResult', { ok: false, error: 'Not enough coins.' });
    user.coins -= price;
    applyVipPurchase(t, level);
    saveUsers(); pushUserUpdate(user.id); pushUserUpdate(t.id);
    socket.emit('vipResult', { ok: true, action: 'gift', to: publicUser(t), level });
  });

  /* ----- dress-up shop (frames & entry effects) ----- */
  socket.on('buyDress', ({ token, kind, itemId, days }) => {
    const user = me(token); if (!user) return socket.emit('dressResult', { ok: false, error: 'Login first.' });
    kind = kind === 'entry' ? 'entry' : 'frame';
    days = [7, 15, 30].includes(Number(days)) ? Number(days) : 7;
    const def = kind === 'frame' ? FRAME_MAP[itemId] : ENTRY_MAP[itemId];
    if (!def) return socket.emit('dressResult', { ok: false, error: 'Item not found.' });
    const price = dressPrice(def.price, days);
    if ((user.coins || 0) < price) return socket.emit('dressResult', { ok: false, error: 'Not enough coins.' });
    user.coins -= price;
    const list = kind === 'frame' ? (user.frames = user.frames || []) : (user.entries = user.entries || []);
    const expires = Date.now() + days * 864e5;
    const ex = list.find(x => x.id === itemId);
    if (ex) ex.expires = Math.max(ex.expires, expires); else list.push({ id: itemId, expires });
    saveUsers(); pushUserUpdate(user.id);
    socket.emit('dressResult', { ok: true, action: 'buy', user: publicUser(user, true) });
  });
  socket.on('setActiveDress', ({ token, kind, itemId }) => {
    const user = me(token); if (!user) return socket.emit('dressResult', { ok: false, error: 'Login first.' });
    kind = kind === 'entry' ? 'entry' : 'frame';
    const list = kind === 'frame' ? (user.frames || []) : (user.entries || []);
    if (itemId && !list.some(x => x.id === itemId && x.expires > Date.now()))
      return socket.emit('dressResult', { ok: false, error: 'You do not own this item (or it expired).' });
    if (kind === 'frame') user.activeFrame = itemId || null; else user.activeEntry = itemId || null;
    saveUsers(); pushUserUpdate(user.id);
    socket.emit('dressResult', { ok: true, action: 'activate', user: publicUser(user, true) });
  });

  /* ----- couples (CP) ----- */
  socket.on('coupleRequest', ({ token, toUserId }) => {
    const user = me(token); if (!user) return socket.emit('coupleResult', { ok: false, error: 'Login first.' });
    const t = getUser(Number(toUserId));
    if (!t || t.id === user.id) return socket.emit('coupleResult', { ok: false, error: 'Pick another user.' });
    if (user.coupleWith) return socket.emit('coupleResult', { ok: false, error: 'You are already in a couple 💑' });
    if (t.coupleWith) return socket.emit('coupleResult', { ok: false, error: 'That user is already in a couple.' });
    const COST = 99;
    if ((user.coins || 0) < COST) return socket.emit('coupleResult', { ok: false, error: 'Need 99 coins to send a couple request.' });
    const dup = requests.find(r => r.type === 'couple' && r.status === 'pending' && r.issuerId === user.id && r.targetId === t.id);
    if (dup) return socket.emit('coupleResult', { ok: false, error: 'Request already sent.' });
    user.coins -= COST;
    const req = { id: nextReqId++, type: 'couple', issuerId: user.id, targetId: t.id, status: 'pending', ts: Date.now() };
    requests.push(req); saveRequests();
    messages.push({ id: nextMsgId++, fromId: user.id, toId: t.id, kind: 'card', cardType: 'couple', refId: req.id, text: `💑 ${user.displayName} sent you a couple request!`, ts: Date.now(), read: false });
    saveMessages();
    saveUsers(); pushUserUpdate(user.id); pushUserUpdate(t.id);
    notifyUser(t.id, 'dmNotify', { from: publicUser(user) });
    socket.emit('coupleResult', { ok: true, action: 'sent' });
  });
  socket.on('coupleRespond', ({ token, requestId, accept }) => {
    const user = me(token); if (!user) return socket.emit('coupleResult', { ok: false, error: 'Login first.' });
    const req = requests.find(r => r.id === Number(requestId) && r.type === 'couple' && r.status === 'pending');
    if (!req || req.targetId !== user.id) return socket.emit('coupleResult', { ok: false, error: 'Request not found.' });
    const other = getUser(req.issuerId);
    if (accept && other && !user.coupleWith && !other.coupleWith) {
      user.coupleWith = other.id; other.coupleWith = user.id;
      req.status = 'approved';
      messages.push({ id: nextMsgId++, fromId: user.id, toId: other.id, kind: 'text', text: `💑 We are now a couple!`, ts: Date.now(), read: false });
      saveUsers(); pushUserUpdate(user.id); pushUserUpdate(other.id);
      notifyUser(other.id, 'dmNotify', { from: publicUser(user) });
    } else {
      req.status = 'rejected';
    }
    saveRequests(); saveMessages();
    socket.emit('coupleResult', { ok: true, action: accept ? 'accepted' : 'declined', user: publicUser(user, true) });
  });
  socket.on('coupleBreak', ({ token }) => {
    const user = me(token); if (!user) return socket.emit('coupleResult', { ok: false, error: 'Login first.' });
    if (!user.coupleWith) return socket.emit('coupleResult', { ok: false, error: 'You are not in a couple.' });
    const other = getUser(user.coupleWith);
    user.coupleWith = null;
    if (other) { other.coupleWith = null; pushUserUpdate(other.id); }
    saveUsers(); pushUserUpdate(user.id);
    socket.emit('coupleResult', { ok: true, action: 'broken', user: publicUser(user, true) });
  });

  /* ----- agencies ----- */
  const canManageAgencies = u => u && (isOwnerTag(u) || isSuperId(u.id));
  socket.on('createAgency', ({ token, name }) => {
    const user = me(token);
    if (!canManageAgencies(user)) return; // owner only, silent deny
    name = String(name || '').trim().slice(0, 30);
    if (!name) return socket.emit('agencyResult', { ok: false, error: 'Enter an agency name.' });
    const a = { id: nextAgencyId++, name, ownerId: user.id, members: [] };
    agencies.push(a); saveAgencies();
    socket.emit('agencyResult', { ok: true, action: 'created', agency: a });
  });
  socket.on('agencyAddMember', ({ token, agencyId, userId }) => {
    const user = me(token);
    if (!canManageAgencies(user)) return; // silent deny
    const a = agencies.find(x => x.id === Number(agencyId));
    const t = getUser(Number(userId));
    if (!a || !t) return socket.emit('agencyResult', { ok: false, error: 'Agency or user not found.' });
    if (!isHost(t)) return socket.emit('agencyResult', { ok: false, error: 'Only HOST-tagged users can join an agency.' });
    a.members = a.members || [];
    if (!a.members.includes(t.id)) a.members.push(t.id);
    saveAgencies();
    socket.emit('agencyResult', { ok: true, action: 'memberAdded', agency: a });
  });
  socket.on('agencyRemoveMember', ({ token, agencyId, userId }) => {
    const user = me(token);
    if (!canManageAgencies(user)) return;
    const a = agencies.find(x => x.id === Number(agencyId));
    if (!a) return;
    a.members = (a.members || []).filter(x => x !== Number(userId));
    saveAgencies();
    socket.emit('agencyResult', { ok: true, action: 'memberRemoved', agency: a });
  });
  socket.on('listAgencies', ({ token }) => {
    const user = me(token); if (!user) return;
    socket.emit('agencyList', agencies.map(a => ({ id: a.id, name: a.name, members: a.members || [] })));
  });

  /* ----- notify helper ----- */
  function notifyUser(userId, ev, data) {
    for (const [sid, c] of conns) if (c.userId === userId) io.to(sid).emit(ev, data);
  }

  /* ----- roles & promotion chain -----
     OWNER: instant grants (dashboard). ADMIN_PLUS: requests manager/reseller (owner approves).
     MANAGER -> BD code -> user redeems -> manager approves -> BD.
     BD -> agent code -> user redeems -> BD approves -> AGENT.
     AGENT -> host code -> user redeems -> agent approves -> HOST. */
  const VALID_TAGS = ['ADMIN_PLUS', 'MANAGER', 'BD', 'AGENT', 'RESELLER', 'HOST'];
  const CODE_ROLE = { bd: 'BD', agent: 'AGENT', host: 'HOST' };
  const CODE_ISSUER = { bd: isManager, agent: isBD, host: isAgent };
  const REQ_APPROVER = {
    manager: (req, u) => isOwnerTag(u) || isSuperId(u.id),
    reseller: (req, u) => isOwnerTag(u) || isSuperId(u.id),
    bd: (req, u) => req.issuerId === u.id || isOwnerTag(u) || isSuperId(u.id),
    agent: (req, u) => req.issuerId === u.id || isOwnerTag(u) || isSuperId(u.id),
    host: (req, u) => req.issuerId === u.id || isOwnerTag(u) || isSuperId(u.id),
  };
  const REQ_TAG = { manager: 'MANAGER', reseller: 'RESELLER', bd: 'BD', agent: 'AGENT', host: 'HOST' };

  // Admin Plus: request MANAGER or RESELLER for an ID (self or other) -> owner approves
  socket.on('requestRole', ({ token, targetId, type }) => {
    const user = me(token);
    if (!user || !isAdminPlus(user)) return socket.emit('roleResult', { ok: false, error: 'Admin Plus access required.' });
    type = type === 'reseller' ? 'reseller' : 'manager';
    const t = getUser(Number(targetId));
    if (!t) return socket.emit('roleResult', { ok: false, error: 'User not found.' });
    const tag = REQ_TAG[type];
    if (hasTag(t, tag)) return socket.emit('roleResult', { ok: false, error: `Already ${tag}.` });
    const dup = requests.find(r => r.type === type && r.status === 'pending' && r.targetId === t.id);
    if (dup) return socket.emit('roleResult', { ok: false, error: 'Request already pending.' });
    const req = { id: nextReqId++, type, issuerId: user.id, targetId: t.id, status: 'pending', ts: Date.now() };
    requests.push(req); saveRequests();
    // notify all owners
    for (const u of users) if (isOwnerTag(u) || isSuperId(u.id)) notifyUser(u.id, 'requestNotify', { req: pendingCard(req) });
    socket.emit('roleResult', { ok: true, action: 'requested', type });
  });

  // Generate a role code (manager->bd, bd->agent, agent->host)
  socket.on('genCode', ({ token, type }) => {
    const user = me(token);
    type = String(type || '').toLowerCase();
    const need = CODE_ROLE[type];
    const check = CODE_ISSUER[type];
    if (!need || !check) return socket.emit('roleResult', { ok: false, error: 'Invalid code type.' });
    if (!user || !check(user)) return socket.emit('roleResult', { ok: false, error: 'You cannot generate this code.' });
    const code = crypto.randomBytes(4).toString('hex').slice(0, 8);
    codes.push({ code, type, issuerId: user.id, used: false, ts: Date.now() });
    saveCodes();
    socket.emit('roleResult', { ok: true, action: 'code', type, code });
  });

  // Redeem a code -> creates approval request for the code issuer
  socket.on('redeemCode', ({ token, code }) => {
    const user = me(token);
    if (!user) return socket.emit('roleResult', { ok: false, error: 'Login first.' });
    code = String(code || '').trim().toLowerCase();
    const c = codes.find(x => x.code === code && !x.used);
    if (!c) return socket.emit('roleResult', { ok: false, error: 'Invalid or used code.' });
    const tag = CODE_ROLE[c.type];
    if (hasTag(user, tag)) return socket.emit('roleResult', { ok: false, error: `You are already ${tag}.` });
    const dup = requests.find(r => r.type === c.type && r.status === 'pending' && r.targetId === user.id);
    if (dup) return socket.emit('roleResult', { ok: false, error: 'Your request is already pending.' });
    c.used = true; saveCodes();
    const req = { id: nextReqId++, type: c.type, issuerId: c.issuerId, targetId: user.id, code, status: 'pending', ts: Date.now() };
    requests.push(req); saveRequests();
    const issuer = getUser(c.issuerId);
    if (issuer) notifyUser(issuer.id, 'requestNotify', { req: pendingCard(req) });
    socket.emit('roleResult', { ok: true, action: 'redeemed', type: c.type });
  });

  function pendingCard(r) {
    const issuer = getUser(r.issuerId), target = getUser(r.targetId);
    return {
      id: r.id, type: r.type, status: r.status, ts: r.ts, code: r.code || null,
      issuer: issuer ? { id: issuer.id, displayName: issuer.displayName } : null,
      target: target ? { id: target.id, displayName: target.displayName, username: target.username } : null,
      tag: REQ_TAG[r.type] || null,
    };
  }
  socket.on('listRequests', ({ token }) => {
    const user = me(token); if (!user) return;
    const list = requests.filter(r => r.status === 'pending' && REQ_APPROVER[r.type] && REQ_APPROVER[r.type](r, user)).map(pendingCard);
    const mine = requests.filter(r => r.status === 'pending' && r.issuerId === user.id && r.type === 'couple').map(pendingCard);
    socket.emit('requestList', { ok: true, requests: list, myCouple: mine });
  });
  socket.on('approvalRespond', ({ token, requestId, approve }) => {
    const user = me(token); if (!user) return socket.emit('roleResult', { ok: false, error: 'Login first.' });
    const req = requests.find(r => r.id === Number(requestId) && r.status === 'pending');
    if (!req) return socket.emit('roleResult', { ok: false, error: 'Request not found.' });
    const check = REQ_APPROVER[req.type];
    if (!check || !check(req, user)) return; // silent deny for wrong approver
    const t = getUser(req.targetId);
    if (approve && t) {
      normalizeTags(t);
      const tag = REQ_TAG[req.type];
      if (tag && !t.tags.includes(tag)) t.tags.push(tag);
      saveUsers(); pushUserUpdate(t.id);
      req.status = 'approved';
      messages.push({ id: nextMsgId++, fromId: user.id, toId: t.id, kind: 'text', text: `✅ Your ${tag} request was approved!`, ts: Date.now(), read: false });
      saveMessages();
      notifyUser(t.id, 'dmNotify', { from: publicUser(user) });
    } else {
      req.status = 'rejected';
      if (t) {
        messages.push({ id: nextMsgId++, fromId: user.id, toId: t.id, kind: 'text', text: `❌ Your ${REQ_TAG[req.type]} request was rejected.`, ts: Date.now(), read: false });
        saveMessages();
        notifyUser(t.id, 'dmNotify', { from: publicUser(user) });
      }
    }
    saveRequests();
    socket.emit('roleResult', { ok: true, action: approve ? 'approved' : 'rejected' });
  });

  /* ----- inbox / DM ----- */
  socket.on('sendDM', ({ token, to, text }) => {
    const user = me(token); if (!user) return socket.emit('dmResult', { ok: false, error: 'Login first.' });
    const t = findUserQ(to);
    if (!t || t.id === user.id) return socket.emit('dmResult', { ok: false, error: 'User not found.' });
    text = cleanText(text); if (!text) return;
    messages.push({ id: nextMsgId++, fromId: user.id, toId: t.id, kind: 'text', text, ts: Date.now(), read: false });
    saveMessages();
    notifyUser(t.id, 'dmNotify', { from: publicUser(user), text });
    socket.emit('dmResult', { ok: true, toId: t.id });
  });
  socket.on('listInbox', ({ token }) => {
    const user = me(token); if (!user) return;
    const conv = new Map();
    for (const m of messages) {
      if (m.fromId !== user.id && m.toId !== user.id) continue;
      const otherId = m.fromId === user.id ? m.toId : m.fromId;
      const cur = conv.get(otherId);
      if (!cur || m.ts > cur.ts) {
        const other = getUser(otherId);
        conv.set(otherId, {
          otherId, otherName: other ? other.displayName : '—', otherAvatar: other ? other.avatar : '🙂',
          lastText: m.kind === 'card' ? (m.cardType === 'couple' ? '💑 Couple request' : '📋 Request') : m.text,
          ts: m.ts, unread: 0,
        });
      }
    }
    for (const m of messages) {
      if (m.toId === user.id && !m.read) {
        const otherId = m.fromId;
        const c = conv.get(otherId);
        if (c) c.unread++;
      }
    }
    const list = [...conv.values()].sort((a, b) => b.ts - a.ts);
    // pending approval/couple cards for this user
    const cards = requests
      .filter(r => r.status === 'pending' && (
        (r.type === 'couple' && r.targetId === user.id) ||
        (REQ_APPROVER[r.type] && REQ_APPROVER[r.type](r, user))
      ))
      .map(pendingCard);
    socket.emit('inboxList', { ok: true, conversations: list, cards });
  });
  socket.on('getThread', ({ token, otherId }) => {
    const user = me(token); if (!user) return;
    otherId = Number(otherId);
    const thread = messages
      .filter(m => (m.fromId === user.id && m.toId === otherId) || (m.fromId === otherId && m.toId === user.id))
      .sort((a, b) => a.ts - b.ts)
      .slice(-100)
      .map(m => ({ ...m, fromName: (getUser(m.fromId) || {}).displayName || '—' }));
    for (const m of messages) if (m.toId === user.id && m.fromId === otherId) m.read = true;
    saveMessages();
    const other = getUser(otherId);
    socket.emit('thread', { ok: true, otherId, other: other ? publicUser(other) : null, messages: thread });
  });

  /* ----- owner dashboard -----
     Access: owner panel unlocked (OWNER tag + owner code) OR super. */
  const requireOwnerDash = (user) => user && (owners.has(user.id) || isSuperId(user.id));
  const requireOwnerTagOrSuper = (user) => user && (isOwnerTag(user) || isSuperId(user.id));

  socket.on('ownerDashboard', ({ token }) => {
    const user = me(token);
    if (!requireOwnerDash(user)) return socket.emit('ownerResult', { ok: false, error: 'Owner access required.' });
    const roles = { OWNER: 0, ADMIN_PLUS: 0, MANAGER: 0, BD: 0, AGENT: 0, RESELLER: 0, HOST: 0 };
    let coins = 0, diamonds = 0, beans = 0;
    for (const u of users) {
      normalizeTags(u);
      for (const k of Object.keys(roles)) if (u.tags.includes(k)) roles[k]++;
      coins += u.coins || 0; diamonds += u.diamonds || 0; beans += u.beans || 0;
    }
    const k = todayKey();
    socket.emit('dashboard', {
      ok: true,
      stats: {
        totalUsers: users.length, roles, coins, diamonds, beans,
        giftsToday: (weekly.giftsByDay && weekly.giftsByDay[k]) || 0,
        activeRooms: rooms.size, weekId: weekly.weekId,
      },
      agencies: agencies.map(a => ({ id: a.id, name: a.name, members: a.members || [] })),
      targets,
    });
  });

  socket.on('ownerUserSearch', ({ token, q }) => {
    const user = me(token);
    if (!requireOwnerDash(user)) return socket.emit('ownerResult', { ok: false, error: 'Owner access required.' });
    q = String(q || '').trim().toLowerCase();
    const found = users
      .filter(u => u.username.toLowerCase().includes(q) || String(u.id) === q)
      .slice(0, 20)
      .map(u => publicUser(u, true));
    socket.emit('ownerUserList', { ok: true, users: found });
  });

  socket.on('ownerAdjust', ({ token, userId, field, delta }) => {
    const user = me(token);
    if (!requireOwnerDash(user)) return;
    const t = getUser(Number(userId));
    delta = Math.floor(Number(delta));
    if (!t || !Number.isFinite(delta) || !['coins', 'diamonds', 'beans'].includes(field)) return;
    t[field] = Math.max(0, (t[field] || 0) + delta);
    saveUsers(); pushUserUpdate(t.id);
    socket.emit('ownerDone', { action: field, user: publicUser(t, true) });
  });

  socket.on('ownerSetVipFull', ({ token, userId, level, days }) => {
    const user = me(token);
    if (!requireOwnerDash(user)) return;
    const t = getUser(Number(userId));
    level = Math.floor(Number(level)); days = Math.floor(Number(days) || 0);
    if (!t || !(level >= 0 && level <= 8)) return;
    t.vip = level;
    t.vipExpires = (level > 0 && days > 0) ? Date.now() + days * 864e5 : null;
    saveUsers(); pushUserUpdate(t.id);
    socket.emit('ownerDone', { action: 'vip', user: publicUser(t, true) });
  });

  socket.on('ownerGrantTag', ({ token, userId, tag }) => {
    const user = me(token);
    if (!requireOwnerDash(user)) return;
    const t = getUser(Number(userId));
    tag = String(tag || '').toUpperCase() === 'ADMIN' ? 'ADMIN_PLUS' : String(tag || '').toUpperCase();
    if (!t || !VALID_TAGS.includes(tag)) return;
    normalizeTags(t);
    if (!t.tags.includes(tag)) t.tags.push(tag);
    saveUsers(); pushUserUpdate(t.id);
    socket.emit('ownerDone', { action: 'grantTag', user: publicUser(t, true) });
  });
  socket.on('ownerRevokeTag', ({ token, userId, tag }) => {
    const user = me(token);
    if (!requireOwnerDash(user)) return;
    const t = getUser(Number(userId));
    tag = String(tag || '').toUpperCase() === 'ADMIN' ? 'ADMIN_PLUS' : String(tag || '').toUpperCase();
    if (!t || !VALID_TAGS.includes(tag)) return;
    if (tag === 'OWNER') return; // only super grants/revokes OWNER
    normalizeTags(t);
    t.tags = t.tags.filter(x => x !== tag);
    saveUsers(); pushUserUpdate(t.id);
    socket.emit('ownerDone', { action: 'revokeTag', user: publicUser(t, true) });
  });

  socket.on('ownerBlock', ({ token, userId, blocked }) => {
    const user = me(token);
    if (!requireOwnerDash(user)) return;
    const t = getUser(Number(userId));
    if (!t) return;
    if (isSuperId(t.id) || isOwnerTag(t)) return socket.emit('ownerResult', { ok: false, error: 'Cannot block this account.' });
    t.blocked = !!blocked;
    if (t.blocked) { // drop sessions & room presence
      for (const [tok, uid] of sessions) if (uid === t.id) sessions.delete(tok);
      for (const [sid, c] of conns) if (c.userId === t.id) { const s = io.sockets.sockets.get(sid); if (s) { leaveRoomSocket(s); s.emit('roomLeft'); s.emit('auth', { ok: false, error: 'Account blocked.' }); } }
    }
    saveUsers(); pushUserUpdate(t.id);
    socket.emit('ownerDone', { action: blocked ? 'blocked' : 'unblocked', user: publicUser(t, true) });
  });

  socket.on('ownerGrantDress', ({ token, userId, kind, itemId, days }) => {
    const user = me(token);
    if (!requireOwnerDash(user)) return;
    const t = getUser(Number(userId));
    kind = kind === 'entry' ? 'entry' : 'frame';
    days = Math.floor(Number(days) || 7);
    const def = kind === 'frame' ? FRAME_MAP[itemId] : ENTRY_MAP[itemId];
    if (!t || !def || !(days > 0 && days <= 365)) return;
    const list = kind === 'frame' ? (t.frames = t.frames || []) : (t.entries = t.entries || []);
    const expires = Date.now() + days * 864e5;
    const ex = list.find(x => x.id === itemId);
    if (ex) ex.expires = Math.max(ex.expires, expires); else list.push({ id: itemId, expires });
    saveUsers(); pushUserUpdate(t.id);
    socket.emit('ownerDone', { action: 'dress', user: publicUser(t, true) });
  });

  // Owner coin sale (same as reseller sale, logged)
  socket.on('ownerSellCoins', ({ token, q, amount }) => {
    const user = me(token);
    if (!requireOwnerDash(user)) return socket.emit('ownerResult', { ok: false, error: 'Owner access required.' });
    amount = Math.floor(Number(amount));
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1000000)
      return socket.emit('ownerResult', { ok: false, error: 'Amount must be 1–1,000,000.' });
    const t = findUserQ(q);
    if (!t) return socket.emit('ownerResult', { ok: false, error: 'User not found.' });
    t.coins = (t.coins || 0) + amount;
    saveUsers(); pushUserUpdate(t.id);
    logResellerGrant({ resellerId: user.id, resellerName: user.displayName + ' (OWNER)', targetId: t.id, targetName: t.displayName, amount });
    socket.emit('ownerDone', { action: 'sold', user: publicUser(t, true), amount });
  });

  /* ----- weekly targets ----- */
  function applyReward(u, r) {
    const now = Date.now();
    if (r.vip > 0 && r.vip <= 8) {
      u.vip = r.vip;
      u.vipExpires = r.vipDays > 0 ? now + r.vipDays * 864e5 : null;
    }
    if (r.frameId && FRAME_MAP[r.frameId]) {
      u.frames = u.frames || [];
      const d = r.frameDays > 0 ? r.frameDays : 7;
      const ex = u.frames.find(x => x.id === r.frameId);
      if (ex) ex.expires = Math.max(ex.expires, now + d * 864e5); else u.frames.push({ id: r.frameId, expires: now + d * 864e5 });
    }
    if (r.entryId && ENTRY_MAP[r.entryId]) {
      u.entries = u.entries || [];
      const d = r.entryDays > 0 ? r.entryDays : 7;
      const ex = u.entries.find(x => x.id === r.entryId);
      if (ex) ex.expires = Math.max(ex.expires, now + d * 864e5); else u.entries.push({ id: r.entryId, expires: now + d * 864e5 });
    }
    if (r.coins) u.coins = Math.max(0, (u.coins || 0) + Math.floor(Number(r.coins) || 0));
  }
  function roleKeyOf(u) {
    normalizeTags(u);
    if (u.tags.includes('ADMIN_PLUS')) return 'adminPlus';
    if (u.tags.includes('MANAGER')) return 'manager';
    if (u.tags.includes('BD')) return 'bd';
    if (u.vip >= 1 && u.vip <= 8) return 'vip' + u.vip;
    return null;
  }
  socket.on('setTargets', ({ token, roles }) => {
    const user = me(token);
    if (!requireOwnerDash(user)) return;
    if (roles && typeof roles === 'object') {
      for (const k of Object.keys(targets.roles)) {
        const r = roles[k];
        if (!r) continue;
        targets.roles[k].points = Math.max(0, Math.floor(Number(r.points) || 0));
        const rw = r.rewards || {};
        targets.roles[k].rewards = {
          vip: Math.min(8, Math.max(0, Math.floor(Number(rw.vip) || 0))),
          vipDays: Math.max(0, Math.floor(Number(rw.vipDays) || 0)),
          frameId: FRAME_MAP[rw.frameId] ? rw.frameId : '',
          frameDays: Math.max(0, Math.floor(Number(rw.frameDays) || 0)),
          entryId: ENTRY_MAP[rw.entryId] ? rw.entryId : '',
          entryDays: Math.max(0, Math.floor(Number(rw.entryDays) || 0)),
          coins: Math.max(0, Math.floor(Number(rw.coins) || 0)),
        };
      }
      saveTargets();
    }
    socket.emit('targetsSaved', { ok: true, targets });
  });
  socket.on('settleWeek', ({ token }) => {
    const user = me(token);
    if (!requireOwnerDash(user)) return;
    const results = [];
    for (const u of users) {
      const key = roleKeyOf(u);
      if (!key) continue;
      const cfg = targets.roles[key];
      if (!cfg || !(cfg.points > 0)) continue;
      const pts = (weekly.points && weekly.points[u.id]) || 0;
      if (pts >= cfg.points) {
        applyReward(u, cfg.rewards);
        results.push({ id: u.id, name: u.displayName, role: key, points: pts });
        pushUserUpdate(u.id);
      }
    }
    saveUsers();
    weekly = { weekId: weekId(), points: {}, giftsByDay: {} };
    saveWeekly();
    socket.emit('settleResult', { ok: true, granted: results, count: results.length, weekId: weekly.weekId });
  });
  socket.on('specialGrant', ({ token, grant }) => {
    const user = me(token);
    if (!requireOwnerDash(user)) return;
    const t = getUser(Number(grant && grant.targetId));
    if (!t) return socket.emit('ownerResult', { ok: false, error: 'User not found.' });
    const r = {
      vip: Math.min(8, Math.max(0, Math.floor(Number(grant.vip) || 0))),
      vipDays: Math.max(0, Math.floor(Number(grant.vipDays) || 0)),
      frameId: FRAME_MAP[grant.frameId] ? grant.frameId : '',
      frameDays: Math.max(0, Math.floor(Number(grant.frameDays) || 0)),
      entryId: ENTRY_MAP[grant.entryId] ? grant.entryId : '',
      entryDays: Math.max(0, Math.floor(Number(grant.entryDays) || 0)),
      coins: Math.max(0, Math.floor(Number(grant.coins) || 0)),
    };
    applyReward(t, r);
    const entry = { id: Date.now(), targetId: t.id, targetName: t.displayName, ...r, note: String(grant.note || '').slice(0, 120), ts: Date.now(), byId: user.id };
    targets.special.push(entry); saveTargets();
    saveUsers(); pushUserUpdate(t.id);
    socket.emit('specialResult', { ok: true, entry, targets });
  });

  /* ----- legacy owner events (kept for compatibility) ----- */
  socket.on('ownerUnlock', ({ token, code }) => {
    const user = me(token);
    if (!user) return socket.emit('ownerResult', { ok: false, error: 'Log in first.' });
    const isSuper = isSuperId(user.id);
    // Owner code is required (even for OWNER tag holders) — the user wants the code gate
    if (isSuper || (isOwnerTag(user) && String(code || '') === currentOwnerCode())) {
      owners.add(user.id);
      socket.emit('ownerResult', { ok: true });
    }
    else socket.emit('ownerResult', { ok: false, error: 'Owner access required.' });
  });
  socket.on('ownerSearch', ({ token, q }) => {
    const user = me(token);
    if (!(user && owners.has(user.id))) return socket.emit('ownerSearchResult', { ok: false, error: 'Owner access required.' });
    q = String(q || '').trim().toLowerCase();
    const found = users.filter(u => u.username.toLowerCase().includes(q) || String(u.id) === q).slice(0, 20).map(u => publicUser(u));
    socket.emit('ownerSearchResult', { ok: true, users: found });
  });
  socket.on('ownerAddCoins', ({ token, userId, amount }) => {
    const user = me(token);
    if (!(user && owners.has(user.id))) return;
    const t = getUser(Number(userId)); amount = Math.floor(Number(amount));
    if (!t || !Number.isFinite(amount)) return;
    t.coins = Math.max(0, (t.coins || 0) + amount);
    saveUsers(); pushUserUpdate(t.id);
    socket.emit('ownerDone', { action: 'coins', user: publicUser(t, true) });
  });
  socket.on('ownerSetVip', ({ token, userId, level }) => {
    const user = me(token);
    if (!(user && owners.has(user.id))) return;
    const t = getUser(Number(userId)); level = Math.floor(Number(level));
    if (!t || !(level >= 0 && level <= 8)) return;
    t.vip = level; t.vipExpires = null; saveUsers(); pushUserUpdate(t.id);
    socket.emit('ownerDone', { action: 'vip', user: publicUser(t, true) });
  });
  socket.on('ownerSetTags', ({ token, userId, tags }) => {
    const user = me(token);
    if (!(user && owners.has(user.id))) return;
    const t = getUser(Number(userId));
    if (!t || !Array.isArray(tags)) return;
    t.tags = [...new Set(tags.map(x => {
      x = String(x).toUpperCase();
      return x === 'ADMIN' ? 'ADMIN_PLUS' : x;
    }).filter(x => VALID_TAGS.includes(x)))];
    saveUsers(); pushUserUpdate(t.id);
    socket.emit('ownerDone', { action: 'tags', user: publicUser(t, true) });
  });

  /* ----- super owner (hidden top tier: manages OWNER tags + the keys) -----
     Super can also use ALL owner dashboard powers. Super cannot be blocked. */
  socket.on('superUnlock', ({ token, code }) => {
    const user = me(token);
    if (!user) return socket.emit('superResult', { ok: false, error: 'Log in first.' });
    if (String(code || '') === currentSuperCode()) { supers.add(user.id); socket.emit('superResult', { ok: true }); }
    else socket.emit('superResult', { ok: false, error: 'Wrong super code.' });
  });
  // Forgot the super code? Any OWNER-tagged user can request a reset — but it is
  // NOT instant: a 6-digit verification code is emailed to SUPER_EMAIL first,
  // and the reset only completes after the owner enters that code.
  socket.on('superResetCode', async ({ token, newCode }) => {
    const user = me(token);
    if (!user || !isOwnerTag(user))
      return socket.emit('superResult', { ok: false, error: 'Owner access required.' });
    newCode = String(newCode || '').trim();
    if (newCode.length < 4 || newCode.length > 32)
      return socket.emit('superResult', { ok: false, error: 'Code must be 4-32 characters.' });
    if (!emailConfigured())
      return socket.emit('superResult', { ok: false, error: 'Email not configured — set SUPER_EMAIL / SMTP_USER / SMTP_PASS as Render env vars first.' });
    const code = String(Math.floor(100000 + Math.random() * 900000));
    pendingKeyChanges.set(user.id, { which: 'superReset', newValue: newCode, code, expiresAt: Date.now() + KEY_CHANGE_TTL_MS, attempts: 0 });
    try {
      await sendVerificationEmail('super', code);
      socket.emit('superResult', { ok: true, action: 'keyCodeSent', which: 'superReset' });
    } catch (e) {
      pendingKeyChanges.delete(user.id);
      socket.emit('superResult', { ok: false, error: 'Email failed to send — check SMTP settings.' });
    }
  });
  socket.on('superResetVerify', ({ token, code }) => {
    const user = me(token);
    if (!user || !isOwnerTag(user))
      return socket.emit('superResult', { ok: false, error: 'Owner access required.' });
    const p = pendingKeyChanges.get(user.id);
    if (!p || p.which !== 'superReset')
      return socket.emit('superResult', { ok: false, error: 'No pending reset request.' });
    if (Date.now() > p.expiresAt) {
      pendingKeyChanges.delete(user.id);
      return socket.emit('superResult', { ok: false, error: 'Code expired — request a new one.' });
    }
    if (String(code || '').trim() !== p.code) {
      p.attempts++;
      if (p.attempts >= 5) {
        pendingKeyChanges.delete(user.id);
        return socket.emit('superResult', { ok: false, error: 'Too many wrong attempts — request a new code.' });
      }
      return socket.emit('superResult', { ok: false, error: `Wrong code (${5 - p.attempts} tries left).` });
    }
    settings.superCode = p.newValue;
    saveSettings();
    pendingKeyChanges.delete(user.id);
    socket.emit('superResult', { ok: true, action: 'superReset' });
  });
  const requireSuper = (user) => user && isSuperId(user.id);
  socket.on('superGrantOwner', ({ token, q }) => {
    const user = me(token);
    if (!requireSuper(user)) return; // silent deny
    const t = findUserQ(q);
    if (!t) return socket.emit('superResult', { ok: false, error: 'User not found.' });
    normalizeTags(t);
    if (!t.tags.includes('OWNER')) t.tags.push('OWNER');
    saveUsers(); pushUserUpdate(t.id);
    socket.emit('superResult', { ok: true, action: 'grantOwner', user: publicUser(t) });
  });
  socket.on('superRevokeOwner', ({ token, q }) => {
    const user = me(token);
    if (!requireSuper(user)) return; // silent deny
    const t = findUserQ(q);
    if (!t) return socket.emit('superResult', { ok: false, error: 'User not found.' });
    normalizeTags(t);
    t.tags = t.tags.filter(x => x !== 'OWNER');
    owners.delete(t.id);
    saveUsers(); pushUserUpdate(t.id);
    socket.emit('superResult', { ok: true, action: 'revokeOwner', user: publicUser(t) });
  });
  socket.on('superSetOwnerCode', ({ token }) => {
    const user = me(token);
    if (!requireSuper(user)) return; // silent deny
    socket.emit('superResult', { ok: false, error: 'Use the Gmail verification flow below to change keys.' });
  });

  /* ----- Gmail-verified key changes (super only) ----- */
  // Email settings: Render env vars win when set (SUPER_EMAIL, SMTP_USER,
  // SMTP_PASS, SMTP_HOST, SMTP_PORT), config.js is the fallback.
  const mailCfg = () => ({
    SUPER_EMAIL: process.env.SUPER_EMAIL || config.SUPER_EMAIL,
    SMTP_USER: process.env.SMTP_USER || config.SMTP_USER,
    SMTP_PASS: process.env.SMTP_PASS || config.SMTP_PASS,
    SMTP_HOST: process.env.SMTP_HOST || config.SMTP_HOST,
    SMTP_PORT: Number(process.env.SMTP_PORT || config.SMTP_PORT)
  });
  function emailConfigured() {
    const { SUPER_EMAIL, SMTP_USER, SMTP_PASS } = mailCfg();
    return SUPER_EMAIL && SMTP_USER && SMTP_PASS
      && !String(SUPER_EMAIL).includes('your-gmail')
      && !String(SMTP_USER).includes('your-gmail')
      && !String(SMTP_PASS).includes('xxxx');
  }
  async function sendVerificationEmail(which, code) {
    const mc = mailCfg();
    const transporter = nodemailer.createTransport({
      host: mc.SMTP_HOST, port: mc.SMTP_PORT, secure: false,
      auth: { user: mc.SMTP_USER, pass: mc.SMTP_PASS }
    });
    const keyName = which === 'super' ? 'SUPER key' : 'OWNER code';
    await transporter.sendMail({
      from: `CoCo-Voice Chat Room <${mc.SMTP_USER}>`,
      to: mc.SUPER_EMAIL,
      subject: 'CoCo-Voice Chat Room - Verification Code',
      text: `Your verification code to change the ${keyName} is:\n\n${code}\n\nEnter it in the app within 10 minutes. If you did not request this, ignore this email.`
    });
  }
  socket.on('superRequestKeyChange', async ({ token, which, newValue }) => {
    const user = me(token);
    if (!requireSuper(user)) return; // silent deny
    which = which === 'super' ? 'super' : 'owner';
    newValue = String(newValue || '').trim();
    if (newValue.length < 4 || newValue.length > 32)
      return socket.emit('superResult', { ok: false, error: 'New value must be 4-32 characters.' });
    if (!emailConfigured())
      return socket.emit('superResult', { ok: false, error: 'Email not configured — set SUPER_EMAIL / SMTP_USER / SMTP_PASS in config.js or as Render env vars first.' });
    const code = String(Math.floor(100000 + Math.random() * 900000));
    pendingKeyChanges.set(user.id, { which, newValue, code, expiresAt: Date.now() + KEY_CHANGE_TTL_MS, attempts: 0 });
    try {
      await sendVerificationEmail(which, code);
      socket.emit('superResult', { ok: true, action: 'keyCodeSent', which });
    } catch (e) {
      pendingKeyChanges.delete(user.id);
      socket.emit('superResult', { ok: false, error: 'Email failed to send — check SMTP settings in config.js.' });
    }
  });
  socket.on('superConfirmKeyChange', ({ token, code }) => {
    const user = me(token);
    if (!requireSuper(user)) return; // silent deny
    const p = pendingKeyChanges.get(user.id);
    if (!p) return socket.emit('superResult', { ok: false, error: 'No pending key-change request.' });
    if (Date.now() > p.expiresAt) {
      pendingKeyChanges.delete(user.id);
      return socket.emit('superResult', { ok: false, error: 'Code expired — request a new one.' });
    }
    if (String(code || '').trim() !== p.code) {
      p.attempts++;
      if (p.attempts >= 5) {
        pendingKeyChanges.delete(user.id);
        return socket.emit('superResult', { ok: false, error: 'Too many wrong attempts — request a new code.' });
      }
      return socket.emit('superResult', { ok: false, error: `Wrong code (${5 - p.attempts} tries left).` });
    }
    if (p.which === 'super') settings.superCode = p.newValue;
    else settings.ownerCode = p.newValue;
    saveSettings();
    pendingKeyChanges.delete(user.id);
    socket.emit('superResult', { ok: true, action: 'keyChanged', which: p.which });
  });
  socket.on('superListOwners', ({ token }) => {
    const user = me(token);
    if (!requireSuper(user)) return; // silent deny
    const list = users.filter(u => isOwnerTag(u)).map(u => publicUser(u));
    socket.emit('superResult', { ok: true, action: 'listOwners', users: list });
  });

  /* ----- reseller (can ONLY add coins to users; every grant is logged) ----- */
  socket.on('resellerAddCoins', ({ token, q, amount }) => {
    const user = me(token);
    if (!isReseller(user)) return socket.emit('resellerResult', { ok: false, error: 'Reseller access required.' });
    amount = Math.floor(Number(amount));
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1000000)
      return socket.emit('resellerResult', { ok: false, error: 'Amount must be 1–1,000,000.' });
    const t = findUserQ(q);
    if (!t) return socket.emit('resellerResult', { ok: false, error: 'User not found.' });
    t.coins = (t.coins || 0) + amount;
    saveUsers(); pushUserUpdate(t.id);
    logResellerGrant({ resellerId: user.id, resellerName: user.displayName, targetId: t.id, targetName: t.displayName, amount });
    socket.emit('resellerResult', { ok: true, user: publicUser(t), amount });
  });

  /* ----- games (BEANS only — beans cannot buy gifts) ----- */
  socket.on('dice', ({ token, bet }) => {
    const user = me(token); if (!user) return;
    bet = Math.floor(Number(bet));
    if (!(bet >= 10 && bet <= 100)) return socket.emit('gameResult', { ok: false, error: 'Bet 10–100 beans.' });
    if ((user.beans || 0) < bet) return socket.emit('gameResult', { ok: false, error: 'Not enough beans.' });
    const roll = 1 + Math.floor(Math.random() * 6);
    let payout = 0;
    if (roll === 6) payout = bet * 2; else if (roll >= 4) payout = Math.floor(bet * 1.5);
    user.beans = user.beans - bet + payout;
    saveUsers(); pushUserUpdate(user.id);
    const c = conns.get(socket.id);
    socket.emit('gameResult', { ok: true, game: 'dice', bet, roll, payout, net: payout - bet, beans: user.beans });
    const r = rooms.get(c.roomId);
    if (r) io.to('room:' + r.id).emit('chatMsg', { sys: true, text: `🎲 ${user.displayName} rolled a ${roll} (${payout - bet >= 0 ? '+' : ''}${payout - bet} beans)`, ts: Date.now() });
  });

  socket.on('wheel', ({ token }) => {
    const user = me(token); if (!user) return;
    const COST = 20;
    if ((user.beans || 0) < COST) return socket.emit('gameResult', { ok: false, error: 'Not enough beans (20 needed).' });
    const prizes = [0, 0, 10, 20, 30, 50, 80, 120, 200, 500];
    const prize = prizes[Math.floor(Math.random() * prizes.length)];
    user.beans = user.beans - COST + prize;
    saveUsers(); pushUserUpdate(user.id);
    socket.emit('gameResult', { ok: true, game: 'wheel', cost: COST, prize, beans: user.beans });
  });

  /* ----- WebRTC signaling relay ----- */
  socket.on('signal', ({ token, to, data }) => {
    const user = me(token); if (!user) return;
    if (to && data) io.to(to).emit('signal', { from: socket.id, data });
  });

  socket.on('disconnect', () => {
    const c = conns.get(socket.id);
    if (c && c.userId) {
      const r = rooms.get(c.roomId);
      if (r && c.seat != null && r.seats[c.seat] && r.seats[c.seat].userId === c.userId && r.hostId === c.userId) {
        const next = r.seats.find((s, i) => i > 0 && s) || r.seats[0];
        r.hostId = next ? next.userId : null;
      }
    }
    leaveRoomSocket(socket);
    conns.delete(socket.id);
  });
});

const PORT = process.env.PORT || config.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => console.log(`CoCo-Voice Chat Room v5 running on port ${PORT}`));
