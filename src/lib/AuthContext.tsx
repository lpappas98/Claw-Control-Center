import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { 
  type User, 
  onAuthStateChanged, 
  signInWithPopup, 
  signOut as firebaseSignOut 
} from 'firebase/auth'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db, googleProvider } from './firebase'

type UserProfile = {
  uid: string
  email: string | null
  displayName: string | null
  photoURL: string | null
  createdAt: Date
  lastLoginAt: Date
  connectedInstances: Array<{
    id: string
    name: string
    gatewayUrl: string
    connectedAt: Date
    lastSeenAt?: Date
  }>
}

type AuthContextType = {
  user: User | null
  profile: UserProfile | null
  loading: boolean
  error: string | null
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Listen to auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser)
      
      if (firebaseUser) {
        // Load or create user profile
        try {
          const profileRef = doc(db, 'users', firebaseUser.uid)
          const profileSnap = await getDoc(profileRef)
          
          if (profileSnap.exists()) {
            // Update last login
            await setDoc(profileRef, { lastLoginAt: serverTimestamp() }, { merge: true })
            setProfile(profileSnap.data() as UserProfile)
          } else {
            // Create new profile
            const newProfile: Partial<UserProfile> = {
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              displayName: firebaseUser.displayName,
              photoURL: firebaseUser.photoURL,
              connectedInstances: [],
            }
            await setDoc(profileRef, {
              ...newProfile,
              createdAt: serverTimestamp(),
              lastLoginAt: serverTimestamp(),
            })
            setProfile(newProfile as UserProfile)
          }
        } catch (err) {
          console.error('Error loading profile:', err)
          setError('Failed to load user profile')
        }
      } else {
        setProfile(null)
      }
      
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  const signInWithGoogle = async () => {
    try {
      setError(null)
      await signInWithPopup(auth, googleProvider)
    } catch (err: any) {
      console.error('Sign in error:', err)
      setError(err.message || 'Failed to sign in')
    }
  }

  const signOut = async () => {
    try {
      await firebaseSignOut(auth)
    } catch (err: any) {
      console.error('Sign out error:', err)
      setError(err.message || 'Failed to sign out')
    }
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, error, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}
