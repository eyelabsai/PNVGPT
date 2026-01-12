# Vercel Deployment Setup

## Important: Configure Root Directory

For this project to work on Vercel, you **must** configure the root directory in Vercel project settings:

1. Go to your Vercel project dashboard
2. Click **Settings** → **General**
3. Find **Root Directory** section
4. Set it to: `client`
5. Click **Save**

## Current Configuration

- `client/vercel.json` - Handles routing (all paths → embed.html)
- Files are in `client/` directory
- Static files (JS, HTML) are served directly

## Troubleshooting

If the site doesn't load:

1. **Check Root Directory**: Must be set to `client` in Vercel settings
2. **Check Build Logs**: Look for any errors in Vercel deployment logs
3. **Check Browser Console**: Open DevTools (F12) and check for JavaScript errors
4. **Check API**: The frontend calls `https://pnvgpt.onrender.com` - make sure that's running
5. **CORS**: The server CORS has been updated to allow all Vercel domains

## Testing

After deployment, visit:
- `https://refractivegpt.vercel.app` (production)
- Or your preview URL

The page should load `embed.html` automatically.
