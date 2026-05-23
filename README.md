# Dartivo

Describe an app in plain English, get a working Flutter project. Dartivo is an AI-powered app builder with a web IDE, live preview, and one-tap testing on your real phone via QR code.

**Live:** [dartivo.vercel.app](https://dartivo.vercel.app/)

![Next.js](https://img.shields.io/badge/Next.js-15-000000?logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind-4-06B6D4?logo=tailwindcss&logoColor=white)
![Flutter](https://img.shields.io/badge/Builds-Flutter-02569B?logo=flutter&logoColor=white)
![Firebase](https://img.shields.io/badge/Firebase-FFCA28?logo=firebase&logoColor=black)
![Cloud Run](https://img.shields.io/badge/Cloud%20Run-4285F4?logo=googlecloud&logoColor=white)
![OpenAI](https://img.shields.io/badge/OpenAI-412991?logo=openai&logoColor=white)
![Vercel AI SDK](https://img.shields.io/badge/Vercel%20AI%20SDK-000000?logo=vercel&logoColor=white)
![Monaco](https://img.shields.io/badge/Monaco%20Editor-007ACC?logo=visualstudiocode&logoColor=white)

## What it does

- **Prompt-to-Flutter** — write what you want in English, the model emits a real Flutter project (not pseudocode, not a sketch)
- **Built-in web IDE** — Monaco editor with file tree, multi-pane resizable layout, full syntax highlighting
- **Live preview** — see the generated app running in a simulated device frame next to the code
- **Run on your phone** — scan a QR code and the freshly built app launches on your real device
- **AI code assistant** — chat panel for asking questions, fixing bugs, or asking for changes to the current project
- **Export everything** — download the full Flutter source to keep building locally

## How it's built

The web app is a Next.js 15 app router project. AI generation goes through the Vercel AI SDK with OpenAI as the provider. The interesting part is the build pipeline:

| Piece | What it does |
| --- | --- |
| `src/` | Next.js frontend — web IDE, preview pane, chat, auth |
| `flutter_template/` | Base Flutter project that the AI mutates per request |
| `cloud-run-flutter-builder/` | Dockerized Flutter SDK on Cloud Run, builds APKs on demand |
| `functions/` | Firebase Cloud Functions — orchestration + persistence |
| Firebase | Auth, Firestore for project storage, Storage for build artifacts |

When a user generates an app, the frontend ships the AI-modified Flutter source to a Cloud Run container running the Flutter SDK. The container builds the APK, drops it in Cloud Storage, and the frontend returns a QR code pointing at the signed download URL.

## Stack

| Layer | Tools |
| --- | --- |
| Frontend | Next.js 15 (App Router), React 19, TypeScript, Tailwind v4 |
| Editor | Monaco Editor, `react-resizable-panels`, xterm.js |
| AI | Vercel AI SDK (`@ai-sdk/openai`), OpenAI API |
| Backend | Firebase (Auth, Firestore, Storage, Cloud Functions) |
| Builds | Google Cloud Run + Cloud Build, containerized Flutter SDK |
| Hosting | Vercel (web) + Google Cloud (builders) |

## Running it locally

```bash
git clone https://github.com/taiayman/dartivo.git
cd dartivo
npm install
```

Create `.env.local`:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
OPENAI_API_KEY=...
```

```bash
npm run dev
```

The Cloud Run builder and Firebase functions are deployed separately — see `cloudbuild.yaml` and `firebase.json`. You can run the frontend on its own; the build/preview features will need the backend pieces pointed at your own GCP project.

## Contact

Ayman — [@ayman_tai20054](https://x.com/ayman_tai20054) · taiayman13@gmail.com
