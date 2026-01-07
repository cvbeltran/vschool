"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Save, AlertCircle, Loader2 } from "lucide-react";
import { normalizeRole, canPerform } from "@/lib/rbac";
import { Badge } from "@/components/ui/badge";
import { fetchMultipleTaxonomies, getSmartDefault, type TaxonomyItem, type TaxonomyFetchResult } from "@/lib/taxonomies";
import { STUDENT_COLUMNS, TAXONOMY_KEYS } from "@/lib/constants/student-columns";

interface Student {
  id: string;
  legal_first_name?: string | null;
  legal_last_name?: string | null;
  preferred_name?: string | null;
  date_of_birth?: string | null;
  sex_id?: string | null; // FK to taxonomy_items.id (taxonomy key: "sex")
  nationality?: string | null;
  student_number?: string | null;
  status?: string | null; // FK to taxonomy_items.id (taxonomy key: "student_status")
  primary_email?: string | null;
  phone?: string | null;
  address?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  guardian_name?: string | null;
  guardian_relationship_id?: string | null; // FK to taxonomy_items.id (taxonomy key: "guardian_relationship")
  guardian_email?: string | null;
  guardian_phone?: string | null;
  consent_flags?: boolean | null;
  economic_status_id?: string | null; // FK to taxonomy_items.id (taxonomy key: "economic_status")
  primary_language_id?: string | null; // FK to taxonomy_items.id (taxonomy key: "language")
  special_needs_flag?: boolean | null;
  previous_school?: string | null;
  entry_type?: string | null; // FK to taxonomy_items.id (taxonomy key: "entry_type")
  notes?: string | null;
  admission_id: string | null;
  created_at: string;
  // Legacy fields for backward compatibility
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
}

interface School {
  id: string;
  name: string;
}

interface Program {
  id: string;
  name: string;
}

interface Section {
  id: string;
  name: string;
}

interface Admission {
  id: string;
  first_name: string;
  last_name: string;
  status: string;
  school_id: string | null;
  program_id: string | null;
  section_id: string | null;
}

// Helper function to check if a string is a valid UUID
const isValidUUID = (str: string): boolean => {
  if (!str || typeof str !== "string") return false;
  // UUID format: 8-4-4-4-12 hexadecimal characters
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str.trim());
};

// Helper function to check if a value is a system default ID (not a valid UUID)
const isSystemDefaultId = (value: string | null | undefined): boolean => {
  if (!value || typeof value !== "string") return false;
  return value.startsWith("default-") || !isValidUUID(value);
};

export default function StudentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const studentId = params.id as string;
  
  // One-time hydration guard: track if we've initialized formData for this studentId
  const hydrationGuardRef = useRef<string | null>(null);
  
  const [student, setStudent] = useState<Student | null>(null);
  const [school, setSchool] = useState<School | null>(null);
  const [program, setProgram] = useState<Program | null>(null);
  const [section, setSection] = useState<Section | null>(null);
  const [admission, setAdmission] = useState<Admission | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [role, setRole] = useState<"principal" | "admin" | "teacher">("principal");
  const [originalRole, setOriginalRole] = useState<string | null>(null);
  
  // URL-based tab persistence: read from query param, default to "overview"
  const tabFromUrl = searchParams.get("tab") || "overview";
  const [activeTab, setActiveTab] = useState(tabFromUrl);

  // Taxonomy data with smart defaults
  const [sexOptions, setSexOptions] = useState<TaxonomyItem[]>([]);
  const [economicStatusOptions, setEconomicStatusOptions] = useState<TaxonomyItem[]>([]);
  const [languageOptions, setLanguageOptions] = useState<TaxonomyItem[]>([]);
  const [relationshipOptions, setRelationshipOptions] = useState<TaxonomyItem[]>([]);
  const [statusOptions, setStatusOptions] = useState<TaxonomyItem[]>([]);
  const [entryTypeOptions, setEntryTypeOptions] = useState<TaxonomyItem[]>([]);
  const [taxonomyDefaults, setTaxonomyDefaults] = useState<Map<string, boolean>>(new Map());

  // Form state
  const [formData, setFormData] = useState<Partial<Student>>({});
  const [formDataInitialized, setFormDataInitialized] = useState(false);

  // Tab change handler: update URL without full reload
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    // Update URL query param without causing full page reload
    const url = new URL(window.location.href);
    url.searchParams.set("tab", value);
    router.replace(url.pathname + url.search, { scroll: false });
  };

  const fetchTaxonomies = async (currentFormData?: Partial<Student>) => {
    // Use passed formData or fallback to state (explicit to avoid stale closure)
    const dataToUse = currentFormData || formData;
    
    // Build current values map to include selected items even if inactive
    // Map student column names (sex_id) to taxonomy keys ("sex")
    const currentValues = new Map<string, string | null>();
    // Explicitly coerce to string to avoid null/undefined mismatches
    if (dataToUse.sex_id) currentValues.set(TAXONOMY_KEYS.sex, String(dataToUse.sex_id));
    if (dataToUse.economic_status_id) currentValues.set(TAXONOMY_KEYS.economicStatus, String(dataToUse.economic_status_id));
    if (dataToUse.primary_language_id) currentValues.set(TAXONOMY_KEYS.language, String(dataToUse.primary_language_id));
    if (dataToUse.guardian_relationship_id) currentValues.set(TAXONOMY_KEYS.guardianRelationship, String(dataToUse.guardian_relationship_id));
    if (dataToUse.status) currentValues.set(TAXONOMY_KEYS.studentStatus, String(dataToUse.status));
    if (dataToUse.entry_type) currentValues.set(TAXONOMY_KEYS.entryType, String(dataToUse.entry_type));

    // Use centralized helper with smart defaults and current values
    const results = await fetchMultipleTaxonomies([
      TAXONOMY_KEYS.sex,
      TAXONOMY_KEYS.economicStatus,
      TAXONOMY_KEYS.language,
      TAXONOMY_KEYS.guardianRelationship,
      TAXONOMY_KEYS.studentStatus,
      TAXONOMY_KEYS.entryType,
    ], currentValues);

    // Set options and track which ones are using system defaults
    const defaults = new Map<string, boolean>();
    
    const sexResult = results.get("sex");
    if (sexResult) {
      setSexOptions(sexResult.items);
      defaults.set("sex", sexResult.hasSystemDefaults);
    }

    const languageResult = results.get("language");
    if (languageResult) {
      setLanguageOptions(languageResult.items);
      defaults.set("language", languageResult.hasSystemDefaults);
      
      // DEV DEBUG: Log taxonomy options (remove after verification)
      if (process.env.NODE_ENV === 'development') {
        console.log('[DEV] Language options loaded:', {
          count: languageResult.items.length,
          ids: languageResult.items.map(item => item.id),
          labels: languageResult.items.map(item => item.label),
        });
      }
    }
    
    const economicResult = results.get("economic_status");
    if (economicResult) {
      setEconomicStatusOptions(economicResult.items);
      defaults.set("economic_status", economicResult.hasSystemDefaults);
      
      // DEV DEBUG: Log taxonomy options (remove after verification)
      if (process.env.NODE_ENV === 'development') {
        console.log('[DEV] Economic status options loaded:', {
          count: economicResult.items.length,
          ids: economicResult.items.map(item => item.id),
          labels: economicResult.items.map(item => item.label),
        });
      }
    }

    const relationshipResult = results.get("guardian_relationship");
    if (relationshipResult) {
      setRelationshipOptions(relationshipResult.items);
      defaults.set("guardian_relationship", relationshipResult.hasSystemDefaults);
    }

    const statusResult = results.get("student_status");
    if (statusResult) {
      setStatusOptions(statusResult.items);
      defaults.set("student_status", statusResult.hasSystemDefaults);
    }

    const entryTypeResult = results.get("entry_type");
    if (entryTypeResult) {
      setEntryTypeOptions(entryTypeResult.items);
      defaults.set("entry_type", entryTypeResult.hasSystemDefaults);
    }

    setTaxonomyDefaults(defaults);
  };

  useEffect(() => {
    // Reset hydration guard when studentId changes
    if (hydrationGuardRef.current !== studentId) {
      hydrationGuardRef.current = null;
      setFormDataInitialized(false);
    }
    
    const fetchData = async () => {
      if (!studentId) {
        setError("Student ID is required");
        setLoading(false);
        return;
      }

      // Fetch user role with error handling
      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();
        
        if (sessionError) {
          // If session error, log but continue (user might need to re-login)
          console.warn("Session error:", sessionError);
          // Default to read-only access
          setRole("teacher");
        } else if (session) {
          const { data: profile, error: profileError } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", session.user.id)
            .single();
          
          if (!profileError && profile?.role) {
            const normalizedRole = normalizeRole(profile.role);
            setRole(normalizedRole);
            setOriginalRole(profile.role);
          } else {
            // Default to read-only if profile fetch fails
            setRole("teacher");
          }
        } else {
          // No session, default to read-only
          setRole("teacher");
        }
      } catch (authError) {
        // Catch any unexpected auth errors
        console.error("Auth error:", authError);
        setRole("teacher"); // Default to read-only
      }

      // Ensure we have a valid session before fetching student data
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      
      if (!currentSession) {
        setError("Authentication required. Please log in.");
        setLoading(false);
        router.push("/sis/auth/login");
        return;
      }

      // Fetch student - try comprehensive fields first, fallback to legacy
      // Note: Taxonomies will be fetched after formData is set (via useEffect)
      // The Supabase client automatically includes the session token in the Authorization header
      // Note: student_number column removed as it doesn't exist in the database schema
      const { data: studentData, error: studentError } = await supabase
        .from("students")
        .select(`
          id,
          legal_first_name,
          legal_last_name,
          preferred_name,
          date_of_birth,
          sex_id,
          nationality,
          status,
          primary_email,
          phone,
          address,
          emergency_contact_name,
          emergency_contact_phone,
          guardian_name,
          guardian_relationship_id,
          guardian_email,
          guardian_phone,
          consent_flags,
          economic_status_id,
          primary_language_id,
          special_needs_flag,
          previous_school,
          entry_type,
          notes,
          admission_id,
          created_at,
          first_name,
          last_name,
          email
        `)
        .eq("id", studentId)
        .single();

      if (studentError) {
        // Log detailed error information for debugging
        console.error("Error fetching student:", {
          code: studentError.code,
          message: studentError.message,
          details: studentError.details,
          hint: studentError.hint,
          studentId: studentId,
        });

        // Handle authentication/authorization errors
        if (studentError.code === "PGRST301" || studentError.message?.includes("JWT")) {
          setError("Authentication failed. Please log in again.");
          setLoading(false);
          router.push("/sis/auth/login");
          return;
        }

        // Handle Row Level Security (RLS) errors
        if (studentError.code === "42501" || studentError.message?.includes("permission") || studentError.message?.includes("policy")) {
          setError("You don't have permission to view this student record.");
          setLoading(false);
          return;
        }

        // Handle schema mismatch gracefully
        if ((studentError.code === "42703" || studentError.code === "PGRST204")) {
          // Try with minimal fields (legacy schema)
          const { data: legacyData, error: legacyError } = await supabase
            .from("students")
            .select("id, first_name, last_name, email, admission_id, created_at")
            .eq("id", studentId)
            .single();
          
          if (legacyError) {
            setError(legacyError.message || "Failed to fetch student.");
            setLoading(false);
            return;
          }
          
          if (legacyData) {
            const normalizedLegacy: Student = {
              ...legacyData,
              legal_first_name: legacyData.first_name,
              legal_last_name: legacyData.last_name,
              primary_email: legacyData.email,
            };
            setStudent(normalizedLegacy);
            
            // ONE-TIME HYDRATION GUARD: Only initialize formData once per studentId
            if (hydrationGuardRef.current !== studentId) {
              // Apply smart defaults if fields are empty (sex requires explicit choice, no default)
              const defaultedLegacy: Partial<Student> = {
                ...normalizedLegacy,
                status: normalizedLegacy.status || getSmartDefault("student_status") || "",
                // sex: No default - requires explicit user choice
              };
              setFormData(defaultedLegacy);
              setFormDataInitialized(true);
              hydrationGuardRef.current = studentId;
              
              // Fetch taxonomies with explicit current values
              setTimeout(() => {
                fetchTaxonomies(defaultedLegacy);
              }, 0);
            }
            
            // Fetch admission if admission_id exists
            if (normalizedLegacy.admission_id) {
              const { data: admissionData, error: admissionError } = await supabase
                .from("admissions")
                .select("id, first_name, last_name, status, school_id, program_id, section_id")
                .eq("id", normalizedLegacy.admission_id)
                .single();

              if (!admissionError && admissionData) {
                setAdmission(admissionData);

                // Fetch related data
                if (admissionData.school_id) {
                  const { data: schoolData } = await supabase
                    .from("schools")
                    .select("id, name")
                    .eq("id", admissionData.school_id)
                    .single();
                  if (schoolData) setSchool(schoolData);
                }

                if (admissionData.program_id) {
                  const { data: programData } = await supabase
                    .from("programs")
                    .select("id, name")
                    .eq("id", admissionData.program_id)
                    .single();
                  if (programData) setProgram(programData);
                }

                if (admissionData.section_id) {
                  const { data: sectionData } = await supabase
                    .from("sections")
                    .select("id, name")
                    .eq("id", admissionData.section_id)
                    .single();
                  if (sectionData) setSection(sectionData);
                }
              }
            }
            
            setLoading(false);
            return;
          }
        } else {
          setError(studentError.message || "Failed to fetch student.");
          setLoading(false);
          return;
        }
      } else if (studentData) {
        // Normalize legacy fields to new fields if needed
        const normalizedStudent: Student = {
          ...studentData,
          legal_first_name: studentData.legal_first_name || studentData.first_name,
          legal_last_name: studentData.legal_last_name || studentData.last_name,
          primary_email: studentData.primary_email || studentData.email,
          // Explicitly preserve taxonomy ID fields (can be null)
          // Coerce to string and trim to ensure consistency (null stays null, UUID becomes trimmed string)
          sex_id: studentData.sex_id ? String(studentData.sex_id).trim() : null,
          economic_status_id: studentData.economic_status_id ? String(studentData.economic_status_id).trim() : null,
          primary_language_id: studentData.primary_language_id ? String(studentData.primary_language_id).trim() : null,
          guardian_relationship_id: studentData.guardian_relationship_id ? String(studentData.guardian_relationship_id).trim() : null,
        };
        setStudent(normalizedStudent);
        
        // DEV DEBUG: Log fetched student data (remove after verification)
        if (process.env.NODE_ENV === 'development') {
          console.log('[DEV] Fetched student:', {
            id: normalizedStudent.id,
            sex_id: normalizedStudent.sex_id,
            economic_status_id: normalizedStudent.economic_status_id,
            primary_language_id: normalizedStudent.primary_language_id,
            guardian_relationship_id: normalizedStudent.guardian_relationship_id,
          });
        }
        
        // ONE-TIME HYDRATION GUARD: Only initialize formData once per studentId
        // However, always refresh formData on page load/refresh to ensure correct values are displayed
        const shouldInitialize = hydrationGuardRef.current !== studentId;
        
        // Apply smart defaults if fields are empty (sex requires explicit choice, no default)
        // Preserve all fetched values including economic_status_id
        const defaultedStudent: Partial<Student> = {
          ...normalizedStudent,
          status: normalizedStudent.status || getSmartDefault("student_status") || "",
          // sex: No default - requires explicit user choice
          // economic_status_id: Preserve fetched value (null or UUID string)
        };
        
        // DEV DEBUG: Log formData initialization
        if (process.env.NODE_ENV === 'development') {
          console.log('[DEV] Initializing/Refreshing formData:', {
            shouldInitialize,
            sex_id: defaultedStudent.sex_id,
            economic_status_id: defaultedStudent.economic_status_id,
            primary_language_id: defaultedStudent.primary_language_id,
            guardian_relationship_id: defaultedStudent.guardian_relationship_id,
          });
        }
        
        // Always update formData with fresh data from database (important for refresh)
        // Only set initialized flag if this is the first time for this studentId
        setFormData(defaultedStudent);
        if (shouldInitialize) {
          setFormDataInitialized(true);
          hydrationGuardRef.current = studentId;
        }
        
        // Fetch taxonomies with explicit current values to avoid stale closure
        setTimeout(() => {
          fetchTaxonomies(defaultedStudent);
        }, 0);

        // Fetch admission if admission_id exists
        if (normalizedStudent.admission_id) {
          const { data: admissionData, error: admissionError } = await supabase
            .from("admissions")
            .select("id, first_name, last_name, status, school_id, program_id, section_id")
            .eq("id", normalizedStudent.admission_id)
            .single();

          if (!admissionError && admissionData) {
            setAdmission(admissionData);

            // Fetch related data
            if (admissionData.school_id) {
              const { data: schoolData } = await supabase
                .from("schools")
                .select("id, name")
                .eq("id", admissionData.school_id)
                .single();
              if (schoolData) setSchool(schoolData);
            }

            if (admissionData.program_id) {
              const { data: programData } = await supabase
                .from("programs")
                .select("id, name")
                .eq("id", admissionData.program_id)
                .single();
              if (programData) setProgram(programData);
            }

            if (admissionData.section_id) {
              const { data: sectionData } = await supabase
                .from("sections")
                .select("id, name")
                .eq("id", admissionData.section_id)
                .single();
              if (sectionData) setSection(sectionData);
            }
          }
        }
      }

      setLoading(false);
    };

    fetchData();
  }, [studentId]);

  // Fetch taxonomies when formData values change to ensure saved items (even if inactive) are included
  // Pass explicit formData to avoid stale closure issues
  useEffect(() => {
    // Only refetch if formData has been initialized and has data
    if (formDataInitialized && Object.keys(formData).length > 0) {
      fetchTaxonomies(formData);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formDataInitialized, formData.economic_status_id, formData.primary_language_id, formData.sex_id, formData.status, formData.entry_type, formData.guardian_relationship_id]);
  
  // Sync activeTab with URL on mount/URL change (for browser back/forward)
  useEffect(() => {
    const tabFromUrl = searchParams.get("tab") || "overview";
    if (tabFromUrl !== activeTab) {
      setActiveTab(tabFromUrl);
    }
  }, [searchParams]);

  const isMinor = (): boolean => {
    if (!formData.date_of_birth) return false;
    const birthDate = new Date(formData.date_of_birth);
    const today = new Date();
    const age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    return age < 18 || (age === 18 && monthDiff < 0);
  };

  const isWithdrawn = (): boolean => {
    return formData.status === "withdrawn";
  };

  const isLegacy = (): boolean => {
    return !student?.admission_id;
  };

  const canEdit = canPerform(role, "update", "students", originalRole);

  const handleSave = async (tab: string) => {
    if (!canEdit) {
      setError("You do not have permission to edit student records.");
      return;
    }

    if (isWithdrawn()) {
      setError("Cannot edit withdrawn students.");
      return;
    }

    // Validate guardian for minors
    if (isMinor() && tab === "guardians") {
      if (!formData.guardian_name || !formData.guardian_phone) {
        setError("Guardian information is required for students under 18.");
        return;
      }
    }

    setSaving(true);
    setError(null);

    // Prepare update payload (only include fields that exist in formData)
    const updatePayload: Record<string, any> = {};
    
    // Map form fields to database columns
    if (tab === "identity") {
      if (formData.legal_first_name !== undefined) updatePayload.legal_first_name = formData.legal_first_name || null;
      if (formData.legal_last_name !== undefined) updatePayload.legal_last_name = formData.legal_last_name || null;
      if (formData.preferred_name !== undefined) updatePayload.preferred_name = formData.preferred_name || null;
      if (formData.date_of_birth !== undefined) updatePayload.date_of_birth = formData.date_of_birth || null;
      // sex_id: Handle UUID string or null - reject system default IDs
      if (formData.sex_id !== undefined) {
        const sexId = formData.sex_id;
        if (sexId && typeof sexId === "string" && sexId.trim() !== "") {
          // Only save if it's a valid UUID (not a system default like "default-male")
          if (isValidUUID(sexId.trim())) {
            updatePayload.sex_id = sexId.trim();
          } else {
            // System default ID - don't save (set to null or skip)
            // User needs to select a real taxonomy item from the database
            updatePayload.sex_id = null;
          }
        } else {
          updatePayload.sex_id = null;
        }
      }
      if (formData.nationality !== undefined) updatePayload.nationality = formData.nationality || null;
      if (formData.status !== undefined) updatePayload.status = formData.status || null;
    } else if (tab === "contact") {
      if (formData.primary_email !== undefined) updatePayload.primary_email = formData.primary_email || null;
      if (formData.phone !== undefined) updatePayload.phone = formData.phone || null;
      if (formData.address !== undefined) updatePayload.address = formData.address || null;
      if (formData.emergency_contact_name !== undefined) updatePayload.emergency_contact_name = formData.emergency_contact_name || null;
      if (formData.emergency_contact_phone !== undefined) updatePayload.emergency_contact_phone = formData.emergency_contact_phone || null;
    } else if (tab === "guardians") {
      if (formData.guardian_name !== undefined) updatePayload.guardian_name = formData.guardian_name || null;
      // guardian_relationship_id: Handle UUID string or null - reject system default IDs
      if (formData.guardian_relationship_id !== undefined) {
        const guardianRelationshipId = formData.guardian_relationship_id;
        if (guardianRelationshipId && typeof guardianRelationshipId === "string" && guardianRelationshipId.trim() !== "") {
          // Only save if it's a valid UUID (not a system default)
          if (isValidUUID(guardianRelationshipId.trim())) {
            updatePayload.guardian_relationship_id = guardianRelationshipId.trim();
          } else {
            updatePayload.guardian_relationship_id = null;
          }
        } else {
          updatePayload.guardian_relationship_id = null;
        }
      }
      if (formData.guardian_email !== undefined) updatePayload.guardian_email = formData.guardian_email || null;
      if (formData.guardian_phone !== undefined) updatePayload.guardian_phone = formData.guardian_phone || null;
      if (formData.consent_flags !== undefined) updatePayload.consent_flags = formData.consent_flags || null;
    } else if (tab === "demographics") {
      // Economic status is optional - explicitly handle null and UUID values
      // Always include economic_status_id in payload if it exists in formData (even if null)
      if (formData.economic_status_id !== undefined) {
        const economicStatusId = formData.economic_status_id;
        // Allow null or valid UUID string - explicitly set null if empty/whitespace or system default
        if (economicStatusId && typeof economicStatusId === "string" && economicStatusId.trim() !== "") {
          // Only save if it's a valid UUID (not a system default)
          if (isValidUUID(economicStatusId.trim())) {
            updatePayload.economic_status_id = economicStatusId.trim();
          } else {
            updatePayload.economic_status_id = null;
          }
        } else {
          // Explicitly set to null (user cleared selection or value was null)
          updatePayload.economic_status_id = null;
        }
      }
      if (formData.primary_language_id !== undefined) {
        const primaryLanguageId = formData.primary_language_id;
        if (primaryLanguageId && typeof primaryLanguageId === "string" && primaryLanguageId.trim() !== "") {
          // Only save if it's a valid UUID (not a system default)
          if (isValidUUID(primaryLanguageId.trim())) {
            updatePayload.primary_language_id = primaryLanguageId.trim();
          } else {
            updatePayload.primary_language_id = null;
          }
        } else {
          updatePayload.primary_language_id = null;
        }
      }
      if (formData.special_needs_flag !== undefined) updatePayload.special_needs_flag = formData.special_needs_flag || null;
    } else if (tab === "education") {
      if (formData.previous_school !== undefined) updatePayload.previous_school = formData.previous_school || null;
      if (formData.entry_type !== undefined) updatePayload.entry_type = formData.entry_type || null;
      if (formData.notes !== undefined) updatePayload.notes = formData.notes || null;
    }

    // Ensure we have fields to update
    if (Object.keys(updatePayload).length === 0) {
      setError("No changes to save.");
      setSaving(false);
      return;
    }

    const { error: updateError } = await supabase
      .from("students")
      .update(updatePayload)
      .eq("id", studentId);

    if (updateError) {
      console.error("Error updating student:", updateError);
      console.error("Update payload:", updatePayload);
      const errorMessage = updateError.message || updateError.details || JSON.stringify(updateError) || "Failed to save changes.";
      setError(errorMessage);
      setSaving(false);
      return;
    }

    // Refresh student data with explicit field selection to ensure all taxonomy IDs are included
    // Note: student_number column removed as it doesn't exist in the database schema
    const { data: updatedStudent } = await supabase
      .from("students")
      .select(`
        id,
        legal_first_name,
        legal_last_name,
        preferred_name,
        date_of_birth,
        sex_id,
        nationality,
        status,
        primary_email,
        phone,
        address,
        emergency_contact_name,
        emergency_contact_phone,
        guardian_name,
        guardian_relationship_id,
        guardian_email,
        guardian_phone,
        consent_flags,
        economic_status_id,
        primary_language_id,
        special_needs_flag,
        previous_school,
        entry_type,
        notes,
        admission_id,
        created_at,
        first_name,
        last_name,
        email
      `)
      .eq("id", studentId)
      .single();

    if (updatedStudent) {
      const normalizedStudent: Student = {
        ...updatedStudent,
        legal_first_name: updatedStudent.legal_first_name || updatedStudent.first_name,
        legal_last_name: updatedStudent.legal_last_name || updatedStudent.last_name,
        primary_email: updatedStudent.primary_email || updatedStudent.email,
        // Explicitly preserve taxonomy ID fields (can be null)
        // Coerce to string and trim to ensure consistency
        sex_id: updatedStudent.sex_id ? String(updatedStudent.sex_id).trim() : null,
        economic_status_id: updatedStudent.economic_status_id ? String(updatedStudent.economic_status_id).trim() : null,
        primary_language_id: updatedStudent.primary_language_id ? String(updatedStudent.primary_language_id).trim() : null,
        guardian_relationship_id: updatedStudent.guardian_relationship_id ? String(updatedStudent.guardian_relationship_id).trim() : null,
      };
      setStudent(normalizedStudent);
      // After save: merge updated values with existing formData to preserve unsaved changes in other tabs
      // Only update fields that were saved, don't overwrite entire formData
      setFormData((prevFormData) => {
        const mergedData: Partial<Student> = {
          ...prevFormData, // Preserve unsaved changes
          ...normalizedStudent, // Override with saved values
          status: normalizedStudent.status || getSmartDefault("student_status") || prevFormData.status || "",
        };
        // Refetch taxonomies with updated values
        setTimeout(() => {
          fetchTaxonomies(mergedData);
        }, 0);
        return mergedData;
      });
      setFormDataInitialized(true);
    }

    setSaving(false);
    setError(null);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Student Details</h1>
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  if (error && !student) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="size-4 mr-2" />
            Back
          </Button>
          <h1 className="text-2xl font-semibold">Student Details</h1>
        </div>
        <Card>
          <CardContent className="py-8 text-center text-destructive">
            {error || "Student not found"}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!student) {
    return null;
  }

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return "—";
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return "—";
    }
  };

  const displayName = () => {
    if (student.legal_first_name && student.legal_last_name) {
      return `${student.legal_last_name}, ${student.legal_first_name}`;
    }
    if (student.first_name && student.last_name) {
      return `${student.last_name}, ${student.first_name}`;
    }
    return "Unknown";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="size-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="text-2xl font-semibold">Student Details</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {displayName()}
            {student.student_number && ` • ${student.student_number}`}
          </p>
        </div>
      </div>

      {/* Edge case banners */}
      {isLegacy() && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="py-3">
            <div className="flex items-center gap-2 text-sm text-yellow-800">
              <AlertCircle className="size-4" />
              <span>Legacy record — limited edit capabilities. Some demographic fields may be unavailable.</span>
            </div>
          </CardContent>
        </Card>
      )}

      {isWithdrawn() && (
        <Card className="border-gray-200 bg-gray-50">
          <CardContent className="py-3">
            <div className="flex items-center gap-2 text-sm text-gray-800">
              <AlertCircle className="size-4" />
              <span>This student is withdrawn. Record is read-only.</span>
            </div>
          </CardContent>
        </Card>
      )}

      {isMinor() && !formData.guardian_name && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="py-3">
            <div className="flex items-center gap-2 text-sm text-orange-800">
              <AlertCircle className="size-4" />
              <span>Guardian information is required for students under 18.</span>
            </div>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="border-destructive">
          <CardContent className="py-3">
            <div className="text-sm text-destructive">{error}</div>
          </CardContent>
        </Card>
      )}


      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="identity">Identity</TabsTrigger>
          <TabsTrigger value="contact">Contact</TabsTrigger>
          <TabsTrigger value="guardians">Guardians</TabsTrigger>
          <TabsTrigger value="demographics">Demographics</TabsTrigger>
          <TabsTrigger value="education">Education</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Current Enrollment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="text-sm text-muted-foreground mb-1">School</div>
                <div className="text-lg">
                  {school ? (
                    school.name
                  ) : student.admission_id ? (
                    <span className="text-muted-foreground">Unknown</span>
                  ) : (
                    <span className="text-muted-foreground italic">Legacy record (no admission reference)</span>
                  )}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">Program</div>
                <div className="text-lg">
                  {program ? (
                    program.name
                  ) : student.admission_id ? (
                    <span className="text-muted-foreground">Unknown</span>
                  ) : (
                    <span className="text-muted-foreground italic">Legacy record (no admission reference)</span>
                  )}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">Section</div>
                <div className="text-lg">
                  {section ? (
                    section.name
                  ) : (
                    <span className="text-muted-foreground italic">Unassigned</span>
                  )}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">Enrolled Date</div>
                <div className="text-lg">{formatDate(student.created_at)}</div>
              </div>
              {admission && (
                <div className="pt-2 border-t">
                  <div className="text-xs text-muted-foreground">
                    Enrollment details are derived from the admission record. To modify enrollment, update the admission record.
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {admission && (
            <Card>
              <CardHeader>
                <CardTitle>Admission Reference</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Admission ID</div>
                  <div className="text-lg font-mono text-sm break-all">{admission.id}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Status</div>
                  <div className="text-lg capitalize">{admission.status}</div>
                </div>
                <div className="pt-2 border-t">
                  <div className="text-xs text-muted-foreground">
                    This student was enrolled from admission. Enrollment details are derived from the admission record and cannot be modified here.
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Identity Tab */}
        <TabsContent value="identity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Core Identity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="legal_first_name">Legal First Name *</Label>
                  <Input
                    id="legal_first_name"
                    value={formData.legal_first_name || ""}
                    onChange={(e) => setFormData({ ...formData, legal_first_name: e.target.value })}
                    disabled={!canEdit || isWithdrawn()}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="legal_last_name">Legal Last Name *</Label>
                  <Input
                    id="legal_last_name"
                    value={formData.legal_last_name || ""}
                    onChange={(e) => setFormData({ ...formData, legal_last_name: e.target.value })}
                    disabled={!canEdit || isWithdrawn()}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="preferred_name">Preferred Name</Label>
                <Input
                  id="preferred_name"
                  value={formData.preferred_name || ""}
                  onChange={(e) => setFormData({ ...formData, preferred_name: e.target.value })}
                  disabled={!canEdit || isWithdrawn()}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="date_of_birth">Date of Birth</Label>
                <Input
                  id="date_of_birth"
                  type="date"
                  value={formData.date_of_birth || ""}
                  onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                  disabled={!canEdit || isWithdrawn()}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sex_id">Sex *</Label>
                <Select
                  value={formData.sex_id ? String(formData.sex_id).trim() : ""}
                  onValueChange={(value) => setFormData({ ...formData, sex_id: value ? value.trim() : null })}
                  disabled={!canEdit || isWithdrawn()}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select sex" />
                  </SelectTrigger>
                  <SelectContent>
                    {sexOptions.length === 0 ? (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">No options configured</div>
                    ) : (
                      sexOptions.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.label}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {formData.sex_id && !sexOptions.some(item => item.id === formData.sex_id) && (
                  <p className="text-xs text-yellow-600">
                    Value no longer supported — please update
                  </p>
                )}
                {formData.sex_id && isSystemDefaultId(formData.sex_id) && (
                  <p className="text-xs text-orange-600">
                    ⚠️ System default selected. This will be saved as empty. Please configure Sex taxonomy items in Settings → Taxonomies to save a value.
                  </p>
                )}
                {taxonomyDefaults.has(TAXONOMY_KEYS.sex) && taxonomyDefaults.get(TAXONOMY_KEYS.sex) && !formData.sex_id && (
                  <p className="text-xs text-muted-foreground">
                    Using system defaults. You can customize this later in Settings → Taxonomies.
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="nationality">Nationality</Label>
                <Input
                  id="nationality"
                  value={formData.nationality || ""}
                  onChange={(e) => setFormData({ ...formData, nationality: e.target.value })}
                  disabled={!canEdit || isWithdrawn()}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="student_number">Student Number</Label>
                <Input
                  id="student_number"
                  value={formData.student_number || ""}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">System-generated, read-only</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status || getSmartDefault("student_status") || ""}
                  onValueChange={(value) => setFormData({ ...formData, status: value })}
                  disabled={!canEdit || isWithdrawn()}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((item) => (
                      <SelectItem key={item.id} value={item.code}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {taxonomyDefaults.has("student_status") && taxonomyDefaults.get("student_status") && (
                  <p className="text-xs text-muted-foreground">
                    Using system defaults. You can customize this later in Settings → Taxonomies.
                  </p>
                )}
              </div>
              {canEdit && !isWithdrawn() && (
                <div className="flex justify-end pt-4">
                  <Button onClick={() => handleSave("identity")} disabled={saving}>
                    {saving ? (
                      <>
                        <Loader2 className="size-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="size-4 mr-2" />
                        Save Identity
                      </>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Contact Tab */}
        <TabsContent value="contact" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Contact & Address</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="primary_email">Primary Email</Label>
                <Input
                  id="primary_email"
                  type="email"
                  value={formData.primary_email || ""}
                  onChange={(e) => setFormData({ ...formData, primary_email: e.target.value })}
                  disabled={!canEdit || isWithdrawn()}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone || ""}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  disabled={!canEdit || isWithdrawn()}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Textarea
                  id="address"
                  value={formData.address || ""}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  disabled={!canEdit || isWithdrawn()}
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="emergency_contact_name">Emergency Contact Name</Label>
                <Input
                  id="emergency_contact_name"
                  value={formData.emergency_contact_name || ""}
                  onChange={(e) => setFormData({ ...formData, emergency_contact_name: e.target.value })}
                  disabled={!canEdit || isWithdrawn()}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="emergency_contact_phone">Emergency Contact Phone</Label>
                <Input
                  id="emergency_contact_phone"
                  type="tel"
                  value={formData.emergency_contact_phone || ""}
                  onChange={(e) => setFormData({ ...formData, emergency_contact_phone: e.target.value })}
                  disabled={!canEdit || isWithdrawn()}
                />
              </div>
              {canEdit && !isWithdrawn() && (
                <div className="flex justify-end pt-4">
                  <Button onClick={() => handleSave("contact")} disabled={saving}>
                    {saving ? (
                      <>
                        <Loader2 className="size-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="size-4 mr-2" />
                        Save Contact
                      </>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Guardians Tab */}
        <TabsContent value="guardians" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Guardian / Sponsor</CardTitle>
              {isMinor() && (
                <p className="text-sm text-muted-foreground">Required for students under 18</p>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="guardian_name">
                  Guardian Name {isMinor() && "*"}
                </Label>
                <Input
                  id="guardian_name"
                  value={formData.guardian_name || ""}
                  onChange={(e) => setFormData({ ...formData, guardian_name: e.target.value })}
                  disabled={!canEdit || isWithdrawn()}
                  required={isMinor()}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="guardian_relationship_id">Relationship</Label>
                <Select
                  value={formData.guardian_relationship_id ? String(formData.guardian_relationship_id).trim() : ""}
                  onValueChange={(value) => setFormData({ ...formData, guardian_relationship_id: value ? value.trim() : null })}
                  disabled={!canEdit || isWithdrawn()}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select relationship" />
                  </SelectTrigger>
                  <SelectContent>
                    {relationshipOptions.length === 0 ? (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">No options configured</div>
                    ) : (
                      relationshipOptions.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.label}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {taxonomyDefaults.has(TAXONOMY_KEYS.guardianRelationship) && taxonomyDefaults.get(TAXONOMY_KEYS.guardianRelationship) && (
                  <p className="text-xs text-muted-foreground">
                    Using system defaults. You can customize this later in Settings → Taxonomies.
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="guardian_email">Guardian Email</Label>
                <Input
                  id="guardian_email"
                  type="email"
                  value={formData.guardian_email || ""}
                  onChange={(e) => setFormData({ ...formData, guardian_email: e.target.value })}
                  disabled={!canEdit || isWithdrawn()}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="guardian_phone">
                  Guardian Phone {isMinor() && "*"}
                </Label>
                <Input
                  id="guardian_phone"
                  type="tel"
                  value={formData.guardian_phone || ""}
                  onChange={(e) => setFormData({ ...formData, guardian_phone: e.target.value })}
                  disabled={!canEdit || isWithdrawn()}
                  required={isMinor()}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="consent_flags"
                  checked={formData.consent_flags || false}
                  onCheckedChange={(checked) => setFormData({ ...formData, consent_flags: checked })}
                  disabled={!canEdit || isWithdrawn()}
                />
                <Label htmlFor="consent_flags" className="cursor-pointer">
                  Consent flags enabled
                </Label>
              </div>
              {canEdit && !isWithdrawn() && (
                <div className="flex justify-end pt-4">
                  <Button onClick={() => handleSave("guardians")} disabled={saving}>
                    {saving ? (
                      <>
                        <Loader2 className="size-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="size-4 mr-2" />
                        Save Guardians
                      </>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Demographics Tab */}
        <TabsContent value="demographics" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Demographics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLegacy() && (
                <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                  <p className="text-sm text-yellow-800">
                    Legacy records have limited demographic editing capabilities.
                  </p>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="economic_status_id">Economic Status</Label>
                <Select
                  value={formData.economic_status_id ? String(formData.economic_status_id).trim() : ""}
                  onValueChange={(value) => {
                    // DEV DEBUG: Log Select value change
                    if (process.env.NODE_ENV === 'development') {
                      console.log('[DEV] Economic status Select onChange:', {
                        newValue: value,
                        formDataValue: formData.economic_status_id,
                      });
                    }
                    setFormData({ ...formData, economic_status_id: value ? value.trim() : null });
                  }}
                  disabled={!canEdit || isWithdrawn() || isLegacy()}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select economic status (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {economicStatusOptions.length === 0 ? (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">No options configured</div>
                    ) : (
                      economicStatusOptions.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.label}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {/* DEV DEBUG: Log Select render state */}
                {process.env.NODE_ENV === 'development' && (
                  <div className="text-xs text-muted-foreground mt-1">
                    [DEV] Select value: {formData.economic_status_id || 'null'} | Options: {economicStatusOptions.length}
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="primary_language_id">Primary Language</Label>
                <Select
                  value={formData.primary_language_id ? String(formData.primary_language_id).trim() : ""}
                  onValueChange={(value) => {
                    // DEV DEBUG: Log Select value change
                    if (process.env.NODE_ENV === 'development') {
                      console.log('[DEV] Primary language Select onChange:', {
                        newValue: value,
                        formDataValue: formData.primary_language_id,
                      });
                    }
                    setFormData({ ...formData, primary_language_id: value ? value.trim() : null });
                  }}
                  disabled={!canEdit || isWithdrawn() || isLegacy()}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent>
                    {languageOptions.length === 0 ? (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">No options configured</div>
                    ) : (
                      languageOptions.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.label}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {/* DEV DEBUG: Log Select render state */}
                {process.env.NODE_ENV === 'development' && (
                  <div className="text-xs text-muted-foreground mt-1">
                    [DEV] Select value: {formData.primary_language_id || 'null'} | Options: {languageOptions.length}
                  </div>
                )}
                {taxonomyDefaults.has("language") && taxonomyDefaults.get("language") && (
                  <p className="text-xs text-muted-foreground">
                    Using system defaults. You can customize this later in Settings → Taxonomies.
                  </p>
                )}
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="special_needs_flag"
                  checked={formData.special_needs_flag || false}
                  onCheckedChange={(checked) => setFormData({ ...formData, special_needs_flag: checked })}
                  disabled={!canEdit || isWithdrawn() || isLegacy()}
                />
                <Label htmlFor="special_needs_flag" className="cursor-pointer">
                  Special needs flag (no diagnosis details)
                </Label>
              </div>
              {canEdit && !isWithdrawn() && !isLegacy() && (
                <div className="flex justify-end pt-4">
                  <Button onClick={() => handleSave("demographics")} disabled={saving}>
                    {saving ? (
                      <>
                        <Loader2 className="size-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="size-4 mr-2" />
                        Save Demographics
                      </>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Education Context Tab */}
        <TabsContent value="education" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Education Context</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="previous_school">Previous School</Label>
                <Input
                  id="previous_school"
                  value={formData.previous_school || ""}
                  onChange={(e) => setFormData({ ...formData, previous_school: e.target.value })}
                  disabled={!canEdit || isWithdrawn()}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="entry_type">Entry Type</Label>
                <Select
                  value={formData.entry_type || ""}
                  onValueChange={(value) => setFormData({ ...formData, entry_type: value })}
                  disabled={!canEdit || isWithdrawn()}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select entry type" />
                  </SelectTrigger>
                  <SelectContent>
                    {entryTypeOptions.map((item) => (
                      <SelectItem key={item.id} value={item.code}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {taxonomyDefaults.has("entry_type") && taxonomyDefaults.get("entry_type") && (
                  <p className="text-xs text-muted-foreground">
                    Using system defaults. You can customize this later in Settings → Taxonomies.
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes || ""}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  disabled={!canEdit || isWithdrawn()}
                  rows={5}
                  placeholder="Free text notes about the student..."
                />
              </div>
              {canEdit && !isWithdrawn() && (
                <div className="flex justify-end pt-4">
                  <Button onClick={() => handleSave("education")} disabled={saving}>
                    {saving ? (
                      <>
                        <Loader2 className="size-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="size-4 mr-2" />
                        Save Education Context
                      </>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="documents" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Documents</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm">Document management will be available in a future release.</p>
                <p className="text-xs mt-2">This section will support compliance-safe document storage and tracking.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
