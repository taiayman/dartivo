'use client'; // Mark this component as a Client Component

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Github } from 'lucide-react'; // Removed Mail
import { 
  createUserWithEmailAndPassword, 
  signInWithPopup, // Import signInWithPopup
  GithubAuthProvider, // Import GitHub provider
  GoogleAuthProvider // Import Google provider
} from "firebase/auth"; // Import Firebase auth function
import { doc, setDoc, collection, query, where, getDocs } from "firebase/firestore"; // Import Firestore functions
import { auth, db } from '@/firebase/config'; // Import auth and db instances
import { useRouter } from 'next/navigation'; // Import useRouter for redirection

// --- Start: Username Generation Helpers --- 

// Basic username sanitization (allow letters, numbers, underscore; lowercase)
const sanitizeUsername = (username: string): string => {
  // Remove leading/trailing whitespace
  let sanitized = username.trim();
  // Replace disallowed characters with underscore
  sanitized = sanitized.replace(/[^a-zA-Z0-9_]/g, '_');
  // Replace multiple consecutive underscores with a single one
  sanitized = sanitized.replace(/_{2,}/g, '_');
  // Remove leading/trailing underscores
  sanitized = sanitized.replace(/^_+|_+$/g, '');
  // Limit length (e.g., 3-20 chars)
  sanitized = sanitized.substring(0, 20);
  // Ensure minimum length (less critical if appending numbers)
  if (sanitized.length < 3) {
     // If too short after sanitizing, prepend something default
     sanitized = `user_${sanitized}`.substring(0, 20);
  } 
  // Convert to lowercase
  return sanitized.toLowerCase(); 
};

// Check if a username already exists in Firestore
const isUsernameTaken = async (username: string): Promise<boolean> => {
  const usersRef = collection(db, "users");
  const q = query(usersRef, where("username", "==", username));
  try {
    const querySnapshot = await getDocs(q);
    return !querySnapshot.empty; // Return true if snapshot is not empty (username found)
  } catch (error) {
    console.error("Error checking username existence:", error);
    // Rethrow or handle error appropriately - maybe default to assuming it's taken?
    // For safety, let's assume it might be taken if check fails
    return true; 
  }
};

// Generate a unique username by appending numbers if necessary
const generateUniqueUsername = async (preferredUsername: string): Promise<string> => {
  let currentUsername = sanitizeUsername(preferredUsername);
  let attempts = 0;
  const maxAttempts = 10; // Prevent infinite loops

  while (await isUsernameTaken(currentUsername) && attempts < maxAttempts) {
    attempts++;
    // Append random numbers (e.g., 3 digits)
    const randomSuffix = Math.floor(100 + Math.random() * 900); 
    // Ensure base username + suffix doesn't exceed max length
    const baseUsername = sanitizeUsername(preferredUsername).substring(0, 20 - 4); // Leave space for _ and 3 digits
    currentUsername = `${baseUsername}_${randomSuffix}`;
  }

  if (attempts >= maxAttempts) {
    // Fallback if we couldn't find a unique name (should be rare)
    console.error(`Could not generate unique username for ${preferredUsername} after ${maxAttempts} attempts.`);
    // Return a highly random fallback or throw an error
    return `user_${Date.now()}`.substring(0, 20); 
  }

  return currentUsername;
};

// --- End: Username Generation Helpers --- 

export default function SignUpPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null); // State for error messages
  const [loading, setLoading] = useState(false); // State for loading indicator
  const [providerLoading, setProviderLoading] = useState<'github' | 'google' | null>(null);
  const router = useRouter(); // Initialize router

  const handleSubmit = async (event: React.FormEvent) => { // Make handler async
    event.preventDefault();
    if (!agreed) {
      setError("You must agree to the terms and conditions.");
      return;
    }
    setError(null); // Clear previous errors
    setLoading(true); // Set loading state

    try {
      // 1. Create user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      console.log('Auth Sign up successful:', user);

      // --- Start: Generate Unique Username --- 
      let preferredUsername = email.split('@')[0];
      // Basic check if email prefix is too short/generic
      if (!preferredUsername || preferredUsername.length < 3) {
        preferredUsername = 'user'; // Default base if email prefix is bad
      }
      const uniqueUsername = await generateUniqueUsername(preferredUsername);
      // --- End: Generate Unique Username --- 

      // 2. Create user document in Firestore
      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        email: user.email, 
        displayName: user.displayName || email.split('@')[0], 
        username: uniqueUsername, // Save the generated username
        createdAt: new Date() 
      });
      console.log('Firestore document created for user:', user.uid);

      // 3. Redirect to home page
      router.push('/'); 
    } catch (err: unknown) {
      // Handle Errors here.
      console.error("Sign up error:", err);
      // Provide user-friendly error messages
      let message = "Failed to create account. Please try again.";
      if (typeof err === 'object' && err !== null && 'code' in err) {
        const code = (err as { code: string }).code;
        if (code === 'auth/email-already-in-use') {
          message = "This email address is already in use.";
        } else if (code === 'auth/weak-password') {
          message = "Password should be at least 6 characters.";
        }
      }
      setError(message);
    } finally {
      setLoading(false); // Reset loading state
    }
  };

  // Generic Provider Sign-In Handler
  const handleProviderSignUp = async (provider: GithubAuthProvider | GoogleAuthProvider, providerName: 'github' | 'google') => {
    setError(null);
    setProviderLoading(providerName); 
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      console.log(`${providerName} Sign-up/Sign-in successful:`, user);
      
      // --- Start: Generate Unique Username for Provider --- 
      let preferredUsername = '';
      // Try GitHub handle first if available (more likely to be unique/desired)
      if (providerName === 'github' && user.providerData[0]?.displayName) {
        preferredUsername = user.providerData[0].displayName;
      } else if (user.displayName) { // Then try display name from provider
        preferredUsername = user.displayName;
      } else if (user.email) { // Fallback to email prefix
        preferredUsername = user.email.split('@')[0];
      }
      // Final fallback if all else fails
      if (!preferredUsername || preferredUsername.length < 3) {
        preferredUsername = 'user';
      }
      const uniqueUsername = await generateUniqueUsername(preferredUsername);
      // --- End: Generate Unique Username for Provider --- 

      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || user.email?.split('@')[0],
        photoURL: user.photoURL,
        username: uniqueUsername, // Save the generated username
        lastLogin: new Date() 
      }, { merge: true }); 
      console.log(`Firestore document created/updated for ${providerName} user:`, user.uid);

      router.push('/'); // Redirect home
    } catch (error: unknown) {
      console.error(`${providerName} sign up error:`, error);
      // Handle specific errors if needed (e.g., account exists with different credential)
      let message = `Failed to sign up with ${providerName}. Please try again.`;
      if (typeof error === 'object' && error !== null && 'code' in error) {
        const code = (error as { code: string }).code;
        if (code === 'auth/account-exists-with-different-credential') {
          message = 'An account already exists with the same email address using a different sign-in method.';
        }
      }
      setError(message);
    } finally {
      setProviderLoading(null);
    }
  };

  // Specific Handlers for Buttons
  const handleGitHubSignUp = () => {
    const githubProvider = new GithubAuthProvider();
    handleProviderSignUp(githubProvider, 'github');
  };

  const handleGoogleSignUp = () => {
    const googleProvider = new GoogleAuthProvider();
    handleProviderSignUp(googleProvider, 'google');
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
          <p className="mt-2 text-sm sm:text-base text-gray-400">Create your account</p>
      </div>

      {/* Wrapper to center the form content vertically in remaining space */}
      <div className="flex-grow flex flex-col items-center justify-center">
        {/* Form Container - Centered Horizontally by items-center, Vertically by justify-center */}
        <div className="w-full max-w-md"> 
          <h1 className="text-3xl font-bold text-center mb-2">Create your account</h1>
          <p className="text-center text-base text-gray-400 mb-6">
            Already have an account?{' '}
            <Link href="/signin" className="font-medium text-white hover:text-gray-300 transition-colors">
              Sign in
            </Link>
          </p>

          {/* Social Sign Up Buttons */}
          <div className="space-y-4 mb-6">
            <button 
              onClick={handleGitHubSignUp}
              disabled={!!providerLoading} // Disable if any provider is loading
              className="w-full flex items-center justify-center px-4 py-2.5 border border-gray-600 rounded-md shadow-sm text-base font-medium text-gray-300 bg-custom-dark hover:bg-opacity-80 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
            >
              <Github size={22} className="mr-2" />
              {providerLoading === 'github' ? 'Signing in...' : 'Sign up with GitHub'}
            </button>
            <button 
              onClick={handleGoogleSignUp}
              disabled={!!providerLoading}
              className="w-full flex items-center justify-center px-4 py-2.5 border border-gray-600 rounded-md shadow-sm text-base font-medium text-gray-300 bg-custom-dark hover:bg-opacity-80 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
            >
              <svg className="mr-2" width="22" height="22" fill="currentColor" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              {providerLoading === 'google' ? 'Signing in...' : 'Sign up with Google'}
            </button>
          </div>

          {/* Divider with Gradient Lines */}
          <div className="relative flex items-center my-6"> {/* Use flexbox, adjusted margin */}
            <div className="flex-grow h-px bg-gradient-to-r from-transparent via-gray-600 to-gray-600"></div> {/* Left gradient line */} 
            <span className="flex-shrink-0 px-4 text-sm text-gray-400 uppercase">OR</span> {/* OR Text */} 
            <div className="flex-grow h-px bg-gradient-to-l from-transparent via-gray-600 to-gray-600"></div> {/* Right gradient line */} 
          </div>

          <p className="text-center text-base text-gray-400 mb-4">Enter your email below to create your account</p>

          {/* Email/Password Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
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
                autoComplete="new-password"
                required
                className="appearance-none rounded-md relative block w-full px-3 py-2.5 border border-gray-600 bg-custom-darker placeholder-gray-500 text-white focus:outline-none focus:ring-1 focus:ring-gray-500 focus:border-gray-500 focus:z-10 sm:text-base transition-colors"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <div className="flex items-center">
              <input
                id="agree"
                name="agree"
                type="checkbox"
                className="h-4 w-4 focus:ring-gray-500 border-gray-500 bg-custom-dark rounded cursor-pointer appearance-none checked:bg-white checked:border-transparent focus:outline-none focus:ring-1 focus:ring-offset-0 checked:bg-check-image"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3csvg viewBox='0 0 16 16' fill='black' xmlns='http://www.w3.org/2000/svg'%3e%3cpath d='M12.207 4.793a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0l-2-2a1 1 0 011.414-1.414L6.5 9.086l4.293-4.293a1 1 0 011.414 0z'/%3e%3c/svg%3e")`,
                  backgroundSize: '70%',
                  backgroundPosition: 'center',
                  backgroundRepeat: 'no-repeat'
                }}
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
              />
              <label htmlFor="agree" className="ml-2 block text-base text-gray-400 cursor-pointer">
                Agree to our{' '}
                <Link href="/terms" className="font-medium text-white hover:text-gray-300 transition-colors">Terms of Service</Link>
                {' '}
                and
                {' '}
                <Link href="/privacy" className="font-medium text-white hover:text-gray-300 transition-colors">Privacy Policy</Link>
              </label>
            </div>

            {/* Display Error Message */}
            {error && (
              <p className="text-red-500 text-sm text-center mt-2">{error}</p>
            )}

            <div>
              <button
                type="submit"
                disabled={!agreed || loading || !!providerLoading} // Also disable if provider is loading
                className="group relative w-full flex justify-center py-2.5 px-4 border border-transparent text-base font-medium rounded-md text-custom-darker bg-white hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-custom-black focus:ring-white transition-colors disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? 'Signing Up...' : 'Sign up'}
              </button>
            </div>
          </form>
        </div>
        </div> {/* Close the centering wrapper */}
      </div>
    </div>
  );
} 