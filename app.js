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
  recovery: 'リカバリージョグ', rest: 'レスト', interval: 'インターバル',
  easy: 'イージーラン', cross: 'クロストレーニング', tempo: 'テンポラン', long: 'ロングラン'
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
function generatePlanData(raceType, targetSeconds) {
  const paces = calcPaces(targetSeconds, raceType);
  const dist = RACE_DISTANCES[raceType] || 42.195;
  const totalWeeks = 12;

  // Scale distances by race type and speed
  const racePaceSec = targetSeconds / dist;
  // Faster runners (lower pace) get more volume
  const scale = raceType === 'half' ? 0.75 : (racePaceSec < 270 ? 1.2 : racePaceSec < 330 ? 1.0 : 0.85);

  const weeks = [];
  const monday = getMonday(addDays(today(), 1));

  for (let w = 0; w < totalWeeks; w++) {
    let phase, phaseName;
    if (w < 3) { phase = 'base'; phaseName = '基礎期'; }
    else if (w < 7) { phase = 'build'; phaseName = 'ビルドアップ期'; }
    else if (w < 10) { phase = 'peak'; phaseName = 'ピーク期'; }
    else { phase = 'taper'; phaseName = 'テーパリング期'; }

    const isRecovery = (w === 3 || w === 7);
    const volMult = isRecovery ? 0.7 : 1.0;
    const progress = 1 + (w / totalWeeks) * 0.7;
    const taperFactor = phase === 'taper' ? 0.65 - (w - 10) * 0.1 : 1.0;
    const factor = progress * taperFactor * volMult;

    const recoveryDist = Math.round(5 * scale * Math.min(factor, 1.3) * 10) / 10;
    const easyDist = Math.round(7 * scale * Math.min(factor, 1.5) * 10) / 10;
    const intervalDist = Math.round(8 * scale * Math.min(factor, 1.4) * 10) / 10;
    const tempoDist = Math.round(10 * scale * factor * 10) / 10;
    const longDist = Math.round((14 + w * 1.5) * scale * taperFactor * volMult * 10) / 10;

    const intv = INTERVALS[w % INTERVALS.length];
    const weekStart = addDays(monday, w * 7);

    const days = [
      { type: 'recovery', name: 'リカバリージョグ', dist: recoveryDist, pace: paces.recovery },
      { type: 'rest', name: 'レスト', dist: 0, pace: '-' },
      { type: 'interval', name: intv.reps + ' インターバル', dist: intervalDist, pace: paces.interval, detail: intv },
      { type: 'easy', name: 'イージーラン', dist: easyDist, pace: paces.easy },
      { type: w % 2 === 0 ? 'rest' : 'cross', name: w % 2 === 0 ? 'レスト' : 'クロストレーニング', dist: 0, pace: '-' },
      { type: 'tempo', name: 'テンポラン', dist: tempoDist, pace: paces.tempo },
      { type: 'long', name: 'ロングラン', dist: longDist, pace: paces.long }
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
      totalDist: Math.round(totalDist * 10) / 10
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
    } else {
      this.renderFriendsOffline();
    }

    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  },

  // --- Auth callback from Social ---
  onAuthChanged(user) {
    this.renderAuthUI(user);
    if (user) {
      this.syncToCloud();
      this.renderFriendsLive();
    } else {
      this.renderFriendsOffline();
    }
  },

  renderAuthUI(user) {
    const el = document.getElementById('auth-area');
    if (!el) return;
    if (user) {
      const photo = user.photoURL
        ? `<img class="auth-avatar" src="${escapeHtml(user.photoURL)}" alt="">`
        : `<div class="auth-avatar-placeholder">${escapeHtml((user.displayName || 'U')[0])}</div>`;
      el.innerHTML = `<div class="auth-logged-in">
        ${photo}
        <div class="auth-info">
          <div class="auth-name">${escapeHtml(user.displayName || user.email)}</div>
          <button class="auth-link" onclick="App.doLogout()">ログアウト</button>
        </div>
      </div>`;
    } else {
      const enabled = typeof Social !== 'undefined' && Social.enabled;
      el.innerHTML = enabled
        ? `<button class="login-btn" onclick="App.doLogin()">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg>
            Googleでログイン</button>`
        : `<div class="auth-offline">オフラインモード</div>`;
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
    document.getElementById('monthly-content').innerHTML = '';
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
    const weeks = generatePlanData(raceType, targetSec);

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
    this.switchTab('today', document.querySelector('[data-tab="today"]'));
    this.syncToCloud();
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
    const weekRemainDist = Math.round((week.totalDist - weekCompletedDist) * 10) / 10;
    const progressPct = weekWorkouts > 0 ? Math.round((weekCompleted / weekWorkouts) * 100) : 0;
    const circumference = 2 * Math.PI * 34;
    const dashoffset = circumference * (1 - progressPct / 100);

    document.getElementById('today-subtitle').textContent =
      `Week ${week.weekNum} / ${this.state.plan.length} — ${this.state.raceName}`;

    const w = workout || week.days[0];
    const heroType = w.type;
    const heroName = w.name;
    const heroDist = w.dist > 0 ? `合計 ${w.dist}km` : '休養日';
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
        { label: 'テンポ走', meta: `${Math.round((w.dist - 4) * 10) / 10}km`, pace: paces.tempo, color: 'var(--color-tempo-run)' },
        { label: 'クールダウン', meta: '2km ジョグ', pace: paces.easy, color: 'var(--color-easy-run)' }
      ]);
    } else if (w.type === 'long') {
      const third = Math.round(w.dist / 3 * 10) / 10;
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
            W${week.weekNum}: ${Math.round(weekCompletedDist * 10) / 10} / ${week.totalDist} km
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
    let html = '';

    for (const week of this.state.plan) {
      const label = week.isRecovery ? `Week ${week.weekNum} — ${week.phaseName} (回復週)` : `Week ${week.weekNum} — ${week.phaseName}`;
      html += `<div class="plan-week"><div class="plan-week-header mt-lg">${label}</div><ul class="plan-list mx">`;

      for (const day of week.days) {
        const done = this.isCompleted(day.date);
        const distLabel = day.dist > 0 ? day.dist + 'km' : '—';
        html += `<li class="plan-item">
          <span class="plan-dot" style="background:${TYPE_COLORS[day.type]}"></span>
          <span class="plan-day">${day.dayJa}</span>
          <span class="plan-name">${day.name}</span>
          <span class="plan-dist">${distLabel}</span>
          <span class="plan-check${done ? ' done' : ''}" onclick="App.toggleComplete('${day.date}')"></span>
        </li>`;
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

  // --- Monthly Chart ---
  renderMonthlyChart() {
    const el = document.getElementById('monthly-content');
    if (!el || !this.state || !this.state.plan) { if (el) el.innerHTML = ''; return; }

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
    if (sortedMonths.length === 0) { el.innerHTML = ''; return; }

    const maxDist = Math.max(...sortedMonths.map(m => months[m].planned));

    const barsHTML = sortedMonths.map(ym => {
      const d = months[ym];
      const plannedH = Math.round((d.planned / maxDist) * 120);
      const completedH = Math.round((d.completed / maxDist) * 120);
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

    el.innerHTML = `
      <div class="section">
        <div class="section-header">月間走行距離 (km)</div>
        <div class="card">
          <div class="monthly-chart">${barsHTML}</div>
          <div class="monthly-legend">
            <span class="legend-item"><span class="legend-dot done"></span>完了</span>
            <span class="legend-item"><span class="legend-dot planned"></span>予定</span>
          </div>
        </div>
      </div>`;
  },

  // --- Friends ---
  renderFriendsOffline() {
    const el = document.getElementById('friends-content');
    if (!el) return;
    const hasAuth = typeof Social !== 'undefined' && Social.enabled;
    el.innerHTML = hasAuth
      ? `<div class="empty-state"><div class="empty-icon">\u{1F465}</div>
          <div class="empty-text">ログインするとランニング仲間と<br>トレーニング状況をシェアできます</div>
          <button class="empty-btn" onclick="App.doLogin()">Googleでログイン</button></div>`
      : `<div class="empty-state"><div class="empty-icon">\u{1F465}</div>
          <div class="empty-text">Firebase未設定のため<br>仲間機能はオフラインです</div>
          <div class="text-sm text-secondary mt-md">firebase-config.js を設定してください</div></div>`;
  },

  async renderFriendsLive() {
    const el = document.getElementById('friends-content');
    if (!el || typeof Social === 'undefined' || !Social.currentUser) return;

    el.innerHTML = '<div class="empty-state"><div class="empty-text">読み込み中...</div></div>';

    // Friend request area
    const requests = await Social.getIncomingRequests();
    const friends = await Social.loadFriendsData();

    let html = '';

    // Add friend section
    html += `<div class="section">
      <div class="section-header">仲間を追加</div>
      <div class="card" style="display:flex;gap:var(--space-sm)">
        <input class="form-input" id="friend-email-input" type="email" placeholder="メールアドレスで検索" style="flex:1;margin:0">
        <button class="cta-btn" style="width:auto;margin:0;padding:var(--space-sm) var(--space-base);font-size:var(--font-size-subhead)" onclick="App.sendFriendReq()">追加</button>
      </div>
    </div>`;

    // Pending requests
    if (requests.length > 0) {
      html += '<div class="section" style="padding-top:0"><div class="section-header">フレンドリクエスト</div>';
      for (const req of requests) {
        html += `<div class="friend-card">
          <div class="friend-avatar" style="background:linear-gradient(135deg,#FF9500,#FF6B00)">${escapeHtml((req.fromName || '?')[0])}</div>
          <div class="friend-info">
            <div class="friend-name">${escapeHtml(req.fromName)}</div>
          </div>
          <button class="cta-btn" style="width:auto;margin:0;padding:var(--space-xs) var(--space-md);font-size:var(--font-size-caption1)" onclick="App.acceptFriend('${req.id}','${req.fromUid}')">承認</button>
          <button class="auth-link" onclick="App.declineFriend('${req.id}')">拒否</button>
        </div>`;
      }
      html += '</div>';
    }

    // Friends list
    if (friends.length > 0) {
      html += '<div class="section" style="padding-top:0"><div class="section-header">仲間</div>';
      for (const f of friends) {
        const streak = Social.calcStreak(f.completed);
        const tw = Social.getTodayWorkoutForUser(f);
        const todayLabel = tw ? (tw.done ? `<span class="done-badge">完了!</span>` : tw.label) : '';
        const initial = (f.displayName || f.email || '?')[0].toUpperCase();
        const photo = f.photoURL
          ? `<img class="friend-avatar" src="${escapeHtml(f.photoURL)}" alt="" style="width:48px;height:48px;border-radius:50%">`
          : `<div class="friend-avatar" style="background:linear-gradient(135deg,#5AC8FA,#007AFF)">${escapeHtml(initial)}</div>`;

        const goal = f.settings
          ? `${escapeHtml(f.settings.raceName || '')} ${f.settings.targetTime ? '・目標 ' + escapeHtml(f.settings.targetTime) : ''}`
          : '';

        // Week dots
        const weekDots = [];
        const mon = getMonday(today());
        for (let i = 0; i < 7; i++) {
          const d = toISO(addDays(mon, i));
          const done = f.completed && f.completed[d];
          weekDots.push(`<div class="friend-week-dot${done ? ' done' : ''}"></div>`);
        }

        html += `<div class="friend-card">
          ${photo}
          <div class="friend-info">
            <div class="friend-name">${escapeHtml(f.displayName || f.email)}</div>
            <div class="friend-goal">${goal}</div>
            <div class="friend-today">${todayLabel}</div>
            <div class="friend-week">${weekDots.join('')}</div>
          </div>
          <div class="friend-streak"><div class="streak-num">${streak}</div><div class="streak-label">日連続</div></div>
        </div>`;
      }
      html += '</div>';
    } else if (requests.length === 0) {
      html += `<div class="empty-state" style="padding-top:var(--space-xl)"><div class="empty-icon">\u{1F465}</div>
        <div class="empty-text">まだ仲間がいません<br>メールアドレスで友達を追加しよう</div></div>`;
    }

    el.innerHTML = html;
  },

  async sendFriendReq() {
    const input = document.getElementById('friend-email-input');
    if (!input) return;
    const email = input.value.trim();
    if (!email) { alert('メールアドレスを入力してください'); return; }
    const ok = await Social.sendFriendRequest(email);
    if (ok) {
      alert('リクエストを送信しました');
      input.value = '';
    } else {
      alert('送信できませんでした（既に送信済みか、ユーザーが見つかりません）');
    }
  },

  async acceptFriend(requestId, fromUid) {
    await Social.acceptRequest(requestId, fromUid);
    this.renderFriendsLive();
  },

  async declineFriend(requestId) {
    await Social.declineRequest(requestId);
    this.renderFriendsLive();
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
