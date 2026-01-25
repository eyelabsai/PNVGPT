/**
 * Supabase Authentication Middleware
 * 
 * Handles user authentication and authorization for admin/staff access
 */

const { getSupabase } = require('./supabase');
require('dotenv').config();

/**
 * Verify JWT token from request
 * @param {string} token - JWT token from Authorization header
 * @returns {Promise<Object|null>} User object or null if invalid
 */
async function verifyToken(token) {
  try {
    const supabase = getSupabase();
    if (!supabase) {
      throw new Error('Supabase not initialized');
    }

    // Verify token using Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return null;
    }

    // Get user profile with role
    console.log('🔍 Looking up profile for user ID:', user.id, 'email:', user.email);
    
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('id, email, role, is_active')
      .eq('id', user.id)
      .single();

    console.log('🔍 Profile lookup result:');
    console.log('   Profile data:', JSON.stringify(profile));
    console.log('   Profile error:', profileError);
    console.log('   Profile role specifically:', profile?.role);

    if (profileError || !profile || !profile.is_active) {
      console.log('❌ Profile check failed - profileError:', !!profileError, 'profile:', !!profile, 'is_active:', profile?.is_active);
      return null;
    }

    // IMPORTANT: Spread user first, then override with our values
    // The Supabase user.role is 'authenticated' by default, we need OUR profile.role
    console.log('🔐 FINAL ROLE ASSIGNMENT - profile.role:', profile.role, 'user.role:', user.role);
    
    const finalUser = {
      ...user,
      id: user.id,
      email: user.email,
      role: profile.role  // This MUST come after ...user to override Supabase's default 'authenticated' role
    };
    
    console.log('🔐 RETURNING USER WITH ROLE:', finalUser.role);
    return finalUser;
  } catch (error) {
    console.error('Token verification error:', error);
    return null;
  }
}

/**
 * Express middleware to require authentication
 * @param {Array} allowedRoles - Roles allowed to access (default: ['admin', 'staff'])
 */
function requireAuth(allowedRoles = ['admin', 'staff']) {
  return async (req, res, next) => {
    try {
      // Get token from Authorization header
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'No token provided'
        });
      }

      const token = authHeader.substring(7); // Remove 'Bearer ' prefix
      const user = await verifyToken(token);

      if (!user) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Invalid or expired token'
        });
      }

      // Check role
      if (!allowedRoles.includes(user.role)) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Insufficient permissions'
        });
      }

      // Attach user to request
      req.user = user;
      next();
    } catch (error) {
      console.error('Auth middleware error:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Authentication failed'
      });
    }
  };
}

/**
 * Express middleware to optionally authenticate (doesn't fail if no token)
 * Useful for endpoints that work for both authenticated and anonymous users
 */
function optionalAuth() {
  return async (req, res, next) => {
    try {
      const authHeader = req.headers.authorization;
      
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        const user = await verifyToken(token);
        if (user) {
          req.user = user;
        }
      }
      
      next();
    } catch (error) {
      // Don't fail on optional auth errors
      console.error('Optional auth error:', error);
      next();
    }
  };
}

/**
 * Create a new user (admin function)
 * @param {string} email - User email
 * @param {string} password - User password
 * @param {string} role - User role ('user', 'admin', 'staff')
 * @param {string} fullName - User's full name
 * @returns {Promise<Object>} Created user object
 */
async function createUser(email, password, role = 'user', fullName = '') {
  try {
    const supabase = getSupabase();
    if (!supabase) {
      throw new Error('Supabase not initialized');
    }

    // Create user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        full_name: fullName
      }
    });

    if (authError) {
      throw authError;
    }

    // Update role in user_profiles
    const { error: profileError } = await supabase
      .from('user_profiles')
      .update({ role, full_name: fullName })
      .eq('id', authData.user.id);

    if (profileError) {
      console.error('Error updating user profile:', profileError);
    }

    return {
      id: authData.user.id,
      email: authData.user.email,
      role
    };
  } catch (error) {
    console.error('Error creating user:', error);
    throw error;
  }
}

/**
 * Update user role (admin function)
 * @param {string} userId - User ID
 * @param {string} role - New role
 * @returns {Promise<boolean>} Success status
 */
async function updateUserRole(userId, role) {
  try {
    const supabase = getSupabase();
    if (!supabase) {
      throw new Error('Supabase not initialized');
    }

    const { error } = await supabase
      .from('user_profiles')
      .update({ role })
      .eq('id', userId);

    return !error;
  } catch (error) {
    console.error('Error updating user role:', error);
    return false;
  }
}

/**
 * Get user by email
 * @param {string} email - User email
 * @returns {Promise<Object|null>} User object or null
 */
async function getUserByEmail(email) {
  try {
    const supabase = getSupabase();
    if (!supabase) {
      throw new Error('Supabase not initialized');
    }

    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('email', email)
      .single();

    if (error || !data) {
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error getting user:', error);
    return null;
  }
}

module.exports = {
  verifyToken,
  requireAuth,
  optionalAuth,
  createUser,
  updateUserRole,
  getUserByEmail
};
