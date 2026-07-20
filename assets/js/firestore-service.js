/* ==========================================================================
   Data access layer. Every page talks to Firestore through these functions
   instead of writing raw queries inline — keeps rules & shapes consistent.
   ========================================================================== */

const DevPortData = {

  /* ---------------- Categories ---------------- */
  async getCategories() {
    const snap = await db.collection('categories').orderBy('order', 'asc').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  async seedCategoriesIfEmpty() {
    const snap = await db.collection('categories').limit(1).get();
    if (!snap.empty) return;
    const defaults = [
      ['Frontend', 'frontend', '🎨'], ['Backend', 'backend', '🛠️'], ['JavaScript', 'javascript', '⚡'],
      ['Python', 'python', '🐍'], ['Java', 'java', '☕'], ['C++', 'cpp', '🧩'], ['PHP', 'php', '🐘'],
      ['Laravel', 'laravel', '🅻'], ['React', 'react', '⚛️'], ['Vue', 'vue', '💚'], ['Angular', 'angular', '🅰️'],
      ['Node.js', 'nodejs', '🟢'], ['AI', 'ai', '🤖'], ['Machine Learning', 'ml', '📈'],
      ['Cyber Security', 'security', '🛡️'], ['Linux', 'linux', '🐧'], ['Windows', 'windows', '🪟'],
      ['Android', 'android', '📱'], ['iOS', 'ios', '📲'], ['GameDev', 'gamedev', '🎮'],
      ['UI/UX', 'uiux', '🖌️'], ['Дизайн', 'design', '🎭'], ['Базы данных', 'databases', '🗄️'],
      ['Хостинг', 'hosting', '🌐'], ['Cloud', 'cloud', '☁️'], ['DevOps', 'devops', '🔧'],
      ['SEO', 'seo', '🔍'], ['Фриланс', 'freelance', '💼'], ['Работа', 'jobs', '🏢'],
      ['Общие вопросы', 'general', '💬']
    ];
    const batch = db.batch();
    defaults.forEach(([name, slug, icon], i) => {
      const ref = db.collection('categories').doc(slug);
      batch.set(ref, { name, slug, icon, description: '', order: i, topicsCount: 0, postsCount: 0 });
    });
    await batch.commit();
  },

  /* ---------------- Topics ---------------- */
  async createTopic({ title, categoryId, categoryName, tags, firstPostContent, authorId, authorName, authorPhoto, authorRole }) {
    const topicRef = db.collection('topics').doc();
    const now = FieldValue.serverTimestamp();
    try {
      await topicRef.set({
        title,
        slug: slugify(title),
        keywords: extractKeywords(title),
        categoryId, categoryName,
        tags: tags || [],
        authorId, authorName, authorPhoto: authorPhoto || '',
        createdAt: now, updatedAt: now,
        viewsCount: 0, repliesCount: 0, likesCount: 0,
        isPinned: false, isClosed: false,
        lastReplyAt: now, lastReplyBy: authorName
      });
    } catch (err) {
      err.stage = 'topic-doc';
      throw err;
    }
    try {
      await topicRef.collection('posts').add({
        content: firstPostContent,
        authorId, authorName, authorPhoto: authorPhoto || '', authorRole: authorRole || 'user',
        createdAt: now, updatedAt: now, isFirstPost: true,
        reactions: { like: [], love: [], fire: [], idea: [], rocket: [], laugh: [], dislike: [] }
      });
    } catch (err) {
      err.stage = 'first-post';
      throw err;
    }
    // Secondary counters — don't let a failure here undo/fail the topic that was already created.
    db.collection('categories').doc(categoryId).update({
      topicsCount: FieldValue.increment(1), postsCount: FieldValue.increment(1)
    }).catch(err => console.warn('category stats update failed:', err));
    db.collection('users').doc(authorId).update({ topicsCount: FieldValue.increment(1) })
      .catch(err => console.warn('user stats update failed:', err));
    return topicRef.id;
  },

  async getTopic(topicId) {
    const doc = await db.collection('topics').doc(topicId).get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
  },

  async incrementViews(topicId) {
    return db.collection('topics').doc(topicId).update({ viewsCount: FieldValue.increment(1) });
  },

  async listTopics({ categoryId = null, orderField = 'lastReplyAt', limit = 20, startAfterDoc = null } = {}) {
    let ref = db.collection('topics');
    if (categoryId) ref = ref.where('categoryId', '==', categoryId);
    ref = ref.orderBy('isPinned', 'desc').orderBy(orderField, 'desc').limit(limit);
    if (startAfterDoc) ref = ref.startAfter(startAfterDoc);
    const snap = await ref.get();
    return { docs: snap.docs, items: snap.docs.map(d => ({ id: d.id, ...d.data() })) };
  },

  async setTopicFlag(topicId, flag, value) {
    return db.collection('topics').doc(topicId).update({ [flag]: value });
  },

  async deleteTopic(topicId) {
    return db.collection('topics').doc(topicId).delete();
  },

  /* ---------------- Posts (replies) ---------------- */
  async addPost(topicId, { content, authorId, authorName, authorPhoto, authorRole, quotedPostId = null }) {
    const now = FieldValue.serverTimestamp();
    const postRef = await db.collection('topics').doc(topicId).collection('posts').add({
      content, authorId, authorName, authorPhoto: authorPhoto || '', authorRole: authorRole || 'user', quotedPostId,
      createdAt: now, updatedAt: now, isFirstPost: false,
      reactions: { like: [], love: [], fire: [], idea: [], rocket: [], laugh: [], dislike: [] }
    });
    // Secondary counters — don't let a failure here undo/fail the reply that was already posted.
    db.collection('topics').doc(topicId).update({
      repliesCount: FieldValue.increment(1), lastReplyAt: now, lastReplyBy: authorName, updatedAt: now
    }).catch(err => console.warn('topic stats update failed:', err));
    db.collection('users').doc(authorId).update({ postsCount: FieldValue.increment(1) })
      .catch(err => console.warn('user stats update failed:', err));
    return postRef.id;
  },

  listenToPosts(topicId, callback) {
    return db.collection('topics').doc(topicId).collection('posts')
      .orderBy('createdAt', 'asc')
      .onSnapshot((snap) => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  },

  async editPost(topicId, postId, content) {
    return db.collection('topics').doc(topicId).collection('posts').doc(postId)
      .update({ content, updatedAt: FieldValue.serverTimestamp(), isEdited: true });
  },

  async deletePost(topicId, postId) {
    await db.collection('topics').doc(topicId).collection('posts').doc(postId).delete();
    return db.collection('topics').doc(topicId).update({ repliesCount: FieldValue.increment(-1) });
  },

  async toggleReaction(topicId, postId, reactionType, uid) {
    const ref = db.collection('topics').doc(topicId).collection('posts').doc(postId);
    return db.runTransaction(async (tx) => {
      const doc = await tx.get(ref);
      const reactions = doc.data().reactions || {};
      const arr = reactions[reactionType] || [];
      const has = arr.includes(uid);
      tx.update(ref, {
        [`reactions.${reactionType}`]: has ? FieldValue.arrayRemove(uid) : FieldValue.arrayUnion(uid)
      });
      return !has;
    });
  },

  /* ---------------- Bookmarks ---------------- */
  async toggleBookmark(userId, topicId, topicTitle) {
    const id = `${userId}_${topicId}`;
    const ref = db.collection('bookmarks').doc(id);
    const doc = await ref.get();
    if (doc.exists) {
      await ref.delete();
      return false;
    }
    await ref.set({ userId, topicId, topicTitle, createdAt: FieldValue.serverTimestamp() });
    return true;
  },

  async isBookmarked(userId, topicId) {
    const doc = await db.collection('bookmarks').doc(`${userId}_${topicId}`).get();
    return doc.exists;
  },

  async listBookmarks(userId) {
    const snap = await db.collection('bookmarks').where('userId', '==', userId).orderBy('createdAt', 'desc').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  /* ---------------- Search ---------------- */
  async searchTopics(queryText) {
    const kw = queryText.toLowerCase().trim();
    if (!kw) return [];
    // Match on any token in the title, then rank client-side by how many tokens matched + recency.
    const tokens = Array.from(new Set(kw.split(/\s+/).filter(Boolean))).slice(0, 10);
    if (!tokens.length) return [];
    const snap = await db.collection('topics')
      .where('keywords', 'array-contains-any', tokens)
      .limit(40).get();
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    items.forEach(t => {
      t._matchScore = (t.keywords || []).filter(k => tokens.includes(k)).length;
    });
    items.sort((a, b) => {
      if (b._matchScore !== a._matchScore) return b._matchScore - a._matchScore;
      const at = a.createdAt?.seconds || 0, bt = b.createdAt?.seconds || 0;
      return bt - at;
    });
    return items;
  },

  async searchUsers(queryText) {
    const kw = queryText.toLowerCase().trim();
    if (!kw) return [];
    // Uses displayNameLower (lowercased mirror of displayName) so search is case-insensitive.
    const snap = await db.collection('users')
      .orderBy('displayNameLower')
      .startAt(kw).endAt(kw + '\uf8ff')
      .limit(20).get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  /* ---------------- Members ---------------- */
  async listMembers({ orderField = 'reputation', direction = 'desc', limit = 24, startAfterDoc = null } = {}) {
    let ref = db.collection('users').orderBy(orderField, direction);
    if (startAfterDoc) ref = ref.startAfter(startAfterDoc);
    ref = ref.limit(limit);
    const snap = await ref.get();
    return { docs: snap.docs, items: snap.docs.map(d => ({ id: d.id, ...d.data() })) };
  },

  /* ---------------- Notifications ---------------- */
  async createNotification({ recipientId, type, actorId, actorName, topicId, topicTitle, message }) {
    if (recipientId === actorId) return; // don't notify yourself
    return db.collection('notifications').add({
      recipientId, type, actorId, actorName, topicId, topicTitle, message,
      read: false, createdAt: FieldValue.serverTimestamp()
    });
  },

  async markAllNotificationsRead(userId) {
    const snap = await db.collection('notifications').where('recipientId', '==', userId).where('read', '==', false).get();
    const batch = db.batch();
    snap.docs.forEach(d => batch.update(d.ref, { read: true }));
    return batch.commit();
  },

  listenNotifications(userId, callback) {
    return db.collection('notifications')
      .where('recipientId', '==', userId)
      .orderBy('createdAt', 'desc')
      .limit(50)
      .onSnapshot((snap) => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  },

  async markNotificationRead(notifId) {
    return db.collection('notifications').doc(notifId).update({ read: true });
  },

  async deleteNotification(notifId) {
    return db.collection('notifications').doc(notifId).delete();
  },

  /* ---------------- Conversations / Messages ---------------- */
  async getOrCreateConversation(uidA, uidB) {
    const convId = [uidA, uidB].sort().join('_');
    const ref = db.collection('conversations').doc(convId);
    const doc = await ref.get();
    if (!doc.exists) {
      await ref.set({
        participants: [uidA, uidB],
        lastMessage: '',
        lastMessageAt: FieldValue.serverTimestamp(),
        lastSenderId: '',
        createdAt: FieldValue.serverTimestamp()
      });
    }
    return convId;
  },

  listenConversations(userId, callback) {
    return db.collection('conversations')
      .where('participants', 'array-contains', userId)
      .orderBy('lastMessageAt', 'desc')
      .onSnapshot((snap) => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  },

  listenMessages(convId, callback) {
    return db.collection('conversations').doc(convId).collection('messages')
      .orderBy('createdAt', 'asc')
      .onSnapshot((snap) => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  },

  async sendMessage(convId, { senderId, text }) {
    const now = FieldValue.serverTimestamp();
    await db.collection('conversations').doc(convId).collection('messages').add({
      senderId, text, createdAt: now
    });
    return db.collection('conversations').doc(convId).update({
      lastMessage: text.slice(0, 120), lastMessageAt: now, lastSenderId: senderId
    });
  },

  async getUserPublic(uid) {
    const doc = await db.collection('users').doc(uid).get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
  },

  /* ---------------- Admin ---------------- */
  async adminListUsers({ limit = 500 } = {}) {
    const snap = await db.collection('users').orderBy('createdAt', 'desc').limit(limit).get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  async adminSetUserRole(uid, role) {
    return db.collection('users').doc(uid).update({ role });
  },

  async adminSetReputation(uid, reputation) {
    return db.collection('users').doc(uid).update({ reputation });
  },

  async adminAdjustReputation(uid, delta) {
    return db.collection('users').doc(uid).update({ reputation: FieldValue.increment(delta) });
  },

  async adminSetBanned(uid, banned) {
    return db.collection('users').doc(uid).update({ banned });
  },

  async adminListTopics({ limit = 500 } = {}) {
    const snap = await db.collection('topics').orderBy('createdAt', 'desc').limit(limit).get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  /* ---------------- Stats ---------------- */
  async getForumStats() {
    const [topics, categories, users] = await Promise.all([
      db.collection('topics').get(),
      db.collection('categories').get(),
      db.collection('users').get()
    ]);
    let posts = 0;
    categories.docs.forEach(d => posts += (d.data().postsCount || 0));
    return { topicsCount: topics.size, usersCount: users.size, postsCount: posts };
  },

  async getTopMembers(limit = 5) {
    const snap = await db.collection('users').orderBy('reputation', 'desc').limit(limit).get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  async getNewestMembers(limit = 5) {
    const snap = await db.collection('users').orderBy('createdAt', 'desc').limit(limit).get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }
};
