'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { auth, db } from '@/firebase/config';
import { doc, getDoc, updateDoc, collection, query, where, getDocs, DocumentSnapshot } from 'firebase/firestore';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { UserCircle, Camera, CreditCard, Check, Hammer, DraftingCompass } from 'lucide-react';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import CustomMenuOverlay from '@/components/CustomMenuOverlay';

// Interface for user profile data
interface UserProfile {
  uid: string;
  username?: string;
  description?: string;
  link?: string;
  avatarUrl?: string;
  projects?: number;
  dailyMessagesRemaining?: string;
  email?: string;
}

// Default avatar if none is set
const DEFAULT_AVATAR = '/default-avatar.png';

const SettingsPage = () => {
  const [user, setUser] = useState<User | null>(null);
  const [profileData, setProfileData] = useState<UserProfile | null>(null);
  const [formData, setFormData] = useState<Partial<UserProfile>>({
    description: '',
    link: '',
    username: '',
    avatarUrl: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [currentSection, setCurrentSection] = useState('profile');
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // Fetch user and profile data
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        const userDocRef = doc(db, 'users', currentUser.uid);
        let docSnap: DocumentSnapshot | undefined;
        try {
          docSnap = await getDoc(userDocRef);
          if (docSnap.exists()) {
            const fetchedData = docSnap.data() as Omit<UserProfile, 'uid'>;
            const fullProfileData: UserProfile = {
              uid: currentUser.uid,
              username: fetchedData.username || currentUser.uid,
              avatarUrl: fetchedData.avatarUrl || currentUser.photoURL || DEFAULT_AVATAR,
              email: fetchedData.email || currentUser.email || '',
              description: fetchedData.description,
              link: fetchedData.link,
              projects: fetchedData.projects,
              dailyMessagesRemaining: fetchedData.dailyMessagesRemaining,
            };
            setProfileData(fullProfileData);
            setFormData({
              description: fullProfileData.description || '',
              link: fullProfileData.link || '',
              username: fullProfileData.username || '',
              avatarUrl: fullProfileData.avatarUrl || '',
            });
          } else {
             // Handle case where user exists in Auth but not Firestore
            console.warn("User document not found in Firestore for UID:", currentUser.uid);
            // Set basic profile from Auth data
             const basicProfile: UserProfile = {
               uid: currentUser.uid,
               username: currentUser.displayName || currentUser.email?.split('@')[0] || currentUser.uid,
               avatarUrl: currentUser.photoURL || DEFAULT_AVATAR,
               email: currentUser.email || '',
             };
             setProfileData(basicProfile);
             setFormData({
               username: basicProfile.username,
               avatarUrl: basicProfile.avatarUrl,
               description: '',
               link: '',
             });
          }
        } catch (err: unknown) {
          console.error("Error fetching user document:", err);
          setError("Failed to load profile data.");
        } finally {
          // Ensure loading is set to false regardless of try/catch outcome
          setLoading(false);
        }
      } else {
        setUser(null);
        setProfileData(null);
        setLoading(false);
        router.push('/signin');
      }
    });
    return () => unsubscribe();
  }, [router]);

  // Handle input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target; // type removed as it's not used

    // Clear username error when user types in username field
    if (name === 'username') {
      setUsernameError(null);
    }

    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  // Handle Save
  const handleSave = async () => {
    if (!user || !profileData) {
      setError("User or profile data not available.");
      return;
    }

    // Validate username format (basic example)
    const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/; // Letters, numbers, underscore, 3-20 chars
    if (formData.username && !usernameRegex.test(formData.username)) {
      setUsernameError("Username must be 3-20 characters and contain only letters, numbers, or underscores.");
      return;
    }

    setSaving(true);
    setError(null); // Clear general errors
    setUsernameError(null); // Clear username error

    const newUsername = formData.username?.trim();
    const currentUsername = profileData.username;
    let usernameAvailable = true;
    let usernameChanged = false;

    // Check for username uniqueness ONLY if it has changed
    if (newUsername && newUsername !== currentUsername) {
      usernameChanged = true;
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("username", "==", newUsername));
      try {
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          // Check if the found user is the current user (edge case if rules allowed it)
          if (querySnapshot.docs[0].id !== user.uid) {
             usernameAvailable = false;
          }
        }
      } catch (err: unknown) {
        console.error("Error checking username uniqueness:", err);
        setError("Failed to check username availability. Please try again.");
        setSaving(false);
        return;
      }
    }

    if (!usernameAvailable) {
      setUsernameError(`Username "${newUsername}" is already taken.`);
      setSaving(false);
      return;
    }

    // Proceed with saving if username is available or unchanged
    const userDocRef = doc(db, 'users', user.uid);
    try {
      const dataToUpdate: Partial<UserProfile> = {
        description: formData.description,
        link: formData.link,
        ...(usernameChanged && newUsername && { username: newUsername }),
      };

      await updateDoc(userDocRef, dataToUpdate);

      // Update local profile data state
      setProfileData(prev => prev ? { ...prev, ...dataToUpdate } : null);
      console.log("Profile updated successfully!");

      // Redirect if username was changed
      if (usernameChanged && newUsername) {
        // Add a small delay for feedback before redirecting (optional)
        // setTimeout(() => {
             router.push(`/user/${newUsername}`);
        // }, 500); 
      } else {
          // Add success feedback (e.g., toast notification) here if not redirecting
      }

    } catch (err: unknown) {
      console.error("Error updating profile:", err);
      setError("Failed to save changes. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // --- Start: Added handler for section change --- 
  const handleSectionChange = (newValue: string) => {
    setCurrentSection(newValue);
    // Future: Potentially clear errors or reset states when switching sections
    setError(null);
    setUsernameError(null);
  };
  // --- End: Added handler for section change --- 

  // Add the helper function back
  const getInitials = (name?: string) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      console.log('Signed out successfully');
    } catch (error: unknown) {
      console.error("Sign out error:", error);
      setError("Failed to sign out.");
    }
  };

  const getUserDisplayName = () => {
    if (profileData?.username && profileData.username !== user?.uid) return profileData.username; 
    if (!user) return 'User';
    return user.displayName || user.email?.split('@')[0] || 'User';
  };

  // --- Start: Added Menu Toggle Functions ---
  const handleOpenMenu = () => setIsMenuOpen(true);
  const handleCloseMenu = () => setIsMenuOpen(false);
  // --- End: Added Menu Toggle Functions ---

  // --- Start: Added File Upload Handlers ---
  const handleAvatarClick = () => {
    // Trigger the hidden file input click
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && user) {
      // Check file type (optional but recommended)
      if (!file.type.startsWith('image/')) {
          setError('Please select an image file.');
          return;
      }
      // Check file size (optional but recommended)
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
          setError('File size exceeds 5MB limit.');
          return;
      }
      
      uploadProfilePicture(file);
    }
    // Reset file input value so the same file can be selected again if needed
    event.target.value = ''; 
  };

  const uploadProfilePicture = (file: File) => {
    if (!user) return;

    const storage = getStorage();
    // Create a storage reference (e.g., avatars/userId/filename)
    // Using a fixed name like 'avatar.jpg' might be simpler if you always overwrite
    const storageRef = ref(storage, `avatars/${user.uid}/${file.name}`); 
    const uploadTask = uploadBytesResumable(storageRef, file);

    setUploading(true);
    setError(null);
    setUploadProgress(0);

    uploadTask.on('state_changed',
      (snapshot) => {
        // Observe state change events such as progress, pause, and resume
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        setUploadProgress(progress);
        console.log('Upload is ' + progress + '% done');
      },
      (error: unknown) => {
        // Handle unsuccessful uploads
        console.error("Upload failed:", error);
        setError("Failed to upload image. Please try again.");
        setUploading(false);
        setUploadProgress(0);
      },
      () => {
        // Handle successful uploads on complete
        getDownloadURL(uploadTask.snapshot.ref).then(async (downloadURL) => {
          console.log('File available at', downloadURL);
          // Update Firestore
          const userDocRef = doc(db, 'users', user.uid);
          try {
            await updateDoc(userDocRef, { avatarUrl: downloadURL });
            // Update local state to immediately show the new avatar
            setProfileData(prev => prev ? { ...prev, avatarUrl: downloadURL } : null);
            // Also update formData if it affects the display (it does via displayAvatar)
            setFormData(prev => ({ ...prev, avatarUrl: downloadURL })); 
            console.log("Avatar URL updated successfully!");
          } catch (firestoreError: unknown) {
            console.error("Error updating Firestore:", firestoreError);
            setError("Failed to save new avatar URL.");
          } finally {
            setUploading(false);
            setUploadProgress(0);
          }
        }).catch((urlError: unknown) => {
            console.error("Error getting download URL:", urlError);
            setError("Failed to get image URL after upload.");
            setUploading(false);
            setUploadProgress(0);
        });
      }
    );
  };
  // --- End: Added File Upload Handlers ---

  // Loading state
  if (loading) {
    return <div className="flex justify-center items-center min-h-screen bg-custom-black text-white">Loading...</div>;
  }

  // Error state
  if (error && !profileData) {
    return <div className="flex justify-center items-center min-h-screen bg-custom-black text-red-500">Error: {error}</div>;
  }

  // If user or profile data hasn't loaded yet (edge case after loading)
  if (!user || !profileData) {
    return <div className="flex justify-center items-center min-h-screen bg-custom-black text-white">Loading profile...</div>;
  }

  // Get display data safely
  const displayAvatar = profileData.avatarUrl || DEFAULT_AVATAR;
  const displayName = getUserDisplayName();

  return (
    <div className="min-h-screen flex flex-col relative bg-custom-black font-poppins text-white">
      {/* Header */}
      <header
        className={`
          sticky top-0 z-40 flex justify-between items-center py-4 px-4 sm:py-8 sm:px-6
          bg-gradient-to-b from-gray-400/20 via-gray-500/10 to-custom-black/0
          backdrop-blur-sm transition-shadow duration-300
          ${isScrolled ? 'border-b border-custom-darker shadow-md' : ''}
        `}
      >
        {/* Left side: Logo */}
        <div className="flex items-center space-x-3 sm:space-x-6">
          <Link href="/" className="flex items-center hover:opacity-80 transition-opacity">
            <Image
              src="/dartivo.png" // Updated logo path
              alt="Dartivo Logo" // Updated alt text
              width={28} 
              height={28} 
            />
            <span className="ml-2 text-lg font-bold font-poppins bg-gradient-to-t from-gray-400 to-white bg-clip-text text-transparent">
              Dartivo
            </span>
          </Link>
        </div>

        <div className="flex items-center space-x-4">
          {/* Profile Button to open Overlay */}
          <div className="relative inline-block text-left">
            <button 
              onClick={handleOpenMenu} // Open the overlay
              className="flex items-center justify-center w-10 h-10 rounded-full bg-custom-darker hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-custom-black focus:ring-indigo-500 transition"
              aria-label="Open user menu"
            >
              {displayAvatar !== DEFAULT_AVATAR ? (
                 <Image
                  src={displayAvatar}
                  alt={`${displayName}'s avatar`}
                  width={40}
                  height={40}
                  className="rounded-full object-cover"
                  key={displayAvatar} // Add key for potential re-render on change
                />
              ) : (
                <span className="text-md font-semibold text-gray-300">{getInitials(displayName)}</span>
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col overflow-y-auto pt-6">
        <div className="flex-1 p-6 sm:p-8 lg:p-10">

          {/* Usage Summary Section */}
          <div className="mb-8 pb-6">
             <h2 className="text-xl font-semibold text-white mb-2">{displayName}</h2>
             <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-6 space-y-2 sm:space-y-0 text-sm text-gray-400">
                <div>
                   <span className="font-medium text-white">{profileData.projects ?? 0}</span> projects
                 </div>
                 <div>
                   <span className="font-medium text-white">{profileData.dailyMessagesRemaining ?? '0/5'}</span> daily messages remaining
                 </div>
             </div>
             <p className="text-xs text-gray-500 mt-3">Daily messaging limit resets at midnight UTC</p>
          </div>

          {/* Full-Width Gradient Divider */}
          <div className="w-full h-px bg-gradient-to-r from-gray-700 via-gray-700 to-transparent mb-8"></div>

          {/* --- Start: Custom Segment Buttons --- */}
          <div className="mb-8 lg:max-w-3xl">
            <div className="flex items-center space-x-2 p-1 bg-custom-darker rounded-lg max-w-max"> {/* Added max-w-max to fit content */} 
              {/* Profile Settings Button */} 
              <button
                onClick={() => handleSectionChange('profile')}
                className={`flex items-center space-x-2 px-4 py-1.5 rounded-md text-sm transition-colors ${ 
                  currentSection === 'profile' 
                    ? 'bg-white text-gray-900 shadow-sm' 
                    : 'text-gray-400 hover:bg-gray-700 hover:text-white'
                }`}
              >
                <UserCircle className="h-5 w-5" />
                <span>Profile Settings</span>
              </button>
              {/* Plans & Billing Button */} 
              <button
                onClick={() => handleSectionChange('billing')}
                className={`flex items-center space-x-2 px-4 py-1.5 rounded-md text-sm transition-colors ${ 
                  currentSection === 'billing' 
                    ? 'bg-white text-gray-900 shadow-sm' 
                    : 'text-gray-400 hover:bg-gray-700 hover:text-white'
                }`}
              >
                <CreditCard className="h-5 w-5" />
                <span>Plans & Billing</span>
              </button>
            </div>
          </div>
          {/* --- End: Custom Segment Buttons --- */}

          {/* Conditional Rendering based on Section */}
          {currentSection === 'profile' && (
            /* Profile Settings Form - Removed container styling */
            /* Removed: bg-custom-darker p-6 sm:p-8 rounded-lg shadow-lg border border-gray-700 */
            <div className="w-full lg:max-w-3xl">
              {/* Avatar/Username Section */} 
              <div className="flex flex-col sm:flex-row items-center mb-8 pb-6 border-b border-gray-700">
                <div className="relative mr-0 sm:mr-5 mb-4 sm:mb-0 flex-shrink-0 group">
                  <button
                    type="button"
                    onClick={handleAvatarClick}
                    disabled={uploading} // Disable button while uploading
                    className={`w-20 h-20 rounded-full bg-custom-dark flex items-center justify-center shadow-md overflow-hidden ${uploading ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    {displayAvatar !== DEFAULT_AVATAR ? (
                      <Image
                        src={displayAvatar} // Uses state derived from profileData.avatarUrl
                        alt={`${displayName}'s avatar`}
                        width={80}
                        height={80}
                        className="rounded-full object-cover"
                        key={displayAvatar} // Add key to force re-render on change
                      />
                    ) : (
                      <span className="text-3xl font-semibold text-gray-400">{getInitials(displayName)}</span>
                    )}
                     {/* Edit Overlay */}
                     {!uploading && (
                       <div className="absolute inset-0 bg-black bg-opacity-50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                         <Camera className="w-6 h-6 text-white" />
                       </div>
                     )}
                     {/* Upload Progress Indicator */}
                     {uploading && (
                        <div className="absolute inset-0 bg-black bg-opacity-70 rounded-full flex items-center justify-center">
                            <div className="w-16 h-16 border-4 border-gray-600 border-t-white rounded-full animate-spin"></div>
                            <span className="absolute text-xs text-white">{Math.round(uploadProgress)}%</span> 
                        </div>
                    )}
                  </button>
                  {/* Hidden File Input */}
                  <input 
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/*" // Accept only image files
                    hidden // Keep the input visually hidden
                  />
                </div>
               <div className="flex-grow text-center sm:text-left">
                 <label htmlFor="username" className="block text-sm font-medium text-gray-400 mb-1">
                   Username
                 </label>
                 <input
                    type="text"
                    id="username"
                    name="username"
                    value={formData.username}
                    onChange={handleInputChange}
                    className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm bg-custom-dark text-white focus:outline-none focus:ring-1 focus:ring-gray-500 focus:border-gray-500 sm:text-sm ${usernameError ? 'border-red-500' : 'border-gray-600'}`}
                    aria-describedby="username-error"
                 />
                 {/* Display username error message */} 
                 {usernameError && (
                    <p id="username-error" className="mt-1 text-xs text-red-500">{usernameError}</p>
                 )}
                 {/* Optional: Add format guidance */}
                 {!usernameError && <p className="mt-1 text-xs text-gray-500">Must be 3-20 characters (letters, numbers, _).</p>} 
               </div>
              </div>
  
              {/* Form Fields Grid */} 
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-6">
                  {/* Description Field */}
                  <div className="md:col-span-2">
                    <label htmlFor="description" className="block text-sm font-medium text-gray-400">
                      Bio / Description
                    </label>
                    <textarea
                      id="description"
                      name="description"
                      rows={3}
                      value={formData.description}
                      onChange={handleInputChange}
                      placeholder="Tell us a bit about yourself..."
                      className="mt-1 block w-full px-3 py-2 border border-gray-600 rounded-md shadow-sm bg-custom-dark text-white focus:outline-none focus:ring-1 focus:ring-gray-500 focus:border-gray-500 sm:text-sm resize-none"
                    />
                  </div>
  
                  {/* Link Field */} 
                  <div className="md:col-span-2">
                    <label htmlFor="link" className="block text-sm font-medium text-gray-400">
                      Website Link
                    </label>
                    <div className="mt-1 flex rounded-md shadow-sm">
                       <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-600 bg-custom-darker text-gray-400 sm:text-sm">
                         https://
                       </span>
                      <input
                        type="text"
                        id="link"
                        name="link"
                        value={formData.link?.replace(/^https?:\/\//, '') || ''}
                        onChange={(e) => {
                             const value = e.target.value;
                             setFormData(prev => ({ ...prev, link: value ? `https://${value.replace(/^https?:\/\//, '')}` : '' }));
                        }}
                        placeholder="your-website.com"
                        className="flex-1 min-w-0 block w-full px-3 py-2 rounded-none rounded-r-md border border-gray-600 bg-custom-dark text-white focus:outline-none focus:ring-1 focus:ring-gray-500 focus:border-gray-500 sm:text-sm"
                      />
                    </div>
                  </div>
              </div>
  
              {/* Save Button Area - Removed top border classes */}
              <div className="mt-8 pt-6 flex justify-end items-center"> {/* Removed border-t border-gray-700 */} 
                {error && <p className="text-sm text-red-500 mr-4">{error}</p>}
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className={`inline-flex justify-center py-2 px-5 border border-transparent shadow-sm text-sm font-medium rounded-md ${saving ? 'bg-gray-300 text-gray-500' : 'bg-white hover:bg-gray-200 text-gray-900'} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-custom-darker focus:ring-gray-500 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed transition-colors`}
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          )}

          {currentSection === 'billing' && (
            /* Plans & Billing Section */
            <div className="w-full lg:max-w-3xl"> 
              <div className="flex flex-col md:flex-row gap-6"> 
 
                {/* Builder Plan Card ($20/month) - Updated UI */}
                <div className="flex-1 bg-custom-darker border border-gray-700 rounded-lg p-6 flex flex-col text-left shadow-lg">
                  {/* Header */} 
                  <div className="flex items-center mb-4">
                    <Hammer className="w-5 h-5 mr-2 text-gray-400" /> 
                    <h3 className="text-base font-semibold uppercase tracking-wide text-white">Builder</h3>
                  </div>
                  {/* Price */}
                  <div className="mb-4">
                    <span className="text-4xl font-bold text-white">$20</span>
                    <span className="text-base text-gray-400"> / month</span>
                  </div>
                  {/* Description */}
                  <p className="text-sm text-gray-300 mb-6">Good for starting out and personal projects.</p>
                  {/* Features */}
                  <ul className="text-sm text-gray-300 space-y-3 mb-8 flex-grow">
                    <li className="flex items-start">
                      <Check className="w-4 h-4 mr-2 mt-0.5 text-white flex-shrink-0" />
                      <span>Core features access</span>
                    </li>
                    <li className="flex items-start">
                      <Check className="w-4 h-4 mr-2 mt-0.5 text-white flex-shrink-0" />
                      <span>Standard processing speed</span>
                    </li>
                    <li className="flex items-start">
                      <Check className="w-4 h-4 mr-2 mt-0.5 text-white flex-shrink-0" />
                      <span>Community support</span>
                    </li>
                  </ul>
                  {/* Button */} 
                  <button 
                    className="mt-auto w-full bg-gray-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-500 transition-colors disabled:opacity-50"
                  >
                    Select Builder
                  </button>
                </div>
 
                {/* Architect Plan Card ($100/month) - Updated UI */}
                <div className="flex-1 bg-gradient-to-br from-gray-800 via-custom-darker to-custom-darker border border-gray-700 rounded-lg p-6 flex flex-col text-left shadow-lg">
                  {/* Header */} 
                  <div className="flex items-center mb-4">
                    <DraftingCompass className="w-5 h-5 mr-2 text-gray-400" /> 
                    <h3 className="text-base font-semibold uppercase tracking-wide text-white">Architect</h3> 
                  </div>
                  {/* Price */}
                  <div className="mb-4">
                    <span className="text-4xl font-bold text-white">$100</span>
                    <span className="text-base text-gray-400"> / month</span>
                  </div>
                   {/* Description */} 
                  <p className="text-sm text-gray-300 mb-6">Perfect for hobby and occasional use:</p> 
                  {/* Features */}
                  <ul className="text-sm text-gray-300 space-y-3 mb-8 flex-grow">
                    <li className="flex items-start">
                      <Check className="w-4 h-4 mr-2 mt-0.5 text-white flex-shrink-0" />
                      <span>Everything in Basic, plus:</span>
                    </li>
                    <li className="flex items-start">
                      <Check className="w-4 h-4 mr-2 mt-0.5 text-white flex-shrink-0" />
                      <span>Go beyond daily limits with a monthly limit</span> 
                    </li>
                    <li className="flex items-start">
                      <Check className="w-4 h-4 mr-2 mt-0.5 text-white flex-shrink-0" />
                      <span>Unlimited private projects</span>
                    </li>
                    <li className="flex items-start">
                      <Check className="w-4 h-4 mr-2 mt-0.5 text-white flex-shrink-0" />
                      <span>Custom domains</span> 
                    </li>
                  </ul>
                  {/* Button */} 
                  <button 
                    className="mt-auto w-full bg-white text-gray-900 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-200 transition-colors"
                  >
                    Select Architect
                  </button>
                </div>
 
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="bg-custom-black text-gray-400 text-xs sm:text-sm border-t border-custom-darker mt-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
               <p>&copy; {new Date().getFullYear()} Dartivo. All rights reserved.</p> {/* Updated copyright */}
               <div className="flex flex-col sm:flex-row items-center sm:space-x-6 gap-2 sm:gap-0 mt-4 sm:mt-0">
                 <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
                 <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
                 <a href="#" className="hover:text-white transition-colors">Contact</a>
               </div>
             </div>
           </div>
        </footer>
      </main>

      {/* Custom Menu Overlay */}
      {user && profileData && (
        <CustomMenuOverlay 
          isOpen={isMenuOpen}
          onClose={handleCloseMenu}
          userName={displayName}
          userEmail={user.email ?? undefined}
          userAvatarUrl={displayAvatar}
          userProfileUrl={(profileData.username && profileData.username !== user.uid) ? `/user/${profileData.username}` : undefined} 
          onSignOut={handleSignOut}
          isLoading={loading || saving}
          hideSettingsLink={true}
        />
      )}
    </div>
  );
};

export default SettingsPage;