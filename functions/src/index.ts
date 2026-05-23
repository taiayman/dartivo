// functions/src/index.ts
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
// You might need to explicitly import 'Readable' if using older Node/TS versions
// import { Readable } from 'stream';
import * as unzipper from "unzipper"; // Library for unzipping
import { onDocumentCreated } from "firebase-functions/v2/firestore"; // Import v2 trigger

// Initialize Firebase Admin SDK
admin.initializeApp();
const storage = admin.storage();
// const firestore = admin.firestore(); // Removed unused variable

// --- Configuration ---
// *** CHANGE THIS LINE *** Path to the Flutter template zip file
const TEMPLATE_ZIP_PATH = "project-templates/flutter_default.zip"; // <--- CHANGE THIS
// Base path in Cloud Storage where project files should be stored
const PROJECT_FILES_BASE_PATH = "projects";
// Collection name in Firestore that triggers the function
const FIRESTORE_PROJECT_COLLECTION = "projects";
// Field name in Firestore document to update with status
const FIRESTORE_STATUS_FIELD = "templateInitStatus"; // e.g., 'pending', 'completed', 'error'
const FIRESTORE_ERROR_FIELD = "templateInitError";

/**
 * Cloud Function triggered when a new document is created in the
 * specified Firestore project collection (using v2 syntax). Downloads a template zip
 * from Cloud Storage, unzips it, and uploads the contents to
 * a project-specific path in Cloud Storage.
 */
export const initializeFlutterProjectV2 = onDocumentCreated(
  `${FIRESTORE_PROJECT_COLLECTION}/{projectId}`,
  async (event) => {
    // Get data from the event object
    const snapshot = event.data; // The DocumentSnapshot
    const context = event.params; // The parameters (like projectId)

    // Check if snapshot exists (it always should for onCreate)
    if (!snapshot) {
        functions.logger.error("No data associated with the event");
        console.error("[CONSOLE-ERROR] No data associated with the event - from console.error"); // CONSOLE LOG
        return;
    }

    const projectId = context.projectId;
    const projectDocRef = snapshot.ref; // Reference to the triggering document

    // Log bucket name very early
    const earlyBucket = admin.storage().bucket();
    const earlyBucketName = earlyBucket.name; // Get name first
    functions.logger.info(`[V2-DEBUG] Bucket name at function start: ${earlyBucketName} for project ${projectId}`);
    console.log(`[CONSOLE-LOG] Bucket name at function start: ${earlyBucketName} for project ${projectId}`); // CONSOLE LOG

    functions.logger.info(`[V2] Initializing Flutter files for project: ${projectId}`);
    console.log(`[CONSOLE-LOG] Initializing Flutter files for project: ${projectId}`); // CONSOLE LOG

    try {
      // Log bucket name again inside the main try block before its use
      const bucket = storage.bucket(); // Ensure bucket is defined in this scope
      const tryBucketName = bucket.name; // Get name first
      functions.logger.info(`[V2-DEBUG] Bucket name inside TRY block: ${tryBucketName} for project ${projectId}`);
      console.log(`[CONSOLE-LOG] Bucket name inside TRY block: ${tryBucketName} for project ${projectId}`); // CONSOLE LOG

      // Set initial status in Firestore (moved here to be part of main try-catch)
      try {
        await projectDocRef.set({ [FIRESTORE_STATUS_FIELD]: "pending" }, { merge: true });
      } catch (statusError) {
        functions.logger.error("[V2] Error setting initial pending status:", statusError);
        // If setting pending status fails, we might still want to proceed or handle error differently
      }

      const templateZipFile = bucket.file(TEMPLATE_ZIP_PATH); // Uses the updated path

      // 1. Check if template file exists
      const [exists] = await templateZipFile.exists();
      if (!exists) {
        // *** IMPORTANT: Ensure flutter_default.zip exists at this path in GCS! ***
        const errorMessage = `Flutter template file not found at gs://${bucket.name}/${TEMPLATE_ZIP_PATH}. Please upload it.`;
        functions.logger.error(`[V2] ${errorMessage}`);
        await projectDocRef.set({ [FIRESTORE_STATUS_FIELD]: "error", [FIRESTORE_ERROR_FIELD]: errorMessage }, { merge: true });
        return;
      }

      // 2. Download template buffer (consider memory limits for huge templates)
      const zipBuffer = await templateZipFile.download().then(data => data[0]);
      const centralDirectory = await unzipper.Open.buffer(zipBuffer);
      const uploadPromises: Promise<void>[] = [];
      let fileCount = 0;

      functions.logger.info(`[V2] Found ${centralDirectory.files.length} entries in template zip.`);

      // 4. Process each entry (file/directory) in the zip
      for (const entry of centralDirectory.files) {
        const entryPath = entry.path;
        const entryType = entry.type;

        const destinationPath = `${PROJECT_FILES_BASE_PATH}/${projectId}/files/${entryPath}`;

        if (entryType === "File") {
          fileCount++;
          functions.logger.debug(`[V2] Processing file: ${entryPath} -> ${destinationPath}`);

          const destinationFile = bucket.file(destinationPath);

          const uploadPromise = new Promise<void>((resolve, reject) => {
              const entryStream = entry.stream();
              entryStream
                .pipe(destinationFile.createWriteStream({ resumable: false }))
                .on("error", (err) => {
                  functions.logger.error(`[V2] Error uploading ${destinationPath}:`, err);
                  reject(err);
                })
                .on("finish", () => {
                  functions.logger.debug(`[V2] Finished uploading ${destinationPath}`);
                  resolve();
                });
          });
          uploadPromises.push(uploadPromise);

        } else if (entryType === "Directory") {
            functions.logger.debug(`[V2] Skipping directory entry: ${entryPath}`);
        } else {
            functions.logger.warn(`[V2] Skipping unknown entry type: ${entryType} for path: ${entryPath}`);
        }
      }

      // 5. Wait for all file upload promises to settle
      const results = await Promise.allSettled(uploadPromises);

      const failedUploads = results.filter(result => result.status === 'rejected');
      if (failedUploads.length > 0) {
          const errorMessage = `${failedUploads.length} file(s) failed to upload. Check function logs.`;
          functions.logger.error(`[V2] ${errorMessage}`, { failedUploads });
          await projectDocRef.set({ [FIRESTORE_STATUS_FIELD]: "error", [FIRESTORE_ERROR_FIELD]: errorMessage }, { merge: true });
          return;
      }

      functions.logger.info(`[V2] Successfully initialized ${fileCount} Flutter files for project: ${projectId}`);

      // 6. Update Firestore document to indicate completion
      await projectDocRef.set({
        [FIRESTORE_STATUS_FIELD]: "completed",
        fileCount: fileCount,
        [FIRESTORE_ERROR_FIELD]: null,
      }, { merge: true });

      functions.logger.info(`[V2] Firestore status updated to 'completed' for ${projectId}. Attempting to create sentinel file.`);

      // 7. Create a sentinel file in GCS to signal true completion of GCS operations
      const sentinelFilePath = `${PROJECT_FILES_BASE_PATH}/${projectId}/_INITIALIZATION_COMPLETE.txt`;
      functions.logger.info(`[V2] Defined sentinel file path: ${sentinelFilePath} for ${projectId}.`);

      const sentinelFile = bucket.file(sentinelFilePath);
      functions.logger.info(`[V2] Created GCS file object for sentinel: ${sentinelFile.name} for ${projectId}.`);

      try {
        functions.logger.info(`[V2] Entering TRY block to save sentinel file for ${projectId}.`);
        await sentinelFile.save("Initialization complete.", {
          contentType: "text/plain",
          resumable: false
        });
        functions.logger.info(`[V2] Successfully created sentinel file at: ${sentinelFilePath}`);
      } catch (sentinelError) {
        functions.logger.warn(`[V2] CRITICAL WARNING: Failed to create sentinel file for project ${projectId} at ${sentinelFilePath}. This might cause issues with build triggering. Error:`, sentinelError);
      }

      functions.logger.info(`[V2] Reached end of sentinel file creation block for ${projectId}.`);

      // 8. *** REMOVED: Copy pre-built default application ***
      // This section copied the pre-built React app. We remove it so
      // that the preview only shows what's actually built by Cloud Build.
      functions.logger.info(`[V2] Skipping pre-built file copy for project ${projectId}.`);
      /*
      const prebuiltSourcePrefix = "project-templates/react_default_prebuilt/"; // <--- REMOVE or change if you have pre-built Flutter
      const projectBuildDestinationPrefix = `${PROJECT_FILES_BASE_PATH}/${projectId}/build/`;
      functions.logger.info(`[V2] Attempting to copy pre-built files from gs://${bucket.name}/${prebuiltSourcePrefix} to gs://${bucket.name}/${projectBuildDestinationPrefix} for project ${projectId}`);

      try {
        const [prebuiltFiles] = await bucket.getFiles({ prefix: prebuiltSourcePrefix });
        if (prebuiltFiles.length === 0) {
          functions.logger.warn(`[V2] No files found in pre-built template path: gs://${bucket.name}/${prebuiltSourcePrefix}. Skipping pre-built copy for project ${projectId}.`);
        } else {
          const copyPromises = prebuiltFiles.map(file => {
            // Ensure we don't try to copy the directory placeholder itself if it appears as a file
            if (file.name === prebuiltSourcePrefix && file.name.endsWith('/')) {
              return Promise.resolve();
            }
            const relativePath = file.name.substring(prebuiltSourcePrefix.length);
            const destinationPath = `${projectBuildDestinationPrefix}${relativePath}`;
            functions.logger.debug(`[V2] Copying pre-built file: ${file.name} -> ${destinationPath}`);
            return file.copy(bucket.file(destinationPath));
          });
          await Promise.all(copyPromises);
          functions.logger.info(`[V2] Successfully copied ${prebuiltFiles.length} pre-built files to ${projectBuildDestinationPrefix} for project ${projectId}`);
        }
      } catch (prebuiltCopyError) {
        functions.logger.error(`[V2] Error copying pre-built files for project ${projectId}. This will prevent instant preview. Error:`, prebuiltCopyError);
        // Not updating Firestore status to error, as source files and sentinel are okay.
        // The build can still be triggered manually.
      }
      */ // <--- End of removed section

    } catch (error: any) {
      functions.logger.error(`[V2] Critical error initializing project ${projectId}:`, error);
      await projectDocRef.set({
        [FIRESTORE_STATUS_FIELD]: "error",
          [FIRESTORE_ERROR_FIELD]: error.message || "Unknown initialization error"
      }, { merge: true });
    }
  });