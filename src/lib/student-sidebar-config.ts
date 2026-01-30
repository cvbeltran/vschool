/**
 * Student Portal Sidebar Configuration
 * Navigation structure for student portal pages
 */

import {
  LayoutDashboard,
  Calendar,
  FolderOpen,
  ClipboardCheck,
  MessageSquare,
  Settings,
  Target,
} from "lucide-react";
import { LucideIcon } from "lucide-react";

export interface StudentSidebarItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

/**
 * Student portal sidebar items
 */
export const studentSidebarConfig: StudentSidebarItem[] = [
  {
    label: "Dashboard",
    href: "/student/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "My Attendance",
    href: "/student/attendance",
    icon: Calendar,
  },
  {
    label: "My Portfolio",
    href: "/student/my-portfolio",
    icon: FolderOpen,
  },
  {
    label: "My Assessments",
    href: "/student/assessments",
    icon: ClipboardCheck,
  },
  {
    label: "My Mastery",
    href: "/student/mastery",
    icon: Target,
  },
  {
    label: "Feedback",
    href: "/student/feedback",
    icon: MessageSquare,
  },
  {
    label: "Settings",
    href: "/student/settings",
    icon: Settings,
  },
];
