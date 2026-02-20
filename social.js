// ============================================================
// Runner Coach — Social (Firebase Auth + Firestore)
// ============================================================

const Social = {
  auth: null,
  db: null,
  currentUser: null,
  unsubFriends: null,
  enabled: false,

  // --- Initialize ---
  init() {
    if (!FIREBASE_CONFIG.apiKey) {
      console.log('Firebase not configured — running in offline mode');
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
      if (e.code !== 'auth/popup-closed-by-user') {
        console.error('Login error:', e);
      }
      return null;
    }
  },

  async logout() {
    if (!this.enabled) return;
    if (this.unsubFriends) { this.unsubFriends(); this.unsubFriends = null; }
    await this.auth.signOut();
  },

  // --- User Profile ---
  async saveUserProfile(settings, completed) {
    if (!this.enabled || !this.currentUser) return;
    const uid = this.currentUser.uid;
    const data = {
      displayName: this.currentUser.displayName || '',
      email: this.currentUser.email || '',
      photoURL: this.currentUser.photoURL || '',
      settings: settings || {},
      completed: completed || {},
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    await this.db.collection('users').doc(uid).set(data, { merge: true });
  },

  async getUserProfile(uid) {
    if (!this.enabled) return null;
    const doc = await this.db.collection('users').doc(uid).get();
    return doc.exists ? doc.data() : null;
  },

  // --- Friends ---
  async searchUserByEmail(email) {
    if (!this.enabled) return [];
    const snap = await this.db.collection('users')
      .where('email', '==', email.toLowerCase().trim())
      .limit(5)
      .get();
    return snap.docs
      .filter(d => d.id !== this.currentUser.uid)
      .map(d => ({ uid: d.id, ...d.data() }));
  },

  async sendFriendRequest(toEmail) {
    if (!this.enabled || !this.currentUser) return false;
    const existing = await this.db.collection('friendRequests')
      .where('fromUid', '==', this.currentUser.uid)
      .where('toEmail', '==', toEmail.toLowerCase().trim())
      .where('status', '==', 'pending')
      .get();
    if (!existing.empty) return false;

    await this.db.collection('friendRequests').add({
      fromUid: this.currentUser.uid,
      fromName: this.currentUser.displayName || this.currentUser.email,
      fromPhoto: this.currentUser.photoURL || '',
      toEmail: toEmail.toLowerCase().trim(),
      status: 'pending',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    return true;
  },

  async getIncomingRequests() {
    if (!this.enabled || !this.currentUser) return [];
    const snap = await this.db.collection('friendRequests')
      .where('toEmail', '==', this.currentUser.email.toLowerCase())
      .where('status', '==', 'pending')
      .get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  async acceptRequest(requestId, fromUid) {
    if (!this.enabled || !this.currentUser) return;
    const batch = this.db.batch();
    const reqRef = this.db.collection('friendRequests').doc(requestId);
    batch.update(reqRef, { status: 'accepted' });

    const myRef = this.db.collection('users').doc(this.currentUser.uid);
    batch.update(myRef, { friends: firebase.firestore.FieldValue.arrayUnion(fromUid) });

    const theirRef = this.db.collection('users').doc(fromUid);
    batch.update(theirRef, { friends: firebase.firestore.FieldValue.arrayUnion(this.currentUser.uid) });

    await batch.commit();
  },

  async declineRequest(requestId) {
    if (!this.enabled) return;
    await this.db.collection('friendRequests').doc(requestId).update({ status: 'declined' });
  },

  async removeFriend(friendUid) {
    if (!this.enabled || !this.currentUser) return;
    const batch = this.db.batch();
    const myRef = this.db.collection('users').doc(this.currentUser.uid);
    batch.update(myRef, { friends: firebase.firestore.FieldValue.arrayRemove(friendUid) });
    const theirRef = this.db.collection('users').doc(friendUid);
    batch.update(theirRef, { friends: firebase.firestore.FieldValue.arrayRemove(this.currentUser.uid) });
    await batch.commit();
  },

  async loadFriendsData() {
    if (!this.enabled || !this.currentUser) return [];
    const myProfile = await this.getUserProfile(this.currentUser.uid);
    if (!myProfile || !myProfile.friends || myProfile.friends.length === 0) return [];

    const friends = [];
    // Firestore 'in' query supports up to 30
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

  // --- Sync helpers ---
  async syncToCloud(state) {
    if (!this.enabled || !this.currentUser || !state) return;
    const settings = {
      raceName: state.raceName || '',
      raceDate: state.raceDate || '',
      raceType: state.raceType || 'full',
      targetTime: state.targetTime || '',
      planWeeks: state.plan ? state.plan.length : 0
    };
    await this.saveUserProfile(settings, state.completed || {});
  },

  calcStreak(completed) {
    if (!completed) return 0;
    let streak = 0;
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    // Check today first; if not done, start from yesterday
    const todayStr = toISO(d);
    if (!completed[todayStr]) d.setDate(d.getDate() - 1);
    while (true) {
      const key = toISO(d);
      if (completed[key]) { streak++; d.setDate(d.getDate() - 1); }
      else break;
    }
    return streak;
  },

  getTodayWorkoutForUser(profile) {
    if (!profile || !profile.settings) return null;
    const s = profile.settings;
    if (!s.raceDate || !s.targetTime || !s.raceType) return null;
    // Reconstruct minimal info for display
    const todayStr = toISO(new Date());
    if (profile.completed && profile.completed[todayStr]) {
      return { done: true, label: '完了済み' };
    }
    return { done: false, label: '予定あり' };
  }
};
