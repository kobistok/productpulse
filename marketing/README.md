# Syncop — Marketing Site

Static marketing website for Syncop (the public-facing name for ProductPulse).

## Hosting

Deploy to Google Cloud Storage as a static site:

```bash
# Create a public bucket
gsutil mb -p PROJECT_ID gs://syncop.io

# Make it public
gsutil iam ch allUsers:objectViewer gs://syncop.io

# Upload
gsutil -h "Cache-Control:public,max-age=3600" cp -r . gs://syncop.io

# Set index page
gsutil web set -m index.html gs://syncop.io
```

Or use Firebase Hosting / Cloud Run for HTTPS with a custom domain.

## Notes
- Pure HTML/CSS/JS — no build step, no dependencies
- Not part of the pnpm monorepo workspace (not in apps/ or packages/)
- "Syncop" brand name is used here only — the app still shows "ProductPulse" internally
