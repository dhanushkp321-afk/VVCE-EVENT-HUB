import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.NEXT_PUBLIC_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL || 'https://nkugbdencpvhhvgqybgi.supabase.co';
const supabaseKey = import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5rdWdiZGVuY3B2aGh2Z3F5YmdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA4OTY3MzMsImV4cCI6MjA5NjQ3MjczM30.YFFnsWBymu4R59aMHTEq6ogwI0xb4xjbavpto1FrVWY';

export const supabase = createClient(supabaseUrl, supabaseKey);
window.supabase = supabase;
