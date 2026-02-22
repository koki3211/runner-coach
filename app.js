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
  long: 'var(--color-long-run)', race: 'var(--color-interval)'
};
const TYPE_LABELS = {
  jog: 'Jog', rest: 'Rest', interval: 'Intv',
  tempo: 'Tempo', long: 'Long', race: 'Race'
};
const TYPE_JA = {
  rest: 'レスト', jog: 'ジョグ', interval: 'インターバル',
  tempo: 'テンポラン', long: 'ロングラン', race: 'レース'
};
// Migration map for old type names
const TYPE_MIGRATION = { recovery: 'jog', easy: 'jog', cross: 'jog' };

// Default day schedule: index 0=Mon ... 6=Sun
// Sat=interval (user's group runs intervals on Saturday)
const DEFAULT_DAY_SCHEDULE = [
  'jog',       // 月: ジョグ
  'rest',      // 火: レスト
  'tempo',     // 水: テンポ
  'jog',       // 木: ジョグ
  'rest',      // 金: レスト
  'interval',  // 土: インターバル
  'long'       // 日: ロング
];

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

// --- Manako-style Pre-Race Plans ---
// Based on 真名子圭 (大東文化大学コーチ) の練習メニュー
// Index = days before race (0 = race day)
const MANAKO_FULL = [
  { type: 'race', name: '大会当日', dist: 42.195, paceKey: 'race', comment: 'フルマラソンレース' },
  { type: 'jog', name: 'FJ+WS', dist: 5, paceKey: 'jog', comment: '軽いジョグ+ウインドスプリントで動きを整える' },
  { type: 'jog', name: 'FJ', dist: 5, paceKey: 'jog', comment: '各自の調子に合わせて自由に設定' },
  { type: 'tempo', name: '2km+WS', dist: 4, paceKey: 'race', comment: 'レースペースよりやや速い2km。WSで動きを整える' },
  { type: 'jog', name: 'FJ', dist: 5, paceKey: 'jog', comment: '各自の調子に合わせて自由に設定' },
  { type: 'rest', name: 'レスト', dist: 0, comment: '休養。散歩でもよい' },
  { type: 'jog', name: '10km RJ', dist: 10, paceKey: 'jog', comment: 'リズムよく走って力を溜める' },
  { type: 'tempo', name: '★ 15km走', dist: 15, paceKey: 'tempo', comment: '最後のスピード刺激。余裕を持って走り切れるか確認', key: true },
  { type: 'jog', name: '8km JOG', dist: 8, paceKey: 'jog', comment: 'ポイント練習に向けて調子を上げるジョグ' },
  { type: 'jog', name: 'D-up+10km RJ', dist: 10, paceKey: 'jog', comment: 'ドリルで動きを整え、リズムよく走る' },
  { type: 'jog', name: '8〜10km JOG', dist: 9, paceKey: 'jog', comment: 'ジョグは調子を整える目的' },
  { type: 'jog', name: '4kmJOG+WS×10+2km', dist: 6, paceKey: 'jog', comment: 'ジョグはアップ程度。下り坂WSで速い動きの感覚を整える' },
  { type: 'rest', name: 'レスト', dist: 0, comment: '休養。練習の予備日にしてもよい' },
  { type: 'jog', name: 'JOG 40分', dist: 7, paceKey: 'jog', comment: '回復目的でゆっくり40分' },
  { type: 'interval', name: '★ 5km×2', dist: 10, paceKey: 'race', comment: 'レースペースまで上げるスピード刺激。レスト1〜3分', key: true, detail: { reps: '5000m × 2', rest: 'レスト1〜3分' } },
  { type: 'jog', name: '8km JOG', dist: 8, paceKey: 'jog', comment: 'ポイント練習に向けて調子を上げるジョグ' },
  { type: 'long', name: 'LJ 90分', dist: 15, paceKey: 'long', comment: 'ゆっくり90分。調子を確かめながら距離も確保' },
  { type: 'rest', name: 'レスト', dist: 0, comment: '休養。練習の予備日にしてもよい' },
  { type: 'jog', name: '12km JOG', dist: 12, paceKey: 'jog', comment: 'リズムジョグに近い形で少し長めに走る' },
  { type: 'jog', name: '8〜10km JOG', dist: 9, paceKey: 'jog', comment: '距離を踏みつつカラダの調子を整える' },
  { type: 'jog', name: 'D-up+10km RJ', dist: 10, paceKey: 'jog', comment: 'ドリルで動きを整え、リズムよく走る' },
  { type: 'rest', name: 'レスト', dist: 0, comment: '休養。散歩でもよい' },
  { type: 'long', name: '★ 25km走', dist: 25, paceKey: 'long', comment: '30km走より速いペースで走り込む距離走', key: true },
  { type: 'jog', name: '12〜14km JOG', dist: 13, paceKey: 'jog', comment: 'ポイント練習に向けて調子を上げる' },
  { type: 'jog', name: 'JOG', dist: 8, paceKey: 'jog', comment: 'つなぎのジョグで回復' },
  { type: 'jog', name: '4kmJOG+WS×15+2km', dist: 6, paceKey: 'jog', comment: 'ジョグはアップ程度。下り坂WSで速い動きの感覚を整える' },
  { type: 'jog', name: '12〜14km JOG', dist: 13, paceKey: 'jog', comment: '距離をしっかり踏む' },
  { type: 'long', name: 'LJ 120分以上', dist: 20, paceKey: 'long', comment: 'ゆっくりペースで120分以上走るロングジョグ' },
  { type: 'tempo', name: '12km B-up', dist: 12, paceKey: 'tempo', comment: '前半ゆっくり、後半ペースを上げるビルドアップ走' },
  { type: 'jog', name: '5〜8km JOG', dist: 7, paceKey: 'jog', comment: '距離耐性の確認ジョグ' },
  { type: 'interval', name: '200m×10', dist: 8, paceKey: 'interval', comment: 'スピード刺激。動きを上げる', detail: { reps: '200m × 10', rest: '200mジョグ' } },
  { type: 'jog', name: '10km JOG', dist: 10, paceKey: 'jog', comment: 'ポイント練習に備えたジョグ' },
  { type: 'rest', name: 'レスト', dist: 0, comment: '軽いジョグまたはストレッチでカラダを動かす' },
  { type: 'jog', name: '3km', dist: 3, paceKey: 'jog', comment: 'カラダを休める。散歩でもよい' },
  { type: 'rest', name: 'レスト', dist: 0, comment: '休養' },
  { type: 'long', name: '★ 30km走', dist: 30, paceKey: 'long', comment: 'しっかり走り込む距離走', key: true },
  { type: 'interval', name: '400m×12', dist: 8, paceKey: 'interval', comment: 'しっかり走り込む。レスト90秒', detail: { reps: '400m × 12', rest: 'レスト90秒' } },
  { type: 'tempo', name: '15km R-up', dist: 15, paceKey: 'tempo', comment: 'ゆっくりからスタートし、気持ちよくビルドアップ' },
  { type: 'jog', name: '5〜8km JOG', dist: 7, paceKey: 'jog', comment: 'ポイント練習に向けて準備' },
  { type: 'jog', name: '12〜14km JOG', dist: 13, paceKey: 'jog', comment: 'ゆっくりペースで整える' },
  { type: 'rest', name: 'レスト', dist: 0, comment: '休養' },
  { type: 'jog', name: 'JOG 40分', dist: 7, paceKey: 'jog', comment: '回復目的のゆっくりペースで40分' },
  { type: 'long', name: 'ハーフマラソンレース', dist: 21, paceKey: 'race', comment: 'レースペースで走る。力の確認', key: true }
];

const MANAKO_HALF = [
  { type: 'race', name: '大会当日', dist: 21.0975, paceKey: 'race', comment: 'ハーフマラソンレース' },
  { type: 'jog', name: 'FJ', dist: 5, paceKey: 'jog', comment: '各自の調子に合わせて自由に設定' },
  { type: 'interval', name: '1000m×2', dist: 5, paceKey: 'interval', comment: '力を吐き切らず溜めるイメージ。WS感覚で調子を整える', detail: { reps: '1000m × 2', rest: 'レスト1〜3分' } },
  { type: 'jog', name: 'FJ', dist: 5, paceKey: 'jog', comment: '各自の調子に合わせて自由に設定' },
  { type: 'jog', name: 'JOG 45〜60分', dist: 8, paceKey: 'jog', comment: '回復を図るイメージで45〜60分' },
  { type: 'tempo', name: '★ 8000mPR+(400m×2)', dist: 9, paceKey: 'tempo', comment: 'レースペースより余裕あるペースで距離を踏み、力を溜める', key: true },
  { type: 'jog', name: 'D-up+JOG 45分', dist: 8, paceKey: 'jog', comment: 'ドリルで動きを整え、調子を上げる' },
  { type: 'rest', name: 'レスト', dist: 0, comment: '休養。散歩でもよい' },
  { type: 'interval', name: '★ (2000m×4)+400m', dist: 9, paceKey: 'race', comment: 'レースペース刺激。ラストはレースペースより速く。レスト1〜3分', key: true, detail: { reps: '2000m × 4 + 400m', rest: 'レスト1〜3分' } },
  { type: 'jog', name: 'JOG 45〜60分', dist: 8, paceKey: 'jog', comment: 'ポイント練習に向け調子を上げるイメージ' },
  { type: 'jog', name: 'JOG 60〜90分', dist: 12, paceKey: 'jog', comment: '回復を図るイメージでゆっくり長く' },
  { type: 'interval', name: '★ 1km×8', dist: 8, paceKey: 'race', comment: 'ロードでスピード刺激。レースペース、レスト1分', key: true, detail: { reps: '1000m × 8', rest: 'レスト1分' } },
  { type: 'jog', name: 'D-up+JOG 45分', dist: 8, paceKey: 'jog', comment: 'ドリルで動きを整え、調子を上げる' },
  { type: 'rest', name: 'レスト', dist: 0, comment: '休養。散歩でもよい' },
  { type: 'long', name: '★ 24km走', dist: 24, paceKey: 'long', comment: '距離刺激が目的。しっかり走り込む', key: true },
  { type: 'jog', name: 'JOG 60〜90分', dist: 12, paceKey: 'jog', comment: 'トラックより長めに60〜90分走る' }
];

// Apply Manako overlay to the last N days before race
function applyManakoOverlay(weeks, raceDate, raceType, paces) {
  const raceDateObj = fromISO(raceDate);
  const manakoData = raceType === 'half' ? MANAKO_HALF : MANAKO_FULL;
  for (const week of weeks) {
    for (let i = 0; i < week.days.length; i++) {
      const dayDate = fromISO(week.days[i].date);
      const diffDays = Math.round((raceDateObj - dayDate) / (24 * 60 * 60 * 1000));
      if (diffDays >= 0 && diffDays < manakoData.length) {
        const m = manakoData[diffDays];
        week.days[i] = {
          date: week.days[i].date, dayJa: week.days[i].dayJa, dayEn: week.days[i].dayEn,
          type: m.type, name: m.name, dist: m.dist,
          pace: m.paceKey && paces[m.paceKey] ? formatPace(paces[m.paceKey], true) : '-',
          comment: m.comment || '', detail: m.detail || undefined,
          isKeyWorkout: m.key || false
        };
      }
    }
    week.totalDist = roundKm(week.days.reduce((s, d) => s + d.dist, 0));
  }
}

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

function formatPace(minPerKm, roundTo5) {
  const m = Math.floor(minPerKm);
  let s = Math.round((minPerKm - m) * 60);
  if (roundTo5) s = Math.round(s / 5) * 5;
  if (s >= 60) return (m + 1) + ':00';
  return m + ':' + String(s).padStart(2, '0');
}

// --- Plan Generation ---
function generatePlanData(raceName, raceDate, raceType, targetTime, daySchedule, manakoMode) {
  const paces = calcPaces(targetTime, raceType);
  const raceD = fromISO(raceDate);
  const startMonday = getMonday(today());
  const weeksAvail = weeksBetween(startMonday, raceD);
  // Include race week (+1) so race day is in the plan
  const totalWeeks = Math.max(4, Math.min(24, weeksAvail + 1));

  const schedule = daySchedule || DEFAULT_DAY_SCHEDULE;

  // Count jog slots for distributing light/normal jog
  const jogSlots = schedule.reduce((arr, t, i) => { if (t === 'jog') arr.push(i); return arr; }, []);

  // Volume scale: half = smaller, full = larger
  const scale = raceType === 'half' ? 0.7 : 1.0;
  const paceScale = paces.race < 4.5 ? 1.15 : paces.race < 5.5 ? 1.0 : 0.9;

  const weeks = [];

  for (let w = 0; w < totalWeeks; w++) {
    const frac = w / totalWeeks;
    let phase, phaseName;
    if (frac < 0.25) { phase = 'base'; phaseName = '基礎期'; }
    else if (frac < 0.6) { phase = 'build'; phaseName = 'ビルドアップ期'; }
    else if (frac < 0.85) { phase = 'peak'; phaseName = 'ピーク期'; }
    else { phase = 'taper'; phaseName = 'テーパリング期'; }

    const isRecovery = (w > 0 && w % 4 === 3);
    const volMult = isRecovery ? 0.7 : 1.0;

    const progress = 1 + frac * 0.6;
    const taperFactor = phase === 'taper' ? 0.7 - (frac - 0.85) * 2 : 1.0;
    const factor = progress * taperFactor * volMult * scale * paceScale;

    const jogLightDist = roundKm(5 * Math.min(factor, 1.3));
    const jogDist = roundKm(7 * Math.min(factor, 1.5));
    const tempoDist = roundKm(10 * factor);
    const longBase = raceType === 'half' ? 10 : 14;
    const longDist = roundKm((longBase + w * 1.2) * scale * paceScale * taperFactor * volMult);

    const intv = INTERVALS[w % INTERVALS.length];
    const intervalDist = parseRepsDist(intv.reps);
    const weekStart = addDays(startMonday, w * 7);

    // Build days from schedule
    let jogCount = 0;
    const days = schedule.map((type, i) => {
      if (type === 'rest') {
        return { type: 'rest', name: 'レスト', dist: 0, pace: '-' };
      }
      if (type === 'interval') {
        return { type: 'interval', name: 'インターバル', dist: intervalDist, pace: formatPace(paces.interval, true), detail: intv };
      }
      if (type === 'tempo') {
        return { type: 'tempo', name: 'テンポラン', dist: tempoDist, pace: formatPace(paces.tempo, true) };
      }
      if (type === 'long') {
        return { type: 'long', name: 'ロングラン', dist: longDist, pace: formatPace(paces.long, true) };
      }
      // jog: alternate between light and normal
      jogCount++;
      const isLight = jogCount % 2 === 1;
      return { type: 'jog', name: 'ジョグ', dist: isLight ? jogLightDist : jogDist, pace: formatPace(paces.jog, true) };
    });

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

  // Mark race day as "大会当日" and post-race days as rest
  const raceDateStr = raceDate;
  for (const week of weeks) {
    for (let i = 0; i < week.days.length; i++) {
      const d = week.days[i];
      if (d.date === raceDateStr) {
        week.days[i] = { ...d, type: 'race', name: '大会当日', dist: raceType === 'half' ? 21.1 : 42.195, pace: formatPace(paces.race, true), comment: raceName };
      } else if (d.date > raceDateStr) {
        week.days[i] = { ...d, type: 'rest', name: 'レスト', dist: 0, pace: '-', comment: '' };
      }
    }
    week.totalDist = roundKm(week.days.reduce((s, d) => s + d.dist, 0));
  }

  // Apply Manako pre-race overlay if enabled
  if (manakoMode) {
    applyManakoOverlay(weeks, raceDate, raceType, paces);
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

  _myShortId: null,

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

    // Show login screen for first-time users (no plan, not logged in)
    this._checkFirstTimeLogin();

    // Service Worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }

    // Initial avatar render (not logged in state)
    this.updateAllAvatars(null);
  },

  _checkFirstTimeLogin() {
    // Show login screen if: no plan exists AND user hasn't skipped login before
    const skipped = localStorage.getItem('runner-coach-login-skipped');
    if (!this.state || !this.state.plan) {
      if (!skipped && typeof Social !== 'undefined' && Social.enabled) {
        // Will be shown after Firebase init; handled in onAuthChanged
        this._showLoginPending = true;
      }
    }
  },

  skipLogin() {
    localStorage.setItem('runner-coach-login-skipped', '1');
    document.getElementById('login-screen').classList.remove('show');
    this.switchTab('goal', document.querySelector('[data-tab="goal"]'));
  },

  // --- Auth callback ---
  async onAuthChanged(user) {
    // Handle first-time login screen
    const loginScreen = document.getElementById('login-screen');
    if (user) {
      // User logged in — hide login screen
      loginScreen.classList.remove('show');
      // If they had no plan, go to goal
      if (!this.state || !this.state.plan) {
        this.switchTab('goal', document.querySelector('[data-tab="goal"]'));
      }
    } else if (this._showLoginPending) {
      // First-time user, no plan, show login screen
      loginScreen.classList.add('show');
      this._showLoginPending = false;
    }

    // Update all avatar buttons
    this.updateAllAvatars(user);

    // Fetch short ID for popup
    if (user && typeof Social !== 'undefined' && Social.enabled) {
      this._myShortId = await Social.getOrCreateUserId();
    } else {
      this._myShortId = null;
    }

    this.renderFriends();
    // Sync or restore from cloud
    if (user && typeof Social !== 'undefined' && Social.enabled) {
      // If local state is empty, try to restore from cloud first
      if (!this.state || !this.state.plan) {
        const cloudData = await Social.getUserProfile(user.uid);
        if (cloudData && cloudData.plan && cloudData.plan.length > 0) {
          this.state = {
            raceName: cloudData.settings.raceName || '',
            raceDate: cloudData.settings.raceDate || '',
            raceType: cloudData.settings.raceType || 'full',
            targetTime: cloudData.settings.targetTime || '',
            plan: cloudData.plan,
            completed: cloudData.completed || {},
            actualDist: cloudData.actualDist || {},
            strengthPlan: cloudData.strengthPlan || {},
            strengthPatterns: cloudData.strengthPatterns || [],
            paces: this._recalcPaces(cloudData.settings.targetTime, cloudData.settings.raceType)
          };
          saveState(this.state);
          this.renderGoalScreen();
          this.renderToday();
          this.renderPlan();
          this.switchTab('today', document.querySelector('[data-tab="today"]'));
        }
      } else {
        // Local has data — sync to cloud
        Social.syncToCloud(this.state);
      }
      // Process invite link if present
      this._processInviteParam();
    }
  },

  async _processInviteParam() {
    const params = new URLSearchParams(location.search);
    const inviteUid = params.get('invite');
    if (!inviteUid) return;
    // Clear the param from URL to avoid re-processing
    const cleanUrl = location.origin + location.pathname;
    history.replaceState(null, '', cleanUrl);
    if (!Social.currentUser || inviteUid === Social.currentUser.uid) return;
    const added = await Social.acceptInvite(inviteUid);
    if (added) {
      this.switchTab('team', document.querySelector('[data-tab="team"]'));
      this.renderFriends();
      alert('友達になりました！');
    }
  },

  _recalcPaces(targetTime, raceType) {
    if (!targetTime) return { jog: '6:00', tempo: '5:00', interval: '4:30', long: '5:30', race: '5:10' };
    const paces = calcPaces(targetTime, raceType || 'full');
    return {
      jog: formatPace(paces.jog, true),
      tempo: formatPace(paces.tempo, true),
      interval: formatPace(paces.interval, true),
      long: formatPace(paces.long, true),
      race: formatPace(paces.race, true)
    };
  },

  updateAllAvatars(user) {
    const btns = document.querySelectorAll('.nav-avatar-btn');
    btns.forEach(btn => {
      if (user && user.photoURL) {
        btn.innerHTML = '<img src="' + escapeHtml(user.photoURL) + '" alt="">';
      } else if (user && user.displayName) {
        btn.innerHTML = '<span class="avatar-initial" style="background:var(--color-brand-primary);width:100%;height:100%;display:flex;align-items:center;justify-content:center;border-radius:50%;color:#fff">' + escapeHtml(user.displayName[0]) + '</span>';
      } else {
        // Not logged in — show generic person icon
        btn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="var(--color-label-secondary)"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>';
      }
    });
  },

  toggleAccountPopup() {
    const popup = document.getElementById('account-popup');
    const backdrop = document.getElementById('account-popup-backdrop');
    if (popup.classList.contains('show')) {
      this.closeAccountPopup();
    } else {
      this._renderAccountPopup();
      popup.classList.add('show');
      backdrop.classList.add('show');
    }
  },

  closeAccountPopup() {
    document.getElementById('account-popup').classList.remove('show');
    document.getElementById('account-popup-backdrop').classList.remove('show');
  },

  _renderAccountPopup() {
    const popup = document.getElementById('account-popup');
    const user = (typeof Social !== 'undefined') ? Social.currentUser : null;

    if (!user) {
      popup.innerHTML =
        '<div style="text-align:center;padding:var(--space-md)">' +
          '<div style="font-size:32px;margin-bottom:var(--space-sm)">👤</div>' +
          '<div style="font-weight:var(--font-weight-semibold);margin-bottom:var(--space-sm)">ログインしていません</div>' +
          '<div class="text-sm text-secondary" style="margin-bottom:var(--space-base)">Googleログインで仲間とつながれます</div>' +
          '<button class="login-btn" onclick="Social.login();App.closeAccountPopup()">' +
            '<svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>' +
            'Googleでログイン</button>' +
        '</div>';
      return;
    }

    const avatarHTML = user.photoURL
      ? '<div class="account-popup-avatar"><img src="' + escapeHtml(user.photoURL) + '" alt=""></div>'
      : '<div class="account-popup-avatar-placeholder">' + escapeHtml((user.displayName || 'U')[0]) + '</div>';

    const idHTML = this._myShortId
      ? '<div class="account-popup-id"><span>あなたのID</span><span class="id-value">' + escapeHtml(this._myShortId) + '</span><button class="id-copy-small" onclick="navigator.clipboard.writeText(\'' + escapeHtml(this._myShortId) + '\');this.textContent=\'✓\';setTimeout(()=>this.textContent=\'コピー\',1500)">コピー</button></div>'
      : '';

    popup.innerHTML =
      '<div class="account-popup-header">' + avatarHTML +
        '<div><div class="account-popup-name">' + escapeHtml(user.displayName || '') + '</div>' +
        '<div class="account-popup-email">' + escapeHtml(user.email || '') + '</div></div>' +
      '</div>' + idHTML +
      '<div class="account-popup-actions">' +
        '<button class="account-popup-logout" onclick="Social.logout();App.closeAccountPopup()">ログアウト</button>' +
      '</div>';
  },

  // --- Plan Type Tab ---
  _planViewType: 'run', // 'run' or 'strength'

  switchPlanType(type) {
    this._planViewType = type;
    document.querySelectorAll('.plan-type-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.planType === type);
    });
    document.getElementById('plan-run-content').style.display = type === 'run' ? 'block' : 'none';
    document.getElementById('plan-strength-content').style.display = type === 'strength' ? 'block' : 'none';
  },

  // --- Tab Switching ---
  switchTab(id, el) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('screen-' + id).classList.add('active');
    document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
    if (el) el.classList.add('active');
    window.scrollTo(0, 0);
    if (id === 'friends') this.renderFriends();
    if (id === 'plan') {
      const navbar = document.querySelector('#screen-plan .nav-bar');
      const wrap = document.querySelector('.plan-type-tabs-wrap');
      if (navbar && wrap) wrap.style.top = navbar.offsetHeight + 'px';
    }
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

    // Manako mode checkbox
    const manakoInput = document.getElementById('input-manako');
    if (manakoInput) manakoInput.checked = !!s.manakoMode;

    // Day schedule selector
    this.renderDaySchedule(s.daySchedule || DEFAULT_DAY_SCHEDULE);
  },

  renderDaySchedule(schedule) {
    const el = document.getElementById('day-schedule');
    if (!el) return;
    const typeOptions = [
      { value: 'rest', label: 'レスト', color: 'var(--color-rest-day)' },
      { value: 'jog', label: 'ジョグ', color: 'var(--color-easy-run)' },
      { value: 'interval', label: 'インターバル', color: 'var(--color-interval)' },
      { value: 'tempo', label: 'テンポラン', color: 'var(--color-tempo-run)' },
      { value: 'long', label: 'ロングラン', color: 'var(--color-long-run)' }
    ];
    el.innerHTML = DAYS_JA.map((day, i) => {
      const options = typeOptions.map(t =>
        '<option value="' + t.value + '"' + (schedule[i] === t.value ? ' selected' : '') + '>' + t.label + '</option>'
      ).join('');
      const color = typeOptions.find(t => t.value === schedule[i]);
      return '<div class="day-schedule-row">' +
        '<span class="day-schedule-dot" id="day-dot-' + i + '" style="background:' + (color ? color.color : 'var(--color-rest-day)') + '"></span>' +
        '<span class="day-schedule-label">' + day + '</span>' +
        '<select class="day-schedule-select" id="day-sched-' + i + '" onchange="App.onDayScheduleChange(' + i + ',this.value)">' + options + '</select>' +
      '</div>';
    }).join('');
  },

  onDayScheduleChange(dayIdx, value) {
    const dot = document.getElementById('day-dot-' + dayIdx);
    if (dot) {
      const colorMap = { rest: 'var(--color-rest-day)', jog: 'var(--color-easy-run)', interval: 'var(--color-interval)', tempo: 'var(--color-tempo-run)', long: 'var(--color-long-run)' };
      dot.style.background = colorMap[value] || 'var(--color-rest-day)';
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

    // Read day schedule from form
    const daySchedule = [];
    for (let i = 0; i < 7; i++) {
      const sel = document.getElementById('day-sched-' + i);
      daySchedule.push(sel ? sel.value : DEFAULT_DAY_SCHEDULE[i]);
    }

    // Read manako mode
    const manakoCheckbox = document.getElementById('input-manako');
    const manakoMode = manakoCheckbox ? manakoCheckbox.checked : false;

    const newWeeks = generatePlanData(raceName, raceDate, raceType, targetTime, daySchedule, manakoMode);
    const paces = calcPaces(targetTime, raceType);

    // Preserve past days from existing plan (before today)
    const todayStr = toISO(today());
    if (this.state && this.state.plan) {
      const oldDayMap = {};
      for (const week of this.state.plan) {
        for (const day of week.days) {
          oldDayMap[day.date] = day;
        }
      }
      for (const week of newWeeks) {
        for (let i = 0; i < week.days.length; i++) {
          const d = week.days[i];
          if (d.date < todayStr && oldDayMap[d.date]) {
            // Keep the old day's workout data, only update date metadata
            const old = oldDayMap[d.date];
            week.days[i] = { ...old, dayJa: d.dayJa, dayEn: d.dayEn };
          }
        }
        week.totalDist = roundKm(week.days.reduce((s, d) => s + d.dist, 0));
      }
    }

    this.state = {
      raceName, raceDate, raceType, targetTime, daySchedule, manakoMode,
      paces: {
        jog: formatPace(paces.jog, true),
        tempo: formatPace(paces.tempo, true),
        interval: formatPace(paces.interval, true),
        long: formatPace(paces.long, true),
        race: formatPace(paces.race, true)
      },
      plan: newWeeks,
      completed: this.state ? (this.state.completed || {}) : {},
      actualDist: this.state ? (this.state.actualDist || {}) : {},
      strengthPlan: this.state ? (this.state.strengthPlan || {}) : {}
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

    let heroDetail;
    if (w.dist > 0) {
      heroDetail = '合計 ' + formatDist(w.dist, w.type) + 'km・推定 ' + estimateTime(w.dist, w.pace);
    } else if (w.duration > 0) {
      heroDetail = w.duration + '分';
    } else {
      heroDetail = '休養日';
    }
    const commentHTML = w.comment ? '<div class="workout-comment">' + escapeHtml(w.comment) + '</div>' : '';

    const isRaceDay = this.state.raceDate && todayStr === this.state.raceDate;
    const isActive = this.state.activeWorkout && this.state.activeWorkout.date === todayStr;
    let btnHTML = '';
    if (!isRaceDay && w.type !== 'rest' && w.type !== 'race') {
      if (done) {
        btnHTML = '<button class="start-btn completed-btn">\u2713 完了済み</button>';
      } else if (isActive) {
        btnHTML = '<button class="start-btn active-btn" onclick="App.completeToday()">' +
          '<span class="active-pulse"></span>トレーニング完了</button>';
      } else {
        btnHTML = '<button class="start-btn" onclick="App.startWorkout()"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>スタート</button>';
      }
    }

    // Race countdown
    let countdownHTML = '';
    if (this.state.raceDate) {
      const raceD = fromISO(this.state.raceDate);
      const todayD = new Date(); todayD.setHours(0,0,0,0);
      const diffMs = raceD - todayD;
      const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      if (daysLeft > 0) {
        countdownHTML = '<div class="race-countdown">' +
          '<span class="race-countdown-icon">🏁</span>' +
          '<span class="race-countdown-text">' + escapeHtml(this.state.raceName) + 'まで</span>' +
          '<span class="race-countdown-days">あと ' + daysLeft + '日</span>' +
        '</div>';
      } else if (daysLeft === 0) {
        countdownHTML = '<div class="race-countdown">' +
          '<span class="race-countdown-icon">🎉</span>' +
          '<span class="race-countdown-text">' + escapeHtml(this.state.raceName) + '</span>' +
          '<span class="race-countdown-days">今日が本番!</span>' +
        '</div>';
      }
    }

    // Hero card
    let heroHTML;
    if (isRaceDay) {
      heroHTML = '<div class="today-hero" style="background:linear-gradient(135deg,#FF3B30,#FF9500)">' +
        '<div class="workout-type">RACE DAY</div>' +
        '<div class="workout-name">\u{1F3C1} 大会当日</div>' +
        '<div class="workout-detail">' + escapeHtml(this.state.raceName) + '</div>' +
      '</div>';
    } else {
      heroHTML = '<div class="today-hero type-' + w.type + '">' +
        '<div class="workout-type">' + (w.type === 'rest' ? 'レスト' : 'ラン') + '</div>' +
        '<div class="workout-name">' + escapeHtml(w.name) + '</div>' +
        '<div class="workout-detail">' + heroDetail + '</div>' +
        commentHTML +
        btnHTML +
      '</div>';
    }

    // Training friends mini cards
    const trainingFriendsHTML = this.buildTrainingFriendsHTML();

    const strengthHTML = this.buildTodayStrengthHTML();

    document.getElementById('today-content').innerHTML = countdownHTML +
      heroHTML +
      strengthHTML +
      trainingFriendsHTML +
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

  buildTrainingFriendsHTML() {
    if (!this.friendsData || this.friendsData.length === 0) return '';
    const activeFriends = this.friendsData.filter(f => isActiveWorkout(f.activeWorkout));
    if (activeFriends.length === 0) return '';

    const cards = activeFriends.map(f => {
      const colors = ['#FF6B6B,#FF3B30', '#5AC8FA,#007AFF', '#AF52DE,#5856D6', '#34C759,#248A3D', '#FF9500,#FF6B00'];
      const color = colors[Math.abs(hashStr(f.uid)) % colors.length];
      const initial = (f.displayName || f.email || '?')[0].toUpperCase();
      const avatar = f.photoURL
        ? '<img src="' + escapeHtml(f.photoURL) + '" class="training-friend-avatar">'
        : '<div class="training-friend-avatar-placeholder" style="background:linear-gradient(135deg,' + color + ')">' + escapeHtml(initial) + '</div>';
      const startMs = f.activeWorkout.startedAt.toDate ? f.activeWorkout.startedAt.toDate().getTime() : f.activeWorkout.startedAt;
      const elapsedMin = Math.floor((Date.now() - startMs) / 60000);
      const elapsed = elapsedMin < 1 ? 'たった今' : elapsedMin + '分前\u301c';
      const workoutName = f.activeWorkout.workoutName || 'トレーニング';

      return '<div class="training-friend-mini">' +
        '<div class="training-friend-pulse"></div>' +
        avatar +
        '<div class="training-friend-body">' +
          '<div class="training-friend-name">' + escapeHtml(f.displayName || '友達') + '</div>' +
          '<div class="training-friend-detail">' + escapeHtml(workoutName) + '中・' + elapsed + '</div>' +
        '</div>' +
      '</div>';
    }).join('');

    return '<div class="training-friends-banner">' + cards + '</div>';
  },

  buildTodayStrengthHTML() {
    const todayStr = toISO(today());
    const sDay = this.getStrengthDay(todayStr);
    if (!sDay) return '';

    const patterns = this.getStrengthPatterns();
    const pat = patterns.find(p => p.id === sDay.patternId);
    const name = pat ? pat.name : '筋トレ';
    const isDone = sDay.done;

    return '<div class="today-strength-hero">' +
      '<div class="strength-hero-info">' +
        '<div class="strength-hero-type">筋トレ</div>' +
        '<div class="strength-hero-name">💪 ' + escapeHtml(name) + '</div>' +
      '</div>' +
      '<button class="strength-hero-btn' + (isDone ? ' done' : '') + '" onclick="App.toggleStrengthDone(\'' + todayStr + '\')">' +
        (isDone ? '✓ 完了済み' : '完了にする') +
      '</button>' +
    '</div>';
  },

  // --- Render Plan ---
  _scrollToDate: null,

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
        // Skip days after race
        if (this.state.raceDate && day.date > this.state.raceDate) continue;

        const done = this.isCompleted(day.date);
        const d = fromISO(day.date);
        const dateLabel = (d.getMonth() + 1) + '/' + d.getDate();
        const isRaceDay = this.state.raceDate && day.date === this.state.raceDate;

        if (isRaceDay) {
          html += '<li class="plan-item plan-item-race">' +
            '<span class="plan-dot" style="background:var(--color-interval)"></span>' +
            '<span class="plan-day">' + day.dayJa + '</span>' +
            '<span class="plan-date">' + dateLabel + '</span>' +
            '<span class="plan-name plan-race-label">\u{1F3C1} 大会当日</span>' +
          '</li>';
          continue;
        }

        const commentBadge = day.comment ? '<span class="plan-comment-badge" title="' + escapeHtml(day.comment) + '">\u2026</span>' : '';

        // Build detailed workout description
        const workoutDesc = formatWorkoutDescription(day);

        // Actual distance (user-recorded)
        const actualDist = this.getActualDist(day.date);
        let actualLabel = '';
        if (day.type !== 'rest') {
          if (actualDist !== null) {
            actualLabel = '<span class="plan-actual">' + actualDist + 'km</span>';
          } else if (done) {
            // Completed but no actual distance recorded — show planned as actual
            actualLabel = '<span class="plan-actual">' + formatDist(day.dist, day.type) + 'km</span>';
          } else {
            actualLabel = '<span class="plan-actual plan-actual-empty">\u2014</span>';
          }
        }

        const keyClass = day.isKeyWorkout ? ' key-workout' : '';
        const todayClass = day.date === toISO(today()) ? ' plan-item-today' : '';
        html += '<li class="plan-item' + keyClass + todayClass + '" data-date="' + day.date + '" onclick="App.openEditWorkout(\'' + day.date + '\')" ' +
          'ontouchstart="App._moveStartTouch(event,\'' + day.date + '\')" ontouchend="App._moveCancelTouch()" ontouchmove="App._moveCancelTouch()" ' +
          'onmousedown="App._moveStartTouch(event,\'' + day.date + '\')" onmouseup="App._moveCancelTouch()" onmouseleave="App._moveCancelTouch()">' +
          '<span class="plan-dot" style="background:' + (TYPE_COLORS[day.type] || 'var(--color-fill-primary)') + '"></span>' +
          '<span class="plan-day">' + day.dayJa + '</span>' +
          '<span class="plan-date">' + dateLabel + '</span>' +
          '<span class="plan-name"><span class="plan-name-text">' + escapeHtml(workoutDesc) + '</span>' + commentBadge + '</span>' +
          actualLabel +
          '<span class="plan-check' + (done ? ' done' : '') + '" onclick="event.stopPropagation();App.toggleComplete(\'' + day.date + '\')"></span></li>';
      }
      html += '</ul></div>';
    }
    // Plan type tabs + content wrapper
    const tabsHTML = '<div class="plan-type-tabs-wrap"><div class="plan-type-tabs">' +
      '<button class="plan-type-tab' + (this._planViewType === 'run' ? ' active' : '') + '" data-plan-type="run" onclick="App.switchPlanType(\'run\')">🏃 ラン</button>' +
      '<button class="plan-type-tab' + (this._planViewType === 'strength' ? ' active' : '') + '" data-plan-type="strength" onclick="App.switchPlanType(\'strength\')">💪 筋トレ</button>' +
    '</div></div>';

    const strengthHTML = this.renderStrengthPlan();

    document.getElementById('plan-content').innerHTML = tabsHTML +
      '<div id="plan-run-content" style="display:' + (this._planViewType === 'run' ? 'block' : 'none') + '">' + html + '</div>' +
      '<div id="plan-strength-content" style="display:' + (this._planViewType === 'strength' ? 'block' : 'none') + '">' + strengthHTML + '</div>';

    // Set sticky top for plan-type-tabs based on navbar height
    const navbar = document.querySelector('#screen-plan .nav-bar');
    if (navbar) {
      const wrap = document.querySelector('.plan-type-tabs-wrap');
      if (wrap) wrap.style.top = navbar.offsetHeight + 'px';
    }

    // Auto-scroll to current week (for run plan)
    const scrollDate = this._scrollToDate;
    this._scrollToDate = null;
    const targetDate = scrollDate || toISO(today());
    const contentId = this._planViewType === 'run' ? 'plan-run-content' : 'plan-strength-content';
    setTimeout(() => {
      const content = document.getElementById(contentId);
      if (!content) return;
      const el = content.querySelector('.plan-item[data-date="' + targetDate + '"]');
      if (el) { el.scrollIntoView({ behavior: 'auto', block: 'center' }); return; }
      // Fallback: scroll to today's item even if targetDate not found
      if (scrollDate) {
        const todayEl = content.querySelector('.plan-item-today');
        if (todayEl) todayEl.scrollIntoView({ behavior: 'auto', block: 'center' });
      }
    }, 100);
  },

  // --- Strength Training Plan ---
  getStrengthPatterns() {
    if (!this.state) return [];
    if (!this.state.strengthPatterns) this.state.strengthPatterns = [];
    return this.state.strengthPatterns;
  },

  saveStrengthPatterns(patterns) {
    if (!this.state) return;
    this.state.strengthPatterns = patterns;
    saveState(this.state);
    if (typeof Social !== 'undefined' && Social.enabled) Social.syncToCloud(this.state);
  },

  getStrengthPlan() {
    if (!this.state) return {};
    if (!this.state.strengthPlan) this.state.strengthPlan = {};
    return this.state.strengthPlan;
  },

  getStrengthDay(dateStr) {
    const plan = this.getStrengthPlan();
    return plan[dateStr] || null;
  },

  setStrengthDay(dateStr, data) {
    if (!this.state) return;
    if (!this.state.strengthPlan) this.state.strengthPlan = {};
    if (!data || !data.patternId) {
      delete this.state.strengthPlan[dateStr];
    } else {
      this.state.strengthPlan[dateStr] = data;
    }
    saveState(this.state);
    if (typeof Social !== 'undefined' && Social.enabled) Social.syncToCloud(this.state);
  },

  toggleStrengthDone(dateStr) {
    const day = this.getStrengthDay(dateStr);
    if (!day) return;
    day.done = !day.done;
    this.setStrengthDay(dateStr, day);
    if (day.done) {
      this.showStrengthCompletion(dateStr);
    }
    this.renderPlan();
    this.renderToday();
  },

  showStrengthCompletion(dateStr) {
    const day = this.getStrengthDay(dateStr);
    if (!day) return;
    const patterns = this.getStrengthPatterns();
    const pat = patterns.find(p => p.id === day.patternId);
    const name = pat ? pat.name : '筋トレ';
    const overlay = document.getElementById('completion-overlay');
    document.getElementById('completion-title').textContent = 'ナイストレーニング!';
    document.getElementById('completion-subtitle').textContent = name + ' 完了';
    document.getElementById('completion-stats').innerHTML =
      '<div class="completion-stat"><div class="stat-value">💪</div><div class="stat-label">' + escapeHtml(name) + '</div></div>';
    overlay.classList.add('show');
    launchConfetti();
    if (navigator.vibrate) navigator.vibrate([50, 30, 100]);
  },

  selectStrengthPattern(dateStr, patternId) {
    if (!patternId) {
      // Clear the day
      this.setStrengthDay(dateStr, null);
    } else {
      const existing = this.getStrengthDay(dateStr);
      this.setStrengthDay(dateStr, { patternId: patternId, done: existing ? existing.done : false });
    }
    this.renderPlan();
    this.renderToday();
  },

  openStrengthPatternEditor() {
    const patterns = this.getStrengthPatterns();
    let listHTML = '';
    for (let i = 0; i < patterns.length; i++) {
      listHTML += '<div class="strength-pattern-row">' +
        '<input type="text" class="form-input strength-pattern-input" value="' + escapeHtml(patterns[i].name) + '" ' +
          'data-pattern-idx="' + i + '" placeholder="パターン名">' +
        '<button class="strength-remove-btn" onclick="App.removeStrengthPattern(' + i + ')">✕</button>' +
      '</div>';
    }
    const overlay = document.getElementById('edit-overlay');
    overlay.innerHTML =
      '<div class="edit-backdrop" onclick="App.closeStrengthPatternEditor()"></div>' +
      '<div class="edit-sheet">' +
        '<div class="edit-sheet-handle"></div>' +
        '<div class="edit-sheet-title">筋トレパターンを編集</div>' +
        '<div id="strength-pattern-list">' + listHTML + '</div>' +
        '<button class="strength-add-btn" style="width:100%;padding:var(--space-sm) 0;margin-top:var(--space-sm)" onclick="App.addStrengthPattern()">+ パターンを追加</button>' +
        '<div class="edit-actions">' +
          '<button class="edit-cancel-btn" onclick="App.closeStrengthPatternEditor()">キャンセル</button>' +
          '<button class="cta-btn edit-save-btn" onclick="App.saveStrengthPatternEditor()">保存</button>' +
        '</div>' +
      '</div>';
    overlay.classList.add('show');
  },

  addStrengthPattern() {
    const list = document.getElementById('strength-pattern-list');
    const idx = list.querySelectorAll('.strength-pattern-row').length;
    const row = document.createElement('div');
    row.className = 'strength-pattern-row';
    row.innerHTML = '<input type="text" class="form-input strength-pattern-input" value="" ' +
      'data-pattern-idx="' + idx + '" placeholder="パターン名">' +
      '<button class="strength-remove-btn" onclick="this.parentElement.remove()">✕</button>';
    list.appendChild(row);
    row.querySelector('input').focus();
  },

  removeStrengthPattern(idx) {
    const rows = document.querySelectorAll('.strength-pattern-row');
    if (rows[idx]) rows[idx].remove();
  },

  saveStrengthPatternEditor() {
    const inputs = document.querySelectorAll('.strength-pattern-input');
    const oldPatterns = this.getStrengthPatterns();
    const newPatterns = [];
    inputs.forEach(input => {
      const name = input.value.trim();
      if (!name) return;
      const oldIdx = parseInt(input.dataset.patternIdx);
      const existing = oldPatterns[oldIdx];
      newPatterns.push({ id: existing ? existing.id : 'sp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6), name: name });
    });
    this.saveStrengthPatterns(newPatterns);
    this.closeStrengthPatternEditor();
    this.renderPlan();
    this.renderToday();
  },

  closeStrengthPatternEditor() {
    document.getElementById('edit-overlay').classList.remove('show');
  },

  renderStrengthPlan() {
    if (!this.state || !this.state.plan) return '';
    const patterns = this.getStrengthPatterns();

    // Pattern editor button
    let html = '<div class="mx" style="padding:var(--space-md) 0">' +
      '<button class="small-btn primary" onclick="App.openStrengthPatternEditor()">パターンを編集</button>' +
      (patterns.length === 0 ? '<span style="margin-left:var(--space-sm);font-size:var(--font-size-caption1);color:var(--color-label-secondary)">まずパターンを作成してください</span>' : '') +
    '</div>';

    for (const week of this.state.plan) {
      const label = 'Week ' + week.weekNum;
      html += '<div class="plan-week"><div class="plan-week-header mt-lg">' + label + '</div><ul class="plan-list mx">';

      for (const day of week.days) {
        const d = fromISO(day.date);
        const dateLabel = (d.getMonth() + 1) + '/' + d.getDate();
        const sDay = this.getStrengthDay(day.date);
        const selectedId = sDay ? sDay.patternId : '';
        const isDone = sDay ? sDay.done : false;
        const patName = selectedId ? (patterns.find(p => p.id === selectedId) || {}).name || '' : '';

        // Build select options
        let options = '<option value="">— レスト —</option>';
        for (const p of patterns) {
          options += '<option value="' + p.id + '"' + (p.id === selectedId ? ' selected' : '') + '>' + escapeHtml(p.name) + '</option>';
        }

        const sTodayClass = day.date === toISO(today()) ? ' plan-item-today' : '';
        html += '<li class="plan-item' + sTodayClass + '" data-date="' + day.date + '">' +
          '<span class="plan-day">' + day.dayJa + '</span>' +
          '<span class="plan-date">' + dateLabel + '</span>' +
          '<span class="plan-name"><select class="strength-select" onchange="App.selectStrengthPattern(\'' + day.date + '\',this.value)">' + options + '</select></span>' +
          '<span class="plan-check' + (isDone ? ' done' : '') + '"' +
            (selectedId ? ' onclick="event.stopPropagation();App.toggleStrengthDone(\'' + day.date + '\')"' : '') +
            ' style="' + (selectedId ? '' : 'visibility:hidden') + '"></span>' +
        '</li>';
      }
      html += '</ul></div>';
    }
    return html;
  },

  // Get today's strength exercises for Today tab
  getTodayStrength() {
    const todayStr = toISO(today());
    return this.getStrengthDay(todayStr);
  },

  // Get actual distance for a date (null if not recorded)
  getActualDist(dateStr) {
    if (!this.state || !this.state.actualDist) return null;
    const val = this.state.actualDist[dateStr];
    return val !== undefined ? val : null;
  },

  // Set actual distance for a date
  setActualDist(dateStr, dist) {
    if (!this.state) return;
    if (!this.state.actualDist) this.state.actualDist = {};
    if (dist === null || dist === undefined || dist === '') {
      delete this.state.actualDist[dateStr];
    } else {
      this.state.actualDist[dateStr] = parseFloat(dist);
    }
    saveState(this.state);
  },

  // --- Friends ---
  friendsData: [],

  buildSelfCard() {
    const todayStr = toISO(today());
    const workout = this.getTodayWorkout();
    const done = this.isCompleted(todayStr);
    const completed = this.state ? (this.state.completed || {}) : {};
    const streak = calcStreak(completed, this.state ? this.state.plan : null);
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
      container.innerHTML = selfCardHTML +
        '<div class="empty-state"><div class="empty-icon">\u{1F465}</div>' +
        '<div class="empty-text">Firebase\u3092\u8a2d\u5b9a\u3059\u308b\u3068<br>\u4ef2\u9593\u306e\u30c8\u30ec\u30fc\u30cb\u30f3\u30b0\u304c\u898b\u3048\u307e\u3059</div></div>';
      return;
    }

    // Not logged in
    if (!Social.currentUser) {
      container.innerHTML =
        '<div class="card mx" style="text-align:center;padding:var(--space-lg)">' +
          '<div style="font-size:32px;margin-bottom:var(--space-sm)">👥</div>' +
          '<div style="font-weight:var(--font-weight-semibold);margin-bottom:var(--space-sm)">仲間とつながろう</div>' +
          '<div class="text-sm text-secondary" style="margin-bottom:var(--space-base)">Googleログインで友達のトレーニングが見えるように</div>' +
          '<button class="login-btn" onclick="Social.login()">' +
            '<svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>' +
            'Googleでログイン</button>' +
        '</div>' + selfCardHTML;
      return;
    }

    // Logged in — show: friend search + invite → self card → friends list
    const searchHTML =
      '<div class="section" style="padding-bottom:0"><div class="section-header">友達を追加</div>' +
      '<div class="card"><div class="friend-add-row">' +
      '<input type="text" id="friend-id-input" placeholder="友達のIDを入力" class="form-input" style="flex:1" maxlength="8">' +
      '<button class="cta-btn" style="width:auto;margin:0;padding:var(--space-sm) var(--space-base);font-size:var(--font-size-subhead)" onclick="App.addFriend()">検索</button>' +
      '</div>' +
      '<button class="invite-btn" onclick="App.copyInviteLink()">' +
        '<span class="invite-btn-icon">🔗</span>友達を招待' +
      '</button>' +
      '</div></div>';

    container.innerHTML = searchHTML + selfCardHTML +
      '<div id="friend-requests"></div>' +
      '<div id="friends-list"><div class="empty-state"><div class="empty-icon">\u{23F3}</div><div class="empty-text">読み込み中...</div></div></div>';

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
      // Re-render Today tab to update training friends
      if (this.state && this.state.plan) this.renderToday();
      return;
    }

    // Sort: active training first, then by streak (descending)
    friends.sort((a, b) => {
      const aActive = isActiveWorkout(a.activeWorkout);
      const bActive = isActiveWorkout(b.activeWorkout);
      if (aActive && !bActive) return -1;
      if (!aActive && bActive) return 1;
      return Social.calcStreak(b.completed) - Social.calcStreak(a.completed);
    });

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
        const todayHTML = buildTodayStatusHTML(friendWorkout, isDone, f.activeWorkout);

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
        const isActive = isActiveWorkout(f.activeWorkout);
        const activeClass = isActive ? ' friend-active' : '';
        const activeBadge = isActive ? ' <span class="friend-active-badge">\u{1F3C3} トレーニング中</span>' : '';
        const friendIdHTML = f.shortId ? '<div class="friend-id-display">ID: ' + escapeHtml(f.shortId) + '</div>' : '';

        return '<div class="friend-card' + activeClass + '"' + clickAttr + '>' + photo +
          '<div class="friend-info">' +
            '<div class="friend-name">' + escapeHtml(f.displayName || f.email) + activeBadge + '</div>' +
            friendIdHTML +
            '<div class="friend-goal">' + escapeHtml(goalText) + '</div>' +
            '<div class="friend-today">' + todayHTML + '</div>' +
            '<div class="friend-week">' + dots + '</div>' +
          '</div>' +
          '<div class="friend-streak"><div class="streak-num">' + streak + '</div><div class="streak-label">日連続</div></div>' +
        '</div>';
      }).join('') + '</div>';

    // Re-render Today tab to show training friends
    if (this.state && this.state.plan) this.renderToday();
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
        const migratedDay = { ...day, type: type };
        const nameDisplay = formatWorkoutDescription(migratedDay);
        const isToday = day.date === todayStr;

        const hasComment = day.comment && day.comment.trim();
        const commentBadge = hasComment ? '<span class="plan-comment-badge">\u2026</span>' : '';
        const itemClick = hasComment ? ' onclick="App.showFriendComment(\'' + uid + '\',\'' + day.date + '\')"' : '';
        const itemCursor = hasComment ? 'cursor:pointer' : 'cursor:default';

        planHTML += '<li class="plan-item' + (isToday ? ' friend-plan-today' : '') + '" style="' + itemCursor + '"' + itemClick + '>' +
          '<span class="plan-dot" style="background:' + (TYPE_COLORS[type] || 'var(--color-fill-primary)') + '"></span>' +
          '<span class="plan-day">' + day.dayJa + '</span>' +
          '<span class="plan-date">' + dateLabel + '</span>' +
          '<span class="plan-name"><span class="plan-name-text">' + escapeHtml(nameDisplay) + '</span>' + commentBadge + '</span>' +
          '<span class="plan-dist">' + distLabel + '</span>' +
          '<span class="plan-check' + (done ? ' done' : '') + '"></span></li>';
      }
      planHTML += '</ul></div>';
    }

    const overlay = document.getElementById('friend-plan-overlay');
    overlay.innerHTML =
      '<div class="friend-plan-header">' +
        '<div class="friend-plan-header-row"><button class="friend-plan-close" onclick="App.closeFriendPlan()">\u2715</button></div>' +
        '<div class="friend-plan-name">' + escapeHtml(friend.displayName || friend.email || '友達') + ' のプラン</div>' +
        (friend.shortId ? '<div style="font-size:var(--font-size-caption1);color:var(--color-label-primary);font-weight:600;margin-top:2px;letter-spacing:0.5px">ID: ' + escapeHtml(friend.shortId) + '</div>' : '') +
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

  copyInviteLink() {
    if (!Social.currentUser) return;
    const base = location.origin + location.pathname;
    const url = base + '?invite=' + Social.currentUser.uid;
    if (navigator.share) {
      navigator.share({ title: 'Runner Coach', text: '一緒にトレーニングしよう！', url: url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url).then(() => {
        this._showInviteCopied();
      }).catch(() => {
        // Fallback
        prompt('このURLを友達に共有してください:', url);
      });
    }
  },

  _showInviteCopied() {
    const btn = document.querySelector('.invite-btn');
    if (!btn) return;
    const orig = btn.innerHTML;
    btn.innerHTML = '<span class="invite-btn-icon">✓</span>コピーしました！';
    btn.classList.add('invite-btn-copied');
    setTimeout(() => {
      btn.innerHTML = orig;
      btn.classList.remove('invite-btn-copied');
    }, 2000);
  },

  // --- Edit Workout ---
  openEditWorkout(dateStr) {
    // Skip if triggered by click after a long-press
    if (this._longPressTriggered) { this._longPressTriggered = false; return; }
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
    const durationVal = targetDay.duration || '';
    const isInterval = targetDay.type === 'interval';
    const isRest = targetDay.type === 'rest';

    // Parse interval rep info from detail
    let repDist = 400, repCount = 8;
    if (isInterval && targetDay.detail && targetDay.detail.reps) {
      const m = targetDay.detail.reps.match(/(\d+)m\s*[×x]\s*(\d+)/i);
      if (m) { repDist = parseInt(m[1]); repCount = parseInt(m[2]); }
    }

    // Parse pace to minutes and seconds
    let paceMin = '', paceSec = '';
    if (targetDay.pace && targetDay.pace !== '-') {
      const pp = targetDay.pace.split(':');
      paceMin = pp[0] || '';
      paceSec = pp[1] || '00';
    }

    // Actual distance
    const actualDist = this.getActualDist(dateStr);
    const actualVal = actualDist !== null ? actualDist : '';

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
        '<div id="edit-normal-fields" style="display:' + (isInterval || isRest ? 'none' : 'block') + '">' +
          '<div class="edit-field"><label class="form-label">目標距離 or 目標時間</label>' +
            '<div class="edit-dist-duration-row">' +
              '<input type="number" id="edit-dist" class="form-input" value="' + distVal + '" min="0" step="1" placeholder="0">' +
              '<span class="edit-unit-label">km</span>' +
              '<span class="edit-unit-label">or</span>' +
              '<input type="number" id="edit-duration" class="form-input" value="' + durationVal + '" min="0" step="1" placeholder="—">' +
              '<span class="edit-unit-label">分</span>' +
            '</div>' +
            '<div class="form-hint" style="margin-top:var(--space-2xs)">両方入力時は距離を優先表示</div>' +
          '</div>' +
        '</div>' +
        '<div id="edit-pace-field" style="display:' + (isRest ? 'none' : 'block') + '">' +
          '<div class="edit-field"><label class="form-label">目標ペース (/km)</label>' +
            '<div class="time-input-group">' +
              '<input type="number" id="edit-pace-min" class="form-input time-input" value="' + paceMin + '" min="2" max="15" placeholder="分">' +
              '<span class="time-separator">:</span>' +
              '<input type="number" id="edit-pace-sec" class="form-input time-input" value="' + paceSec + '" min="0" max="59" placeholder="秒">' +
              '<span class="time-separator">/km</span>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div id="edit-actual-field" style="display:' + (isRest ? 'none' : 'block') + '">' +
          '<div class="edit-field"><label class="form-label">実績距離 (km)</label>' +
            '<input type="number" id="edit-actual-dist" class="form-input" value="' + actualVal + '" min="0" step="0.1" placeholder="実際に走った距離"></div>' +
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

  // --- Long-press to move workout ---
  _moveLongPressTimer: null,
  _movingDate: null,
  _longPressTriggered: false,

  _moveStartTouch(e, dateStr) {
    this._longPressTriggered = false;
    this._moveLongPressTimer = setTimeout(() => {
      this._longPressTriggered = true;
      this._openMoveSheet(dateStr);
    }, 500);
  },

  _moveCancelTouch() {
    if (this._moveLongPressTimer) {
      clearTimeout(this._moveLongPressTimer);
      this._moveLongPressTimer = null;
    }
  },

  _openMoveSheet(dateStr) {
    if (!this.state || !this.state.plan) return;
    this._movingDate = dateStr;

    // Collect all days from plan
    const allDays = [];
    for (const week of this.state.plan) {
      for (const day of week.days) allDays.push(day);
    }

    const srcIdx = allDays.findIndex(d => d.date === dateStr);
    if (srcIdx < 0) return;
    const srcDay = allDays[srcIdx];
    const srcDd = fromISO(dateStr);
    const srcLabel = srcDay.dayJa + ' ' + (srcDd.getMonth() + 1) + '/' + srcDd.getDate();

    // Build list of nearby days centered on source (~21 days)
    const start = Math.max(0, srcIdx - 10);
    const end = Math.min(allDays.length, srcIdx + 11);
    let listHTML = '';
    for (let i = start; i < end; i++) {
      const d = allDays[i];
      const dd = fromISO(d.date);
      const label = d.dayJa + ' ' + (dd.getMonth() + 1) + '/' + dd.getDate();
      const desc = formatWorkoutDescription(d);
      if (d.date === dateStr) {
        // Source day: highlighted, not clickable
        listHTML += '<li class="move-target-item move-source-highlight" id="move-source-item">' +
          '<span class="move-target-date">' + label + '</span>' +
          '<span class="move-target-desc">' + escapeHtml(desc) + '</span>' +
          '</li>';
      } else {
        listHTML += '<li class="move-target-item" onclick="App._executeMove(\'' + dateStr + '\',\'' + d.date + '\')">' +
          '<span class="move-target-date">' + label + '</span>' +
          '<span class="move-target-desc">' + escapeHtml(desc) + '</span>' +
          '</li>';
      }
    }

    const overlay = document.getElementById('edit-overlay');
    overlay.innerHTML =
      '<div class="edit-backdrop" onclick="App.closeMoveSheet()"></div>' +
      '<div class="edit-sheet">' +
        '<div class="edit-sheet-handle"></div>' +
        '<div class="edit-sheet-title">移動先を選択</div>' +
        '<ul class="move-target-list" id="move-target-list">' + listHTML + '</ul>' +
        '<div class="edit-actions">' +
          '<button class="edit-cancel-btn" onclick="App.closeMoveSheet()">キャンセル</button>' +
        '</div>' +
      '</div>';
    overlay.classList.add('show');
    // Scroll source item to center of list
    setTimeout(() => {
      const srcEl = document.getElementById('move-source-item');
      if (srcEl) srcEl.scrollIntoView({ block: 'center' });
    }, 50);
  },

  closeMoveSheet() {
    this._movingDate = null;
    document.getElementById('edit-overlay').classList.remove('show');
  },

  _executeMove(srcDate, destDate) {
    if (!this.state || !this.state.plan) return;

    // Collect all days in order
    const allDays = [];
    for (const week of this.state.plan) {
      for (const day of week.days) allDays.push(day);
    }

    const srcIdx = allDays.findIndex(d => d.date === srcDate);
    const destIdx = allDays.findIndex(d => d.date === destDate);
    if (srcIdx < 0 || destIdx < 0 || srcIdx === destIdx) return;

    // Extract workout data (not date/dayJa/dayEn) for shifting
    const extractWorkout = (d) => ({
      type: d.type, name: d.name, dist: d.dist, pace: d.pace,
      comment: d.comment, detail: d.detail, isKeyWorkout: d.isKeyWorkout,
      duration: d.duration
    });
    const applyWorkout = (d, w) => {
      d.type = w.type; d.name = w.name; d.dist = w.dist; d.pace = w.pace;
      d.comment = w.comment; d.isKeyWorkout = w.isKeyWorkout;
      d.duration = w.duration;
      if (w.detail) d.detail = w.detail; else delete d.detail;
    };

    if (destIdx > srcIdx) {
      // Moving forward: shift items between src+1..dest back by one
      const srcWorkout = extractWorkout(allDays[srcIdx]);
      for (let i = srcIdx; i < destIdx; i++) {
        applyWorkout(allDays[i], extractWorkout(allDays[i + 1]));
      }
      applyWorkout(allDays[destIdx], srcWorkout);
    } else {
      // Moving backward: shift items between dest..src-1 forward by one
      const srcWorkout = extractWorkout(allDays[srcIdx]);
      for (let i = srcIdx; i > destIdx; i--) {
        applyWorkout(allDays[i], extractWorkout(allDays[i - 1]));
      }
      applyWorkout(allDays[destIdx], srcWorkout);
    }

    // Recalc week totals
    for (const week of this.state.plan) {
      week.totalDist = roundKm(week.days.reduce((s, d) => s + d.dist, 0));
    }

    saveState(this.state);
    this.closeMoveSheet();
    this._scrollToDate = destDate;
    this.renderPlan();
  },

  onEditTypeChange() {
    const type = document.getElementById('edit-type').value;
    const isInterval = type === 'interval';
    const isRest = type === 'rest';
    document.getElementById('edit-interval-fields').style.display = isInterval ? 'block' : 'none';
    document.getElementById('edit-normal-fields').style.display = (isInterval || isRest) ? 'none' : 'block';
    document.getElementById('edit-pace-field').style.display = isRest ? 'none' : 'block';
    document.getElementById('edit-actual-field').style.display = isRest ? 'none' : 'block';
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
    } else if (newType === 'rest') {
      newDist = 0;
      newDetail = null;
    } else {
      newDist = Math.round(parseFloat(document.getElementById('edit-dist').value) || 0);
      newDetail = null;
    }

    // Duration (minutes)
    let newDuration = null;
    if (newType !== 'rest' && newType !== 'interval') {
      const durEl = document.getElementById('edit-duration');
      if (durEl && durEl.value) newDuration = parseInt(durEl.value) || null;
    }

    // Parse pace
    let newPace = '-';
    if (newType !== 'rest') {
      const pMin = document.getElementById('edit-pace-min').value;
      const pSec = document.getElementById('edit-pace-sec').value;
      if (pMin) {
        newPace = pMin + ':' + String(pSec || '0').padStart(2, '0');
      }
    }

    // Save actual distance
    if (newType !== 'rest') {
      const actualVal = document.getElementById('edit-actual-dist').value;
      this.setActualDist(dateStr, actualVal ? parseFloat(actualVal) : null);
    }

    for (const week of this.state.plan) {
      for (const day of week.days) {
        if (day.date === dateStr) {
          day.type = newType;
          day.dist = newDist;
          day.name = TYPE_JA[newType] || newType;
          day.comment = newComment;
          day.pace = newPace;
          if (newDetail) day.detail = newDetail;
          else delete day.detail;
          if (newDuration) day.duration = newDuration;
          else delete day.duration;
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
    this._scrollToDate = dateStr;
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

  startWorkout() {
    const todayStr = toISO(today());
    const workout = this.getTodayWorkout();
    const name = workout ? (TYPE_JA[workout.type] || workout.name) : 'ワークアウト';
    const type = workout ? workout.type : 'jog';
    this.state.activeWorkout = { date: todayStr, workoutName: name, type: type, startedAt: Date.now() };
    saveState(this.state);
    this.renderToday();
    if (typeof Social !== 'undefined' && Social.enabled) {
      Social.setActiveWorkout({ workoutName: name, type: type });
    }
  },

  completeToday() {
    const todayStr = toISO(today());
    const workout = this.getTodayWorkout();
    if (!this.state.completed) this.state.completed = {};
    this.state.completed[todayStr] = true;
    this.state.activeWorkout = null;
    saveState(this.state);
    this.showCompletion(workout);
    this.renderToday();
    this.renderPlan();
    if (typeof Social !== 'undefined' && Social.enabled) {
      Social.clearActiveWorkout();
      Social.syncToCloud(this.state);
    }
  },

  // --- Completion Overlay ---
  showCompletion(workout) {
    const overlay = document.getElementById('completion-overlay');
    document.getElementById('completion-title').textContent = 'ナイスラン!';
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
function calcStreak(completed, plan) {
  if (!completed) return 0;
  // Build a set of rest dates from the plan
  const restDates = new Set();
  if (plan) {
    for (const week of plan) {
      for (const day of week.days) {
        if (day.type === 'rest') restDates.add(day.date);
      }
    }
  }
  let streak = 0;
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  // Start from today or yesterday
  if (!completed[toISO(d)] && !restDates.has(toISO(d))) d.setDate(d.getDate() - 1);
  while (completed[toISO(d)] || restDates.has(toISO(d))) {
    if (completed[toISO(d)]) streak++;
    // Rest days are skipped (don't break streak, don't count)
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

function isActiveWorkout(aw) {
  if (!aw || !aw.startedAt) return false;
  const startMs = aw.startedAt.toDate ? aw.startedAt.toDate().getTime() : aw.startedAt;
  return (Date.now() - startMs) < 180 * 60000; // 3 hours
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

function formatWorkoutDescription(day) {
  if (day.type === 'rest') return 'レスト';
  if (day.type === 'race') return day.name || '大会当日';
  // Custom named workouts (manako etc): use name directly
  if (day.name && day.name !== TYPE_JA[day.type]) {
    return day.name;
  }
  if (day.type === 'interval' && day.detail) {
    return day.detail.reps + '（' + day.pace + '/km）';
  }
  // Duration-based display: "100分ジョグ" etc.
  const typeLabel = TYPE_JA[day.type] || day.name;
  if (day.dist > 0) {
    return formatDist(day.dist, day.type) + 'km' + typeLabel + '（' + day.pace + '/km）';
  }
  if (day.duration > 0) {
    return day.duration + '分' + typeLabel;
  }
  return typeLabel;
}

function buildTodayStatusHTML(workout, done, activeWorkout) {
  if (!workout) return '<span style="color:var(--color-label-secondary)">—</span>';
  const type = TYPE_MIGRATION[workout.type] || workout.type;
  if (type === 'rest') return '<span style="color:var(--color-label-secondary)">レスト</span>';
  const name = TYPE_JA[type] || workout.name;
  if (done) return '<span style="color:var(--color-success);font-weight:600">\u2713 ' + escapeHtml(name) + '完了</span>';
  // Active workout: check if startedAt is within 3 hours
  if (activeWorkout && activeWorkout.startedAt) {
    const startMs = activeWorkout.startedAt.toDate ? activeWorkout.startedAt.toDate().getTime() : activeWorkout.startedAt;
    const elapsedMin = Math.floor((Date.now() - startMs) / 60000);
    if (elapsedMin < 180) {
      const label = elapsedMin < 1 ? 'たった今' : elapsedMin + '分前から';
      return '<span class="friend-active-status"><span class="active-dot"></span>' + escapeHtml(activeWorkout.workoutName || name) + '中 <span class="active-elapsed">' + label + '</span></span>';
    }
  }
  return '<span style="color:var(--color-label-tertiary)">' + escapeHtml(name) + '</span>';
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
