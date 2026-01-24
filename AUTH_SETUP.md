# 🔐 Authentication Setup Guide

## Overview

PNVGPT uses **Supabase Auth** for user authentication. This is the recommended approach because:
- ✅ You already have Supabase set up (vector database)
- ✅ Built-in auth with email, OAuth, magic links
- ✅ Free tier is generous
- ✅ User data in same database
- ✅ Row Level Security (RLS) for access control

---

## 🚀 Quick Setup

### Step 1: Run the Migration

1. Go to your Supabase Dashboard → SQL Editor
2. Copy and paste the contents of `supabase/migrations/002_create_auth_tables.sql`
3. Click "Run" to execute

This creates:
- `user_profiles` table (extends auth.users)
- `admin_sessions` table (optional tracking)
- RLS policies for security
- Auto-create profile trigger

### Step 2: Enable Email Auth

1. Go to **Authentication** → **Providers** in Supabase Dashboard
2. Enable **Email** provider
3. (Optional) Configure email templates
4. (Optional) Set up custom SMTP if you want branded emails

### Step 3: Get Your Auth Keys

You'll need two keys:

1. **ANON KEY** (for client-side):
   - Go to **Settings** → **API**
   - Copy the `anon` `public` key
   - Add to `.env`: `SUPABASE_ANON_KEY=your_anon_key_here`

2. **SERVICE KEY** (already have this):
   - Same page, copy the `service_role` `secret` key
   - Already in `.env` as `SUPABASE_SERVICE_KEY`

### Step 4: Create Your First Admin User

**Option A: Via Supabase Dashboard**
1. Go to **Authentication** → **Users**
2. Click "Add user" → "Create new user"
3. Enter email and password
4. Go to **Table Editor** → `user_profiles`
5. Find your user and set `role = 'admin'`

**Option B: Via API (after setting up client)**
```javascript
// Use Supabase client SDK to sign up, then update role
```

---

## 📱 Client-Side Implementation

### Install Supabase Client

```bash
npm install @supabase/supabase-js
```

### Create Supabase Client

```javascript
// client/src/lib/supabase.js
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

### Sign Up

```javascript
const { data, error } = await supabase.auth.signUp({
  email: 'user@example.com',
  password: 'password123',
  options: {
    data: {
      full_name: 'John Doe'
    }
  }
})
```

### Sign In

```javascript
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'password123'
})

if (data.session) {
  // Store token for API calls
  localStorage.setItem('auth_token', data.session.access_token)
}
```

### Sign Out

```javascript
await supabase.auth.signOut()
```

### Get Current User

```javascript
const { data: { user } } = await supabase.auth.getUser()
```

### Use Token in API Calls

```javascript
// When making API calls to your backend
const token = localStorage.getItem('auth_token')

fetch('https://your-api.com/admin/dashboard', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
})
```

---

## 🔒 Protected Routes

### Backend (Express)

```javascript
const { requireAuth } = require('./server/auth')

// Admin-only endpoint
app.get('/admin/dashboard', requireAuth(['admin']), (req, res) => {
  // req.user contains authenticated user info
  res.json({ data: 'admin data' })
})

// Admin or staff
app.get('/admin/reports', requireAuth(['admin', 'staff']), (req, res) => {
  res.json({ data: 'reports' })
})
```

### Frontend (React)

```javascript
import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'

function AdminDashboard() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkUser()
  }, [])

  async function checkUser() {
    const { data: { user } } = await supabase.auth.getUser()
    setUser(user)
    setLoading(false)
  }

  if (loading) return <div>Loading...</div>
  if (!user) return <div>Please log in</div>

  return <div>Admin Dashboard</div>
}
```

---

## 🎯 User Roles

- **`user`**: Regular user (default)
- **`staff`**: Staff member (can access staff endpoints)
- **`admin`**: Administrator (full access)

Update roles in `user_profiles` table:

```sql
UPDATE user_profiles SET role = 'admin' WHERE email = 'admin@example.com';
```

---

## 🔐 Security Best Practices

1. **Never expose SERVICE_KEY on client** - Only use ANON_KEY
2. **Use RLS policies** - They're already set up in the migration
3. **Validate tokens server-side** - Always verify on backend
4. **Set token expiration** - Supabase handles this automatically
5. **Use HTTPS** - Always in production

---

## 📊 Example: Admin Dashboard

```javascript
// client/src/pages/AdminDashboard.jsx
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function AdminDashboard() {
  const [user, setUser] = useState(null)
  const [data, setData] = useState(null)

  useEffect(() => {
    loadDashboard()
  }, [])

  async function loadDashboard() {
    // Get current session
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session) {
      window.location.href = '/login'
      return
    }

    // Fetch dashboard data
    const token = session.access_token
    const response = await fetch('http://localhost:3000/admin/dashboard', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })

    const result = await response.json()
    setData(result.data)
    setUser(result.data.user)
  }

  if (!data) return <div>Loading...</div>

  return (
    <div>
      <h1>Admin Dashboard</h1>
      <p>Welcome, {user.email}</p>
      <p>Total Queries: {data.totalQueries}</p>
      {/* More dashboard content */}
    </div>
  )
}
```

---

## 🆚 Supabase vs Firebase Auth

| Feature | Supabase Auth | Firebase Auth |
|--------|---------------|----------------|
| **Setup** | ✅ Already have Supabase | ❌ Need to add Firebase |
| **Database** | ✅ Same as vector DB | ❌ Separate service |
| **Free Tier** | ✅ 50,000 MAU | ✅ 50,000 MAU |
| **OAuth Providers** | ✅ 20+ providers | ✅ 20+ providers |
| **Magic Links** | ✅ Built-in | ✅ Built-in |
| **RLS Integration** | ✅ Native PostgreSQL | ❌ Separate rules |
| **Cost** | ✅ Free tier generous | ✅ Free tier generous |

**Recommendation: Use Supabase** since you already have it set up!

---

## 🐛 Troubleshooting

### "Token verification failed"
- Check that `SUPABASE_SERVICE_KEY` is set correctly
- Verify token is being sent in `Authorization: Bearer <token>` header
- Check token hasn't expired

### "User not found in user_profiles"
- The trigger should auto-create profiles, but if not:
  ```sql
  INSERT INTO user_profiles (id, email, role)
  VALUES ('user-uuid', 'user@example.com', 'user');
  ```

### "RLS policy violation"
- Check that RLS policies are correct
- Verify user role matches policy requirements
- Check `is_active` is `true`

---

## 📚 Resources

- [Supabase Auth Docs](https://supabase.com/docs/guides/auth)
- [Supabase RLS Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [Supabase JS Client](https://supabase.com/docs/reference/javascript/introduction)

---

**Next Steps:**
1. Run the migration SQL
2. Enable Email auth in Supabase Dashboard
3. Add `SUPABASE_ANON_KEY` to `.env`
4. Create your first admin user
5. Implement client-side auth in your React app
