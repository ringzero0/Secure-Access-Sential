
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth'; 

const firebaseConfig = {
  apiKey: "AIzaSyCFFpZeAnD6_77j5BWhZJGyIgfawqCU2OM",
  authDomain: "htf2-3e936.firebaseapp.com",
  projectId: "htf2-3e936",
  storageBucket: "htf2-3e936.firebasestorage.app",
  messagingSenderId: "667870347720",
  appId: "1:667870347720:web:4afa5e08db05f555a540fd",
  measurementId: "G-2R594KX4X5"
};

let app: FirebaseApp;
let db: Firestore;
let auth: Auth;

if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}

db = getFirestore(app);
auth = getAuth(app); 

export { app, db, auth };
