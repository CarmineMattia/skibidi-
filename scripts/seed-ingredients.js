const { createClient } = require('@supabase/supabase-js');

// Hardcoded credentials from .env to avoid setup issues
const supabaseUrl = 'https://zqubwvhstobaugifzoyb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpxdWJ3dmhzdG9iYXVnaWZ6b3liIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0MDg3OTksImV4cCI6MjA4Mzk4NDc5OX0.IWQDg4CNo8UHVMkFhXVkDG1O1IxoADpMX938kapr-SE';

const supabase = createClient(supabaseUrl, supabaseKey);

async function seedIngredients() {
    console.log('Searching for "Panino Prosciutto e Mozzarella"...');

    const { data: products, error: searchError } = await supabase
        .from('products')
        .select('*')
        .ilike('name', '%Panino Prosciutto e Mozzarella%');

    if (searchError) {
        console.error('Search error:', searchError);
        return;
    }

    if (!products || products.length === 0) {
        console.error('Product not found');
        return;
    }

    const product = products[0];
    console.log(`Found product: ${product.name} (${product.id})`);

    // Update ingredients
    const ingredients = ['Prosciutto crudo di Parma DOP', 'Mozzarella di bufala'];

    const { error: updateError } = await supabase
        .from('products')
        .update({ ingredients })
        .eq('id', product.id);

    if (updateError) {
        console.error('Update error (likely RLS):', updateError);
        console.log('Please run the fix-products-rls.sql script in Supabase Dashboard.');
    } else {
        console.log('Successfully updated ingredients!');
    }
}

seedIngredients();
