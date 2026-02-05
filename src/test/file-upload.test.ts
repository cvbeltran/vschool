import { describe, it, expect, vi, beforeEach } from "vitest";
import { uploadPortfolioFile, deletePortfolioFile } from "@/lib/student/file-upload";
import { supabase } from "@/lib/supabase/client";

// Mock Supabase client
vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
    },
    from: vi.fn(),
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn(),
        getPublicUrl: vi.fn(),
        remove: vi.fn(),
      })),
    },
  },
}));

// Mock logger
vi.mock("@/lib/logger", () => ({
  logError: vi.fn(),
}));

describe("File Upload Helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("uploadPortfolioFile", () => {
    it("should handle authentication error", async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: null,
      } as unknown as ReturnType<typeof supabase.auth.getSession>);

      const file = new File(["test"], "test.pdf", { type: "application/pdf" });
      const result = await uploadPortfolioFile(file, "student-id");

      expect(result.error).toBeDefined();
      expect(result.error).toContain("Not authenticated");
    });

    it("should handle student not found error", async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: { user: { id: "user-id" } } },
        error: null,
      } as any);

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: null,
              }),
            })),
          })),
        })),
      } as unknown as ReturnType<typeof supabase.from>);

      const file = new File(["test"], "test.pdf", { type: "application/pdf" });
      const result = await uploadPortfolioFile(file, "student-id");

      expect(result.error).toBeDefined();
      expect(result.error).toContain("Student not found");
    });

    it("should handle storage upload error", async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: { user: { id: "user-id" } } },
        error: null,
      } as any);

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({
                data: { id: "student-id", organization_id: "org-id", profile_id: "user-id" },
                error: null,
              }),
            })),
          })),
        })),
      } as unknown as ReturnType<typeof supabase.from>);

      vi.mocked(supabase.storage.from).mockReturnValue({
        upload: vi.fn().mockResolvedValue({
          data: null,
          error: { message: "Storage error" },
        }),
        getPublicUrl: vi.fn(),
      } as unknown as ReturnType<typeof supabase.storage.from>);

      const file = new File(["test"], "test.pdf", { type: "application/pdf" });
      const result = await uploadPortfolioFile(file, "student-id");

      expect(result.error).toBeDefined();
      expect(result.error).toContain("Storage error");
    });
  });

  describe("deletePortfolioFile", () => {
    it("should handle storage delete error", async () => {
      vi.mocked(supabase.storage.from).mockReturnValue({
        remove: vi.fn().mockResolvedValue({
          error: { message: "Delete error" },
        }),
      } as unknown as ReturnType<typeof supabase.storage.from>);

      await expect(deletePortfolioFile("path/to/file")).rejects.toThrow();
    });

    it("should successfully delete file when no error", async () => {
      vi.mocked(supabase.storage.from).mockReturnValue({
        remove: vi.fn().mockResolvedValue({
          error: null,
        }),
      } as unknown as ReturnType<typeof supabase.storage.from>);

      await expect(deletePortfolioFile("path/to/file")).resolves.not.toThrow();
    });
  });
});
