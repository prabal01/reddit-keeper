import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, type Auth } from "firebase/auth";

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let googleProvider: GoogleAuthProvider | null = null;

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Diagnostic logging for production debugging
console.log("[Firebase Diagnostic]", {
    apiKey_present: !!firebaseConfig.apiKey,
    authDomain_present: !!firebaseConfig.authDomain,
    projectId_present: !!firebaseConfig.projectId,
    env_keys: Object.keys(import.meta.env).filter(k => k.startsWith('VITE_FIREBASE')),
    build_mode: import.meta.env.MODE
});

if (firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId) {
    try {
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        googleProvider = new GoogleAuthProvider();
        console.log("[Firebase] Initialized successfully");
    } catch (err) {
        console.error("[Firebase] Initialization failed:", err);
    }
} else {
    console.warn(
        "⚠️ Firebase not configured. Please check your web/.env or GitHub Secrets for VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, and VITE_FIREBASE_PROJECT_ID."
    );
}

export { auth, googleProvider };
