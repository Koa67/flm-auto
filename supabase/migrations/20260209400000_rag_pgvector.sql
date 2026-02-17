-- Phase 3: RAG with pgvector for ALAIN semantic search
-- Requires pgvector extension to be enabled in Supabase Dashboard > Database > Extensions

CREATE EXTENSION IF NOT EXISTS vector;

-- =============================================
-- RAG DOCUMENTS TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS rag_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  generation_id UUID REFERENCES generations(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL, -- 'vehicle_summary', 'specs', 'safety', 'reliability', 'ux', 'family'
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  embedding vector(1024), -- Voyage AI voyage-3-large dimensions
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- HNSW index for fast approximate nearest neighbor search
CREATE INDEX IF NOT EXISTS idx_rag_embedding ON rag_documents
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS idx_rag_generation ON rag_documents(generation_id);
CREATE INDEX IF NOT EXISTS idx_rag_content_type ON rag_documents(content_type);

-- Unique constraint: one document per generation per content_type
CREATE UNIQUE INDEX IF NOT EXISTS idx_rag_unique_gen_type
  ON rag_documents(generation_id, content_type);

-- =============================================
-- VECTOR SIMILARITY SEARCH FUNCTION
-- =============================================

CREATE OR REPLACE FUNCTION match_rag_documents(
  query_embedding vector(1024),
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 5,
  filter_content_type text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  generation_id uuid,
  content_type text,
  content text,
  metadata jsonb,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    rd.id,
    rd.generation_id,
    rd.content_type,
    rd.content,
    rd.metadata,
    1 - (rd.embedding <=> query_embedding) AS similarity
  FROM rag_documents rd
  WHERE 1 - (rd.embedding <=> query_embedding) > match_threshold
    AND (filter_content_type IS NULL OR rd.content_type = filter_content_type)
  ORDER BY rd.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- =============================================
-- RLS POLICIES
-- =============================================

ALTER TABLE rag_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access for rag_documents"
  ON rag_documents FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "Service role write for rag_documents"
  ON rag_documents FOR ALL TO service_role
  USING (true) WITH CHECK (true);
