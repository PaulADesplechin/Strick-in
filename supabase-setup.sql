-- ============================================================
-- STRICK'IN DOCUMENT PORTAL — SUPABASE SETUP
-- Run this in the Supabase SQL Editor (https://supabase.com/dashboard)
-- ============================================================

-- 1. Create the documents table
CREATE TABLE IF NOT EXISTS documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  category_label TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size BIGINT DEFAULT 0,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. Enable Row Level Security
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- 3. Create a policy that allows anyone with the anon key to read
CREATE POLICY "Allow public read access" ON documents
  FOR SELECT USING (true);

-- 4. Create a policy that allows authenticated users to insert
CREATE POLICY "Allow authenticated insert" ON documents
  FOR INSERT WITH CHECK (true);

-- 5. Create indexes for fast searching
CREATE INDEX IF NOT EXISTS idx_documents_category ON documents(category);
CREATE INDEX IF NOT EXISTS idx_documents_name ON documents USING gin(to_tsvector('french', name));

-- 6. Create the storage bucket (do this via Supabase Dashboard > Storage > New Bucket)
-- Bucket name: strickin-docs
-- Public: Yes (so team can view/download without auth)

-- ============================================================
-- DONE! Now run the upload script to populate the database.
-- ============================================================
