import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY; // Using anon key, hoping RLS allows update or I can use service role if available (but I don't have it)
// Ideally I should use service role key for seeding, but I only see anon key in .env.
// However, if I am not authenticated, RLS will block me.
// Wait, I can try to sign in as admin first if I have credentials, or...
// Actually, I can just try to update. If it fails, I'll know.
// BUT, I can't sign in easily in a script without a password.
// Let's check if there is a service role key in .env? No, only anon.

// Alternative: I can use the `fix-products-rls.sql` approach but I can't run SQL directly.
// Let's try to run this script. If it fails due to RLS, I will have to ask the user to run the SQL.
// BUT, maybe I can use the `service_role` key if it was in the env? It's not.

// Let's try to find the product by name and update it.
// If RLS is "public can view", I can find it.
// If RLS is "only admin can update", this script will fail unless I have an admin token.

// Wait, I am an agent. I can't "login" as the user.
// However, I can try to use the `supabase` CLI if installed? No.

// Let's write the script to ATTEMPT the update.
// If it fails, I will tell the user "I tried to update it for you but I don't have admin permissions from here. Please use the Edit button in the app."

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

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
    } else {
        console.log('Successfully updated ingredients!');
    }
}

seedIngredients();
