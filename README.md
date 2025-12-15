# PNVGPT - RAG-Based FAQ Assistant for Refractive Surgery Practice

A production-ready FAQ assistant that combines **ChromaDB** (vector database) and **Firebase Firestore** (analytics/logging) to provide accurate, hallucination-free answers about refractive surgery procedures.

## 🎯 Features

- **Zero Hallucinations**: Only answers from approved content
- **Practice-Specific Language**: Uses approved medical terminology
- **Easy Content Updates**: Markdown-based FAQ management
- **Cost-Effective**: Uses GPT-4o-mini and small embeddings
- **Patient-Safe**: HIPAA-compliant logging (no PII)
- **Firebase Integration**: Full analytics and query logging
- **Local Vector Storage**: ChromaDB for fast retrieval

## 📁 Project Structure

```
PNVGPT/
├── content/                    # Markdown FAQ files
│   ├── lasik-basics.md
│   ├── recovery-aftercare.md
│   ├── prk-information.md
│   ├── cost-insurance.md
│   └── consultation-preparation.md
├── scripts/
│   └── index.js               # Indexing script (embed content)
├── server/
│   ├── app.js                 # Express API server
│   ├── rag.js                 # RAG pipeline logic
│   ├── prompt.js              # Safety prompt templates
│   └── firebase.js            # Firebase/Firestore integration
├── client/
│   ├── embed.html             # Demo chat widget
│   └── embed-snippet.js       # Embeddable widget code
├── vector-store/              # ChromaDB storage (auto-created)
├── package.json
├── .env                       # Environment variables
└── README.md
```

## 🚀 Quick Start

### 1. Prerequisites

- Node.js 16+ installed
- OpenAI API key
- Firebase project (optional, for logging)

### 2. Installation

```bash
# Clone/navigate to project
cd PNVGPT

# Install dependencies
npm install
```

### 3. Configuration

Create a `.env` file in the root directory:

```env
# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key_here

# Firebase Configuration (optional)
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=your-service-account@project.firebase.com

# Server Configuration
PORT=3000
NODE_ENV=development

# Practice Information
CLINIC_PHONE=XXX-XXX-XXXX
CLINIC_NAME=Your Refractive Surgery Practice

# ChromaDB Configuration
CHROMA_COLLECTION_NAME=faq_collection
CHROMA_PATH=./vector-store
```

**Firebase Setup (Optional):**
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create a project (or use existing)
3. Go to Project Settings → Service Accounts
4. Click "Generate New Private Key"
5. Copy credentials to `.env` file

### 4. Index Your Content

This step embeds all FAQ content into the vector database:

```bash
npm run index
```

You should see:
```
✅ Indexing completed successfully!
📊 Summary:
   - Files processed: 5
   - Total chunks: 45
   - Collection: faq_collection
```

### 5. Start the Server

```bash
npm start
```

Server will start on `http://localhost:3000`

### 6. Test the API

```bash
curl -X POST http://localhost:3000/ask \
  -H "Content-Type: application/json" \
  -d '{"query": "What is LASIK?"}'
```

Expected response:
```json
{
  "answer": "LASIK (Laser-Assisted In Situ Keratomileusis) is a popular refractive surgery procedure...",
  "metadata": {
    "responseTime": 1234,
    "retrievedChunks": 3,
    "usedFallback": false,
    "timestamp": 1234567890
  }
}
```

## 📡 API Endpoints

### `POST /ask`
Ask a question to the FAQ assistant.

**Request:**
```json
{
  "query": "How long does LASIK take?"
}
```

**Response:**
```json
{
  "answer": "The LASIK procedure itself typically takes about 10-15 minutes per eye...",
  "metadata": {
    "responseTime": 1234,
    "retrievedChunks": 3,
    "usedFallback": false
  }
}
```

### `GET /health`
Check system health status.

**Response:**
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

### `GET /status`
Simple status check.

**Response:**
```json
{
  "status": "online",
  "uptime": 12345,
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## 🎨 Frontend Integration

### Option 1: Demo Page

Open the demo chat widget:

```bash
# Serve the demo page (or open in browser)
open client/embed.html
```

Update the API URL in `embed.html` if your server is not on localhost:3000.

### Option 2: Embed Snippet

Add to your website's HTML:

```html
<script src="path/to/client/embed-snippet.js"></script>
```

The widget will automatically appear in the bottom-right corner.

**Customize the widget:**

Edit configuration in `embed-snippet.js`:
```javascript
const CONFIG = {
    apiUrl: 'https://your-domain.com/ask',
    position: 'bottom-right',
    primaryColor: '#667eea',
    buttonText: '💬 Ask a Question'
};
```

### Option 3: Custom Integration

Use the API directly in your JavaScript:

```javascript
async function askFAQ(question) {
  const response = await fetch('http://localhost:3000/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: question })
  });
  const data = await response.json();
  return data.answer;
}
```

## 📝 Adding/Updating FAQ Content

### 1. Add New Content

Create a new markdown file in `/content/`:

```markdown
# New Topic

## Question 1?
Answer to question 1...

## Question 2?
Answer to question 2...
```

### 2. Re-index

After adding or updating content:

```bash
npm run index
```

This will:
- Delete the old collection
- Re-embed all content
- Create a fresh vector database

### 3. Restart Server

```bash
npm start
```

## 🛡️ Safety Features

The system implements multiple safety layers:

1. **Retrieval-Only Responses**: Only uses retrieved content
2. **Fallback Messages**: Returns clinic phone number if unsure
3. **No Medical Diagnosis**: Redirects clinical questions to office
4. **Approved Terminology**: Uses practice-specific language
5. **No Hallucinations**: Low temperature (0.3) for factual responses
6. **Content Validation**: Similarity threshold filtering

### Safety Prompt

Located in `server/prompt.js`, the prompt enforces:
- Only answer from retrieved information
- Never invent instructions or details
- Redirect urgent symptoms to calling office
- Use concise, reassuring language

## 📊 Firebase Analytics

All queries are logged to Firestore in the `faq_logs` collection:

```javascript
{
  question: "What is LASIK?",
  answer: "LASIK is a...",
  retrievedChunks: [
    { id: "...", filename: "lasik-basics.md", similarity: 0.92 }
  ],
  timestamp: Firestore.Timestamp,
  metadata: {
    responseTime: 1234,
    chunkCount: 3,
    tokensUsed: 245
  }
}
```

**View logs:**
```javascript
const { getQueryLogs } = require('./server/firebase');

const logs = await getQueryLogs({
  limit: 100,
  startDate: new Date('2024-01-01')
});
```

## 🔧 Configuration Options

### Embedding Model
Change in `server/rag.js` and `scripts/index.js`:
```javascript
const EMBEDDING_MODEL = 'text-embedding-3-small'; // or 3-large
```

### GPT Model
Change in `server/rag.js`:
```javascript
const GPT_MODEL = 'gpt-4o-mini'; // or gpt-4o, gpt-4
```

### Chunk Size
Change in `scripts/index.js`:
```javascript
const CHUNK_SIZE = 300;  // Words per chunk
const CHUNK_OVERLAP = 50; // Overlap between chunks
```

### Retrieval Settings
Change in `server/rag.js`:
```javascript
const TOP_K_RESULTS = 3;              // Number of chunks to retrieve
const SIMILARITY_THRESHOLD = 0.5;     // Minimum similarity score
```

## 🚧 Future Features (Scaffolded)

The following endpoints are scaffolded but not implemented:

- `POST /auth/login` - Admin authentication
- `GET /admin/dashboard` - Admin analytics dashboard
- `POST /admin/content` - Update content via UI
- `POST /ask/voice` - Voice input with Whisper
- `POST /ask/translate` - Multilingual support

## 🐛 Troubleshooting

### Error: "Collection not found"
**Solution:** Run `npm run index` first to create the vector database.

### Error: "OpenAI API key invalid"
**Solution:** Check your `.env` file has correct `OPENAI_API_KEY`.

### Firebase warnings
**Solution:** Firebase is optional. Add credentials to enable logging, or ignore warnings.

### ChromaDB errors
**Solution:** Delete `vector-store/` folder and re-run `npm run index`.

### Port already in use
**Solution:** Change `PORT` in `.env` file or kill the process:
```bash
lsof -ti:3000 | xargs kill
```

## 📦 Dependencies

- **express**: Web server framework
- **openai**: OpenAI API client
- **chromadb**: Vector database client
- **firebase-admin**: Firebase/Firestore SDK
- **markdown-it**: Markdown parser
- **dotenv**: Environment configuration
- **cors**: Cross-origin resource sharing
- **helmet**: Security headers

## 🔐 Security

- ✅ HIPAA-compliant (no PII stored)
- ✅ Helmet.js security headers
- ✅ Input validation and sanitization
- ✅ No sensitive data in responses
- ✅ Error messages don't leak system info

## 📄 License

MIT License - feel free to use for your practice.

## 🤝 Support

For questions or issues:
1. Check troubleshooting section
2. Review Firebase/OpenAI documentation
3. Contact your development team

---

**Built with ❤️ for better patient care**



