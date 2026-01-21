# Quick Start - Local Development

## 🚀 Fastest Way to Get Running

### 1. Install Dependencies (First Time Only)

```bash
cd client
npm install
```

### 2. Make Sure Backend is Running

In a separate terminal, start your backend server:

```bash
# From root directory
npm run dev:server
```

Backend should be running on `http://localhost:3000`

### 3. Start Frontend with Hot Reloading

```bash
# From client directory
npm run dev
```

Frontend will start on `http://localhost:5173`

### 4. Open in Browser

Navigate to `http://localhost:5173` - you should see the ChatGPT-style interface!

## 🔥 Hot Reloading

**Any changes you make will automatically reload!**

- Edit any `.jsx` or `.css` file
- Save the file
- Browser automatically refreshes
- No need to restart the server or push to git

Try it:
1. Open `src/components/ChatInterface.jsx`
2. Change the welcome title
3. Save the file
4. Watch the browser update instantly! ✨

## 🛠️ Troubleshooting

**Frontend won't connect to backend?**
- Make sure backend is running on port 3000
- Check that `vite.config.js` has the correct proxy settings

**Port 5173 already in use?**
- Vite will automatically try the next available port
- Or change the port in `vite.config.js`:
  ```js
  server: {
    port: 5174  // or any other port
  }
  ```

**Dependencies not found?**
- Make sure you ran `npm install` in the `client` directory
- Delete `node_modules` and `package-lock.json`, then run `npm install` again

## 📝 Development Tips

- **Browser DevTools**: Use React DevTools extension for debugging
- **Fast Refresh**: Vite's Fast Refresh preserves component state
- **Error Overlay**: Errors show directly in the browser
- **Network Tab**: Check API calls are proxied correctly to backend
