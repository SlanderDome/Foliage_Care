// firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

// 1. IMPORT FIRESTORE FUNCTIONS
import { 
  getFirestore, 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  limit, 
  getDocs,
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDISL2WDwxMB-M6Rz8IsrpEAvhbAT2fPqA",
  authDomain: "foliage-care.firebaseapp.com",
  projectId: "foliage-care",
  storageBucket: "foliage-care.firebasestorage.app",
  messagingSenderId: "233678057855",
  appId: "1:233678057855:web:36cb051f256fff8e9a6a4a"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app); // Initialize Database

// 🔥 GLOBAL EXPORTS (Added DB tools)
window.firebaseAuth = auth;
window.db = db; // Export the database itself

// Auth functions
window.GoogleAuthProvider = GoogleAuthProvider;
window.signInWithPopup = signInWithPopup;
window.signInWithEmailAndPassword = signInWithEmailAndPassword;
window.createUserWithEmailAndPassword = createUserWithEmailAndPassword;
window.signOut = signOut;
window.onAuthStateChanged = onAuthStateChanged;
window.updateProfile = updateProfile;

// Firestore functions (Exporting these so we can use them in profile.js)
window.collection = collection;
window.addDoc = addDoc;
window.query = query;
window.where = where;
window.orderBy = orderBy;
window.limit = limit;
window.getDocs = getDocs;
window.serverTimestamp = serverTimestamp;

// 🔥 READY FLAG
window.firebaseReady = true;

console.log("Firebase & Firestore loaded");