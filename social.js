// ============================================================
// Runner Coach — Social (Firebase Auth + Firestore)
// ============================================================

const Social = {
  auth: null,
  db: null,
  currentUser: null,
  enabled: false,

  // --- Initialize ---
  init() {
    if (!FIREBASE_CONFIG.apiKey) {
      console.log('Firebase not configured — social features disabled');
      this.enabled = false;
      return;
    }
    try {
      firebase.initializeApp(FIREBASE_CONFIG);
      this.auth = firebase.auth();
      this.db = firebase.firestore();
      this.enabled = true;

      this.auth.onAuthStateChanged(user => {
        this.currentUser = user;
        App.onAuthChanged(user);
      });
    } catch (e) {
      console.error('Firebase init error:', e);
      this.enabled = false;
    }
  },

  // --- Auth ---
  async login() {
    if (!this.enabled) return null;
    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      const result = await this.auth.signInWithPopup(provider);
      return result.user;
    } catch (e) {
      if (e.code === 'auth/popup-blocked') {
        const provider = new firebase.auth.GoogleAuthProvider();
        this.auth.signInWithRedirect(provider);
      } else if (e.code === 'auth/unauthorized-domain') {
        alert('このドメインはFirebaseで許可されていません。\nFirebase Console → Authentication → Settings → Authorized domains に「' + location.hostname + '」を追加してください。');
      } else if (e.code !== 'auth/popup-closed-by-user') {
        console.error('Login error:', e);
        alert('ログインエラー: ' + e.message);
      }
      return null;
    }
  },

  async logout() {
    if (!this.enabled) return;
    await this.auth.signOut();
  },

  // --- User Short ID (8文字の共有用コード) ---
  generateShortId() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let id = '';
    for (let i = 0; i < 8; i++) id += chars[Math.floor(Math.random() * chars.length)];
    return id;
  },

  async getOrCreateUserId() {
    if (!this.enabled || !this.currentUser) return null;
    const uid = this.currentUser.uid;
    const localKey = 'runner-coach-shortId-' + uid;
    const localId = localStorage.getItem(localKey);
    const doc = await this.db.collection('users').doc(uid).get();
    if (doc.exists && doc.data().shortId) {
      const shortId = doc.data().shortId;
      localStorage.setItem(localKey, shortId);
      return shortId;
    }
    // Restore from localStorage if Firestore lost it
    if (localId) {
      await this.db.collection('users').doc(uid).set({ shortId: localId }, { merge: true });
      return localId;
    }
    const shortId = this.generateShortId();
    localStorage.setItem(localKey, shortId);
    await this.db.collection('users').doc(uid).set({ shortId }, { merge: true });
    return shortId;
  },

  // --- Profile & Sync ---
  async syncToCloud(state) {
    if (!this.enabled || !this.currentUser) return;
    if (!state) state = {};
    // Always include shortId to prevent accidental loss
    const shortId = await this.getOrCreateUserId();
    const data = {
      shortId: shortId,
      displayName: this.currentUser.displayName || '',
      photoURL: this.currentUser.photoURL || '',
      settings: {
        raceName: state.raceName || '',
        raceDate: state.raceDate || '',
        raceType: state.raceType || 'full',
        targetTime: state.targetTime || '',
        planWeeks: state.plan ? state.plan.length : 0
      },
      completed: state.completed || {},
      actualDist: state.actualDist || {},
      strengthPlan: state.strengthPlan || {},
      strengthPatterns: state.strengthPatterns || [],
      plan: state.plan || [],
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    await this.db.collection('users').doc(this.currentUser.uid).set(data, { merge: true });
  },

  async getUserProfile(uid) {
    if (!this.enabled) return null;
    const doc = await this.db.collection('users').doc(uid).get();
    return doc.exists ? doc.data() : null;
  },

  // --- Friend Search & Request ---
  async searchUserByShortId(shortId) {
    if (!this.enabled) return [];
    const snap = await this.db.collection('users')
      .where('shortId', '==', shortId.toUpperCase().trim())
      .limit(5)
      .get();
    return snap.docs
      .filter(d => d.id !== this.currentUser.uid)
      .map(d => ({ uid: d.id, ...d.data() }));
  },

  async sendFriendRequest(toUid) {
    if (!this.enabled || !this.currentUser) return false;
    // Check if already friends
    const myProfile = await this.getUserProfile(this.currentUser.uid);
    if (myProfile && myProfile.friends && myProfile.friends.includes(toUid)) return false;
    // Check existing pending request
    const existing = await this.db.collection('friendRequests')
      .where('fromUid', '==', this.currentUser.uid)
      .where('toUid', '==', toUid)
      .where('status', '==', 'pending')
      .get();
    if (!existing.empty) return false;

    await this.db.collection('friendRequests').add({
      fromUid: this.currentUser.uid,
      fromName: this.currentUser.displayName || 'ユーザー',
      fromPhoto: this.currentUser.photoURL || '',
      toUid: toUid,
      status: 'pending',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    return true;
  },

  async getIncomingRequests() {
    if (!this.enabled || !this.currentUser) return [];
    const snap = await this.db.collection('friendRequests')
      .where('toUid', '==', this.currentUser.uid)
      .where('status', '==', 'pending')
      .get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  async acceptRequest(requestId, fromUid) {
    if (!this.enabled || !this.currentUser) return;
    const batch = this.db.batch();
    batch.update(this.db.collection('friendRequests').doc(requestId), { status: 'accepted' });
    batch.update(this.db.collection('users').doc(this.currentUser.uid),
      { friends: firebase.firestore.FieldValue.arrayUnion(fromUid) });
    batch.update(this.db.collection('users').doc(fromUid),
      { friends: firebase.firestore.FieldValue.arrayUnion(this.currentUser.uid) });
    await batch.commit();
  },

  async declineRequest(requestId) {
    if (!this.enabled) return;
    await this.db.collection('friendRequests').doc(requestId).update({ status: 'declined' });
  },

  async removeFriend(friendUid) {
    if (!this.enabled || !this.currentUser) return;
    const batch = this.db.batch();
    batch.update(this.db.collection('users').doc(this.currentUser.uid),
      { friends: firebase.firestore.FieldValue.arrayRemove(friendUid) });
    batch.update(this.db.collection('users').doc(friendUid),
      { friends: firebase.firestore.FieldValue.arrayRemove(this.currentUser.uid) });
    await batch.commit();
  },

  // --- Invite Link: instant mutual friend ---
  async acceptInvite(inviterUid) {
    if (!this.enabled || !this.currentUser) return false;
    if (inviterUid === this.currentUser.uid) return false;
    // Check if already friends
    const myProfile = await this.getUserProfile(this.currentUser.uid);
    if (myProfile && myProfile.friends && myProfile.friends.includes(inviterUid)) return false;
    // Verify inviter exists
    const inviterProfile = await this.getUserProfile(inviterUid);
    if (!inviterProfile) return false;
    // Add each other as friends (same pattern as acceptRequest)
    const batch = this.db.batch();
    batch.update(this.db.collection('users').doc(this.currentUser.uid),
      { friends: firebase.firestore.FieldValue.arrayUnion(inviterUid) });
    batch.update(this.db.collection('users').doc(inviterUid),
      { friends: firebase.firestore.FieldValue.arrayUnion(this.currentUser.uid) });
    await batch.commit();
    return true;
  },

  // --- Load Friends Data ---
  async loadFriendsData() {
    if (!this.enabled || !this.currentUser) return [];
    const myProfile = await this.getUserProfile(this.currentUser.uid);
    if (!myProfile || !myProfile.friends || myProfile.friends.length === 0) return [];

    const friends = [];
    // Firestore 'in' supports up to 30
    const chunks = [];
    for (let i = 0; i < myProfile.friends.length; i += 30) {
      chunks.push(myProfile.friends.slice(i, i + 30));
    }
    for (const chunk of chunks) {
      const snap = await this.db.collection('users')
        .where(firebase.firestore.FieldPath.documentId(), 'in', chunk)
        .get();
      snap.docs.forEach(d => friends.push({ uid: d.id, ...d.data() }));
    }
    return friends;
  },

  // --- Streak Calculation ---
  calcStreak(completed) {
    if (!completed) return 0;
    let streak = 0;
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    // Start from today; if not done, start from yesterday
    if (!completed[toISO(d)]) d.setDate(d.getDate() - 1);
    while (completed[toISO(d)]) {
      streak++;
      d.setDate(d.getDate() - 1);
    }
    return streak;
  },

  // --- Active Workout ---
  async setActiveWorkout(data) {
    if (!this.enabled || !this.currentUser) return;
    await this.db.collection('users').doc(this.currentUser.uid).set({
      activeWorkout: {
        workoutName: data.workoutName || '',
        type: data.type || 'jog',
        startedAt: firebase.firestore.FieldValue.serverTimestamp()
      }
    }, { merge: true });
  },

  async clearActiveWorkout() {
    if (!this.enabled || !this.currentUser) return;
    await this.db.collection('users').doc(this.currentUser.uid).set({
      activeWorkout: null
    }, { merge: true });
  },

  // --- Week completion count ---
  calcWeekProgress(completed) {
    if (!completed) return { done: 0, total: 7 };
    const mon = getMonday(new Date());
    let done = 0;
    for (let i = 0; i < 7; i++) {
      const dateStr = toISO(addDays(mon, i));
      if (completed[dateStr]) done++;
    }
    return { done, total: 7 };
  }
};
