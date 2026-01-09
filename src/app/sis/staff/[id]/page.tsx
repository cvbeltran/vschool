"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { normalizeRole } from "@/lib/rbac";

interface Staff {
  id: string;
  user_id: string | null;
  staff_id: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  suffix: string | null;
  preferred_name: string | null;
  date_of_birth: string | null;
  sex_id: string | null;
  civil_status_id: string | null;
  nationality: string | null;
  government_id_type_id: string | null;
  government_id_number: string | null;
  home_address: string | null;
  permanent_address: string | null;
  mobile_number: string | null;
  email_address: string;
  emergency_contact_name: string | null;
  emergency_contact_relationship_id: string | null;
  emergency_contact_number: string | null;
}

interface Employment {
  id: string;
  staff_id: string;
  school_id: string | null;
  employment_status_id: string | null;
  position_title_id: string | null;
  department_id: string | null;
  subject_area_id: string | null;
  employment_start_date: string | null;
  employment_end_date: string | null;
  contract_type_id: string | null;
  salary_rate: number | null;
  pay_schedule_id: string | null;
  work_schedule: any;
  highest_education_level_id: string | null;
  degree_title: string | null;
  major_specialization: string | null;
  school_graduated: string | null;
  year_graduated: number | null;
  prc_license_number: string | null;
  prc_license_issue_date: string | null;
  prc_license_expiry_date: string | null;
  eligibility_type_id: string | null;
  total_years_teaching: number | null;
  is_active: boolean;
}

interface Compliance {
  id: string;
  staff_id: string;
  medical_clearance_date: string | null;
  medical_clearance_expiry_date: string | null;
  medical_clearance_status: string | null;
  nbi_clearance_date: string | null;
  nbi_clearance_expiry_date: string | null;
  nbi_clearance_status: string | null;
  police_clearance_date: string | null;
  police_clearance_expiry_date: string | null;
  police_clearance_status: string | null;
  barangay_clearance_date: string | null;
  barangay_clearance_expiry_date: string | null;
  barangay_clearance_status: string | null;
  drug_test_date: string | null;
  drug_test_expiry_date: string | null;
  drug_test_result: string | null;
  data_privacy_consent: boolean;
  data_privacy_consent_date: string | null;
  code_of_conduct_acknowledged: boolean;
  code_of_conduct_acknowledged_date: string | null;
}

interface Payroll {
  id: string;
  staff_id: string;
  tin_number: string | null;
  sss_number: string | null;
  philhealth_number: string | null;
  pagibig_number: string | null;
  bank_name: string | null;
  bank_account_number: string | null;
  bank_account_name: string | null;
}

interface TaxonomyOption {
  id: string;
  label: string;
}

export default function StaffDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const staffId = params.id as string;

  const [staff, setStaff] = useState<Staff | null>(null);
  const [employment, setEmployment] = useState<Employment | null>(null);
  const [compliance, setCompliance] = useState<Compliance | null>(null);
  const [payroll, setPayroll] = useState<Payroll | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [role, setRole] = useState<"principal" | "admin" | "teacher">("principal");

  // Tab state
  const tabFromUrl = searchParams.get("tab") || "identity";
  const [activeTab, setActiveTab] = useState(tabFromUrl);

  // Taxonomy options
  const [sexOptions, setSexOptions] = useState<TaxonomyOption[]>([]);
  const [civilStatusOptions, setCivilStatusOptions] = useState<TaxonomyOption[]>([]);
  const [governmentIdTypeOptions, setGovernmentIdTypeOptions] = useState<TaxonomyOption[]>([]);
  const [emergencyContactRelationshipOptions, setEmergencyContactRelationshipOptions] = useState<TaxonomyOption[]>([]);
  const [employmentStatusOptions, setEmploymentStatusOptions] = useState<TaxonomyOption[]>([]);
  const [positionTitleOptions, setPositionTitleOptions] = useState<TaxonomyOption[]>([]);
  const [departmentOptions, setDepartmentOptions] = useState<TaxonomyOption[]>([]);
  const [subjectAreaOptions, setSubjectAreaOptions] = useState<TaxonomyOption[]>([]);
  const [gradeLevelOptions, setGradeLevelOptions] = useState<TaxonomyOption[]>([]);
  const [contractTypeOptions, setContractTypeOptions] = useState<TaxonomyOption[]>([]);
  const [payScheduleOptions, setPayScheduleOptions] = useState<TaxonomyOption[]>([]);
  const [educationLevelOptions, setEducationLevelOptions] = useState<TaxonomyOption[]>([]);
  const [eligibilityTypeOptions, setEligibilityTypeOptions] = useState<TaxonomyOption[]>([]);
  const [schools, setSchools] = useState<{ id: string; name: string }[]>([]);
  const [selectedGradeLevels, setSelectedGradeLevels] = useState<string[]>([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState<string | null>(null);
  const [staffEmployments, setStaffEmployments] = useState<Employment[]>([]);

  // Form data
  const [staffFormData, setStaffFormData] = useState<Partial<Staff>>({});
  const [employmentFormData, setEmploymentFormData] = useState<Partial<Employment>>({});
  const [complianceFormData, setComplianceFormData] = useState<Partial<Compliance>>({});
  const [payrollFormData, setPayrollFormData] = useState<Partial<Payroll>>({});

  useEffect(() => {
    const fetchData = async () => {
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
          setRole(normalizeRole(profile.role));
        }
      }

      // Fetch staff data
      const { data: staffData, error: staffError } = await supabase
        .from("staff")
        .select("*")
        .eq("id", staffId)
        .single();

      if (staffError) {
        setError(staffError.message || "Failed to fetch staff data");
        setLoading(false);
        return;
      }

      setStaff(staffData);
      setStaffFormData(staffData);

      // Fetch all employment records for this staff member
      const { data: allEmployments } = await supabase
        .from("staff_employment")
        .select("*")
        .eq("staff_id", staffId)
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (allEmployments && allEmployments.length > 0) {
        setStaffEmployments(allEmployments);
        
        // Set selected school from URL param or use first employment's school
        const schoolFromUrl = searchParams.get("school");
        const initialSchoolId = schoolFromUrl || allEmployments[0].school_id;
        setSelectedSchoolId(initialSchoolId);
        
        // Load employment for selected school
        await loadEmploymentForSchool(initialSchoolId, allEmployments);
      } else {
        // No employment records yet - will need to create one when school is selected
        setStaffEmployments([]);
      }

      // Fetch compliance data
      const { data: complianceData } = await supabase
        .from("staff_compliance")
        .select("*")
        .eq("staff_id", staffId)
        .single();

      if (complianceData) {
        setCompliance(complianceData);
        setComplianceFormData(complianceData);
      }

      // Fetch payroll data
      const { data: payrollData } = await supabase
        .from("staff_payroll")
        .select("*")
        .eq("staff_id", staffId)
        .single();

      if (payrollData) {
        setPayroll(payrollData);
        setPayrollFormData(payrollData);
      }

      // Fetch taxonomies
      await fetchTaxonomies();

      setLoading(false);
    };

    fetchData();
  }, [staffId]);

  // Function to load employment data for a specific school
  const loadEmploymentForSchool = async (schoolId: string | null, employmentsList?: Employment[]) => {
    if (!schoolId) {
      setEmployment(null);
      setEmploymentFormData({});
      setSelectedGradeLevels([]);
      return;
    }

    // Use provided list or fetch from state
    const employments = employmentsList || staffEmployments;
    
    // Find employment for this school
    const employmentForSchool = employments.find((emp) => emp.school_id === schoolId);

    if (employmentForSchool) {
      setEmployment(employmentForSchool);
      setEmploymentFormData(employmentForSchool);

      // Fetch grade levels for this employment
      const { data: gradeLevelData } = await supabase
        .from("staff_employment_grade_levels")
        .select("grade_level_id")
        .eq("staff_employment_id", employmentForSchool.id);

      if (gradeLevelData) {
        setSelectedGradeLevels(gradeLevelData.map((g) => g.grade_level_id));
      } else {
        setSelectedGradeLevels([]);
      }
    } else {
      // No employment record for this school yet - initialize empty form
      setEmployment(null);
      setEmploymentFormData({
        school_id: schoolId,
        staff_id: staffId,
        is_active: true,
      });
      setSelectedGradeLevels([]);
    }
  };

  // Handle school selection change
  const handleSchoolChange = async (schoolId: string) => {
    setSelectedSchoolId(schoolId);
    
    // Update URL to reflect selected school
    const url = new URL(window.location.href);
    url.searchParams.set("school", schoolId);
    router.replace(url.pathname + url.search, { scroll: false });
    
    // Load employment for selected school
    await loadEmploymentForSchool(schoolId);
  };

  // Separate effect to handle school changes from URL
  useEffect(() => {
    const schoolFromUrl = searchParams.get("school");
    if (schoolFromUrl && schoolFromUrl !== selectedSchoolId && schools.length > 0) {
      // Only change if schools are loaded and it's different
      setSelectedSchoolId(schoolFromUrl);
      loadEmploymentForSchool(schoolFromUrl);
    }
  }, [searchParams, schools.length, selectedSchoolId]);

  const fetchTaxonomies = async () => {
    const taxonomyKeys = [
      "sex",
      "civil_status",
      "government_id_type",
      "emergency_contact_relationship",
      "employment_status",
      "position_title",
      "department",
      "subject_area",
      "grade_level",
      "contract_type",
      "pay_schedule",
      "education_level",
      "eligibility_type",
    ];

    for (const key of taxonomyKeys) {
      const { data: taxonomy } = await supabase
        .from("taxonomies")
        .select("id")
        .eq("key", key)
        .single();

      if (taxonomy) {
        const { data: items } = await supabase
          .from("taxonomy_items")
          .select("id, label")
          .eq("taxonomy_id", taxonomy.id)
          .order("sort_order", { ascending: true });

        const options = items?.map((item) => ({ id: item.id, label: item.label })) || [];

        switch (key) {
          case "sex":
            setSexOptions(options);
            break;
          case "civil_status":
            setCivilStatusOptions(options);
            break;
          case "government_id_type":
            setGovernmentIdTypeOptions(options);
            break;
          case "emergency_contact_relationship":
            setEmergencyContactRelationshipOptions(options);
            break;
          case "employment_status":
            setEmploymentStatusOptions(options);
            break;
          case "position_title":
            setPositionTitleOptions(options);
            break;
          case "department":
            setDepartmentOptions(options);
            break;
          case "subject_area":
            setSubjectAreaOptions(options);
            break;
          case "grade_level":
            setGradeLevelOptions(options);
            break;
          case "contract_type":
            setContractTypeOptions(options);
            break;
          case "pay_schedule":
            setPayScheduleOptions(options);
            break;
          case "education_level":
            setEducationLevelOptions(options);
            break;
          case "eligibility_type":
            setEligibilityTypeOptions(options);
            break;
        }
      }
    }

    // Fetch schools
    const { data: schoolsData } = await supabase
      .from("schools")
      .select("id, name")
      .order("name", { ascending: true });

    if (schoolsData) {
      setSchools(schoolsData);
    }
  };

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", value);
    router.replace(url.pathname + url.search, { scroll: false });
  };

  const handleSaveStaff = async () => {
    setSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const { error: updateError } = await supabase
        .from("staff")
        .update(staffFormData)
        .eq("id", staffId);

      if (updateError) {
        setError(updateError.message || "Failed to update staff information");
        setSaving(false);
        return;
      }

      setSuccessMessage("Staff information updated successfully");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEmployment = async () => {
    setSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      // Ensure school_id is set
      if (!employmentFormData.school_id) {
        setError("Please select a school");
        setSaving(false);
        return;
      }

      let employmentId = employment?.id;

      if (employmentId) {
        // Update existing employment
        const { error: updateError } = await supabase
          .from("staff_employment")
          .update(employmentFormData)
          .eq("id", employmentId);

        if (updateError) {
          setError(updateError.message || "Failed to update employment information");
          setSaving(false);
          return;
        }
      } else {
        // Create new employment
        const { data: newEmployment, error: createError } = await supabase
          .from("staff_employment")
          .insert({
            ...employmentFormData,
            staff_id: staffId,
            is_active: true,
          })
          .select()
          .single();

        if (createError) {
          setError(createError.message || "Failed to create employment record");
          setSaving(false);
          return;
        }

        employmentId = newEmployment.id;
        setEmployment(newEmployment);
        
        // Add to staff employments list
        setStaffEmployments([...staffEmployments, newEmployment]);
      }

      // Update grade levels
      if (employmentId) {
        // Delete existing grade levels
        await supabase
          .from("staff_employment_grade_levels")
          .delete()
          .eq("staff_employment_id", employmentId);

        // Insert new grade levels
        if (selectedGradeLevels.length > 0) {
          await supabase
            .from("staff_employment_grade_levels")
            .insert(
              selectedGradeLevels.map((gradeLevelId) => ({
                staff_employment_id: employmentId,
                grade_level_id: gradeLevelId,
              }))
            );
        }
      }

      // Reload employment data to get updated record
      await loadEmploymentForSchool(selectedSchoolId);

      setSuccessMessage("Employment information updated successfully");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveCompliance = async () => {
    setSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      if (compliance) {
        // Update existing compliance
        const { error: updateError } = await supabase
          .from("staff_compliance")
          .update(complianceFormData)
          .eq("id", compliance.id);

        if (updateError) {
          setError(updateError.message || "Failed to update compliance information");
          setSaving(false);
          return;
        }
      } else {
        // Create new compliance
        const { error: createError } = await supabase
          .from("staff_compliance")
          .insert({
            ...complianceFormData,
            staff_id: staffId,
          });

        if (createError) {
          setError(createError.message || "Failed to create compliance record");
          setSaving(false);
          return;
        }
      }

      setSuccessMessage("Compliance information updated successfully");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setSaving(false);
    }
  };

  const handleSavePayroll = async () => {
    setSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      if (payroll) {
        // Update existing payroll
        const { error: updateError } = await supabase
          .from("staff_payroll")
          .update(payrollFormData)
          .eq("id", payroll.id);

        if (updateError) {
          setError(updateError.message || "Failed to update payroll information");
          setSaving(false);
          return;
        }
      } else {
        // Create new payroll
        const { error: createError } = await supabase
          .from("staff_payroll")
          .insert({
            ...payrollFormData,
            staff_id: staffId,
          });

        if (createError) {
          setError(createError.message || "Failed to create payroll record");
          setSaving(false);
          return;
        }
      }

      setSuccessMessage("Payroll information updated successfully");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="size-4 mr-2" />
            Back
          </Button>
          <h1 className="text-2xl font-semibold">Staff Details</h1>
        </div>
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  if (!staff) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="size-4 mr-2" />
            Back
          </Button>
          <h1 className="text-2xl font-semibold">Staff Details</h1>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <div className="text-muted-foreground">Staff member not found</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const displayName = `${staff.last_name}, ${staff.first_name}${staff.middle_name ? ` ${staff.middle_name}` : ""}${staff.suffix ? ` ${staff.suffix}` : ""}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="size-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="text-2xl font-semibold">Staff Details</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {displayName} • {staff.staff_id}
          </p>
        </div>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="py-4">
            <div className="text-sm text-destructive">{error}</div>
          </CardContent>
        </Card>
      )}

      {successMessage && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="py-4">
            <div className="text-sm text-green-600">{successMessage}</div>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
        <TabsList>
          <TabsTrigger value="identity">Identity & Contact</TabsTrigger>
          <TabsTrigger value="employment">Employment</TabsTrigger>
          <TabsTrigger value="compliance">Compliance</TabsTrigger>
          <TabsTrigger value="payroll">Payroll</TabsTrigger>
        </TabsList>

        {/* Identity & Contact Tab */}
        <TabsContent value="identity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Identity & Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="first_name">First Name *</Label>
                  <Input
                    id="first_name"
                    value={staffFormData.first_name || ""}
                    onChange={(e) => setStaffFormData({ ...staffFormData, first_name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="middle_name">Middle Name</Label>
                  <Input
                    id="middle_name"
                    value={staffFormData.middle_name || ""}
                    onChange={(e) => setStaffFormData({ ...staffFormData, middle_name: e.target.value || null })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="last_name">Last Name *</Label>
                  <Input
                    id="last_name"
                    value={staffFormData.last_name || ""}
                    onChange={(e) => setStaffFormData({ ...staffFormData, last_name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="suffix">Suffix</Label>
                  <Input
                    id="suffix"
                    value={staffFormData.suffix || ""}
                    onChange={(e) => setStaffFormData({ ...staffFormData, suffix: e.target.value || null })}
                    placeholder="Jr., Sr., II, III"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="preferred_name">Preferred Name</Label>
                <Input
                  id="preferred_name"
                  value={staffFormData.preferred_name || ""}
                  onChange={(e) => setStaffFormData({ ...staffFormData, preferred_name: e.target.value || null })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="date_of_birth">Date of Birth</Label>
                  <Input
                    id="date_of_birth"
                    type="date"
                    value={staffFormData.date_of_birth || ""}
                    onChange={(e) => setStaffFormData({ ...staffFormData, date_of_birth: e.target.value || null })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sex_id">Sex</Label>
                  <Select
                    value={staffFormData.sex_id || ""}
                    onValueChange={(value) => setStaffFormData({ ...staffFormData, sex_id: value || null })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select sex" />
                    </SelectTrigger>
                    <SelectContent>
                      {sexOptions.map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="civil_status_id">Civil Status</Label>
                  <Select
                    value={staffFormData.civil_status_id || ""}
                    onValueChange={(value) => setStaffFormData({ ...staffFormData, civil_status_id: value || null })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select civil status" />
                    </SelectTrigger>
                    <SelectContent>
                      {civilStatusOptions.map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nationality">Nationality</Label>
                  <Input
                    id="nationality"
                    value={staffFormData.nationality || ""}
                    onChange={(e) => setStaffFormData({ ...staffFormData, nationality: e.target.value || null })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="government_id_type_id">Government ID Type</Label>
                  <Select
                    value={staffFormData.government_id_type_id || ""}
                    onValueChange={(value) => setStaffFormData({ ...staffFormData, government_id_type_id: value || null })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select ID type" />
                    </SelectTrigger>
                    <SelectContent>
                      {governmentIdTypeOptions.map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="government_id_number">Government ID Number</Label>
                  <Input
                    id="government_id_number"
                    value={staffFormData.government_id_number || ""}
                    onChange={(e) => setStaffFormData({ ...staffFormData, government_id_number: e.target.value || null })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="home_address">Home Address</Label>
                <Textarea
                  id="home_address"
                  value={staffFormData.home_address || ""}
                  onChange={(e) => setStaffFormData({ ...staffFormData, home_address: e.target.value || null })}
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="permanent_address">Permanent Address</Label>
                <Textarea
                  id="permanent_address"
                  value={staffFormData.permanent_address || ""}
                  onChange={(e) => setStaffFormData({ ...staffFormData, permanent_address: e.target.value || null })}
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="mobile_number">Mobile Number</Label>
                  <Input
                    id="mobile_number"
                    value={staffFormData.mobile_number || ""}
                    onChange={(e) => setStaffFormData({ ...staffFormData, mobile_number: e.target.value || null })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email_address">Email Address *</Label>
                  <Input
                    id="email_address"
                    type="email"
                    value={staffFormData.email_address || ""}
                    onChange={(e) => setStaffFormData({ ...staffFormData, email_address: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="font-semibold mb-4">Emergency Contact</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="emergency_contact_name">Contact Name</Label>
                    <Input
                      id="emergency_contact_name"
                      value={staffFormData.emergency_contact_name || ""}
                      onChange={(e) => setStaffFormData({ ...staffFormData, emergency_contact_name: e.target.value || null })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="emergency_contact_relationship_id">Relationship</Label>
                    <Select
                      value={staffFormData.emergency_contact_relationship_id || ""}
                      onValueChange={(value) => setStaffFormData({ ...staffFormData, emergency_contact_relationship_id: value || null })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select relationship" />
                      </SelectTrigger>
                      <SelectContent>
                        {emergencyContactRelationshipOptions.map((option) => (
                          <SelectItem key={option.id} value={option.id}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="emergency_contact_number">Contact Number</Label>
                    <Input
                      id="emergency_contact_number"
                      value={staffFormData.emergency_contact_number || ""}
                      onChange={(e) => setStaffFormData({ ...staffFormData, emergency_contact_number: e.target.value || null })}
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button onClick={handleSaveStaff} disabled={saving}>
                  {saving && <Loader2 className="size-4 mr-2 animate-spin" />}
                  <Save className="size-4 mr-2" />
                  Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Employment Tab */}
        <TabsContent value="employment" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Employment Information</CardTitle>
                <div className="flex items-center gap-2">
                  <Label htmlFor="school_selector" className="text-sm text-muted-foreground">
                    View Employment for:
                  </Label>
                  <Select
                    value={selectedSchoolId || ""}
                    onValueChange={handleSchoolChange}
                  >
                    <SelectTrigger className="w-[250px]">
                      <SelectValue placeholder="Select school" />
                    </SelectTrigger>
                    <SelectContent>
                      {schools.map((school) => {
                        const hasEmployment = staffEmployments.some((emp) => emp.school_id === school.id);
                        return (
                          <SelectItem key={school.id} value={school.id}>
                            {school.name}
                            {hasEmployment ? " ✓" : " (New)"}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedSchoolId ? (
                <>
                  <div className="rounded-md bg-muted/50 p-3 text-sm">
                    <span className="font-medium">School: </span>
                    {schools.find((s) => s.id === selectedSchoolId)?.name || "Unknown"}
                    {employment && (
                      <span className="text-muted-foreground ml-2">
                        (Employment record exists)
                      </span>
                    )}
                    {!employment && (
                      <span className="text-muted-foreground ml-2">
                        (No employment record - fill form below to create)
                      </span>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="school_id">School *</Label>
                      <Select
                        value={employmentFormData.school_id || selectedSchoolId || ""}
                        onValueChange={(value) => {
                          setEmploymentFormData({ ...employmentFormData, school_id: value || null });
                          handleSchoolChange(value);
                        }}
                        disabled={!!employment} // Disable if employment record exists (to prevent changing school)
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select school" />
                        </SelectTrigger>
                        <SelectContent>
                          {schools.map((school) => (
                            <SelectItem key={school.id} value={school.id}>
                              {school.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {employment && (
                        <p className="text-xs text-muted-foreground">
                          To change school, use the selector above
                        </p>
                      )}
                    </div>
                <div className="space-y-2">
                  <Label htmlFor="employment_status_id">Employment Status</Label>
                  <Select
                    value={employmentFormData.employment_status_id || ""}
                    onValueChange={(value) => setEmploymentFormData({ ...employmentFormData, employment_status_id: value || null })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      {employmentStatusOptions.map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="position_title_id">Position Title</Label>
                  <Select
                    value={employmentFormData.position_title_id || ""}
                    onValueChange={(value) => setEmploymentFormData({ ...employmentFormData, position_title_id: value || null })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select position" />
                    </SelectTrigger>
                    <SelectContent>
                      {positionTitleOptions.map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="department_id">Department</Label>
                  <Select
                    value={employmentFormData.department_id || ""}
                    onValueChange={(value) => setEmploymentFormData({ ...employmentFormData, department_id: value || null })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      {departmentOptions.map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="employment_start_date">Employment Start Date</Label>
                  <Input
                    id="employment_start_date"
                    type="date"
                    value={employmentFormData.employment_start_date || ""}
                    onChange={(e) => setEmploymentFormData({ ...employmentFormData, employment_start_date: e.target.value || null })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="employment_end_date">Employment End Date</Label>
                  <Input
                    id="employment_end_date"
                    type="date"
                    value={employmentFormData.employment_end_date || ""}
                    onChange={(e) => setEmploymentFormData({ ...employmentFormData, employment_end_date: e.target.value || null })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Grade Levels</Label>
                <div className="grid grid-cols-4 gap-2">
                  {gradeLevelOptions.map((option) => (
                    <div key={option.id} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={`grade_${option.id}`}
                        checked={selectedGradeLevels.includes(option.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedGradeLevels([...selectedGradeLevels, option.id]);
                          } else {
                            setSelectedGradeLevels(selectedGradeLevels.filter((id) => id !== option.id));
                          }
                        }}
                        className="rounded"
                      />
                      <Label htmlFor={`grade_${option.id}`} className="text-sm font-normal cursor-pointer">
                        {option.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="font-semibold mb-4">Education & License</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="highest_education_level_id">Highest Education Level</Label>
                    <Select
                      value={employmentFormData.highest_education_level_id || ""}
                      onValueChange={(value) => setEmploymentFormData({ ...employmentFormData, highest_education_level_id: value || null })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select education level" />
                      </SelectTrigger>
                      <SelectContent>
                        {educationLevelOptions.map((option) => (
                          <SelectItem key={option.id} value={option.id}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="degree_title">Degree Title</Label>
                    <Input
                      id="degree_title"
                      value={employmentFormData.degree_title || ""}
                      onChange={(e) => setEmploymentFormData({ ...employmentFormData, degree_title: e.target.value || null })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="major_specialization">Major/Specialization</Label>
                    <Input
                      id="major_specialization"
                      value={employmentFormData.major_specialization || ""}
                      onChange={(e) => setEmploymentFormData({ ...employmentFormData, major_specialization: e.target.value || null })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="school_graduated">School Graduated</Label>
                    <Input
                      id="school_graduated"
                      value={employmentFormData.school_graduated || ""}
                      onChange={(e) => setEmploymentFormData({ ...employmentFormData, school_graduated: e.target.value || null })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="year_graduated">Year Graduated</Label>
                    <Input
                      id="year_graduated"
                      type="number"
                      value={employmentFormData.year_graduated || ""}
                      onChange={(e) => setEmploymentFormData({ ...employmentFormData, year_graduated: e.target.value ? parseInt(e.target.value) : null })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="total_years_teaching">Total Years Teaching</Label>
                    <Input
                      id="total_years_teaching"
                      type="number"
                      step="0.1"
                      value={employmentFormData.total_years_teaching || ""}
                      onChange={(e) => setEmploymentFormData({ ...employmentFormData, total_years_teaching: e.target.value ? parseFloat(e.target.value) : null })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="prc_license_number">PRC License Number</Label>
                    <Input
                      id="prc_license_number"
                      value={employmentFormData.prc_license_number || ""}
                      onChange={(e) => setEmploymentFormData({ ...employmentFormData, prc_license_number: e.target.value || null })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="prc_license_issue_date">Issue Date</Label>
                    <Input
                      id="prc_license_issue_date"
                      type="date"
                      value={employmentFormData.prc_license_issue_date || ""}
                      onChange={(e) => setEmploymentFormData({ ...employmentFormData, prc_license_issue_date: e.target.value || null })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="prc_license_expiry_date">Expiry Date</Label>
                    <Input
                      id="prc_license_expiry_date"
                      type="date"
                      value={employmentFormData.prc_license_expiry_date || ""}
                      onChange={(e) => setEmploymentFormData({ ...employmentFormData, prc_license_expiry_date: e.target.value || null })}
                    />
                  </div>
                </div>

                <div className="mt-4">
                  <Label htmlFor="eligibility_type_id">Eligibility Type</Label>
                  <Select
                    value={employmentFormData.eligibility_type_id || ""}
                    onValueChange={(value) => setEmploymentFormData({ ...employmentFormData, eligibility_type_id: value || null })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select eligibility type" />
                    </SelectTrigger>
                    <SelectContent>
                      {eligibilityTypeOptions.map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

                  <div className="flex justify-end gap-2 pt-4">
                    <Button onClick={handleSaveEmployment} disabled={saving}>
                      {saving && <Loader2 className="size-4 mr-2 animate-spin" />}
                      <Save className="size-4 mr-2" />
                      {employment ? "Save Changes" : "Create Employment Record"}
                    </Button>
                  </div>
                </>
              ) : (
                <div className="py-8 text-center text-muted-foreground">
                  Please select a school to view or create employment information
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Compliance Tab */}
        <TabsContent value="compliance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Compliance Documents</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="medical_clearance_date">Medical Clearance Date</Label>
                  <Input
                    id="medical_clearance_date"
                    type="date"
                    value={complianceFormData.medical_clearance_date || ""}
                    onChange={(e) => setComplianceFormData({ ...complianceFormData, medical_clearance_date: e.target.value || null })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="medical_clearance_expiry_date">Expiry Date</Label>
                  <Input
                    id="medical_clearance_expiry_date"
                    type="date"
                    value={complianceFormData.medical_clearance_expiry_date || ""}
                    onChange={(e) => setComplianceFormData({ ...complianceFormData, medical_clearance_expiry_date: e.target.value || null })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="medical_clearance_status">Status</Label>
                  <Input
                    id="medical_clearance_status"
                    value={complianceFormData.medical_clearance_status || ""}
                    onChange={(e) => setComplianceFormData({ ...complianceFormData, medical_clearance_status: e.target.value || null })}
                    placeholder="VALID, EXPIRED, PENDING"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nbi_clearance_date">NBI Clearance Date</Label>
                  <Input
                    id="nbi_clearance_date"
                    type="date"
                    value={complianceFormData.nbi_clearance_date || ""}
                    onChange={(e) => setComplianceFormData({ ...complianceFormData, nbi_clearance_date: e.target.value || null })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nbi_clearance_expiry_date">Expiry Date</Label>
                  <Input
                    id="nbi_clearance_expiry_date"
                    type="date"
                    value={complianceFormData.nbi_clearance_expiry_date || ""}
                    onChange={(e) => setComplianceFormData({ ...complianceFormData, nbi_clearance_expiry_date: e.target.value || null })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nbi_clearance_status">Status</Label>
                  <Input
                    id="nbi_clearance_status"
                    value={complianceFormData.nbi_clearance_status || ""}
                    onChange={(e) => setComplianceFormData({ ...complianceFormData, nbi_clearance_status: e.target.value || null })}
                    placeholder="VALID, EXPIRED, PENDING"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="police_clearance_date">Police Clearance Date</Label>
                  <Input
                    id="police_clearance_date"
                    type="date"
                    value={complianceFormData.police_clearance_date || ""}
                    onChange={(e) => setComplianceFormData({ ...complianceFormData, police_clearance_date: e.target.value || null })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="police_clearance_expiry_date">Expiry Date</Label>
                  <Input
                    id="police_clearance_expiry_date"
                    type="date"
                    value={complianceFormData.police_clearance_expiry_date || ""}
                    onChange={(e) => setComplianceFormData({ ...complianceFormData, police_clearance_expiry_date: e.target.value || null })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="police_clearance_status">Status</Label>
                  <Input
                    id="police_clearance_status"
                    value={complianceFormData.police_clearance_status || ""}
                    onChange={(e) => setComplianceFormData({ ...complianceFormData, police_clearance_status: e.target.value || null })}
                    placeholder="VALID, EXPIRED, PENDING"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="barangay_clearance_date">Barangay Clearance Date</Label>
                  <Input
                    id="barangay_clearance_date"
                    type="date"
                    value={complianceFormData.barangay_clearance_date || ""}
                    onChange={(e) => setComplianceFormData({ ...complianceFormData, barangay_clearance_date: e.target.value || null })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="barangay_clearance_expiry_date">Expiry Date</Label>
                  <Input
                    id="barangay_clearance_expiry_date"
                    type="date"
                    value={complianceFormData.barangay_clearance_expiry_date || ""}
                    onChange={(e) => setComplianceFormData({ ...complianceFormData, barangay_clearance_expiry_date: e.target.value || null })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="barangay_clearance_status">Status</Label>
                  <Input
                    id="barangay_clearance_status"
                    value={complianceFormData.barangay_clearance_status || ""}
                    onChange={(e) => setComplianceFormData({ ...complianceFormData, barangay_clearance_status: e.target.value || null })}
                    placeholder="VALID, EXPIRED, PENDING"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="drug_test_date">Drug Test Date</Label>
                  <Input
                    id="drug_test_date"
                    type="date"
                    value={complianceFormData.drug_test_date || ""}
                    onChange={(e) => setComplianceFormData({ ...complianceFormData, drug_test_date: e.target.value || null })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="drug_test_expiry_date">Expiry Date</Label>
                  <Input
                    id="drug_test_expiry_date"
                    type="date"
                    value={complianceFormData.drug_test_expiry_date || ""}
                    onChange={(e) => setComplianceFormData({ ...complianceFormData, drug_test_expiry_date: e.target.value || null })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="drug_test_result">Result</Label>
                  <Input
                    id="drug_test_result"
                    value={complianceFormData.drug_test_result || ""}
                    onChange={(e) => setComplianceFormData({ ...complianceFormData, drug_test_result: e.target.value || null })}
                    placeholder="PASSED, FAILED, PENDING"
                  />
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="font-semibold mb-4">Consents</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Data Privacy Consent</Label>
                      <p className="text-sm text-muted-foreground">I consent to the collection and processing of my personal data</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={complianceFormData.data_privacy_consent || false}
                        onChange={(e) => {
                          setComplianceFormData({
                            ...complianceFormData,
                            data_privacy_consent: e.target.checked,
                            data_privacy_consent_date: e.target.checked ? new Date().toISOString().split("T")[0] : null,
                          });
                        }}
                        className="rounded"
                      />
                      {complianceFormData.data_privacy_consent_date && (
                        <span className="text-sm text-muted-foreground">
                          {new Date(complianceFormData.data_privacy_consent_date).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Code of Conduct Acknowledged</Label>
                      <p className="text-sm text-muted-foreground">I have read and understood the code of conduct</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={complianceFormData.code_of_conduct_acknowledged || false}
                        onChange={(e) => {
                          setComplianceFormData({
                            ...complianceFormData,
                            code_of_conduct_acknowledged: e.target.checked,
                            code_of_conduct_acknowledged_date: e.target.checked ? new Date().toISOString().split("T")[0] : null,
                          });
                        }}
                        className="rounded"
                      />
                      {complianceFormData.code_of_conduct_acknowledged_date && (
                        <span className="text-sm text-muted-foreground">
                          {new Date(complianceFormData.code_of_conduct_acknowledged_date).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button onClick={handleSaveCompliance} disabled={saving}>
                  {saving && <Loader2 className="size-4 mr-2 animate-spin" />}
                  <Save className="size-4 mr-2" />
                  Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payroll Tab */}
        <TabsContent value="payroll" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Payroll & Government IDs</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="tin_number">TIN Number</Label>
                  <Input
                    id="tin_number"
                    value={payrollFormData.tin_number || ""}
                    onChange={(e) => setPayrollFormData({ ...payrollFormData, tin_number: e.target.value || null })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sss_number">SSS Number</Label>
                  <Input
                    id="sss_number"
                    value={payrollFormData.sss_number || ""}
                    onChange={(e) => setPayrollFormData({ ...payrollFormData, sss_number: e.target.value || null })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="philhealth_number">PhilHealth Number</Label>
                  <Input
                    id="philhealth_number"
                    value={payrollFormData.philhealth_number || ""}
                    onChange={(e) => setPayrollFormData({ ...payrollFormData, philhealth_number: e.target.value || null })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pagibig_number">Pag-IBIG Number</Label>
                  <Input
                    id="pagibig_number"
                    value={payrollFormData.pagibig_number || ""}
                    onChange={(e) => setPayrollFormData({ ...payrollFormData, pagibig_number: e.target.value || null })}
                  />
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="font-semibold mb-4">Banking Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="bank_name">Bank Name</Label>
                    <Input
                      id="bank_name"
                      value={payrollFormData.bank_name || ""}
                      onChange={(e) => setPayrollFormData({ ...payrollFormData, bank_name: e.target.value || null })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bank_account_number">Account Number</Label>
                    <Input
                      id="bank_account_number"
                      value={payrollFormData.bank_account_number || ""}
                      onChange={(e) => setPayrollFormData({ ...payrollFormData, bank_account_number: e.target.value || null })}
                    />
                  </div>
                </div>
                <div className="mt-4">
                  <Label htmlFor="bank_account_name">Account Name</Label>
                  <Input
                    id="bank_account_name"
                    value={payrollFormData.bank_account_name || ""}
                    onChange={(e) => setPayrollFormData({ ...payrollFormData, bank_account_name: e.target.value || null })}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button onClick={handleSavePayroll} disabled={saving}>
                  {saving && <Loader2 className="size-4 mr-2 animate-spin" />}
                  <Save className="size-4 mr-2" />
                  Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
