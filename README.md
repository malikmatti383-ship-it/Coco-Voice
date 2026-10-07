# 🦜 CoCo-Voice Chat Room

Your own voice-chat party app — like the big apps, but YOU are the boss.
Create voice rooms, send gifts, play games, buy VIP, dress up your avatar,
make couples, run agencies, and control the whole coin economy.

No real money inside the app. Everything is bought with in-app
**coins** 🪙 and **diamonds** 💎 that you (the owner) give out.

---

## ✨ Features

- **Voice rooms** — 9 mic seats, WebRTC voice, text chat, raise hand ✋
- **Room lock + password** 🔒 — private rooms for friends
- **3 currencies** — 🪙 coins (gifts/shop), 💎 diamonds (premium gifts), 🫘 beans (games only)
- **55 gifts** 🎁 — 5 categories (Popular, Lucky, Couple, Relationship, Funny);
  8 🍀 Lucky gifts give the receiver a 10–30% coin bonus; 10 premium gifts cost diamonds
- **VIP 1–8 shop** 👑 — 30 days each; buy for yourself or gift VIP to any user ID
- **Dress-up shop** — 30 avatar frames 🖼 + 25 entry effects ✨ (7/15/30 days)
- **Couples (CP)** 💑 — send a request (99 coins), partner badge on profile,
  special couple-only gifts
- **Agencies** 🏢 — create agencies, add HOST members, agency rooms tab in lobby
- **Roles chain** — Owner → Admin Plus → Manager → BD → Agent → Host (+ Reseller),
  with approval requests and redeem codes
- **Inbox + DMs** 💌 — private messages, unread badges, approval cards inside inbox
- **Owner dashboard** 📊 — stats, user search, coins/diamonds/beans +/-, VIP, tags,
  frames/entries grants, block/unblock, coin sale (logged)
- **Weekly targets** 🎯 — set point goals per role/VIP level, one-tap "Settle Week"
  grants rewards to qualifiers; plus a manual ⭐ Special List
- **Games** 🎲 — dice + lucky wheel (played with beans)
- **Super Owner** 👑 — hidden top tier: grants/revokes OWNER, changes codes
  (key changes protected by Gmail code)
- **Resellers** — can only add coins; every sale logged
- **English / اردو** language switch 🌐

---

## 🚀 Deploy (phone-friendly steps)

You do this **once**. After that, updates = re-upload files, nothing else.

### 1. Get the files on GitHub
1. Download `coco-voice-flat.zip` (it comes with this project).
2. On your phone browser, open **github.com** and log in.
3. Open your `coco-voice` repository → **Add file → Upload files**.
4. Upload **all files from inside the zip** (not the zip itself — extract first).
   If files already exist, uploading overwrites them. That's the update method.
5. Press **Commit changes**.

### 2. Deploy on Render (free)
1. Open **render.com** → **New + → Web Service** → connect your `coco-voice` repo.
2. Settings: **Build Command** `npm install`, **Start Command** `node server.js`.
3. Press **Create Web Service**. Wait 2–3 minutes.
4. Copy your app link, e.g. `https://coco-voice.onrender.com` — that's your app! 🎉

> The APK wrapper just opens your Render link, so APK users get every
> update automatically — no reinstall needed.

### 3. Make the APK (later, when you want it)
1. Deploy first (step 2), then open `android-wrapper/SERVER_URL.txt`
   in the zip and follow the 3-line note inside it (paste your Render link).
2. Build the wrapper as usual — app name is already **CoCo-Voice Chat Room** 🦜.

---

## ⚙️ Setup — `config.js` (do this BEFORE uploading to GitHub)

Open `config.js` in any text editor. Important lines:

```js
APP_NAME: "CoCo-Voice Chat Room",   // leave it
SUPER_CODE: "COCO-SUPER-786",       // ⚠️ CHANGE THIS to your own secret code!
OWNER_CODE: "COCO8888",             // your owner-panel code (change too)
STARTING_COINS: 100,                // new users get this
STARTING_BEANS: 200,                // game beans for new users
```

**Gmail (optional — can be added later):** key changes (super code / owner
code) are protected by a 6-digit code emailed to you. To enable it, fill in:

```js
SUPER_EMAIL: "you@gmail.com",       // where the code is sent
GMAIL_USER: "you@gmail.com",
GMAIL_APP_PASSWORD: "xxxx xxxx xxxx xxxx",  // Gmail → App Password (not your login password!)
```

> How to get an App Password: Google Account → Security → 2-Step Verification
> (turn on) → App passwords → create one for "Mail". Paste the 16-letter code.
> Without this, the app works 100% — only the key-change buttons will say
> "Email not configured". You can add it anytime and re-upload.

---

## 👑 Owner / Super bootstrap (after deploy)

1. Open your app link, **register** your main ID (remember the number, e.g. 100001).
2. Go to **Me → Settings**, scroll to **Super Owner**, enter your `SUPER_CODE`
   from config.js → **Unlock**.
3. Tap **Make Owner**, enter your own ID → you are now OWNER 👑.
4. Go to **Settings → Open Owner Dashboard**, enter your `OWNER_CODE`.
5. Give yourself coins: **Users tab → search your ID → coins +** a big number.
   Done — now buy VIP, frames, gifts, whatever you like. 🎁

> Tip: register a **second secret ID** too, to quietly visit rooms and check
> everything looks right — just like a normal user.

---

## 🧬 Role chain — how promotion works

| Step | Who does it | How |
|---|---|---|
| Owner → **Admin Plus** | Owner | Settings → "Make Admin Plus" → enter ID (instant) |
| Admin Plus → **Manager** | Admin Plus | Settings → "Request Manager" → enter ID → **Owner approves** (Inbox card) |
| Admin Plus → **Reseller** | Admin Plus | Settings → "Request Reseller" → enter ID → **Owner approves** → reseller panel unlocks |
| Manager → **BD** | Manager | Settings → "Generate BD Code" → share the 8-letter code |
| (any user) | User | Settings → "Redeem Code" → paste code → **Manager approves** → BD tag |
| BD → **Agent** | BD | "Generate Agent Code" → user redeems → **BD approves** |
| Agent → **Host** | Agent | "Generate Host Code" → user redeems → **Agent approves** |
| Agency staff | Owner | Dashboard → Agency tab → create agency → add HOST members |

- Owner can also grant/revoke **any** tag instantly (dashboard → Users tab).
- Only the **Super Owner** can grant/revoke the **OWNER** tag.
- Blocked users can't log in or join rooms. Super Owner can't be blocked.

---

## 🎯 Weekly targets — how to run them

1. **Dashboard → Targets tab.**
2. For each role (Admin+, Manager, BD) and each VIP level 1–8, set the
   **points** needed (points = coins value of gifts the user SENT that week).
3. Set the **rewards**: VIP level + days, frame + days, entry + days, coins.
4. **Save targets.**
5. End of week → press **Settle Week**. Everyone who hit their target gets the
   rewards automatically; others get nothing. A summary shows who got what.

**⭐ Special List** (same tab): instant manual reward — enter user ID + VIP +
days + frame/entry + days + coins + a note → applied immediately, and the
entry stays visible in the list.

---

## 🗂 Files in the zip (flat — no folders)

`index.html` `style.css` `app.js` `logo.webp` `server.js` `config.js`
`package.json` `package-lock.json` `render.yaml` `Dockerfile` `.dockerignore`
`README.md` `capacitor.config.json` `SERVER_URL.txt`

User data (accounts, messages, gifts…) is saved automatically in `data/*.json`
on the server — no database needed. To start completely fresh, delete the
`data` folder (it recreates itself).

---

Made with 🦜 for CoCo-Voice Chat Room.
