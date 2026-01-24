# Frontend Environment Variables

Create a `.env` file in the `client` directory with these variables:

```env
# Supabase Configuration (Vite requires VITE_ prefix)
VITE_SUPABASE_URL=your_supabase_url_here
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

### Where to find these:
1. Go to your Supabase Dashboard
2. Settings > API
3. Copy **Project URL** into `VITE_SUPABASE_URL`
4. Copy **anon public key** into `VITE_SUPABASE_ANON_KEY`
