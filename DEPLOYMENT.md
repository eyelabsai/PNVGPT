# 🚀 Deployment Guide - Render.com

This guide will walk you through deploying your PNVGPT FAQ Assistant to Render in about 10 minutes.

## 📋 Prerequisites

Before deploying, make sure you have:

1. ✅ A [GitHub](https://github.com) account
2. ✅ A [Render.com](https://render.com) account (free - sign up with GitHub)
3. ✅ Your OpenAI API key
4. ✅ (Optional) Firebase credentials if you want logging

---

## 🎯 Step 1: Push Your Code to GitHub

Since this project isn't in a git repository yet, let's set that up:

```bash
# Navigate to your project
cd /Users/gurpalvirdi/PNVGPT

# Initialize git
git init

# Add all files
git add .

# Create first commit
git commit -m "Initial commit - PNVGPT FAQ Assistant"

# Create a new repository on GitHub (via web):
# Go to https://github.com/new
# Name it: pnvgpt-faq-assistant
# Keep it private if you want
# DON'T initialize with README (we already have one)

# Add GitHub remote (replace YOUR_USERNAME with your GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/pnvgpt-faq-assistant.git

# Push to GitHub
git branch -M main
git push -u origin main
```

---

## 🌐 Step 2: Deploy to Render

### A. Connect GitHub to Render

1. Go to [render.com](https://render.com)
2. Click **"Sign In"** (or Sign Up if first time)
3. Sign in with your **GitHub account**
4. Authorize Render to access your repositories

### B. Create New Web Service

1. From your Render Dashboard, click **"New +"** → **"Web Service"**

2. Connect your repository:
   - Select **"pnvgpt-faq-assistant"** from the list
   - Or paste the GitHub URL
   - Click **"Connect"**

3. Render will auto-detect your `render.yaml` config! 🎉

### C. Configure Environment Variables

In the Render dashboard, go to **Environment** tab and add these:

#### Required Variables:

```plaintext
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxx
```

#### Optional (for Firebase logging):

```plaintext
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-service-account@project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_KEY_HERE\n-----END PRIVATE KEY-----\n"
```

#### Already Set (from render.yaml):

- `NODE_ENV=production`
- `PORT=10000`
- `CLINIC_NAME=Your Refractive Surgery Practice`
- `CLINIC_PHONE=XXX-XXX-XXXX`
- `CHROMA_COLLECTION_NAME=faq_collection`
- `CHROMA_PATH=./vector-store`

**⚠️ Important:** Update `CLINIC_NAME` and `CLINIC_PHONE` with your actual information!

---

## 🗄️ Step 3: Verify Persistent Disk

Render will automatically create a **1GB persistent disk** for your ChromaDB storage (configured in `render.yaml`).

To verify:
1. Go to your service dashboard
2. Click **"Disks"** tab
3. You should see `chromadb-storage` mounted at `/opt/render/project/src/vector-store`

This ensures your vector database persists between deployments! ✅

---

## 🏗️ Step 4: Deploy!

1. Click **"Create Web Service"** button

2. Render will now:
   - ✅ Clone your repository
   - ✅ Run `npm install`
   - ✅ Run `npm run index` (creates vector database)
   - ✅ Start the server with `npm start`

3. Watch the build logs - should take 2-3 minutes

4. Once deployed, you'll see: **"Your service is live 🎉"**

---

## 🧪 Step 5: Test Your Deployment

Your API will be live at: `https://pnvgpt-faq-assistant.onrender.com`

### Test with curl:

```bash
# Check status
curl https://pnvgpt-faq-assistant.onrender.com/status

# Check health
curl https://pnvgpt-faq-assistant.onrender.com/health

# Ask a question
curl -X POST https://pnvgpt-faq-assistant.onrender.com/ask \
  -H "Content-Type: application/json" \
  -d '{"query": "What is LASIK?"}'
```

### Test in browser:

1. Open your service URL: `https://your-service-name.onrender.com`
2. You should see the API information page
3. Try `/health` endpoint to verify all systems are working

---

## 🎨 Step 6: Update Your Frontend

Update the API URL in your chat widget:

### In `client/embed.html`:

```javascript
const API_URL = 'https://pnvgpt-faq-assistant.onrender.com/ask';
```

### In `client/embed-snippet.js`:

```javascript
const CONFIG = {
    apiUrl: 'https://pnvgpt-faq-assistant.onrender.com/ask',
    // ... rest of config
};
```

---

## 🔄 Auto-Deployment

Your app will automatically redeploy when you push to GitHub:

```bash
# Make changes to your code
git add .
git commit -m "Update FAQ content"
git push origin main

# Render will automatically rebuild and deploy! 🚀
```

---

## 📊 Monitoring & Logs

### View Logs:
1. Go to your Render dashboard
2. Click on your service
3. Click **"Logs"** tab
4. See real-time logs of requests and responses

### View Metrics:
1. Click **"Metrics"** tab
2. See CPU, Memory, Request count, Response times

### Set Up Alerts:
1. Click **"Settings"** → **"Alerts"**
2. Add email notifications for downtime or errors

---

## 🆓 Free Tier Limitations

Render's free tier includes:

- ✅ 750 hours/month (plenty for one service)
- ✅ Auto-sleep after 15 min of inactivity
- ✅ 1GB persistent disk (enough for ChromaDB)
- ⚠️ First request after sleep takes ~30 seconds (cold start)

### Prevent Sleep (Optional - Paid Plan Only):

If you upgrade to Starter ($7/month), your service stays always-on.

---

## 🔧 Troubleshooting

### Build fails on "npm run index":

**Problem:** ChromaDB indexing failed

**Solution:**
1. Check logs for specific error
2. Verify `content/` folder has markdown files
3. Ensure `OPENAI_API_KEY` is set correctly

### Health check fails:

**Problem:** `/health` endpoint returns unhealthy

**Solution:**
1. Check logs for OpenAI or ChromaDB errors
2. Verify environment variables are set
3. Rebuild the service

### "Collection not found" error:

**Problem:** Vector database wasn't created

**Solution:**
1. Manually trigger indexing via Shell in Render:
   - Dashboard → Service → Shell
   - Run: `npm run index`
2. Restart service

### Disk storage full:

**Problem:** 1GB disk is full

**Solution:**
1. Go to **Disks** tab
2. Increase disk size (billable after 1GB)

### Cold starts are too slow:

**Problem:** Free tier sleeps after inactivity

**Solution:**
1. Upgrade to Starter plan ($7/month) for always-on service
2. Or use a cron job service to ping your app every 10 minutes

---

## 💰 Cost Breakdown

### Free Tier:
- **Render Hosting:** $0/month (with sleep)
- **Disk Storage:** $0/month (1GB included)
- **OpenAI API:** ~$0.01-0.10/month (GPT-4o-mini is cheap!)
- **Firebase:** $0/month (Spark plan sufficient)

**Total: $0/month** for testing and light use! 🎉

### Paid Option (Always-On):
- **Render Starter:** $7/month
- **Everything else:** Same as above

**Total: ~$7/month** for production use

---

## 🎁 Next Steps

### 1. Custom Domain (Optional)

Want your own domain like `chatbot.yourclinic.com`?

1. Buy a domain (e.g., from Namecheap, Google Domains)
2. In Render dashboard → **Settings** → **Custom Domain**
3. Add your domain and follow DNS instructions
4. Free SSL certificate included! 🔒

### 2. Host the Frontend

You can deploy `client/embed.html` to:
- **Vercel** (perfect for static HTML)
- **Netlify** (also great for static sites)
- **Your existing website** (just upload the files)

### 3. Add Analytics

Monitor usage in Firebase:
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project
3. Go to **Firestore Database**
4. Browse `faq_logs` collection to see all queries

### 4. Update FAQ Content

To update your FAQ content:

```bash
# Edit markdown files in content/
# Then commit and push
git add content/
git commit -m "Update FAQ content"
git push origin main

# Render will auto-rebuild and re-index! 🎉
```

---

## 📞 Support

If you run into issues:

1. Check [Render Status Page](https://status.render.com)
2. Review [Render Docs](https://render.com/docs)
3. Check your service logs in Render dashboard
4. Review the main [README.md](./README.md) for app-specific troubleshooting

---

## ✅ Deployment Checklist

Before sharing with users:

- [ ] Service is deployed and healthy
- [ ] Environment variables are set correctly
- [ ] Health check endpoint returns "healthy"
- [ ] Test query returns appropriate answer
- [ ] Updated `CLINIC_NAME` and `CLINIC_PHONE`
- [ ] Frontend widget points to production URL
- [ ] SSL certificate is active (automatic)
- [ ] Firebase logging is working (if enabled)
- [ ] Monitored logs for any errors
- [ ] Set up email alerts for downtime

---

**🎉 Congratulations! Your PNVGPT FAQ Assistant is now live!**

Share your URL: `https://your-service-name.onrender.com`

---

*Need to switch to a different platform later? Check out:*
- [Railway.app](https://railway.app) - Similar to Render
- [Fly.io](https://fly.io) - More control, Docker-based
- [Heroku](https://heroku.com) - Classic PaaS (more expensive)
