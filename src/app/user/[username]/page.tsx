'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { collection, query, where, getDocs } from "firebase/firestore";
import { onAuthStateChanged, User } from "firebase/auth";
import { db, auth } from '@/firebase/config';
import { Settings as SettingsIcon } from 'lucide-react';
// import { useRouter } from 'next/navigation'; // Removed as router variable is commented out

// Define a type for the user data we expect from Firestore
interface UserData {
  uid: string;
  displayName?: string;
  email?: string;
  photoURL?: string; // Optional profile picture URL
  name?: string;
  description?: string;
  location?: string;
  link?: string;
  username?: string;
  avatarUrl?: string;
  hideProfilePicture?: boolean;
}

// Define the expected params shape
interface UserProfileParams {
  username: string;
}

// Default avatar if none is set
// const DEFAULT_AVATAR = '/default-avatar.png'; // Unused

// Type the component props to expect a Promise
export default function UserProfilePage({ params }: { params: Promise<UserProfileParams> }) {
  // Pass the params prop (which is a Promise) directly to use()
  // Type the result of the hook
  const resolvedParams: UserProfileParams = use(params);
  
  // State to hold the username from params
  // Initialize state directly from resolvedParams
  const [targetUsername] = useState<string | null>(resolvedParams.username);
  const [profileUserData, setProfileUserData] = useState<UserData | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loadingAuthState, setLoadingAuthState] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // const router = useRouter(); // Unused, so commented out

  // Get current authenticated user
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setLoadingAuthState(false);
    });
    return () => unsubscribe();
  }, []);

  // Effect to handle scroll for UI changes (e.g., sticky header)
  useEffect(() => {
    const handleScroll = () => {
      // setIsScrolled(window.scrollY > 10); // isScrolled is currently unused
    };
    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // Fetch profile user data from Firestore using username
  useEffect(() => {
    if (!targetUsername) return;

    const fetchUserDataByUsername = async () => {
      setLoadingData(true);
      setError(null);
      const usersRef = collection(db, "users");
      // Create a query against the collection.
      const q = query(usersRef, where("username", "==", targetUsername));

      try {
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          // Assuming username is unique, get the first doc.
          // Add error handling if multiple docs are found unexpectedly.
          if (querySnapshot.size > 1) {
             console.warn(`Multiple users found with username: ${targetUsername}`);
             // Decide how to handle this - maybe show an error or take the first?
          }
          const userDoc = querySnapshot.docs[0];
          const fetchedData = userDoc.data() as UserData;
          setProfileUserData({
            ...fetchedData,
            uid: userDoc.id, // Store the actual UID from the found document
            // Ensure name and avatarUrl fallbacks are handled
            name: fetchedData.name || fetchedData.displayName,
            avatarUrl: fetchedData.avatarUrl || fetchedData.photoURL,
          });
        } else {
          console.log(`No user document found for username: ${targetUsername}`);
          setProfileUserData(null);
          setError(`User profile not found for username: ${targetUsername}`);
        }
      } catch (err) {
        console.error("Error fetching user data by username:", err);
        setProfileUserData(null);
        setError("Failed to load profile data.");
      } finally {
        setLoadingData(false);
      }
    };

    fetchUserDataByUsername();
  }, [targetUsername]); // Depend on targetUsername

  const getInitials = (name?: string) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  };

  // Check if the current user is viewing their own profile
  const isOwnProfile = currentUser && profileUserData && currentUser.uid === profileUserData.uid;

  // Loading States - Check targetUsername instead of resolvedUserId
  if (loadingAuthState || !targetUsername) {
    return <div className="min-h-screen flex items-center justify-center bg-custom-black text-white"><p>Loading...</p></div>;
  }

  return (
    <div className="min-h-screen flex flex-col relative font-poppins bg-custom-black text-gray-300">
      {/* Header */} 
      <header className="sticky top-0 z-30 w-full bg-custom-black/70 backdrop-blur-sm border-b border-custom-darker">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo and Title */}
            <div className="flex-shrink-0 flex items-center space-x-2">
              <Link href="/" passHref>
                <Image src="/dartivo.png" alt="Dartivo Logo" width={28} height={28} priority />
          </Link>
              <span className="font-semibold text-white">Dartivo</span>
        </div>

            {/* Right side buttons/menu */}
        {currentUser ? (
          <Link 
            href="/settings" 
            className="p-2 rounded-full text-gray-300 hover:bg-custom-dark hover:text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-custom-black focus:ring-indigo-500 transition-colors"
            aria-label="Settings"
          >
            <SettingsIcon size={20} />
          </Link>
        ) : !loadingAuthState && (
          <Link href="/signin" className="px-4 py-2 rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors">
            Sign In
          </Link>
        )}
          </div>
        </div>
      </header>

      {/* Profile Content Area - Adjusted padding */}
      <main className="flex-grow flex flex-col items-center w-full max-w-2xl mx-auto pt-10 px-4 sm:px-0">
        {loadingData ? (
          <p className="text-gray-400">Loading profile data...</p>
        ) : error ? (
          <p className="text-red-500">{error}</p>
        ) : profileUserData ? (
          <>
            {/* Profile Picture */}
            <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-custom-dark flex items-center justify-center mb-4 shadow-md">
              {profileUserData.avatarUrl && !profileUserData.hideProfilePicture ? (
                <Image src={profileUserData.avatarUrl} alt="Profile Picture" width={128} height={128} className="rounded-full object-cover" />
              ) : (
                <span className="text-4xl sm:text-5xl font-semibold text-gray-400">{getInitials(profileUserData.name || profileUserData.displayName)}</span>
              )}
            </div>

            {/* Display Name */}
            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">{profileUserData.name || profileUserData.displayName || 'Unnamed User'}</h1>

            {/* Username - Display the targetUsername from URL/state */}
            <p className="text-gray-400 text-sm mb-2">@{profileUserData.username || targetUsername}</p>

            {/* Email (Optional: maybe hide unless own profile?) */}
            {isOwnProfile && profileUserData.email && (
              <p className="text-gray-400 text-sm mb-4">{profileUserData.email}</p>
            )}

            {/* Description */}
            {profileUserData.description && (
              <p className="text-gray-300 text-center max-w-lg mb-4">{profileUserData.description}</p>
            )}

            {/* Location & Link */}
            <div className="flex items-center space-x-4 text-gray-400 text-sm mb-6">
              {profileUserData.location && <span>{profileUserData.location}</span>}
              {profileUserData.location && profileUserData.link && <span>&middot;</span>}
              {profileUserData.link && (
                <a href={profileUserData.link} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 transition-colors">
                  {profileUserData.link.replace(/^https?:\/\//, '')}
                </a>
              )}
            </div>

            {/* Edit Profile Button (Conditional) */}
            {isOwnProfile && (
              <Link 
                href="/settings" 
                className="bg-custom-dark px-5 py-2 rounded-md text-sm font-medium hover:bg-opacity-80 transition-colors text-gray-300 border border-gray-600"
              >
                Edit profile
              </Link>
            )}

            {/* Updated Divider */}
            <div className="w-full h-px bg-gradient-to-r from-transparent via-gray-700 to-transparent my-8 sm:my-10"></div>

            {/* Projects Section Placeholder */}
            <div className="w-full">
              <h2 className="text-xl font-semibold mb-4 text-center text-gray-400">Projects</h2>
              <div className="bg-custom-darker rounded-lg h-64 flex items-center justify-center text-gray-500">
                [User&apos;s projects will appear here]
              </div>
            </div>
          </>
        ) : (
          <p className="text-gray-400">User profile could not be loaded.</p>
        )}
      </main>
    </div>
  );
} 