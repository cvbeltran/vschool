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
        label: "Attendance",
        href: "/sis/attendance",
        icon: Calendar,
        allowedRoles: ["principal", "admin", "teacher"],
      },
      {
        label: "Sections",
        href: "/sis/sections",
        icon: FolderTree,
        allowedRoles: ["principal", "admin", "teacher"],
      },
      {
        label: "Batches",
        href: "/sis/batches",
        icon: BookOpen,
        allowedRoles: ["principal", "admin", "teacher"],
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
        label: "Taxonomies",
        href: "/sis/settings/taxonomies",
        icon: FolderTree,
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

