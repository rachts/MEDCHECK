-- MedCheck Supabase Schema
-- Stores normalized medicines, parsed FDA drug details, and cached interaction pairs.

-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Medicines Table
CREATE TABLE IF NOT EXISTS medicines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL UNIQUE,
    generic_name VARCHAR(255),
    brand_names TEXT[] DEFAULT '{}',
    cached_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_medicines_name ON medicines(name);
CREATE INDEX IF NOT EXISTS idx_medicines_generic_name ON medicines(generic_name);

-- 2. Drug Details Table
CREATE TABLE IF NOT EXISTS drug_details (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    medicine_id UUID REFERENCES medicines(id) ON DELETE CASCADE,
    side_effects TEXT[] DEFAULT '{}',
    food_warnings TEXT[] DEFAULT '{}',
    drug_interactions TEXT[] DEFAULT '{}',
    raw_fda_text TEXT,
    parsed_json JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_drug_details_medicine_id ON drug_details(medicine_id);

-- 3. Interaction Pairs Table
CREATE TABLE IF NOT EXISTS interaction_pairs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    drug_a VARCHAR(255) NOT NULL,
    drug_b VARCHAR(255) NOT NULL,
    canonical_pair VARCHAR(512) GENERATED ALWAYS AS (
        CASE WHEN drug_a < drug_b THEN drug_a || '::' || drug_b
             ELSE drug_b || '::' || drug_a END
    ) STORED,
    severity VARCHAR(50) NOT NULL CHECK (severity IN ('low', 'moderate', 'high', 'none')),
    explanation TEXT NOT NULL,
    source VARCHAR(100) DEFAULT 'openfda_mistral',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_canonical_pair UNIQUE (canonical_pair)
);

CREATE INDEX IF NOT EXISTS idx_interaction_pairs_drug_a ON interaction_pairs(drug_a);
CREATE INDEX IF NOT EXISTS idx_interaction_pairs_drug_b ON interaction_pairs(drug_b);
CREATE INDEX IF NOT EXISTS idx_interaction_pairs_canonical ON interaction_pairs(canonical_pair);

-- Row Level Security (RLS)
ALTER TABLE medicines ENABLE ROW LEVEL SECURITY;
ALTER TABLE drug_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE interaction_pairs ENABLE ROW LEVEL SECURITY;

-- Read policies for anonymous & authenticated users
CREATE POLICY "Public read access for medicines" ON medicines FOR SELECT USING (true);
CREATE POLICY "Public read access for drug_details" ON drug_details FOR SELECT USING (true);
CREATE POLICY "Public read access for interaction_pairs" ON interaction_pairs FOR SELECT USING (true);

-- Insert/Update policies for service role
CREATE POLICY "Service role write access for medicines" ON medicines FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role write access for drug_details" ON drug_details FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role write access for interaction_pairs" ON interaction_pairs FOR ALL USING (true) WITH CHECK (true);
