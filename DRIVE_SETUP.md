# Minerva Drive Sync — Setup Guide (10 minutes)

## Step 1 — Create Google Cloud Project
1. Go to https://console.cloud.google.com
2. Click "New Project" → name it "Minerva Financial" → Create

## Step 2 — Enable the Drive API
1. In your project: APIs & Services → Library
2. Search "Google Drive API" → Enable

## Step 3 — Configure OAuth Consent Screen
1. APIs & Services → OAuth consent screen
2. User type: External → Create
3. App name: "Minerva Financial"
4. User support email: kedar.ramnath@gmail.com
5. Developer contact: kedar.ramnath@gmail.com
6. Save and Continue (skip Scopes)
7. Test users → Add yourself: kedar.ramnath@gmail.com → Save

## Step 4 — Create OAuth Credentials
1. APIs & Services → Credentials → Create Credentials → OAuth Client ID
2. Application type: Web application
3. Name: "Minerva Web"
4. Authorised JavaScript origins:
   - http://localhost:5173          (local dev)
   - https://YOUR_GITHUB_PAGES_URL  (production — add after deploy)
5. Click Create → copy the Client ID

## Step 5 — Add to Minerva
1. Copy .env.local.template → .env.local
2. Paste your Client ID:
   VITE_GOOGLE_CLIENT_ID=your_id_here.apps.googleusercontent.com
3. Restart: npm run dev

## How it works
- On first launch: tap the sync badge (top right) → sign in with Google
- Minerva creates minerva_data.json in YOUR Drive (not shared with anyone)
- Every change auto-saves to Drive (3s debounce)
- Open on any device → sign in → your data loads automatically
- Scope used: drive.file (can ONLY see files Minerva itself created)

## Troubleshooting
- "Not initialised": Client ID not set in .env.local
- "Access blocked": Add your Gmail as a test user in Step 3
- "Sign-in popup blocked": Allow popups for localhost in browser settings
