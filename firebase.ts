
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDeLW60g4WeLwMsC_kn1WR1fZtlsuytePQ",
  authDomain: "mystockrestnewblue.firebaseapp.com",
  projectId: "mystockrestnewblue",
  storageBucket: "mystockrestnewblue.firebasestorage.app",
  messagingSenderId: "187297215146",
  appId: "1:187297215146:web:e236e9a8bacc06a3f316d3"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export const DB_BASE_PATH = 'artifacts/mystockrestnewblue';
export const COLLECTION_PREFIX = 'mozz_';

export const getFullPath = (collectionName: string) => {
  return `${DB_BASE_PATH}/${COLLECTION_PREFIX}${collectionName}`;
};
