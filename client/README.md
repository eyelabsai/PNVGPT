# Parkhurst NuVision GPT - ChatGPT-Style Frontend

A modern React-based frontend that replicates ChatGPT's interface design for the Parkhurst NuVision FAQ assistant.

## Features

- ✨ **ChatGPT-style UI** - Exact replica of ChatGPT's modern, clean interface
- 🌓 **Dark/Light Mode** - Toggle between themes with persistent preferences
- 💬 **Real-time Streaming** - Typewriter effect for AI responses
- 📱 **Responsive Design** - Works perfectly on desktop and mobile
- 💾 **Chat History** - Sidebar with conversation history (client-side for now)
- 🎨 **Beautiful Animations** - Smooth transitions and loading states

## Setup

### Prerequisites

- Node.js 18+ and npm

### Installation

Install frontend dependencies:

```bash
cd client
npm install
```

Or from the root directory:

```bash
npm run install:client
```

### Development with Hot Reloading

**Option 1: Run frontend only** (if backend is already running):

```bash
cd client
npm run dev
```

The app will be available at `http://localhost:5173` with **hot reloading** - any changes you make will automatically refresh in the browser! ✨

**Option 2: Run both frontend and backend** (recommended for full development):

From the root directory, run in separate terminals:

Terminal 1 (Backend):
```bash
npm run dev:server
```

Terminal 2 (Frontend):
```bash
npm run dev:client
```

Or use `concurrently` for a single command (if installed):
```bash
npm install -g concurrently
concurrently "npm run dev:server" "npm run dev:client"
```

### Hot Reloading

The Vite dev server automatically:
- ✅ Detects file changes
- ✅ Refreshes the browser instantly
- ✅ Preserves component state during updates
- ✅ Shows build errors in the browser

No need to manually refresh or push to git - just save your file and see changes immediately!

### Building for Production

```bash
npm run build
```

The built files will be in the `dist/` directory.

## Project Structure

```
client/
├── src/
│   ├── components/
│   │   ├── ChatInterface.jsx    # Main chat UI
│   │   ├── ChatInterface.css
│   │   ├── ChatSidebar.jsx      # Sidebar with chat history
│   │   └── ChatSidebar.css
│   ├── App.jsx                  # Main app component
│   ├── App.css
│   ├── main.jsx                 # React entry point
│   └── index.css                # Global styles
├── index.html
├── package.json
└── vite.config.js              # Vite configuration
```

## Clinician Coach & Test Login

- **Coach (home):** From the landing page, click **Coach** in the nav or **Go to Coach** on the Scheduling Coach card. Or go directly to `/coach` (or `/clinician/coach`).
- **Coach (Vercel):** [https://refractivegpt.vercel.app/coach](https://refractivegpt.vercel.app/coach)
- **Login:** Use **App Login** or go to `/login`. After signing in, clinician/admin accounts are redirected to the coach; others go to the patient chat.

**Test clinician login:** There is no built-in test user. Create one with the script from the repo root:

```bash
node scripts/create-test-user.js doctor@test.com YourPassword clinician "Dr Test"
```

Then sign in at `/login` with `doctor@test.com` and your password. (You can use any email/password; the script creates the user in Supabase and sets role to `clinician`.)

## API Integration

The frontend integrates with your existing backend endpoints:

- `POST /ask` - Non-streaming chat endpoint
- `POST /ask/stream` - Streaming chat endpoint (preferred)
- `POST /lead` - Lead capture
- `POST /log-event` - Analytics

## Customization

### Colors & Theme

Edit CSS variables in `App.css`:

```css
:root {
  --bg-primary: #ffffff;
  --text-primary: #353740;
  /* ... */
}
```

### API Base URL

Update `API_BASE` in `src/components/ChatInterface.jsx`:

```javascript
const API_BASE = import.meta.env.DEV 
  ? 'http://localhost:3000' 
  : 'https://your-production-url.com'
```

## Deployment

### Vercel

The project is configured for Vercel deployment:

1. Push to your repository
2. Import project in Vercel
3. Set build command: `npm run build`
4. Set output directory: `dist`

### Other Platforms

Build the project and serve the `dist/` directory as static files.
