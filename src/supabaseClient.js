import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://uqoiawkpexxxniogmnor.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVxb2lhd2twZXh4eG5pb2dtbm9yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxNTM4NjQsImV4cCI6MjA4NzcyOTg2NH0.t6Io-Kwggsg6AfHnsz4LfYoPtpTpb7lK9ADlhTjKVHo';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
