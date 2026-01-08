/**
 * Centralized Taxonomy Helper
 * 
 * Provides smart defaults, graceful fallbacks, and consistent ordering
 * for all taxonomy-based dropdowns across the SIS.
 * 
 * Rules:
 * - Taxonomies are canonical (code is UPPERCASE, unique per taxonomy_id)
 * - Users see labels only (never codes, keys, or IDs)
 * - Dropdowns never block (always have defaults)
 * - Missing taxonomies use system fallbacks silently
 */

import { supabase } from "@/lib/supabase/client";

export interface TaxonomyItem {
  id: string;
  code: string;
  label: string;
}

export interface TaxonomyFetchResult {
  items: TaxonomyItem[];
  hasSystemDefaults: boolean;
  error?: string;
}

// System defaults (fallback when taxonomy is empty)
const SYSTEM_DEFAULTS: Record<string, TaxonomyItem[]> = {
  student_status: [
    { id: "default-active", code: "ACTIVE", label: "Active" },
    { id: "default-inactive", code: "INACTIVE", label: "Inactive" },
    { id: "default-withdrawn", code: "WITHDRAWN", label: "Withdrawn" },
  ],
  sex: [
    { id: "default-male", code: "MALE", label: "Male" },
    { id: "default-female", code: "FEMALE", label: "Female" },
  ],
  attendance_status: [
    { id: "default-present", code: "PRESENT", label: "Present" },
    { id: "default-absent", code: "ABSENT", label: "Absent" },
    { id: "default-excused", code: "EXCUSED", label: "Excused" },
    { id: "default-late", code: "LATE", label: "Late" },
  ],
  economic_status: [
    { id: "default-extreme-poverty", code: "EXTREME_POVERTY", label: "Extreme Poverty" },
    { id: "default-low", code: "LOW", label: "Low" },
    { id: "default-lower-middle", code: "LOWER_MIDDLE", label: "Lower Middle" },
    { id: "default-middle", code: "MIDDLE", label: "Middle" },
    { id: "default-upper-middle", code: "UPPER_MIDDLE", label: "Upper Middle" },
    { id: "default-high", code: "HIGH", label: "High" },
    { id: "default-scholar", code: "SCHOLAR", label: "Scholar" },
  ],
  language: [
    { id: "default-english", code: "ENGLISH", label: "English" },
    { id: "default-spanish", code: "SPANISH", label: "Spanish" },
    { id: "default-tagalog", code: "TAGALOG", label: "Tagalog" },
  ],
  guardian_relationship: [
    { id: "default-parent", code: "PARENT", label: "Parent" },
    { id: "default-guardian", code: "GUARDIAN", label: "Guardian" },
    { id: "default-relative", code: "RELATIVE", label: "Relative" },
  ],
  entry_type: [
    { id: "default-freshman", code: "FRESHMAN", label: "Freshman" },
    { id: "default-transferee", code: "TRANSFEREE", label: "Transferee" },
    { id: "default-returning", code: "RETURNING", label: "Returning" },
  ],
  school_year_status: [
    { id: "default-planning", code: "PLANNING", label: "Planning" },
    { id: "default-active", code: "ACTIVE", label: "Active" },
    { id: "default-inactive", code: "INACTIVE", label: "Inactive" },
  ],
};

// Smart defaults (auto-selected on create)
export const SMART_DEFAULTS: Record<string, string> = {
  student_status: "ACTIVE",
  // sex: No default - requires explicit user choice
  attendance_status: "PRESENT",
  economic_status: "", // Optional, no default
  school_year_status: "PLANNING", // New school years default to Planning
};

/**
 * Fetch taxonomy items by key with smart defaults and fallbacks
 * 
 * @param key - Taxonomy key (e.g., 'sex', 'student_status')
 * @param currentValue - Optional current selected value (UUID) to include even if inactive
 * @returns TaxonomyFetchResult with items, fallback flag, and optional error
 */
export async function fetchTaxonomyItems(key: string, currentValue?: string | null): Promise<TaxonomyFetchResult> {
  try {
    // Step 1: Get taxonomy ID by key
    const { data: taxonomy, error: taxonomyError } = await supabase
      .from("taxonomies")
      .select("id")
      .eq("key", key)
      .single();

    if (taxonomyError || !taxonomy) {
      // Taxonomy not found - use system defaults silently
      const defaults = SYSTEM_DEFAULTS[key] || [];
      return {
        items: defaults,
        hasSystemDefaults: true,
      };
    }

    // Step 2: Get taxonomy_items filtered by taxonomy_id
    // Include active items OR current value (even if inactive) to ensure saved values display
    let query = supabase
      .from("taxonomy_items")
      .select("id, code, label, is_active")
      .eq("taxonomy_id", taxonomy.id);

    if (currentValue && currentValue.trim() !== "") {
      // Include active items OR the current selected value (even if inactive)
      query = query.or(`is_active.eq.true,id.eq.${currentValue.trim()}`);
    } else {
      // Only include active items if no current value
      query = query.eq("is_active", true);
    }

    const { data: items, error: itemsError } = await query
      .order("sort_order", { ascending: true, nullsFirst: false })
      .order("label", { ascending: true });

    if (itemsError) {
      console.warn(`Error fetching taxonomy items for '${key}':`, itemsError);
      // Use system defaults on error
      const defaults = SYSTEM_DEFAULTS[key] || [];
      return {
        items: defaults,
        hasSystemDefaults: true,
      };
    }

    if (!items || items.length === 0) {
      // Taxonomy exists but has no active items - use system defaults
      const defaults = SYSTEM_DEFAULTS[key] || [];
      return {
        items: defaults,
        hasSystemDefaults: true,
      };
    }

    // Normalize codes to uppercase (canonical) and append "(deprecated)" to inactive labels
    const normalizedItems: TaxonomyItem[] = items.map((item) => ({
      id: item.id,
      code: item.code.toUpperCase(),
      label: item.is_active === false ? `${item.label} (deprecated)` : item.label,
    }));

    return {
      items: normalizedItems,
      hasSystemDefaults: false,
    };
  } catch (err) {
    console.error(`Unexpected error fetching taxonomy '${key}':`, err);
    // Use system defaults on unexpected error
    const defaults = SYSTEM_DEFAULTS[key] || [];
    return {
      items: defaults,
      hasSystemDefaults: true,
    };
  }
}

/**
 * Get smart default value for a taxonomy
 * 
 * @param key - Taxonomy key
 * @returns Default code value (empty string if no default)
 */
export function getSmartDefault(key: string): string {
  return SMART_DEFAULTS[key] || "";
}

/**
 * Fetch multiple taxonomies in parallel
 * 
 * @param keys - Array of taxonomy keys
 * @param currentValues - Optional map of key -> current selected value (UUID)
 * @returns Map of key -> TaxonomyFetchResult
 */
export async function fetchMultipleTaxonomies(
  keys: string[],
  currentValues?: Map<string, string | null>
): Promise<Map<string, TaxonomyFetchResult>> {
  const results = await Promise.all(
    keys.map(async (key) => {
      const currentValue = currentValues?.get(key);
      const result = await fetchTaxonomyItems(key, currentValue);
      return [key, result] as [string, TaxonomyFetchResult];
    })
  );

  return new Map(results);
}

