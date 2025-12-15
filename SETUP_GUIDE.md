# 🚀 Step-by-Step Setup Guide

This guide will walk you through setting up the PNVGPT FAQ Assistant from scratch.

## Prerequisites Checklist

Before starting, make sure you have:

- [ ] Node.js 16 or higher installed
- [ ] npm (comes with Node.js)
- [ ] An OpenAI API account
- [ ] (Optional) A Firebase/Google Cloud account
- [ ] Terminal/command line access

## Step 1: Install Node.js

If you don't have Node.js installed:

**Mac (using Homebrew):**
```bash
brew install node
```

**Windows:**
Download from [nodejs.org](https://nodejs.org)

**Verify installation:**
```bash
node --version  # Should show v16+ or higher
npm --version   # Should show version number
```

## Step 2: Install Dependencies

In the project directory:

```bash
npm install
```

This will install all required packages (~2-3 minutes).

## Step 3: Get OpenAI API Key

1. Go to [platform.openai.com](https://platform.openai.com)
2. Sign up or log in
3. Go to API Keys section
4. Click "Create new secret key"
5. Copy the key (starts with `sk-...`)
6. **Important:** Save it somewhere safe - you can't see it again!

## Step 4: Set Up Environment Variables

Create a file named `.env` in the project root:

```bash
# On Mac/Linux:
touch .env

# On Windows:
type nul > .env
```

Open `.env` in a text editor and add:

```env
# Required
OPENAI_API_KEY=sk-your-key-here

# Server settings
PORT=3000
NODE_ENV=development

# Practice information (customize these)
CLINIC_PHONE=555-123-4567
CLINIC_NAME=Pacific Northwest Vision Center

# ChromaDB settings (can leave as-is)
CHROMA_COLLECTION_NAME=faq_collection
CHROMA_PATH=./vector-store
```

Replace `sk-your-key-here` with your actual OpenAI API key.

## Step 5: (Optional) Set Up Firebase

**If you want analytics/logging:**

### 5a. Create Firebase Project

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Click "Add project"
3. Enter project name (e.g., "pnvgpt-faq")
4. Disable Google Analytics (not needed)
5. Click "Create project"

### 5b. Enable Firestore

1. In your Firebase project, click "Firestore Database"
2. Click "Create database"
3. Choose "Start in test mode"
4. Select region (choose closest to your location)
5. Click "Enable"

### 5c. Get Service Account Credentials

1. Click the gear icon → "Project settings"
2. Go to "Service accounts" tab
3. Click "Generate new private key"
4. A JSON file will download

### 5d. Add to .env

Open the downloaded JSON file and copy these values to your `.env`:

```env
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour\nPrivate\nKey\nHere\n-----END PRIVATE KEY-----\n"
```

**Note:** The private key must include the `\n` characters and be wrapped in quotes.

**Skip Firebase:** If you don't want logging, that's fine! The system will work without it and just show warnings.

## Step 6: Customize Your Content

Edit the markdown files in `/content/` to match your practice:

```bash
content/
├── lasik-basics.md
├── recovery-aftercare.md
├── prk-information.md
├── cost-insurance.md
└── consultation-preparation.md
```

Update them with your practice's:
- Procedures offered
- Pricing information
- Contact information
- Office locations
- Specific policies

**Tips:**
- Use clear, simple language
- Break into sections with headers
- Include common questions patients ask
- Update phone numbers and addresses

## Step 7: Index Your Content

This step creates the vector database:

```bash
npm run index
```

**What you should see:**
```
🚀 Starting FAQ Indexing Process
==================================================

📖 Step 1: Loading markdown files...
📂 Found 5 markdown files
   ✓ Loaded: lasik-basics.md
   ✓ Loaded: recovery-aftercare.md
   ...

✂️  Step 2: Chunking content...
   ✓ Processed lasik-basics.md: 8 chunks
   ...

🧠 Step 3: Generating embeddings...
   ✓ Embedded 45/45 chunks

💾 Step 4: Initializing ChromaDB...
✅ Created new collection: faq_collection

📥 Step 5: Adding chunks to vector database...
✅ Added 45 chunks to collection

✅ Indexing completed successfully!
```

**If you get errors:**
- Check your OpenAI API key is correct
- Make sure you have internet connection
- Verify you have markdown files in `/content/`

## Step 8: Start the Server

```bash
npm start
```

**What you should see:**
```
🚀 Starting PNVGPT FAQ Assistant Server...
==================================================
🔥 Initializing Firebase...
✅ Firebase initialized with environment variables
(or: ⚠️  Logging will be disabled if no Firebase)

==================================================
✅ Server running on port 3000

📍 API Endpoints:
   http://localhost:3000/
   http://localhost:3000/ask
   http://localhost:3000/health
```

## Step 9: Test the System

### Test via Command Line

```bash
curl -X POST http://localhost:3000/ask \
  -H "Content-Type: application/json" \
  -d '{"query": "What is LASIK?"}'
```

### Test via Browser

1. Open `client/embed.html` in your web browser
2. Type a question like "What is LASIK?"
3. Click "Ask"
4. You should see a response!

### Test Health Check

Visit in browser: `http://localhost:3000/health`

Should show:
```json
{
  "status": "healthy",
  "components": {
    "openai": true,
    "chromadb": true,
    "collection": true,
    "documentCount": 45
  }
}
```

## Step 10: Integrate into Your Website

### Option A: Use the Demo Widget

1. Open `client/embed.html` in a browser
2. Test the chat interface
3. Customize colors/styles as needed

### Option B: Add Embed Script

Add this to your website's HTML:

```html
<script src="path/to/client/embed-snippet.js"></script>
```

Update the API URL in `embed-snippet.js`:
```javascript
const CONFIG = {
    apiUrl: 'https://your-domain.com/ask',  // Change this
    position: 'bottom-right',
    primaryColor: '#667eea',
    buttonText: '💬 Ask a Question'
};
```

### Option C: Custom Integration

Use fetch API in your own JavaScript:

```javascript
async function askQuestion(question) {
  const response = await fetch('http://localhost:3000/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: question })
  });
  const data = await response.json();
  return data.answer;
}
```

## Common Issues & Solutions

### ❌ "Cannot find module"
**Solution:** Run `npm install` again

### ❌ "Collection not found"
**Solution:** Run `npm run index` to create the database

### ❌ "OpenAI API error"
**Solution:** 
- Check API key in `.env`
- Verify you have credits in your OpenAI account
- Check [status.openai.com](https://status.openai.com)

### ❌ "Port 3000 already in use"
**Solution:** 
- Change `PORT=3001` in `.env`
- Or kill the process: `lsof -ti:3000 | xargs kill`

### ❌ Firebase warnings
**Solution:** Firebase is optional - you can ignore warnings if you don't need logging

### ❌ Answers seem wrong
**Solution:** 
- Check your markdown content is accurate
- Re-run `npm run index` after editing content
- Lower the similarity threshold in `server/rag.js`

## Updating Content Later

When you want to update FAQ content:

1. Edit markdown files in `/content/`
2. Re-index: `npm run index`
3. Restart server: `npm start`

That's it!

## Production Deployment

For production use:

1. **Update environment variables:**
   ```env
   NODE_ENV=production
   CLINIC_PHONE=your-real-phone
   ```

2. **Use a process manager:**
   ```bash
   npm install -g pm2
   pm2 start server/app.js --name faq-assistant
   ```

3. **Set up reverse proxy** (nginx/Apache)

4. **Use HTTPS** for security

5. **Monitor Firebase logs** for analytics

## Need Help?

1. Check `README.md` for detailed documentation
2. Review the troubleshooting section
3. Check OpenAI and Firebase documentation
4. Review code comments for implementation details

---

🎉 **Congratulations!** Your FAQ assistant is now ready to help patients!



