/**
 * Test image upload to Supabase Storage
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testUpload() {
  console.log('Testing image upload to Supabase Storage...\n');

  // Create a simple test text file (simulating an image)
  const testContent = 'Test file content';
  const fileName = `test-${Date.now()}.txt`;

  try {
    // Try to upload
    console.log('1. Uploading test file...');
    const { data, error } = await supabase.storage
      .from('products')
      .upload(fileName, testContent, {
        contentType: 'text/plain',
        upsert: true,
      });

    if (error) {
      console.error('❌ Upload failed:', error.message);
      console.error('Error details:', JSON.stringify(error, null, 2));
      return;
    }

    console.log('✅ Upload successful!');
    console.log('   Path:', data.path);

    // Get public URL
    console.log('\n2. Getting public URL...');
    const { data: { publicUrl } } = supabase.storage
      .from('products')
      .getPublicUrl(fileName);

    console.log('✅ Public URL:', publicUrl);

    // Try to delete the test file
    console.log('\n3. Cleaning up test file...');
    const { error: deleteError } = await supabase.storage
      .from('products')
      .remove([fileName]);

    if (deleteError) {
      console.warn('⚠️  Could not delete test file:', deleteError.message);
    } else {
      console.log('✅ Test file deleted');
    }

    console.log('\n✅ All tests passed! Image upload should work in the app.');
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testUpload();
