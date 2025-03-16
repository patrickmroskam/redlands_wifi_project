// Firebase configuration
const firebaseConfig = {
    projectId: "redlands-wifi",
    authDomain: "redlands-wifi.firebaseapp.com",
    databaseURL: "https://redlands-wifi.firebaseio.com",
    storageBucket: "redlands-wifi.appspot.com"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize Firestore
const db = firebase.firestore();

// Initialize Auth
const auth = firebase.auth();

// Export instances
window.db = db;
window.auth = auth; 