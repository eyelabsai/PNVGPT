/**
 * Clinician Protected Route
 * 
 * Wraps routes that require clinician or admin role.
 * Checks both Supabase session AND server-side role verification.
 */

import React, { useState, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { checkUserRole } from '../lib/api'

const ClinicianProtectedRoute = ({ children }) => {
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState(null)
  const [role, setRole] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let mounted = true

    async function checkAuth() {
      try {
        // First check if we have a Supabase session
        const { data: { session: currentSession } } = await supabase.auth.getSession()
        
        if (!mounted) return

        if (!currentSession) {
          setSession(null)
          setLoading(false)
          return
        }

        setSession(currentSession)

        // Then verify role via server
        console.log('🔐 ClinicianProtectedRoute - checking role...')
        const roleData = await checkUserRole()
        console.log('🔐 ClinicianProtectedRoute - roleData:', roleData)
        
        if (!mounted) return

        if (roleData.authenticated) {
          console.log('🔐 Setting role to:', roleData.role)
          setRole(roleData.role)
        } else {
          console.log('🔐 Not authenticated, setting error')
          setError('Could not verify your role')
        }
      } catch (err) {
        if (mounted) {
          console.error('Auth check error:', err)
          setError(err.message)
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    checkAuth()

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) {
        setSession(session)
        if (!session) {
          setRole(null)
        }
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  // Loading state
  if (loading) {
    return (
      <div className="clinician-loading">
        <div className="loading-spinner"></div>
        <p>Verifying access...</p>
        <style>{`
          .clinician-loading {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            background: var(--bg-primary, #1a1a2e);
            color: var(--text-primary, #ffffff);
            gap: 1rem;
          }
          .loading-spinner {
            width: 40px;
            height: 40px;
            border: 3px solid rgba(255,255,255,0.1);
            border-top-color: #3b82f6;
            border-radius: 50%;
            animation: spin 1s linear infinite;
          }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    )
  }

  // Not logged in -> redirect to login
  if (!session) {
    return <Navigate to="/login" replace />
  }

  // Logged in but role not verified or not allowed
  const allowedRoles = ['clinician', 'admin']
  if (!role || !allowedRoles.includes(role)) {
    return (
      <div className="clinician-unauthorized">
        <div className="unauthorized-content">
          <h1>Access Denied</h1>
          <p>
            {error || 'You do not have permission to access the clinician coaching area.'}
          </p>
          <p className="role-info">
            Your current role: <strong>{role || 'unknown'}</strong>
          </p>
          <p className="debug-info" style={{fontSize: '0.75rem', color: '#888', marginTop: '0.5rem'}}>
            Debug: Check browser console (F12) for detailed logs
          </p>
          <p className="help-text">
            If you believe this is an error, please contact your administrator to update your role.
          </p>
          <div className="action-buttons">
            <a href="/chat" className="btn-primary">Go to Patient Chat</a>
            <a href="/" className="btn-secondary">Go Home</a>
          </div>
        </div>
        <style>{`
          .clinician-unauthorized {
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            color: #ffffff;
            padding: 2rem;
          }
          .unauthorized-content {
            max-width: 500px;
            text-align: center;
            background: rgba(255,255,255,0.05);
            padding: 3rem;
            border-radius: 16px;
            border: 1px solid rgba(255,255,255,0.1);
          }
          .unauthorized-content h1 {
            color: #ef4444;
            margin-bottom: 1rem;
            font-size: 2rem;
          }
          .unauthorized-content p {
            color: rgba(255,255,255,0.8);
            margin-bottom: 1rem;
            line-height: 1.6;
          }
          .role-info {
            background: rgba(255,255,255,0.05);
            padding: 0.75rem;
            border-radius: 8px;
            font-family: monospace;
          }
          .help-text {
            font-size: 0.9rem;
            color: rgba(255,255,255,0.6);
          }
          .action-buttons {
            display: flex;
            gap: 1rem;
            justify-content: center;
            margin-top: 2rem;
          }
          .btn-primary, .btn-secondary {
            padding: 0.75rem 1.5rem;
            border-radius: 8px;
            text-decoration: none;
            font-weight: 500;
            transition: all 0.2s;
          }
          .btn-primary {
            background: #3b82f6;
            color: white;
          }
          .btn-primary:hover {
            background: #2563eb;
          }
          .btn-secondary {
            background: rgba(255,255,255,0.1);
            color: white;
          }
          .btn-secondary:hover {
            background: rgba(255,255,255,0.2);
          }
        `}</style>
      </div>
    )
  }

  // All checks passed
  return children
}

export default ClinicianProtectedRoute
