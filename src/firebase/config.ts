import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";

// IMPORTANT: Replace with your actual Firebase config object!
const firebaseConfig = {
    apiKey: "AIzaSyAGGJm4Ns486bmI7EX4F8ZQs4Qj1RFlkLc",
    authDomain: "uncursored-e2f36.firebaseapp.com",
    projectId: "uncursored-e2f36",
    storageBucket: "uncursored-e2f36.firebasestorage.app",
    messagingSenderId: "545076060902",
    appId: "1:545076060902:web:d0f89d38d3b5198b509127",
    measurementId: "G-5H454WC2X8"
};

// Initialize Firebase App
const app: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Initialize Auth
const auth: Auth = getAuth(app);

// Lazy initialize Firestore
let dbInstance: Firestore | null = null;

const getDbInstance = (): Firestore => {
    if (!dbInstance) {
        dbInstance = getFirestore(app);
    }
    return dbInstance;
};

// Export app, auth, and the function to get db
export { app, auth, getDbInstance };

// For components that still import { db }, provide a getter (use with caution)
// This maintains compatibility but it's better to use getDbInstance()
export const db = getDbInstance(); 