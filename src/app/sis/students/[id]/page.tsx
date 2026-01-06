"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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

interface Student {
  id: string;
  legal_first_name?: string | null;
  legal_last_name?: string | null;
  preferred_name?: string | null;
  date_of_birth?: string | null;
  sex?: string | null;
  nationality?: string | null;
  student_number?: string | null;
  status?: string | null;
  primary_email?: string | null;
  phone?: string | null;
  address?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  guardian_name?: string | null;
  guardian_relationship?: string | null;
  guardian_email?: string | null;
  guardian_phone?: string | null;
  consent_flags?: boolean | null;
  economic_status?: string | null;
  primary_language?: string | null;
  special_needs_flag?: boolean | null;
  previous_school?: string | null;
  entry_type?: string | null;
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

interface TaxonomyItem {
  id: string;
  code: string;
  label: string;
}

export default function StudentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const studentId = params.id as string;
  
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
  const [activeTab, setActiveTab] = useState("overview");

  // Taxonomy data
  const [sexOptions, setSexOptions] = useState<TaxonomyItem[]>([]);
  const [economicStatusOptions, setEconomicStatusOptions] = useState<TaxonomyItem[]>([]);
  const [languageOptions, setLanguageOptions] = useState<TaxonomyItem[]>([]);
  const [relationshipOptions, setRelationshipOptions] = useState<TaxonomyItem[]>([]);
  const [statusOptions] = useState([
    { value: "active", label: "Active" },
    { value: "inactive", label: "Inactive" },
    { value: "withdrawn", label: "Withdrawn" },
  ]);
  const [entryTypeOptions] = useState([
    { value: "freshman", label: "Freshman" },
    { value: "transferee", label: "Transferee" },
    { value: "returning", label: "Returning" },
  ]);

  // Form state
  const [formData, setFormData] = useState<Partial<Student>>({});

  const fetchTaxonomies = async () => {
    // Fetch sex taxonomy
    const { data: sexTaxonomy } = await supabase
      .from("taxonomies")
      .select("id")
      .eq("key", "sex")
      .single();

    if (sexTaxonomy) {
      const { data: sexItems } = await supabase
        .from("taxonomy_items")
        .select("id, code, label")
        .eq("taxonomy_id", sexTaxonomy.id)
        .eq("is_active", true)
        .order("sort_order", { ascending: true, nullsFirst: false })
        .order("label", { ascending: true });
      if (sexItems) setSexOptions(sexItems);
    }

    // Fetch economic_status taxonomy
    const { data: economicTaxonomy } = await supabase
      .from("taxonomies")
      .select("id")
      .eq("key", "economic_status")
      .single();

    if (economicTaxonomy) {
      const { data: economicItems } = await supabase
        .from("taxonomy_items")
        .select("id, code, label")
        .eq("taxonomy_id", economicTaxonomy.id)
        .eq("is_active", true)
        .order("sort_order", { ascending: true, nullsFirst: false })
        .order("label", { ascending: true });
      if (economicItems) setEconomicStatusOptions(economicItems);
    }

    // Fetch language taxonomy
    const { data: languageTaxonomy } = await supabase
      .from("taxonomies")
      .select("id")
      .eq("key", "primary_language")
      .single();

    if (languageTaxonomy) {
      const { data: languageItems } = await supabase
        .from("taxonomy_items")
        .select("id, code, label")
        .eq("taxonomy_id", languageTaxonomy.id)
        .eq("is_active", true)
        .order("sort_order", { ascending: true, nullsFirst: false })
        .order("label", { ascending: true });
      if (languageItems) setLanguageOptions(languageItems);
    }

    // Fetch guardian_relationship taxonomy
    const { data: relationshipTaxonomy } = await supabase
      .from("taxonomies")
      .select("id")
      .eq("key", "guardian_relationship")
      .single();

    if (relationshipTaxonomy) {
      const { data: relationshipItems } = await supabase
        .from("taxonomy_items")
        .select("id, code, label")
        .eq("taxonomy_id", relationshipTaxonomy.id)
        .eq("is_active", true)
        .order("sort_order", { ascending: true, nullsFirst: false })
        .order("label", { ascending: true });
      if (relationshipItems) setRelationshipOptions(relationshipItems);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      if (!studentId) {
        setError("Student ID is required");
        setLoading(false);
        return;
      }

      // Fetch user role
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", session.user.id)
          .single();
        if (profile?.role) {
          const normalizedRole = normalizeRole(profile.role);
          setRole(normalizedRole);
          setOriginalRole(profile.role);
        }
      }

      // Fetch taxonomies
      await fetchTaxonomies();

      // Fetch student - try comprehensive fields first, fallback to legacy
      const { data: studentData, error: studentError } = await supabase
        .from("students")
        .select(`
          id,
          legal_first_name,
          legal_last_name,
          preferred_name,
          date_of_birth,
          sex,
          nationality,
          student_number,
          status,
          primary_email,
          phone,
          address,
          emergency_contact_name,
          emergency_contact_phone,
          guardian_name,
          guardian_relationship,
          guardian_email,
          guardian_phone,
          consent_flags,
          economic_status,
          primary_language,
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
            setFormData(normalizedLegacy);
            
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
        };
        setStudent(normalizedStudent);
        setFormData(normalizedStudent);

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
      if (formData.sex !== undefined) updatePayload.sex = formData.sex || null;
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
      if (formData.guardian_relationship !== undefined) updatePayload.guardian_relationship = formData.guardian_relationship || null;
      if (formData.guardian_email !== undefined) updatePayload.guardian_email = formData.guardian_email || null;
      if (formData.guardian_phone !== undefined) updatePayload.guardian_phone = formData.guardian_phone || null;
      if (formData.consent_flags !== undefined) updatePayload.consent_flags = formData.consent_flags || null;
    } else if (tab === "demographics") {
      if (formData.economic_status !== undefined) updatePayload.economic_status = formData.economic_status || null;
      if (formData.primary_language !== undefined) updatePayload.primary_language = formData.primary_language || null;
      if (formData.special_needs_flag !== undefined) updatePayload.special_needs_flag = formData.special_needs_flag || null;
    } else if (tab === "education") {
      if (formData.previous_school !== undefined) updatePayload.previous_school = formData.previous_school || null;
      if (formData.entry_type !== undefined) updatePayload.entry_type = formData.entry_type || null;
      if (formData.notes !== undefined) updatePayload.notes = formData.notes || null;
    }

    const { error: updateError } = await supabase
      .from("students")
      .update(updatePayload)
      .eq("id", studentId);

    if (updateError) {
      console.error("Error updating student:", updateError);
      setError(updateError.message || "Failed to save changes.");
      setSaving(false);
      return;
    }

    // Refresh student data
    const { data: updatedStudent } = await supabase
      .from("students")
      .select("*")
      .eq("id", studentId)
      .single();

    if (updatedStudent) {
      const normalizedStudent: Student = {
        ...updatedStudent,
        legal_first_name: updatedStudent.legal_first_name || updatedStudent.first_name,
        legal_last_name: updatedStudent.legal_last_name || updatedStudent.last_name,
        primary_email: updatedStudent.primary_email || updatedStudent.email,
      };
      setStudent(normalizedStudent);
      setFormData(normalizedStudent);
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

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="identity">Identity</TabsTrigger>
          <TabsTrigger value="contact">Contact</TabsTrigger>
          <TabsTrigger value="guardians">Guardians</TabsTrigger>
          <TabsTrigger value="demographics">Demographics</TabsTrigger>
          <TabsTrigger value="education">Education</TabsTrigger>
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
                <Label htmlFor="sex">Sex</Label>
                <Select
                  value={formData.sex || ""}
                  onValueChange={(value) => setFormData({ ...formData, sex: value })}
                  disabled={!canEdit || isWithdrawn()}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select sex" />
                  </SelectTrigger>
                  <SelectContent>
                    {sexOptions.map((item) => (
                      <SelectItem key={item.id} value={item.code}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                  value={formData.status || "active"}
                  onValueChange={(value) => setFormData({ ...formData, status: value })}
                  disabled={!canEdit || isWithdrawn()}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                <Label htmlFor="guardian_relationship">Relationship</Label>
                <Select
                  value={formData.guardian_relationship || ""}
                  onValueChange={(value) => setFormData({ ...formData, guardian_relationship: value })}
                  disabled={!canEdit || isWithdrawn()}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select relationship" />
                  </SelectTrigger>
                  <SelectContent>
                    {relationshipOptions.map((item) => (
                      <SelectItem key={item.id} value={item.code}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                <Label htmlFor="economic_status">Economic Status</Label>
                <Select
                  value={formData.economic_status || ""}
                  onValueChange={(value) => setFormData({ ...formData, economic_status: value })}
                  disabled={!canEdit || isWithdrawn() || isLegacy()}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select economic status" />
                  </SelectTrigger>
                  <SelectContent>
                    {economicStatusOptions.map((item) => (
                      <SelectItem key={item.id} value={item.code}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="primary_language">Primary Language</Label>
                <Select
                  value={formData.primary_language || ""}
                  onValueChange={(value) => setFormData({ ...formData, primary_language: value })}
                  disabled={!canEdit || isWithdrawn() || isLegacy()}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent>
                    {languageOptions.map((item) => (
                      <SelectItem key={item.id} value={item.code}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                    {entryTypeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
      </Tabs>
    </div>
  );
}
