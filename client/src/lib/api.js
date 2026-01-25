/**
 * API Helper for authenticated requests
 * 
 * Provides utilities for making API calls with Supabase auth tokens.
 */

import { supabase } from './supabase'

// API base URL - matches pattern from ChatInterface
export const API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.DEV 
  ? 'http://localhost:3000' 
  : 'https://pnvgpt.onrender.com')

/**
 * Get the current Supabase access token
 * @returns {Promise<string|null>} Access token or null
 */
export async function getAccessToken() {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token || null
}

/**
 * Get authorization headers for API requests
 * @returns {Promise<Object>} Headers object with Authorization
 */
export async function getAuthHeaders() {
  const token = await getAccessToken()
  if (!token) {
    throw new Error('Not authenticated')
  }
  return {
    'Authorization': `Bearer ${token}`
  }
}

/**
 * Check user's role by calling /auth/me
 * @returns {Promise<Object>} { authenticated: boolean, role: string|null, user: object|null }
 */
export async function checkUserRole() {
  try {
    const token = await getAccessToken()
    console.log('🔍 checkUserRole - token exists:', !!token)
    
    if (!token) {
      return { authenticated: false, role: null, user: null }
    }

    console.log('🔍 Calling /auth/me...')
    const response = await fetch(`${API_BASE}/auth/me`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })

    console.log('🔍 /auth/me response status:', response.status)

    if (!response.ok) {
      console.log('🔍 /auth/me response not ok')
      return { authenticated: false, role: null, user: null }
    }

    const data = await response.json()
    console.log('🔍 /auth/me response data:', JSON.stringify(data))
    console.log('🔍 data.user:', data.user)
    console.log('🔍 data.user?.role:', data.user?.role)
    
    if (data.authenticated) {
      const extractedRole = data.user?.role || null
      console.log('🔍 Extracted role from response:', extractedRole)
      const result = {
        authenticated: true,
        role: extractedRole,
        user: data.user
      }
      console.log('🔍 Returning role result:', JSON.stringify(result))
      return result
    }

    return { authenticated: false, role: null, user: null }
  } catch (error) {
    console.error('Error checking user role:', error)
    return { authenticated: false, role: null, user: null }
  }
}

/**
 * Make an authenticated JSON API request
 * @param {string} endpoint - API endpoint (e.g., '/api/clinician/rubrics')
 * @param {Object} options - Fetch options
 * @returns {Promise<Object>} JSON response
 */
export async function apiRequest(endpoint, options = {}) {
  const authHeaders = await getAuthHeaders()
  
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...options.headers
    }
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }))
    throw new Error(error.error || error.message || `HTTP ${response.status}`)
  }

  return response.json()
}

/**
 * Make an authenticated multipart form request (for file uploads)
 * @param {string} endpoint - API endpoint
 * @param {FormData} formData - Form data with files
 * @returns {Promise<Object>} JSON response
 */
export async function apiUpload(endpoint, formData) {
  const authHeaders = await getAuthHeaders()
  
  const response = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: {
      ...authHeaders
      // Don't set Content-Type - browser will set it with boundary for multipart
    },
    body: formData
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Upload failed' }))
    throw new Error(error.error || error.message || `HTTP ${response.status}`)
  }

  return response.json()
}
