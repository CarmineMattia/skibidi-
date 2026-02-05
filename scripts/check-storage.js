/**
 * Check and setup Supabase Storage bucket for product images
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkStorage() {
  console.log('Checking Supabase Storage...\n');

  // List all buckets
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();

  if (listError) {
    console.error('Error listing buckets:', listError);
    return;
  }

  console.log('Existing buckets:');
  buckets.forEach(bucket => {
    console.log(`  - ${bucket.name} (${bucket.public ? 'public' : 'private'})`);
  });

  // Check if 'products' bucket exists
  const productsBucket = buckets.find(b => b.name === 'products');

  if (!productsBucket) {
    console.log('\n⚠️  "products" bucket does not exist!');
    console.log('\nTo fix this, go to your Supabase Dashboard:');
    console.log('1. Navigate to Storage');
    console.log('2. Click "New Bucket"');
    console.log('3. Name it "products"');
    console.log('4. Make it PUBLIC');
    console.log('5. Click Create');
  } else {
    console.log(`\n✅ "products" bucket exists and is ${productsBucket.public ? 'PUBLIC' : 'PRIVATE'}`);

    if (!productsBucket.public) {
      console.log('⚠️  WARNING: Bucket should be PUBLIC for images to display!');
    }

    // Try to list files
    const { data: files, error: filesError } = await supabase.storage
      .from('products')
      .list();

    if (filesError) {
      console.error('\n❌ Error accessing bucket:', filesError.message);
      console.log('\nThis might be due to RLS policies. You may need to configure storage policies.');
    } else {
      console.log(`\n📁 Found ${files.length} files in bucket`);
      if (files.length > 0) {
        console.log('Sample files:');
        files.slice(0, 5).forEach(file => {
          console.log(`  - ${file.name}`);
        });
      }
    }
  }
}

checkStorage().catch(console.error);
