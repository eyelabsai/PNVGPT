/**
 * Script to create a test user in Supabase
 * 
 * Usage: node scripts/create-test-user.js <email> <password> <role> <fullName>
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Error: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createTestUser() {
  const email = process.argv[2] || 'test@gmail.com';
  const password = process.argv[3] || 'test123';
  const role = process.argv[4] || 'user';
  const fullName = process.argv[5] || 'Test User';

  console.log(`🚀 Creating user: ${email}...`);

  try {
    // 1. Create user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName
      }
    });

    if (authError) {
      // Check for various "already exists" error messages
      const isAlreadyRegistered = authError.message.toLowerCase().includes('already') || 
                                  authError.message.includes('registered') ||
                                  authError.message.includes('exists');
      
      if (isAlreadyRegistered) {
        console.log(`ℹ️  User ${email} already exists in Auth. Updating profile...`);
        // Try to find the user to update their profile
        const { data: users, error: listError } = await supabase.auth.admin.listUsers();
        if (listError) throw listError;
        
        const existingUser = users.users.find(u => u.email === email);
        if (existingUser) {
          console.log(`✅ Found existing user: ${existingUser.id}`);
          await updateProfile(existingUser.id, email, role, fullName);
        } else {
          console.error(`❌ Could not find user ${email} in user list`);
        }
      } else {
        throw authError;
      }
    } else {
      console.log(`✅ Auth user created: ${authData.user.id}`);
      await updateProfile(authData.user.id, email, role, fullName);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

async function updateProfile(id, email, role, fullName) {
  console.log(`🔄 Updating profile for ${email} to role: ${role}...`);
  
  // The trigger should have created the profile, but we'll upsert just in case
  const { error: profileError } = await supabase
    .from('user_profiles')
    .upsert({ 
      id, 
      email, 
      role, 
      full_name: fullName,
      updated_at: new Date().toISOString()
    });

  if (profileError) {
    console.error('❌ Error updating profile:', profileError.message);
  } else {
    console.log(`✅ Profile updated successfully!`);
    console.log(`\nUser Details:`);
    console.log(`- Email: ${email}`);
    console.log(`- Password: (hidden)`);
    console.log(`- Role: ${role}`);
    console.log(`- Full Name: ${fullName}`);
  }
}

createTestUser();
