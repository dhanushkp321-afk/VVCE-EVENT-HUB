const supabaseUrl = 'https://nkugbdencpvhhvgqybgi.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5rdWdiZGVuY3B2aGh2Z3F5YmdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA4OTY3MzMsImV4cCI6MjA5NjQ3MjczM30.YFFnsWBymu4R59aMHTEq6ogwI0xb4xjbavpto1FrVWY';

let supabaseClient = null;

if (typeof window !== 'undefined' && window.supabase && typeof window.supabase.createClient === 'function') {
  supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);
} else if (typeof createClient === 'function') {
  supabaseClient = createClient(supabaseUrl, supabaseKey);
}

export const supabase = supabaseClient;
if (typeof window !== 'undefined') {
  window.supabase = supabaseClient;
}
