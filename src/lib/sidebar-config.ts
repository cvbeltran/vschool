/**
 * Phase-1 SIS Sidebar Configuration
 * Single source of truth for navigation structure
 */

import {
  LayoutDashboard,
  UserPlus,
  Users,
  GraduationCap,
  UserCheck,
  Briefcase,
  Calendar,
  MessageSquare,
  FileText,
  Settings,
  School,
  BookOpen,
  CalendarDays,
  FolderTree,
  Building2,
  Shield,
  Target,
  ListChecks,
  Layers,
  Eye,
  Award,
  Scale,
  ClipboardCheck,
  FileCheck,
  FileBarChart,
  Download,
  FileSpreadsheet,
  Link2,
  Package,
  BarChart3,
  FolderOpen,
  TrendingUp,
  Clock3,
  Building,
  CalendarClock,
  CheckCircle2,
  Calculator,
  ClipboardList,
  PenTool,
} from "lucide-react";
import { LucideIcon } from "lucide-react";

export type NormalizedRole = "principal" | "admin" | "teacher";

export interface SidebarItem {
  label: string;
  href: string;
  icon: LucideIcon;
  allowedRoles: NormalizedRole[];
  superAdminOnly?: boolean; // New property for super admin only items
  children?: SidebarItem[];
  // If item has children, clicking parent will expand/collapse instead of navigate
  // Parent href is used as fallback/default when no children are active
}

export interface SidebarSection {
  label?: string;
  items: SidebarItem[];
  collapsible?: boolean; // Whether the section can be collapsed
  defaultCollapsed?: boolean; // Default collapsed state
}

/**
 * Hierarchical sidebar structure matching MLP Phase-1 scope
 */
export const sidebarConfig: SidebarSection[] = [
  {
    items: [
      {
        label: "Dashboard",
        href: "/sis",
        icon: LayoutDashboard,
        allowedRoles: ["principal", "admin", "teacher"],
      },
    ],
  },
  {
    label: "Admissions",
    collapsible: true,
    defaultCollapsed: false,
    items: [
      {
        label: "Admissions",
        href: "/sis/admissions",
        icon: UserPlus,
        allowedRoles: ["principal", "admin", "teacher"],
      },
      {
        label: "Enrollments",
        href: "/sis/enrollments",
        icon: UserCheck,
        allowedRoles: ["principal", "admin", "teacher"],
      },
    ],
  },
  {
    label: "People",
    collapsible: true,
    defaultCollapsed: false,
    items: [
      {
        label: "Students",
        href: "/sis/students",
        icon: GraduationCap,
        allowedRoles: ["principal", "admin", "teacher"],
      },
      {
        label: "Guardians",
        href: "/sis/guardians",
        icon: Users,
        allowedRoles: ["principal", "admin", "teacher"],
      },
      {
        label: "Staff",
        href: "/sis/staff",
        icon: Briefcase,
        allowedRoles: ["principal", "admin", "teacher"],
      },
    ],
  },
  {
    label: "Operations",
    collapsible: true,
    defaultCollapsed: false,
    items: [
      {
        label: "Batches",
        href: "/sis/operations/batches",
        icon: BookOpen,
        allowedRoles: ["principal", "admin", "teacher"],
      },
      {
        label: "Sections",
        href: "/sis/operations/sections",
        icon: FolderTree,
        allowedRoles: ["principal", "admin", "teacher"],
      },
      {
        label: "Attendance",
        href: "/sis/operations/attendance",
        icon: Calendar,
        allowedRoles: ["principal", "admin", "teacher"],
      },
      {
        label: "Portfolio",
        href: "/sis/operations/portfolio",
        icon: FolderOpen,
        allowedRoles: ["principal", "admin", "teacher"],
      },
      {
        label: "Scheduling",
        href: "/sis/operations/scheduling/sections",
        icon: CalendarClock,
        allowedRoles: ["principal", "admin", "teacher"],
        children: [
          {
            label: "Periods",
            href: "/sis/operations/scheduling/periods",
            icon: Clock3,
            allowedRoles: ["principal", "admin"],
          },
          {
            label: "Rooms",
            href: "/sis/operations/scheduling/rooms",
            icon: Building,
            allowedRoles: ["principal", "admin"],
          },
          {
            label: "Section Scheduling",
            href: "/sis/operations/scheduling/sections",
            icon: CalendarClock,
            allowedRoles: ["principal", "admin", "teacher"],
          },
        ],
      },
    ],
  },
  {
    label: "Communications",
    collapsible: true,
    defaultCollapsed: false,
    items: [
      {
        label: "Communications",
        href: "/sis/communications",
        icon: MessageSquare,
        allowedRoles: ["principal", "admin", "teacher"],
      },
    ],
  },
  {
    label: "OBS",
    collapsible: true,
    defaultCollapsed: false,
    items: [
      {
        label: "Domains",
        href: "/sis/obs/domains",
        icon: FolderTree,
        allowedRoles: ["principal", "admin", "teacher"],
      },
      {
        label: "Competencies",
        href: "/sis/obs/competencies",
        icon: Target,
        allowedRoles: ["principal", "admin", "teacher"],
      },
      {
        label: "Indicators",
        href: "/sis/obs/indicators",
        icon: ListChecks,
        allowedRoles: ["principal", "admin", "teacher"],
      },
      {
        label: "Competency Levels",
        href: "/sis/obs/levels",
        icon: Layers,
        allowedRoles: ["principal", "admin", "teacher"],
      },
    ],
  },
  {
    label: "AMS",
    collapsible: true,
    defaultCollapsed: false,
    items: [
      {
        label: "Experiences",
        href: "/sis/ams/experiences",
        icon: BookOpen,
        allowedRoles: ["principal", "admin", "teacher"],
      },
    ],
  },
  {
    label: "Reflection & Feedback",
    collapsible: true,
    defaultCollapsed: false,
    items: [
      {
        label: "Prompts",
        href: "/sis/reflection/prompts",
        icon: MessageSquare,
        allowedRoles: ["principal", "admin", "teacher"],
      },
      {
        label: "Dimensions",
        href: "/sis/feedback/dimensions",
        icon: Target,
        allowedRoles: ["principal", "admin", "teacher"],
      },
      {
        label: "My Reflections",
        href: "/sis/reflection/my",
        icon: BookOpen,
        allowedRoles: ["principal", "admin", "teacher"],
      },
      {
        label: "Student Feedback",
        href: "/sis/feedback/my",
        icon: MessageSquare,
        allowedRoles: ["principal", "admin", "teacher"],
      },
      {
        label: "View Feedback",
        href: "/sis/feedback/teacher",
        icon: Eye,
        allowedRoles: ["principal", "admin", "teacher"],
      },
    ],
  },
  {
    label: "Grades & Reporting",
    collapsible: true,
    defaultCollapsed: false,
    items: [
      {
        label: "Policies",
        href: "/sis/phase4/policies",
        icon: Award,
        allowedRoles: ["principal", "admin"],
      },
      {
        label: "Scales",
        href: "/sis/phase4/scales",
        icon: Scale,
        allowedRoles: ["principal", "admin"],
      },
      {
        label: "Grade Entry",
        href: "/sis/phase4/grade-entry",
        icon: ClipboardCheck,
        allowedRoles: ["principal", "admin", "teacher"],
      },
      {
        label: "Review & Finalize",
        href: "/sis/phase4/review",
        icon: FileCheck,
        allowedRoles: ["principal", "admin"],
      },
      {
        label: "Reports",
        href: "/sis/phase4/reports",
        icon: FileBarChart,
        allowedRoles: ["principal", "admin"],
      },
      {
        label: "Gradebook",
        href: "/sis/gradebook/sections",
        icon: Calculator,
        allowedRoles: ["principal", "admin", "teacher"],
        children: [
          {
            label: "Schemes",
            href: "/sis/gradebook/schemes",
            icon: Award,
            allowedRoles: ["principal", "admin"],
          },
          {
            label: "My Sections",
            href: "/sis/gradebook/sections",
            icon: BookOpen,
            allowedRoles: ["principal", "admin", "teacher"],
          },
          {
            label: "Graded Items",
            href: "/sis/gradebook/items",
            icon: ClipboardList,
            allowedRoles: ["principal", "admin", "teacher"],
          },
          {
            label: "Score Entry",
            href: "/sis/gradebook/scores",
            icon: PenTool,
            allowedRoles: ["principal", "admin", "teacher"],
          },
          {
            label: "Compute Runs",
            href: "/sis/gradebook/compute-runs",
            icon: Calculator,
            allowedRoles: ["principal", "admin", "teacher"],
          },
          {
            label: "Phase 4 Links",
            href: "/sis/gradebook/phase4-links",
            icon: Link2,
            allowedRoles: ["principal", "admin"],
          },
        ],
      },
    ],
  },
  {
    label: "Exports & External Interfaces",
    collapsible: true,
    defaultCollapsed: false,
    items: [
      {
        label: "Generate Export",
        href: "/sis/phase5/exports",
        icon: Download,
        allowedRoles: ["principal", "admin"], // registrar can access via direct link for compliance exports
      },
      {
        label: "Export History",
        href: "/sis/phase5/exports/history",
        icon: FileText,
        allowedRoles: ["principal", "admin"], // registrar normalized to admin, can view
      },
      {
        label: "Batch Export",
        href: "/sis/phase5/exports/batch",
        icon: Package,
        allowedRoles: ["principal", "admin"], // registrar normalized to admin, can use
      },
      {
        label: "Templates",
        href: "/sis/phase5/templates",
        icon: FileSpreadsheet,
        allowedRoles: ["principal", "admin"],
      },
      {
        label: "External ID Mappings",
        href: "/sis/phase5/external-mappings",
        icon: Link2,
        allowedRoles: ["principal", "admin"],
      },
    ],
  },
  {
    label: "Reports",
    collapsible: true,
    defaultCollapsed: false,
    items: [
      {
        label: "Student Reports",
        href: "/sis/reports/students",
        icon: FileText,
        allowedRoles: ["principal"],
      },
      {
        label: "Attendance Reports",
        href: "/sis/reports/attendance",
        icon: FileText,
        allowedRoles: ["principal"],
      },
    ],
  },
  {
    label: "Settings",
    collapsible: true,
    defaultCollapsed: false,
    items: [
      {
        label: "Organization",
        href: "/sis/settings/organization",
        icon: Building2,
        allowedRoles: ["principal", "admin"],
      },
      {
        label: "Schools",
        href: "/sis/settings/schools",
        icon: School,
        allowedRoles: ["principal", "admin"],
      },
      {
        label: "Programs",
        href: "/sis/settings/programs",
        icon: BookOpen,
        allowedRoles: ["principal", "admin"],
      },
      {
        label: "Calendar",
        href: "/sis/settings/calendar",
        icon: CalendarDays,
        allowedRoles: ["principal", "admin"],
      },
      {
        label: "Sections",
        href: "/sis/settings/sections",
        icon: FolderTree,
        allowedRoles: ["principal", "admin"],
      },
      {
        label: "Subjects",
        href: "/sis/settings/subjects",
        icon: Award,
        allowedRoles: ["principal", "admin"],
      },
      {
        label: "Taxonomies",
        href: "/sis/settings/taxonomies",
        icon: FolderTree,
        allowedRoles: ["principal", "admin"],
      },
    ],
  },
  {
    label: "Pedagogy Operations",
    collapsible: true,
    defaultCollapsed: false,
    items: [
      {
        label: "Syllabus",
        href: "/sis/phase6/syllabus",
        icon: BookOpen,
        allowedRoles: ["principal", "admin", "teacher"],
      },
      {
        label: "Lesson Logs",
        href: "/sis/phase6/lesson-logs",
        icon: FileText,
        allowedRoles: ["principal", "admin", "teacher"],
      },
      {
        label: "Progress Monitoring",
        href: "/sis/phase6/monitoring/progress",
        icon: BarChart3,
        allowedRoles: ["principal", "admin", "teacher"], // Teachers see only their own data
      },
      {
        label: "Attendance Sessions",
        href: "/sis/phase6/attendance/sessions",
        icon: Calendar,
        allowedRoles: ["principal", "admin", "teacher"],
      },
      {
        label: "My Attendance",
        href: "/sis/phase6/attendance/my",
        icon: UserCheck,
        allowedRoles: ["principal", "admin", "teacher"],
      },
      {
        label: "My Portfolio",
        href: "/sis/phase6/portfolio/my",
        icon: FolderOpen,
        allowedRoles: ["principal", "admin", "teacher"], // students need access but normalized role may be teacher
      },
    ],
  },
  {
    label: "Assessments",
    collapsible: true,
    defaultCollapsed: false,
    items: [
      {
        label: "My Assessments",
        href: "/sis/assessments",
        icon: ClipboardCheck,
        allowedRoles: ["principal", "admin", "teacher"],
      },
      {
        label: "Create Assessment",
        href: "/sis/assessments/new",
        icon: FileCheck,
        allowedRoles: ["principal", "admin", "teacher"],
      },
      {
        label: "Label Sets",
        href: "/sis/assessments/label-sets",
        icon: ListChecks,
        allowedRoles: ["principal", "admin"], // admin-only in UI
      },
    ],
  },
  {
    label: "Mastery",
    collapsible: true,
    defaultCollapsed: false,
    items: [
      {
        label: "Mastery Dashboard",
        href: "/sis/mastery",
        icon: Target,
        allowedRoles: ["principal", "admin", "teacher"],
      },
      {
        label: "Review Students",
        href: "/sis/mastery/review/students",
        icon: GraduationCap,
        allowedRoles: ["principal", "admin", "teacher"],
      },
      {
        label: "Review Queue",
        href: "/sis/mastery/review/queue",
        icon: CheckCircle2,
        allowedRoles: ["principal", "admin"],
      },
      {
        label: "Snapshot Runs",
        href: "/sis/mastery/runs",
        icon: TrendingUp,
        allowedRoles: ["principal", "admin", "teacher"],
      },
      {
        label: "Mastery Reports",
        href: "/sis/mastery/reports/progress",
        icon: FileBarChart,
        allowedRoles: ["principal", "admin", "teacher"],
        children: [
          {
            label: "Progress Report",
            href: "/sis/mastery/reports/progress",
            icon: FileText,
            allowedRoles: ["principal", "admin", "teacher"],
          },
          {
            label: "Term Summary",
            href: "/sis/mastery/reports/term-summary",
            icon: BarChart3,
            allowedRoles: ["principal", "admin", "teacher"],
          },
          {
            label: "Evidence Pack",
            href: "/sis/mastery/reports/evidence-pack",
            icon: FolderOpen,
            allowedRoles: ["principal", "admin", "teacher"],
          },
          {
            label: "Accreditation Pack",
            href: "/sis/mastery/reports/accreditation-pack",
            icon: Package,
            allowedRoles: ["principal", "admin"],
          },
          {
            label: "Radar Chart",
            href: "/sis/mastery/reports/radar",
            icon: Target,
            allowedRoles: ["principal", "admin", "teacher"],
          },
        ],
      },
      {
        label: "Mastery Setup",
        href: "/sis/mastery/setup/models",
        icon: Settings,
        allowedRoles: ["principal", "admin"],
      },
    ],
  },
  {
    label: "Insights",
    collapsible: true,
    defaultCollapsed: false,
    items: [
      {
        label: "Teacher Insights",
        href: "/sis/insights/teacher",
        icon: Eye,
        allowedRoles: ["principal", "admin", "teacher"],
      },
      {
        label: "Admin Insights",
        href: "/sis/insights/admin",
        icon: TrendingUp,
        allowedRoles: ["principal", "admin"],
      },
    ],
  },
  {
    label: "Admin",
    collapsible: true,
    defaultCollapsed: false,
    items: [
      {
        label: "Super Admin",
        href: "/sis/admin",
        icon: Shield,
        allowedRoles: ["principal", "admin", "teacher"], // Will be filtered by super admin check
        superAdminOnly: true,
      },
    ],
  },
];

/**
 * Filter sidebar config by role and super admin status
 */
export function getSidebarForRole(
  role: NormalizedRole,
  isSuperAdmin: boolean = false
): SidebarSection[] {
  return sidebarConfig
    .map((section) => ({
      ...section,
      items: section.items
        .map((item) => ({
          ...item,
          children: item.children?.filter((child) =>
            child.allowedRoles.includes(role)
          ),
        }))
        .filter((item) => {
          // If item is super admin only, check super admin status
          if (item.superAdminOnly) {
            return isSuperAdmin;
          }
          // Include item if it's allowed for this role
          if (item.allowedRoles.includes(role)) {
            return true;
          }
          // Include section if any child is allowed
          return item.children && item.children.length > 0;
        }),
    }))
    .filter((section) => section.items.length > 0);
}

