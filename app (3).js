/* CoCo-Voice Chat Room v5 - client */
const SERVER_URL = (typeof window.COCO_SERVER_URL === 'string' && window.COCO_SERVER_URL.trim())
  ? window.COCO_SERVER_URL.trim().replace(/\/+$/, '')
  : null;
const socket = SERVER_URL ? io(SERVER_URL) : io();
const $ = id => document.getElementById(id);

const VIP_NAMES = ['No VIP','VIP 1 · Bronze','VIP 2 · Silver','VIP 3 · Gold','VIP 4 · Platinum','VIP 5 · Diamond','VIP 6 · Ruby','VIP 7 · Star','VIP 8 · Supreme'];
const AVATARS = ['🙂','😎','🤩','😺','🐼','🦁','🐯','🐸','🦊','🐰','👽','🤖','👻','🎃','🌟','🔥','💎','👑','🎧','🎤'];
const GIFT_CATS = [['popular','🎉'],['lucky','🍀'],['couple','💑'],['relationship','🤝'],['funny','😂'],['premium','💎']];

let token = localStorage.getItem('coco_token') || null;
let me = null;
let CATALOG = { gifts: [], vipPrices: {}, vipDays: 30, frames: [], entries: [] };
let currentRoom = null, mySeat = null, myMuted = false, handRaised = false;
let allRooms = [], lobbyTab = 'all';
let giftCat = 'popular', giftTargetPreset = null;
let storeTab = 'vip', profileTab = 'dress', dashTab = 'stats';
let viewingUser = null; // userCard being viewed
let threadOther = null;
let dressDays = { frame: 7, entry: 7 };
let agenciesCache = [];

/* ================= i18n ================= */
const I18N = {
en:{
  tagline:'Talk • Play • Gift • Shine', login:'Login', register:'Register',
  usernamePh:'Username (3-20 letters/numbers)', passwordPh:'Password (4+ characters)',
  registerGet:'Register & Get 100 🪙 + 200 🫘',
  hint:'New here? Register and get <b>100 coins + 200 beans</b> 🎉',
  searchRooms:'🔍 Search rooms...', createRoom:'+ Create Room', all:'All', agency:'Agency',
  home:'Home', store:'Store', inbox:'Inbox', me:'Me',
  saySomething:'Say something...', send:'Send', sendGift:'Send a Gift 🎁', to:'To:', close:'Close',
  games:'🎮 Games', beansOnly:'Games use beans only', diceRoll:'Dice Roll', betRangeBeans:'bet 10–100 beans',
  roll:'Roll', luckyWheel:'Lucky Wheel', costs20beans:'costs 20 beans', spin:'Spin',
  myProfile:'My Profile', cocoId:'CoCo ID', coins:'Coins', diamonds:'Diamonds', beans:'Beans',
  follow:'Follow', fans:'Fans', sent:'Sent', received:'Receive',
  dress:'Dress', medals:'Medals', relationship:'Relation', gifts:'Gifts', edit:'Edit',
  displayName:'Display name', avatar:'Avatar', save:'Save', logout:'Logout',
  settings:'Settings', language:'Language', redeemCode:'Redeem Code',
  redeemDesc:'Got a BD / Agent / Host code? Paste it here.', codePh:'Enter code', redeem:'Redeem',
  userIdPh:'User CoCo ID', reqManager:'Request Manager', reqReseller:'Request Reseller',
  genBdCode:'Generate BD Code', genAgentCode:'Generate Agent Code', genHostCode:'Generate Host Code',
  openDashboard:'Open Owner Dashboard', resellerPanel:'💰 Reseller Panel',
  resellerDesc:"Sell coins: add coins to any user's account. Every sale is recorded in the reseller log.",
  buyerPh:"Buyer's CoCo ID or username", coinsPh:'Coins to add', addCoins:'Add Coins 💰',
  ownerPanel:'Owner Panel', enterOwnerCode:'Enter the', ownerCode:'owner code', toUnlock:'to unlock:',
  unlock:'Unlock', ownerCodePh:'Owner code', noRooms:'No rooms yet — create one! 🎉', noAgencyRooms:'No agency rooms yet.',
  superOwner:'👑 Super Owner', superCodePh:'Super code', superQPh:'CoCo ID or username',
  superSetupD:'First-time setup: unlock with the super code, then grant yourself the Owner tag.',
  superUnlockBtn:'Super Unlock', superLockD:'Enter the super code to unlock owner setup.',
  makeOwnerT:'Make yourself Owner', makeOwnerD:'Enter your CoCo ID or username, then tap the button.',
  ownerGranted:'✅ You are now the Owner! Go back to Settings → Open Owner Dashboard.',
  makeOwner:'Make Owner', removeOwner:'Remove Owner', changeOwnerCode:'Change owner code',
  changeSuperKey:'Change Super Key', newCodePh:'New owner code (4-32 chars)', newSuperKeyPh:'New super key (4-32 chars)',
  listOwners:'List owners', sendCodeEmail:'📧 Send code to Gmail', verifyCodePh:'6-digit code from Gmail',
  verifyAndChange:'Verify & Change', sendingCode:'Sending code to Gmail…',
  codeSent:'✅ Code sent to your Gmail (expires in 10 min).', keyChangedOk:'Key changed successfully ✅',
  idLabel:'ID: ', welcome:'Welcome', langBtn:'🌐 اردو',
  overview:'📊 Overview', users:'👥 Users', targets:'🎯 Targets', newChat:'+ New',
  totalUsers:'Total users', coinsCirc:'Coins in circulation', diaCirc:'Diamonds', beansCirc:'Beans',
  giftsToday:'Gifts sent today', activeRooms:'Active rooms', searchUserPh:'Search by CoCo ID or username', search:'Search',
  block:'Block', unblock:'Unblock', grantTag:'Grant tag', revoke:'Revoke', setVip:'Set VIP', vipDaysPh:'VIP days (0 = forever)',
  adjustCoins:'Coins +/-', adjustDia:'Diamonds +/-', adjustBeans:'Beans +/-', apply:'Apply',
  grantDress:'Grant dress item', daysPh:'Days', sellCoins:'Sell coins (logged)', amountPh:'Amount',
  weeklyTargets:'Weekly Targets', pointsPh:'Points target', rewards:'Rewards', saveTargets:'Save Targets',
  settleWeek:'⚖️ Settle Week', specialList:'⭐ Special List', specialIdPh:'User CoCo ID', notePh:'Note (optional)',
  addSpecial:'Add & Apply Now', createAgency:'Create Agency', agencyNamePh:'Agency name', addMember:'Add member',
  memberIdPh:'Member CoCo ID (must have HOST tag)', remove:'Remove', members:'Members',
  buyVip:'Buy VIP', giftVip:'Gift VIP', toUserPh:'To user CoCo ID', levelPh:'VIP level 1-8',
  frames:'🖼 Frames', entries:'✨ Entries', buy:'Buy', activate:'Activate', active:'Active', owned:'Owned',
  remainingDays:'left', notOwned:'Not owned', expires:'Expires', vipExpires:'VIP expires',
  coupleRequest:'💑 Send Couple Request (99 🪙)', coupleBreak:'💔 Break Up', pendingReq:'Pending request…',
  myPartner:'💑 Partner', noPartner:'No partner yet', accept:'Accept', decline:'Decline', approve:'Approve', reject:'Reject',
  coupleOnlyErr:'Couple gifts can only be sent to your partner 💑',
  viewProfile:'👤 View profile', sendMessage:'✉️ Message', followBtn:'Follow', unfollowBtn:'Unfollow',
  typeMsgPh:'Type user ID or username', startChat:'Start chat',
  agencyRoom:'Agency room', selectAgency:'Agency (optional)', noAgency:'— No agency —',
  roomNamePh:'Room name', roomPwPh:'Room password (empty = public)',
  medalsFor:'Your medals', noMedals:'No medals yet — play, gift and shine!',
  giftWall:'🎁 Gift wall', noGifts:'No gifts received yet.',
  luckyBonus:'🍀 Lucky', entryEffect:'Entry effect',
  reqSent:'Request sent ✅', codeCopied:'Code copied — share it with the user',
  settleDone:'Week settled', grantedTo:'granted to', skipped:'did not qualify',
  confirmBlock:'Block this user?', confirmUnblock:'Unblock this user?', confirmBreak:'Break up with your partner?',
  confirmKick:'Kick', needLogin:'Please log in first.',
  dmSent:'Message sent', profileSaved:'Profile saved ✅', coinsAdded:'Coins updated ✅',
},
ur:{
  tagline:'بات کریں • کھیلیں • تحفے بھیجیں • چمکیں', login:'لاگ اِن', register:'رجسٹر',
  usernamePh:'یوزرنیم (3-20 حروف)', passwordPh:'پاس ورڈ (4+ حروف)',
  registerGet:'رجسٹر کریں اور 100 🪙 + 200 🫘 پائیں',
  hint:'نئے ہیں؟ رجسٹر کریں اور <b>100 کوائنز + 200 بینز</b> 🎉 پائیں',
  searchRooms:'🔍 روم تلاش کریں...', createRoom:'+ روم بنائیں', all:'سب', agency:'ایجنسی',
  home:'ہوم', store:'اسٹور', inbox:'ان باکس', me:'میں',
  saySomething:'کچھ کہیں...', send:'بھیجیں', sendGift:'تحفہ بھیجیں 🎁', to:'وصول کنندہ:', close:'بند کریں',
  games:'🎮 گیمز', beansOnly:'گیمز میں صرف بینز استعمال ہوتے ہیں', diceRoll:'ڈائس رول', betRangeBeans:'شرط 10–100 بینز',
  roll:'رول کریں', luckyWheel:'خوش قسمت پہیہ', costs20beans:'قیمت 20 بینز', spin:'گھمائیں',
  myProfile:'میری پروفائل', cocoId:'کوکو آئی ڈی', coins:'کوائنز', diamonds:'ڈائمنڈز', beans:'بینز',
  follow:'فالو', fans:'فینز', sent:'بھیجے', received:'موصول',
  dress:'ڈریس', medals:'میڈلز', relationship:'رشتہ', gifts:'تحفے', edit:'ترمیم',
  displayName:'نام', avatar:'اواتار', save:'محفوظ کریں', logout:'لاگ آؤٹ',
  settings:'سیٹنگز', language:'زبان', redeemCode:'کوڈ استعمال کریں',
  redeemDesc:'BD / ایجنٹ / ہوسٹ کوڈ ملا ہے؟ یہاں لکھیں۔', codePh:'کوڈ لکھیں', redeem:'استعمال کریں',
  userIdPh:'یوزر کی کوکو آئی ڈی', reqManager:'مینیجر کی درخواست', reqReseller:'ری سیلر کی درخواست',
  genBdCode:'BD کوڈ بنائیں', genAgentCode:'ایجنٹ کوڈ بنائیں', genHostCode:'ہوسٹ کوڈ بنائیں',
  openDashboard:'اوونر ڈیش بورڈ کھولیں', resellerPanel:'💰 ری سیلر پینل',
  resellerDesc:'کوائنز بیچیں: کسی بھی یوزر کے اکاؤنٹ میں کوائنز شامل کریں۔ ہر فروخت لاگ میں ریکارڈ ہوگی۔',
  buyerPh:'خریدار کی کوکو آئی ڈی یا یوزرنیم', coinsPh:'شامل کرنے کے لیے کوائنز', addCoins:'کوائنز شامل کریں 💰',
  ownerPanel:'اوونر پینل', enterOwnerCode:'ان لاک کرنے کے لیے', ownerCode:'اوونر کوڈ', toUnlock:'درج کریں:',
  unlock:'ان لاک کریں', ownerCodePh:'اوونر کوڈ', noRooms:'ابھی کوئی روم نہیں — ایک بنائیں! 🎉', noAgencyRooms:'ابھی کوئی ایجنسی روم نہیں۔',
  superOwner:'👑 سپر اوونر', superCodePh:'سپر کوڈ', superQPh:'کوکو آئی ڈی یا یوزرنیم',
  superSetupD:'پہلی بار سیٹ اپ: سپر کوڈ سے ان لاک کریں، پھر خود کو اوونر ٹیگ دیں۔',
  superUnlockBtn:'سپر ان لاک', superLockD:'اوونر سیٹ اپ ان لاک کرنے کے لیے سپر کوڈ درج کریں۔',
  makeOwnerT:'خود کو اوونر بنائیں', makeOwnerD:'اپنی کوکو آئی ڈی یا یوزرنیم لکھیں، پھر بٹن دبائیں۔',
  ownerGranted:'✅ اب آپ اوونر ہیں! واپس سیٹنگز میں جا کر اوونر ڈیش بورڈ کھولیں۔',
  makeOwner:'اوونر بنائیں', removeOwner:'اوونر ہٹائیں', changeOwnerCode:'اوونر کوڈ بدلیں',
  changeSuperKey:'سپر کی بدلیں', newCodePh:'نیا اوونر کوڈ (4-32 حروف)', newSuperKeyPh:'نیا سپر کی (4-32 حروف)',
  listOwners:'اوونرز کی فہرست', sendCodeEmail:'📧 جی میل پر کوڈ بھیجیں', verifyCodePh:'جی میل سے 6 ہندسوں کا کوڈ',
  verifyAndChange:'تصدیق کریں اور بدلیں', sendingCode:'جی میل پر کوڈ بھیجا جا رہا ہے…',
  codeSent:'✅ کوڈ آپ کے جی میل پر بھیج دیا گیا (10 منٹ میں ختم)۔', keyChangedOk:'کی کامیابی سے بدل گئی ✅',
  idLabel:'آئی ڈی: ', welcome:'خوش آمدید', langBtn:'🌐 English',
  overview:'📊 جائزہ', users:'👥 یوزرز', targets:'🎯 ٹارگٹس', newChat:'+ نیا',
  totalUsers:'کل یوزرز', coinsCirc:'گردش میں کوائنز', diaCirc:'ڈائمنڈز', beansCirc:'بینز',
  giftsToday:'آج بھیجے گئے تحفے', activeRooms:'فعال رومز', searchUserPh:'کوکو آئی ڈی یا یوزرنیم سے تلاش کریں', search:'تلاش کریں',
  block:'بلاک کریں', unblock:'ان بلاک کریں', grantTag:'ٹیگ دیں', revoke:'ہٹائیں', setVip:'VIP سیٹ کریں', vipDaysPh:'VIP دن (0 = ہمیشہ)',
  adjustCoins:'کوائنز +/-', adjustDia:'ڈائمنڈز +/-', adjustBeans:'بینز +/-', apply:'لاگو کریں',
  grantDress:'ڈریس آئٹم دیں', daysPh:'دن', sellCoins:'کوائنز بیچیں (لاگ ہوگا)', amountPh:'رقم',
  weeklyTargets:'ہفتہ وار ٹارگٹس', pointsPh:'پوائنٹس ٹارگٹ', rewards:'انعامات', saveTargets:'ٹارگٹس محفوظ کریں',
  settleWeek:'⚖️ ہفتہ ختم کریں', specialList:'⭐ خصوصی فہرست', specialIdPh:'یوزر کی کوکو آئی ڈی', notePh:'نوٹ (اختیاری)',
  addSpecial:'شامل کریں اور ابھی لاگو کریں', createAgency:'ایجنسی بنائیں', agencyNamePh:'ایجنسی کا نام', addMember:'ممبر شامل کریں',
  memberIdPh:'ممبر کی کوکو آئی ڈی (HOST ٹیگ ضروری)', remove:'ہٹائیں', members:'ممبرز',
  buyVip:'VIP خریدیں', giftVip:'VIP تحفہ دیں', toUserPh:'وصول کنندہ کی کوکو آئی ڈی', levelPh:'VIP لیول 1-8',
  frames:'🖼 فریمز', entries:'✨ انٹریز', buy:'خریدیں', activate:'فعال کریں', active:'فعال', owned:'موجود',
  remainingDays:'باقی', notOwned:'موجود نہیں', expires:'ختم', vipExpires:'VIP ختم',
  coupleRequest:'💑 کپل درخواست بھیجیں (99 🪙)', coupleBreak:'💔 رشتہ ختم کریں', pendingReq:'درخواست زیر التواء…',
  myPartner:'💑 پارٹنر', noPartner:'ابھی کوئی پارٹنر نہیں', accept:'قبول کریں', decline:'رد کریں', approve:'منظور کریں', reject:'مسترد کریں',
  coupleOnlyErr:'کپل تحفے صرف پارٹنر کو بھیجے جا سکتے ہیں 💑',
  viewProfile:'👤 پروفائل دیکھیں', sendMessage:'✉️ پیغام', followBtn:'فالو کریں', unfollowBtn:'ان فالو',
  typeMsgPh:'یوزر آئی ڈی یا یوزرنیم لکھیں', startChat:'چیٹ شروع کریں',
  agencyRoom:'ایجنسی روم', selectAgency:'ایجنسی (اختیاری)', noAgency:'— کوئی ایجنسی نہیں —',
  roomNamePh:'روم کا نام', roomPwPh:'روم پاس ورڈ (خالی = پبلک)',
  medalsFor:'آپ کے میڈلز', noMedals:'ابھی کوئی میڈل نہیں — کھیلیں، تحفے بھیجیں اور چمکیں!',
  giftWall:'🎁 تحفوں کی دیوار', noGifts:'ابھی کوئی تحفہ موصول نہیں ہوا۔',
  luckyBonus:'🍀 خوش قسمت', entryEffect:'انٹری ایفیکٹ',
  reqSent:'درخواست بھیج دی گئی ✅', codeCopied:'کوڈ کاپی ہو گیا — یوزر کو بھیجیں',
  settleDone:'ہفتہ ختم ہو گیا', grantedTo:'کو ملا', skipped:'اہل نہیں ہوئے',
  confirmBlock:'اس یوزر کو بلاک کریں؟', confirmUnblock:'اس یوزر کو ان بلاک کریں؟', confirmBreak:'پارٹنر سے رشتہ ختم کریں؟',
  confirmKick:'نکالیں', needLogin:'پہلے لاگ اِن کریں۔',
  dmSent:'پیغام بھیج دیا گیا', profileSaved:'پروفائل محفوظ ہو گئی ✅', coinsAdded:'کوائنز اپڈیٹ ہو گئے ✅',
}};
let lang = localStorage.getItem('coco_lang') || 'en';
function t(k){ return (I18N[lang] && I18N[lang][k]) || I18N.en[k] || k; }
function setLang(l){
  lang = (l==='ur') ? 'ur' : 'en';
  localStorage.setItem('coco_lang', lang);
  document.documentElement.lang = (lang==='ur') ? 'ur' : 'en';
  document.documentElement.dir = (lang==='ur') ? 'rtl' : 'ltr';
  document.querySelectorAll('[data-i18n]').forEach(el=>{
    if(el.id==='auth-btn') return;
    el.innerHTML = t(el.getAttribute('data-i18n'));
  });
  document.querySelectorAll('[data-i18n-ph]').forEach(el=>{ el.placeholder = t(el.getAttribute('data-i18n-ph')); });
  $('auth-btn').textContent = (authMode==='register') ? t('registerGet') : t('login');
  $('btn-lang').textContent = t('langBtn');
  if(me) $('me-id').textContent = t('idLabel') + me.id;
  renderLobbyTabs();
}
function cycleLang(){ setLang(lang==='ur' ? 'en' : 'ur'); }

/* ================= helpers ================= */
function showView(id){ document.querySelectorAll('.view').forEach(v=>v.classList.remove('active')); $(id).classList.add('active'); window.scrollTo(0,0); }
function toast(msg){ const el=$('toast'); el.textContent=msg; el.classList.remove('hidden'); clearTimeout(el._h); el._h=setTimeout(()=>el.classList.add('hidden'),2800); }
function esc(s){ return String(s||'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function vipClass(v){ return v>0 ? 'vipn'+Math.min(8,v) : ''; }
function nameHtml(u){ if(!u) return ''; return `<span class="${vipClass(u.vip)}">${u.vip>0?'👑 ':''}${esc(u.displayName)}</span>`; }
function tagsHtml(tags){
  const names = {ADMIN_PLUS:'ADMIN+', MANAGER:'MANAGER', BD:'BD', AGENT:'AGENT', RESELLER:'RESELLER', HOST:'HOST', OWNER:'OWNER'};
  return (tags||[]).map(x=>`<span class="tag tag-${x}">${names[x]||x}</span>`).join('');
}
function vipBadgeHtml(v, expires){
  if(!v) return '';
  let s = `<span class="vip-badge ${vipClass(v)}" style="border:1px solid currentColor">${VIP_NAMES[v]}</span>`;
  if(expires) s += `<div class="sub">${t('vipExpires')}: ${new Date(expires).toLocaleDateString()}</div>`;
  return s;
}
function frameClass(u){ return u && u.frame ? 'fr-'+u.frame : ''; }
function daysLeft(ts){ return Math.max(0, Math.ceil((ts - Date.now())/864e5)); }
function fmt(n){ return Number(n||0).toLocaleString('en-US'); }
function hasTag(tag){ return me && Array.isArray(me.tags) && me.tags.includes(tag); }

/* ================= auth ================= */
let authMode='login';
$('tab-login').onclick=()=>{authMode='login';$('tab-login').classList.add('active');$('tab-register').classList.remove('active');$('auth-btn').textContent=t('login');};
$('tab-register').onclick=()=>{authMode='register';$('tab-register').classList.add('active');$('tab-login').classList.remove('active');$('auth-btn').textContent=t('registerGet');};
$('auth-btn').onclick=()=>{
  const u=$('auth-username').value.trim(), p=$('auth-password').value;
  $('auth-error').textContent='';
  socket.emit(authMode, {username:u, password:p});
};
socket.on('catalog', c=>{ CATALOG=c; });
socket.on('auth', d=>{
  if(!d.ok){
    if(d.sessionExpired){ token=null; localStorage.removeItem('coco_token'); $('auth-error').textContent=''; return; }
    $('auth-error').textContent = d.error||'Failed'; return;
  }
  token=d.token; localStorage.setItem('coco_token',token); me=d.user;
  renderMe(); showView('view-lobby'); socket.emit('listRooms');
  if(!d.resumed) toast(t('welcome')+', '+me.displayName+'! 🎉');
});
socket.on('userUpdate', u=>{ me=u; renderMe(); renderStoreChips(); if($('view-profile').classList.contains('active') && !viewingUser) renderProfile(); });
function renderMe(){
  if(!me) return;
  $('me-avatar').textContent=me.avatar||'🙂';
  $('me-name').innerHTML=nameHtml(me);
  $('me-id').textContent=t('idLabel')+me.id;
  $('me-coins').textContent=fmt(me.coins);
  $('me-beans').textContent=fmt(me.beans);
}
function renderStoreChips(){ if(!me) return; $('store-coins').textContent=fmt(me.coins); $('store-diamonds').textContent=fmt(me.diamonds); }
function logout(){ socket.emit('logout',{token}); token=null; localStorage.removeItem('coco_token'); me=null; showView('view-auth'); }
$('btn-logout').onclick=logout;

/* ================= bottom nav ================= */
function goLobby(){ showView('view-lobby'); socket.emit('listRooms'); }
function goStore(){ renderStoreChips(); renderStore(); showView('view-store'); }
function goInbox(){ socket.emit('listInbox',{token}); showView('view-inbox'); }
function goMe(){ viewingUser=null; renderProfile(); showView('view-profile'); }
for (const [id,fn] of [['nav-lobby',goLobby],['nav2-lobby',goLobby],['nav3-lobby',goLobby],['nav4-lobby',goLobby],
  ['nav-store',goStore],['nav2-store',goStore],['nav3-store',goStore],['nav4-store',goStore],
  ['nav-inbox',goInbox],['nav2-inbox',goInbox],['nav3-inbox',goInbox],['nav4-inbox',goInbox],
  ['nav-me',goMe],['nav2-me',goMe],['nav3-me',goMe],['nav4-me',goMe]]) $(id).onclick=fn;
$('btn-store-back').onclick=goLobby; $('btn-inbox-back').onclick=goLobby; $('btn-profile-back').onclick=goLobby;
$('btn-settings').onclick=()=>{ renderSettings(); showView('view-settings'); };
$('btn-settings-back').onclick=goMe;
$('btn-lang').onclick=cycleLang; $('btn-lang3').onclick=cycleLang;

/* ================= lobby ================= */
$('lobby-tab-all').onclick=()=>{ lobbyTab='all'; renderLobbyTabs(); filterRooms(); };
$('lobby-tab-agency').onclick=()=>{ lobbyTab='agency'; renderLobbyTabs(); filterRooms(); };
function renderLobbyTabs(){
  $('lobby-tab-all').classList.toggle('active', lobbyTab==='all');
  $('lobby-tab-agency').classList.toggle('active', lobbyTab==='agency');
  $('lobby-tab-all').textContent=t('all'); $('lobby-tab-agency').textContent=t('agency');
}
$('room-search').oninput=()=>filterRooms();
socket.on('rooms', list=>{ allRooms=list; filterRooms(); });
function filterRooms(){
  const q=($('room-search').value||'').toLowerCase();
  let list=allRooms.filter(r=>r.name.toLowerCase().includes(q));
  if(lobbyTab==='agency') list=list.filter(r=>r.agencyId);
  $('room-list').innerHTML = list.length ? list.map(r=>`
    <div class="room-item" data-id="${r.id}">
      <div style="font-size:30px">🎙️</div>
      <div class="info"><div class="rname">${esc(r.name)} ${r.locked?'🔒':''}</div>
      <div class="rmeta">Host: ${esc(r.host)} · ${r.online} online</div>
      ${r.agencyId?`<span class="room-ag">🏢 ${esc(r.agencyName)}</span>`:''}</div>
      <div class="sub">➤</div>
    </div>`).join('')
    : `<p class="sub" style="text-align:center;padding:20px">${lobbyTab==='agency'?t('noAgencyRooms'):t('noRooms')}</p>`;
  document.querySelectorAll('.room-item').forEach(el=>el.onclick=()=>joinRoom(el.dataset.id));
}
$('btn-create-room').onclick=()=>{
  socket.emit('listAgencies',{token});
  const name=prompt(t('roomNamePh'),'My Voice Room'); if(name===null) return;
  const pw=prompt(t('roomPwPh'),'')||'';
  let agencyId=null;
  if(agenciesCache.length){
    const names=agenciesCache.map((a,i)=>`${i+1}. ${a.name}`).join('\n');
    const pick=prompt(t('selectAgency')+':\n0. '+t('noAgency')+'\n'+names,'0');
    const n=Number(pick);
    if(n>=1 && n<=agenciesCache.length) agencyId=agenciesCache[n-1].id;
  }
  socket.emit('createRoom',{token,name,password:pw,agencyId});
};
socket.on('agencyList', list=>{ agenciesCache=list; });
function joinRoom(id){
  const r=allRooms.find(x=>x.id==id);
  let pw='';
  if(r && r.locked){ pw=prompt('🔒','')||''; }
  socket.emit('joinRoom',{token,roomId:id,password:pw});
}
socket.on('roomError', m=>toast(m));
socket.on('roomJoined', state=>enterRoom(state));
socket.on('roomState', state=>{ if(currentRoom && state.id===currentRoom.id){ currentRoom=state; renderRoom(); } });
socket.on('roomLeft', ()=>{ closeAllPeers(); currentRoom=null; mySeat=null; goLobby(); });
socket.on('kicked', ()=>toast('Kicked by host'));
$('btn-leave-room').onclick=()=>socket.emit('leaveRoom');

/* ================= room ================= */
function enterRoom(state){
  currentRoom=state; mySeat=null; handRaised=false;
  showView('view-room'); renderRoom(); $('chat-box').innerHTML='';
  state.chat.forEach(addChatMsg);
}
function seatAvatar(s){
  const fr = s.user.frame ? `fr-${s.user.frame}` : '';
  return `<div class="frame-wrap ${fr}"><div class="s-avatar">${esc(s.user.avatar)}</div></div>`;
}
function renderRoom(){
  const r=currentRoom; if(!r) return;
  $('room-name').textContent=r.name+(r.locked?' 🔒':'')+(r.agencyName?` · 🏢${r.agencyName}`:'');
  const online=r.seats.filter(Boolean).length;
  $('room-online').textContent=online+' on mic';
  const amHost = me && r.hostId===me.id;
  $('btn-lock').classList.toggle('hidden',!amHost);
  $('btn-lock').textContent=r.locked?'🔒':'🔓';
  $('seats').innerHTML=r.seats.map((s,i)=>{
    if(!s) return `<div class="seat empty" data-seat="${i}"><div class="s-avatar">➕</div><div class="sub">${i===0?'HOST':'Mic '+i}</div></div>`;
    const isMe = me && s.userId===me.id;
    return `<div class="seat ${i===0?'host':''}" data-seat="${i}">
      ${s.muted?'<div class="s-muted">🔇</div>':''}
      ${s.hand?'<div class="s-hand">✋</div>':''}
      ${seatAvatar(s)}
      <div class="s-name ${vipClass(s.user.vip)}">${s.user.vip>0?'👑 ':''}${esc(s.user.displayName)}</div>
      <div class="s-role">${i===0?'HOST':(isMe?'YOU':'')}</div>
      ${s.user.coupleWith?'<div class="sub">💑</div>':''}
      ${tagsHtml(s.user.tags)}
    </div>`;
  }).join('');
  document.querySelectorAll('.seat').forEach(el=>el.onclick=()=>onSeatClick(Number(el.dataset.seat)));
  mySeat=null;
  r.seats.forEach((s,i)=>{ if(s&&me&&s.userId===me.id) mySeat=i; });
  $('btn-mic').classList.toggle('muted',myMuted);
  $('btn-hand').classList.toggle('on',handRaised);
  $('btn-leave-seat').classList.toggle('hidden',mySeat===null);
  $('gift-target').innerHTML=r.seats.filter(s=>s&&me&&s.userId!==me.id)
    .map(s=>`<option value="${s.userId}" ${giftTargetPreset==s.userId?'selected':''}>${esc(s.user.displayName)} (VIP ${s.user.vip})</option>`).join('')
    || '<option value="">—</option>';
  giftTargetPreset=null;
}
async function onSeatClick(i){
  const r=currentRoom; if(!r||!me) return;
  const s=r.seats[i];
  if(!s){
    const ok=await ensureMic();
    socket.emit('takeSeat',{token,seat:i});
    if(ok) toast(i===0?'🎙️ Hosting!':'🎤 Mic joined!');
    return;
  }
  const isMe=s.userId===me.id;
  const amHost=r.hostId===me.id;
  if(amHost && !isMe){
    const a=prompt(`${s.user.displayName}: mute / unmute / kick / profile`,'mute');
    if(a==='mute') socket.emit('hostMute',{token,seat:i,muted:true});
    else if(a==='unmute') socket.emit('hostMute',{token,seat:i,muted:false});
    else if(a==='kick') socket.emit('hostKick',{token,seat:i});
    else if(a==='profile') openUserSheet(s.userId);
  } else if(isMe){
    if(confirm('Leave seat?')) socket.emit('leaveSeat',{token});
  } else openUserSheet(s.userId);
}
function openUserSheet(userId){
  socket.emit('viewUser',{token,userId});
}
socket.on('userCard', d=>{
  if(!d.ok) return;
  const u=d.user;
  $('user-sheet-body').innerHTML=`
    <div style="text-align:center">
      <div class="frame-wrap ${u.frame?'fr-'+u.frame:''}"><div class="avatar big">${esc(u.avatar)}</div></div>
      <h3 class="${vipClass(u.vip)}">${esc(u.displayName)}</h3>
      <div class="sub">ID ${u.id} · @${esc(u.username)}</div>
      <div>${tagsHtml(u.tags)}</div>
      <div>${vipBadgeHtml(u.vip)}</div>
      <div class="sub">👥 ${u.followers} fans · 🎁 ${u.receivedCount} received</div>
      <div style="display:flex;gap:8px;justify-content:center;margin-top:10px;flex-wrap:wrap">
        <button class="btn small" id="us-follow">${u.isFollowing?t('unfollowBtn'):t('followBtn')}</button>
        <button class="btn small" id="us-gift">🎁 ${t('sendGift').split(' ')[0]||'Gift'}</button>
        <button class="btn small" id="us-msg">✉️ ${t('sendMessage')}</button>
      </div>
    </div>`;
  $('user-sheet').classList.remove('hidden');
  $('us-follow').onclick=()=>{ socket.emit('follow',{token,userId:u.id}); };
  $('us-gift').onclick=()=>{ $('user-sheet').classList.add('hidden'); giftTargetPreset=u.id; openGiftPanel(); };
  $('us-msg').onclick=()=>{ $('user-sheet').classList.add('hidden'); openThread(u.id, u.displayName); };
});
socket.on('followResult', d=>{ if(d.ok){ toast(d.following?'Followed ✅':'Unfollowed'); openUserSheet(d.user.id); } });
$('user-sheet-close').onclick=()=>$('user-sheet').classList.add('hidden');

$('btn-mic').onclick=async()=>{
  if(mySeat===null){ toast('Join a mic seat first (tap +)'); return; }
  myMuted=!myMuted; applyMicMute();
  socket.emit('setMuted',{token,muted:myMuted});
  toast(myMuted?'🔇 Muted':'🎤 Unmuted');
};
$('btn-hand').onclick=()=>{
  handRaised=!handRaised;
  socket.emit('raiseHand',{token,raised:handRaised});
};
$('btn-leave-seat').onclick=()=>socket.emit('leaveSeat',{token});
$('btn-lock').onclick=()=>{
  const r=currentRoom; if(!r) return;
  if(r.locked) socket.emit('lockRoom',{token,locked:false});
  else{ const pw=prompt(t('roomPwPh'),'')||''; socket.emit('lockRoom',{token,locked:true,password:pw}); }
};
socket.on('forceMute', d=>{ myMuted=!!d.muted; applyMicMute(); renderRoom(); });

/* chat */
function addChatMsg(m){
  const box=$('chat-box');
  const div=document.createElement('div');
  if(m.sys){ div.className='chat-msg sys'; div.textContent=m.text; }
  else{ div.className='chat-msg'; div.innerHTML=`<span class="bubble"><span class="cn ${vipClass(m.user.vip)}">${esc(m.user.displayName)}</span>: ${esc(m.text)}</span>`; }
  box.appendChild(div); box.scrollTop=box.scrollHeight;
}
socket.on('chatMsg', addChatMsg);
function sendChat(){ const v=$('chat-input').value.trim(); if(!v) return; socket.emit('chat',{token,text:v}); $('chat-input').value=''; }
$('btn-send-chat').onclick=sendChat;
$('chat-input').onkeydown=e=>{ if(e.key==='Enter') sendChat(); };

/* vip + entry banners */
socket.on('vipBanner', d=>{
  const b=$('vip-banner'); b.textContent=d.text; b.classList.remove('hidden');
  clearTimeout(b._h); b._h=setTimeout(()=>b.classList.add('hidden'),5000);
});
socket.on('entryEffect', d=>{
  const b=$('entry-banner');
  b.className='entry-banner en-'+d.entry.id;
  b.innerHTML=`✨ ${esc(d.entry.name)} — <b>${esc(d.user.displayName)}</b> entered! ✨`;
  b.classList.remove('hidden');
  clearTimeout(b._h); b._h=setTimeout(()=>b.classList.add('hidden'),4000);
});

/* gifts */
function openGiftPanel(){
  renderGiftTabs();
  renderGiftCatalog();
  $('gift-panel').classList.remove('hidden');
}
$('btn-room-gifts').onclick=openGiftPanel;
$('gift-close').onclick=()=>$('gift-panel').classList.add('hidden');
function renderGiftTabs(){
  $('gift-tabs').innerHTML=GIFT_CATS.map(([c,emoji])=>{
    const label={popular:'🎉 Popular',lucky:'🍀 Lucky',couple:'💑 Couple',relationship:'🤝 Relation',funny:'😂 Funny',premium:'💎 Premium'}[c];
    return `<button class="gtab ${giftCat===c?'active':''}" data-c="${c}">${label}</button>`;
  }).join('');
  document.querySelectorAll('.gtab').forEach(b=>b.onclick=()=>{ giftCat=b.dataset.c; renderGiftTabs(); renderGiftCatalog(); });
}
function renderGiftCatalog(){
  const list=CATALOG.gifts.filter(g=>g.cat===giftCat);
  $('gift-catalog').innerHTML=list.map(g=>`
    <div class="gift" data-id="${g.id}">
      <div class="g-emoji">${g.emoji}</div><div>${esc(g.name)}</div>
      <div class="g-price ${g.currency==='diamond'?'dia':''}">${g.currency==='diamond'?'💎':'🪙'} ${fmt(g.price)}${g.lucky?' 🍀':''}</div>
    </div>`).join('') || '<p class="sub">—</p>';
  document.querySelectorAll('.gift').forEach(el=>el.onclick=()=>{
    const to=$('gift-target').value;
    if(!to){ toast('No one to send to'); return; }
    socket.emit('sendGift',{token,toUserId:Number(to),giftId:el.dataset.id});
  });
}
socket.on('giftError', m=>toast(m));
socket.on('giftEvent', d=>{
  const layer=$('gift-layer');
  const el=document.createElement('div'); el.className='fly-gift'; el.textContent=d.gift.emoji;
  el.style.left=(20+Math.random()*50)+'%';
  layer.appendChild(el); setTimeout(()=>el.remove(),2700);
  let msg=`${d.from.displayName} sent ${d.gift.emoji} ${d.gift.name} to ${d.to.displayName}!`;
  if(d.bonus) msg+=` 🍀 Lucky! +${d.bonus} bonus!`;
  toast(msg);
});

/* games (beans) */
$('btn-room-games').onclick=()=>{ $('games-beans').textContent=fmt(me?me.beans:0); $('games-panel').classList.remove('hidden'); };
$('games-close').onclick=()=>$('games-panel').classList.add('hidden');
$('btn-dice').onclick=()=>{
  const bet=Math.floor(Number($('dice-bet').value));
  $('dice-out').textContent='🎲 rolling...';
  socket.emit('dice',{token,bet});
};
$('btn-wheel').onclick=()=>{
  const w=$('wheel'); w.classList.remove('spin'); void w.offsetWidth; w.classList.add('spin');
  $('wheel-out').textContent='🎡 spinning...';
  socket.emit('wheel',{token});
};
socket.on('gameResult', d=>{
  if(!d.ok){ toast(d.error); $('dice-out').textContent=''; $('wheel-out').textContent=''; return; }
  $('games-beans').textContent=fmt(d.beans);
  if(d.game==='dice'){
    const faces=['','⚀','⚁','⚂','⚃','⚄','⚅'];
    $('dice-out').innerHTML=`${faces[d.roll]} Rolled <b>${d.roll}</b> — ${d.net>=0?`won <b style="color:#1cab87">+${d.net}</b>`:`lost <b style="color:#ff5b6a">${d.net}</b>`} 🫘`;
  } else {
    setTimeout(()=>{ $('wheel-out').innerHTML=`🎉 You won <b style="color:#f5a623">${d.prize}</b> beans!`; },1800);
  }
});

/* ================= WebRTC voice (mesh) ================= */
let localStream=null, pcs={};
async function ensureMic(){
  try{
    if(!localStream) localStream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true}});
    applyMicMute(); return true;
  }catch(e){ toast('Mic unavailable — you can still listen & chat'); return false; }
}
function applyMicMute(){ if(localStream) localStream.getAudioTracks().forEach(tr=>tr.enabled=!myMuted); }
function getAudioEl(id){
  let a=document.getElementById('audio-'+id);
  if(!a){ a=document.createElement('audio'); a.id='audio-'+id; a.autoplay=true; a.playsInline=true; document.body.appendChild(a); }
  return a;
}
function createPeer(id, initiator){
  closePeer(id);
  const pc=new RTCPeerConnection({iceServers:[{urls:'stun:stun.l.google.com:19302'}]});
  pcs[id]=pc;
  if(localStream) localStream.getTracks().forEach(tr=>pc.addTrack(tr,localStream));
  pc.onicecandidate=e=>{ if(e.candidate) socket.emit('signal',{token,to:id,data:{type:'ice',candidate:e.candidate}}); };
  pc.ontrack=e=>{ const a=getAudioEl(id); a.srcObject=e.streams[0]; a.play().catch(()=>{}); };
  pc.onconnectionstatechange=()=>{ if(['failed','closed','disconnected'].includes(pc.connectionState)) closePeer(id); };
  if(initiator){
    pc.createOffer().then(o=>pc.setLocalDescription(o))
      .then(()=>socket.emit('signal',{token,to:id,data:{type:'offer',sdp:pc.localDescription}}))
      .catch(e=>console.warn('offer failed',e));
  }
  return pc;
}
function closePeer(id){ if(pcs[id]){ try{pcs[id].close();}catch(e){} delete pcs[id]; } const a=document.getElementById('audio-'+id); if(a) a.remove(); }
function closeAllPeers(){ Object.keys(pcs).forEach(closePeer); }
socket.on('peers', list=>{ list.forEach(p=>createPeer(p.socketId,true)); });
socket.on('peer-joined', p=>{ createPeer(p.socketId,false); });
socket.on('peer-left', p=>closePeer(p.socketId));
socket.on('signal', async ({from,data})=>{
  try{
    let pc=pcs[from];
    if(data.type==='offer'){
      pc=createPeer(from,false);
      await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
      const ans=await pc.createAnswer(); await pc.setLocalDescription(ans);
      socket.emit('signal',{token,to:from,data:{type:'answer',sdp:pc.localDescription}});
    } else if(data.type==='answer'){
      if(pc) await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
    } else if(data.type==='ice'){
      if(pc) await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
    }
  }catch(e){ console.warn('signal error',e); }
});

/* ================= profile ================= */
document.querySelectorAll('.ptab').forEach(b=>b.onclick=()=>{ profileTab=b.dataset.pt; document.querySelectorAll('.ptab').forEach(x=>x.classList.toggle('active',x===b)); renderProfileBody(); });
function renderProfile(){
  if(!me) return;
  const u = viewingUser || me;
  const isSelf = !viewingUser;
  $('profile-avatar-big').textContent=u.avatar;
  $('profile-frame-wrap').className='frame-wrap '+(u.frame?'fr-'+u.frame:'');
  $('profile-name').innerHTML=nameHtml(u);
  $('profile-vip').innerHTML=vipBadgeHtml(u.vip, u.vipExpires);
  $('profile-tags').innerHTML=tagsHtml(u.tags);
  $('profile-couple').innerHTML = u.coupleWith ? `${t('myPartner')}: <b>${esc(u.coupleName||('ID '+u.coupleWith))}</b> 💑` : `<span class="sub">${t('noPartner')}</span>`;
  $('st-follow').textContent=u.following||0; $('st-fans').textContent=u.followers||0;
  $('st-sent').textContent=fmt(u.sentGifts); $('st-recv').textContent=fmt(u.receivedCount);
  $('profile-id').textContent=u.id;
  $('profile-coins').textContent=fmt(u.coins)+' 🪙';
  $('profile-diamonds').textContent=fmt(u.diamonds)+' 💎';
  $('profile-beans').textContent=fmt(u.beans)+' 🫘';
  document.querySelectorAll('.ptab').forEach(x=>x.classList.toggle('hidden', !isSelf && x.dataset.pt==='edit'));
  renderProfileBody();
}
function myDressItem(kind, id){
  const list = kind==='frame' ? (me.frames||[]) : (me.entries||[]);
  return list.find(x=>x.id===id);
}
function renderProfileBody(){
  const body=$('profile-body');
  if(profileTab==='edit'){ renderEditTab(body); return; }
  if(profileTab==='medal'){
    const medals=[];
    if(me.vip>0) medals.push({e:'👑',n:VIP_NAMES[me.vip]});
    if((me.sentGifts||0)>=1000) medals.push({e:'🏆',n:'Gold Gifter'});
    else if((me.sentGifts||0)>=100) medals.push({e:'🥈',n:'Silver Gifter'});
    else if((me.sentGifts||0)>=10) medals.push({e:'🥉',n:'Bronze Gifter'});
    if((me.followers||0)>=50) medals.push({e:'🌟',n:'Star'});
    if(me.coupleWith) medals.push({e:'💑',n:'Couple'});
    if(hasTag('HOST')) medals.push({e:'🎙️',n:'Host'});
    body.innerHTML=`<h3>${t('medalsFor')}</h3><div class="medal-grid">${
      medals.length?medals.map(m=>`<div class="medal"><div class="m-emoji">${m.e}</div><div class="sub">${esc(m.n)}</div></div>`).join('')
      :`<p class="sub">${t('noMedals')}</p>`}</div>`;
    return;
  }
  if(profileTab==='relation'){
    body.innerHTML=`<div class="couple-card">
      ${me.coupleWith
        ? `<div style="font-size:40px">💑</div><h3>${t('myPartner')}</h3><p>ID ${me.coupleWith}</p>
           <button class="btn danger" id="btn-break">${t('coupleBreak')}</button>`
        : `<div style="font-size:40px">💔</div><p class="sub">${t('noPartner')}</p>
           <p class="sub" style="margin:8px 0">${t('coupleRequest')}</p>
           <input id="cp-id" placeholder="${t('userIdPh')}" type="number">
           <button class="btn primary" id="btn-cp-req">${t('coupleRequest')}</button>
           <p class="sub" id="cp-out"></p>`}
    </div>`;
    const bq=$('btn-cp-req');
    if(bq) bq.onclick=()=>{ const v=$('cp-id').value; if(v) socket.emit('coupleRequest',{token,toUserId:Number(v)}); };
    const bb=$('btn-break');
    if(bb) bb.onclick=()=>{ if(confirm(t('confirmBreak'))) socket.emit('coupleBreak',{token}); };
    return;
  }
  if(profileTab==='gift'){
    const rg=me.receivedGifts||{};
    const ids=Object.keys(rg);
    body.innerHTML=`<h3>${t('giftWall')}</h3><div class="gift-catalog">${
      ids.length?ids.map(id=>{ const g=CATALOG.gifts.find(x=>x.id===id); if(!g) return '';
        return `<div class="gift"><div class="g-emoji">${g.emoji}</div><div>${esc(g.name)}</div><div class="g-price">x${rg[id]}</div></div>`; }).join('')
      :`<p class="sub">${t('noGifts')}</p>`}</div>`;
    return;
  }
  // dress tab
  const frames=(me.frames||[]), entries=(me.entries||[]);
  body.innerHTML=`<h3>🖼 ${t('frames')}</h3>`+(frames.length?frames.map(f=>{
    const def=CATALOG.frames.find(x=>x.id===f.id); if(!def) return '';
    const active=me.activeFrame===f.id;
    return `<div class="dress-item"><div class="frame-wrap fr-${f.id}"><div class="avatar">${me.avatar}</div></div>
      <div class="grow"><b>${esc(def.name)}</b><div class="sub">${daysLeft(f.expires)} ${t('remainingDays')}</div></div>
      <button class="btn small ${active?'':'primary'}" data-k="frame" data-id="${f.id}" ${active?'disabled':''}>${active?t('active'):t('activate')}</button></div>`;
  }).join(''):`<p class="sub">${t('notOwned')} — <a href="#" id="go-store">🏪 ${t('store')}</a></p>`)
  +`<h3 style="margin-top:14px">✨ ${t('entries')}</h3>`+(entries.length?entries.map(e=>{
    const def=CATALOG.entries.find(x=>x.id===e.id); if(!def) return '';
    const active=me.activeEntry===e.id;
    return `<div class="dress-item"><div class="grow"><b>${esc(def.name)}</b> <span class="sub">en-${e.id}</span><div class="sub">${daysLeft(e.expires)} ${t('remainingDays')}</div></div>
      <button class="btn small ${active?'':'primary'}" data-k="entry" data-id="${e.id}" ${active?'disabled':''}>${active?t('active'):t('activate')}</button></div>`;
  }).join(''):`<p class="sub">${t('notOwned')} — <a href="#" id="go-store2">🏪 ${t('store')}</a></p>`);
  body.querySelectorAll('button[data-k]').forEach(b=>b.onclick=()=>socket.emit('setActiveDress',{token,kind:b.dataset.k,itemId:b.dataset.id}));
  const gs=$('go-store'); if(gs) gs.onclick=e=>{e.preventDefault();goStore();};
  const gs2=$('go-store2'); if(gs2) gs2.onclick=e=>{e.preventDefault();goStore();};
}
let pickedAvatar='🙂';
function renderEditTab(body){
  pickedAvatar=me.avatar;
  body.innerHTML=`
    <h3>${t('edit')}</h3>
    <label>${t('displayName')}<input id="edit-name" maxlength="24" value="${esc(me.displayName)}"></label>
    <label>${t('avatar')}<div id="avatar-picker" class="avatar-picker"></div></label>
    <button id="btn-save-profile" class="btn primary">${t('save')}</button>`;
  $('avatar-picker').innerHTML=AVATARS.map(a=>`<span class="${a===pickedAvatar?'sel':''}" data-a="${a}">${a}</span>`).join('');
  document.querySelectorAll('#avatar-picker span').forEach(s=>s.onclick=()=>{
    pickedAvatar=s.dataset.a;
    document.querySelectorAll('#avatar-picker span').forEach(x=>x.classList.remove('sel'));
    s.classList.add('sel');
  });
  $('btn-save-profile').onclick=()=>{
    socket.emit('updateProfile',{token,displayName:$('edit-name').value.trim(),avatar:pickedAvatar});
  };
}
socket.on('profileSaved', u=>{ me=u; renderMe(); renderProfile(); toast(t('profileSaved')); });
socket.on('coupleResult', d=>{
  if(!d.ok){ toast(d.error); return; }
  if(d.action==='sent') toast(t('reqSent'));
  else if(d.action==='accepted') toast('💑 Couple!');
  else if(d.action==='broken') toast('💔');
  if(d.user){ me=d.user; renderMe(); renderProfile(); }
});

/* ================= store ================= */
document.querySelectorAll('.store-tab').forEach(b=>b.onclick=()=>{ storeTab=b.dataset.st; document.querySelectorAll('.store-tab').forEach(x=>x.classList.toggle('active',x===b)); renderStore(); });
function renderStore(){
  renderStoreChips();
  const body=$('store-body');
  if(storeTab==='vip'){
    body.innerHTML=`<h3>👑 VIP 1–8 <span class="sub">(30 ${t('remainingDays')})</span></h3>`+
    [1,2,3,4,5,6,7,8].map(l=>{
      const price=CATALOG.vipPrices[l];
      const cur=me.vip===l;
      return `<div class="vip-card"><div class="vhead"><span style="font-size:30px">👑</span>
        <div><b class="${vipClass(l)}">${VIP_NAMES[l]}</b><div class="vprice">🪙 ${fmt(price)}</div></div></div>
        ${cur&&me.vipExpires?`<div class="sub">${t('vipExpires')}: ${new Date(me.vipExpires).toLocaleDateString()}</div>`:''}
        <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap">
          <button class="btn primary small" data-buyvip="${l}">${t('buyVip')}${cur?' +':' '}</button>
          <input data-gvip-to="${l}" placeholder="${t('toUserPh')}" type="number" style="flex:1;min-width:110px;margin:0">
          <button class="btn small" data-giftvip="${l}">${t('giftVip')}</button>
        </div></div>`;
    }).join('');
    body.querySelectorAll('[data-buyvip]').forEach(b=>b.onclick=()=>socket.emit('buyVip',{token,level:Number(b.dataset.buyvip)}));
    body.querySelectorAll('[data-giftvip]').forEach(b=>b.onclick=()=>{
      const inp=body.querySelector(`[data-gvip-to="${b.dataset.giftvip}"]`);
      if(inp&&inp.value) socket.emit('giftVip',{token,toUserId:Number(inp.value),level:Number(b.dataset.giftvip)});
    });
    return;
  }
  const isF=storeTab==='frames';
  const items=isF?CATALOG.frames:CATALOG.entries;
  const owned=id=>isF?(me.frames||[]).some(x=>x.id===id&&x.expires>Date.now()):(me.entries||[]).some(x=>x.id===id&&x.expires>Date.now());
  body.innerHTML=`<h3>${isF?'🖼':'✨'} ${isF?t('frames'):t('entries')}</h3><div class="shop-grid">`+
    items.map(it=>{
      const has=owned(it.id);
      const key=isF?'frame':'entry';
      const days=dressDays[key];
      const price=Math.round(it.price*(days===15?1.8:days===30?3:1));
      return `<div class="shop-item"><div class="prev">${isF
        ? `<div class="frame-wrap fr-${it.id}"><div class="avatar">${me.avatar}</div></div>`
        : `<div class="entry-banner en-${it.id}" style="margin:0;padding:8px;font-size:12px">✨ ${esc(it.name)}</div>`}</div>
        <b>${esc(it.name)}</b><div class="sub">🪙 ${fmt(price)} · ${days}d</div>
        <div class="days-row">${[7,15,30].map(d=>`<button class="${dressDays[key]===d?'sel':''}" data-k="${key}" data-d="${d}">${d}d</button>`).join('')}</div>
        ${has?`<div class="sub">✅ ${t('owned')}</div>`:`<button class="btn primary small" data-buy="${key}" data-id="${it.id}">${t('buy')}</button>`}
      </div>`;
    }).join('')+`</div>`;
  body.querySelectorAll('.days-row button').forEach(b=>b.onclick=()=>{ dressDays[b.dataset.k]=Number(b.dataset.d); renderStore(); });
  body.querySelectorAll('[data-buy]').forEach(b=>b.onclick=()=>socket.emit('buyDress',{token,kind:b.dataset.buy,itemId:b.dataset.id,days:dressDays[b.dataset.buy]}));
}
socket.on('vipResult', d=>{
  if(!d.ok){ toast(d.error); return; }
  if(d.user){ me=d.user; }
  renderMe(); renderStoreChips(); renderStore();
  toast(d.action==='gift'?`VIP ${d.level} gifted ✅`:'VIP updated 👑');
});
socket.on('dressResult', d=>{
  if(!d.ok){ toast(d.error); return; }
  if(d.user) me=d.user;
  renderMe(); renderStoreChips(); renderStore(); renderProfile();
  toast('✅');
});

/* ================= inbox ================= */
$('btn-new-dm').onclick=()=>{
  const q=prompt(t('typeMsgPh'),'');
  if(!q) return;
  const text=prompt(t('saySomething'),'');
  if(!text) return;
  socket.emit('sendDM',{token,to:q,text});
};
socket.on('dmResult', d=>{ if(!d.ok){toast(d.error);return;} toast(t('dmSent')); socket.emit('listInbox',{token}); if(threadOther) openThread(threadOther, null); });
socket.on('dmNotify', d=>{ toast('💌 '+(d.from?d.from.displayName:'')); socket.emit('listInbox',{token}); });
socket.on('inboxList', d=>{
  if(!d.ok) return;
  const cards=d.cards||[];
  $('inbox-cards').innerHTML=cards.map(c=>{
    if(c.type==='couple'){
      return `<div class="req-card"><b>💑 Couple request</b><div class="sub">${esc(c.issuer.displayName)} (ID ${c.issuer.id}) → you</div>
        <div class="row"><button class="btn primary small" data-cp-ok="${c.id}">${t('accept')}</button>
        <button class="btn small" data-cp-no="${c.id}">${t('decline')}</button></div></div>`;
    }
    const tagName={manager:'MANAGER',reseller:'RESELLER',bd:'BD',agent:'AGENT',host:'HOST'}[c.type]||c.type;
    return `<div class="req-card"><b>📋 ${tagName} request</b>
      <div class="sub">${esc(c.issuer?c.issuer.displayName:'?')} → <b>${esc(c.target.displayName)}</b> (ID ${c.target.id})${c.code?` · code ${esc(c.code)}`:''}</div>
      <div class="row"><button class="btn primary small" data-ap-ok="${c.id}">${t('approve')}</button>
      <button class="btn small" data-ap-no="${c.id}">${t('reject')}</button></div></div>`;
  }).join('');
  $('inbox-cards').querySelectorAll('[data-cp-ok]').forEach(b=>b.onclick=()=>socket.emit('coupleRespond',{token,requestId:Number(b.dataset.cpOk),accept:true}));
  $('inbox-cards').querySelectorAll('[data-cp-no]').forEach(b=>b.onclick=()=>socket.emit('coupleRespond',{token,requestId:Number(b.dataset.cpNo),accept:false}));
  $('inbox-cards').querySelectorAll('[data-ap-ok]').forEach(b=>b.onclick=()=>socket.emit('approvalRespond',{token,requestId:Number(b.dataset.apOk),approve:true}));
  $('inbox-cards').querySelectorAll('[data-ap-no]').forEach(b=>b.onclick=()=>socket.emit('approvalRespond',{token,requestId:Number(b.dataset.apNo),approve:false}));
  const convs=d.conversations||[];
  let unread=convs.reduce((a,c)=>a+(c.unread||0),0);
  $('inbox-badge').textContent=unread+cards.length;
  $('inbox-badge').classList.toggle('hidden', !(unread+cards.length));
  $('inbox-list').innerHTML=convs.length?convs.map(c=>`
    <div class="inbox-item" data-oid="${c.otherId}">
      <div class="avatar">${esc(c.otherAvatar)}</div>
      <div class="info"><b>${esc(c.otherName)}</b> ${(c.unread?`<b class="badge" style="position:static">${c.unread}</b>`:'')}
      <div class="sub">${esc(c.lastText).slice(0,60)}</div></div>
      <div class="sub">${new Date(c.ts).toLocaleDateString()}</div>
    </div>`).join(''):'<p class="sub" style="text-align:center;padding:20px">💌</p>';
  document.querySelectorAll('.inbox-item').forEach(el=>el.onclick=()=>openThread(Number(el.dataset.oid), null));
});
function openThread(otherId, name){
  threadOther=otherId;
  $('thread-name').textContent=name||('ID '+otherId);
  $('thread-view').classList.remove('hidden');
  $('inbox-list').classList.add('hidden'); $('inbox-cards').classList.add('hidden');
  socket.emit('getThread',{token,otherId});
  window.scrollTo(0,0);
}
$('btn-thread-back').onclick=()=>{ threadOther=null; $('thread-view').classList.add('hidden'); $('inbox-list').classList.remove('hidden'); $('inbox-cards').classList.remove('hidden'); socket.emit('listInbox',{token}); };
function sendThread(){ const v=$('thread-input').value.trim(); if(!v||!threadOther) return; socket.emit('sendDM',{token,to:threadOther,text:v}); $('thread-input').value=''; }
$('btn-thread-send').onclick=sendThread;
$('thread-input').onkeydown=e=>{ if(e.key==='Enter') sendThread(); };
socket.on('thread', d=>{
  if(!d.ok) return;
  if(d.other) $('thread-name').textContent=d.other.displayName;
  $('thread-msgs').innerHTML=d.messages.map(m=>{
    if(m.kind==='card'&&m.cardType==='couple'){
      return `<div class="req-card"><b>💑 ${esc(m.text)}</b><div class="sub">(${t('inbox')})</div></div>`;
    }
    const mine=m.fromId===me.id;
    return `<div class="chat-msg ${mine?'mine':''}"><span class="bubble">${mine?'':`<span class="cn">${esc(m.fromName)}</span>: `}${esc(m.text)}</span></div>`;
  }).join('');
  const box=$('thread-msgs'); box.scrollTop=box.scrollHeight;
  socket.emit('listInbox',{token});
});

/* ================= settings ================= */
function renderSettings(){
  $('set-adminplus').classList.toggle('hidden', !hasTag('ADMIN_PLUS'));
  $('set-manager').classList.toggle('hidden', !hasTag('MANAGER'));
  $('set-bd').classList.toggle('hidden', !hasTag('BD'));
  $('set-agent').classList.toggle('hidden', !hasTag('AGENT'));
  $('set-owner-link').classList.toggle('hidden', !(hasTag('OWNER')||hasTag('ADMIN_PLUS')));
  $('set-reseller-link').classList.toggle('hidden', !hasTag('RESELLER'));
  // Standalone super setup card: shown only until the first OWNER exists, hidden forever after
  fetch('/api/has-owner').then(r=>r.json()).then(d=>{ $('set-super').classList.toggle('hidden', !!d.hasOwner); }).catch(()=>{});
  if(isSuper){ $('super-lock').classList.add('hidden'); $('super-tools').classList.remove('hidden'); }
}
$('btn-redeem').onclick=()=>{
  const c=$('redeem-code').value.trim();
  if(!c){ toast(t('codePh')); return; }
  socket.emit('redeemCode',{token,code:c});
};
$('btn-req-manager').onclick=()=>{
  const v=$('ap-target').value.trim(); if(!v){toast(t('userIdPh'));return;}
  socket.emit('requestRole',{token,targetId:Number(v),type:'manager'});
};
$('btn-req-reseller').onclick=()=>{
  const v=$('ap-target').value.trim(); if(!v){toast(t('userIdPh'));return;}
  socket.emit('requestRole',{token,targetId:Number(v),type:'reseller'});
};
$('btn-gen-bd').onclick=()=>socket.emit('genCode',{token,type:'bd'});
$('btn-gen-agent').onclick=()=>socket.emit('genCode',{token,type:'agent'});
$('btn-gen-host').onclick=()=>socket.emit('genCode',{token,type:'host'});
$('btn-open-dashboard').onclick=()=>{ $('admin-lock').classList.remove('hidden'); $('admin-tools').classList.add('hidden'); $('admin-error').textContent=''; showView('view-admin'); };
/* ----- inline super unlock in Settings, like the Redeem Code card (first-time owner setup) ----- */
$('btn-super-unlock').onclick=()=>{ $('super-error').textContent=''; socket.emit('superUnlock',{token,code:$('super-code').value}); };
$('btn-super-grant').onclick=()=>{ const q=$('super-q').value.trim(); if(!q){ toast(t('superQPh')); return; } $('super-out').textContent='…'; socket.emit('superGrantOwner',{token,q}); };
$('btn-open-reseller').onclick=()=>{ $('reseller-out').textContent=''; showView('view-reseller'); };
$('btn-back-reseller').onclick=()=>{ renderSettings(); showView('view-settings'); };
socket.on('roleResult', d=>{
  if(!d.ok){ toast(d.error); return; }
  if(d.action==='requested'){ $('ap-out').textContent=t('reqSent'); toast(t('reqSent')); }
  else if(d.action==='code'){
    const el={bd:'gen-bd-out',agent:'gen-agent-out',host:'gen-host-out'}[d.type];
    if(el){ $(el).textContent=d.code; toast(t('codeCopied')); try{ navigator.clipboard.writeText(d.code); }catch(e){} }
  }
  else if(d.action==='redeemed'){ $('redeem-out').textContent=t('reqSent'); toast(t('reqSent')); }
  else toast('✅');
});
socket.on('requestNotify', d=>{ toast('📋 New request!'); });

/* ================= owner dashboard ================= */
let dashData=null, dashUsers=[];
document.querySelectorAll('.dtab').forEach(b=>b.onclick=()=>{ dashTab=b.dataset.dt; document.querySelectorAll('.dtab').forEach(x=>x.classList.toggle('active',x===b)); renderDash(); });
/* dashboard entry is via Settings → Open Owner Dashboard */
$('btn-back-dash').onclick=()=>{ renderSettings(); showView('view-settings'); };
$('btn-admin-unlock').onclick=()=>{ $('admin-error').textContent=''; socket.emit('ownerUnlock',{token,code:$('admin-code').value}); };
socket.on('ownerResult', d=>{
  if(!d.ok){ $('admin-error').textContent=d.error||'Failed'; toast(d.error||'Failed'); return; }
  $('admin-lock').classList.add('hidden'); $('admin-tools').classList.remove('hidden');
  toast('🔓'); socket.emit('ownerDashboard',{token});
});
socket.on('dashboard', d=>{
  if(!d.ok) return;
  dashData=d; renderDash();
});
function renderDash(){
  if(!dashData) return;
  document.querySelectorAll('.dtab').forEach(x=>x.classList.toggle('active',x.dataset.dt===dashTab));
  const body=$('dash-body');
  if(dashTab==='stats'){
    const s=dashData.stats;
    body.innerHTML=`<div class="stat-grid">
      <div class="stat-card"><b>${fmt(s.totalUsers)}</b><span>${t('totalUsers')}</span></div>
      <div class="stat-card"><b>${s.activeRooms}</b><span>${t('activeRooms')}</span></div>
      <div class="stat-card"><b>🪙 ${fmt(s.coins)}</b><span>${t('coinsCirc')}</span></div>
      <div class="stat-card"><b>💎 ${fmt(s.diamonds)}</b><span>${t('diaCirc')}</span></div>
      <div class="stat-card"><b>🫘 ${fmt(s.beans)}</b><span>${t('beansCirc')}</span></div>
      <div class="stat-card"><b>🎁 ${fmt(s.giftsToday)}</b><span>${t('giftsToday')}</span></div>
    </div>
    <div class="admin-card"><h3>👥 ${t('users')}</h3>${Object.entries(s.roles).map(([k,v])=>`<div class="set-row"><span class="tag tag-${k}">${k}</span><b>${v}</b></div>`).join('')}
    <div class="sub">Week: ${s.weekId}</div></div>`;
  }
  else if(dashTab==='users') renderDashUsers(body);
  else if(dashTab==='targets') renderDashTargets(body);
  else if(dashTab==='agency') renderDashAgency(body);
  else if(dashTab==='super') renderDashSuper(body);
}
function renderDashUsers(body){
  body.innerHTML=`<div class="lobby-actions"><input id="du-q" placeholder="${t('searchUserPh')}">
    <button class="btn primary" id="du-search">${t('search')}</button></div><div id="du-list"></div>
    <div class="admin-card"><h3>💰 ${t('sellCoins')}</h3>
      <input id="du-sell-q" placeholder="${t('buyerPh')}"><input id="du-sell-amt" type="number" placeholder="${t('amountPh')}">
      <button class="btn primary" id="du-sell-btn">${t('addCoins')}</button><p class="sub" id="du-sell-out"></p></div>`;
  $('du-search').onclick=()=>socket.emit('ownerUserSearch',{token,q:$('du-q').value});
  $('du-sell-btn').onclick=()=>socket.emit('ownerSellCoins',{token,q:$('du-sell-q').value,amount:Number($('du-sell-amt').value)});
  if(dashUsers.length) paintDashUsers();
}
function paintDashUsers(){
  const el=$('du-list'); if(!el) return;
  const tagOpts=['ADMIN_PLUS','MANAGER','BD','AGENT','RESELLER','HOST'];
  el.innerHTML=dashUsers.map(u=>`
    <div class="admin-user" data-id="${u.id}">
      <div><b class="${vipClass(u.vip)}">${esc(u.displayName)}</b> <span class="sub">ID ${u.id} · @${esc(u.username)}</span> ${u.blocked?'<span class="tag" style="background:#333;color:#fff">BLOCKED</span>':''}</div>
      <div class="sub">VIP ${u.vip}${u.vipExpires?' ⏳'+new Date(u.vipExpires).toLocaleDateString():''} · 🪙${fmt(u.coins)} 💎${fmt(u.diamonds)} 🫘${fmt(u.beans)} · ${tagsHtml(u.tags)}</div>
      <div class="row"><input type="number" class="f-coins" placeholder="🪙 +/-"><input type="number" class="f-dia" placeholder="💎 +/-"><input type="number" class="f-beans" placeholder="🫘 +/-"><button class="btn small primary b-adj">${t('apply')}</button></div>
      <div class="row"><select class="f-vip">${[0,1,2,3,4,5,6,7,8].map(v=>`<option value="${v}" ${v===u.vip?'selected':''}>VIP ${v}</option>`).join('')}</select>
        <input type="number" class="f-vipdays" placeholder="${t('vipDaysPh')}" style="max-width:130px"><button class="btn small b-vip">${t('setVip')}</button></div>
      <div class="row"><select class="f-tag">${tagOpts.map(x=>`<option>${x}</option>`).join('')}</select>
        <button class="btn small b-grant">${t('grantTag')}</button><button class="btn small b-revoke">${t('revoke')}</button></div>
      <div class="row"><select class="f-dkind"><option value="frame">🖼 Frame</option><option value="entry">✨ Entry</option></select>
        <select class="f-ditem"></select><input type="number" class="f-ddays" placeholder="${t('daysPh')}" value="7" style="max-width:80px">
        <button class="btn small b-dress">${t('grantDress')}</button></div>
      <div class="row"><button class="btn small ${u.blocked?'primary':'danger'} b-block">${u.blocked?t('unblock'):t('block')}</button></div>
    </div>`).join('');
  el.querySelectorAll('.admin-user').forEach(card=>{
    const id=Number(card.dataset.id);
    const dressSel=card.querySelector('.f-ditem');
    const fillDress=()=>{ const k=card.querySelector('.f-dkind').value;
      const items=k==='frame'?CATALOG.frames:CATALOG.entries;
      dressSel.innerHTML=items.map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join(''); };
    card.querySelector('.f-dkind').onchange=fillDress; fillDress();
    card.querySelector('.b-adj').onclick=()=>{
      const c=Number(card.querySelector('.f-coins').value), d2=Number(card.querySelector('.f-dia').value), b2=Number(card.querySelector('.f-beans').value);
      if(c) socket.emit('ownerAdjust',{token,userId:id,field:'coins',delta:c});
      if(d2) socket.emit('ownerAdjust',{token,userId:id,field:'diamonds',delta:d2});
      if(b2) socket.emit('ownerAdjust',{token,userId:id,field:'beans',delta:b2});
    };
    card.querySelector('.b-vip').onclick=()=>socket.emit('ownerSetVipFull',{token,userId:id,level:Number(card.querySelector('.f-vip').value),days:Number(card.querySelector('.f-vipdays').value)||0});
    card.querySelector('.b-grant').onclick=()=>socket.emit('ownerGrantTag',{token,userId:id,tag:card.querySelector('.f-tag').value});
    card.querySelector('.b-revoke').onclick=()=>socket.emit('ownerRevokeTag',{token,userId:id,tag:card.querySelector('.f-tag').value});
    card.querySelector('.b-dress').onclick=()=>socket.emit('ownerGrantDress',{token,userId:id,kind:card.querySelector('.f-dkind').value,itemId:dressSel.value,days:Number(card.querySelector('.f-ddays').value)||7});
    card.querySelector('.b-block').onclick=()=>{
      const u=dashUsers.find(x=>x.id===id);
      if(confirm(u&&u.blocked?t('confirmUnblock'):t('confirmBlock')))
        socket.emit('ownerBlock',{token,userId:id,blocked:!(u&&u.blocked)});
    };
  });
}
socket.on('ownerUserList', d=>{ if(!d.ok) return; dashUsers=d.users; paintDashUsers(); });
socket.on('ownerDone', d=>{
  toast(t('coinsAdded'));
  if(dashTab==='users'){ const q=$('du-q'); socket.emit('ownerUserSearch',{token,q:q?q.value:''}); }
  if(d.action==='sold'){ $('du-sell-out').textContent=`✅ ${d.amount} → ${d.user.displayName}`; }
});
socket.on('targetsSaved', d=>{ if(d.ok){ dashData.targets=d.targets; toast('✅'); } });
socket.on('settleResult', d=>{ if(!d.ok) return; toast(`${t('settleDone')}: ${d.count} ${t('grantedTo')}`); socket.emit('ownerDashboard',{token}); });
socket.on('specialResult', d=>{ if(!d.ok) return; dashData.targets=d.targets; toast('⭐ ✅'); renderDash(); });

function renderDashTargets(body){
  const T=dashData.targets.roles;
  const roleKeys=['adminPlus','manager','bd','vip1','vip2','vip3','vip4','vip5','vip6','vip7','vip8'];
  const roleName={adminPlus:'ADMIN+',manager:'MANAGER',bd:'BD',vip1:'VIP 1',vip2:'VIP 2',vip3:'VIP 3',vip4:'VIP 4',vip5:'VIP 5',vip6:'VIP 6',vip7:'VIP 7',vip8:'VIP 8'};
  body.innerHTML=`<div class="admin-card"><h3>🎯 ${t('weeklyTargets')}</h3>
    <p class="sub">${t('pointsPh')} = ${t('giftsToday')} points</p></div>`+
    roleKeys.map(k=>{ const r=T[k]||{points:0,rewards:{}};
      return `<div class="tgt-row" data-rk="${k}"><b>${roleName[k]}</b><div class="grid">
        <label>${t('pointsPh')}<input type="number" class="r-points" value="${r.points||0}"></label>
        <label>VIP<input type="number" class="r-vip" value="${r.rewards.vip||0}" min="0" max="8"></label>
        <label>VIP days<input type="number" class="r-vipdays" value="${r.rewards.vipDays||0}"></label>
        <label>🪙 Coins<input type="number" class="r-coins" value="${r.rewards.coins||0}"></label>
        <label>🖼 Frame<select class="r-frame"><option value="">—</option>${CATALOG.frames.map(f=>`<option value="${f.id}" ${r.rewards.frameId===f.id?'selected':''}>${esc(f.name)}</option>`).join('')}</select></label>
        <label>Frame days<input type="number" class="r-framedays" value="${r.rewards.frameDays||0}"></label>
        <label>✨ Entry<select class="r-entry"><option value="">—</option>${CATALOG.entries.map(e=>`<option value="${e.id}" ${r.rewards.entryId===e.id?'selected':''}>${esc(e.name)}</option>`).join('')}</select></label>
        <label>Entry days<input type="number" class="r-entrydays" value="${r.rewards.entryDays||0}"></label>
      </div></div>`; }).join('')+
    `<div style="padding:0 12px"><button class="btn primary" id="btn-save-targets">${t('saveTargets')}</button>
    <button class="btn" id="btn-settle" style="margin-top:8px">${t('settleWeek')}</button></div>
    <div class="admin-card"><h3>⭐ ${t('specialList')}</h3>
      <input id="sp-id" type="number" placeholder="${t('specialIdPh')}">
      <div class="grid" style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <input id="sp-vip" type="number" placeholder="VIP 0-8" min="0" max="8"><input id="sp-vipdays" type="number" placeholder="VIP days">
        <select id="sp-frame"><option value="">🖼 —</option>${CATALOG.frames.map(f=>`<option value="${f.id}">${esc(f.name)}</option>`).join('')}</select>
        <input id="sp-framedays" type="number" placeholder="Frame days">
        <select id="sp-entry"><option value="">✨ —</option>${CATALOG.entries.map(e=>`<option value="${e.id}">${esc(e.name)}</option>`).join('')}</select>
        <input id="sp-entrydays" type="number" placeholder="Entry days">
      </div>
      <input id="sp-coins" type="number" placeholder="🪙 ${t('coinsPh')}">
      <input id="sp-note" placeholder="${t('notePh')}">
      <button class="btn primary" id="btn-special">${t('addSpecial')}</button>
      <div id="sp-list" style="margin-top:10px">${(dashData.targets.special||[]).map(s=>`<div class="sub">⭐ ${esc(s.targetName)} (ID ${s.targetId}) — VIP ${s.vip}/${s.vipdays}d · 🪙${fmt(s.coins)} ${esc(s.note||'')}</div>`).join('')}</div>
    </div>`;
  $('btn-save-targets').onclick=()=>{
    const roles={};
    body.querySelectorAll('.tgt-row').forEach(row=>{
      const k=row.dataset.rk;
      roles[k]={ points:Number(row.querySelector('.r-points').value)||0, rewards:{
        vip:Number(row.querySelector('.r-vip').value)||0, vipDays:Number(row.querySelector('.r-vipdays').value)||0,
        frameId:row.querySelector('.r-frame').value, frameDays:Number(row.querySelector('.r-framedays').value)||0,
        entryId:row.querySelector('.r-entry').value, entryDays:Number(row.querySelector('.r-entrydays').value)||0,
        coins:Number(row.querySelector('.r-coins').value)||0 }};
    });
    socket.emit('setTargets',{token,roles});
  };
  $('btn-settle').onclick=()=>{ if(confirm(t('settleWeek')+'?')) socket.emit('settleWeek',{token}); };
  $('btn-special').onclick=()=>socket.emit('specialGrant',{token,grant:{
    targetId:Number($('sp-id').value), vip:Number($('sp-vip').value)||0, vipDays:Number($('sp-vipdays').value)||0,
    frameId:$('sp-frame').value, frameDays:Number($('sp-framedays').value)||0,
    entryId:$('sp-entry').value, entryDays:Number($('sp-entrydays').value)||0,
    coins:Number($('sp-coins').value)||0, note:$('sp-note').value }});
}
function renderDashAgency(body){
  body.innerHTML=`<div class="admin-card"><h3>🏢 ${t('createAgency')}</h3>
    <input id="ag-name" placeholder="${t('agencyNamePh')}">
    <button class="btn primary" id="btn-ag-create">${t('createAgency')}</button></div>
    <div id="ag-list">${(dashData.agencies||[]).map(a=>`
      <div class="admin-card"><b>🏢 ${esc(a.name)}</b> <span class="sub">ID ${a.id}</span>
        <div class="sub">${t('members')}: ${(a.members||[]).join(', ')||'—'}</div>
        <div class="row" style="display:flex;gap:8px;margin-top:8px">
          <input id="agm-${a.id}" placeholder="${t('memberIdPh')}" type="number" style="margin:0">
          <button class="btn small primary" data-ag-add="${a.id}">${t('addMember')}</button>
        </div>
        <div style="margin-top:6px">${(a.members||[]).map(m=>`<span class="tag" style="background:var(--card2);color:var(--txt);border:1px solid var(--line)">ID ${m} <a href="#" data-ag-rm="${a.id}:${m}" style="color:var(--danger)">✕</a></span> `).join('')}</div>
      </div>`).join('')}</div>`;
  $('btn-ag-create').onclick=()=>{ const n=$('ag-name').value.trim(); if(n) socket.emit('createAgency',{token,name:n}); };
  body.querySelectorAll('[data-ag-add]').forEach(b=>b.onclick=()=>{
    const aid=b.dataset.agAdd, inp=$('agm-'+aid);
    if(inp&&inp.value) socket.emit('agencyAddMember',{token,agencyId:Number(aid),userId:Number(inp.value)});
  });
  body.querySelectorAll('[data-ag-rm]').forEach(a=>a.onclick=e=>{ e.preventDefault();
    const [aid,uid]=a.dataset.agRm.split(':');
    socket.emit('agencyRemoveMember',{token,agencyId:Number(aid),userId:Number(uid)});
  });
}
socket.on('agencyResult', d=>{ if(!d.ok){toast(d.error);return;} toast('✅'); socket.emit('ownerDashboard',{token}); });

/* ----- super panel (inside dashboard) ----- */
let isSuper=false;
function renderDashSuper(body){
  body.innerHTML=`<div class="admin-card"><h3>👑 ${t('superOwner')}</h3>
    <div id="d-super-lock">
      <input id="d-super-code" type="password" placeholder="${t('superCodePh')}">
      <button class="btn primary" id="d-btn-super-unlock">${t('unlock')}</button>
      <p id="d-super-error" class="error"></p>
    </div>
    <div id="d-super-tools" class="hidden">
      <input id="d-super-q" placeholder="${t('superQPh')}">
      <div style="display:flex;gap:8px;margin:6px 0">
        <button class="btn primary" id="d-btn-sgrant">${t('makeOwner')}</button>
        <button class="btn danger" id="d-btn-srevoke">${t('removeOwner')}</button>
      </div>
      <div class="admin-card" style="margin:8px 0"><b>${t('changeSuperKey')}</b>
        <input id="d-super-new-super" type="password" placeholder="${t('newSuperKeyPh')}" maxlength="32">
        <button class="btn primary" id="d-btn-ssend-s">${t('sendCodeEmail')}</button>
        <input id="d-super-verify-super" inputmode="numeric" maxlength="6" placeholder="${t('verifyCodePh')}">
        <button class="btn" id="d-btn-sverify-s">${t('verifyAndChange')}</button>
      </div>
      <div class="admin-card" style="margin:8px 0"><b>${t('changeOwnerCode')}</b>
        <input id="d-super-new-owner" type="password" placeholder="${t('newCodePh')}" maxlength="32">
        <button class="btn primary" id="d-btn-ssend-o">${t('sendCodeEmail')}</button>
        <input id="d-super-verify-owner" inputmode="numeric" maxlength="6" placeholder="${t('verifyCodePh')}">
        <button class="btn" id="d-btn-sverify-o">${t('verifyAndChange')}</button>
      </div>
      <p id="d-super-key-status" class="sub"></p>
      <button class="btn" id="d-btn-slist">${t('listOwners')}</button>
      <div id="d-super-out" class="sub" style="margin-top:10px"></div>
    </div></div>`;
  $('d-btn-super-unlock').onclick=()=>{ $('d-super-error').textContent=''; socket.emit('superUnlock',{token,code:$('d-super-code').value}); };
  $('d-btn-sgrant').onclick=()=>{ const q=$('d-super-q').value.trim(); if(q) socket.emit('superGrantOwner',{token,q}); };
  $('d-btn-srevoke').onclick=()=>{ const q=$('d-super-q').value.trim(); if(q&&confirm(t('removeOwner')+'?')) socket.emit('superRevokeOwner',{token,q}); };
  $('d-btn-slist').onclick=()=>socket.emit('superListOwners',{token});
  const req=(which)=>{ const v=$(which==='super'?'d-super-new-super':'d-super-new-owner').value.trim();
    if(v.length<4){toast('4-32');return;} $('d-super-key-status').textContent=t('sendingCode');
    socket.emit('superRequestKeyChange',{token,which,newValue:v}); };
  const con=(which)=>{ const c=$(which==='super'?'d-super-verify-super':'d-super-verify-owner').value.trim();
    if(!c){toast(t('verifyCodePh'));return;} socket.emit('superConfirmKeyChange',{token,code:c}); };
  $('d-btn-ssend-s').onclick=()=>req('super'); $('d-btn-ssend-o').onclick=()=>req('owner');
  $('d-btn-sverify-s').onclick=()=>con('super'); $('d-btn-sverify-o').onclick=()=>con('owner');
}
socket.on('superResult', d=>{
  const err=$('d-super-error'), ks=$('d-super-key-status');
  const serr=$('super-error'), sout=$('super-out');
  if(!d.ok){ if(err) err.textContent=d.error||'Failed'; if(ks) ks.textContent=d.error||'Failed'; if(serr) serr.textContent=d.error||'Failed'; toast(d.error||'Failed'); return; }
  if(!d.action){ isSuper=true;
    const l=$('d-super-lock'), tt=$('d-super-tools');
    if(l) l.classList.add('hidden'); if(tt) tt.classList.remove('hidden');
    const sl=$('super-lock'), st=$('super-tools');
    if(sl) sl.classList.add('hidden'); if(st) st.classList.remove('hidden');
    toast('👑'); socket.emit('superListOwners',{token}); return; }
  if(d.action==='grantOwner'){ toast('👑'); if(sout) sout.textContent=t('ownerGranted'); const ss=$('set-super'); if(ss) ss.classList.add('hidden'); renderSettings(); socket.emit('superListOwners',{token}); }
  else if(d.action==='revokeOwner'){ toast('👑'); socket.emit('superListOwners',{token}); }
  else if(d.action==='keyCodeSent'){ toast(t('codeSent')); if(ks) ks.textContent=t('codeSent'); }
  else if(d.action==='keyChanged'){ toast(t('keyChangedOk')); if(ks) ks.textContent=t('keyChangedOk'); }
  else if(d.action==='listOwners'){
    const out=$('d-super-out');
    if(out) out.innerHTML=d.users.length?'<b>Owners:</b><br>'+d.users.map(u=>`👑 ${esc(u.displayName)} <span class="sub">ID ${u.id}</span>`).join('<br>'):'<span class="sub">—</span>';
  }
});

/* ================= reseller ================= */
$('btn-reseller-add').onclick=()=>{
  const q=$('reseller-q').value.trim(), amount=Number($('reseller-amount').value);
  if(!q||!amount){ toast(t('buyerPh')); return; }
  socket.emit('resellerAddCoins',{token,q,amount});
};
socket.on('resellerResult', d=>{
  if(!d.ok){ toast(d.error||'Failed'); $('reseller-out').textContent=d.error||'Failed'; return; }
  $('reseller-out').textContent=`✅ ${d.amount} 🪙 → ${d.user.displayName} (ID ${d.user.id})`;
  $('reseller-q').value=''; $('reseller-amount').value='';
});

/* ================= boot ================= */
setLang(lang);
if(token) socket.emit('resume',{token});
else showView('view-auth');
