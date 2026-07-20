/**
 * Firebase initialization.
 *
 * 1) Create a project at https://console.firebase.google.com
 * 2) Enable Authentication -> Sign-in method -> Email/Password
 * 3) Create a Firestore database (production mode) and a Storage bucket
 * 4) Paste your web app config below (Project settings -> General -> Your apps)
 * 5) Deploy firestore.rules and storage.rules from the project root:
 *      firebase deploy --only firestore:rules,storage:rules
 */
const firebaseConfig = {
  apiKey: "AIzaSyCBUYQx_RHvbEAOVAMmK5WpXMaq6XFAuNg",
  authDomain: "devport-forum.firebaseapp.com",
  projectId: "devport-forum",
  storageBucket: "devport-forum.firebasestorage.app",
  messagingSenderId: "54922531989",
  appId: "1:54922531989:web:d3ea6ecaca88ff8d16779c",
  measurementId: "G-8PW7ZRLLKX"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// Keep users signed in across tabs/reloads
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);

// Firestore local cache — makes repeat navigation between pages instant
db.enablePersistence({ synchronizeTabs: true }).catch((err) => {
  if (err.code === 'failed-precondition') {
    console.warn('Persistence disabled: multiple tabs open.');
  } else if (err.code === 'unimplemented') {
    console.warn('Persistence not supported in this browser.');
  }
});

const FieldValue = firebase.firestore.FieldValue;
const Timestamp = firebase.firestore.Timestamp;
