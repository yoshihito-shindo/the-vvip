import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_URL)
  || (typeof window !== 'undefined' && (window as any).__SUPABASE_URL__)
  || 'https://dyevydexzvunjztgcoro.supabase.co';

const supabaseAnonKey = (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_ANON_KEY)
  || (typeof window !== 'undefined' && (window as any).__SUPABASE_ANON_KEY__)
  || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR5ZXZ5ZGV4enZ1bmp6dGdjb3JvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0NDcxNTAsImV4cCI6MjA4NjAyMzE1MH0.Yog4hNBkqIJlMrM3r3uhT-FksXnBfN_ZF8znBJ-W2Ps';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
