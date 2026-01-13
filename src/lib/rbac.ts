/**
 * Canonical RBAC (Role-Based Access Control) for Phase 1.5 Magna SIS
 * 
 * Roles:
 * - principal: Full read/write access (Phase-1.5)
 * - admin: Full read/write access (same as Principal)
 * - registrar: Admissions + enrollment only
 * - teacher: Attendance and communications only
 * 
 * Multi-Tenant Notes:
 * - All users belong to exactly one organization
 * - Super admins can access all organizations (bypasses organization checks)
 * - Organization isolation is enforced at the database level via RLS policies
 * - RBAC checks are scoped to the user's organization context
 */

export type Role = "principal" | "admin" | "registrar" | "teacher";

/**
 * Check if a user is a super admin
 * Note: This should be checked against the user's profile in the database
 * @param isSuperAdmin - Boolean from profile.is_super_admin
 * @returns true if user is super admin
 */
export function isSuperAdmin(isSuperAdmin: boolean | null | undefined): boolean {
  return isSuperAdmin === true;
}

// Normalize role (registrar = admin for navigation, but differentiated in canPerform)
export function normalizeRole(role: string | null): "principal" | "admin" | "teacher" {
  if (role === "principal") return "principal";
  if (role === "teacher") return "teacher";
  return "admin"; // admin, registrar, or any other role
}

// Navigation items that can be viewed
export type NavItem = 
  | "dashboard"
  | "admissions"
  | "batches"
  | "students"
  | "attendance"
  | "communications"
  | "reports"
  | "settings";

// Actions that can be performed
export type Action = 
  | "create"
  | "update"
  | "delete"
  | "export";

// Resources that actions can be performed on
export type Resource = 
  | "schools"
  | "programs"
  | "sections"
  | "students"
  | "admissions"
  | "batches"
  | "attendance"
  | "taxonomies"
  | "school_years"
  | "staff"
  | "obs_domains"
  | "obs_competencies"
  | "obs_indicators"
  | "obs_levels"
  | "ams_experiences"
  | "ams_observations";

/**
 * Check if a role can view a navigation item
 * Role should already be normalized (use normalizeRole before calling)
 * 
 * Canonical RBAC:
 * - Principal: Dashboard, Admissions, Students, Attendance, Communications, Reports, Settings
 * - Registrar/Admin: Dashboard, Admissions, Students, Attendance, Communications, Settings (NO Reports)
 * - Teacher: Attendance, Students, Communications
 */
export function canViewNav(
  role: "principal" | "admin" | "teacher",
  navItem: NavItem
): boolean {
  switch (role) {
    case "principal":
      // Principal: Dashboard, Admissions, Students, Attendance, Communications, Reports, Settings
      return [
        "dashboard",
        "admissions",
        "students",
        "attendance",
        "communications",
        "reports",
        "settings",
      ].includes(navItem);
    
    case "admin":
      // Registrar/Admin: Dashboard, Admissions, Students, Attendance, Communications, Settings (NO Reports)
      return [
        "dashboard",
        "admissions",
        "students",
        "attendance",
        "communications",
        "settings",
      ].includes(navItem);
    
    case "teacher":
      // Teacher: Attendance, Students (read-only), Communications
      return [
        "attendance",
        "students",
        "communications",
      ].includes(navItem);
    
    default:
      return false;
  }
}

/**
 * Check if a role can perform an action on a resource
 * Role should already be normalized (use normalizeRole before calling)
 * 
 * Phase-1.5 RBAC:
 * - Principal: Full read/write (same as Admin)
 * - Admin: Full read/write
 * - Registrar: Admissions + enrollment only (originalRole must be "registrar")
 * - Teacher: Read-only
 */
export function canPerform(
  role: "principal" | "admin" | "teacher",
  action: Action,
  resource: Resource,
  originalRole?: string | null // Optional: original role before normalization (to differentiate registrar from admin)
): boolean {
  // PART 4: Principal has full read/write access (Phase-1.5)
  if (role === "principal") {
    // Principal can create/update/delete schools and operational records
    if (resource === "schools" || resource === "programs" || resource === "sections" || resource === "taxonomies" || resource === "school_years") {
      return action === "create" || action === "update" || action === "delete";
    }
    // Can create/update/delete students, admissions, batches, attendance, staff
    if (["students", "admissions", "batches", "attendance", "staff"].includes(resource)) {
      return action === "create" || action === "update" || action === "delete" || action === "export";
    }
    // OBS resources: Principal can create/update/delete all OBS structures
    if (["obs_domains", "obs_competencies", "obs_indicators", "obs_levels"].includes(resource)) {
      return action === "create" || action === "update" || action === "delete";
    }
    // AMS resources: Principal can create/update/delete experiences and observations
    if (["ams_experiences", "ams_observations"].includes(resource)) {
      return action === "create" || action === "update" || action === "delete";
    }
    return false;
  }
  
  // Teacher: Can create experiences and observations (their own), view OBS
  if (role === "teacher") {
    // Teachers can create experiences and observations
    if (["ams_experiences", "ams_observations"].includes(resource)) {
      return action === "create" || action === "update";
    }
    // Teachers can view OBS but not modify
    if (["obs_domains", "obs_competencies", "obs_indicators", "obs_levels"].includes(resource)) {
      return false; // View only, handled by RLS
    }
    return false;
  }
  
  // Admin/Registrar differentiation
  if (role === "admin") {
    // FIX 4: Registrar can manage Admissions, Enrollment (Students), Schools, Programs, Sections, Taxonomies
    // Cannot manage Reports or System Taxonomies
    if (originalRole === "registrar") {
      // Registrar can work with admissions, enrollments (students), schools, programs, sections, taxonomies
      if (resource === "admissions") {
        return action === "create" || action === "update" || action === "delete";
      }
      if (resource === "students") {
        // Enrollment actions only (no general student management)
        return action === "create" || action === "update"; // Allow create/update for enrollment
      }
      if (resource === "schools" || resource === "programs" || resource === "sections" || resource === "school_years") {
        // Registrar can manage schools, programs, sections, school_years
        return action === "create" || action === "update" || action === "delete";
      }
      if (resource === "taxonomies") {
        // Registrar has full access to taxonomies (but UI should prevent editing system taxonomies)
        return action === "create" || action === "update" || action === "delete";
      }
      return false;
    }
    
    // Admin: Full read/write (same as Principal)
    if (resource === "schools" || resource === "programs" || resource === "sections" || resource === "taxonomies" || resource === "school_years") {
      return action === "create" || action === "update" || action === "delete";
    }
    // Can create/update/delete students, admissions, batches, attendance, staff
    if (["students", "admissions", "batches", "attendance", "staff"].includes(resource)) {
      return action === "create" || action === "update" || action === "delete" || action === "export";
    }
    // OBS resources: Admin can create/update/delete all OBS structures
    if (["obs_domains", "obs_competencies", "obs_indicators", "obs_levels"].includes(resource)) {
      return action === "create" || action === "update" || action === "delete";
    }
    // AMS resources: Admin can create/update/delete experiences and observations
    if (["ams_experiences", "ams_observations"].includes(resource)) {
      return action === "create" || action === "update" || action === "delete";
    }
  }
  
  return false;
}

