const { createClient } = require('@supabase/supabase-js');

// Hardcoded credentials from .env
const supabaseUrl = 'https://zqubwvhstobaugifzoyb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpxdWJ3dmhzdG9iYXVnaWZ6b3liIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0MDg3OTksImV4cCI6MjA4Mzk4NDc5OX0.IWQDg4CNo8UHVMkFhXVkDG1O1IxoADpMX938kapr-SE';

const supabase = createClient(supabaseUrl, supabaseKey);

async function seedAllIngredients() {
    console.log('Fetching all products...');

    const { data: products, error: fetchError } = await supabase
        .from('products')
        .select('*');

    if (fetchError) {
        console.error('Fetch error:', fetchError);
        return;
    }

    console.log(`Found ${products.length} products.`);

    let updatedCount = 0;

    for (const product of products) {
        // Skip if already has ingredients
        if (product.ingredients && product.ingredients.length > 0) {
            console.log(`Skipping ${product.name} (already has ingredients)`);
            continue;
        }

        // Skip if no description
        if (!product.description) {
            console.log(`Skipping ${product.name} (no description)`);
            continue;
        }

        // Parse description into ingredients
        // Split by comma or " e " (and)
        const ingredients = product.description
            .split(/,| e /i)
            .map(i => i.trim())
            .filter(i => i.length > 0 && i.toLowerCase() !== 'e'); // Filter out empty or just "e"

        if (ingredients.length === 0) {
            console.log(`Skipping ${product.name} (could not parse description)`);
            continue;
        }

        console.log(`Updating ${product.name} with ingredients:`, ingredients);

        const { error: updateError } = await supabase
            .from('products')
            .update({ ingredients })
            .eq('id', product.id);

        if (updateError) {
            console.error(`Failed to update ${product.name}:`, updateError.message);
        } else {
            updatedCount++;
        }
    }

    console.log(`\nDone! Updated ${updatedCount} products.`);
}

seedAllIngredients();
