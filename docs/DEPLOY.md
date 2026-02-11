# Deployment Guide

## Prerequisites

1. Node.js 18+ installed
2. Firebase CLI authenticated
3. Access to the `claw-control-center` Firebase project

## Quick Deploy

```bash
# Navigate to project root
cd /path/to/claw-control-center

# Install dependencies (if not done)
npm install --include=dev

# Build the app
npm run build

# Login to Firebase (if not authenticated)
npx firebase login

# Deploy to Firebase Hosting
npx firebase deploy --only hosting
```

## Deploy Firestore Rules

```bash
npx firebase deploy --only firestore:rules
```

## Deploy Everything

```bash
npx firebase deploy
```

## Verify Deployment

After deploy, visit: https://claw-control-center.web.app

You should see:
1. Login page with Google sign-in button
2. After login: Dashboard with tabs (Mission Control, Projects, etc.)
3. Connect tab for linking OpenClaw instances

## Environment

The app uses the Firebase config embedded in `src/lib/firebase.ts`:

```typescript
const firebaseConfig = {
  apiKey: "AIzaSyA92dw6OSCw_kazB5KLHRJJt4i45QhjqHE",
  authDomain: "claw-control-center.firebaseapp.com",
  projectId: "claw-control-center",
  storageBucket: "claw-control-center.firebasestorage.app",
  messagingSenderId: "1033311674576",
  appId: "1:1033311674576:web:0de7d470e320d95fc6bed5"
}
```

## Troubleshooting

### "Failed to authenticate"
Run `npx firebase login` and follow the browser prompts.

### "Project not found"
Ensure `.firebaserc` contains:
```json
{
  "projects": {
    "default": "claw-control-center"
  }
}
```

### Build errors
Ensure dev dependencies are installed:
```bash
npm install --include=dev
```

## CI/CD Token (Optional)

For automated deploys, generate a CI token:
```bash
npx firebase login:ci
```

Then deploy with:
```bash
FIREBASE_TOKEN=<your-token> npx firebase deploy
```
