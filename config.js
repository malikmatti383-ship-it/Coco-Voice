// CoCo-Voice Chat Room - configuration
//
// APP_NAME: shown in the app header, HTML title and APK wrapper.
// SUPER_CODE: the DEFAULT hidden top-level code (Super Owner). On first run it is
// copied into data/settings.json; the super can change it at runtime from the
// Super Owner panel — but ONLY after Gmail email verification (see below).
// >>> CHANGE THE DEFAULT "COCO-SUPER-786" and restart the server. <<<
//
// OWNER_CODE: the DEFAULT owner code. On first run it is copied into
// data/settings.json, and the super can change it at runtime from the
// Super Owner panel — again ONLY after Gmail email verification.
// Changing it here afterwards only affects fresh installs.
//
// ---------- Gmail verification for key changes ----------
// When the super changes the SUPER key or the OWNER code, the server emails a
// 6-digit verification code to SUPER_EMAIL. The change applies ONLY after the
// correct code is entered (code expires in 10 minutes).
//
// SETUP (do this BEFORE uploading to GitHub / Render):
//   1. Use a Gmail address you own for SUPER_EMAIL and SMTP_USER below.
//   2. Turn on 2-Step Verification on that Google account
//      (Google Account → Security → 2-Step Verification).
//   3. Create an App Password: Google Account → Security → "App passwords"
//      → name it "CoCo" → Google shows a 16-character password like
//      "abcd efgh ijkl mnop". Put it in SMTP_PASS below (spaces are fine).
//   4. Save this file. Without these, key changes are BLOCKED with an
//      "Email not configured" error (a normal Gmail password will NOT work).
module.exports = {
  APP_NAME: "CoCo-Voice Chat Room",
  PORT: 3000,
  SUPER_CODE: "COCO-SUPER-786",
  OWNER_CODE: "COCO8888",
  STARTING_COINS: 100,
  STARTING_BEANS: 200,
  STARTING_DIAMONDS: 0,
  FIRST_COCO_ID: 100001,

  // --- email verification settings ---
  SUPER_EMAIL: "your-gmail@gmail.com",   // <-- your Gmail (receives the codes)
  SMTP_HOST: "smtp.gmail.com",
  SMTP_PORT: 587,
  SMTP_USER: "your-gmail@gmail.com",     // <-- same Gmail (sends the codes)
  SMTP_PASS: "xxxx xxxx xxxx xxxx"       // <-- Gmail APP password, NOT your login password
};
