// ============================================================
// Runner Coach — App Logic
// ============================================================

// --- Constants ---
const RACES = [
  { id: 'yokohama2026', name: '横浜マラソン 2026', date: '2026-10-25', emoji: '\u{1F3C3}', desc: '2026年10月25日・フルマラソン' },
  { id: 'tokyo2027', name: '東京マラソン 2027', date: '2027-03-07', emoji: '\u{1F5FC}', desc: '2027年3月7日・フルマラソン' },
  { id: 'fuji2026', name: '富士山マラソン 2026', date: '2026-11-29', emoji: '\u{1F3D4}', desc: '2026年11月29日・フルマラソン' }
];

const TARGETS = [
  { id: 'sub330', label: '3時間30分 (3:30:00)', pace: '4:58/km', seconds: 12600 },
  { id: 'sub400', label: '4時間00分 (4:00:00)', pace: '5:41/km', seconds: 14400 },
  { id: 'sub300', label: 'サブ3 (2:59:59)', pace: '4:15/km', seconds: 10799 }
];

const PACES = {
  sub300: { easy: '4:45', tempo: '4:05', interval: '3:35', long: '5:00', recovery: '5:30' },
  sub330: { easy: '5:30', tempo: '4:50', interval: '4:05', long: '5:45', recovery: '6:00' },
  sub400: { easy: '6:15', tempo: '5:35', interval: '4:50', long: '6:30', recovery: '6:45' }
};

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
function sameDay(a, b) { return toISO(a) === toISO(b); }

// --- Storage ---
const STORE_KEY = 'runner-coach';
function loadState() {
  try { const r = localStorage.getItem(STORE_KEY); return r ? JSON.parse(r) : null; } catch(e) { return null; }
}
function saveState(s) { localStorage.setItem(STORE_KEY, JSON.stringify(s)); }

// --- Plan Generation ---
function generatePlanData(raceId, targetId) {
  const paces = PACES[targetId];
  const totalWeeks = 12;

  // Distances scale by target
  const scale = targetId === 'sub300' ? 1.2 : targetId === 'sub330' ? 1.0 : 0.85;

  const weeks = [];
  const monday = getMonday(addDays(today(), 1)); // Start next Monday (or this Monday if today is Mon)

  for (let w = 0; w < totalWeeks; w++) {
    let phase, phaseName;
    if (w < 3) { phase = 'base'; phaseName = '基礎期'; }
    else if (w < 7) { phase = 'build'; phaseName = 'ビルドアップ期'; }
    else if (w < 10) { phase = 'peak'; phaseName = 'ピーク期'; }
    else { phase = 'taper'; phaseName = 'テーパリング期'; }

    // Recovery weeks: week 3 and 7 (0-indexed) reduce volume
    const isRecovery = (w === 3 || w === 7);
    const volMult = isRecovery ? 0.7 : 1.0;

    // Progressive distances
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
      weekNum: w + 1,
      phase,
      phaseName,
      isRecovery,
      startDate: toISO(weekStart),
      days: weekDays,
      totalDist: Math.round(totalDist * 10) / 10
    });
  }

  return weeks;
}

// --- App ---
const App = {
  state: null,
  selectedRace: 'yokohama2026',
  selectedTarget: 'sub330',

  init() {
    this.state = loadState();
    this.renderGoalScreen();

    if (this.state && this.state.plan) {
      this.renderToday();
      this.renderPlan();
    } else {
      this.showEmptyState();
      // On first load, go to goal tab
      this.switchTab('goal', document.querySelector('[data-tab="goal"]'));
    }

    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
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
    const raceEl = document.getElementById('race-options');
    raceEl.innerHTML = RACES.map(r =>
      `<div class="goal-option${r.id === this.selectedRace ? ' selected' : ''}" onclick="App.selectRace('${r.id}', this)">
        <div class="goal-emoji">${r.emoji}</div>
        <div class="goal-title">${r.name}</div>
        <div class="goal-desc">${r.desc}</div>
      </div>`
    ).join('');

    const targetEl = document.getElementById('target-options');
    targetEl.innerHTML = TARGETS.map(t =>
      `<div class="goal-option${t.id === this.selectedTarget ? ' selected' : ''}" onclick="App.selectTarget('${t.id}', this)">
        <div class="goal-title">${t.label}</div>
        <div class="goal-desc">ペース目安: ${t.pace}</div>
      </div>`
    ).join('');
  },

  selectRace(id, el) {
    this.selectedRace = id;
    el.parentElement.querySelectorAll('.goal-option').forEach(o => o.classList.remove('selected'));
    el.classList.add('selected');
  },

  selectTarget(id, el) {
    this.selectedTarget = id;
    el.parentElement.querySelectorAll('.goal-option').forEach(o => o.classList.remove('selected'));
    el.classList.add('selected');
  },

  // --- Generate Plan ---
  generatePlan() {
    const race = RACES.find(r => r.id === this.selectedRace);
    const target = TARGETS.find(t => t.id === this.selectedTarget);
    const weeks = generatePlanData(this.selectedRace, this.selectedTarget);

    this.state = {
      raceId: this.selectedRace,
      raceName: race.name,
      raceDate: race.date,
      targetId: this.selectedTarget,
      targetLabel: target.label,
      targetPace: target.pace,
      plan: weeks,
      completed: this.state ? (this.state.completed || {}) : {}
    };
    saveState(this.state);

    this.renderToday();
    this.renderPlan();
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
    // If today is before plan start, return first week
    if (todayStr < this.state.plan[0].days[0].date) return this.state.plan[0];
    // If today is after plan end, return last week
    return this.state.plan[this.state.plan.length - 1];
  },

  isCompleted(dateStr) {
    return this.state && this.state.completed && this.state.completed[dateStr];
  },

  // --- Render Today ---
  renderToday() {
    const workout = this.getTodayWorkout();
    const week = this.getCurrentWeek();
    const paces = PACES[this.state.targetId];

    if (!week) {
      document.getElementById('today-subtitle').textContent = `${this.state.raceName}・${this.state.targetLabel}`;
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
    const target = TARGETS.find(t => t.id === this.state.targetId);
    document.getElementById('plan-subtitle').textContent =
      `${this.state.raceName}・目標 ${target ? target.label : ''}`;

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

    // Auto-scroll to current week
    setTimeout(() => {
      const planContent = document.getElementById('plan-content');
      const currentWeek = this.getCurrentWeek();
      if (currentWeek) {
        const weekEls = planContent.querySelectorAll('.plan-week');
        const idx = this.state.plan.indexOf(currentWeek);
        if (weekEls[idx]) {
          weekEls[idx].scrollIntoView({ behavior: 'auto', block: 'start' });
        }
      }
    }, 100);
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

// --- Initialize ---
document.addEventListener('DOMContentLoaded', () => App.init());
