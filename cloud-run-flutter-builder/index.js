const express = require('express');
const shell = require('shelljs');
const fs = require('fs-extra');
const path = require('path');
const { Storage } = require('@google-cloud/storage'); // Import GCS client

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;
const BUCKET_NAME = process.env.GCS_BUCKET_NAME;

if (!BUCKET_NAME) {
    console.error('GCS_BUCKET_NAME environment variable is not set.');
    process.exit(1);
}

const storage = new Storage();
const bucket = storage.bucket(BUCKET_NAME);

const PUB_CACHE_GCS_DIR = 'cache/'; // Pub cache will be stored in gs://[BUCKET_NAME]/cache/
const PUB_CACHE_GCS_FILENAME = 'flutter_pub_cache.tar.gz';
const PUB_CACHE_GCS_PATH = `${PUB_CACHE_GCS_DIR}${PUB_CACHE_GCS_FILENAME}`;
const LOCAL_PUB_CACHE_DIR = process.env.PUB_CACHE || '/opt/.pub-cache'; // From Dockerfile ENV
const LOCAL_PUB_CACHE_TARBALL = path.join('/tmp', PUB_CACHE_GCS_FILENAME);

const MAX_DOWNLOAD_ATTEMPTS = 3; // Reduced for GCS client library, should be more reliable
const RETRY_DELAY_MS = 3000;

async function downloadDirectory(gcsDirectoryPath, localDestination) {
    console.log(`Attempting to download directory from GCS: ${gcsDirectoryPath} to ${localDestination}`);
    await fs.ensureDir(localDestination);
    const [files] = await bucket.getFiles({ prefix: gcsDirectoryPath });

    if (files.length === 0) {
        console.warn(`No files found in GCS at prefix: ${gcsDirectoryPath}`);
        return false; // Indicate no files found
    }

    console.log(`Found ${files.length} files in ${gcsDirectoryPath}. Starting download...`);
    for (const file of files) {
        const localFilePath = path.join(localDestination, path.relative(gcsDirectoryPath, file.name));
        if (file.name.endsWith('/')) { // Skip directory pseudo-files if GCS lists them
            await fs.ensureDir(localFilePath);
            continue;
        }
        await fs.ensureDir(path.dirname(localFilePath));
        try {
            await bucket.file(file.name).download({ destination: localFilePath });
            console.log(`Downloaded: ${file.name} to ${localFilePath}`);
        } catch (error) {
            console.error(`Failed to download ${file.name}:`, error);
            throw error; // Propagate error to be caught by retry logic
        }
    }
    console.log(`Successfully downloaded all files from ${gcsDirectoryPath} to ${localDestination}`);
    return true; // Indicate success
}

async function uploadDirectory(localDirectoryPath, gcsDestinationDirectoryPath) {
    console.log(`Attempting to upload directory from ${localDirectoryPath} to GCS: ${gcsDestinationDirectoryPath}`);
    const files = await fs.readdir(localDirectoryPath);
    if (files.length === 0) {
        console.warn(`No files found in local directory: ${localDirectoryPath} to upload.`);
        return;
    }
    console.log(`Found ${files.length} files in ${localDirectoryPath}. Starting upload...`);

    for (const file of files) {
        const localFilePath = path.join(localDirectoryPath, file);
        const gcsFilePath = path.join(gcsDestinationDirectoryPath, file).replace(/\\/g, '/'); // Ensure forward slashes for GCS

        const stat = await fs.stat(localFilePath);
        if (stat.isDirectory()) {
            await uploadDirectory(localFilePath, gcsFilePath); // Recurse for subdirectories
        } else {
            try {
                await bucket.upload(localFilePath, {
                    destination: gcsFilePath,
                    resumable: true, // Good for larger files
                });
                console.log(`Uploaded: ${localFilePath} to gs://${BUCKET_NAME}/${gcsFilePath}`);
            } catch (error) {
                console.error(`Failed to upload ${localFilePath}:`, error);
                throw error; // Propagate error
            }
        }
    }
    console.log(`Successfully uploaded all files from ${localDirectoryPath} to ${gcsDestinationDirectoryPath}`);
}


async function downloadAndExtractPubCache() {
    console.log('Attempting to download and extract Flutter PUB_CACHE from GCS...');
    try {
        const [fileExists] = await bucket.file(PUB_CACHE_GCS_PATH).exists();
        if (!fileExists) {
            console.log(`PUB_CACHE tarball (${PUB_CACHE_GCS_PATH}) not found in GCS. Skipping download. A new one will be created if build is successful.`);
            await fs.ensureDir(LOCAL_PUB_CACHE_DIR); // Ensure it exists even if empty
            return;
        }

        console.log(`Downloading ${PUB_CACHE_GCS_PATH} to ${LOCAL_PUB_CACHE_TARBALL}...`);
        await bucket.file(PUB_CACHE_GCS_PATH).download({ destination: LOCAL_PUB_CACHE_TARBALL });
        console.log('PUB_CACHE tarball downloaded. Extracting...');
        
        await fs.ensureDir(LOCAL_PUB_CACHE_DIR); // Ensure target directory exists
        shell.rm('-rf', path.join(LOCAL_PUB_CACHE_DIR, '*')); // Clear out the local cache dir before extracting

        const tarExtractResult = shell.exec(`tar -xzf ${LOCAL_PUB_CACHE_TARBALL} -C ${LOCAL_PUB_CACHE_DIR}`);
        if (tarExtractResult.code !== 0) {
            console.error('Failed to extract PUB_CACHE tarball:', tarExtractResult.stderr);
            throw new Error('PUB_CACHE extraction failed.');
        }
        console.log('PUB_CACHE extracted successfully.');
        shell.rm('-f', LOCAL_PUB_CACHE_TARBALL); // Clean up local tarball
    } catch (error) {
        console.error('Error during PUB_CACHE download/extraction:', error);
        // Don't let this fail the whole build, Flutter will fetch packages, just slower.
        console.warn('Proceeding without pre-warmed PUB_CACHE.');
        await fs.ensureDir(LOCAL_PUB_CACHE_DIR); // Ensure it exists for Flutter to use
    }
}

async function compressAndUploadPubCache() {
    console.log('Attempting to compress and upload Flutter PUB_CACHE to GCS...');
    if (!fs.existsSync(LOCAL_PUB_CACHE_DIR) || fs.readdirSync(LOCAL_PUB_CACHE_DIR).length === 0) {
        console.log('Local PUB_CACHE directory is empty or does not exist. Skipping upload.');
        return;
    }

    console.log(`Compressing ${LOCAL_PUB_CACHE_DIR} to ${LOCAL_PUB_CACHE_TARBALL}...`);
    // Ensure the parent directory of the tarball exists
    await fs.ensureDir(path.dirname(LOCAL_PUB_CACHE_TARBALL));
    // Use * within the directory to avoid including the directory itself in the tarball path
    const tarCreateResult = shell.exec(`tar -czf ${LOCAL_PUB_CACHE_TARBALL} -C ${LOCAL_PUB_CACHE_DIR} .`);
    if (tarCreateResult.code !== 0) {
        console.error('Failed to create PUB_CACHE tarball:', tarCreateResult.stderr);
        throw new Error('PUB_CACHE compression failed.'); // This is a more critical error
    }
    console.log('PUB_CACHE compressed. Uploading...');

    try {
        await bucket.upload(LOCAL_PUB_CACHE_TARBALL, {
            destination: PUB_CACHE_GCS_PATH,
            resumable: true
        });
        console.log(`PUB_CACHE uploaded to ${PUB_CACHE_GCS_PATH}`);
        shell.rm('-f', LOCAL_PUB_CACHE_TARBALL); // Clean up local tarball
    } catch (error) {
        console.error(`Failed to upload PUB_CACHE tarball to ${PUB_CACHE_GCS_PATH}:`, error);
        // If upload fails, we don't want to fail the current build, but log it.
        console.warn('PUB_CACHE upload failed. Subsequent builds might be slower.');
    }
}

app.post('/build', async (req, res) => {
    const { projectId, projectType, baseHref, buildCommand: customBuildCommand } = req.body;

    // Log the entire request body to see what was received
    console.log(`Received request body: ${JSON.stringify(req.body)}`);

    if (!projectId) {
        return res.status(400).json({ error: 'Project ID is required' });
    }

    const uniqueId = `${projectId}_${Date.now()}`;
    const localBaseProjectPath = path.join('/tmp', uniqueId);
    const localProjectFilesPath = path.join(localBaseProjectPath, 'source');
    const gcsProjectFilesPath = `projects/${projectId}/files/`; // Ensure trailing slash for prefix matching
    let localBuildDir;
    let gcsBuildOutputDir;

    console.log(`Received build request for projectId: ${projectId}`);

    try {
        await fs.ensureDir(localProjectFilesPath);
        console.log(`Created temporary base directory: ${localBaseProjectPath}`);

        // --- Download Source Files --- 
        let downloadSuccess = false;
        for (let attempt = 1; attempt <= MAX_DOWNLOAD_ATTEMPTS; attempt++) {
            console.log(`Download attempt ${attempt}/${MAX_DOWNLOAD_ATTEMPTS} for project ${projectId} from ${gcsProjectFilesPath}...`);
            try {
                if (await downloadDirectory(gcsProjectFilesPath, localProjectFilesPath)) {
                    downloadSuccess = true;
                    console.log('Project files downloaded successfully.');
                    break;
                }
                // If downloadDirectory returned false (no files), it's not an error to retry yet.
                // But if it threw an error, it would be caught by the catch block below.
            } catch (error) {
                console.error(`Error during download attempt ${attempt}:`, error);
                if (attempt === MAX_DOWNLOAD_ATTEMPTS) throw error; // Rethrow on last attempt
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
            }
            // If downloadDirectory returned false (no files) and it was the last attempt
            if (!downloadSuccess && attempt === MAX_DOWNLOAD_ATTEMPTS) {
                 console.error(`Failed to download project files after ${MAX_DOWNLOAD_ATTEMPTS} attempts: No files found or persistent error.`);
                 throw new Error('GCS download failed: No files found or persistent error after retries.');
            }
        }

        if (!downloadSuccess) {
            // This should ideally be caught by the loop's throw on last attempt
            throw new Error('Failed to download project files from GCS.');
        }

        // Determine project type locally by checking for pubspec.yaml
        const isFlutterProjectActual = fs.existsSync(path.join(localProjectFilesPath, 'pubspec.yaml'));
        console.log(`Locally determined isFlutterProjectActual: ${isFlutterProjectActual} (path checked: ${path.join(localProjectFilesPath, 'pubspec.yaml')})`);

        if (isFlutterProjectActual) { // Use the locally determined flag
            console.log("Detected Flutter project (local check). Running Flutter build process...");
            localBuildDir = path.join(localProjectFilesPath, 'build', 'web');
            gcsBuildOutputDir = `projects/${projectId}/build/`;

            // --- PUB CACHE HANDLING (Download) ---
            await downloadAndExtractPubCache();
            
            console.log("Running 'flutter clean'...");
            const cleanResult = shell.exec('flutter clean', { cwd: localProjectFilesPath, silent: false });
            if (cleanResult.code !== 0) {
                console.error(`flutter clean failed: ${cleanResult.stderr}`);
                throw new Error(`Flutter clean failed: ${cleanResult.stderr}`);
            }

            console.log("Running 'flutter pub get'...");
            const pubGetResult = shell.exec('flutter pub get', { cwd: localProjectFilesPath, silent: false });
            if (pubGetResult.code !== 0) {
                console.error(`flutter pub get failed: ${pubGetResult.stderr}`);
                throw new Error(`Flutter pub get failed: ${pubGetResult.stderr}`);
            }

            const baseHrefToUse = baseHref || `/api/projects/${projectId}/preview/`;
            let flutterBuildCommand;

            if (customBuildCommand) {
                flutterBuildCommand = customBuildCommand;
                console.log(`Using custom build command: ${flutterBuildCommand}`);
            } else if (projectType === 'flutter_release') {
                flutterBuildCommand = `flutter build web --release --base-href ${baseHrefToUse}`;
                console.log(`Using release build command with baseHref ${baseHrefToUse}: ${flutterBuildCommand}`);
                } else {
                // Default to debug build with the correct baseHref
                flutterBuildCommand = `flutter build web --debug --base-href ${baseHrefToUse}`;
                console.log(`Using debug build command with baseHref ${baseHrefToUse}: ${flutterBuildCommand}`);
            }

            // Set environment variable for base href as an alternative way
            const flutterBuildOptions = {
                cwd: localProjectFilesPath,
                silent: false,
                env: { ...process.env, FLUTTER_WEB_BASE_HREF: baseHrefToUse }
            };

            console.log(`Executing build command: ${flutterBuildCommand} with FLUTTER_WEB_BASE_HREF=${baseHrefToUse}`);
            const buildResult = shell.exec(flutterBuildCommand, flutterBuildOptions);

            if (buildResult.code !== 0) {
                console.error(`Flutter build failed: ${buildResult.stderr}`);
                throw new Error(`Flutter build failed: ${buildResult.stderr}`);
            }
            console.log("Flutter build successful.");

            // --- PUB CACHE HANDLING (Upload) ---
            await compressAndUploadPubCache();

        } else { // Assuming React/other JS project
            console.log("Detected non-Flutter (local check e.g., React) project. Running build process...");
            localBuildDir = path.join(localProjectFilesPath, 'build'); // Or 'dist', common for React
            gcsBuildOutputDir = `projects/${projectId}/build/`;

            console.log("Running 'npm install' or 'npm ci'...");
            let installCommand = 'npm install';
            if (fs.existsSync(path.join(localProjectFilesPath, 'package-lock.json'))) {
                installCommand = 'npm ci';
            }
            const installResult = shell.exec(installCommand, { cwd: localProjectFilesPath, silent: false });
            if (installResult.code !== 0) {
                console.error(`${installCommand} failed: ${installResult.stderr}`);
                throw new Error(`${installCommand} failed: ${installResult.stderr}`);
            }

            const buildCmd = customBuildCommand || 'npm run build';
            console.log(`Executing build command: ${buildCmd}`);
            const buildResult = shell.exec(buildCmd, { cwd: localProjectFilesPath, silent: false });
            if (buildResult.code !== 0) {
                console.error(`Build command failed: ${buildResult.stderr}`);
                throw new Error(`Build command failed: ${buildResult.stderr}`);
            }
            console.log("Build successful.");
        }

        // --- Upload Build Artifacts ---
        if (fs.existsSync(localBuildDir)) {
            console.log(`Uploading build artifacts from ${localBuildDir} to GCS path gs://${BUCKET_NAME}/${gcsBuildOutputDir}`);
            await uploadDirectory(localBuildDir, gcsBuildOutputDir);
            console.log('Build artifacts uploaded successfully.');
        } else {
            console.warn(`Build output directory ${localBuildDir} not found. Skipping upload.`);
            // Depending on strictness, you might want to throw an error here
            // throw new Error(`Build output directory ${localBuildDir} not found.`);
        }

        res.status(200).json({ message: 'Build successful', buildId: uniqueId, outputDir: gcsBuildOutputDir });

    } catch (error) {
        console.error(`Build process failed for projectId: ${projectId}. Error: ${error.message}`, error.stack);
        res.status(500).json({ error: `Build failed: ${error.message}` });
    } finally {
        if (localBaseProjectPath && fs.existsSync(localBaseProjectPath)) {
            try {
                console.log(`Cleaning up temporary directory: ${localBaseProjectPath}`);
                await fs.remove(localBaseProjectPath);
                console.log(`Successfully cleaned up ${localBaseProjectPath}`);
            } catch (cleanupError) {
                console.error(`Error cleaning up temporary directory ${localBaseProjectPath}:`, cleanupError);
            }
        }
    }
});

app.get('/_health', (req, res) => {
    res.status(200).send('OK');
});

app.listen(PORT, () => {
    console.log(`Flutter builder service listening on port ${PORT}`);
    console.log(`PUB_CACHE directory: ${LOCAL_PUB_CACHE_DIR}`);
    console.log(`GCS Bucket for PUB_CACHE: gs://${BUCKET_NAME}/${PUB_CACHE_GCS_DIR}`);
});
