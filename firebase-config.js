// Firebase configuration will be loaded from a secure source
const firebaseConfig = {
    projectId: "redlands-wifi",
    authDomain: "redlands-wifi.firebaseapp.com",
    databaseURL: "https://redlands-wifi.firebaseio.com",
    storageBucket: "redlands-wifi.appspot.com"
};

// Function to initialize Firebase with config
async function initializeFirebase() {
    try {
        // In production, these values should be securely loaded
        // For development, they can be stored in environment variables
        const sensitiveConfig = {
            apiKey: process.env.FIREBASE_API_KEY,
            messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
            appId: process.env.FIREBASE_APP_ID
        };

        // Merge configurations
        const fullConfig = { ...firebaseConfig, ...sensitiveConfig };
        
        // Initialize Firebase
        firebase.initializeApp(fullConfig);

        // Initialize Firestore with settings
        const db = firebase.firestore();
        db.settings({
            ignoreUndefinedProperties: true,
            cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED,
            merge: true,
            experimentalForceLongPolling: true,
            experimentalAutoDetectLongPolling: true
        });

        // Enable offline persistence
        await db.enablePersistence({
            synchronizeTabs: true
        }).catch((err) => {
            if (err.code == 'failed-precondition') {
                console.warn('Multiple tabs open, persistence can only be enabled in one tab at a time.');
            } else if (err.code == 'unimplemented') {
                console.warn('The current browser does not support persistence.');
            }
        });

        // Initialize Auth
        const auth = firebase.auth();

        // Export instances
        window.db = db;
        window.auth = auth;

        return { db, auth };
    } catch (error) {
        console.error('Error initializing Firebase:', error);
        throw error;
    }
} 