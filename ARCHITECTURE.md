# 🏗️ PNVGPT Architecture & Implementation Guide

**Complete technical documentation of the PNVGPT RAG-based FAQ assistant system**

---

## 📋 Table of Contents

1. [System Overview](#system-overview)
2. [Architecture Diagram](#architecture-diagram)
3. [Content Workflow](#content-workflow)
4. [Vector Database (Supabase)](#vector-database-supabase)
5. [RAG Pipeline](#rag-pipeline)
6. [Backend (Render)](#backend-render)
7. [Frontend (Vercel)](#frontend-vercel)
8. [Patient Conversion Features](#patient-conversion-features)
9. [Deployment Workflow](#deployment-workflow)
10. [What's Already Built](#whats-already-built)

---

## 🎯 System Overview

PNVGPT is a **Retrieval-Augmented Generation (RAG)** system that provides accurate, hallucination-free answers about refractive surgery procedures. It combines:

- **Content Management**: Markdown files in `/content/` folder
- **Vector Database**: Supabase PostgreSQL with `pgvector` extension
- **Embeddings**: OpenAI `text-embedding-3-small` (1536 dimensions)
- **LLM**: GPT-4o-mini for answer generation
- **Backend**: Node.js/Express on Render.com
- **Frontend**: Static HTML/JS on Vercel
- **Analytics**: Firebase Firestore (optional) + Supabase logs

### Key Technologies

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Vector DB** | Supabase (PostgreSQL + pgvector) | Store and search content embeddings |
| **Embeddings** | OpenAI text-embedding-3-small | Convert text to 1536-dim vectors |
| **LLM** | GPT-4o-mini | Generate conversational answers |
| **Backend** | Node.js + Express | API server |
| **Frontend** | Vanilla HTML/JS | Chat widget UI |
| **Hosting (Backend)** | Render.com | Serverless Node.js hosting |
| **Hosting (Frontend)** | Vercel | Static site hosting |
| **Analytics** | Firebase Firestore | Query logging (optional) |

---

## 🏛️ Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER INTERACTION                         │
│                    (Browser / Chat Widget)                       │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      FRONTEND (Vercel)                           │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  client/embed.html                                         │ │
│  │  - Chat UI with floating CTAs                              │ │
│  │  - Lead capture modal                                     │ │
│  │  - Quick action buttons                                    │ │
│  │  - Analytics tracking                                      │ │
│  └────────────────────┬─────────────────────────────────────┘ │
└────────────────────────┼─────────────────────────────────────────┘
                         │ HTTP POST /ask
                         │ HTTP POST /lead
                         │ HTTP POST /analytics/event
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    BACKEND API (Render)                          │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  server/app.js                                            │ │
│  │  - POST /ask (main FAQ endpoint)                         │ │
│  │  - POST /ask/stream (streaming version)                  │ │
│  │  - POST /lead (lead capture)                             │ │
│  │  - POST /analytics/event (event tracking)                │ │
│  │  - GET /health (health check)                             │ │
│  └────────────────────┬─────────────────────────────────────┘ │
│                       │                                         │
│  ┌────────────────────▼─────────────────────────────────────┐ │
│  │  server/rag.js                                             │ │
│  │  - generateAnswer() - Main RAG pipeline                    │ │
│  │  - detectBuyingIntent() - Intent detection                │ │
│  │  - retrieveRelevant() - Vector search                     │ │
│  │  - generateAnswerFromChunks() - LLM generation            │ │
│  └────────────────────┬─────────────────────────────────────┘ │
│                       │                                         │
│  ┌────────────────────▼─────────────────────────────────────┐ │
│  │  server/prompt.js                                          │ │
│  │  - generatePrompt() - Safety prompt template              │ │
│  │  - isStatement() - Statement detection                   │ │
│  │  - isGreeting() - Greeting detection                     │ │
│  │  - getConversationalPrompt() - Conversational mode        │ │
│  └────────────────────┬─────────────────────────────────────┘ │
└───────────────────────┼─────────────────────────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        │               │               │
        ▼               ▼               ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│   Supabase   │ │    OpenAI     │ │   Firebase   │
│  (pgvector)  │ │   (API)      │ │  (Analytics)  │
│              │ │              │ │              │
│ - content_  │ │ - Embeddings │ │ - Query logs │
│   chunks     │ │ - GPT-4o-    │ │ - Events     │
│ - Vector     │ │   mini       │ │              │
│   search     │ │              │ │              │
└──────────────┘ └──────────────┘ └──────────────┘
```

---

## 📝 Content Workflow

### Step 1: Content Creation

**Location**: `/content/*.md` files

Content is written in Markdown format:

```markdown
# Topic Title

## Question 1?
Answer to question 1...

## Question 2?
Answer to question 2...
```

**Current Content Files** (18 files, 63 chunks):
- `01-cost-and-insurance.md`
- `02-surgery-day-procedure.md`
- `03-recovery-and-restrictions.md`
- `04-medications-and-eyedrops.md`
- `05-postop-followups.md`
- `06-lens-options-vision-outcomes.md`
- `07-complications-concerns.md`
- `08-contacts-glasses-prescriptions.md`
- `09-lasik-basics.md`
- `10-practice-information.md`
- `11-icl-faqs.md`
- `12-lasik-prk-faqs.md`
- `13-smile-faqs.md`
- `14-cataract-surgery-faqs.md`
- `15-vision-basics-and-overview.md`
- `16-counseling-strategies.md` ⭐ (Emotional/financial concerns)
- `17-qualification-candidacy.md` ⭐ (Scheduling, first steps)
- `18-social-proof.md` ⭐ (Why choose us)

### Step 2: Indexing Process

**Script**: `scripts/index.js`

**Command**: `npm run index`

**What it does**:

1. **Load Markdown Files**
   ```javascript
   // Reads all .md files from /content/
   const files = await loadMarkdownFiles();
   ```

2. **Parse & Chunk Content**
   ```javascript
   // Converts markdown to plain text
   // Splits into chunks of ~300 words with 50-word overlap
   const chunks = processFile(file);
   // Result: Array of {id, document, metadata}
   ```

3. **Generate Embeddings**
   ```javascript
   // Calls OpenAI API for each chunk
   const embeddings = await generateEmbeddings(chunks);
   // Result: 1536-dim vectors for each chunk
   ```

4. **Store in Supabase**
   ```javascript
   // Upserts to content_chunks table
   await addToVectorStore(chunks, embeddings);
   ```

**Chunking Strategy**:
- **Chunk Size**: 300 words (target)
- **Overlap**: 50 words between chunks
- **Why Overlap**: Ensures context isn't lost at chunk boundaries
- **Chunk ID Format**: `{filename}-chunk-{index}`

### Step 3: Vector Storage

**Database**: Supabase PostgreSQL with `pgvector` extension

**Table Schema**: `content_chunks`

```sql
CREATE TABLE content_chunks (
  id TEXT PRIMARY KEY,                    -- e.g., "01-cost-and-insurance.md-chunk-0"
  source_file TEXT NOT NULL,              -- e.g., "01-cost-and-insurance.md"
  chunk_index INTEGER NOT NULL,            -- 0, 1, 2, ...
  content TEXT NOT NULL,                   -- The actual text chunk
  embedding VECTOR(1536),                 -- OpenAI embedding vector
  metadata JSONB DEFAULT '{}',             -- Additional metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Index**: `content_chunks_embedding_idx` (IVFFlat for fast similarity search)

**Function**: `match_content_chunks(query_embedding, match_threshold, match_count)`
- Performs cosine similarity search
- Returns top K chunks above threshold
- Uses `<=>` operator (cosine distance)

---

## 🗄️ Vector Database (Supabase)

### Setup

1. **Create Supabase Project**
   - Go to [supabase.com](https://supabase.com)
   - Create new project
   - Wait for database to initialize

2. **Run Migration**
   - Go to SQL Editor in Supabase dashboard
   - Copy contents of `supabase/migrations/001_create_vector_store.sql`
   - Run the migration
   - This creates:
     - `pgvector` extension
     - `content_chunks` table
     - `conversation_logs` table (for analytics)
     - `match_content_chunks()` function
     - Indexes

3. **Get Credentials**
   - Project Settings → API
   - Copy `SUPABASE_URL`
   - Copy `SUPABASE_SERVICE_KEY` (service_role key, not anon key)

4. **Configure Environment**
   ```env
   SUPABASE_URL=https://xxxxx.supabase.co
   SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

### Implementation

**File**: `server/vectorstore-supabase.js`

**Key Functions**:

```javascript
// Add documents (used during indexing)
async function addDocuments(documents) {
  // Upserts chunks to content_chunks table
  // Handles batching (100 at a time)
}

// Query similar chunks (used during RAG)
async function querySimilar(queryEmbedding, options) {
  // Calls match_content_chunks() SQL function
  // Returns top K chunks with similarity scores
}

// Get document count
async function getCount() {
  // Returns total chunks in database
}

// Delete all (used during re-indexing)
async function deleteCollection() {
  // Truncates content_chunks table
}
```

### Fallback Behavior

If Supabase is not configured, the system falls back to:
- Local JSON file storage (`vector-store/collection.json`)
- Slower, but works for development/testing

**Check**: `isSupabaseConfigured()` in `server/supabase.js`

---

## 🔄 RAG Pipeline

**File**: `server/rag.js`

### Flow Diagram

```
User Question
    │
    ▼
┌─────────────────────────────────────┐
│ 1. Input Validation                 │
│    - Check if empty                 │
│    - Sanitize (max 500 chars)       │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ 2. Intent Detection                 │
│    - isGreeting()? → Return greeting │
│    - isStatement()? → Conversational │
│    - Otherwise → RAG                 │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ 3. Query Enhancement                 │
│    - Emotional concern?              │
│      → Add "responding to fear..."  │
│    - Financial concern?              │
│      → Add "responding to financial" │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ 4. Generate Query Embedding          │
│    - OpenAI text-embedding-3-small   │
│    - 1536-dim vector                 │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ 5. Vector Search (Supabase)          │
│    - match_content_chunks()          │
│    - Cosine similarity               │
│    - Threshold: 0.25 (0.15 for      │
│      counseling content)             │
│    - Top K: 5 chunks                 │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ 6. Chunk Filtering                   │
│    - Check similarity threshold      │
│    - Remove duplicates               │
│    - Combine chunks                  │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ 7. Answer Generation (GPT-4o-mini)   │
│    - Safety prompt from prompt.js    │
│    - Retrieved chunks as context     │
│    - Temperature: 0.3 (low = factual)│
│    - Max tokens: 500                  │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ 8. Response Assembly                 │
│    - Answer text                     │
│    - Buying intent detection         │
│    - Metadata (chunks, timing)       │
└──────────────┬──────────────────────┘
               │
               ▼
         Response to User
```

### Key Functions

#### `generateAnswer(question, conversationHistory)`

Main entry point for RAG pipeline.

**Parameters**:
- `question`: User's question (string)
- `conversationHistory`: Previous messages (array of {role, content})

**Returns**:
```javascript
{
  answer: "Generated answer...",
  chunks: [...], // Retrieved chunks
  usedFallback: false,
  buyingIntent: {...}, // Intent analysis
  responseTime: 1234,
  debugInfo: {...} // Similarity scores, etc.
}
```

#### `retrieveRelevant(query, conversationHistory)`

Performs vector similarity search.

**Process**:
1. Generate embedding for query
2. Call `match_content_chunks()` SQL function
3. Filter by similarity threshold
4. Return top K chunks

**Thresholds**:
- **Default**: 0.25
- **Counseling content** (`16-counseling-strategies.md`): 0.15 (lower = easier to match)

#### `detectBuyingIntent(query)`

Detects if user shows buying signals.

**Signals**:
- `schedule`, `book`, `appointment`, `consultation`
- `ready`, `interested`, `want to do this`
- `cost`, `price`, `financing`
- `candidate`, `good candidate`, `eligible`

**Returns**:
```javascript
{
  hasBuyingIntent: true,
  isHighIntent: true, // schedule/book/appointment
  signals: ["schedule", "consultation"],
  proceduresMentioned: ["lasik"],
  intentScore: 4
}
```

### Safety Features

**File**: `server/prompt.js`

1. **Retrieval-Only Responses**
   - Only uses information from retrieved chunks
   - Never invents facts

2. **Fallback Messages**
   - If no relevant chunks found → "I'm not sure... call us at (210) 585-2020"

3. **No Medical Diagnosis**
   - Redirects clinical questions to office

4. **Low Temperature (0.3)**
   - More factual, less creative

5. **Content Validation**
   - Similarity threshold filtering
   - Minimum chunk length check

---

## 🖥️ Backend (Render)

### Deployment Platform: Render.com

**Why Render?**
- Free tier available
- Auto-deploys from GitHub
- Persistent disk for vector storage (if using local)
- Easy environment variable management
- Health checks built-in

### Configuration

**File**: `render.yaml`

```yaml
services:
  - type: web
    name: pnvgpt-faq-assistant
    runtime: node
    buildCommand: npm install
    startCommand: bash start.sh
    healthCheckPath: /health
```

**Start Script**: `start.sh`

```bash
# Conditionally runs indexing on first deploy
if [ "$FORCE_REINDEX" = "true" ]; then
    npm run index
elif [ "$SUPABASE_URL" != "" ] && [ ! -f "/tmp/.indexed" ]; then
    npm run index
    touch /tmp/.indexed
fi

npm start
```

### Environment Variables

**Required**:
- `OPENAI_API_KEY` - OpenAI API key
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_KEY` - Supabase service role key

**Optional**:
- `FIREBASE_PROJECT_ID` - For analytics logging
- `FIREBASE_CLIENT_EMAIL` - Firebase service account
- `FIREBASE_PRIVATE_KEY` - Firebase private key

**Practice Info**:
- `CLINIC_NAME` - "Parkhurst NuVision San Antonio"
- `CLINIC_PHONE` - "(210) 585-2020"

### API Endpoints

#### `POST /ask`

Main FAQ endpoint.

**Request**:
```json
{
  "query": "What is LASIK?",
  "messages": [...] // Optional conversation history
}
```

**Response**:
```json
{
  "answer": "LASIK is...",
  "metadata": {
    "responseTime": 1234,
    "retrievedChunks": 5,
    "buyingIntent": {...},
    "debugInfo": {...}
  }
}
```

#### `POST /ask/stream`

Streaming version (Server-Sent Events).

**Response**: SSE stream with `data: {"type": "content", "content": "..."}`

#### `POST /lead`

Lead capture endpoint.

**Request**:
```json
{
  "name": "John Doe",
  "phone": "210-555-1234",
  "email": "john@example.com",
  "procedure": "lasik",
  "conversationSummary": "..."
}
```

**Response**:
```json
{
  "success": true,
  "leadId": "logged",
  "message": "Thank you! Our team will reach out..."
}
```

#### `POST /analytics/event`

Frontend event tracking.

**Request**:
```json
{
  "event": "cta_click",
  "data": {
    "ctaType": "schedule",
    "messageCount": 3
  }
}
```

#### `GET /health`

Health check endpoint.

**Response**:
```json
{
  "status": "healthy",
  "components": {
    "openai": true,
    "vectorStore": true,
    "vectorProvider": "supabase",
    "collection": true,
    "documentCount": 63
  }
}
```

---

## 🎨 Frontend (Vercel)

### Deployment Platform: Vercel

**Why Vercel?**
- Free tier for static sites
- Auto-deploys from GitHub
- Global CDN
- Custom domains
- Zero configuration

### Configuration

**Important**: Set **Root Directory** to `client` in Vercel project settings!

**File**: `client/vercel.json`

```json
{
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/embed.html"
    }
  ]
}
```

### Main File: `client/embed.html`

**Features**:
- Chat UI with message history
- Floating CTA buttons (always visible)
- Lead capture modal
- Quick action buttons after responses
- Analytics tracking
- Streaming responses (typing effect)

**Key JavaScript Functions**:

```javascript
// Ask a question
async function askFAQ(question) {
  // POST to /ask endpoint
  // Handles streaming vs non-streaming
  // Updates UI with response
}

// Open lead capture modal
function openScheduleModal() {
  // Shows modal with form
}

// Submit lead
async function submitLead(e) {
  // POST to /lead endpoint
  // Shows success message
}

// Track analytics
async function trackEvent(eventName, data) {
  // POST to /analytics/event endpoint
}

// Create quick action buttons
function createQuickActions(buyingIntent) {
  // Shows Schedule/Call/Ask buttons
  // Based on buying intent and message count
}
```

**API Configuration**:
```javascript
const isLocalhost = window.location.hostname === 'localhost';
const baseURL = isLocalhost 
  ? 'http://localhost:3000' 
  : 'https://pnvgpt.onrender.com';
```

### Styling

- Dark theme (ChatGPT-like)
- Responsive (mobile-friendly)
- Smooth animations
- Accessible (keyboard navigation)

---

## 🎯 Patient Conversion Features

### 1. Floating CTA Buttons

**Always visible** in bottom-right corner:
- **"📅 Schedule Free Consultation"** - Opens lead modal
- **"📞 Call (210) 585-2020"** - Direct phone link

**Implementation**: `client/embed.html` (CSS + HTML)

### 2. Quick Action Buttons

**After each assistant response**:
- **"📅 Schedule Free Consultation"** (primary, highlighted)
- **"📞 Call Us"**
- **"💬 Ask Another Question"**

**Shown when**:
- User has asked 2+ questions, OR
- Buying intent detected

**Implementation**: `createQuickActions()` function

### 3. Lead Capture Modal

**Triggers**:
- Click "Schedule Free Consultation" button
- High buying intent detected

**Form Fields**:
- Name (required)
- Phone (required)
- Email (optional)
- Procedure interest (dropdown)
- Conversation summary (auto-filled)

**Backend**: `POST /lead` endpoint

**Storage**: Firebase Firestore (if configured) + Supabase `conversation_logs`

### 4. Buying Intent Detection

**Signals Detected**:
- `schedule`, `book`, `appointment`
- `ready`, `interested`, `want to do this`
- `cost`, `price`, `financing`
- `candidate`, `eligible`

**Response**:
- Highlights CTA buttons
- Shows quick actions immediately
- Suggests consultation more aggressively

**Implementation**: `server/rag.js` → `detectBuyingIntent()`

### 5. Proactive Consultation CTAs

**In Prompt System** (`server/prompt.js`):
- After answering substantive questions, suggests consultation
- Natural, low-pressure language
- Includes phone number

**Example**: "Would you like to schedule a free consultation to see if you're a candidate?"

### 6. Analytics Tracking

**Events Tracked**:
- `page_view` - Page load
- `modal_open` - Lead modal opened
- `cta_click` - CTA button clicked
- `lead_submitted` - Lead form submitted
- `buying_intent` - Buying signals detected
- `quick_action_schedule` - Quick action clicked

**Backend**: `POST /analytics/event` endpoint

**Storage**: Firebase Firestore (if configured)

---

## 🚀 Deployment Workflow

### Content Update Workflow

```
1. Edit markdown files in /content/
   ↓
2. Commit and push to GitHub
   ↓
3. Render auto-deploys (runs start.sh)
   ↓
4. start.sh checks if re-index needed
   ↓
5. If needed: npm run index
   ↓
6. Server starts: npm start
   ↓
7. New content is live!
```

### First-Time Deployment

**Backend (Render)**:
1. Push code to GitHub
2. Create Render web service
3. Connect GitHub repo
4. Set environment variables
5. Deploy (auto-runs indexing)

**Frontend (Vercel)**:
1. Push code to GitHub
2. Create Vercel project
3. Set root directory to `client`
4. Deploy

### Re-Indexing After Content Changes

**Automatic** (on Render):
- `start.sh` checks if Supabase is configured
- If first deploy or `FORCE_REINDEX=true`, runs `npm run index`

**Manual** (if needed):
```bash
# In Render Shell
npm run index
```

**Local Testing**:
```bash
npm run index  # Re-index
npm start      # Start server
```

---

## ✅ What's Already Built

### Core RAG System ✅
- [x] Markdown content loading and parsing
- [x] Text chunking (300 words, 50 overlap)
- [x] OpenAI embeddings (text-embedding-3-small)
- [x] Supabase vector storage (pgvector)
- [x] Vector similarity search
- [x] GPT-4o-mini answer generation
- [x] Safety prompts (no hallucinations)
- [x] Fallback responses

### Content Management ✅
- [x] 18 content files (63 chunks)
- [x] Counseling strategies (emotional/financial concerns)
- [x] Qualification and candidacy info
- [x] Social proof content
- [x] All major procedures covered

### Intent Detection ✅
- [x] Greeting detection
- [x] Statement vs question detection
- [x] Procedure interest detection ("I want to get rid of glasses")
- [x] Buying intent detection
- [x] Emotional concern detection
- [x] Financial concern detection

### Conversational Features ✅
- [x] Conversation history support
- [x] Streaming responses (typing effect)
- [x] Query enhancement for emotional/financial concerns
- [x] Lower threshold for counseling content
- [x] Formatted responses (bullet points, line breaks)

### Patient Conversion ✅
- [x] Floating CTA buttons
- [x] Quick action buttons
- [x] Lead capture modal
- [x] Lead submission endpoint
- [x] Analytics tracking
- [x] Buying intent highlighting

### Backend Infrastructure ✅
- [x] Express API server
- [x] Health check endpoint
- [x] CORS configuration
- [x] Error handling
- [x] Request logging
- [x] Render deployment config

### Frontend UI ✅
- [x] Chat interface
- [x] Message history
- [x] Welcome screen
- [x] Suggestion chips
- [x] Loading states
- [x] Mobile responsive
- [x] Dark theme

### Analytics & Logging ✅
- [x] Firebase integration (optional)
- [x] Supabase conversation_logs table
- [x] Query logging
- [x] Event tracking
- [x] Debug info in responses

### Deployment ✅
- [x] Render backend deployment
- [x] Vercel frontend deployment
- [x] Auto-deployment from GitHub
- [x] Environment variable management
- [x] Health checks

---

## 🔮 Future Enhancements (Not Yet Built)

### Potential Additions
- [ ] Admin dashboard for content management
- [ ] A/B testing for CTAs
- [ ] Email/SMS follow-up automation
- [ ] Multi-language support
- [ ] Voice input (Whisper API)
- [ ] Integration with practice management software
- [ ] Advanced analytics dashboard
- [ ] Content versioning
- [ ] User authentication for admin features

---

## 📚 Key Files Reference

| File | Purpose |
|------|---------|
| `scripts/index.js` | Content indexing (markdown → embeddings → Supabase) |
| `server/app.js` | Express API server, endpoints |
| `server/rag.js` | RAG pipeline, vector search, answer generation |
| `server/prompt.js` | Safety prompts, intent detection |
| `server/vectorstore-supabase.js` | Supabase vector DB interface |
| `server/supabase.js` | Supabase client initialization |
| `client/embed.html` | Frontend chat widget |
| `content/*.md` | FAQ content files |
| `render.yaml` | Render deployment config |
| `start.sh` | Render startup script |
| `supabase/migrations/001_create_vector_store.sql` | Database schema |

---

## 🛠️ Development Commands

```bash
# Install dependencies
npm install

# Index content (run after content changes)
npm run index

# Start development server
npm start

# Test API
curl -X POST http://localhost:3000/ask \
  -H "Content-Type: application/json" \
  -d '{"query": "What is LASIK?"}'

# Check health
curl http://localhost:3000/health
```

---

## 🔐 Security Notes

- **No PII in logs**: Only question/answer text, no names/emails
- **API keys**: Stored in environment variables, never in code
- **CORS**: Configured for specific domains
- **Input validation**: All inputs sanitized (max 500 chars)
- **Rate limiting**: Not yet implemented (consider for production)
- **HTTPS**: Automatic on Render/Vercel

---

## 📞 Support & Maintenance

### Monitoring
- **Render Dashboard**: View logs, metrics, errors
- **Vercel Dashboard**: View deployment status
- **Supabase Dashboard**: View database, query performance
- **Firebase Console**: View analytics logs (if enabled)

### Common Tasks

**Update Content**:
1. Edit markdown files
2. Commit and push
3. Render auto-re-indexes (or set `FORCE_REINDEX=true`)

**Debug Issues**:
1. Check Render logs
2. Check `/health` endpoint
3. Review `debugInfo` in API responses
4. Check Supabase query performance

**Scale Up**:
- Upgrade Render plan for more resources
- Increase Supabase database size if needed
- Add rate limiting if traffic grows

---

**Last Updated**: January 2025
**Version**: 1.0.0
**Maintained By**: Development Team
