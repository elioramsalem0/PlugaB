// תצורת Firebase
const firebaseConfig = {
    apiKey: "AIzaSyAAM4wM8f-HjAiPCRrobtB6M7i4M3pypVw",
    authDomain: "gd-fd2fa.firebaseapp.com",
    projectId: "gd-fd2fa",
    storageBucket: "gd-fd2fa.firebasestorage.app",
    messagingSenderId: "313045632664",
    appId: "1:313045632664:web:8b7aec36289513be1af2ed",
    measurementId: "G-JM85H6638L"
};
  
// אתחול Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    doc, 
    setDoc, 
    getDoc, 
    getDocs, 
    updateDoc, 
    deleteDoc, 
    query, 
    where, 
    onSnapshot, 
    enableIndexedDbPersistence, 
    addDoc, 
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { 
    getAuth, 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged, 
    signInAnonymously 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
  
// אתחול Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// ניסיון להפעיל מצב עבודה לא מקוון (offline)
try {
    enableIndexedDbPersistence(db)
        .catch((err) => {
            if (err.code == 'failed-precondition') {
                console.error("Multiple tabs open, persistence can only be enabled in one tab at a time.");
            } else if (err.code == 'unimplemented') {
                console.error("The current browser does not support all of the features required to enable persistence");
            }
        });
    console.log("מצב עבודה לא מקוון הופעל בהצלחה");
} catch (error) {
    console.error("שגיאה בהפעלת מצב עבודה לא מקוון:", error);
}

// ייצוא המודולים לשימוש
export { 
    app, 
    db, 
    auth, 
    collection, 
    doc, 
    setDoc, 
    getDoc, 
    getDocs, 
    updateDoc, 
    deleteDoc, 
    query, 
    where, 
    onSnapshot,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    enableIndexedDbPersistence,
    addDoc,
    serverTimestamp,
    signInAnonymously
};