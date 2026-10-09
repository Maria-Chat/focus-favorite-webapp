-- ====================================================================
-- Saved Content Manager (Second Brain for Social Media)
-- Database Schema for Supabase with pgvector
-- ====================================================================

-- 1. Enable pgvector extension for Semantic Search
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Create Custom Enum Types
DO $$ BEGIN
    CREATE TYPE platform_enum AS ENUM ('youtube', 'tiktok', 'facebook');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE content_type_enum AS ENUM ('video', 'post');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE status_enum AS ENUM ('pending', 'processing', 'completed', 'error');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. Create Main Table: saved_items
CREATE TABLE IF NOT EXISTS saved_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    url TEXT NOT NULL UNIQUE,
    platform platform_enum NOT NULL,
    content_type content_type_enum NOT NULL DEFAULT 'video',
    original_title TEXT,
    original_caption TEXT,
    normalized_category TEXT DEFAULT 'Uncategorized',
    tags TEXT[] DEFAULT '{}',
    extracted_locations JSONB DEFAULT '[]'::jsonb, -- Schema: [{ name, type, lat, lng, place_id }]
    transcript TEXT,
    embedding VECTOR(768), -- Gemini text-embedding-004 dimension
    status status_enum NOT NULL DEFAULT 'pending',
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Create Vector Index for Fast Cosine Similarity Search
CREATE INDEX IF NOT EXISTS saved_items_embedding_hnsw_idx 
ON saved_items 
USING hnsw (embedding vector_cosine_ops);

-- 5. Create Metadata & Search Indexes
CREATE INDEX IF NOT EXISTS saved_items_platform_idx ON saved_items(platform);
CREATE INDEX IF NOT EXISTS saved_items_category_idx ON saved_items(normalized_category);
CREATE INDEX IF NOT EXISTS saved_items_status_idx ON saved_items(status);
CREATE INDEX IF NOT EXISTS saved_items_created_at_idx ON saved_items(created_at DESC);

-- Full-Text Search Index (Thai/English Title & Caption)
CREATE INDEX IF NOT EXISTS saved_items_fts_idx ON saved_items 
USING gin (to_tsvector('english', COALESCE(original_title, '') || ' ' || COALESCE(original_caption, '')));

-- 6. Trigger to Update `updated_at` Column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_saved_items_updated_at ON saved_items;
CREATE TRIGGER update_saved_items_updated_at
    BEFORE UPDATE ON saved_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 7. RPC Function for Vector Similarity Search with Filtering
CREATE OR REPLACE FUNCTION match_saved_items (
  query_embedding VECTOR(768),
  match_threshold FLOAT DEFAULT 0.3,
  match_count INT DEFAULT 20,
  filter_platform platform_enum DEFAULT NULL,
  filter_category TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  url TEXT,
  platform platform_enum,
  content_type content_type_enum,
  original_title TEXT,
  original_caption TEXT,
  normalized_category TEXT,
  tags TEXT[],
  extracted_locations JSONB,
  similarity FLOAT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id,
    s.url,
    s.platform,
    s.content_type,
    s.original_title,
    s.original_caption,
    s.normalized_category,
    s.tags,
    s.extracted_locations,
    1 - (s.embedding <=> query_embedding) AS similarity,
    s.created_at
  FROM saved_items s
  WHERE s.status = 'completed'
    AND (filter_platform IS NULL OR s.platform = filter_platform)
    AND (filter_category IS NULL OR s.normalized_category = filter_category)
    AND (1 - (s.embedding <=> query_embedding)) > match_threshold
  ORDER BY s.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 8. Enable Row Level Security (RLS) - Permissive for Dev
ALTER TABLE saved_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to completed items"
ON saved_items FOR SELECT
USING (true);

CREATE POLICY "Allow public insert/update access for API processing"
ON saved_items FOR ALL
USING (true)
WITH CHECK (true);
