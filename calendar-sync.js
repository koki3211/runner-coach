// ============================================================
// Runner Coach — Google Calendar Sync
// ============================================================

const CalendarSync = {
  SCOPE: 'https://www.googleapis.com/auth/calendar.events',
  API_BASE: 'https://www.googleapis.com/calendar/v3',
  STORAGE_KEY: 'runner-coach-cal',

  _accessToken: null,
  _tokenExpiry: 0,
  _enabled: false,
  _eventMap: {}, // key → { eventId, hash }
  _syncing: false,

  // --- Init ---
  init() {
    this._enabled = localStorage.getItem(this.STORAGE_KEY + '-enabled') === '1';
    this._accessToken = localStorage.getItem(this.STORAGE_KEY + '-token') || null;
    this._tokenExpiry = parseInt(localStorage.getItem(this.STORAGE_KEY + '-token-expiry') || '0');
    this._eventMap = JSON.parse(localStorage.getItem(this.STORAGE_KEY + '-events') || '{}');
  },

  isEnabled() { return this._enabled; },

  // --- Enable / Disable ---
  async enable() {
    const token = await this._getAccessToken(true);
    if (!token) return false;
    this._enabled = true;
    localStorage.setItem(this.STORAGE_KEY + '-enabled', '1');
    return true;
  },

  disable() {
    this._enabled = false;
    localStorage.setItem(this.STORAGE_KEY + '-enabled', '0');
  },

  // --- OAuth Token ---
  async _getAccessToken(forceRefresh) {
    if (!forceRefresh && this._accessToken && Date.now() < this._tokenExpiry) {
      return this._accessToken;
    }
    if (!firebase || !firebase.auth || !firebase.auth().currentUser) return null;
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.addScope(this.SCOPE);
    try {
      const result = await firebase.auth().currentUser.reauthenticateWithPopup(provider);
      if (result.credential && result.credential.accessToken) {
        this._accessToken = result.credential.accessToken;
        this._tokenExpiry = Date.now() + 3500 * 1000; // ~58 min
        localStorage.setItem(this.STORAGE_KEY + '-token', this._accessToken);
        localStorage.setItem(this.STORAGE_KEY + '-token-expiry', String(this._tokenExpiry));
        return this._accessToken;
      }
      return null;
    } catch (e) {
      console.error('Calendar auth failed:', e);
      // If popup closed or cancelled, don't disable
      if (e.code === 'auth/popup-closed-by-user') return null;
      return null;
    }
  },

  // --- Hash helper ---
  _hash(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = ((h << 5) - h) + str.charCodeAt(i);
      h |= 0;
    }
    return String(h);
  },

  // --- Build desired events from state ---
  _buildDesiredEvents(state) {
    const events = {};

    // Running plan
    if (state.plan && Array.isArray(state.plan)) {
      for (const week of state.plan) {
        if (!week || !week.days) continue;
        for (const day of week.days) {
          if (!day || day.type === 'rest') continue;
          const desc = typeof formatWorkoutDescription === 'function'
            ? formatWorkoutDescription(day)
            : (day.name || day.type);
          const title = '🏃 ' + desc;
          events['run:' + day.date] = { date: day.date, title: title, hash: this._hash(title) };
        }
      }
    }

    // Strength plan
    if (state.strengthPlan) {
      const patterns = state.strengthPatterns || [];
      for (const dateStr of Object.keys(state.strengthPlan)) {
        const dayData = state.strengthPlan[dateStr];
        if (!dayData || !dayData.patternIds || dayData.patternIds.length === 0) continue;
        const names = dayData.patternIds.map(function(id) {
          const p = patterns.find(function(pt) { return pt.id === id; });
          return p ? p.name : '';
        }).filter(Boolean).join('・');
        const title = '💪 ' + (names || '筋トレ');
        events['str:' + dateStr] = { date: dateStr, title: title, hash: this._hash(title) };
      }
    }

    return events;
  },

  // --- Main Sync ---
  async syncPlan(state) {
    if (!this._enabled || !state || this._syncing) return;
    this._syncing = true;
    try {
      const token = await this._getAccessToken(false);
      if (!token) { this._syncing = false; return; }

      const desired = this._buildDesiredEvents(state);

      // Diff
      const toCreate = [];
      const toUpdate = [];
      const toDelete = [];

      for (const key of Object.keys(desired)) {
        const ev = desired[key];
        const stored = this._eventMap[key];
        if (!stored) {
          toCreate.push({ key: key, date: ev.date, title: ev.title, hash: ev.hash });
        } else if (stored.hash !== ev.hash) {
          toUpdate.push({ key: key, eventId: stored.eventId, date: ev.date, title: ev.title, hash: ev.hash });
        }
      }
      for (const key of Object.keys(this._eventMap)) {
        if (!desired[key]) {
          toDelete.push({ key: key, eventId: this._eventMap[key].eventId });
        }
      }

      const total = toCreate.length + toUpdate.length + toDelete.length;
      if (total === 0) { this._syncing = false; return; }
      console.log('CalendarSync: ' + toCreate.length + ' create, ' + toUpdate.length + ' update, ' + toDelete.length + ' delete');

      // Execute with concurrency limit
      const tasks = [];
      for (const ev of toCreate) {
        tasks.push(this._doCreate(token, ev));
      }
      for (const ev of toUpdate) {
        tasks.push(this._doUpdate(token, ev));
      }
      for (const ev of toDelete) {
        tasks.push(this._doDelete(token, ev));
      }

      // Run up to 5 concurrently
      await this._runConcurrent(tasks, 5);
      this._saveEventMap();
    } catch (e) {
      console.error('CalendarSync error:', e);
    }
    this._syncing = false;
  },

  async _runConcurrent(tasks, limit) {
    const executing = [];
    for (const task of tasks) {
      const p = task();
      executing.push(p);
      if (executing.length >= limit) {
        await Promise.race(executing);
        // Remove resolved
        for (let i = executing.length - 1; i >= 0; i--) {
          // Check if resolved by trying to await with timeout 0
          const result = await Promise.race([executing[i], Promise.resolve('__pending__')]);
          if (result !== '__pending__') executing.splice(i, 1);
        }
      }
    }
    await Promise.all(executing);
  },

  // --- API operations (return thunks for concurrency control) ---
  _doCreate(token, ev) {
    const self = this;
    return async function() {
      try {
        const eventId = await self._apiCreateEvent(token, ev.date, ev.title);
        if (eventId) {
          self._eventMap[ev.key] = { eventId: eventId, hash: ev.hash };
        }
      } catch (e) {
        console.error('Calendar create failed for ' + ev.key + ':', e);
      }
    };
  },

  _doUpdate(token, ev) {
    const self = this;
    return async function() {
      try {
        const ok = await self._apiUpdateEvent(token, ev.eventId, ev.date, ev.title);
        if (ok) {
          self._eventMap[ev.key].hash = ev.hash;
        } else {
          // Event may have been deleted externally; recreate
          const newId = await self._apiCreateEvent(token, ev.date, ev.title);
          if (newId) {
            self._eventMap[ev.key] = { eventId: newId, hash: ev.hash };
          }
        }
      } catch (e) {
        console.error('Calendar update failed for ' + ev.key + ':', e);
      }
    };
  },

  _doDelete(token, ev) {
    const self = this;
    return async function() {
      try {
        await self._apiDeleteEvent(token, ev.eventId);
      } catch (e) {
        // Ignore delete errors (event may already be deleted)
      }
      delete self._eventMap[ev.key];
    };
  },

  // --- Google Calendar REST API ---
  async _apiCreateEvent(token, date, title) {
    const nextDay = this._nextDay(date);
    const res = await fetch(this.API_BASE + '/calendars/primary/events', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        summary: title,
        start: { date: date },
        end: { date: nextDay },
        transparency: 'transparent' // 予定あり表示にしない
      })
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error('Create event failed: ' + res.status + ' ' + err);
    }
    const data = await res.json();
    return data.id;
  },

  async _apiUpdateEvent(token, eventId, date, title) {
    const nextDay = this._nextDay(date);
    const res = await fetch(this.API_BASE + '/calendars/primary/events/' + encodeURIComponent(eventId), {
      method: 'PUT',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        summary: title,
        start: { date: date },
        end: { date: nextDay },
        transparency: 'transparent'
      })
    });
    if (res.status === 404 || res.status === 410) return false;
    if (!res.ok) {
      const err = await res.text();
      throw new Error('Update event failed: ' + res.status + ' ' + err);
    }
    return true;
  },

  async _apiDeleteEvent(token, eventId) {
    const res = await fetch(this.API_BASE + '/calendars/primary/events/' + encodeURIComponent(eventId), {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer ' + token }
    });
    // 404/410 = already deleted, that's fine
    if (!res.ok && res.status !== 404 && res.status !== 410) {
      const err = await res.text();
      throw new Error('Delete event failed: ' + res.status + ' ' + err);
    }
  },

  _nextDay(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() + 1);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  },

  // --- Persistence ---
  _saveEventMap() {
    localStorage.setItem(this.STORAGE_KEY + '-events', JSON.stringify(this._eventMap));
  },

  // --- Clear all calendar events ---
  async clearAll() {
    const token = await this._getAccessToken(false);
    if (!token) return;
    const keys = Object.keys(this._eventMap);
    for (const key of keys) {
      try {
        await this._apiDeleteEvent(token, this._eventMap[key].eventId);
      } catch (e) { /* ignore */ }
      delete this._eventMap[key];
    }
    this._saveEventMap();
  }
};
