export type Severity = 'high' | 'moderate' | 'low' | 'none';
export type Frequency = 'very_common' | 'common' | 'uncommon' | 'rare';
export type DrugType = 'prescription' | 'otc' | 'supplement' | 'substance' | 'lifestyle_factor' | 'unknown';
export type RiskTier = 'gentle' | 'moderate' | 'high' | 'unknown';
export type RuleConfidence = 'established' | 'theoretical' | 'case_report';

export interface SideEffectDetail {
  effect: string;
  frequency: Frequency;
  frequency_percentage: string;
  severity: 'mild' | 'moderate' | 'severe';
  category: string;
  is_amplified?: boolean;
}

export interface FoodInteractionDetail {
  type: string;
  title: string;
  description: string;
  severity: 'recommended' | 'warning' | 'critical';
  icon: string;
}

export interface GIProfile {
  stomach_health_score: number;
  risk_tier: RiskTier;
  nausea_risk: string;
  ulcer_risk: string;
  bleeding_risk: string;
  reflux_aggravation: boolean;
  constipation_diarrhea: string;
  recommendations: string[];
}

export interface MedicineProfileResponse {
  name: string;
  generic_name: string;
  brand_names: string[];
  category: string;
  drug_type: DrugType;
  dosage_forms: string[];
  description: string;
  side_effects: SideEffectDetail[];
  food_interactions: FoodInteractionDetail[];
  gi_profile: GIProfile;
  lifestyle_warnings: string[];
  data_source: 'curated_kb' | 'openfda_live' | 'openfda_ai_parsed' | 'unknown_fallback';
  disclaimer?: string;
}

export interface InteractionItem {
  drug_a: string;
  drug_b: string;
  severity: Severity;
  explanation: string;
  mechanism?: string;
  clinical_impact?: string;
  stomach_impact?: string;
  food_consideration?: string;
  action_guidance?: string;
  evidence_source?: string;
  confidence?: RuleConfidence;
  last_reviewed?: string;
}

export interface FoodConflictDetail {
  medicine_a: string;
  medicine_b: string;
  conflict_type: string;
  conflict: string;
  recommended_schedule: string;
}

export interface TimelineSlot {
  time: string;
  title: string;
  medicine?: string;
  action_type: string;
  icon: string;
  note: string;
}

export interface AmplifiedSideEffect {
  effect: string;
  sources: string[];
  severity: string;
  amplified: boolean;
  clinical_note: string;
}

export interface MedicineSearchResult {
  name: string;
  generic_name: string;
  category: string;
  /**
   * Stable therapeutic-class slugs derived server-side by
   * derive_category_tags (backend/services/search_engine.py). `category` above is
   * free-text prose meant for display; these are the values to filter on.
   * Always non-empty -- the backend falls back to ["general"].
   */
  category_tags: string[];
  drug_type: string;
  /** "Critical" | "Moderate" | "Gentle" -- note "Critical", not "High". */
  stomach_risk_badge: string;
  stomach_score: number;
  top_side_effects: string[];
  food_warning_count: number;
  brand_context?: string;
}

export interface CheckResponse {
  medicines: string[];
  interactions: InteractionItem[];
  safe: boolean;
  summary?: string;
  analyzed_pairs_count: number;
  composite_gi_score: number;
  composite_gi_tier: string;
  composite_gi_contributors: Array<{
    drug: string;
    score_impact: number;
    tier: string;
    mechanism_short: string;
  }>;
  composite_gi_recommendations: string[];
  food_conflicts: FoodConflictDetail[];
  daily_food_timeline: TimelineSlot[];
  aggregated_side_effects: AmplifiedSideEffect[];
  profiles: Record<string, MedicineProfileResponse>;
  limited_data_warnings?: string[];
}

export interface UserAuthSession {
  access_token: string;
  token_type: string;
  user_id: string;
  username: string;
  is_guest: boolean;
}

/**
 * A row in the medicine basket. Client-side only -- this shape is built by
 * `MedicineContext.addMedicine`, never returned by the API, so it does not
 * correspond to any Pydantic model in `backend/models.py`.
 *
 * `id` exists solely as a stable React key and as the handle `removeMedicine`
 * takes; `name` is the display casing the user typed, and lookups against the
 * API (which keys `CheckResponse.profiles` by lowercase generic name) must
 * lowercase it first. `drugType` drives the OTC / Rx / Supp badge on the chip.
 */
export interface BasketMedicine {
  id: string;
  name: string;
  drugType: DrugType;
}
