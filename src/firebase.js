import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  projectId: "gbrsa-skill-library",
  appId: "1:606519257730:web:c50722643fd766f2b0629b",
  storageBucket: "gbrsa-skill-library.firebasestorage.app",
  apiKey: "AIzaSyARaQuzXB-wlaQ7h1BR0ItgB1pURF3GBgU",
  authDomain: "gbrsa-skill-library.firebaseapp.com",
  messagingSenderId: "606519257730",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
