// ============================================================
// Runner Coach — App Logic (v2)
// ============================================================

// --- Constants ---
const DAYS_JA = ['月', '火', '水', '木', '金', '土', '日'];
const DAYS_EN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTHS_JA = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

const TYPE_COLORS = {
  jog: 'var(--color-easy-run)', rest: 'var(--color-rest-day)',
  interval: 'var(--color-interval)', tempo: 'var(--color-tempo-run)',
  long: 'var(--color-long-run)'
};
const TYPE_LABELS = {
  jog: 'Jog', rest: 'Rest', interval: 'Intv',
  tempo: 'Tempo', long: 'Long'
};
const TYPE_JA = {
  jog: 'ジョグ', rest: 'レスト', interval: 'インターバル',
  tempo: 'テンポラン', long: 'ロングラン'
};
// Migration map for old type names
const TYPE_MIGRATION = { recovery: 'jog', easy: 'jog', cross: 'jog' };

const INTERVALS = [
  { reps: '400m \u00d7 8', rest: '200m\u30b8\u30e7\u30b0' },
  { reps: '800m \u00d7 5', rest: '200m\u30b8\u30e7\u30b0' },
  { reps: '1000m \u00d7 4', rest: '400m\u30b8\u30e7\u30b0' },
  { reps: '1200m \u00d7 4', rest: '400m\u30b8\u30e7\u30b0' },
  { reps: '1600m \u00d7 3', rest: '400m\u30b8\u30e7\u30b0' },
  { reps: '2000m \u00d7 3', rest: '600m\u30b8\u30e7\u30b0' },
  { reps: '800m \u00d7 6', rest: '200m\u30b8\u30e7\u30b0' },
  { reps: '1000m \u00d7 5', rest: '400m\u30b8\u30e7\u30b0' },
  { reps: '400m \u00d7 10', rest: '200m\u30b8\u30e7\u30b0' },
  { reps: '600m \u00d7 6', rest: '200m\u30b8\u30e7\u30b0' },
  { reps: '800m \u00d7 4', rest: '200m\u30b8\u30e7\u30b0' },
  { reps: '400m \u00d7 6', rest: '200m\u30b8\u30e7\u30b0' }
];

// --- Date Utilities ---
function today() { return new Date(); }
function toISO(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function fromISO(s) { const p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function getMonday(d) {
  const r = new Date(d); r.setHours(0, 0, 0, 0);
  const day = r.getDay();
  r.setDate(r.getDate() - (day === 0 ? 6 : day - 1));
  return r;
}
function sameDay(a, b) { return toISO(a) === toISO(b); }
function weeksBetween(a, b) { return Math.floor((b - a) / (7 * 864e5)); }
function monthKey(dateStr) { return dateStr.slice(0, 7); }

// --- Storage ---
const STORE_KEY = 'runner-coach';
function loadState() { try { return JSON.parse(localStorage.getItem(STORE_KEY)); } catch { return null; } }
function saveState(s) { localStorage.setItem(STORE_KEY, JSON.stringify(s)); }

// --- Pace Calculation ---
function calcPaces(targetTime, raceType) {
  // targetTime: "H:MM" or "H:MM:SS"
  const parts = targetTime.split(':').map(Number);
  let totalMin;
  if (parts.length === 3) totalMin = parts[0] * 60 + parts[1] + parts[2] / 60;
  else totalMin = parts[0] * 60 + (parts[1] || 0);

  const dist = raceType === 'half' ? 21.0975 : 42.195;
  const racePace = totalMin / dist; // min/km

  return {
    race: racePace,
    jog: racePace * 1.2,
    tempo: racePace * 0.97,
    interval: racePace * 0.88,
    long: racePace * 1.1
  };
}

function formatPace(minPerKm) {
  const m = Math.floor(minPerKm);
  const s = Math.round((minPerKm - m) * 60);
  return m + ':' + String(s).padStart(2, '0');
}

// --- Plan Generation ---
function generatePlanData(raceName, raceDate, raceType, targetTime) {
  const paces = calcPaces(targetTime, raceType);
  const raceD = fromISO(raceDate);
  const startMonday = getMonday(today());
  const weeksAvail = weeksBetween(startMonday, raceD);
  const totalWeeks = Math.max(4, Math.min(24, weeksAvail - 1)); // leave taper week before race

  // Volume scale: half = smaller, full = larger
  const scale = raceType === 'half' ? 0.7 : 1.0;
  // Faster runners need more volume
  const paceScale = paces.race < 4.5 ? 1.15 : paces.race < 5.5 ? 1.0 : 0.9;

  const weeks = [];

  for (let w = 0; w < totalWeeks; w++) {
    const frac = w / totalWeeks;
    let phase, phaseName;
    if (frac < 0.25) { phase = 'base'; phaseName = '基礎期'; }
    else if (frac < 0.6) { phase = 'build'; phaseName = 'ビルドアップ期'; }
    else if (frac < 0.85) { phase = 'peak'; phaseName = 'ピーク期'; }
    else { phase = 'taper'; phaseName = 'テーパリング期'; }

    // Recovery weeks every 4th week
    const isRecovery = (w > 0 && w % 4 === 3);
    const volMult = isRecovery ? 0.7 : 1.0;

    // Progressive overload
    const progress = 1 + frac * 0.6;
    const taperFactor = phase === 'taper' ? 0.7 - (frac - 0.85) * 2 : 1.0;
    const factor = progress * taperFactor * volMult * scale * paceScale;

    const jogLightDist = roundKm(5 * Math.min(factor, 1.3));
    const jogDist = roundKm(7 * Math.min(factor, 1.5));
    const tempoDist = roundKm(10 * factor);
    const longBase = raceType === 'half' ? 10 : 14;
    const longDist = roundKm((longBase + w * 1.2) * scale * paceScale * taperFactor * volMult);

    const intv = INTERVALS[w % INTERVALS.length];
    // Interval distance = reps distance only (e.g. 400m×8 = 3.2km)
    const intervalDist = parseRepsDist(intv.reps);
    const weekStart = addDays(startMonday, w * 7);

    const days = [
      { type: 'jog', name: 'ジョグ', dist: jogLightDist, pace: formatPace(paces.jog) },
      { type: 'rest', name: 'レスト', dist: 0, pace: '-' },
      { type: 'interval', name: 'インターバル', dist: intervalDist, pace: formatPace(paces.interval), detail: intv },
      { type: 'jog', name: 'ジョグ', dist: jogDist, pace: formatPace(paces.jog) },
      { type: w % 2 === 0 ? 'rest' : 'jog', name: w % 2 === 0 ? 'レスト' : 'ジョグ', dist: w % 2 === 0 ? 0 : jogLightDist, pace: w % 2 === 0 ? '-' : formatPace(paces.jog) },
      { type: 'tempo', name: 'テンポラン', dist: tempoDist, pace: formatPace(paces.tempo) },
      { type: 'long', name: 'ロングラン', dist: longDist, pace: formatPace(paces.long) }
    ];

    const weekDays = days.map((d, i) => ({
      ...d,
      date: toISO(addDays(weekStart, i)),
      dayJa: DAYS_JA[i],
      dayEn: DAYS_EN[i]
    }));

    weeks.push({
      weekNum: w + 1,
      phase, phaseName, isRecovery,
      startDate: toISO(weekStart),
      days: weekDays,
      totalDist: roundKm(weekDays.reduce((s, d) => s + d.dist, 0))
    });
  }

  return weeks;
}

function roundKm(n) { return Math.round(n); }

// Format distance: intervals show 1 decimal (e.g. 3.2), others show integer
function formatDist(dist, type) {
  if (type === 'interval') {
    const d = Math.round(dist * 10) / 10;
    return d % 1 === 0 ? String(d) : d.toFixed(1);
  }
  return String(Math.round(dist));
}

// Parse reps string like "800m × 5" → total km (e.g. 4.0)
function parseRepsDist(repsStr) {
  const m = repsStr.match(/(\d+)m\s*[×x]\s*(\d+)/i);
  if (!m) return 3;
  return (parseInt(m[1]) * parseInt(m[2])) / 1000;
}

// --- Monthly aggregation ---
function calcMonthlyData(plan, completed) {
  if (!plan) return [];
  const months = {};
  for (const week of plan) {
    for (const day of week.days) {
      const mk = monthKey(day.date);
      if (!months[mk]) months[mk] = { key: mk, planned: 0, completed: 0 };
      months[mk].planned += day.dist;
      if (completed && completed[day.date]) months[mk].completed += day.dist;
    }
  }
  return Object.values(months).map(m => ({
    ...m,
    planned: roundKm(m.planned),
    completed: roundKm(m.completed),
    label: MONTHS_JA[parseInt(m.key.split('-')[1]) - 1]
  }));
}

// ============================================================
// App
// ============================================================
const App = {
  state: null,

  init() {
    this.state = loadState();
    // Migrate old plan data: fix distances and type names
    if (this.state && this.state.plan) {
      let migrated = false;
      for (const week of this.state.plan) {
        for (const day of week.days) {
          // Migrate old type names (recovery/easy/cross → jog)
          if (TYPE_MIGRATION[day.type]) {
            day.type = TYPE_MIGRATION[day.type];
            day.name = TYPE_JA[day.type] || day.name;
            migrated = true;
          }
          // Recalculate interval distances: reps distance only
          if (day.type === 'interval' && day.detail) {
            const correctDist = parseRepsDist(day.detail.reps);
            if (day.dist !== correctDist) {
              day.dist = correctDist;
              migrated = true;
            }
          }
          // Ensure non-interval distances are integers
          if (day.type !== 'interval' && day.dist !== Math.round(day.dist)) {
            day.dist = Math.round(day.dist);
            migrated = true;
          }
        }
        const correctTotal = Math.round(week.days.reduce((s, d) => s + d.dist, 0));
        if (week.totalDist !== correctTotal) {
          week.totalDist = correctTotal;
          migrated = true;
        }
      }
      // Migrate paces: add jog if missing
      if (this.state.paces && !this.state.paces.jog) {
        this.state.paces.jog = this.state.paces.easy || this.state.paces.recovery || '6:00';
        migrated = true;
      }
      if (migrated) saveState(this.state);
    }
    this.renderGoalScreen();

    if (this.state && this.state.plan) {
      this.renderToday();
      this.renderPlan();
    } else {
      this.showEmptyState();
      this.switchTab('goal', document.querySelector('[data-tab="goal"]'));
    }

    // Render friends (offline placeholder or Firebase)
    this.renderFriends();

    // Firebase
    if (typeof Social !== 'undefined') Social.init();

    // Service Worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  },

  // --- Auth callback ---
  onAuthChanged(user) {
    this.renderAuthUI(user);
    this.renderFriends();
    // Sync to cloud
    if (user && this.state && this.state.plan) {
      Social.syncToCloud(this.state);
    }
  },

  renderAuthUI(user, myId) {
    const el = document.getElementById('auth-section');
    if (!el) return;
    if (!Social.enabled) {
      el.innerHTML = '<div class="card mx" style="text-align:center;padding:var(--space-lg)"><div style="font-size:32px;margin-bottom:var(--space-sm)">\u{1F512}</div><div class="text-sm text-secondary">Firebase\u304c\u672a\u8a2d\u5b9a\u3067\u3059\u3002<br>firebase-config.js \u306b\u8a2d\u5b9a\u3092\u8ffd\u52a0\u3059\u308b\u3068<br>Google\u30ed\u30b0\u30a4\u30f3\u3067\u4ef2\u9593\u3068\u3064\u306a\u304c\u308c\u307e\u3059\u3002</div></div>';
      return;
    }
    if (user) {
      const photo = user.photoURL
        ? `<img src="${escapeHtml(user.photoURL)}" style="width:40px;height:40px;border-radius:50%">`
        : `<div class="friend-avatar" style="background:var(--color-brand-primary);width:40px;height:40px;font-size:16px">${escapeHtml((user.displayName || 'U')[0])}</div>`;
      const idRow = myId
        ? `<div class="my-id-row"><span>\u3042\u306a\u305f\u306eID</span><span class="my-id-value" onclick="navigator.clipboard.writeText('${escapeHtml(myId)}')">${escapeHtml(myId)}</span><button class="my-id-copy" onclick="navigator.clipboard.writeText('${escapeHtml(myId)}')">\u30b3\u30d4\u30fc</button></div>`
        : '';
      el.innerHTML = `<div class="card mx account-card">
        <div style="display:flex;align-items:flex-start;gap:var(--space-md)">
          ${photo}
          <div style="flex:1;min-width:0">
            <div style="font-weight:var(--font-weight-semibold)">${escapeHtml(user.displayName || '')}</div>
            <div class="text-sm text-secondary">${escapeHtml(user.email || '')}</div>
          </div>
          <button class="small-btn danger" onclick="Social.logout()">\u30ed\u30b0\u30a2\u30a6\u30c8</button>
        </div>
        ${idRow}
      </div>`;
    } else {
      el.innerHTML = `<div class="card mx" style="text-align:center;padding:var(--space-lg)">
        <div style="font-size:32px;margin-bottom:var(--space-sm)">\u{1F465}</div>
        <div style="font-weight:var(--font-weight-semibold);margin-bottom:var(--space-sm)">\u4ef2\u9593\u3068\u3064\u306a\u304c\u308d\u3046</div>
        <div class="text-sm text-secondary" style="margin-bottom:var(--space-base)">Google\u30ed\u30b0\u30a4\u30f3\u3067\u53cb\u9054\u306e\u30c8\u30ec\u30fc\u30cb\u30f3\u30b0\u304c\u898b\u3048\u308b\u3088\u3046\u306b</div>
        <button class="login-btn" onclick="Social.login()">
          <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
          Google\u3067\u30ed\u30b0\u30a4\u30f3
        </button>
      </div>`;
    }
  },

  // --- Tab Switching ---
  switchTab(id, el) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('screen-' + id).classList.add('active');
    document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
    if (el) el.classList.add('active');
    window.scrollTo(0, 0);
    if (id === 'friends') this.renderFriends();
  },

  // --- Empty State ---
  showEmptyState() {
    document.getElementById('today-subtitle').textContent = 'プランを作成してください';
    document.getElementById('today-content').innerHTML =
      '<div class="empty-state"><div class="empty-icon">\u{1F3C3}</div>' +
      '<div class="empty-text">\u307e\u3060\u30d7\u30e9\u30f3\u304c\u3042\u308a\u307e\u305b\u3093<br>\u76ee\u6a19\u3092\u8a2d\u5b9a\u3057\u3066\u30d7\u30e9\u30f3\u3092\u4f5c\u6210\u3057\u307e\u3057\u3087\u3046</div>' +
      '<button class="empty-btn" onclick="App.switchTab(\'goal\',document.querySelector(\'[data-tab=goal]\'))">目標を設定する</button></div>';
    document.getElementById('plan-subtitle').textContent = '';
    document.getElementById('plan-content').innerHTML =
      '<div class="empty-state"><div class="empty-icon">\u{1F4CB}</div>' +
      '<div class="empty-text">\u30d7\u30e9\u30f3\u3092\u4f5c\u6210\u3059\u308b\u3068<br>\u3053\u3053\u306b\u8868\u793a\u3055\u308c\u307e\u3059</div></div>';
  },

  // --- Goal Screen ---
  renderGoalScreen() {
    const s = this.state || {};
    const form = document.getElementById('goal-form');
    if (!form) return;
    // Restore saved values
    const nameInput = document.getElementById('input-race-name');
    const dateInput = document.getElementById('input-race-date');
    const timeH = document.getElementById('input-time-h');
    const timeM = document.getElementById('input-time-m');

    if (nameInput && s.raceName) nameInput.value = s.raceName;
    if (dateInput && s.raceDate) dateInput.value = s.raceDate;
    if (s.raceType) {
      document.querySelectorAll('.segment').forEach(seg => {
        seg.classList.toggle('active', seg.dataset.value === s.raceType);
      });
    }
    if (s.targetTime) {
      const tp = s.targetTime.split(':');
      if (timeH) timeH.value = tp[0] || '4';
      if (timeM) timeM.value = tp[1] || '00';
    }
  },

  selectRaceType(el) {
    el.parentElement.querySelectorAll('.segment').forEach(s => s.classList.remove('active'));
    el.classList.add('active');
  },

  // --- Generate Plan ---
  generatePlan() {
    const raceName = document.getElementById('input-race-name').value.trim();
    const raceDate = document.getElementById('input-race-date').value;
    const raceTypeSeg = document.querySelector('.segment.active');
    const raceType = raceTypeSeg ? raceTypeSeg.dataset.value : 'full';
    const h = document.getElementById('input-time-h').value;
    const m = document.getElementById('input-time-m').value;
    const targetTime = h + ':' + String(m).padStart(2, '0');

    if (!raceName || !raceDate) {
      alert('大会名と日付を入力してください');
      return;
    }
    if (fromISO(raceDate) <= today()) {
      alert('大会日は今日より後の日付を選んでください');
      return;
    }

    const weeks = generatePlanData(raceName, raceDate, raceType, targetTime);
    const paces = calcPaces(targetTime, raceType);

    this.state = {
      raceName, raceDate, raceType, targetTime,
      paces: {
        jog: formatPace(paces.jog),
        tempo: formatPace(paces.tempo),
        interval: formatPace(paces.interval),
        long: formatPace(paces.long),
        race: formatPace(paces.race)
      },
      plan: weeks,
      completed: this.state ? (this.state.completed || {}) : {}
    };
    saveState(this.state);

    this.renderToday();
    this.renderPlan();
    this.switchTab('today', document.querySelector('[data-tab="today"]'));

    // Sync to Firebase
    if (typeof Social !== 'undefined' && Social.enabled) Social.syncToCloud(this.state);
  },

  // --- Get Today's Workout ---
  getTodayWorkout() {
    if (!this.state || !this.state.plan) return null;
    const todayStr = toISO(today());
    for (const week of this.state.plan) {
      for (const day of week.days) {
        if (day.date === todayStr) return { ...day, weekNum: week.weekNum, phaseName: week.phaseName };
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
    if (!this.state || !this.state.plan) { this.showEmptyState(); return; }

    const workout = this.getTodayWorkout();
    const week = this.getCurrentWeek();
    const paces = this.state.paces;

    if (!week) {
      document.getElementById('today-subtitle').textContent = this.state.raceName;
      document.getElementById('today-content').innerHTML =
        '<div class="empty-state"><div class="empty-icon">\u{1F4C5}</div>' +
        '<div class="empty-text">\u4eca\u65e5\u306f\u30d7\u30e9\u30f3\u671f\u9593\u5916\u3067\u3059<br>\u30d7\u30e9\u30f3\u306f ' + this.state.plan[0].days[0].date + ' \u304b\u3089\u958b\u59cb</div></div>';
      return;
    }

    const todayStr = toISO(today());
    const done = this.isCompleted(todayStr);
    const weekCompleted = week.days.filter(d => this.isCompleted(d.date)).length;
    const weekWorkouts = week.days.filter(d => d.type !== 'rest').length;
    const weekCompletedDist = roundKm(week.days.filter(d => this.isCompleted(d.date)).reduce((s, d) => s + d.dist, 0));
    const weekRemainDist = roundKm(week.totalDist - weekCompletedDist);
    const progressPct = weekWorkouts > 0 ? Math.round((weekCompleted / weekWorkouts) * 100) : 0;
    const circ = 2 * Math.PI * 34;
    const dashOff = circ * (1 - progressPct / 100);

    document.getElementById('today-subtitle').textContent =
      'Week ' + week.weekNum + ' / ' + this.state.plan.length + ' \u2014 ' + this.state.raceName;

    const w = workout || week.days[0];

    // Steps
    let stepsHTML = '';
    if (w.type === 'interval' && w.detail) {
      stepsHTML = buildSteps([
        { label: 'ウォームアップ', meta: 'ゆっくりジョグ', pace: paces.jog, color: 'var(--color-easy-run)' },
        { label: w.detail.reps + ' ダッシュ', meta: '間に' + w.detail.rest + '休息', pace: paces.interval, color: 'var(--color-interval)' },
        { label: 'クールダウン', meta: 'ゆっくりジョグ', pace: paces.jog, color: 'var(--color-easy-run)' }
      ]);
    } else if (w.type === 'tempo') {
      const tempoKm = roundKm(Math.max(w.dist - 4, 2));
      stepsHTML = buildSteps([
        { label: 'ウォームアップ', meta: '2km ジョグ', pace: paces.jog, color: 'var(--color-easy-run)' },
        { label: 'テンポ走', meta: tempoKm + 'km', pace: paces.tempo, color: 'var(--color-tempo-run)' },
        { label: 'クールダウン', meta: '2km ジョグ', pace: paces.jog, color: 'var(--color-easy-run)' }
      ]);
    } else if (w.type === 'long') {
      const third = roundKm(w.dist / 3);
      stepsHTML = buildSteps([
        { label: 'イージースタート', meta: third + 'km', pace: paces.jog, color: 'var(--color-easy-run)' },
        { label: 'ステディペース', meta: third + 'km', pace: paces.long, color: 'var(--color-long-run)' },
        { label: 'イージーフィニッシュ', meta: third + 'km', pace: paces.jog, color: 'var(--color-easy-run)' }
      ]);
    } else if (w.type === 'jog') {
      stepsHTML = buildSteps([
        { label: w.name, meta: Math.round(w.dist) + 'km 一定ペース', pace: w.pace, color: TYPE_COLORS[w.type] }
      ]);
    }

    // Week scroll
    const weekScrollHTML = week.days.map(d => {
      const date = fromISO(d.date);
      const isToday = d.date === todayStr;
      const isDone = this.isCompleted(d.date);
      return '<div class="day-card' + (isToday ? ' today' : '') + (isDone ? ' completed' : '') + '">' +
        '<div class="day-label">' + d.dayEn + '</div>' +
        '<div class="day-date">' + date.getDate() + '</div>' +
        '<span class="day-type" style="background:' + TYPE_COLORS[d.type] + '">' + TYPE_LABELS[d.type] + '</span></div>';
    }).join('');

    // Weekly bar chart
    const currentIdx = this.state.plan.indexOf(week);
    const barWeeks = [];
    for (let i = Math.max(0, currentIdx - 2); i < Math.min(this.state.plan.length, currentIdx + 5); i++) {
      barWeeks.push(this.state.plan[i]);
    }
    const maxDist = Math.max(...barWeeks.map(bw => bw.totalDist));
    const barChartHTML = barWeeks.map(bw => {
      const h = Math.round((bw.totalDist / maxDist) * 80);
      const isCurr = bw.weekNum === week.weekNum;
      const compDist = roundKm(bw.days.filter(d => this.isCompleted(d.date)).reduce((s, d) => s + d.dist, 0));
      const showDist = isCurr ? Math.round(compDist) : Math.round(bw.totalDist);
      const color = isCurr ? 'var(--color-brand-primary)' : bw.weekNum < week.weekNum ? 'var(--color-fill-primary)' : 'var(--color-fill-tertiary)';
      const border = bw.weekNum > week.weekNum ? ';border:1px dashed var(--color-separator)' : '';
      return '<div class="bar-col"><div class="bar-value">' + showDist + '</div><div class="bar" style="height:' + h + 'px;background:' + color + border + '"></div><div class="bar-label">W' + bw.weekNum + '</div></div>';
    }).join('');

    // Monthly bar chart
    const monthly = calcMonthlyData(this.state.plan, this.state.completed);
    const maxMonthly = Math.max(...monthly.map(m => m.planned), 1);
    const monthlyChartHTML = monthly.map(m => {
      const hPlan = Math.round((m.planned / maxMonthly) * 80);
      const hComp = Math.round((m.completed / maxMonthly) * 80);
      return '<div class="bar-col">' +
        '<div class="bar-value">' + Math.round(m.completed) + '</div>' +
        '<div style="position:relative;width:100%;max-width:32px;height:' + hPlan + 'px">' +
        '<div class="bar" style="position:absolute;bottom:0;left:0;right:0;height:100%;background:var(--color-fill-tertiary);border-radius:var(--radius-sm) var(--radius-sm) 0 0"></div>' +
        '<div class="bar" style="position:absolute;bottom:0;left:0;right:0;height:' + hComp + 'px;background:var(--color-brand-primary);border-radius:var(--radius-sm) var(--radius-sm) 0 0"></div>' +
        '</div>' +
        '<div class="bar-label">' + m.label + '</div></div>';
    }).join('');

    const heroDetail = w.dist > 0 ? '合計 ' + formatDist(w.dist, w.type) + 'km・推定 ' + estimateTime(w.dist, w.pace) : '休養日';
    const commentHTML = w.comment ? '<div class="workout-comment">' + escapeHtml(w.comment) + '</div>' : '';

    const btnHTML = w.type === 'rest' ? ''
      : done
        ? '<button class="start-btn completed-btn">\u2713 完了済み</button>'
        : '<button class="start-btn" onclick="App.completeToday()"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>トレーニング完了</button>';

    document.getElementById('today-content').innerHTML =
      '<div class="today-hero type-' + w.type + '">' +
        '<div class="workout-type">' + (TYPE_JA[w.type] || w.type) + '</div>' +
        '<div class="workout-name">' + escapeHtml(w.name) + '</div>' +
        '<div class="workout-detail">' + heroDetail + '</div>' +
        commentHTML +
        btnHTML +
      '</div>' +
      (stepsHTML ? '<div class="section"><div class="section-header">メニュー詳細</div><div class="card"><ul class="workout-steps">' + stepsHTML + '</ul></div></div>' : '') +
      '<div class="section" style="padding-top:0"><div class="section-header mx">今週のプラン</div><div class="week-scroll">' + weekScrollHTML + '</div></div>' +
      '<div class="section" style="padding-top:0"><div class="section-header">今週の進捗</div><div class="card">' +
        '<div class="progress-section">' +
          '<div class="progress-ring-wrap"><svg class="progress-ring" width="80" height="80" viewBox="0 0 80 80">' +
            '<circle class="progress-ring-bg" cx="40" cy="40" r="34"/>' +
            '<circle class="progress-ring-fill" cx="40" cy="40" r="34" stroke-dasharray="' + circ + '" stroke-dashoffset="' + dashOff + '"/>' +
          '</svg><div class="progress-ring-text">' + progressPct + '%</div></div>' +
          '<div class="progress-info"><div class="progress-label">' + weekCompleted + ' / ' + weekWorkouts + ' ワークアウト完了</div>' +
          '<div class="progress-detail">今週あと ' + weekRemainDist + 'km 残り</div></div>' +
        '</div>' +
      '</div></div>' +
      '<div class="section" style="padding-top:0"><div class="section-header">週間走行距離</div><div class="card">' +
        '<div class="bar-chart">' + barChartHTML + '</div>' +
        '<div class="text-sm text-secondary" style="text-align:center;margin-top:var(--space-xs)">W' + week.weekNum + ': ' + weekCompletedDist + ' / ' + week.totalDist + ' km</div>' +
      '</div></div>' +
      '<div class="section" style="padding-top:0"><div class="section-header">月間走行距離</div><div class="card">' +
        '<div class="bar-chart">' + monthlyChartHTML + '</div>' +
        '<div class="text-sm text-secondary" style="text-align:center;margin-top:var(--space-xs)">実績 / 予定（km）</div>' +
      '</div></div>';
  },

  // --- Render Plan ---
  renderPlan() {
    if (!this.state || !this.state.plan) return;
    const dist = this.state.raceType === 'half' ? '21.1km' : '42.195km';
    document.getElementById('plan-subtitle').textContent =
      this.state.raceName + '（' + dist + '）・目標 ' + this.state.targetTime;

    let html = '';
    for (const week of this.state.plan) {
      const label = week.isRecovery
        ? 'Week ' + week.weekNum + ' \u2014 ' + week.phaseName + '\uff08\u56de\u5fa9\u9031\uff09'
        : 'Week ' + week.weekNum + ' \u2014 ' + week.phaseName;
      html += '<div class="plan-week"><div class="plan-week-header mt-lg">' + label + '</div><ul class="plan-list mx">';

      for (const day of week.days) {
        const done = this.isCompleted(day.date);
        const distLabel = day.dist > 0 ? formatDist(day.dist, day.type) + 'km' : '\u2014';
        const d = fromISO(day.date);
        const dateLabel = (d.getMonth() + 1) + '/' + d.getDate();
        const nameDisplay = TYPE_JA[day.type] || day.name;
        const commentBadge = day.comment ? '<span class="plan-comment-badge" title="' + escapeHtml(day.comment) + '">\u2026</span>' : '';
        html += '<li class="plan-item" onclick="App.openEditWorkout(\'' + day.date + '\')">' +
          '<span class="plan-dot" style="background:' + (TYPE_COLORS[day.type] || 'var(--color-fill-primary)') + '"></span>' +
          '<span class="plan-day">' + day.dayJa + '</span>' +
          '<span class="plan-date">' + dateLabel + '</span>' +
          '<span class="plan-name">' + escapeHtml(nameDisplay) + commentBadge + '</span>' +
          '<span class="plan-dist">' + distLabel + '</span>' +
          '<span class="plan-check' + (done ? ' done' : '') + '" onclick="event.stopPropagation();App.toggleComplete(\'' + day.date + '\')"></span></li>';
      }
      html += '</ul></div>';
    }
    document.getElementById('plan-content').innerHTML = html;

    // Auto-scroll to current week
    setTimeout(() => {
      const planEl = document.getElementById('plan-content');
      const week = this.getCurrentWeek();
      if (week) {
        const els = planEl.querySelectorAll('.plan-week');
        const idx = this.state.plan.indexOf(week);
        if (els[idx]) els[idx].scrollIntoView({ behavior: 'auto', block: 'start' });
      }
    }, 100);
  },

  // --- Friends ---
  friendsData: [],

  buildSelfCard() {
    const todayStr = toISO(today());
    const workout = this.getTodayWorkout();
    const done = this.isCompleted(todayStr);
    const completed = this.state ? (this.state.completed || {}) : {};
    const streak = calcStreak(completed);
    const goalText = this.state.raceName
      ? this.state.raceName + (this.state.targetTime ? '・目標 ' + this.state.targetTime : '')
      : '目標未設定';

    // Avatar
    let photo, name;
    if (typeof Social !== 'undefined' && Social.currentUser) {
      name = Social.currentUser.displayName || 'あなた';
      photo = Social.currentUser.photoURL
        ? '<img src="' + escapeHtml(Social.currentUser.photoURL) + '" style="width:48px;height:48px;border-radius:50%">'
        : '<div class="friend-avatar" style="background:linear-gradient(135deg,#007AFF,#5856D6)">' + escapeHtml(name[0]) + '</div>';
    } else {
      name = 'あなた';
      photo = '<div class="friend-avatar" style="background:linear-gradient(135deg,#007AFF,#5856D6)">あ</div>';
    }

    // Today's workout status
    const todayHTML = buildTodayStatusHTML(workout, done);

    // Week dots
    const monday = getMonday(new Date());
    let dots = '';
    for (let i = 0; i < 7; i++) {
      const d = toISO(addDays(monday, i));
      const cls = this.isCompleted(d) ? 'done' : (d <= todayStr ? '' : 'planned');
      dots += '<div class="friend-week-dot ' + cls + '"></div>';
    }

    return '<div class="section" style="padding-bottom:0"><div class="section-header">あなた</div>' +
      '<div class="friend-card" onclick="App.switchTab(\'plan\',document.querySelector(\'[data-tab=plan]\'))">' + photo +
      '<div class="friend-info">' +
        '<div class="friend-name">' + escapeHtml(name) + '</div>' +
        '<div class="friend-goal">' + escapeHtml(goalText) + '</div>' +
        '<div class="friend-today">' + todayHTML + '</div>' +
        '<div class="friend-week">' + dots + '</div>' +
      '</div>' +
      '<div class="friend-streak"><div class="streak-num">' + streak + '</div><div class="streak-label">日連続</div></div>' +
    '</div></div>';
  },

  async renderFriends() {
    const container = document.getElementById('friends-content');
    if (!container) return;

    // Self card (always shown if plan exists)
    const selfCardHTML = (this.state && this.state.plan) ? this.buildSelfCard() : '';

    // Not configured
    if (typeof Social === 'undefined' || !Social.enabled) {
      container.innerHTML = '<div id="auth-section"></div>' + selfCardHTML +
        '<div class="empty-state"><div class="empty-icon">\u{1F465}</div>' +
        '<div class="empty-text">Firebase\u3092\u8a2d\u5b9a\u3059\u308b\u3068<br>\u4ef2\u9593\u306e\u30c8\u30ec\u30fc\u30cb\u30f3\u30b0\u304c\u898b\u3048\u307e\u3059</div></div>';
      this.renderAuthUI(null);
      return;
    }

    // Not logged in
    if (!Social.currentUser) {
      container.innerHTML = '<div id="auth-section"></div>' + selfCardHTML;
      this.renderAuthUI(null);
      return;
    }

    // Get my short ID
    const myId = await Social.getOrCreateUserId();

    container.innerHTML = '<div id="auth-section"></div>' + selfCardHTML +
      '<div class="section" style="padding-bottom:0"><div class="section-header">友達を追加</div>' +
      '<div class="card"><div class="friend-add-row">' +
      '<input type="text" id="friend-id-input" placeholder="友達のIDを入力" class="form-input" style="flex:1" maxlength="8">' +
      '<button class="cta-btn" style="width:auto;margin:0;padding:var(--space-sm) var(--space-base);font-size:var(--font-size-subhead)" onclick="App.addFriend()">検索</button>' +
      '</div></div></div>' +
      '<div id="friend-requests"></div>' +
      '<div id="friends-list"><div class="empty-state"><div class="empty-icon">\u{23F3}</div><div class="empty-text">読み込み中...</div></div></div>';

    this.renderAuthUI(Social.currentUser, myId);

    // Load incoming requests
    const requests = await Social.getIncomingRequests();
    const reqEl = document.getElementById('friend-requests');
    if (requests.length > 0) {
      reqEl.innerHTML = '<div class="section" style="padding-bottom:0"><div class="section-header">フレンドリクエスト</div>' +
        requests.map(r =>
          '<div class="friend-card">' +
          '<div class="friend-avatar" style="background:var(--color-brand-accent)">' + escapeHtml((r.fromName || '?')[0]) + '</div>' +
          '<div class="friend-info"><div class="friend-name">' + escapeHtml(r.fromName) + '</div></div>' +
          '<button class="small-btn primary" onclick="App.acceptFriend(\'' + r.id + '\',\'' + r.fromUid + '\')">承認</button>' +
          '<button class="small-btn" onclick="App.declineFriend(\'' + r.id + '\')">拒否</button>' +
          '</div>'
        ).join('') + '</div>';
    }

    // Load friends data
    const friends = await Social.loadFriendsData();
    this.friendsData = friends;
    const listEl = document.getElementById('friends-list');

    if (friends.length === 0) {
      listEl.innerHTML = '<div class="empty-state"><div class="empty-icon">\u{1F465}</div>' +
        '<div class="empty-text">まだ仲間がいません<br>IDで友達を追加しましょう</div></div>';
      return;
    }

    const todayStr = toISO(today());
    listEl.innerHTML = '<div class="section"><div class="section-header">仲間 (' + friends.length + ')</div>' +
      friends.map(f => {
        const streak = Social.calcStreak(f.completed);
        const isDone = f.completed && f.completed[todayStr];
        const sett = f.settings || {};
        const goalText = sett.raceName ? sett.raceName + (sett.targetTime ? '・目標 ' + sett.targetTime : '') : '目標未設定';
        const colors = ['#FF6B6B,#FF3B30', '#5AC8FA,#007AFF', '#AF52DE,#5856D6', '#34C759,#248A3D', '#FF9500,#FF6B00'];
        const color = colors[Math.abs(hashStr(f.uid)) % colors.length];
        const initial = (f.displayName || f.email || '?')[0].toUpperCase();
        const photo = f.photoURL
          ? '<img src="' + escapeHtml(f.photoURL) + '" style="width:48px;height:48px;border-radius:50%">'
          : '<div class="friend-avatar" style="background:linear-gradient(135deg,' + color + ')">' + escapeHtml(initial) + '</div>';

        // Today's workout from friend's plan
        const friendWorkout = findTodayWorkout(f.plan, todayStr);
        const todayHTML = buildTodayStatusHTML(friendWorkout, isDone);

        // Week dots
        const monday = getMonday(new Date());
        let dots = '';
        for (let i = 0; i < 7; i++) {
          const d = toISO(addDays(monday, i));
          const cls = f.completed && f.completed[d] ? 'done' : (d <= todayStr ? '' : 'planned');
          dots += '<div class="friend-week-dot ' + cls + '"></div>';
        }

        const hasPlan = f.plan && f.plan.length > 0;
        const clickAttr = hasPlan ? ' onclick="App.showFriendPlan(\'' + f.uid + '\')"' : '';

        return '<div class="friend-card"' + clickAttr + '>' + photo +
          '<div class="friend-info">' +
            '<div class="friend-name">' + escapeHtml(f.displayName || f.email) + '</div>' +
            '<div class="friend-goal">' + escapeHtml(goalText) + '</div>' +
            '<div class="friend-today">' + todayHTML + '</div>' +
            '<div class="friend-week">' + dots + '</div>' +
          '</div>' +
          '<div class="friend-streak"><div class="streak-num">' + streak + '</div><div class="streak-label">日連続</div></div>' +
        '</div>';
      }).join('') + '</div>';
  },

  // --- Friend Plan Viewer ---
  showFriendPlan(uid) {
    const friend = this.friendsData.find(f => f.uid === uid);
    if (!friend || !friend.plan || friend.plan.length === 0) return;

    const sett = friend.settings || {};
    const dist = sett.raceType === 'half' ? '21.1km' : '42.195km';
    const subtitle = sett.raceName
      ? sett.raceName + '（' + dist + '）' + (sett.targetTime ? '・目標 ' + sett.targetTime : '')
      : '';
    const todayStr = toISO(today());

    let planHTML = '';
    let currentWeekIdx = -1;
    for (let wi = 0; wi < friend.plan.length; wi++) {
      const week = friend.plan[wi];
      const label = week.isRecovery
        ? 'Week ' + week.weekNum + ' \u2014 ' + week.phaseName + '\uff08\u56de\u5fa9\u9031\uff09'
        : 'Week ' + week.weekNum + ' \u2014 ' + week.phaseName;
      planHTML += '<div class="plan-week"><div class="plan-week-header mt-lg">' + label + '</div><ul class="plan-list mx">';

      for (const day of week.days) {
        if (day.date === todayStr) currentWeekIdx = wi;
        const done = friend.completed && friend.completed[day.date];
        const type = TYPE_MIGRATION[day.type] || day.type;
        const distLabel = day.dist > 0 ? formatDist(day.dist, day.type) + 'km' : '\u2014';
        const d = fromISO(day.date);
        const dateLabel = (d.getMonth() + 1) + '/' + d.getDate();
        const nameDisplay = TYPE_JA[type] || day.name;
        const isToday = day.date === todayStr;

        const hasComment = day.comment && day.comment.trim();
        const commentBadge = hasComment ? '<span class="plan-comment-badge">\u2026</span>' : '';
        const itemClick = hasComment ? ' onclick="App.showFriendComment(\'' + uid + '\',\'' + day.date + '\')"' : '';
        const itemCursor = hasComment ? 'cursor:pointer' : 'cursor:default';

        planHTML += '<li class="plan-item' + (isToday ? ' friend-plan-today' : '') + '" style="' + itemCursor + '"' + itemClick + '>' +
          '<span class="plan-dot" style="background:' + (TYPE_COLORS[type] || 'var(--color-fill-primary)') + '"></span>' +
          '<span class="plan-day">' + day.dayJa + '</span>' +
          '<span class="plan-date">' + dateLabel + '</span>' +
          '<span class="plan-name">' + escapeHtml(nameDisplay) + commentBadge + '</span>' +
          '<span class="plan-dist">' + distLabel + '</span>' +
          '<span class="plan-check' + (done ? ' done' : '') + '"></span></li>';
      }
      planHTML += '</ul></div>';
    }

    const overlay = document.getElementById('friend-plan-overlay');
    overlay.innerHTML =
      '<div class="friend-plan-header">' +
        '<button class="friend-plan-close" onclick="App.closeFriendPlan()">\u2715</button>' +
        '<div class="friend-plan-name">' + escapeHtml(friend.displayName || friend.email || '友達') + ' のプラン</div>' +
        '<div class="friend-plan-subtitle">' + escapeHtml(subtitle) + '</div>' +
      '</div>' +
      '<div class="friend-plan-body">' + planHTML + '</div>';
    overlay.classList.add('show');

    // Scroll to current week
    if (currentWeekIdx >= 0) {
      setTimeout(() => {
        const weeks = overlay.querySelectorAll('.plan-week');
        if (weeks[currentWeekIdx]) weeks[currentWeekIdx].scrollIntoView({ behavior: 'auto', block: 'start' });
      }, 100);
    }
  },

  closeFriendPlan() {
    document.getElementById('friend-plan-overlay').classList.remove('show');
  },

  showFriendComment(uid, dateStr) {
    const friend = this.friendsData.find(f => f.uid === uid);
    if (!friend || !friend.plan) return;
    let targetDay = null;
    for (const week of friend.plan) {
      for (const day of week.days) {
        if (day.date === dateStr) { targetDay = day; break; }
      }
      if (targetDay) break;
    }
    if (!targetDay || !targetDay.comment) return;

    const dd = fromISO(dateStr);
    const dateLabel = (dd.getMonth() + 1) + '/' + dd.getDate();
    const type = TYPE_MIGRATION[targetDay.type] || targetDay.type;
    const typeName = TYPE_JA[type] || targetDay.name;

    const overlay = document.getElementById('edit-overlay');
    overlay.innerHTML =
      '<div class="edit-backdrop" onclick="App.closeEditWorkout()"></div>' +
      '<div class="edit-sheet">' +
        '<div class="edit-sheet-handle"></div>' +
        '<div class="edit-sheet-title">' + targetDay.dayJa + ' ' + dateLabel + ' \u2014 ' + escapeHtml(typeName) + '</div>' +
        '<div style="padding:0 var(--space-sm);margin-bottom:var(--space-lg)">' +
          '<div style="font-size:var(--font-size-body);color:var(--color-label-primary);line-height:1.6;white-space:pre-wrap">' +
            escapeHtml(targetDay.comment) +
          '</div>' +
        '</div>' +
        '<div class="edit-actions">' +
          '<button class="cta-btn" style="flex:1;width:auto;margin:0" onclick="App.closeEditWorkout()">\u9589\u3058\u308b</button>' +
        '</div>' +
      '</div>';
    overlay.classList.add('show');
  },

  async addFriend() {
    const input = document.getElementById('friend-id-input');
    const shortId = input.value.trim().toUpperCase();
    if (!shortId || shortId.length < 4) {
      alert('友達のIDを入力してください');
      return;
    }
    const results = await Social.searchUserByShortId(shortId);
    if (results.length === 0) {
      alert('ユーザーが見つかりません');
      return;
    }
    const sent = await Social.sendFriendRequest(results[0].uid);
    if (sent) {
      input.value = '';
      alert('フレンドリクエストを送信しました');
    } else {
      alert('既にフレンドか、リクエスト送信済みです');
    }
  },

  async acceptFriend(reqId, fromUid) {
    await Social.acceptRequest(reqId, fromUid);
    this.renderFriends();
  },

  async declineFriend(reqId) {
    await Social.declineRequest(reqId);
    this.renderFriends();
  },

  // --- Edit Workout ---
  openEditWorkout(dateStr) {
    if (!this.state || !this.state.plan) return;
    let targetDay = null;
    for (const week of this.state.plan) {
      for (const day of week.days) {
        if (day.date === dateStr) { targetDay = day; break; }
      }
      if (targetDay) break;
    }
    if (!targetDay) return;

    const typeOptions = Object.keys(TYPE_JA).map(t =>
      '<option value="' + t + '"' + (t === targetDay.type ? ' selected' : '') + '>' + TYPE_JA[t] + '</option>'
    ).join('');

    const dd = fromISO(dateStr);
    const distVal = Math.round(targetDay.dist);
    const isInterval = targetDay.type === 'interval';

    // Parse interval rep info from detail
    let repDist = 400, repCount = 8;
    if (isInterval && targetDay.detail && targetDay.detail.reps) {
      const m = targetDay.detail.reps.match(/(\d+)m\s*[×x]\s*(\d+)/i);
      if (m) { repDist = parseInt(m[1]); repCount = parseInt(m[2]); }
    }

    const overlay = document.getElementById('edit-overlay');
    overlay.innerHTML =
      '<div class="edit-backdrop" onclick="App.closeEditWorkout()"></div>' +
      '<div class="edit-sheet">' +
        '<div class="edit-sheet-handle"></div>' +
        '<div class="edit-sheet-title">' + targetDay.dayJa + ' ' + (dd.getMonth() + 1) + '/' + dd.getDate() + ' のメニュー</div>' +
        '<div class="edit-field"><label class="form-label">メニュー</label>' +
          '<select id="edit-type" class="form-input edit-select" onchange="App.onEditTypeChange()">' + typeOptions + '</select></div>' +
        '<div id="edit-interval-fields" style="display:' + (isInterval ? 'block' : 'none') + '">' +
          '<div class="edit-field"><label class="form-label">1本あたりの距離 (m)</label>' +
            '<input type="number" id="edit-rep-dist" class="form-input" value="' + repDist + '" min="100" step="100"></div>' +
          '<div class="edit-field"><label class="form-label">本数</label>' +
            '<input type="number" id="edit-reps" class="form-input" value="' + repCount + '" min="1" step="1"></div>' +
        '</div>' +
        '<div id="edit-normal-fields" style="display:' + (isInterval ? 'none' : 'block') + '">' +
          '<div class="edit-field"><label class="form-label">距離 (km)</label>' +
            '<input type="number" id="edit-dist" class="form-input" value="' + distVal + '" min="0" step="1"></div>' +
        '</div>' +
        '<div class="edit-field"><label class="form-label">コメント</label>' +
          '<input type="text" id="edit-comment" class="form-input" value="' + escapeHtml(targetDay.comment || '') + '" placeholder="コメントを入力"></div>' +
        '<div class="edit-actions">' +
          '<button class="edit-cancel-btn" onclick="App.closeEditWorkout()">キャンセル</button>' +
          '<button class="cta-btn edit-save-btn" onclick="App.saveEditWorkout(\'' + dateStr + '\')">保存</button>' +
        '</div>' +
      '</div>';
    overlay.classList.add('show');
  },

  closeEditWorkout() {
    document.getElementById('edit-overlay').classList.remove('show');
  },

  onEditTypeChange() {
    const type = document.getElementById('edit-type').value;
    document.getElementById('edit-interval-fields').style.display = type === 'interval' ? 'block' : 'none';
    document.getElementById('edit-normal-fields').style.display = type === 'interval' ? 'none' : 'block';
  },

  saveEditWorkout(dateStr) {
    const newType = document.getElementById('edit-type').value;
    const newComment = document.getElementById('edit-comment').value.trim();
    let newDist, newDetail;

    if (newType === 'interval') {
      const repDist = parseInt(document.getElementById('edit-rep-dist').value) || 400;
      const repCount = parseInt(document.getElementById('edit-reps').value) || 1;
      newDist = (repDist * repCount) / 1000;
      const restDist = repDist <= 600 ? '200m' : repDist <= 1200 ? '400m' : '600m';
      newDetail = { reps: repDist + 'm \u00d7 ' + repCount, rest: restDist + '\u30b8\u30e7\u30b0' };
    } else {
      newDist = Math.round(parseFloat(document.getElementById('edit-dist').value) || 0);
      newDetail = null;
    }

    for (const week of this.state.plan) {
      for (const day of week.days) {
        if (day.date === dateStr) {
          day.type = newType;
          day.dist = newDist;
          day.name = TYPE_JA[newType] || newType;
          day.comment = newComment;
          if (newDetail) day.detail = newDetail;
          else delete day.detail;
          if (this.state.paces && this.state.paces[newType]) {
            day.pace = this.state.paces[newType];
          }
          break;
        }
      }
      // Recalc week total
      const hasDay = week.days.find(d => d.date === dateStr);
      if (hasDay) {
        week.totalDist = roundKm(week.days.reduce((s, d) => s + d.dist, 0));
      }
    }
    saveState(this.state);
    this.closeEditWorkout();
    this.renderPlan();
    this.renderToday();
    if (typeof Social !== 'undefined' && Social.enabled) Social.syncToCloud(this.state);
  },

  // --- Toggle Completion ---
  toggleComplete(dateStr) {
    if (!this.state.completed) this.state.completed = {};
    if (this.state.completed[dateStr]) delete this.state.completed[dateStr];
    else this.state.completed[dateStr] = true;
    saveState(this.state);
    this.renderPlan();
    this.renderToday();
    if (typeof Social !== 'undefined' && Social.enabled) Social.syncToCloud(this.state);
  },

  completeToday() {
    const todayStr = toISO(today());
    const workout = this.getTodayWorkout();
    if (!this.state.completed) this.state.completed = {};
    this.state.completed[todayStr] = true;
    saveState(this.state);
    this.showCompletion(workout);
    this.renderToday();
    this.renderPlan();
    if (typeof Social !== 'undefined' && Social.enabled) Social.syncToCloud(this.state);
  },

  // --- Completion Overlay ---
  showCompletion(workout) {
    const overlay = document.getElementById('completion-overlay');
    document.getElementById('completion-subtitle').textContent =
      workout ? workout.name + ' 完了' : 'ワークアウト完了';
    const dist = workout ? Math.round(workout.dist) : 0;
    document.getElementById('completion-stats').innerHTML =
      '<div class="completion-stat"><div class="stat-value">' + dist + '</div><div class="stat-label">km</div></div>';
    overlay.classList.add('show');
    launchConfetti();
    if (navigator.vibrate) navigator.vibrate([50, 30, 100]);
  },

  hideCompletion() {
    document.getElementById('completion-overlay').classList.remove('show');
    document.getElementById('confetti-container').innerHTML = '';
  }
};

// --- Helpers ---
function calcStreak(completed) {
  if (!completed) return 0;
  let streak = 0;
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (!completed[toISO(d)]) d.setDate(d.getDate() - 1);
  while (completed[toISO(d)]) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

function findTodayWorkout(plan, todayStr) {
  if (!plan) return null;
  for (const week of plan) {
    for (const day of week.days) {
      if (day.date === todayStr) return day;
    }
  }
  return null;
}

function buildTodayStatusHTML(workout, done) {
  if (!workout) return '<span style="color:var(--color-label-secondary)">—</span>';
  const type = TYPE_MIGRATION[workout.type] || workout.type;
  if (type === 'rest') return '<span style="color:var(--color-label-secondary)">レスト</span>';
  const name = TYPE_JA[type] || workout.name;
  if (done) return '<span style="color:var(--color-success);font-weight:600">' + escapeHtml(name) + '完了</span>';
  return '<span style="color:var(--color-danger);font-weight:600">' + escapeHtml(name) + '未完了</span>';
}

function buildSteps(steps) {
  return steps.map((s, i) =>
    '<li><span class="step-index" style="background:' + s.color + '">' + (i + 1) + '</span>' +
    '<div class="step-info"><div class="step-label">' + s.label + '</div><div class="step-meta">' + s.meta + '</div></div>' +
    '<span class="step-pace">' + s.pace + '</span></li>'
  ).join('');
}

function estimateTime(dist, paceStr) {
  if (!paceStr || paceStr === '-' || dist === 0) return '\u2014';
  const parts = paceStr.replace('/km', '').split(':');
  const paceMin = parseInt(parts[0]) + parseInt(parts[1]) / 60;
  const totalMin = Math.round(dist * paceMin);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? h + ':' + String(m).padStart(2, '0') : m + '分';
}

function launchConfetti() {
  const c = document.getElementById('confetti-container');
  c.innerHTML = '';
  const colors = ['#007AFF', '#34C759', '#FF9500', '#5856D6', '#FF3B30', '#FFCC00', '#5AC8FA'];
  for (let i = 0; i < 60; i++) {
    const el = document.createElement('div');
    el.classList.add('confetti');
    el.style.left = Math.random() * 100 + '%';
    el.style.background = colors[Math.floor(Math.random() * colors.length)];
    el.style.width = (Math.random() * 8 + 4) + 'px';
    el.style.height = (Math.random() * 8 + 4) + 'px';
    el.style.animationDuration = (Math.random() * 2 + 1.5) + 's';
    el.style.animationDelay = (Math.random() * 0.8) + 's';
    if (Math.random() > 0.5) el.style.borderRadius = '50%';
    c.appendChild(el);
  }
}

function escapeHtml(s) {
  if (!s) return '';
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0; }
  return h;
}

// --- Initialize ---
document.addEventListener('DOMContentLoaded', () => App.init());
