# ⚡ Quick Start (5 Minutes)

Get your FAQ assistant running in 5 minutes!

## 1. Install Dependencies (1 min)

```bash
npm install
```

## 2. Add OpenAI API Key (1 min)

Create `.env` file:

```env
OPENAI_API_KEY=sk-your-key-here
PORT=3000
CLINIC_PHONE=555-123-4567
CLINIC_NAME=Your Practice Name
```

## 3. Index Content (2 min)

```bash
npm run index
```

Wait for: `✅ Indexing completed successfully!`

## 4. Start Server (30 sec)

```bash
npm start
```

## 5. Test It! (30 sec)

### Browser Test
Open: `client/embed.html`

### Command Line Test
```bash
curl -X POST http://localhost:3000/ask \
  -H "Content-Type: application/json" \
  -d '{"query": "What is LASIK?"}'
```

---

**That's it!** 🎉

See `README.md` for full documentation.
See `SETUP_GUIDE.md` for detailed setup instructions.



