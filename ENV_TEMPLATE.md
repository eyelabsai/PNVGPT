# Environment Variables Setup

Create a `.env` file in the root directory with these variables:

```env
# OpenAI API Configuration
OPENAI_API_KEY=your_openai_api_key_here

# Firebase Configuration
FIREBASE_PROJECT_ID=your_firebase_project_id
FIREBASE_PRIVATE_KEY=your_firebase_private_key_here
FIREBASE_CLIENT_EMAIL=your_firebase_client_email

# Server Configuration
PORT=3000
NODE_ENV=development

# Practice Contact Information
CLINIC_PHONE=XXX-XXX-XXXX
CLINIC_NAME=Your Refractive Surgery Practice

# Chroma DB Configuration
CHROMA_COLLECTION_NAME=faq_collection
CHROMA_PATH=./vector-store
```

## Firebase Setup

1. Go to Firebase Console
2. Create a new project or use existing
3. Go to Project Settings > Service Accounts
4. Generate new private key
5. Copy the credentials to your `.env` file



