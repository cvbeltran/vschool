// TypeScript types for Export Engine
// Created: 2024

export interface ExportJob {
  id: string;
  organization_id: string;
  school_id: string | null;
  requested_by: string;
  export_type: "transcript" | "report_card" | "compliance_export";
  export_parameters: ExportParameters;
  status: "pending" | "processing" | "completed" | "failed";
  file_path: string | null;
  file_size_bytes: number | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

export interface ExportParameters {
  student_ids?: string[];
  school_year_id?: string;
  term_period?: string;
  program_id?: string;
  section_id?: string;
  template_id?: string;
  include_external_ids?: boolean;
  include_grade_entries?: boolean;
  format?: "pdf" | "csv" | "excel";
  [key: string]: any; // Allow additional parameters
}

export interface Profile {
  id: string;
  role: string;
  organization_id: string;
  is_super_admin: boolean;
  school_id?: string | null;
}

export interface StudentGrade {
  id: string;
  organization_id: string;
  school_id: string | null;
  student_id: string;
  school_year_id: string;
  term_period: string;
  program_id: string | null;
  section_id: string | null;
  grade_value: string;
  status: "draft" | "confirmed" | "overridden";
  confirmed_at: string | null;
  students?: {
    id: string;
    first_name: string;
    last_name: string;
    student_number: string | null;
    lrn: string | null;
  };
  school_years?: {
    id: string;
    name: string;
    start_date: string;
    end_date: string;
  };
  programs?: {
    id: string;
    name: string;
  };
  sections?: {
    id: string;
    name: string;
  };
  grading_scales?: {
    grade_value: string;
    grade_label: string | null;
  };
}

export interface TranscriptRecord {
  id: string;
  organization_id: string;
  school_id: string | null;
  student_id: string;
  school_year_id: string;
  term_period: string;
  course_name: string;
  grade_value: string;
  credits: number | null;
  transcript_status: "draft" | "finalized";
  finalized_at: string | null;
  students?: {
    id: string;
    first_name: string;
    last_name: string;
    student_number: string | null;
    lrn: string | null;
  };
  school_years?: {
    id: string;
    name: string;
  };
}

export interface ExportResult {
  success: boolean;
  export_job_id: string;
  file_path?: string;
  file_size_bytes?: number;
  error?: string;
  details?: any;
}
