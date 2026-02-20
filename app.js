// ============================================================
// Runner Coach v2 — App Logic
// ============================================================

// --- Constants ---
const DAYS_JA = ['月', '火', '水', '木', '金', '土', '日'];
const DAYS_EN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const TYPE_COLORS = {
  recovery: 'var(--color-easy-run)', rest: 'var(--color-rest-day)',
  interval: 'var(--color-interval)', easy: 'var(--color-easy-run)',
  cross: 'var(--color-cross-train)', tempo: 'var(--color-tempo-run)',
  long: 'var(--color-long-run)'
};
const TYPE_LABELS = {
  recovery: 'Recovery', rest: 'Rest', interval: 'Intv',
  easy: 'Easy', cross: 'Cross', tempo: 'Tempo', long: 'Long'
};
const TYPE_JA = {
  recovery: 'ジョグ（軽め）', rest: '休息', interval: 'インターバル',
  easy: 'ジョグ', cross: 'クロストレーニング', tempo: 'テンポ走', long: 'ロング走'
};

const INTERVALS = [
  { reps: '400m × 8', rest: '200mジョグ' },
  { reps: '800m × 5', rest: '200mジョグ' },
  { reps: '1000m × 4', rest: '400mジョグ' },
  { reps: '1200m × 4', rest: '400mジョグ' },
  { reps: '1600m × 3', rest: '400mジョグ' },
  { reps: '2000m × 3', rest: '600mジョグ' },
  { reps: '800m × 6', rest: '200mジョグ' },
  { reps: '1000m × 5', rest: '400mジョグ' },
  { reps: '400m × 10', rest: '200mジョグ' },
  { reps: '600m × 6', rest: '200mジョグ' },
  { reps: '800m × 4', rest: '200mジョグ' },
  { reps: '400m × 6', rest: '200mジョグ' }
];

const RACE_DISTANCES = { full: 42.195, half: 21.0975 };

// --- Date Utilities ---
function today() { return new Date(); }
function toISO(d) { return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); }
function fromISO(s) { const p = s.split('-'); return new Date(+p[0], +p[1]-1, +p[2]); }
function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function getMonday(d) {
  const r = new Date(d);
  const day = r.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  r.setDate(r.getDate() + diff);
  r.setHours(0,0,0,0);
  return r;
}

// --- Pace Calculation ---
// Parse "H:MM" or "H:MM:SS" target time into total seconds (legacy support)
function parseTargetTime(str) {
  const parts = str.trim().split(':').map(Number);
  if (parts.some(isNaN)) return null;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return null;
}

// Format seconds per km as "M:SS/km"
function formatPace(secPerKm) {
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return m + ':' + String(s).padStart(2, '0') + '/km';
}

// Format pace for display without /km
function formatPaceShort(secPerKm) {
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return m + ':' + String(s).padStart(2, '0');
}

// Calculate training paces from marathon/half target time
function calcPaces(targetSeconds, raceType) {
  const dist = RACE_DISTANCES[raceType] || 42.195;
  const racePace = targetSeconds / dist; // sec/km

  return {
    easy:     formatPaceShort(racePace * 1.20),
    tempo:    formatPaceShort(racePace * 0.95),
    interval: formatPaceShort(racePace * 0.85),
    long:     formatPaceShort(racePace * 1.10),
    recovery: formatPaceShort(racePace * 1.28)
  };
}

// --- Storage ---
const STORE_KEY = 'runner-coach';
function loadState() {
  try { const r = localStorage.getItem(STORE_KEY); return r ? JSON.parse(r) : null; } catch(e) { return null; }
}
function saveState(s) { localStorage.setItem(STORE_KEY, JSON.stringify(s)); }

// --- Plan Generation ---
// Generate a training plan that fits between now and race day.
// Weekly pattern: 月=休息, 火=ジョグ, 水=インターバル, 木=ジョグ, 金=ジョグ, 土=テンポ走, 日=ロング走
function generatePlanData(raceType, targetSeconds, raceDate) {
  const paces = calcPaces(targetSeconds, raceType);
  const dist = RACE_DISTANCES[raceType] || 42.195;

  // Calculate weeks from next Monday to race week
  const monday = getMonday(addDays(today(), 1));
  const raceDateObj = fromISO(raceDate);
  const diffDays = Math.floor((raceDateObj - monday) / (24 * 60 * 60 * 1000));
  const totalWeeks = Math.max(1, Math.min(24, Math.ceil(diffDays / 7)));

  // Scale distances by race type and runner speed
  const racePaceSec = targetSeconds / dist;
  const scale = raceType === 'half' ? 0.75 : (racePaceSec < 270 ? 1.2 : racePaceSec < 330 ? 1.0 : 0.85);

  const weeks = [];

  for (let w = 0; w < totalWeeks; w++) {
    // Proportional periodization
    const pct = w / totalWeeks;
    let phase, phaseName;
    if (pct < 0.25)      { phase = 'base';  phaseName = '基礎期'; }
    else if (pct < 0.60) { phase = 'build'; phaseName = 'ビルドアップ期'; }
    else if (pct < 0.85) { phase = 'peak';  phaseName = 'ピーク期'; }
    else                 { phase = 'taper'; phaseName = 'テーパリング期'; }

    // Recovery weeks at phase transitions (only for plans >= 8 weeks)
    const baseEnd = Math.ceil(totalWeeks * 0.25);
    const buildEnd = Math.ceil(totalWeeks * 0.60);
    const isRecovery = totalWeeks >= 8 && (w === baseEnd || w === buildEnd);
    const volMult = isRecovery ? 0.7 : 1.0;

    const progress = 1 + (pct * 0.7);
    const taperFactor = phase === 'taper' ? 0.65 - ((pct - 0.85) / 0.15) * 0.2 : 1.0;
    const factor = progress * taperFactor * volMult;

    // Distance calculations — all rounded to whole km
    const jogDist = Math.round(7 * scale * Math.min(factor, 1.5));
    const jogShortDist = Math.round(5 * scale * Math.min(factor, 1.3));
    const tempoDist = Math.round(10 * scale * factor);
    const longBase = 14 + (pct * 16); // 14km → 30km progression
    const maxLong = raceType === 'half' ? 18 : 32;
    const longDist = Math.min(maxLong, Math.round(longBase * scale * taperFactor * volMult));

    const intv = INTERVALS[w % INTERVALS.length];
    // Interval total = warmup 2km + reps distance + cooldown 2km
    const intvMatch = intv.reps.match(/(\d+)m\s*[×x]\s*(\d+)/);
    const repsDist = intvMatch ? (parseInt(intvMatch[1]) * parseInt(intvMatch[2])) / 1000 : 4;
    const intervalDist = Math.round(2 + repsDist + 2); // W-up + reps + C-down
    const weekStart = addDays(monday, w * 7);

    // Weekly pattern: 休息1日 + ジョグ3日 + インターバル1日 + テンポ走1日 + ロング走1日
    const days = [
      { type: 'rest',     name: '休息',     dist: 0,            pace: '-' },
      { type: 'easy',     name: 'ジョグ',    dist: jogDist,      pace: paces.easy },
      { type: 'interval', name: intv.reps + ' インターバル', dist: intervalDist, pace: paces.interval, detail: intv },
      { type: 'easy',     name: 'ジョグ',    dist: jogShortDist, pace: paces.easy },
      { type: 'easy',     name: 'ジョグ',    dist: jogDist,      pace: paces.easy },
      { type: 'tempo',    name: 'テンポ走',   dist: tempoDist,    pace: paces.tempo },
      { type: 'long',     name: 'ロング走',   dist: longDist,     pace: paces.long }
    ];

    const weekDays = days.map((d, i) => ({
      ...d,
      date: toISO(addDays(weekStart, i)),
      dayJa: DAYS_JA[i],
      dayEn: DAYS_EN[i]
    }));

    const totalDist = weekDays.reduce((s, d) => s + d.dist, 0);

    weeks.push({
      weekNum: w + 1, phase, phaseName, isRecovery,
      startDate: toISO(weekStart),
      days: weekDays,
      totalDist: Math.round(totalDist)
    });
  }
  return weeks;
}

// --- Helpers ---
function buildSteps(steps) {
  return steps.map((s, i) =>
    `<li>
      <span class="step-index" style="background:${s.color}">${i + 1}</span>
      <div class="step-info"><div class="step-label">${s.label}</div><div class="step-meta">${s.meta}</div></div>
      <span class="step-pace">${s.pace}</span>
    </li>`
  ).join('');
}

function estimateTime(dist, paceStr) {
  if (!paceStr || paceStr === '-' || dist === 0) return '—';
  const parts = paceStr.replace('/km', '').split(':');
  const paceMin = parseInt(parts[0]) + parseInt(parts[1]) / 60;
  const totalMin = Math.round(dist * paceMin);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}` : `${m}分`;
}

function launchConfetti() {
  const container = document.getElementById('confetti-container');
  container.innerHTML = '';
  const colors = ['#007AFF','#34C759','#FF9500','#5856D6','#FF3B30','#FFCC00','#5AC8FA'];
  for (let i = 0; i < 60; i++) {
    const c = document.createElement('div');
    c.classList.add('confetti');
    c.style.left = Math.random() * 100 + '%';
    c.style.background = colors[Math.floor(Math.random() * colors.length)];
    c.style.width = (Math.random() * 8 + 4) + 'px';
    c.style.height = (Math.random() * 8 + 4) + 'px';
    c.style.animationDuration = (Math.random() * 2 + 1.5) + 's';
    c.style.animationDelay = (Math.random() * 0.8) + 's';
    if (Math.random() > 0.5) c.style.borderRadius = '50%';
    container.appendChild(c);
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// --- App ---
const App = {
  state: null,

  init() {
    this.state = loadState();

    if (this.state && this.state.plan) {
      this.renderGoalScreen();
      this.renderToday();
      this.renderPlan();
      this.renderMonthlyChart();
    } else {
      this.renderGoalScreen();
      this.showEmptyState();
      this.switchTab('goal', document.querySelector('[data-tab="goal"]'));
    }

    // Init Firebase Social
    if (typeof Social !== 'undefined') {
      Social.init();
    }
    // Render share section (always available)
    this.renderShare();
    // Render friends section (depends on auth state)
    this.renderFriends();

    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  },

  // --- Auth ---
  onAuthChanged(user) {
    if (user) {
      this.syncToCloud();
      this.renderFriends();
    } else {
      this.renderFriends();
    }
  },

  async doLogin() {
    if (typeof Social === 'undefined') return;
    await Social.login();
  },

  async doLogout() {
    if (typeof Social === 'undefined') return;
    await Social.logout();
  },

  async syncToCloud() {
    if (typeof Social === 'undefined' || !this.state) return;
    await Social.syncToCloud(this.state);
  },

  // --- Share ---
  buildShareText() {
    if (!this.state || !this.state.plan) return null;
    const s = this.state;
    const lines = [];
    lines.push(`Runner Coach - トレーニングプラン`);
    lines.push(`${s.raceName || 'レース'} (${s.raceType === 'full' ? 'フル' : 'ハーフ'})`);
    const h = Math.floor((s.targetHours || 0));
    const m = s.targetMinutes || 0;
    lines.push(`目標タイム: ${h}時間${m}分`);
    lines.push(`レース日: ${s.raceDate}`);
    lines.push('');

    const todayDate = today();
    let currentWeek = null;
    for (const week of s.plan) {
      const weekStart = fromISO(week.days[0].date);
      const weekEnd = addDays(weekStart, 6);
      if (todayDate >= weekStart && todayDate <= weekEnd) { currentWeek = week; break; }
    }
    if (currentWeek) {
      lines.push(`--- 今週 (Week ${currentWeek.weekNum}) ---`);
      for (const day of currentWeek.days) {
        const done = s.completed && s.completed[day.date];
        const mark = done ? '[v]' : '[ ]';
        if (day.type === 'rest') lines.push(`${mark} ${day.dayJa} 休息`);
        else lines.push(`${mark} ${day.dayJa} ${day.name} ${day.dist}km`);
      }
      const activeDays = currentWeek.days.filter(d => d.type !== 'rest').length;
      const completedActive = currentWeek.days.filter(d => d.type !== 'rest' && s.completed && s.completed[d.date]).length;
      lines.push(`進捗: ${completedActive}/${activeDays}日完了`);
    }

    let streak = 0;
    const d = new Date(); d.setHours(0,0,0,0);
    if (!(s.completed && s.completed[toISO(d)])) d.setDate(d.getDate() - 1);
    while (s.completed && s.completed[toISO(d)]) { streak++; d.setDate(d.getDate() - 1); }
    if (streak > 0) { lines.push(''); lines.push(`${streak}日連続トレーニング中!`); }

    return lines.join('\n');
  },

  renderShare() {
    const el = document.getElementById('share-content');
    if (!el) return;

    if (!this.state || !this.state.plan) {
      el.innerHTML = '';
      return;
    }

    const shareText = this.buildShareText();
    let html = `<div class="section">
      <div class="section-header">プランをシェア</div>
      <div class="card share-preview">${escapeHtml(shareText).replace(/\n/g, '<br>')}</div>
    </div>
    <div class="section" style="padding-top:0">
      <div class="share-buttons">
        <button class="share-btn share-btn-line" onclick="App.shareViaLine()">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.064-.023.134-.034.2-.034.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/></svg>
          LINE
        </button>
        <button class="share-btn share-btn-x" onclick="App.shareViaX()">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
          X
        </button>
        <button class="share-btn share-btn-copy" onclick="App.shareCopy()">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
          コピー
        </button>
        <button class="share-btn share-btn-other" onclick="App.shareNative()" id="share-native-btn">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
          その他
        </button>
      </div>
    </div>`;

    el.innerHTML = html;
    if (!navigator.share) {
      const btn = document.getElementById('share-native-btn');
      if (btn) btn.style.display = 'none';
    }
  },

  shareViaLine() {
    const text = this.buildShareText();
    if (!text) return;
    window.open('https://line.me/R/msg/text/?' + encodeURIComponent(text), '_blank');
  },

  shareViaX() {
    if (!this.state) return;
    const s = this.state;
    const h = Math.floor(s.targetHours || 0);
    const m = s.targetMinutes || 0;
    let streak = 0;
    const d = new Date(); d.setHours(0,0,0,0);
    if (!(s.completed && s.completed[toISO(d)])) d.setDate(d.getDate() - 1);
    while (s.completed && s.completed[toISO(d)]) { streak++; d.setDate(d.getDate() - 1); }
    let tweet = `${s.raceName || 'レース'}に向けてトレーニング中!\n目標: ${h}時間${m}分`;
    if (streak > 0) tweet += `\n${streak}日連続トレーニング達成!`;
    tweet += '\n#RunnerCoach #ランニング';
    window.open('https://x.com/intent/tweet?text=' + encodeURIComponent(tweet), '_blank');
  },

  shareCopy() {
    const text = this.buildShareText();
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      const btn = document.querySelector('.share-btn-copy');
      if (btn) {
        const orig = btn.innerHTML;
        btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> コピー済み!';
        setTimeout(() => { btn.innerHTML = orig; }, 2000);
      }
    }).catch(() => { prompt('テキストをコピー:', text); });
  },

  async shareNative() {
    const text = this.buildShareText();
    if (!text || !navigator.share) return;
    try { await navigator.share({ title: 'Runner Coach', text }); } catch (e) {}
  },

  // --- Friends ---
  renderFriends() {
    const authEl = document.getElementById('friends-auth');
    const el = document.getElementById('friends-content');
    if (!el || !authEl) return;

    const hasSocial = typeof Social !== 'undefined' && Social.enabled;
    const loggedIn = hasSocial && Social.currentUser;

    // Auth area
    if (!hasSocial) {
      authEl.innerHTML = `<div style="text-align:center;padding:var(--space-base);color:var(--color-label-secondary);font-size:var(--font-size-caption1)">
        firebase-config.js を設定すると友達機能が使えます</div>`;
      el.innerHTML = '';
      return;
    }
    if (!loggedIn) {
      authEl.innerHTML = `<button class="login-btn" onclick="App.doLogin()">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg>
        Googleでログインして友達機能を使う</button>`;
      el.innerHTML = '';
      return;
    }

    // Logged in
    authEl.innerHTML = `<div style="display:flex;align-items:center;gap:var(--space-sm);padding:var(--space-sm) var(--space-base);font-size:var(--font-size-caption1);color:var(--color-label-secondary)">
      ${Social.currentUser.displayName || Social.currentUser.email}
      <button onclick="App.doLogout()" style="margin-left:auto;padding:var(--space-xs) var(--space-sm);border:1px solid var(--color-separator-opaque);border-radius:var(--radius-sm);background:none;color:var(--color-label-secondary);font-size:var(--font-size-caption2);font-family:var(--font-family-body);cursor:pointer">ログアウト</button>
    </div>`;

    el.innerHTML = '<div style="text-align:center;padding:var(--space-xl);color:var(--color-label-secondary)">読み込み中...</div>';
    this.renderFriendsLive();
  },

  async renderFriendsLive() {
    const el = document.getElementById('friends-content');
    if (!el) return;

    const myShortId = await Social.getOrCreateUserId();
    const requests = await Social.getIncomingRequests();
    const friends = await Social.loadFriendsData();

    let html = '';

    // My ID
    html += `<div class="section">
      <div class="section-header">あなたのID</div>
      <div class="card my-id-card">
        <div class="my-id-code">${escapeHtml(myShortId || '---')}</div>
        <div class="my-id-actions">
          <button class="id-copy-btn" onclick="App.copyMyId('${escapeHtml(myShortId || '')}')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
            コピー
          </button>
          <button class="id-copy-btn" onclick="App.inviteViaLine('${escapeHtml(myShortId || '')}')">LINE招待</button>
        </div>
      </div>
    </div>`;

    // Add friend
    html += `<div class="section" style="padding-top:0">
      <div class="section-header">友達を追加</div>
      <div class="friend-add-row">
        <input class="form-input" id="friend-id-input" type="text" placeholder="友達のIDを入力" style="flex:1;margin:0" maxlength="8">
        <button class="cta-btn" style="width:auto;margin:0;padding:var(--space-sm) var(--space-base);font-size:var(--font-size-subhead)" onclick="App.sendFriendReq()">追加</button>
      </div>
    </div>`;

    // Pending requests
    if (requests.length > 0) {
      html += '<div class="section" style="padding-top:0"><div class="section-header">リクエスト</div>';
      for (const req of requests) {
        const initial = (req.fromName || '?')[0].toUpperCase();
        html += `<div class="pending-card">
          <div class="friend-avatar" style="background:linear-gradient(135deg,#FF9500,#FF6B00)">${escapeHtml(initial)}</div>
          <div class="friend-info"><div class="friend-name">${escapeHtml(req.fromName)}</div></div>
          <button class="accept-btn" onclick="App.acceptFriend('${req.id}','${req.fromUid}')">承認</button>
          <button class="decline-btn" onclick="App.declineFriend('${req.id}')">拒否</button>
        </div>`;
      }
      html += '</div>';
    }

    // Friends list with streak + week progress
    if (friends.length > 0) {
      html += '<div class="section" style="padding-top:0"><div class="section-header">友達</div>';
      for (const f of friends) {
        const streak = Social.calcStreak(f.completed);
        const weekProg = Social.calcWeekProgress(f.completed);
        const initial = (f.displayName || '?')[0].toUpperCase();
        const photo = f.photoURL
          ? `<img class="friend-avatar" src="${escapeHtml(f.photoURL)}" alt="">`
          : `<div class="friend-avatar" style="background:linear-gradient(135deg,#5AC8FA,#007AFF)">${escapeHtml(initial)}</div>`;

        const goal = f.settings
          ? `${escapeHtml(f.settings.raceName || '')}${f.settings.targetTime ? ' ' + escapeHtml(f.settings.targetTime) : ''}`
          : '';

        // Week dots (Mon-Sun)
        const mon = getMonday(today());
        const weekDots = [];
        for (let i = 0; i < 7; i++) {
          const dateStr = toISO(addDays(mon, i));
          const done = f.completed && f.completed[dateStr];
          weekDots.push(`<div class="friend-week-dot${done ? ' done' : ''}" title="${DAYS_JA[i]}"></div>`);
        }

        html += `<div class="friend-card">
          ${photo}
          <div class="friend-info">
            <div class="friend-name">${escapeHtml(f.displayName || 'ユーザー')}</div>
            ${goal ? `<div class="friend-goal">${goal}</div>` : ''}
            <div class="friend-stats">
              <span><span class="stat-highlight">${streak}</span>日連続</span>
              <span>今週 <span class="stat-highlight">${weekProg.done}</span>/7日</span>
            </div>
            <div class="friend-week">${weekDots.join('')}</div>
          </div>
        </div>`;
      }
      html += '</div>';
    } else if (requests.length === 0) {
      html += `<div style="text-align:center;padding:var(--space-xl) var(--space-base);color:var(--color-label-secondary);font-size:var(--font-size-footnote)">
        IDを共有して友達を追加しよう</div>`;
    }

    el.innerHTML = html;
  },

  copyMyId(id) {
    if (!id) return;
    navigator.clipboard.writeText(id).then(() => {
      const btn = document.querySelector('.id-copy-btn');
      if (btn) { const orig = btn.innerHTML; btn.textContent = 'コピー済み!'; setTimeout(() => { btn.innerHTML = orig; }, 1500); }
    }).catch(() => { prompt('IDをコピー:', id); });
  },

  inviteViaLine(id) {
    if (!id) return;
    const msg = `Runner Coachで一緒にトレーニングしよう!\n私のID: ${id}\nアプリの「シェア」タブで友達追加してね!`;
    window.open('https://line.me/R/msg/text/?' + encodeURIComponent(msg), '_blank');
  },

  async sendFriendReq() {
    const input = document.getElementById('friend-id-input');
    if (!input) return;
    const shortId = input.value.trim().toUpperCase();
    if (!shortId) { alert('IDを入力してください'); return; }
    const users = await Social.searchUserByShortId(shortId);
    if (users.length === 0) { alert('ユーザーが見つかりません'); return; }
    const target = users[0];
    const ok = await Social.sendFriendRequest(target.uid);
    if (ok) { alert(`${target.displayName || 'ユーザー'} にリクエストを送信しました`); input.value = ''; }
    else { alert('送信できませんでした（既に送信済みか友達です）'); }
  },

  async acceptFriend(requestId, fromUid) {
    await Social.acceptRequest(requestId, fromUid);
    this.renderFriendsLive();
  },

  async declineFriend(requestId) {
    await Social.declineRequest(requestId);
    this.renderFriendsLive();
  },

  // --- Tab Switching ---
  switchTab(id, el) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('screen-' + id).classList.add('active');
    document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
    if (el) el.classList.add('active');
    window.scrollTo(0, 0);
  },

  // --- Empty State ---
  showEmptyState() {
    document.getElementById('today-subtitle').textContent = 'プランを作成してください';
    document.getElementById('today-content').innerHTML =
      '<div class="empty-state"><div class="empty-icon">\u{1F3C3}</div>' +
      '<div class="empty-text">まだプランがありません<br>目標を設定してプランを作成しましょう</div>' +
      '<button class="empty-btn" onclick="App.switchTab(\'goal\',document.querySelector(\'[data-tab=goal]\'))">目標を設定する</button></div>';
    document.getElementById('plan-subtitle').textContent = '';
    document.getElementById('plan-content').innerHTML =
      '<div class="empty-state"><div class="empty-icon">\u{1F4CB}</div>' +
      '<div class="empty-text">プランを作成すると<br>ここに表示されます</div></div>';
  },

  // --- Goal Screen ---
  renderGoalScreen() {
    const el = document.getElementById('goal-form-area');
    if (!el) return;

    // Restore values from state if available
    const s = this.state || {};
    const raceName = s.raceName || '';
    const raceDate = s.raceDate || '';
    const raceType = s.raceType || 'full';
    const targetTime = s.targetTime || '';
    // Parse stored targetTime "H:MM" into hours and minutes
    const timeParts = targetTime.split(':');
    const storedHours = timeParts.length >= 2 ? timeParts[0] : '';
    const storedMinutes = timeParts.length >= 2 ? timeParts[1] : '';

    el.innerHTML = `
      <div class="form-group">
        <label class="form-label" for="input-race-name">大会名</label>
        <input class="form-input" id="input-race-name" type="text" placeholder="例: 横浜マラソン 2026" value="${escapeHtml(raceName)}">
      </div>
      <div class="form-group">
        <label class="form-label" for="input-race-date">大会日</label>
        <input class="form-input" id="input-race-date" type="date" value="${escapeHtml(raceDate)}">
      </div>
      <div class="form-group">
        <label class="form-label">種目</label>
        <div class="form-toggle-group">
          <button class="form-toggle${raceType === 'full' ? ' active' : ''}" onclick="App.setRaceType('full',this)">フルマラソン</button>
          <button class="form-toggle${raceType === 'half' ? ' active' : ''}" onclick="App.setRaceType('half',this)">ハーフマラソン</button>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">目標タイム</label>
        <div class="time-input-group">
          <input class="form-input time-input" id="input-target-hours" type="number" inputmode="numeric" min="0" max="9" placeholder="3" value="${escapeHtml(storedHours)}">
          <span class="time-separator">時間</span>
          <input class="form-input time-input" id="input-target-minutes" type="number" inputmode="numeric" min="0" max="59" placeholder="30" value="${escapeHtml(storedMinutes)}">
          <span class="time-separator">分</span>
        </div>
        <div class="form-hint" id="pace-preview"></div>
      </div>`;

    // Live pace preview
    this._raceType = raceType;
    document.getElementById('input-target-hours').addEventListener('input', () => this.updatePacePreview());
    document.getElementById('input-target-minutes').addEventListener('input', () => this.updatePacePreview());
    this.updatePacePreview();
  },

  _raceType: 'full',

  setRaceType(type, el) {
    this._raceType = type;
    el.parentElement.querySelectorAll('.form-toggle').forEach(b => b.classList.remove('active'));
    el.classList.add('active');
    this.updatePacePreview();
  },

  updatePacePreview() {
    const hoursInput = document.getElementById('input-target-hours');
    const minutesInput = document.getElementById('input-target-minutes');
    const preview = document.getElementById('pace-preview');
    if (!hoursInput || !minutesInput || !preview) return;

    const h = parseInt(hoursInput.value, 10);
    const m = parseInt(minutesInput.value, 10);
    if (isNaN(h) && isNaN(m)) { preview.textContent = ''; return; }
    const sec = (h || 0) * 3600 + (m || 0) * 60;
    if (!sec) {
      preview.textContent = '';
      return;
    }
    const dist = RACE_DISTANCES[this._raceType] || 42.195;
    const pacePerKm = sec / dist;
    const paces = calcPaces(sec, this._raceType);
    preview.innerHTML = `レースペース: ${formatPace(pacePerKm)}<br>Easy ${paces.easy} / Tempo ${paces.tempo} / Interval ${paces.interval}`;
  },

  // --- Generate Plan ---
  generatePlan() {
    const raceName = (document.getElementById('input-race-name').value || '').trim();
    const raceDate = (document.getElementById('input-race-date').value || '').trim();
    const targetHours = (document.getElementById('input-target-hours').value || '').trim();
    const targetMinutes = (document.getElementById('input-target-minutes').value || '').trim();
    const raceType = this._raceType;

    // Validation
    if (!raceName) { alert('大会名を入力してください'); return; }
    if (!raceDate) { alert('大会日を選択してください'); return; }
    const h = parseInt(targetHours, 10);
    const m = parseInt(targetMinutes, 10);
    if ((isNaN(h) && isNaN(m)) || ((h || 0) === 0 && (m || 0) === 0)) {
      alert('目標タイムを入力してください'); return;
    }
    const targetSec = (h || 0) * 3600 + (m || 0) * 60;
    const targetTime = (h || 0) + ':' + String(m || 0).padStart(2, '0');

    const paces = calcPaces(targetSec, raceType);
    const dist = RACE_DISTANCES[raceType];
    const racePace = formatPace(targetSec / dist);
    const weeks = generatePlanData(raceType, targetSec, raceDate);

    this.state = {
      raceName, raceDate, raceType, targetTime,
      targetSeconds: targetSec,
      racePace,
      paces,
      plan: weeks,
      completed: this.state ? (this.state.completed || {}) : {}
    };
    saveState(this.state);

    this.renderToday();
    this.renderPlan();
    this.renderMonthlyChart();
    this.renderShare();
    this.syncToCloud();
    this.switchTab('today', document.querySelector('[data-tab="today"]'));
  },

  // --- Get Today's Workout ---
  getTodayWorkout() {
    if (!this.state || !this.state.plan) return null;
    const todayStr = toISO(today());
    for (const week of this.state.plan) {
      for (const day of week.days) {
        if (day.date === todayStr) return { ...day, weekNum: week.weekNum, phaseName: week.phaseName, totalWeeks: this.state.plan.length };
      }
    }
    return null;
  },

  getCurrentWeek() {
    if (!this.state || !this.state.plan) return null;
    const todayStr = toISO(today());
    for (const week of this.state.plan) {
      for (const day of week.days) {
        if (day.date === todayStr) return week;
      }
    }
    if (todayStr < this.state.plan[0].days[0].date) return this.state.plan[0];
    return this.state.plan[this.state.plan.length - 1];
  },

  isCompleted(dateStr) {
    return this.state && this.state.completed && this.state.completed[dateStr];
  },

  // --- Render Today ---
  renderToday() {
    const workout = this.getTodayWorkout();
    const week = this.getCurrentWeek();
    const paces = this.state.paces;

    if (!week) {
      document.getElementById('today-subtitle').textContent = `${this.state.raceName}`;
      document.getElementById('today-content').innerHTML =
        '<div class="empty-state"><div class="empty-icon">\u{1F4C5}</div>' +
        '<div class="empty-text">今日はプラン期間外です<br>プランは ' + this.state.plan[0].days[0].date + ' から開始します</div></div>';
      return;
    }

    const todayStr = toISO(today());
    const done = this.isCompleted(todayStr);
    const weekCompleted = week.days.filter(d => this.isCompleted(d.date)).length;
    const weekWorkouts = week.days.filter(d => d.type !== 'rest').length;
    const weekCompletedDist = week.days.filter(d => this.isCompleted(d.date)).reduce((s, d) => s + d.dist, 0);
    const weekRemainDist = Math.round(week.totalDist - weekCompletedDist);
    const progressPct = weekWorkouts > 0 ? Math.round((weekCompleted / weekWorkouts) * 100) : 0;
    const circumference = 2 * Math.PI * 34;
    const dashoffset = circumference * (1 - progressPct / 100);

    document.getElementById('today-subtitle').textContent =
      `Week ${week.weekNum} / ${this.state.plan.length} — ${this.state.raceName}`;

    const w = workout || week.days[0];
    const heroType = w.type;
    const heroName = w.name;
    const heroDist = w.dist > 0 ? `合計 ${w.dist}km` : '休息日';
    const heroDetail = w.dist > 0 ? `${heroDist}・推定 ${estimateTime(w.dist, w.pace)}` : heroDist;

    let stepsHTML = '';
    if (w.type === 'interval' && w.detail) {
      stepsHTML = buildSteps([
        { label: 'ウォームアップ', meta: 'ゆっくりジョグ', pace: paces.recovery, color: 'var(--color-easy-run)' },
        { label: w.detail.reps + ' ダッシュ', meta: '間に' + w.detail.rest + '休息', pace: paces.interval, color: 'var(--color-interval)' },
        { label: 'クールダウン', meta: 'ゆっくりジョグ', pace: paces.recovery, color: 'var(--color-easy-run)' }
      ]);
    } else if (w.type === 'tempo') {
      stepsHTML = buildSteps([
        { label: 'ウォームアップ', meta: '2km ジョグ', pace: paces.easy, color: 'var(--color-easy-run)' },
        { label: 'テンポ走', meta: `${Math.round(w.dist - 4)}km`, pace: paces.tempo, color: 'var(--color-tempo-run)' },
        { label: 'クールダウン', meta: '2km ジョグ', pace: paces.easy, color: 'var(--color-easy-run)' }
      ]);
    } else if (w.type === 'long') {
      const third = Math.round(w.dist / 3);
      stepsHTML = buildSteps([
        { label: 'イージースタート', meta: `${third}km`, pace: paces.easy, color: 'var(--color-easy-run)' },
        { label: 'ステディペース', meta: `${third}km`, pace: paces.long, color: 'var(--color-long-run)' },
        { label: 'イージーフィニッシュ', meta: `${third}km`, pace: paces.easy, color: 'var(--color-easy-run)' }
      ]);
    } else if (w.type === 'easy' || w.type === 'recovery') {
      stepsHTML = buildSteps([
        { label: w.name, meta: `${w.dist}km 一定ペース`, pace: w.pace, color: TYPE_COLORS[w.type] }
      ]);
    }

    // Week scroll
    const weekScrollHTML = week.days.map(d => {
      const date = fromISO(d.date);
      const isToday = d.date === todayStr;
      const isDone = this.isCompleted(d.date);
      return `<div class="day-card${isToday ? ' today' : ''}${isDone ? ' completed' : ''}">
        <div class="day-label">${d.dayEn}</div>
        <div class="day-date">${date.getDate()}</div>
        <span class="day-type" style="background:${TYPE_COLORS[d.type]}">${TYPE_LABELS[d.type]}</span>
      </div>`;
    }).join('');

    // Bar chart: show weeks around current
    const currentWeekIdx = this.state.plan.indexOf(week);
    const barWeeks = [];
    for (let i = Math.max(0, currentWeekIdx - 2); i < Math.min(this.state.plan.length, currentWeekIdx + 3); i++) {
      barWeeks.push(this.state.plan[i]);
    }
    const maxDist = Math.max(...barWeeks.map(bw => bw.totalDist));
    const barChartHTML = barWeeks.map(bw => {
      const h = Math.round((bw.totalDist / maxDist) * 80);
      const isCurrent = bw.weekNum === week.weekNum;
      const completedDist = bw.days.filter(d => this.isCompleted(d.date)).reduce((s, d) => s + d.dist, 0);
      const showDist = isCurrent ? Math.round(completedDist) : Math.round(bw.totalDist);
      const barStyle = isCurrent
        ? `height:${h}px;background:var(--color-brand-primary)`
        : bw.weekNum > week.weekNum
          ? `height:${h}px;background:var(--color-fill-tertiary);border:1px dashed var(--color-separator)`
          : `height:${h}px;background:var(--color-fill-primary)`;
      return `<div class="bar-col"><div class="bar-value">${showDist}</div><div class="bar" style="${barStyle}"></div><div class="bar-label">W${bw.weekNum}</div></div>`;
    }).join('');

    const btnHTML = w.type === 'rest'
      ? ''
      : done
        ? `<button class="start-btn completed-btn">\u2713 完了済み</button>`
        : `<button class="start-btn" onclick="App.completeToday()">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            トレーニング完了</button>`;

    // Pace summary card
    const paceSummary = `<div class="section" style="padding-top:0">
      <div class="section-header">自動算出ペース</div>
      <div class="card">
        <div class="pace-grid">
          <div class="pace-item"><div class="pace-label">レース</div><div class="pace-value">${this.state.racePace}</div></div>
          <div class="pace-item"><div class="pace-label">Easy</div><div class="pace-value">${paces.easy}/km</div></div>
          <div class="pace-item"><div class="pace-label">Tempo</div><div class="pace-value">${paces.tempo}/km</div></div>
          <div class="pace-item"><div class="pace-label">Interval</div><div class="pace-value">${paces.interval}/km</div></div>
          <div class="pace-item"><div class="pace-label">Long</div><div class="pace-value">${paces.long}/km</div></div>
          <div class="pace-item"><div class="pace-label">Recovery</div><div class="pace-value">${paces.recovery}/km</div></div>
        </div>
      </div>
    </div>`;

    document.getElementById('today-content').innerHTML = `
      <div class="today-hero type-${heroType}">
        <div class="workout-type">${TYPE_JA[heroType] || heroType}</div>
        <div class="workout-name">${heroName}</div>
        <div class="workout-detail">${heroDetail}</div>
        ${btnHTML}
      </div>
      ${stepsHTML ? `<div class="section"><div class="section-header">メニュー詳細</div><div class="card"><ul class="workout-steps">${stepsHTML}</ul></div></div>` : ''}
      <div class="section" style="padding-top:0">
        <div class="section-header mx">今週のプラン</div>
        <div class="week-scroll">${weekScrollHTML}</div>
      </div>
      <div class="section" style="padding-top:0">
        <div class="section-header">今週の進捗</div>
        <div class="card">
          <div class="progress-section">
            <div class="progress-ring-wrap">
              <svg class="progress-ring" width="80" height="80" viewBox="0 0 80 80">
                <circle class="progress-ring-bg" cx="40" cy="40" r="34"/>
                <circle class="progress-ring-fill" cx="40" cy="40" r="34"
                  stroke-dasharray="${circumference}" stroke-dashoffset="${dashoffset}"/>
              </svg>
              <div class="progress-ring-text">${progressPct}%</div>
            </div>
            <div class="progress-info">
              <div class="progress-label">${weekCompleted} / ${weekWorkouts} ワークアウト完了</div>
              <div class="progress-detail">今週あと ${weekRemainDist}km 残り</div>
            </div>
          </div>
        </div>
      </div>
      ${paceSummary}
      <div class="section" style="padding-top:0">
        <div class="section-header">週間走行距離</div>
        <div class="card">
          <div class="bar-chart">${barChartHTML}</div>
          <div class="text-sm text-secondary" style="text-align:center;margin-top:var(--space-xs)">
            W${week.weekNum}: ${Math.round(weekCompletedDist)} / ${week.totalDist} km
          </div>
        </div>
      </div>`;
  },

  // --- Render Plan ---
  renderPlan() {
    const raceTypeLabel = this.state.raceType === 'half' ? 'ハーフ' : 'フル';
    document.getElementById('plan-subtitle').textContent =
      `${this.state.raceName}・${raceTypeLabel}・目標 ${this.state.targetTime}`;

    const todayStr = toISO(today());
    const raceDate = this.state.raceDate || '';
    let html = '';

    for (const week of this.state.plan) {
      // Week header with date range
      const firstDate = fromISO(week.days[0].date);
      const lastDate = fromISO(week.days[6].date);
      const dateRange = `${String(firstDate.getMonth()+1).padStart(2,'0')}/${String(firstDate.getDate()).padStart(2,'0')} - ${String(lastDate.getMonth()+1).padStart(2,'0')}/${String(lastDate.getDate()).padStart(2,'0')}`;
      const recoveryTag = week.isRecovery ? ' (回復週)' : '';
      const label = `Week ${week.weekNum} — ${week.phaseName}${recoveryTag}　${dateRange}`;
      html += `<div class="plan-week"><div class="plan-week-header mt-lg">${label}</div><ul class="plan-list mx">`;

      for (const day of week.days) {
        const done = this.isCompleted(day.date);
        const isRaceDay = day.date === raceDate;
        const d = fromISO(day.date);
        const dateLabel = `${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`;

        if (isRaceDay) {
          // Race day special row
          html += `<li class="plan-item plan-item-race">
            <span class="plan-dot" style="background:var(--color-interval)"></span>
            <span class="plan-day">${day.dayJa}</span>
            <span class="plan-date">${dateLabel}</span>
            <span class="plan-name plan-race-label">レース本番!</span>
            <span class="plan-check${done ? ' done' : ''}" onclick="App.toggleComplete('${day.date}')"></span>
          </li>`;
        } else {
          const distLabel = day.dist > 0 ? day.dist + 'km' : '—';
          html += `<li class="plan-item" onclick="App.openEditWorkout(${this.state.plan.indexOf(week)}, ${week.days.indexOf(day)}, event)">
            <span class="plan-dot" style="background:${TYPE_COLORS[day.type]}"></span>
            <span class="plan-day">${day.dayJa}</span>
            <span class="plan-date">${dateLabel}</span>
            <span class="plan-name">${day.name}</span>
            <span class="plan-dist">${distLabel}</span>
            <span class="plan-check${done ? ' done' : ''}" onclick="event.stopPropagation();App.toggleComplete('${day.date}')"></span>
          </li>`;
        }
      }
      html += '</ul></div>';
    }

    document.getElementById('plan-content').innerHTML = html;

    setTimeout(() => {
      const planContent = document.getElementById('plan-content');
      const currentWeek = this.getCurrentWeek();
      if (currentWeek) {
        const weekEls = planContent.querySelectorAll('.plan-week');
        const idx = this.state.plan.indexOf(currentWeek);
        if (weekEls[idx]) weekEls[idx].scrollIntoView({ behavior: 'auto', block: 'start' });
      }
    }, 100);
  },

  // --- Monthly Chart (appended to today tab) ---
  renderMonthlyChart() {
    // Remove old monthly content if exists
    const old = document.getElementById('monthly-chart-section');
    if (old) old.remove();

    const todayEl = document.getElementById('today-content');
    if (!todayEl || !this.state || !this.state.plan) return;

    // Gather all plan days into a map: month -> { planned, completed }
    const months = {};
    for (const week of this.state.plan) {
      for (const day of week.days) {
        const ym = day.date.substring(0, 7); // "YYYY-MM"
        if (!months[ym]) months[ym] = { planned: 0, completed: 0 };
        months[ym].planned += day.dist;
        if (this.isCompleted(day.date)) months[ym].completed += day.dist;
      }
    }

    const sortedMonths = Object.keys(months).sort();
    if (sortedMonths.length === 0) return;

    const maxDist = Math.max(...sortedMonths.map(m => months[m].planned));

    const barsHTML = sortedMonths.map(ym => {
      const d = months[ym];
      const plannedH = Math.round((d.planned / maxDist) * 120);
      const label = ym.split('-')[1] + '月';
      return `<div class="monthly-col">
        <div class="monthly-values">
          <span class="monthly-val-done">${Math.round(d.completed)}</span>
          <span class="monthly-val-plan">/ ${Math.round(d.planned)}</span>
        </div>
        <div class="monthly-bar-wrap" style="height:${plannedH}px">
          <div class="monthly-bar-planned" style="height:100%"></div>
          <div class="monthly-bar-done" style="height:${d.planned > 0 ? Math.round((d.completed / d.planned) * 100) : 0}%"></div>
        </div>
        <div class="monthly-label">${label}</div>
      </div>`;
    }).join('');

    const section = document.createElement('div');
    section.id = 'monthly-chart-section';
    section.innerHTML = `
      <div class="section" style="padding-top:0">
        <div class="section-header">月間走行距離 (km)</div>
        <div class="card">
          <div class="monthly-chart">${barsHTML}</div>
          <div class="monthly-legend">
            <span class="legend-item"><span class="legend-dot done"></span>完了</span>
            <span class="legend-item"><span class="legend-dot planned"></span>予定</span>
          </div>
        </div>
      </div>`;
    todayEl.appendChild(section);
  },

  // --- Edit Workout ---
  openEditWorkout(weekIdx, dayIdx, event) {
    // Don't open editor when clicking the check button
    if (event && event.target.classList.contains('plan-check')) return;

    const day = this.state.plan[weekIdx].days[dayIdx];
    if (!day) return;

    const d = fromISO(day.date);
    const dateLabel = `${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')} (${day.dayJa})`;

    // Workout type options
    const typeOptions = [
      { value: 'easy', label: 'ジョグ' },
      { value: 'interval', label: 'インターバル' },
      { value: 'tempo', label: 'テンポ走' },
      { value: 'long', label: 'ロング走' },
      { value: 'rest', label: '休息' }
    ];
    const optionsHTML = typeOptions.map(o =>
      `<option value="${o.value}"${day.type === o.value ? ' selected' : ''}>${o.label}</option>`
    ).join('');

    const overlay = document.getElementById('edit-overlay');
    overlay.innerHTML = `
      <div class="edit-backdrop" onclick="App.closeEditWorkout()"></div>
      <div class="edit-sheet">
        <div class="edit-sheet-handle"></div>
        <div class="edit-sheet-title">${dateLabel} のメニュー編集</div>
        <div class="edit-field">
          <label class="form-label">練習メニュー</label>
          <select class="form-input edit-select" id="edit-type">${optionsHTML}</select>
        </div>
        <div class="edit-field">
          <label class="form-label">距離 (km)</label>
          <input class="form-input" id="edit-dist" type="number" inputmode="numeric" min="0" max="99" step="1" value="${day.dist}">
        </div>
        <div class="edit-actions">
          <button class="edit-cancel-btn" onclick="App.closeEditWorkout()">キャンセル</button>
          <button class="cta-btn edit-save-btn" onclick="App.saveEditWorkout(${weekIdx},${dayIdx})">保存</button>
        </div>
      </div>`;
    overlay.classList.add('show');
  },

  closeEditWorkout() {
    const overlay = document.getElementById('edit-overlay');
    overlay.classList.remove('show');
    setTimeout(() => { overlay.innerHTML = ''; }, 300);
  },

  saveEditWorkout(weekIdx, dayIdx) {
    const typeEl = document.getElementById('edit-type');
    const distEl = document.getElementById('edit-dist');
    if (!typeEl || !distEl) return;

    const newType = typeEl.value;
    const newDist = Math.round(parseFloat(distEl.value || '0'));
    const day = this.state.plan[weekIdx].days[dayIdx];

    day.type = newType;
    day.name = TYPE_JA[newType] || newType;
    day.dist = newType === 'rest' ? 0 : Math.max(0, newDist);
    if (newType === 'rest') day.pace = '-';
    else if (this.state.paces[newType]) day.pace = this.state.paces[newType];

    // Recalculate week total
    this.state.plan[weekIdx].totalDist = Math.round(
      this.state.plan[weekIdx].days.reduce((s, d) => s + d.dist, 0) * 10
    ) / 10;

    saveState(this.state);
    this.closeEditWorkout();
    this.renderPlan();
    this.renderToday();
    this.renderMonthlyChart();
    this.renderShare();
    this.syncToCloud();
  },

  // --- Toggle Completion ---
  toggleComplete(dateStr) {
    if (!this.state.completed) this.state.completed = {};
    if (this.state.completed[dateStr]) {
      delete this.state.completed[dateStr];
    } else {
      this.state.completed[dateStr] = true;
    }
    saveState(this.state);
    this.renderPlan();
    this.renderToday();
    this.renderMonthlyChart();
    this.renderShare();
    this.syncToCloud();
  },

  // --- Complete Today ---
  completeToday() {
    const todayStr = toISO(today());
    const workout = this.getTodayWorkout();
    if (!this.state.completed) this.state.completed = {};
    this.state.completed[todayStr] = true;
    saveState(this.state);

    this.showCompletion(workout);
    this.renderToday();
    this.renderPlan();
    this.renderMonthlyChart();
    this.renderShare();
    this.syncToCloud();
  },

  // --- Completion Overlay ---
  showCompletion(workout) {
    const overlay = document.getElementById('completion-overlay');
    document.getElementById('completion-subtitle').textContent =
      workout ? `${workout.name} 完了` : 'ワークアウト完了';

    const dist = workout ? workout.dist : 0;
    const time = workout ? estimateTime(dist, workout.pace) : '—';
    document.getElementById('completion-stats').innerHTML = `
      <div class="completion-stat"><div class="stat-value">${dist}</div><div class="stat-label">km</div></div>
      <div class="completion-stat"><div class="stat-value">${time}</div><div class="stat-label">タイム</div></div>
      <div class="completion-stat"><div class="stat-value">${workout ? workout.pace : '—'}</div><div class="stat-label">平均/km</div></div>`;

    overlay.classList.add('show');
    launchConfetti();
    if (navigator.vibrate) navigator.vibrate([50, 30, 100]);
  },

  hideCompletion() {
    document.getElementById('completion-overlay').classList.remove('show');
    document.getElementById('confetti-container').innerHTML = '';
  }
};

// --- Initialize ---
document.addEventListener('DOMContentLoaded', () => App.init());
