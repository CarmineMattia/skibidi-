
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // If available, for bypassing RLS

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase environment variables');
    process.exit(1);
}

// Use service key if available to bypass RLS for debugging, otherwise use anon key
const supabase = createClient(supabaseUrl, supabaseServiceKey || supabaseKey);

async function checkProfiles() {
    console.log('Checking profiles...');

    const { data: users, error: userError } = await supabase.auth.admin.listUsers();

    if (userError) {
        console.log('Could not list users via admin API (likely missing service role key).');
        console.log('Trying to fetch profiles directly...');
    } else {
        console.log(`Found ${users.users.length} users in Auth.`);
        users.users.forEach(u => {
            console.log(`Auth User: ${u.email} (ID: ${u.id})`);
        });
    }

    const { data, error } = await supabase
        .from('profiles')
        .select('*');

    if (error) {
        console.error('Error fetching profiles:', error);
        return;
    }

    console.log(`Found ${data.length} profiles:`);
    data.forEach(profile => {
        console.log(`- ${profile.email || 'No Email'}: Role=${profile.role} (ID: ${profile.id})`);
    });
}

checkProfiles();
