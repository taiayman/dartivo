'use client'; // Mark this component as a Client Component

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Github } from 'lucide-react'; 
import { 
  signInWithEmailAndPassword, 
  signInWithPopup, 
  GithubAuthProvider, 
  GoogleAuthProvider 
} from "firebase/auth"; 
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from '@/firebase/config'; 
import { useRouter } from 'next/navigation'; 
import { User } from 'firebase/auth';

export default function SignInPage() { 
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null); // State for error messages
  const [loading, setLoading] = useState(false); // State for loading indicator
  const [providerLoading, setProviderLoading] = useState<'github' | 'google' | null>(null);
  const router = useRouter(); // Initialize router

  // --- Email/Password Sign In --- 
  const handleSignInSubmit = async (event: React.FormEvent) => { 
    event.preventDefault();
    setError(null); // Clear previous errors
    setLoading(true); // Set loading state

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      console.log('Auth Sign in successful:', user);
      
      // Optional: Update last login time in Firestore
      try {
        const userDocRef = doc(db, "users", user.uid);
        await setDoc(userDocRef, { lastLogin: serverTimestamp() }, { merge: true });
        console.log('Updated last login for user:', user.uid);
      } catch (firestoreError) {
        console.error("Error updating last login:", firestoreError);
        // Non-critical error, don't block sign-in flow
      }

      // Redirect to home page or dashboard
      router.push('/'); 
    } catch (err: unknown) {
      console.error("Sign in error:", err);
      let message = "Failed to sign in. Please check your email and password.";
      if (typeof err === 'object' && err !== null && 'code' in err) {
        const code = (err as { code: string }).code;
        if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
          message = "Invalid email or password.";
        } else if (code === 'auth/invalid-email') {
          message = "Please enter a valid email address.";
        }
      }      
      setError(message);
    } finally {
      setLoading(false); // Reset loading state
    }
  };

  // --- Generic Provider Sign-In Handler --- 
  const handleProviderSignIn = async (provider: GithubAuthProvider | GoogleAuthProvider, providerName: 'github' | 'google') => {
    setError(null);
    setProviderLoading(providerName);
    try {
      // For GitHub, use popup (already was)
      // For Google, now also use signInWithPopup
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      console.log(`${providerName} Sign-in successful:`, user);
      await processUserSignIn(user, providerName); 
      router.push('/'); 
    } catch (error: unknown) {
      console.error(`${providerName} sign in error:`, error);
      let message = `Failed to sign in with ${providerName}. Please try again.`;
      if (typeof error === 'object' && error !== null && 'code' in error) {
        const code = (error as { code: string }).code;
        if (code === 'auth/account-exists-with-different-credential') {
          message = 'An account already exists with this email using a different sign-in method. Try signing in with that method.';
        } else if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
          message = 'Sign-in process was cancelled.'; 
        } else if (code === 'auth/network-request-failed'){
          message = 'Network error. Please check your connection and try again.';
        }
      }      
      setError(message);
    } finally {
      setProviderLoading(null); // Reset loading for both success/failure of popup
    }
  };

  // --- Process User Sign-In (for both popup and redirect result) ---
  const processUserSignIn = async (user: User, providerName: string) => {
    console.log(`${providerName} Sign-in successful:`, user);

    const userDocRef = doc(db, "users", user.uid);
    const docSnap = await getDoc(userDocRef);

    if (!docSnap.exists()) {
      console.log("User document not found, creating one...");
      await setDoc(userDocRef, {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || user.email?.split('@')[0] || 'User',
        username: user.uid, 
        photoURL: user.photoURL,
        createdAt: serverTimestamp(),
        lastLogin: serverTimestamp()
      });
    } else {
      await setDoc(userDocRef, { lastLogin: serverTimestamp() }, { merge: true });
    }
    console.log(`Firestore document checked/updated for ${providerName} user:`, user.uid);
  };

  // --- Specific Handlers for Buttons --- 
  const handleGitHubSignIn = () => {
    const githubProvider = new GithubAuthProvider();
    handleProviderSignIn(githubProvider, 'github');
  };

  const handleGoogleSignIn = () => {
    const googleProvider = new GoogleAuthProvider();
    handleProviderSignIn(googleProvider, 'google');
  };

  return (
    <div className="min-h-screen flex flex-col bg-custom-black text-white font-poppins px-4 py-12 sm:px-6 lg:px-8 cursor-dartivo">
      <div className="max-w-md mx-auto w-full">
        {/* Logo and Title */}
        <div className="text-center mb-8 sm:mb-12">
          <Link href="/" className="inline-block mb-4">
            <Image 
              src="/dartivo.png"
              alt="Dartivo Logo"
              width={48} 
              height={48} 
              className="mx-auto" 
              priority 
            />
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-t from-gray-400 to-white bg-clip-text text-transparent">
            Dartivo
          </h1>
          <p className="mt-2 text-sm sm:text-base text-gray-400">Sign in to your account</p>
        </div>

        {/* Wrapper to center the form content vertically in remaining space */}
        <div className="flex-grow flex flex-col items-center justify-center">
          {/* Form Container - Centered Horizontally by items-center, Vertically by justify-center */}
          <div className="w-full max-w-md"> 
            {/* Updated heading and subheading */}
            <h1 className="text-3xl font-bold text-center mb-2">Sign in to your account</h1>
            <p className="text-center text-base text-gray-400 mb-6">
              Don&apos;t have an account?{' '}
              <Link href="/signup" className="font-medium text-white hover:text-gray-300 transition-colors">
                Sign up
              </Link>
            </p>

            {/* Display General Error */}
            {error && (
              <div className="mb-4 p-3 bg-red-800 bg-opacity-30 border border-red-500 rounded-md text-center">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            {/* Social Sign In Buttons - Updated Text */}
            <div className="space-y-4 mb-6">
              <button 
                onClick={handleGitHubSignIn}
                disabled={!!providerLoading} // Disable if any provider is loading
                className="w-full flex items-center justify-center px-4 py-2.5 border border-gray-600 rounded-md shadow-sm text-base font-medium text-gray-300 bg-custom-dark hover:bg-opacity-80 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
              >
                <Github size={22} className="mr-2" />
                {providerLoading === 'github' ? 'Signing in...' : 'Sign in with GitHub'}
              </button>
              <button 
                onClick={handleGoogleSignIn}
                disabled={!!providerLoading}
                className="w-full flex items-center justify-center px-4 py-2.5 border border-gray-600 rounded-md shadow-sm text-base font-medium text-gray-300 bg-custom-dark hover:bg-opacity-80 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
              >
                <svg className="mr-2" width="22" height="22" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                {providerLoading === 'google' ? 'Signing in...' : 'Sign in with Google'}
              </button>
            </div>

            {/* Divider with Gradient Lines - Re-added */}
            <div className="relative flex items-center my-6"> 
              <div className="flex-grow h-px bg-gradient-to-r from-transparent via-gray-600 to-gray-600"></div> 
              <span className="flex-shrink-0 px-4 text-sm text-gray-400 uppercase">OR</span> 
              <div className="flex-grow h-px bg-gradient-to-l from-transparent via-gray-600 to-gray-600"></div> 
            </div>

            {/* Email/Password Form */}
            <form onSubmit={handleSignInSubmit} className="space-y-5">
              <div>
                <label htmlFor="email" className="sr-only">Email address</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="appearance-none rounded-md relative block w-full px-3 py-2.5 border border-gray-600 bg-custom-darker placeholder-gray-500 text-white focus:outline-none focus:ring-1 focus:ring-gray-500 focus:border-gray-500 focus:z-10 sm:text-base transition-colors"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="password" className="sr-only">Password</label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password" // Updated autocomplete
                  required
                  className="appearance-none rounded-md relative block w-full px-3 py-2.5 border border-gray-600 bg-custom-darker placeholder-gray-500 text-white focus:outline-none focus:ring-1 focus:ring-gray-500 focus:border-gray-500 focus:z-10 sm:text-base transition-colors"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              {/* Terms Checkbox REMOVED */}

              <div className="pt-2"> {/* Added padding top for spacing */} 
                <button
                  type="submit"
                  disabled={loading} // Disable button when loading
                  className="group relative w-full flex justify-center py-2.5 px-4 border border-transparent text-base font-medium rounded-md text-custom-darker bg-white hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-custom-black focus:ring-white transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {loading ? 'Signing in...' : 'Sign in'}
                </button>
              </div>
            </form>
          </div>
        </div> {/* Close the centering wrapper */}
      </div>
    </div>
  );
} 