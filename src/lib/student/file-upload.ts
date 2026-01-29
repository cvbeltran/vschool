/**
 * File Upload Helper Functions for Student Portfolio
 * Handles file uploads to Supabase Storage
 */

import { supabase } from "@/lib/supabase/client";

export interface UploadResult {
  url: string;
  path: string;
  error?: string;
}

/**
 * Upload a file to portfolio-artifacts storage bucket
 * @param file - The file to upload
 * @param studentId - Student ID for path organization
 * @param artifactId - Artifact ID (optional, for updates)
 * @returns Upload result with URL and path
 */
export async function uploadPortfolioFile(
  file: File,
  studentId: string,
  artifactId?: string
): Promise<UploadResult> {
  try {
    // Get current user session
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      throw new Error("Not authenticated");
    }

    // Get student record and verify it matches the current user's profile
    // The RLS policy checks: students.profile_id = auth.uid()
    const { data: student } = await supabase
      .from("students")
      .select("id, organization_id, profile_id")
      .eq("id", studentId)
      .eq("profile_id", session.user.id) // Ensure this student belongs to current user
      .single();

    if (!student) {
      throw new Error("Student not found or access denied. Please ensure you are logged in as the correct student.");
    }

    // Verify the student ID matches (for RLS policy compliance)
    if (student.id !== studentId) {
      throw new Error("Student ID mismatch");
    }

    // Generate unique filename
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const fileExtension = file.name.split(".").pop() || "";
    const fileName = `${timestamp}-${randomString}.${fileExtension}`;

    // Create storage path: {organization_id}/student-{student_id}/{artifact_id or 'temp'}/{filename}
    // Note: Path format must match RLS policy expectations
    const pathPrefix = artifactId
      ? `${student.organization_id}/student-${studentId}/${artifactId}`
      : `${student.organization_id}/student-${studentId}/temp`;
    const storagePath = `${pathPrefix}/${fileName}`;

    // Upload file to storage
    const { data, error } = await supabase.storage
      .from("portfolio-artifacts")
      .upload(storagePath, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (error) {
      console.error("Error uploading file:", error);
      return {
        url: "",
        path: "",
        error: error.message || "Failed to upload file",
      };
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from("portfolio-artifacts").getPublicUrl(storagePath);

    return {
      url: publicUrl,
      path: storagePath,
    };
  } catch (error: any) {
    console.error("Error in uploadPortfolioFile:", error);
    return {
      url: "",
      path: "",
      error: error.message || "Failed to upload file",
    };
  }
}

/**
 * Delete a file from portfolio-artifacts storage bucket
 * @param path - Storage path of the file to delete
 */
export async function deletePortfolioFile(path: string): Promise<void> {
  try {
    const { error } = await supabase.storage
      .from("portfolio-artifacts")
      .remove([path]);

    if (error) {
      console.error("Error deleting file:", error);
      throw error;
    }
  } catch (error: any) {
    console.error("Error in deletePortfolioFile:", error);
    throw error;
  }
}

/**
 * Check if a file URL is an image
 * @param url - File URL
 * @returns True if the file is an image
 */
export function isImageFile(url: string): boolean {
  const imageExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".bmp"];
  const lowerUrl = url.toLowerCase();
  return imageExtensions.some((ext) => lowerUrl.includes(ext));
}

/**
 * Upload a file to portfolio-artifacts storage bucket (Admin/Teacher version)
 * This version allows admins/teachers to upload files for any student
 * @param file - The file to upload
 * @param studentId - Student ID for path organization
 * @param organizationId - Organization ID (required for admin/teacher uploads)
 * @param artifactId - Artifact ID (optional, for updates)
 * @returns Upload result with URL and path
 */
export async function uploadPortfolioFileForStudent(
  file: File,
  studentId: string,
  organizationId: string,
  artifactId?: string
): Promise<UploadResult> {
  try {
    // Get current user session
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      throw new Error("Not authenticated");
    }

    // Verify student exists and belongs to the organization
    const { data: student } = await supabase
      .from("students")
      .select("id, organization_id")
      .eq("id", studentId)
      .eq("organization_id", organizationId)
      .single();

    if (!student) {
      throw new Error("Student not found or access denied");
    }

    // Generate unique filename
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const fileExtension = file.name.split(".").pop() || "";
    const fileName = `${timestamp}-${randomString}.${fileExtension}`;

    // Create storage path: {organization_id}/student-{student_id}/{artifact_id or 'temp'}/{filename}
    // Note: Path format must match RLS policy expectations
    const pathPrefix = artifactId
      ? `${organizationId}/student-${studentId}/${artifactId}`
      : `${organizationId}/student-${studentId}/temp`;
    const storagePath = `${pathPrefix}/${fileName}`;

    // Upload file to storage
    const { data, error } = await supabase.storage
      .from("portfolio-artifacts")
      .upload(storagePath, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (error) {
      console.error("Error uploading file:", error);
      return {
        url: "",
        path: "",
        error: error.message || "Failed to upload file",
      };
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from("portfolio-artifacts").getPublicUrl(storagePath);

    return {
      url: publicUrl,
      path: storagePath,
    };
  } catch (error: any) {
    console.error("Error in uploadPortfolioFileForStudent:", error);
    return {
      url: "",
      path: "",
      error: error.message || "Failed to upload file",
    };
  }
}

/**
 * Get file name from URL or path
 * @param url - File URL or path
 * @returns File name
 */
export function getFileNameFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split("/");
    return pathParts[pathParts.length - 1] || "file";
  } catch {
    // If not a valid URL, try to extract from path
    const pathParts = url.split("/");
    return pathParts[pathParts.length - 1] || "file";
  }
}
