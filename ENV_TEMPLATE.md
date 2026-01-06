# Environment Variables Setup

Create a `.env` file in the root directory with these variables:

```env
# ===========================================
# REQUIRED
# ===========================================

# OpenAI API Configuration
OPENAI_API_KEY=your_openai_api_key_here

# Practice Contact Information
CLINIC_PHONE=XXX-XXX-XXXX
CLINIC_NAME=Your Refractive Surgery Practice

# Server Configuration
PORT=3000
NODE_ENV=development

# ===========================================
# SUPABASE (Recommended for production)
# ===========================================
# If configured, uses Supabase pgvector for fast vector search
# If not configured, falls back to local JSON file storage

SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your_supabase_service_role_key

# ===========================================
# FIREBASE (Optional - for legacy logging)
# ===========================================

FIREBASE_PROJECT_ID=your_firebase_project_id
FIREBASE_PRIVATE_KEY=your_firebase_private_key_here
FIREBASE_CLIENT_EMAIL=your_firebase_client_email

# ===========================================
# LEGACY (kept for backwards compatibility)
# ===========================================

CHROMA_COLLECTION_NAME=faq_collection
CHROMA_PATH=./vector-store
```

## Quick Start

### Option 1: Supabase (Recommended)

1. Create a free account at [supabase.com](https://supabase.com)
2. Create a new project
3. Go to SQL Editor and run the migration:
   - Copy contents of `supabase/migrations/001_create_vector_store.sql`
   - Paste and run in Supabase SQL Editor
4. Go to Settings > API
5. Copy the **Project URL** → `SUPABASE_URL`
6. Copy the **service_role key** (not anon key!) → `SUPABASE_SERVICE_KEY`
7. Run `npm run index` to populate the vector store
8. Run `npm start`

### Option 2: Local JSON (Quick testing)

1. Just set `OPENAI_API_KEY`
2. Run `npm run index`
3. Run `npm start`
4. (Supabase will be skipped, uses local file storage)

## Firebase Setup (Optional)

Firebase is optional and only used for logging queries to Firestore.

1. Go to Firebase Console
2. Create a new project or use existing
3. Go to Project Settings > Service Accounts
4. Generate new private key
5. Copy the credentials to your `.env` file

## Security Notes

- **Never commit `.env` to git!** (it's in .gitignore)
- Use `SUPABASE_SERVICE_KEY` (service_role) for server-side, NOT the anon key
- The service key bypasses Row Level Security - only use on server
