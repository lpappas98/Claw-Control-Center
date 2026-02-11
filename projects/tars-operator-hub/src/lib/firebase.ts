import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: "AIzaSyA92dw6OSCw_kazB5KLHRJJt4i45QhjqHE",
  authDomain: "claw-control-center.firebaseapp.com",
  projectId: "claw-control-center",
  storageBucket: "claw-control-center.firebasestorage.app",
  messagingSenderId: "1033311674576",
  appId: "1:1033311674576:web:0de7d470e320d95fc6bed5"
}

// Initialize Firebase
export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)
export const googleProvider = new GoogleAuthProvider()

// Add scopes for Google Auth
googleProvider.addScope('profile')
googleProvider.addScope('email')
