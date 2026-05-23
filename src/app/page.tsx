'use client'; // Mark as client componen

import React, { useState, useEffect, useRef, Fragment, useCallback } from 'react'; // Import Fragment
import { 
  ArrowUp, Image as ImageIcon, Folder, // Removed CreditCard, ArrowUpCircle
  X as CloseIcon, User as UserIcon, LogOut, Home as HomeIcon, FileText, Shield, GalleryVertical, Mail,
  Compass, LayoutGrid, // Added Compass and LayoutGrid for SegmentedControl
  Copy, PackagePlus, // Added Copy and PackagePlus for the new segmented control
  Globe, Lock // For the new Public toggle button and Visibility dropdown
} from 'lucide-react';
import { useRouter } from 'next/navigation'; // Import useRouter
import VerticalSlidePlaceholder from '@/components/AnimatedPlaceholderTextarea';
import Image from 'next/image';
import Link from 'next/link'; 
// Removed SegmentedControl import
import SegmentedControl from '@/components/SegmentedControl'; // Ensured SegmentedControl import is present
import { 
  onAuthStateChanged, 
  User, 
  signOut, 
  GoogleAuthProvider,
  signInWithPopup // Changed: Removed signInWithRedirect, getRedirectResult. Ensured signInWithPopup is here.
} from "firebase/auth"; 
import { auth, db } from '@/firebase/config'; // Import auth instance AND db
import { doc, getDoc, setDoc, serverTimestamp, collection, query, where, getDocs, updateDoc } from 'firebase/firestore';
// Removed CustomMenuOverlay import
import XPlatformIcon from '@/components/XPlatformIcon'; // Import the new X icon component

// --- Start: Added UserProfile Interface (similar to settings) --- 
interface UserProfile {
  uid: string;
  username?: string;
  name?: string;
  description?: string;
  location?: string;
  link?: string;
  avatarUrl?: string;
  projects?: number;
  dailyMessagesRemaining?: string;
  hideProfilePicture?: boolean;
  email?: string;
}
// Default avatar if none is set
const DEFAULT_AVATAR = '/default-avatar.png';
// --- End: Added UserProfile Interface ---

// Refined hype texts for mobile/Flutter focus
const hypeTexts = [
  "Create a retro-themed pixel art game maker.",
  "Make a minimalist-themed focus timer app.",
  "Develop a nature-themed ambient soundscape app.",
  "Build a community-themed local skill-share app.",
  "Design a sci-fi themed star chart navigation app.",
  "Generate a fantasy-themed story prompt writer app.",
  "Craft an eco-themed sustainable habit tracker.",
  "Engineer an AI-themed personalized learning path app.",
  "Produce a wellness-themed guided meditation app.",
  "Formulate a culinary-themed international recipe discovery app."
];

// Updated data for the target audience section (Flutter focus)
// const targetAudience = [
//   {
//     title: 'Flutter Developers',
//     description: 'Accelerate your workflow. Generate boilerplate, refactor code, and build UI faster than ever.'
//   },
//   {
//     title: 'Mobile App Designers',
//     description: 'Turn your Figma designs or mockups into interactive Flutter prototypes in minutes.'
//   },
//   {
//     title: 'Product Teams',
//     description: 'Quickly iterate on mobile app ideas. Empower non-technical members to contribute to Flutter development.'
//   },
//   {
//     title: 'Indie Hackers & Startups',
//     description: 'Launch your cross-platform Flutter MVP in record time. Let AI handle the heavy lifting.'
//   }
// ];

// Testimonial data
// const testimonials = [
//   {
//     quote: "Hands down the best tool I've ever used",
//     author: "Karin",
//     title: "Solopreneur"
//   },
//   // Add more testimonials here if needed for a carousel later
//   // {
//   //   quote: "Dartivo saved us weeks of development time.",
//   //   author: "Alex",
//   //   title: "CTO, Startup Inc."
//   // },
//   // {
//   //   quote: "Finally, coding feels like magic again!",
//   //   author: "Sam",
//   //   title: "Freelance Developer"
//   // }
// ];

// Updated prompts for suggestion chips
const suggestionPrompts = [
  "Create gamified local volunteer app.",
  "Make AI fridge recipe generator.",
  "Develop AR interactive city guide."
];

// --- Start: Add Username Helpers (copied from signup) ---
// Basic username sanitization (allow letters, numbers, underscore; lowercase)
const sanitizeUsername = (username: string): string => {
  let sanitized = username.trim();
  sanitized = sanitized.replace(/[^a-zA-Z0-9_]/g, '_');
  sanitized = sanitized.replace(/_{2,}/g, '_');
  sanitized = sanitized.replace(/^_+|_+$/g, '');
  sanitized = sanitized.substring(0, 20);
  if (sanitized.length < 3) {
     sanitized = `user_${sanitized}`.substring(0, 20);
  } 
  return sanitized.toLowerCase(); 
};

// Check if a username already exists in Firestore
const isUsernameTaken = async (username: string): Promise<boolean> => {
  const usersRef = collection(db, "users");
  const q = query(usersRef, where("username", "==", username));
  try {
    const querySnapshot = await getDocs(q);
    return !querySnapshot.empty; 
  } catch (error) {
    console.error("Error checking username existence:", error);
    return true; 
  }
};

// Generate a unique username by appending numbers if necessary
const generateUniqueUsername = async (preferredUsername: string): Promise<string> => {
  let currentUsername = sanitizeUsername(preferredUsername);
  let attempts = 0;
  const maxAttempts = 10; 

  while (await isUsernameTaken(currentUsername) && attempts < maxAttempts) {
    attempts++;
    const randomSuffix = Math.floor(100 + Math.random() * 900); 
    const baseUsername = sanitizeUsername(preferredUsername).substring(0, 20 - 4); 
    currentUsername = `${baseUsername}_${randomSuffix}`;
  }

  if (attempts >= maxAttempts) {
    console.error(`Could not generate unique username for ${preferredUsername} after ${maxAttempts} attempts.`);
    return `user_${Date.now()}`.substring(0, 20); 
  }

  return currentUsername;
};
// --- End: Add Username Helpers ---

export default function Home() {
  // const [isScrolled, setIsScrolled] = useState(false);
  // const [currentTestimonialIndex, setCurrentTestimonialIndex] = useState(0);
  // const [interactionMode, setInteractionMode] = useState('standard'); // State for SegmentedControl
  const [activeProjectView, setActiveProjectView] = useState<'Creations' | 'Explore'>('Explore'); // Changed default to 'Explore'
  const [isCloneModeActive, setIsCloneModeActive] = useState(false); // New state for Clone toggle
  const [isPublic, setIsPublic] = useState(true); // Default to Public
  const [isVisibilityMenuOpen, setIsVisibilityMenuOpen] = useState(false); // State for visibility dropdown
  const [isAvatarMenuOpen, setIsAvatarMenuOpen] = useState(false); // State for avatar dropdown menu
  
  const visibilityMenuRef = useRef<HTMLDivElement>(null); // Ref for click outside
  const avatarMenuRef = useRef<HTMLDivElement>(null); // Assuming you might have this for the avatar menu already or want it
  const avatarButtonRef = useRef<HTMLDivElement>(null); // Assuming a ref for the avatar button itself

  // Effect to handle clicks outside of menus
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Handle Avatar Menu Click Outside
      if (isAvatarMenuOpen && 
          avatarMenuRef.current && 
          !avatarMenuRef.current.contains(event.target as Node) &&
          avatarButtonRef.current && 
          !avatarButtonRef.current.contains(event.target as Node)) {
        setIsAvatarMenuOpen(false);
      }

      // Handle Visibility Menu Click Outside
      if (isVisibilityMenuOpen && 
          visibilityMenuRef.current && 
          !visibilityMenuRef.current.contains(event.target as Node)) {
        // Check if the click was on the trigger button itself to prevent immediate re-closing
        const triggerButton = (event.target as HTMLElement).closest('[aria-label="Visibility options"] '); // Add an aria-label to the trigger button
        if (!triggerButton) {
          setIsVisibilityMenuOpen(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isAvatarMenuOpen, isVisibilityMenuOpen]); // Dependencies

  // Close dropdown when clicking outside (Original - to be merged or removed if covered by the above)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isAvatarMenuOpen && event.target instanceof Element) {
        const dropdown = document.getElementById('avatar-dropdown'); // This specific ID might need to be ref-based too
        const avatar = document.getElementById('avatar-button'); // This specific ID might need to be ref-based too
        if (dropdown && !dropdown.contains(event.target) && avatar && !avatar.contains(event.target)) {
          setIsAvatarMenuOpen(false);
        }
      }
    };
    
    // document.addEventListener('mousedown', handleClickOutside); // Already added in the effect above
    // return () => {
    //   document.removeEventListener('mousedown', handleClickOutside); // Already removed in the effect above
    // };
  }, [isAvatarMenuOpen]);
  const [isInputFocused, setIsInputFocused] = useState(false); // State for focus
  const [inputValue, setInputValue] = useState(''); // State for textarea value
  const [currentHintIndex, setCurrentHintIndex] = useState(0); // Renamed from currentIndex
  const [showSignUpDialog, setShowSignUpDialog] = useState(false); // State for dialog visibility
  // --- Start: Add state for modal Google button ---
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false); // State for send button loading
  // --- Start: State to manage if redirect is in progress to avoid double triggers ---
  // const [isRedirecting, setIsRedirecting] = useState(false);
  // --- End: State to manage if redirect is in progress ---
  const hintIntervalRef = useRef<NodeJS.Timeout | null>(null); // Ref for hint interval
  const textareaRef = useRef<HTMLTextAreaElement>(null); // Ref for textarea
  const [currentUser, setCurrentUser] = useState<User | null>(null); // State for Firebase user
  const [loadingAuthState, setLoadingAuthState] = useState(true); // Loading state for auth check
  // const [isMenuOpen, setIsMenuOpen] = useState(false); // We'll keep this for now but not use the overlay
  // --- Start: Added state for profile data --- 
  const [loggedInUserProfile, setLoggedInUserProfile] = useState<UserProfile | null>(null);
  // --- End: Added state for profile data ---
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false); // State for mobile menu
  const [isLeftSidebarExpanded, setIsLeftSidebarExpanded] = useState(false); // State for new expandable left sidebar
  const router = useRouter(); // Get router instance

  useEffect(() => {
    const handleScroll = () => {
      // setIsScrolled(window.scrollY > 10); // isScrolled is unused
    };
    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // Basic auto-cycle for testimonials (add more logic for controls if needed)
  // useEffect(() => {
  //   const timer = setInterval(() => {
  //     setCurrentTestimonialIndex(prevIndex => (prevIndex + 1) % testimonials.length);
  //   }, 5000); // Change testimonial every 5 seconds
  //   return () => clearInterval(timer);
  // }, []);

  // Effect to cycle through hint texts when input is empty
  useEffect(() => {
    const pauseDuration = 3000; // Same as before
    const animationDuration = 300; // Placeholder for timing if needed

    const setupHintInterval = () => {
      hintIntervalRef.current = setInterval(() => {
        // Simple index cycle, animation handled by opacity in child
        setCurrentHintIndex((prevIndex) => (prevIndex + 1) % hypeTexts.length); 
      }, pauseDuration + animationDuration);
    };

    const clearHintInterval = () => {
      if (hintIntervalRef.current) clearInterval(hintIntervalRef.current);
      hintIntervalRef.current = null;
    };

    if (inputValue === '') {
      setupHintInterval();
    } else {
      clearHintInterval();
    }

    return () => {
      clearHintInterval();
    };
  }, [inputValue]); // Rerun when input value changes

  // Global Keydown Listener Effect
  useEffect(() => {
    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Tab') {
        event.preventDefault(); // Prevent default Tab behavior
        
        const hintToInsert = hypeTexts[currentHintIndex] || '';
        setInputValue(prevValue => `${prevValue}${hintToInsert}`);
        
        // Focus the textarea after inserting
        textareaRef.current?.focus(); 
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);

    // Cleanup listener on component unmount
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
    // Depend on currentHintIndex so the correct hint is inserted
  }, [currentHintIndex]); // Removed hypeTexts from dependencies

  // Effect to listen for auth state changes AND fetch profile data
  useEffect(() => {
    console.log("onAuthStateChanged listener setup");
    const unsubscribe = onAuthStateChanged(auth, async (user) => { // Made async
      console.log("onAuthStateChanged: User object from Firebase:", user);
      setCurrentUser(user);
      // Don't set loadingAuthState false here, do it after profile fetching

      if (user) {
        console.log("onAuthStateChanged: User is signed in, UID:", user.uid);
        // User is signed in, fetch their profile data
        const userDocRef = doc(db, 'users', user.uid);
        try {
          const docSnap = await getDoc(userDocRef);
          if (docSnap.exists()) {
            console.log("onAuthStateChanged: User profile found in Firestore");
            const fetchedData = docSnap.data() as Omit<UserProfile, 'uid'>;
            const validUsername = fetchedData.username && fetchedData.username.trim() !== '' ? fetchedData.username.trim() : null;
            setLoggedInUserProfile({ 
                ...fetchedData,
                uid: user.uid, 
                username: validUsername ?? undefined, 
                avatarUrl: fetchedData.avatarUrl || user.photoURL || DEFAULT_AVATAR,
                name: fetchedData.name || user.displayName || '',
                email: fetchedData.email || user.email || '',
            });
          } else {
            console.warn("onAuthStateChanged: User profile data not found in Firestore for UID:", user.uid);
            setLoggedInUserProfile(null);
          }
        } catch (error) {
          console.error("onAuthStateChanged: Error fetching logged-in user profile data:", error);
          setLoggedInUserProfile(null);
        } finally {
          console.log("onAuthStateChanged: Setting loadingAuthState to false after profile fetch");
          setLoadingAuthState(false); // Always set to false after profile fetch attempt
        }
      } else {
        // No user is signed in
        console.log("onAuthStateChanged: No user, setting loadingAuthState to false");
        setLoggedInUserProfile(null);
        setLoadingAuthState(false); // Set auth loading false if no user
      }
    });

    // Cleanup subscription on unmount
    return () => {
      console.log("onAuthStateChanged: Unsubscribing listener");
      unsubscribe();
    };
  }, []); // Removed db from dependencies as it's stable

  // Effect to close mobile menu if window is resized to desktop view
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) { // md breakpoint
        setIsMobileMenuOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // const handleModeChange = (newValue: string) => {
  //   setInteractionMode(newValue);
  //   // Add any logic needed when mode changes
  //   console.log('Interaction Mode:', newValue);
  // };

  // Handlers for focus state
  const handleFocus = () => setIsInputFocused(true);
  const handleBlur = () => setIsInputFocused(false);

  // Handler for textarea input change
  const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(event.target.value);
  };

  // --- Start: Function to create project and navigate (extracted from handleSend) ---
  const createProjectAndNavigate = useCallback(async (user: User, initialMessage?: string) => { 
    console.log("Attempting to create project and navigate for user:", user.uid);
    try {
      // Create a new project document in Firestore
      const projectRef = doc(collection(db, 'projects')); // Changed 'dartivo' to 'projects'
      await setDoc(projectRef, {
        ownerId: user.uid, // Use passed-in user's UID
        name: "New Flutter Project", // Default name, can be changed later
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        // Add any other default project fields here
        templateType: 'flutter_default', // Example: specify a default template
        isInitialized: false, // Mark as not yet initialized by backend
      });
      console.log("Project document created with ID:", projectRef.id);

      if (initialMessage) {
        // If there's an initial message, store it in localStorage to be picked up by the project page
        localStorage.setItem('pendingChatMessage', initialMessage);
        console.log("Pending chat message stored in localStorage:", initialMessage);
      }

      // Redirect to the new project page
      router.push(`/projects/${projectRef.id}`);
    } catch (error) {
      console.error("Error creating project:", error);
      // Display an error to the user
      alert("Failed to create the project. Please try again.");
      localStorage.removeItem('pendingChatMessage'); // Clear if project creation fails
    }
  }, [router]); 
  // --- End: createProjectAndNavigate function ---

  // Updated handleSend: Only shows dialog if not logged in
  const handleSend = async () => {
    const trimmedInput = inputValue.trim();
    if (trimmedInput && !isSending) {
      setIsSending(true);
      try {
        if (currentUser) {
          // User is logged in, directly create project
          setInputValue(''); // Clear input after triggering action
          await createProjectAndNavigate(currentUser, trimmedInput);
        } else {
          // User is not logged in, show the sign-up dialog
          setModalError(null); // Clear previous modal errors
          setShowSignUpDialog(true);
          // Keep the input value in the state (`inputValue`) so it can be used after login
        }
      } catch (error) {
        console.error("Error in handleSend:", error);
        // Handle error as needed
      } finally {
        setIsSending(false);
      }
    }
  };

  const handleCloseDialog = () => {
    setShowSignUpDialog(false);
    setModalError(null); // Clear error when closing
    // Ensure loading state is reset if the dialog is closed during sign-in attempt
    setIsGoogleLoading(false); 
  };

  // --- Start: Google Sign-In Handler for Modal (Updated for POPUP) ---
  const handleGoogleSignInFromModal = async () => {
    console.log("[Auth] handleGoogleSignInFromModal invoked for POPUP flow");
    setModalError(null);
    setIsGoogleLoading(true);

    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      // Scopes are typically added by default or can be added if needed:
      // provider.addScope('profile');
      // provider.addScope('email');

      console.log("[Auth] Starting Google sign-in POPUP flow...");
      const result = await signInWithPopup(auth, provider); // Changed to signInWithPopup
      const user = result.user;
      console.log("[Auth] Popup sign-in successful, user:", user);

      // --- Handle Firestore User Creation/Update (directly here for popup) ---
      const userDocRef = doc(db, "users", user.uid);
      const docSnap = await getDoc(userDocRef);

      if (!docSnap.exists()) {
        console.log("User document not found after popup sign-in, creating one...");
        const preferredUsername = user.displayName?.split(' ')[0] || user.email?.split('@')[0] || 'user';
        const uniqueUsername = await generateUniqueUsername(preferredUsername);

        await setDoc(userDocRef, {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName || uniqueUsername,
          username: uniqueUsername,
          photoURL: user.photoURL,
          createdAt: serverTimestamp(),
          lastLogin: serverTimestamp()
        });
        console.log("User document created for popup user:", user.uid);
      } else {
        await updateDoc(userDocRef, { lastLogin: serverTimestamp() });
        console.log("Updated last login for popup user:", user.uid);
      }
      // --- End Firestore User Handling ---

      handleCloseDialog(); 

      const trimmedInput = inputValue.trim(); 
      if (trimmedInput) {
        console.log("Found pending prompt after popup sign-in, creating project:", trimmedInput);
        await createProjectAndNavigate(user, trimmedInput);
        // inputValue is intentionally not cleared here.
        // This keeps the message in the textarea after sign-in,
        // until the page navigates to the project.
        // The createProjectAndNavigate function handles passing the message to the next page.
      } else {
        console.log("No pending prompt after popup sign-in.");
      }

    } catch (error: unknown) {
      console.error("[Auth] Error during Google sign-in popup:", error);
      let message = "Failed to sign in with Google. Please try again.";
      if (typeof error === 'object' && error !== null && 'code' in error) {
        const code = (error as { code: string }).code;
        if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
            message = "Sign-in process was cancelled.";
        } else if (code === 'auth/popup-blocked') {
            message = "Popup blocked by browser. Please enable popups for this site.";
        } else if (code === 'auth/account-exists-with-different-credential') {
            message = "An account already exists with this email using a different sign-in method.";
        } else if (code === 'auth/unauthorized-domain') {
          // This error is less likely with popup but good to keep if authDomain was custom
          message = 'This domain is not authorized for OAuth operations.'; 
        } else if (code === 'auth/network-request-failed') {
          message = 'Network error. Please check your connection and try again.';
        }
        // Note: redirect_uri_mismatch is not an error signInWithPopup typically throws directly.
      }
      setModalError(message);
    } finally {
      setIsGoogleLoading(false);
    }
  };
  // --- End: Google Sign-In Handler ---

  // Handle Enter key press in textarea
  const handleTextareaKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && inputValue.trim()) {
      event.preventDefault(); // Prevent newline on Enter
      handleSend(); // Trigger the send logic (which shows the dialog)
    }
  };

  const currentHintText = hypeTexts[currentHintIndex]; // Calculate current hint

  const handleSignOut = async () => {
    setLoadingAuthState(true); // Indicate loading while signing out
    try {
      await signOut(auth);
      console.log('Signed out successfully');
      // currentUser state will be updated via onAuthStateChanged listener
    } catch (error) {
      console.error("Sign out error:", error);
      setLoadingAuthState(false); // Reset loading state on error
    }
  };

  // Extract user display name safely (prioritize profile data if loaded)
  const getUserDisplayName = () => {
    if (loggedInUserProfile?.name) return loggedInUserProfile.name;
    if (!currentUser) return 'User';
    return currentUser.displayName || currentUser.email?.split('@')[0] || 'User';
  };

  // --- Start: Added helper for logged-in user avatar --- 
  const getLoggedInUserAvatar = () => {
     // Use avatar from profile data if available, otherwise fallback
     return loggedInUserProfile?.avatarUrl || currentUser?.photoURL || DEFAULT_AVATAR; 
  };
  // --- End: Added helper for logged-in user avatar --- 

  // --- Start: Added getInitials helper function --- 
  const getInitials = (name?: string) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  };
  // --- End: Added getInitials helper function --- 

  console.log("[Render Cycle] showSignUpDialog state is:", showSignUpDialog); // Moved log here

  return (
    <div className="min-h-screen flex flex-col relative font-poppins">
      {/* User Avatar with Dropdown at Top Right Corner */}
      {currentUser && !loadingAuthState && (
        <div className="fixed top-4 right-4 z-50">
          {/* Avatar Button */}
          <div
            id="avatar-button"
            onClick={() => setIsAvatarMenuOpen(!isAvatarMenuOpen)}
            className="cursor-pointer rounded-full hover:ring-2 hover:ring-white/25 transition-all relative"
          >
            {getLoggedInUserAvatar() !== DEFAULT_AVATAR ? (
              <Image
                src={getLoggedInUserAvatar()}
                alt={getUserDisplayName()}
                width={40}
                height={40}
                className="rounded-full object-cover shadow-md"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-custom-dark flex items-center justify-center text-white font-semibold shadow-md">
                {getInitials(getUserDisplayName())}
              </div>
            )}
          </div>
          
          {/* Dropdown Menu */}
          <div
            id="avatar-dropdown"
            className={`absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-black border border-custom-darker transform origin-top-right transition-all duration-150 ease-in-out ${
              isAvatarMenuOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'
            }`}
          >
            <div className="p-1 space-y-1">
              {/* User Info Section - Reverted to original styling */}
              <Link
                href={`/${loggedInUserProfile?.username || currentUser.uid}`}
                className="block px-4 py-3 border-b border-custom-darker" 
              >
                <div className="font-medium text-white truncate">{getUserDisplayName()}</div>
                <div className="text-xs text-gray-400 truncate">{currentUser.email}</div>
              </Link>
              
              {/* Menu Items */}
              <Link
                href="/settings"
                className="block text-sm text-gray-300" 
              >
                <div className="w-full flex items-center hover:bg-zinc-900 hover:text-white hover:rounded-md px-3 py-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Settings
                </div>
              </Link>
              
              {/* Upgrade Button */}
              <Link
                href="/settings?tab=billing" 
                className="block text-sm text-gray-300"
              >
                <div className="w-full flex items-center hover:bg-zinc-900 hover:text-white hover:rounded-md px-3 py-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="mr-2">
                    <path fillRule="evenodd" clipRule="evenodd" d="M12.5001 3.44338C12.1907 3.26474 11.8095 3.26474 11.5001 3.44338L4.83984 7.28868C4.53044 7.46731 4.33984 7.79744 4.33984 8.1547V15.8453C4.33984 16.2026 4.53044 16.5327 4.83984 16.7113L11.5001 20.5566C11.8095 20.7353 12.1907 20.7353 12.5001 20.5566L19.1604 16.7113C19.4698 16.5327 19.6604 16.2026 19.6604 15.8453V8.1547C19.6604 7.79744 19.4698 7.46731 19.1604 7.28868L12.5001 3.44338ZM10.5001 1.71133C11.4283 1.17543 12.5719 1.17543 13.5001 1.71133L20.1604 5.55663C21.0886 6.09252 21.6604 7.0829 21.6604 8.1547V15.8453C21.6604 16.9171 21.0886 17.9075 20.1604 18.4434L13.5001 22.2887C12.5719 22.8246 11.4283 22.8246 10.5001 22.2887L3.83984 18.4434C2.91164 17.9075 2.33984 16.9171 2.33984 15.8453V8.1547C2.33984 7.0829 2.91164 6.09252 3.83984 5.55663L10.5001 1.71133Z" fill="currentColor"></path>
                    <path d="M9.44133 11.4454L9.92944 9.98105C10.0321 9.67299 10.4679 9.67299 10.5706 9.98105L11.0587 11.4454C11.2941 12.1517 11.8483 12.7059 12.5546 12.9413L14.019 13.4294C14.327 13.5321 14.327 13.9679 14.019 14.0706L12.5546 14.5587C11.8483 14.7941 11.2941 15.3483 11.0587 16.0546L10.5706 17.519C10.4679 17.827 10.0321 17.827 9.92944 17.519L9.44133 16.0546C9.2059 15.3483 8.65167 14.7941 7.94537 14.5587L6.48105 14.0706C6.17298 13.9679 6.17298 13.5321 6.48105 13.4294L7.94537 12.9413C8.65167 12.7059 9.2059 12.1517 9.44133 11.4454Z" fill="currentColor"></path>
                    <path d="M14.4946 8.05961L14.7996 7.14441C14.8638 6.95187 15.1362 6.95187 15.2004 7.14441L15.5054 8.05961C15.6526 8.50104 15.999 8.84744 16.4404 8.99458L17.3556 9.29965C17.5481 9.36383 17.5481 9.63617 17.3556 9.70035L16.4404 10.0054C15.999 10.1526 15.6526 10.499 15.5054 10.9404L15.2004 11.8556C15.1362 12.0481 14.8638 12.0481 14.7996 11.8556L14.4946 10.9404C14.3474 10.499 14.001 10.1526 13.5596 10.0054L12.6444 9.70035C12.4519 9.63617 12.4519 9.36383 12.6444 9.29965L13.5596 8.99458C14.001 8.84744 14.3474 8.50104 14.4946 8.05961Z" fill="currentColor"></path>
                  </svg>
                  Upgrade
                </div>
              </Link>

              <button
                onClick={handleSignOut}
                className="w-full text-left block text-sm text-gray-300"
              >
                <div className="w-full flex items-center hover:bg-zinc-900 hover:text-white hover:rounded-md px-3 py-2">
                  <LogOut size={16} className="mr-2" />
                  Sign Out
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Mobile Menu Toggle Button - Floating Top-Left */}
      <button
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className="sm:hidden fixed top-6 left-6 z-30 p-1.5 rounded-md text-gray-300 hover:text-white bg-custom-black/50 hover:bg-custom-dark focus:outline-none shadow-lg"
        aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
        style={{ WebkitTapHighlightColor: 'transparent' }}
      >
        {isMobileMenuOpen ? (
          <CloseIcon size={24} />
        ) : (
          <svg width="24" height="24" viewBox="0 0 20 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <path fillRule="evenodd" clipRule="evenodd" d="M2.5 3C1.67157 3 1 3.67157 1 4.5V15.5C1 16.3284 1.67157 17 2.5 17H17.5C18.3284 17 19 16.3284 19 15.5V4.5C19 3.67157 18.3284 3 17.5 3H2.5ZM2 4.5C2 4.22386 2.22386 4 2.5 4H6V16H2.5C2.22386 16 2 15.7761 2 15.5V4.5ZM7 16H17.5C17.7761 16 18 15.7761 18 15.5V4.5C18 4.22386 17.7761 4 17.5 4H7V16Z"></path>
          </svg>
        )}
      </button>

      {/* Desktop Sidebar - Hidden on small screens, Expandable */}
      <div className={`hidden sm:flex fixed left-0 top-0 bottom-0 z-10 bg-custom-black border-r border-custom-darker flex-col pt-2 pb-6 shadow-lg ${isLeftSidebarExpanded ? 'w-60 items-start px-3' : 'w-14 items-center px-1'}`}>
        {/* Toggle Sidebar Button/Area - Conditional based on isLeftSidebarExpanded */}
        {isLeftSidebarExpanded ? (
          // EXPANDED STATE: Button to collapse sidebar
          <button
            onClick={() => setIsLeftSidebarExpanded(false)}
            className="w-full flex items-center justify-between h-[52px] py-3 rounded-md text-gray-400 hover:text-white mb-6 focus:outline-none px-1"
            aria-label="Collapse sidebar"
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            <div className="flex items-center"> {/* Groups image and text */}
              <Image src="/dartivo.png" alt="Dartivo logo" width={24} height={24} className="flex-shrink-0" />
              <span 
                className={`text-xl font-bold text-white overflow-hidden whitespace-nowrap ml-px translate-y-1 opacity-100 max-w-full transition-opacity transition-max-width duration-300 ease-in-out delay-100`}
              >
                artivo
              </span>
            </div>
            {/* Custom SVG for collapse action */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-5 h-5 flex-shrink-0" // Matches size={20}
            >
              <path fillRule="evenodd" clipRule="evenodd" d="M2.5 3C1.67157 3 1 3.67157 1 4.5V15.5C1 16.3284 1.67157 17 2.5 17H17.5C18.3284 17 19 16.3284 19 15.5V4.5C19 3.67157 18.3284 3 17.5 3H2.5ZM2 4.5C2 4.22386 2.22386 4 2.5 4H6V16H2.5C2.22386 16 2 15.7761 2 15.5V4.5ZM7 16H17.5C17.7761 16 18 15.7761 18 15.5V4.5C18 4.22386 17.7761 4 17.5 4H7V16Z" stroke="currentColor" strokeWidth="0.5"></path>
            </svg>
          </button>
        ) : (
          // COLLAPSED STATE: Image at the top (non-interactive here)
          <div className="flex flex-col items-center justify-center w-full h-[52px] py-3 mb-6"> {/* Added h-[52px] and justify-center */}
            <Image src="/dartivo.png" alt="Dartivo logo" width={24} height={24} className="flex-shrink-0" /> {/* Removed mb-2 as the button below is gone */}
          </div>
        )}

        {/* Projects Section - Visible when expanded */}
        <div className={`w-full overflow-hidden transition-all duration-300 ease-in-out ${isLeftSidebarExpanded ? 'max-h-48 opacity-100 mb-6' : 'max-h-0 opacity-0 mb-0'}`}>
          {currentUser ? (
            <Link href="/dartivo" className={`w-full flex items-center py-2 rounded-md text-gray-300 hover:text-white text-sm justify-start px-1.5`}>
              <Folder size={18} className={`${isLeftSidebarExpanded ? 'mr-3' : ''} flex-shrink-0`} />
              <span className={`overflow-hidden whitespace-nowrap ${isLeftSidebarExpanded ? 'opacity-100 max-w-full transition-opacity transition-max-width duration-300 ease-in-out delay-100' : 'opacity-0 max-w-0 transition-opacity transition-max-width duration-0 ease-in-out'}`}>Your Apps</span>
            </Link>
          ) : (
            <div className={`px-1 py-2 text-sm text-gray-400 ${isLeftSidebarExpanded ? 'opacity-100 transition-opacity duration-300 ease-in-out delay-100' : 'opacity-0 transition-opacity duration-0 ease-in-out'}`}>
              Sign in to see your Dartivo apps.
            </div>
          )}
        </div>
        
        {/* Bottom Icons Group - Pushed to the bottom */}
        <div className={`w-full mt-auto flex flex-col ${isLeftSidebarExpanded ? 'space-y-1' : 'space-y-1 items-center'}`}>
          {/* Expand Sidebar Button - Only when collapsed, appears at the top of this bottom group */}
          {!isLeftSidebarExpanded && (
            <button
              onClick={() => setIsLeftSidebarExpanded(true)}
              className={`w-full flex items-center py-2.5 rounded-md text-gray-400 hover:text-white focus:outline-none justify-center relative -translate-y-4`}
              aria-label="Expand sidebar"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              {/* Custom SVG for expand action - Flipped Horizontally */}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="w-5 h-5 flex-shrink-0"
                style={{ transform: 'scale(-1, 1)', transformOrigin: 'center' }} // Added transform to flip
              >
                <path fillRule="evenodd" clipRule="evenodd" d="M2.5 3C1.67157 3 1 3.67157 1 4.5V15.5C1 16.3284 1.67157 17 2.5 17H17.5C18.3284 17 19 16.3284 19 15.5V4.5C19 3.67157 18.3284 3 17.5 3H2.5ZM2 4.5C2 4.22386 2.22386 4 2.5 4H6V16H2.5C2.22386 16 2 15.7761 2 15.5V4.5ZM7 16H17.5C17.7761 16 18 15.7761 18 15.5V4.5C18 4.22386 17.7761 4 17.5 4H7V16Z" stroke="currentColor" strokeWidth="0.5"></path>
              </svg>
            </button>
          )}
          {/* Divider for collapsed state */}
          <div className="w-full h-px bg-custom-darker my-1"></div>
          {/* Navigation Icons */}
          {/* Home Icon Link Removed */}
          <Link
            href="/settings?tab=billing" // Example link for Billing
            className={`w-full flex items-center py-2.5 rounded-md text-gray-400 hover:text-white focus:outline-none ${isLeftSidebarExpanded ? 'justify-start px-1.5' : 'justify-center'}`}
            aria-label="Billing"
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0">
              <path fillRule="evenodd" clipRule="evenodd" d="M12.5001 3.44338C12.1907 3.26474 11.8095 3.26474 11.5001 3.44338L4.83984 7.28868C4.53044 7.46731 4.33984 7.79744 4.33984 8.1547V15.8453C4.33984 16.2026 4.53044 16.5327 4.83984 16.7113L11.5001 20.5566C11.8095 20.7353 12.1907 20.7353 12.5001 20.5566L19.1604 16.7113C19.4698 16.5327 19.6604 16.2026 19.6604 15.8453V8.1547C19.6604 7.79744 19.4698 7.46731 19.1604 7.28868L12.5001 3.44338ZM10.5001 1.71133C11.4283 1.17543 12.5719 1.17543 13.5001 1.71133L20.1604 5.55663C21.0886 6.09252 21.6604 7.0829 21.6604 8.1547V15.8453C21.6604 16.9171 21.0886 17.9075 20.1604 18.4434L13.5001 22.2887C12.5719 22.8246 11.4283 22.8246 10.5001 22.2887L3.83984 18.4434C2.91164 17.9075 2.33984 16.9171 2.33984 15.8453V8.1547C2.33984 7.0829 2.91164 6.09252 3.83984 5.55663L10.5001 1.71133Z" fill="currentColor"></path>
              <path d="M9.44133 11.4454L9.92944 9.98105C10.0321 9.67299 10.4679 9.67299 10.5706 9.98105L11.0587 11.4454C11.2941 12.1517 11.8483 12.7059 12.5546 12.9413L14.019 13.4294C14.327 13.5321 14.327 13.9679 14.019 14.0706L12.5546 14.5587C11.8483 14.7941 11.2941 15.3483 11.0587 16.0546L10.5706 17.519C10.4679 17.827 10.0321 17.827 9.92944 17.519L9.44133 16.0546C9.2059 15.3483 8.65167 14.7941 7.94537 14.5587L6.48105 14.0706C6.17298 13.9679 6.17298 13.5321 6.48105 13.4294L7.94537 12.9413C8.65167 12.7059 9.2059 12.1517 9.44133 11.4454Z" fill="currentColor"></path>
              <path d="M14.4946 8.05961L14.7996 7.14441C14.8638 6.95187 15.1362 6.95187 15.2004 7.14441L15.5054 8.05961C15.6526 8.50104 15.999 8.84744 16.4404 8.99458L17.3556 9.29965C17.5481 9.36383 17.5481 9.63617 17.3556 9.70035L16.4404 10.0054C15.999 10.1526 15.6526 10.499 15.5054 10.9404L15.2004 11.8556C15.1362 12.0481 14.8638 12.0481 14.7996 11.8556L14.4946 10.9404C14.3474 10.499 14.001 10.1526 13.5596 10.0054L12.6444 9.70035C12.4519 9.63617 12.4519 9.36383 12.6444 9.29965L13.5596 8.99458C14.001 8.84744 14.3474 8.50104 14.4946 8.05961Z" fill="currentColor"></path>
            </svg>
            <span className={`text-sm overflow-hidden whitespace-nowrap ${isLeftSidebarExpanded ? 'ml-3 opacity-100 max-w-full transition-opacity transition-max-width duration-300 ease-in-out delay-100' : 'ml-0 opacity-0 max-w-0 transition-opacity transition-max-width duration-0 ease-in-out'}`}>Billing</span>
          </Link>
          <Link
            href="/settings?tab=integrations" // Example link for Integrations
            className={`w-full flex items-center py-2.5 rounded-md text-gray-400 hover:text-white focus:outline-none ${isLeftSidebarExpanded ? 'justify-start px-1.5' : 'justify-center'}`}
            aria-label="Integrations"
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            <XPlatformIcon className="w-5 h-5 flex-shrink-0" />
            <span className={`text-sm overflow-hidden whitespace-nowrap ${isLeftSidebarExpanded ? 'ml-3 opacity-100 max-w-full transition-opacity transition-max-width duration-300 ease-in-out delay-100' : 'ml-0 opacity-0 max-w-0 transition-opacity transition-max-width duration-0 ease-in-out'}`}>X</span>
          </Link>

          {/* Divider when expanded (optional, can be adjusted) */}
          {/* <div className={`w-full h-px ${isLeftSidebarExpanded ? 'bg-custom-darker' : 'bg-transparent'}`}></div> */}

          {/* Sign In Button (Only in sidebar) */}
          {!currentUser && !loadingAuthState && (
            <button
              onClick={() => { setShowSignUpDialog(true); setModalError(null); }}
              className={`w-full flex items-center py-3 rounded-md text-gray-400 hover:text-white focus:outline-none ${isLeftSidebarExpanded ? 'justify-start px-1.5' : 'justify-center'}`}
              aria-label="Sign In"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <UserIcon size={20} className="flex-shrink-0" />
              <span className={`text-sm overflow-hidden whitespace-nowrap ${isLeftSidebarExpanded ? 'ml-3 opacity-100 max-w-full transition-opacity transition-max-width duration-300 ease-in-out delay-100' : 'ml-0 opacity-0 max-w-0 transition-opacity transition-max-width duration-0 ease-in-out'}`}>Sign In</span>
            </button>
          )}
          {/* Sign out button moved to avatar dropdown */}
        </div>
      </div>

      {/* Header - Remove user menu button from header as we now have the sidebar */}
      {/* The entire header block will be removed */}

      {/* Backdrop for Mobile Menu */}
      {isMobileMenuOpen && (
        <div
          onClick={() => setIsMobileMenuOpen(false)}
          className="sm:hidden fixed inset-0 top-0 bg-black/50 z-40 transition-opacity duration-300 ease-in-out opacity-100" /* MODIFIED: top-0 */
          aria-hidden="true"
        ></div>
      )}

      {/* Mobile Menu Drawer - Styled for slide-in. No longer needs outer conditional rendering. */}
      <div 
        className={`
          sm:hidden fixed top-0 left-0 w-64 h-screen 
          bg-custom-black shadow-lg z-50 
          transform transition-transform duration-300 ease-in-out 
          ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
        `} 
      >
        {isMobileMenuOpen && ( 
          <div className="flex flex-col h-full"> 
            {/* UPDATED Mobile Menu Header to match desktop style */}
            <div className="flex items-center justify-between pt-4 pl-4 pb-3 pr-3 border-b border-custom-darker flex-shrink-0"> {/* Changed p-3 to pt-4 pl-4 pb-3 pr-3 */}
              {/* Logo group mimicking desktop expanded style */}
              <div className="flex items-center">
                <Image src="/dartivo.svg" alt="Dartivo Logo" width={48} height={48} className="block flex-shrink-0" />
                <div className="flex items-baseline ml-[0.1rem]"> 
                  <span className="inline-block text-2xl text-white font-bold whitespace-nowrap lowercase transform translate-y-[3px]">
                    artivo
                  </span>
                  <span className="ml-1.5 px-2 py-1 text-[11px] leading-none bg-zinc-900 text-zinc-300 rounded-full whitespace-nowrap transform translate-y-0 border border-gray-700">
                    1.0
                  </span>
                </div>
              </div>
              {/* Close button */}
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-1 rounded-md text-gray-400 hover:text-white"
                aria-label="Close menu"
              >
                <CloseIcon size={20} />
              </button>
            </div>

            {/* Scrollable Menu Items Area (content remains the same) */}
            <div className="flex-grow overflow-y-auto p-4 space-y-1">
              {/* Existing mobile menu items are placed here */}
              {/* 1. User Profile Display / Sign In Button (Adapted from desktop) */}
              {loadingAuthState ? (
                <div className="w-full h-10 rounded-md bg-custom-darker animate-pulse mb-2"></div>
              ) : !currentUser ? (
                <button
                  onClick={() => { /* console.log("Mobile Sign In: Attempting to show sign-up dialog."); */ setShowSignUpDialog(true); setModalError(null); setIsMobileMenuOpen(false); }} // Removed log
                  className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-md text-gray-300 hover:bg-custom-dark hover:text-white transition-colors"
                  aria-label="Sign In"
                >
                  <UserIcon size={20} />
                  <span>Sign In</span>
                </button>
              ) : (
                <Link
                  href={`/${loggedInUserProfile?.username || currentUser.uid}`}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="w-full flex items-center space-x-3 px-3 py-2 rounded-md text-gray-300 hover:bg-custom-dark hover:text-white transition-colors mb-1"
                  aria-label="User profile"
                >
                  {getLoggedInUserAvatar() !== DEFAULT_AVATAR ? (
                    <Image
                      src={getLoggedInUserAvatar()}
                      alt={getUserDisplayName()}
                      width={32} 
                      height={32}
                      className="rounded-full object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-custom-dark flex items-center justify-center text-white font-semibold flex-shrink-0 text-sm">
                      {getInitials(getUserDisplayName())}
                    </div>
                  )}
                  <span className="truncate font-medium">{getUserDisplayName()}</span>
                </Link>
              )}

              {/* Divider */}
              <div className="w-full h-px bg-custom-darker my-2"></div>

              {/* 2. "Your Projects" Link / Info (Adapted from desktop) */}
              {currentUser ? (
                <Link
                  href="/dartivo"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-md text-gray-300 hover:bg-custom-dark hover:text-white transition-colors"
                >
                  <Folder size={20} />
                  <span>Your Apps</span>
                </Link>
              ) : (
                <div className="px-3 py-2.5 text-sm text-gray-500 w-full">
                  Sign in to see your Dartivo apps.
                </div>
              )}

              {/* 3. "Billing" Link (Adapted from desktop) */}
              <Link
                href="/settings?tab=billing"
                onClick={() => setIsMobileMenuOpen(false)}
                className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-md text-gray-300 hover:bg-custom-dark hover:text-white transition-colors"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-5 h-5">
                  <path fillRule="evenodd" clipRule="evenodd" d="M12.5001 3.44338C12.1907 3.26474 11.8095 3.26474 11.5001 3.44338L4.83984 7.28868C4.53044 7.46731 4.33984 7.79744 4.33984 8.1547V15.8453C4.33984 16.2026 4.53044 16.5327 4.83984 16.7113L11.5001 20.5566C11.8095 20.7353 12.1907 20.7353 12.5001 20.5566L19.1604 16.7113C19.4698 16.5327 19.6604 16.2026 19.6604 15.8453V8.1547C19.6604 7.79744 19.4698 7.46731 19.1604 7.28868L12.5001 3.44338ZM10.5001 1.71133C11.4283 1.17543 12.5719 1.17543 13.5001 1.71133L20.1604 5.55663C21.0886 6.09252 21.6604 7.0829 21.6604 8.1547V15.8453C21.6604 16.9171 21.0886 17.9075 20.1604 18.4434L13.5001 22.2887C12.5719 22.8246 11.4283 22.8246 10.5001 22.2887L3.83984 18.4434C2.91164 17.9075 2.33984 16.9171 2.33984 15.8453V8.1547C2.33984 7.0829 2.91164 6.09252 3.83984 5.55663L10.5001 1.71133Z" fill="currentColor"></path>
                  <path d="M9.44133 11.4454L9.92944 9.98105C10.0321 9.67299 10.4679 9.67299 10.5706 9.98105L11.0587 11.4454C11.2941 12.1517 11.8483 12.7059 12.5546 12.9413L14.019 13.4294C14.327 13.5321 14.327 13.9679 14.019 14.0706L12.5546 14.5587C11.8483 14.7941 11.2941 15.3483 11.0587 16.0546L10.5706 17.519C10.4679 17.827 10.0321 17.827 9.92944 17.519L9.44133 16.0546C9.2059 15.3483 8.65167 14.7941 7.94537 14.5587L6.48105 14.0706C6.17298 13.9679 6.17298 13.5321 6.48105 13.4294L7.94537 12.9413C8.65167 12.7059 9.2059 12.1517 9.44133 11.4454Z" fill="currentColor"></path>
                  <path d="M14.4946 8.05961L14.7996 7.14441C14.8638 6.95187 15.1362 6.95187 15.2004 7.14441L15.5054 8.05961C15.6526 8.50104 15.999 8.84744 16.4404 8.99458L17.3556 9.29965C17.5481 9.36383 17.5481 9.63617 17.3556 9.70035L16.4404 10.0054C15.999 10.1526 15.6526 10.499 15.5054 10.9404L15.2004 11.8556C15.1362 12.0481 14.8638 12.0481 14.7996 11.8556L14.4946 10.9404C14.3474 10.499 14.001 10.1526 13.5596 10.0054L12.6444 9.70035C12.4519 9.63617 12.4519 9.36383 12.6444 9.29965L13.5596 8.99458C14.001 8.84744 14.3474 8.50104 14.4946 8.05961Z" fill="currentColor"></path>
                </svg>
                <span>Billing</span>
              </Link>

              {/* 4. "X" (Integrations) Link (Adapted from desktop) */}
              <Link
                href="/settings?tab=integrations"
                onClick={() => setIsMobileMenuOpen(false)}
                className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-md text-gray-300 hover:bg-custom-dark hover:text-white transition-colors"
              >
                <XPlatformIcon className="w-5 h-5" />
                <span>X</span>
              </Link>

              {/* Sign Out Button removed - now available in avatar dropdown */}
            </div>
          </div>
        )}
      </div>

      {/* Main Content Area - ADJUSTED */}
      <main
        className={`
          flex-grow relative z-20 mt-0 sm:mt-0 /* MODIFIED: mt-0 for mobile */
          transition-all duration-300 ease-in-out
          bg-custom-black
          ${isLeftSidebarExpanded ? 'sm:ml-60' : 'sm:ml-14'} sm:border-l sm:border-transparent custom-scrollbar
        `}
      >
        {/* --- Top Interactive Section --- */}
        <section className="flex flex-col items-center justify-center px-4 py-40 sm:py-16 md:py-24 text-center">
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-5xl font-bold mb-4">Clone any app in App Store, Fast.</h1> {/* Capped at lg:text-5xl */}
          <p className="text-base sm:text-lg text-gray-300 mb-8 sm:mb-12 max-w-xs sm:max-w-xl mx-auto">Dartivo builds complete, cross-platform mobile apps using AI and Flutter.</p>
          <div 
            className={`
              w-full max-w-md sm:max-w-xl md:max-w-3xl rounded-lg mb-8 sm:mb-10
            `}
          >
            <div 
              className={`
                w-full bg-zinc-900 rounded-3xl p-0 border border-gray-800 /* Changed border-gray-700 to border-gray-800 */
                ${isInputFocused ? 'cursor-text' : 'cursor-dartivo'}
              `}
            > 
              <VerticalSlidePlaceholder 
                currentHintText={currentHintText} 
                value={inputValue} 
                onChange={handleInputChange} 
                onFocus={handleFocus} 
                onBlur={handleBlur} 
                isFocused={isInputFocused} 
                ref={textareaRef}
                onKeyDown={handleTextareaKeyDown}
              />
              {/* Controls Container */}
              <div className="flex justify-between items-center px-4 pb-3 text-xs sm:text-sm">
                 <div className="flex items-center gap-3"> {/* Wrapper for left-side controls */}
                   {/* Attach file button on the left */}
                   <button
                     className="p-1 rounded-full bg-zinc-800 border border-gray-800 text-gray-300 hover:bg-zinc-700 hover:text-white transition-colors"
                     aria-label="Attach file"
                   >
                     <ImageIcon size={16} />
                   </button>
                   {/* New Clone Mode Toggle Button */}
                   <button
                     onClick={() => setIsCloneModeActive(!isCloneModeActive)}
                     className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs transition-colors
                       ${isCloneModeActive
                         ? 'bg-gradient-to-r from-sky-500 to-indigo-500 text-white hover:from-sky-600 hover:to-indigo-600'
                         : 'bg-zinc-800 border border-gray-800 text-gray-300 hover:bg-zinc-700 hover:text-white'}
                     `}
                     aria-pressed={isCloneModeActive}
                   >
                     <Copy size={14} />
                     {isCloneModeActive ? 'Cloning' : 'Clone'}
                   </button>
                 </div>
                 {/* Right-side controls: Visibility Dropdown + Send Button */}
                 <div className="flex items-center gap-3 relative"> {/* Added relative for dropdown positioning */}
                   {/* Visibility Dropdown Trigger Button */}
                   <button
                     onClick={() => setIsVisibilityMenuOpen(!isVisibilityMenuOpen)}
                     aria-label="Visibility options" // Added aria-label for click outside logic
                     className={`flex items-center gap-1.5 px-1.5 py-1 text-xs transition-colors focus:outline-none
                       ${isPublic 
                         ? 'text-white hover:text-gray-200' // Public is white, hover to light gray
                         : 'text-gray-400 hover:text-gray-200'}
                     `}
                   >
                     {isPublic ? <Globe size={14} /> : <Lock size={14} />}
                     {isPublic ? 'Public' : 'Private'}
                   </button>

                   {/* Visibility Dropdown Menu */}
                   {isVisibilityMenuOpen && (
                     <div
                       ref={visibilityMenuRef}
                       className="absolute top-full right-0 mt-2 w-64 bg-custom-black border border-custom-darker rounded-md shadow-xl z-10 py-1 px-1"
                     >
                       {/* Public Option */}
                       <button
                         onClick={() => { setIsPublic(true); setIsVisibilityMenuOpen(false); }}
                         className="w-full flex items-start text-left px-3 py-2.5 hover:bg-zinc-800 hover:rounded-md transition-colors"
                       >
                         <Globe size={18} className="mr-3 mt-0.5 text-gray-400 flex-shrink-0" />
                         <div>
                           <p className="text-sm font-medium text-white">Public</p>
                           <p className="text-xs text-gray-400">Anyone can view and remix</p>
                         </div>
                       </button>
                       {/* Private Option */}
                       <button
                         onClick={() => { setIsPublic(false); setIsVisibilityMenuOpen(false); }}
                         className="w-full flex items-start text-left px-3 py-2.5 hover:bg-zinc-800 hover:rounded-md transition-colors"
                       >
                         <Lock size={18} className="mr-3 mt-0.5 text-gray-400 flex-shrink-0" />
                         <div>
                           <div className="flex items-center">
                             <p className="text-sm font-medium text-white mr-1.5">Private</p>
                             <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-purple-600 text-white rounded-sm leading-none">PRO</span>
                           </div>
                           <p className="text-xs text-gray-400">Build and publish in private</p>
                         </div>
                       </button>
                     </div>
                   )}

                   {/* Send Button */}
                   <button
                     className="p-1.5 rounded-full bg-white hover:bg-gray-200 transition-colors disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                     aria-label="Send"
                     onClick={handleSend}
                     disabled={isSending || !inputValue.trim()}
                   >
                     {isSending ? (
                       <div className="w-[14px] h-[14px] border-2 border-black border-t-transparent rounded-full animate-spin" />
                     ) : (
                       <ArrowUp size={14} stroke="black" />
                     )}
                   </button>
                 </div>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap justify-center gap-2 sm:gap-3">
            {suggestionPrompts.map((text) => (
              <button
                key={text}
                className="bg-zinc-900 px-2 py-1 sm:px-3 sm:py-1.5 rounded-full text-[10px] sm:text-xs text-gray-400 hover:text-white border border-gray-800 hover:bg-zinc-800 transition-colors flex items-center" 
                onClick={() => setInputValue(text)}
              >
                {text}
                <ArrowUp size={12} className="ml-1.5" /> 
              </button>
            ))}
          </div>
          {/* Explore and Creations Text */}
          {/* 
          <p className="text-sm text-gray-500 text-center mt-4">
            Explore and Creations
          </p>
          */}

          {/* Segmented Control for Explore/Creations */}
          <div className="mt-12 mb-6 mx-auto"> {/* Changed mt-8 to mt-12 */}
            <SegmentedControl
              options={[
                { label: 'Explore', value: 'Explore', icon: Compass },
                { label: 'Creations', value: 'Creations', icon: LayoutGrid },
              ]}
              selectedValue={activeProjectView} // Changed prop name from value to selectedValue
              onChange={(val: string) => setActiveProjectView(val as 'Creations' | 'Explore')}
            />
          </div>

          {/* Your Projects Section - Grid Layout - Now visible for EITHER 'Creations' OR 'Explore' when logged in */}
          {currentUser && (activeProjectView === 'Creations' || activeProjectView === 'Explore') && (
            <div className="mt-12 mb-12 w-full max-w-4xl mx-auto px-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-8">
                {/* Placeholder Project 1 */}
                <div className="flex flex-col items-center">
                  <Image 
                    src="/app_project.png" 
                    alt="Project 1 Placeholder" 
                    width={270} /* Increased from 180 */
                    height={480} /* Increased from 320 */
                    className="rounded-3xl shadow-lg object-cover" /* Changed from rounded-2xl to rounded-3xl */
                  />
                </div>

                {/* Placeholder Project 2 */}
                <div className="flex flex-col items-center">
                  <Image 
                    src="/app_project.png" 
                    alt="Project 2 Placeholder" 
                    width={270} /* Increased from 180 */
                    height={480} /* Increased from 320 */
                    className="rounded-3xl shadow-lg object-cover" /* Changed from rounded-2xl to rounded-3xl */
                  />
                </div>

                {/* Placeholder Project 3 */}
                <div className="flex flex-col items-center">
                  <Image 
                    src="/app_project.png" 
                    alt="Project 3 Placeholder" 
                    width={270} /* Increased from 180 */
                    height={480} /* Increased from 320 */
                    className="rounded-3xl shadow-lg object-cover" /* Corrected to rounded-3xl */
                  />
                </div>
              </div>
            </div>
          )}

          {/* Placeholder for Explore View */}
          {currentUser && activeProjectView === 'Explore' && (
            <div className="mt-12 mb-12 w-full max-w-4xl mx-auto px-4 text-center">
              <p className="text-gray-400">Explore section content will go here. Feel free to suggest what you'd like to see!</p>
            </div>
          )}
        </section>

        {/* --- Conditionally Render Landing Page Sections --- */}
        {!currentUser && (
          <>
            {/* --- Gradient Divider --- */}
            

            {/* --- Target Audience Section --- */}
            

            {/* --- Testimonials Section --- */}
            

            {/* --- Gradient Divider (Testimonials/FAQ) --- */}
            

            {/* --- FAQ Section --- */}
            
          </>
        )}
        {/* --- End Conditional Landing Page Sections --- */}
      </main>

      {/* Footer */}
      <footer 
        className={`
          text-gray-400 text-xs sm:text-sm relative z-20 
          transition-all duration-300 ease-in-out 
          bg-custom-black 
          ${isLeftSidebarExpanded ? 'sm:ml-60' : 'sm:ml-14'} sm:border-l sm:border-transparent
        `}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <div className="flex flex-col sm:flex-row justify-center items-center gap-4"> {/* Changed justify-between to justify-center */}
             <div className="flex flex-row flex-wrap justify-center items-center gap-x-3 gap-y-2 mt-4 sm:mt-0"> {/* Now flex-row, wraps on mobile */}
               <a href="#" className="hover:text-white transition-colors flex items-center">
                 <FileText size={14} className="mr-1.5" />Terms
               </a>
               <a href="#" className="hover:text-white transition-colors flex items-center">
                 <Shield size={14} className="mr-1.5" />Privacy
               </a>
               <a href="#" className="hover:text-white transition-colors flex items-center">
                 <GalleryVertical size={14} className="mr-1.5" />Showcase
               </a>
               <a href="#" className="hover:text-white transition-colors flex items-center">
                 <Mail size={14} className="mr-1.5" />Contact
               </a>
             </div>
           </div>
         </div>
      </footer>

      {/* Sign Up Dialog */} 
      {showSignUpDialog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999]"> {/* MODIFIED: z-index to z-[9999] from z-60 */}
          <div className="bg-custom-black border border-custom-darker p-6 sm:p-8 rounded-lg shadow-xl max-w-sm w-full mx-4 relative">
            <button
              onClick={handleCloseDialog}
              className="absolute top-3 right-3 p-1 rounded-full text-gray-400 hover:bg-custom-dark hover:text-white transition-colors"
              aria-label="Close dialog"
            >
              <CloseIcon size={20} /> {/* Use imported CloseIcon */}
            </button>
            <h3 className="text-xl font-bold mb-4 text-center text-white">Continue with Google</h3>
            <p className="text-gray-300 mb-6 text-center text-sm sm:text-base">Sign in or create an account to save your work with Dartivo.</p>
            {/* Display Modal Error Message */} 
            {modalError && (
              <p className="text-red-400 bg-red-900/30 p-2 rounded-md text-sm text-center mb-4">{modalError}</p>
            )}
            <div className="flex flex-col space-y-3">
              {/* Only Google Button */} 
              <button 
                onClick={handleGoogleSignInFromModal}
                disabled={isGoogleLoading}
                className="w-full flex items-center justify-center px-4 py-2.5 border border-gray-700 rounded-md text-base font-medium text-white bg-zinc-900 hover:bg-zinc-800 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
              >
                <svg className="mr-2" width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  <path d="M1 1h22v22H1z" fill="none"/>
                </svg>
                {isGoogleLoading ? 'Signing in...' : 'Sign in with Google'}
                </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


