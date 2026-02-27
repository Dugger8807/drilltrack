# DrillTrack — Geotechnical Drilling Operations Manager

## Local Development

```bash
npm install
npm run dev
```

## Deploy to Netlify

### Option A: Netlify CLI
```bash
npm install -g netlify-cli
npm run build
netlify deploy --prod
```

### Option B: Git Deploy (Recommended)
1. Push this folder to a GitHub/GitLab repo
2. Go to [app.netlify.com](https://app.netlify.com)
3. Click **"Add new site" → "Import an existing project"**
4. Connect your repo
5. Build settings are auto-detected from `netlify.toml`:
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
6. Click **Deploy**

### Option C: Drag & Drop
```bash
npm install
npm run build
```
Then drag the `dist` folder onto [app.netlify.com/drop](https://app.netlify.com/drop)
