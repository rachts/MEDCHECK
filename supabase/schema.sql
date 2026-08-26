-- ==============================================================================
-- MEDCHECK Supabase Database Schema
-- Production-ready schema for caching OpenFDA drug details, interaction pairs,
-- and clinical evidence metadata with TTL support and idempotent RLS policies.
-- ==============================================================================

-- 1. Medicines Table (Normalized medication lookup)
CREATE TABLE IF NOT EXISTS medicines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    generic_name VARCHAR(255),
    brand_names TEXT[] DEFAULT '{}',
    cached_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_medicines_name ON medicines(name);
CREATE INDEX IF NOT EXISTS idx_medicines_generic_name ON medicines(generic_name);


-- 2. Drug Details Table (Cached OpenFDA label extractions & classifications)
CREATE TABLE IF NOT EXISTS drug_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    generic_name VARCHAR(255) NOT NULL UNIQUE,
    brand_names TEXT[] DEFAULT '{}',
    side_effects TEXT[] DEFAULT '{}',
    food_warnings TEXT[] DEFAULT '{}',
    drug_interactions TEXT[] DEFAULT '{}',
    severity VARCHAR(50) DEFAULT 'moderate',
    raw_text TEXT,
    classification JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_drug_details_generic_name ON drug_details(generic_name);
CREATE INDEX IF NOT EXISTS idx_drug_details_expires_at ON drug_details(expires_at);


-- 3. Interaction Pairs Table (Cached pairwise clinical evaluations)
CREATE TABLE IF NOT EXISTS interaction_pairs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    drug_a VARCHAR(255) NOT NULL,
    drug_b VARCHAR(255) NOT NULL,
    canonical_pair VARCHAR(512) NOT NULL UNIQUE,
    severity VARCHAR(50) NOT NULL CHECK (severity IN ('low', 'moderate', 'high', 'none')),
    explanation TEXT NOT NULL,
    mechanism TEXT,
    clinical_impact TEXT,
    stomach_impact TEXT,
    food_consideration TEXT,
    action_guidance TEXT,
    evidence_source TEXT,
    confidence VARCHAR(50) DEFAULT 'established',
    last_reviewed TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_interaction_pairs_drug_a ON interaction_pairs(drug_a);
CREATE INDEX IF NOT EXISTS idx_interaction_pairs_drug_b ON interaction_pairs(drug_b);
CREATE INDEX IF NOT EXISTS idx_interaction_pairs_canonical ON interaction_pairs(canonical_pair);
CREATE INDEX IF NOT EXISTS idx_interaction_pairs_expires_at ON interaction_pairs(expires_at);


-- ==============================================================================
-- Row Level Security (RLS) & Idempotent Policies
-- ==============================================================================

ALTER TABLE medicines ENABLE ROW LEVEL SECURITY;
ALTER TABLE drug_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE interaction_pairs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first to guarantee idempotent re-runs in SQL Editor
DROP POLICY IF EXISTS "Public read access for medicines" ON medicines;
DROP POLICY IF EXISTS "Public read access for drug_details" ON drug_details;
DROP POLICY IF EXISTS "Public read access for interaction_pairs" ON interaction_pairs;

DROP POLICY IF EXISTS "Service role write access for medicines" ON medicines;
DROP POLICY IF EXISTS "Service role write access for drug_details" ON drug_details;
DROP POLICY IF EXISTS "Service role write access for interaction_pairs" ON interaction_pairs;

-- Read policies: Allow public/authenticated SELECT access
CREATE POLICY "Public read access for medicines" 
    ON medicines FOR SELECT 
    USING (true);

CREATE POLICY "Public read access for drug_details" 
    ON drug_details FOR SELECT 
    USING (true);

CREATE POLICY "Public read access for interaction_pairs" 
    ON interaction_pairs FOR SELECT 
    USING (true);

-- Write policies: Allow full service_role (backend API) access
CREATE POLICY "Service role write access for medicines" 
    ON medicines FOR ALL 
    TO service_role
    USING (true) 
    WITH CHECK (true);

CREATE POLICY "Service role write access for drug_details" 
    ON drug_details FOR ALL 
    TO service_role
    USING (true) 
    WITH CHECK (true);

CREATE POLICY "Service role write access for interaction_pairs" 
    ON interaction_pairs FOR ALL 
    TO service_role
    USING (true) 
    WITH CHECK (true);
