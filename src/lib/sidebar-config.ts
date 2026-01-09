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
    label: "Reports",
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

