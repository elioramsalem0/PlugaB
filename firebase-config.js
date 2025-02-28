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
  import { initializeApp } from "firebase/app";
  import { getFirestore, collection, doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, query, where, onSnapshot, enableIndexedDbPersistence } from "firebase/firestore";
  import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";
  
  // אתחול Firebase
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);
  const auth = getAuth(app);
  
  // הפעלת מצב עבודה לא מקוון (offline)
  enableIndexedDbPersistence(db)
    .catch((err) => {
      if (err.code == 'failed-precondition') {
        console.error("Multiple tabs open, persistence can only be enabled in one tab at a time.");
      } else if (err.code == 'unimplemented') {
        console.error("The current browser does not support all of the features required to enable persistence");
      }
    });
  
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
    onAuthStateChanged
  };