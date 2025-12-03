import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://btxubigxmmxcgsqcanfk.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ0eHViaWd4bW14Y2dzcWNhbmZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ3ODUzMDcsImV4cCI6MjA4MDM2MTMwN30.B6X7pp_6V9RJiJmdYFPsvaEqkOCWFszd5DyQVLbPrqw';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
