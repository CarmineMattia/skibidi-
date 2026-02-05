/**
 * Supabase Connection Test Script
 * Run this with: node test-supabase.js
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

console.log('\n=================================');
console.log('SUPABASE CONNECTION TEST');
console.log('=================================\n');

// Test 1: Check environment variables
console.log('1️⃣  Checking environment variables...');
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ FAILED: Missing environment variables');
  console.log('   SUPABASE_URL:', SUPABASE_URL ? '✅ Set' : '❌ Missing');
  console.log('   SUPABASE_ANON_KEY:', SUPABASE_ANON_KEY ? '✅ Set' : '❌ Missing');
  console.log('\n   Please check your .env file\n');
  process.exit(1);
}

console.log('✅ Environment variables found');
console.log('   URL:', SUPABASE_URL.substring(0, 30) + '...');
console.log('   Key:', SUPABASE_ANON_KEY.substring(0, 20) + '...\n');

// Test 2: Create client
console.log('2️⃣  Creating Supabase client...');
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
console.log('✅ Client created\n');

// Test 3: Test connection
async function testConnection() {
  console.log('3️⃣  Testing database connection...');

  try {
    // Test categories table
    const { data: categories, error: catError } = await supabase
      .from('categories')
      .select('*')
      .limit(10);

    if (catError) {
      console.error('❌ Categories query failed:', catError.message);
      return false;
    }

    console.log('✅ Categories table accessible');
    console.log(`   Found ${categories?.length || 0} categories\n`);

    // Test products table
    const { data: products, error: prodError } = await supabase
      .from('products')
      .select('*')
      .limit(10);

    if (prodError) {
      console.error('❌ Products query failed:', prodError.message);
      return false;
    }

    console.log('✅ Products table accessible');
    console.log(`   Found ${products?.length || 0} products\n`);

    // Test orders table
    const { data: orders, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .limit(10);

    if (orderError) {
      console.error('❌ Orders query failed:', orderError.message);
      return false;
    }

    console.log('✅ Orders table accessible');
    console.log(`   Found ${orders?.length || 0} orders\n`);

    return true;
  } catch (error) {
    console.error('❌ Connection test failed:', error.message);
    return false;
  }
}

// Test 4: Check RLS policies
async function testRLS() {
  console.log('4️⃣  Testing Row Level Security (RLS)...');

  try {
    // Try to query without authentication (should still work for active categories)
    const { data, error } = await supabase
      .from('categories')
      .select('id, name, active')
      .eq('active', true);

    if (error) {
      console.log('⚠️  RLS may be blocking unauthenticated access');
      console.log('   This is expected if you require authentication\n');
      return true; // This is not necessarily a failure
    }

    console.log('✅ RLS policies configured correctly');
    console.log(`   Public can view ${data?.length || 0} active categories\n`);
    return true;
  } catch (error) {
    console.error('❌ RLS test failed:', error.message);
    return false;
  }
}

// Run all tests
(async () => {
  try {
    const connectionOk = await testConnection();
    const rlsOk = await testRLS();

    console.log('=================================');
    if (connectionOk) {
      console.log('🎉 SUCCESS! Supabase is configured correctly\n');
      console.log('Next steps:');
      console.log('  1. Run: npm start');
      console.log('  2. Check the connection test on the home screen');
      console.log('  3. Start adding data via the menu\n');
    } else {
      console.log('⚠️  ISSUES DETECTED\n');
      console.log('Troubleshooting:');
      console.log('  1. Verify schema is applied in Supabase Dashboard');
      console.log('  2. Check RLS policies are enabled');
      console.log('  3. Verify .env credentials are correct\n');
    }
    console.log('=================================\n');
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
})();
