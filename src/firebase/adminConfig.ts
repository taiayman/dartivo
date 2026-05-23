import * as admin from 'firebase-admin';

// Removed unused ServiceAccount interface

let adminDb: admin.firestore.Firestore;
let adminStorage: admin.storage.Storage;

if (!admin.apps.length) {
  // Initialize Firebase Admin SDK
  console.log('Initializing Firebase Admin SDK...');

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY_JSON;

  if (!serviceAccountJson) {
    throw new Error('Firebase Admin SDK Error: FIREBASE_SERVICE_ACCOUNT_KEY_JSON environment variable is not set.');
  }

  try {
    // Parse the JSON but don't strictly type it as ServiceAccount here for the cert function
    const serviceAccount = JSON.parse(serviceAccountJson);

    // Ensure required fields exist for basic validation (optional but recommended)
    if (!serviceAccount.project_id || !serviceAccount.private_key || !serviceAccount.client_email) {
        throw new Error('Service account JSON is missing required fields (project_id, private_key, client_email).');
    }

    admin.initializeApp({
      // Pass the parsed object directly
      credential: admin.credential.cert(serviceAccount),
      // Specify the CORRECT storage bucket name
      storageBucket: 'uncursored-e2f36.firebasestorage.app'
      // Optional: Add your databaseURL if needed, though often inferred
      // databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`
    });

    adminDb = admin.firestore();
    adminStorage = admin.storage();
    console.log('Firebase Admin SDK initialized successfully.');

  } catch (error: unknown) { // Changed from any to unknown
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Firebase Admin SDK Initialization Error:", errorMessage);
    // Depending on your error handling strategy, you might want to re-throw
    // or handle this differently. For now, we'll throw to prevent proceeding without Admin SDK.
    throw new Error(`Firebase Admin SDK Initialization Failed: ${errorMessage}`);
  }

} else {
  // App already initialized, just get the instances
  adminDb = admin.app().firestore();
  adminStorage = admin.app().storage();
  console.log('Firebase Admin SDK already initialized.');
}

// Export the initialized Admin instances
export { adminDb, adminStorage }; 