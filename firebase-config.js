// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyCcslBmrxk2TJWKueWmy_tCXICkl5z1I2c",
    projectId: "redlands-wifi",
    authDomain: "redlands-wifi.firebaseapp.com",
    databaseURL: "https://redlands-wifi.firebaseio.com",
    storageBucket: "redlands-wifi.appspot.com",
    messagingSenderId: "654772244549",
    appId: "1:654772244549:web:6a54aa3045a4aa8a8a3e7b"
};

// Function to initialize Firebase
function initializeFirebase() {
    return new Promise((resolve, reject) => {
        try {
            if (!firebase.apps.length) {
                firebase.initializeApp(firebaseConfig);
            }

            const db = firebase.firestore();
            db.settings({
                ignoreUndefinedProperties: true,
                cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED
            });

            // Enable offline persistence
            db.enablePersistence({
                synchronizeTabs: true
            }).catch((err) => {
                if (err.code == 'failed-precondition') {
                    console.warn('Multiple tabs open, persistence can only be enabled in one tab at a time.');
                } else if (err.code == 'unimplemented') {
                    console.warn('The current browser does not support persistence.');
                }
            });

            const auth = firebase.auth();

            // Export instances
            window.db = db;
            window.auth = auth;
            window.firebaseInitialized = true;

            resolve({ db, auth });
        } catch (error) {
            console.error('Error initializing Firebase:', error);
            reject(error);
        }
    });
}

// Initialize Firebase when the script loads
window.initFirebase = initializeFirebase; 