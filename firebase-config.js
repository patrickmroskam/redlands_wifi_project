// Firebase configuration
const firebaseConfig = {
    projectId: "redlands-wifi",
    authDomain: "redlands-wifi.firebaseapp.com"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize Firestore
const db = firebase.firestore();

// Export the database instance
window.db = db; 