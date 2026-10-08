// ============================================================
// Abhyas Quiz Portal — Firebase Configuration
// ============================================================
//
// SETUP INSTRUCTIONS:
// 1. Go to https://console.firebase.google.com
// 2. Create a new project (or use existing)
// 3. Go to Project Settings → General → Your Apps → Add Web App
// 4. Copy the firebaseConfig object and paste below
// 5. Enable Authentication → Sign-in method → Email/Password
// 6. Enable Cloud Firestore → Create database → Start in test mode
// 7. Update Firestore rules (see README.md)
//
// ============================================================

const firebaseConfig = {
  apiKey: "AIzaSyCCIhw8DY6cHe4US90UUArX0WlfIr9cNn0",
  authDomain: "abhyas-f1aaf.firebaseapp.com",
  projectId: "abhyas-f1aaf",
  storageBucket: "abhyas-f1aaf.firebasestorage.app",
  messagingSenderId: "693502010062",
  appId: "1:693502010062:web:0f1fc367f4d126ac87a69f",
  measurementId: "G-66RFYJNBVN"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Global references
const db = firebase.firestore();
const auth = firebase.auth();
