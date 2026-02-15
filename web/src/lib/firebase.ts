import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, type Auth } from "firebase/auth";

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let googleProvider: GoogleAuthProvider | null = null;

const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN;
const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;

if (apiKey && authDomain && projectId) {
    try {
        app = initializeApp({ apiKey, authDomain, projectId });
        auth = getAuth(app);
        googleProvider = new GoogleAuthProvider();
    } catch (err) {
        console.warn("Firebase initialization failed:", err);
    }
} else {
    console.warn(
        "⚠️ Firebase not configured. Set VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID in web/.env"
    );
}

export { auth, googleProvider };
