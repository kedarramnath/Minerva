# Minerva — Deploy to iPhone (GitHub Pages)

## One-time setup (~15 minutes total)

### 1. Create a GitHub repo
1. Go to https://github.com/new
2. Name it `minerva` (private repo is fine)
3. Don't initialise with README

### 2. Push the code
Open Terminal in the minerva folder:
```bash
git init
git add .
git commit -m "Minerva v1"
git remote add origin https://github.com/YOUR_USERNAME/minerva.git
git push -u origin main
```

### 3. Update your homepage URL
In package.json, replace:
  "homepage": "https://YOUR_GITHUB_USERNAME.github.io/minerva"
with your actual GitHub username.

### 4. Deploy
```bash
npm run deploy
```
This builds the app and pushes it to the `gh-pages` branch automatically.

### 5. Enable GitHub Pages
1. Go to your repo → Settings → Pages
2. Source: Deploy from branch → `gh-pages` → `/ (root)`
3. Save. Wait ~2 minutes.

Your app is now live at:
  https://YOUR_USERNAME.github.io/minerva

---

## Install on iPhone

1. Open Safari on your iPhone
2. Go to https://YOUR_USERNAME.github.io/minerva
3. Tap the Share button (box with arrow)
4. Tap "Add to Home Screen"
5. Name it "Minerva" → Add

The KAY monogram icon appears on your home screen.
Tap it — opens full screen, no browser chrome, works offline.

---

## Future updates
After any code change, just run:
```bash
npm run deploy
```
The app on your phone updates automatically within ~1 minute.

---

## Drive sync (optional but recommended)
See DRIVE_SETUP.md — add your Google Client ID to .env.local before deploying
so your data syncs between your phone and any other device.
