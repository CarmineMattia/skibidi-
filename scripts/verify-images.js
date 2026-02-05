const { createClient } = require('@supabase/supabase-js');

// Hardcoded credentials
const supabaseUrl = 'https://zqubwvhstobaugifzoyb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpxdWJ3dmhzdG9iYXVnaWZ6b3liIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0MDg3OTksImV4cCI6MjA4Mzk4NDc5OX0.IWQDg4CNo8UHVMkFhXVkDG1O1IxoADpMX938kapr-SE';

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyImages() {
    console.log('--- Verifying Images ---');

    // 1. Check Storage Bucket
    console.log('\n1. Checking "products" bucket...');
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    if (listError) {
        console.error('Error listing buckets:', listError);
    } else {
        const productsBucket = buckets.find(b => b.name === 'products');
        if (productsBucket) {
            console.log('✅ Bucket "products" exists.');
            const { data: files, error: filesError } = await supabase.storage.from('products').list();
            if (filesError) {
                console.error('Error listing files:', filesError);
            } else {
                console.log(`✅ Found ${files.length} files in the bucket.`);
                if (files.length > 0) {
                    console.log('Sample file:', files[0].name);
                }
            }
        } else {
            console.error('❌ Bucket "products" does NOT exist.');
        }
    }

    // 2. Check Database Records
    console.log('\n2. Checking "products" table for image URLs...');
    const { data: products, error: dbError } = await supabase.from('products').select('*').limit(5);
    if (dbError) {
        console.error('Error fetching products:', dbError);
    } else {
        if (products.length === 0) {
            console.log('⚠️ No products found in the database.');
        } else {
            products.forEach(p => {
                console.log(`Product: ${p.name}`);
                // Check likely column names for images
                console.log(`  - image: ${p.image}`);
                console.log(`  - image_url: ${p.image_url}`);
            });
        }
    }
}

verifyImages();
