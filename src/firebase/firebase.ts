import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyA5BXwIxtDbUk6QXMYoF7QgiMpwpjqQ5UU",
  authDomain: "jimny-side-quests.firebaseapp.com",
  projectId: "jimny-side-quests",
  storageBucket: "jimny-side-quests.firebasestorage.app",
  messagingSenderId: "610572006907",
  appId: "1:610572006907:web:99a23c923e751e1f59875e",
};

const app =
  getApps().length === 0
    ? initializeApp(firebaseConfig)
    : getApp();

const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { app, auth, db, storage };