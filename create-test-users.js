/**
 * Create Test Users Script
 * Uses Supabase Auth API to properly create test users
 *
 * Run with: node create-test-users.js
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Use service role key to bypass RLS and create users as admin
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables!');
  console.error('Make sure EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const testUsers = [
  {
    email: 'admin@skibidi.com',
    password: 'password123',
    full_name: 'Admin Principale',
    role: 'admin'
  },
  {
    email: 'cassiere@skibidi.com',
    password: 'password123',
    full_name: 'Mario Rossi',
    role: 'admin'
  },
  {
    email: 'cliente1@skibidi.com',
    password: 'password123',
    full_name: 'Luigi Bianchi',
    role: 'customer'
  },
  {
    email: 'cliente2@skibidi.com',
    password: 'password123',
    full_name: 'Giuseppe Verdi',
    role: 'customer'
  },
  {
    email: 'cliente3@skibidi.com',
    password: 'password123',
    full_name: 'Anna Ferrari',
    role: 'customer'
  }
];

async function createTestUsers() {
  console.log('🚀 Creating test users...\n');

  for (const user of testUsers) {
    try {
      // Create user with admin privileges (auto-confirm email)
      const { data, error } = await supabase.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true,
        user_metadata: {
          full_name: user.full_name,
          role: user.role
        }
      });

      if (error) {
        console.error(`❌ Failed to create ${user.email}:`, error.message);
        continue;
      }

      // Update profile with role and name
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: data.user.id,
          email: user.email,
          full_name: user.full_name,
          role: user.role
        });

      if (profileError) {
        console.error(`⚠️  Profile creation failed for ${user.email}:`, profileError.message);
      } else {
        console.log(`✅ Created ${user.role.toUpperCase()}: ${user.email} (${user.full_name})`);
      }

    } catch (err) {
      console.error(`❌ Unexpected error creating ${user.email}:`, err.message);
    }
  }

  console.log('\n✨ Done! Test users created.');
  console.log('\nLogin credentials (all users):');
  console.log('Password: password123\n');
  console.log('Admin users:');
  console.log('  - admin@skibidi.com');
  console.log('  - cassiere@skibidi.com\n');
  console.log('Customer users:');
  console.log('  - cliente1@skibidi.com');
  console.log('  - cliente2@skibidi.com');
  console.log('  - cliente3@skibidi.com');
}

createTestUsers().catch(console.error);
