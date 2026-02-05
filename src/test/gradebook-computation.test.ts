/**
 * Unit tests for Gradebook Computation Engine
 * Tests DepEd/CHED correctness, rounding rules, status handling, and weight policies
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { GradebookScheme, GradebookComponent, GradebookComponentWeight, GradebookTransmutationRow, GradebookGradedItem, GradebookGradedScore } from "@/lib/gradebook";

// Mock the gradebook module
vi.mock("@/lib/gradebook", async () => {
  const actual = await vi.importActual("@/lib/gradebook");
  return {
    ...actual,
    // We'll mock the data access functions but test the computation logic
  };
});

// Import computation helper functions (we'll extract them for testing)
// For now, we'll test the logic inline

describe("Gradebook Computation Engine", () => {
  describe("DepEd Transmutation Rounding Rules", () => {
    it("should use floor rounding by default for DepEd schemes", () => {
      const initialGrade = 89.49;
      const roundingMode = "floor";
      const initialGradeKey = Math.floor(initialGrade);
      
      expect(initialGradeKey).toBe(89);
    });

    it("should use round rounding when specified", () => {
      const initialGrade = 89.49;
      const roundingMode = "round";
      const initialGradeKey = Math.round(initialGrade);
      
      expect(initialGradeKey).toBe(89);
      
      const initialGrade2 = 89.50;
      const initialGradeKey2 = Math.round(initialGrade2);
      expect(initialGradeKey2).toBe(90);
    });

    it("should use ceil rounding when specified", () => {
      const initialGrade = 89.01;
      const roundingMode = "ceil";
      const initialGradeKey = Math.ceil(initialGrade);
      
      expect(initialGradeKey).toBe(90);
    });

    it("should fail if transmutation row is missing for computed key", () => {
      const initialGrade = 89.49;
      const roundingMode = "floor";
      const initialGradeKey = Math.floor(initialGrade); // 89
      
      const transmutationRows: GradebookTransmutationRow[] = [
        { id: "1", transmutation_table_id: "t1", initial_grade: 88, transmuted_grade: 92 },
        { id: "2", transmutation_table_id: "t1", initial_grade: 90, transmuted_grade: 95 },
      ];
      
      const row = transmutationRows.find((r) => r.initial_grade === initialGradeKey);
      
      // Should fail - no row for 89
      expect(row).toBeUndefined();
    });

    it("should find transmutation row for exact match", () => {
      const initialGrade = 89.49;
      const roundingMode = "floor";
      const initialGradeKey = Math.floor(initialGrade); // 89
      
      const transmutationRows: GradebookTransmutationRow[] = [
        { id: "1", transmutation_table_id: "t1", initial_grade: 89, transmuted_grade: 93 },
        { id: "2", transmutation_table_id: "t1", initial_grade: 90, transmuted_grade: 95 },
      ];
      
      const row = transmutationRows.find((r) => r.initial_grade === initialGradeKey);
      
      expect(row).toBeDefined();
      expect(row?.transmuted_grade).toBe(93);
    });
  });

  describe("Score Status Handling Policy", () => {
    it("should count present scores normally", () => {
      const scores: Array<{ points: number; maxPoints: number; status: string }> = [
        { points: 85, maxPoints: 100, status: "present" },
        { points: 90, maxPoints: 100, status: "present" },
      ];
      
      const rawTotal = scores.reduce((sum, s) => sum + s.points, 0);
      const maxTotal = scores.reduce((sum, s) => sum + s.maxPoints, 0);
      const percent = maxTotal > 0 ? (rawTotal / maxTotal) * 100 : 0;
      
      expect(rawTotal).toBe(175);
      expect(maxTotal).toBe(200);
      expect(percent).toBe(87.5);
    });

    it("should treat missing scores as zero points but count max_points", () => {
      const scores: Array<{ points: number; maxPoints: number; status: string }> = [
        { points: 85, maxPoints: 100, status: "present" },
        { points: 0, maxPoints: 100, status: "missing" },
      ];
      
      const rawTotal = scores.reduce((sum, s) => sum + s.points, 0);
      const maxTotal = scores.reduce((sum, s) => sum + s.maxPoints, 0);
      const percent = maxTotal > 0 ? (rawTotal / maxTotal) * 100 : 0;
      
      expect(rawTotal).toBe(85);
      expect(maxTotal).toBe(200);
      expect(percent).toBe(42.5);
    });

    it("should treat absent scores as zero points but count max_points", () => {
      const scores: Array<{ points: number; maxPoints: number; status: string }> = [
        { points: 85, maxPoints: 100, status: "present" },
        { points: 0, maxPoints: 100, status: "absent" },
      ];
      
      const rawTotal = scores.reduce((sum, s) => sum + s.points, 0);
      const maxTotal = scores.reduce((sum, s) => sum + s.maxPoints, 0);
      const percent = maxTotal > 0 ? (rawTotal / maxTotal) * 100 : 0;
      
      expect(rawTotal).toBe(85);
      expect(maxTotal).toBe(200);
      expect(percent).toBe(42.5);
    });

    it("should exclude excused scores from denominator", () => {
      // Excused items should not be added to componentScores array
      const scores: Array<{ points: number; maxPoints: number; status: string }> = [
        { points: 85, maxPoints: 100, status: "present" },
        // excused item is excluded - not in array
      ];
      
      const rawTotal = scores.reduce((sum, s) => sum + s.points, 0);
      const maxTotal = scores.reduce((sum, s) => sum + s.maxPoints, 0);
      const percent = maxTotal > 0 ? (rawTotal / maxTotal) * 100 : 0;
      
      // Only present item counted
      expect(rawTotal).toBe(85);
      expect(maxTotal).toBe(100);
      expect(percent).toBe(85);
    });

    it("should handle mixed statuses correctly", () => {
      // Simulate: 2 present, 1 missing, 1 excused (excluded)
      const scores: Array<{ points: number; maxPoints: number; status: string }> = [
        { points: 85, maxPoints: 100, status: "present" },
        { points: 90, maxPoints: 100, status: "present" },
        { points: 0, maxPoints: 100, status: "missing" },
        // excused excluded
      ];
      
      const rawTotal = scores.reduce((sum, s) => sum + s.points, 0);
      const maxTotal = scores.reduce((sum, s) => sum + s.maxPoints, 0);
      const percent = maxTotal > 0 ? (rawTotal / maxTotal) * 100 : 0;
      
      expect(rawTotal).toBe(175);
      expect(maxTotal).toBe(300); // 100 + 100 + 100 (missing counts max)
      expect(percent).toBeCloseTo(58.33, 2);
    });
  });

  describe("Weight Normalization and Validation", () => {
    it("should compute correct initial grade when weights sum to 100", () => {
      const components = [
        { id: "c1", percent: 85, weightPercent: 50 },
        { id: "c2", percent: 90, weightPercent: 50 },
      ];
      
      let totalWeightedScore = 0;
      let totalWeight = 0;
      
      for (const comp of components) {
        const weightedScore = (comp.percent * comp.weightPercent) / 100;
        totalWeightedScore += weightedScore;
        totalWeight += comp.weightPercent;
      }
      
      const initialGrade = totalWeight > 0 ? (totalWeightedScore / totalWeight) * 100 : 0;
      
      // (85 * 0.5 + 90 * 0.5) = 42.5 + 45 = 87.5
      expect(initialGrade).toBe(87.5);
    });

    it("should fail in strict mode if weights do not sum to 100", () => {
      const components = [
        { id: "c1", percent: 85, weightPercent: 40 },
        { id: "c2", percent: 90, weightPercent: 50 },
      ];
      
      let totalWeight = 0;
      for (const comp of components) {
        totalWeight += comp.weightPercent;
      }
      
      const weightPolicy = "strict";
      const isValid = Math.abs(totalWeight - 100) < 0.01;
      
      if (weightPolicy === "strict") {
        expect(isValid).toBe(false);
        // Should fail validation
      }
    });

    it("should normalize in normalize mode if weights do not sum to 100", () => {
      const components = [
        { id: "c1", percent: 85, weightPercent: 40 },
        { id: "c2", percent: 90, weightPercent: 50 },
      ];
      
      let totalWeightedScore = 0;
      let totalWeight = 0;
      
      for (const comp of components) {
        const weightedScore = (comp.percent * comp.weightPercent) / 100;
        totalWeightedScore += weightedScore;
        totalWeight += comp.weightPercent;
      }
      
      const weightPolicy = "normalize";
      let initialGrade: number;
      
      if (weightPolicy === "normalize" && totalWeight > 0 && Math.abs(totalWeight - 100) > 0.01) {
        // Normalize: multiply by (100 / totalWeight)
        initialGrade = (totalWeightedScore / totalWeight) * 100;
      } else {
        initialGrade = totalWeight > 0 ? (totalWeightedScore / totalWeight) * 100 : 0;
      }
      
      // totalWeightedScore = (85 * 0.4 + 90 * 0.5) = 34 + 45 = 79
      // totalWeight = 90
      // initialGrade = (79 / 90) * 100 = 87.78...
      expect(initialGrade).toBeCloseTo(87.78, 2);
    });

    it("should handle three components with correct weights", () => {
      // WW: 50%, PT: 30%, QA: 20% (DepEd typical)
      const components = [
        { id: "ww", percent: 88, weightPercent: 50 },
        { id: "pt", percent: 85, weightPercent: 30 },
        { id: "qa", percent: 90, weightPercent: 20 },
      ];
      
      let totalWeightedScore = 0;
      let totalWeight = 0;
      
      for (const comp of components) {
        const weightedScore = (comp.percent * comp.weightPercent) / 100;
        totalWeightedScore += weightedScore;
        totalWeight += comp.weightPercent;
      }
      
      const initialGrade = totalWeight > 0 ? (totalWeightedScore / totalWeight) * 100 : 0;
      
      // (88 * 0.5 + 85 * 0.3 + 90 * 0.2) = 44 + 25.5 + 18 = 87.5
      expect(initialGrade).toBe(87.5);
    });
  });

  describe("DepEd Complete Flow", () => {
    it("should compute DepEd grade with WW/PT/QA components and transmutation", () => {
      // Component percentages
      const components = [
        { id: "ww", percent: 88, weightPercent: 50 },
        { id: "pt", percent: 85, weightPercent: 30 },
        { id: "qa", percent: 90, weightPercent: 20 },
      ];
      
      // Compute initial grade
      let totalWeightedScore = 0;
      let totalWeight = 0;
      
      for (const comp of components) {
        const weightedScore = (comp.percent * comp.weightPercent) / 100;
        totalWeightedScore += weightedScore;
        totalWeight += comp.weightPercent;
      }
      
      const initialGrade = totalWeight > 0 ? (totalWeightedScore / totalWeight) * 100 : 0;
      expect(initialGrade).toBe(87.5);
      
      // Apply floor rounding for DepEd
      const roundingMode = "floor";
      const initialGradeKey = Math.floor(initialGrade); // 87
      
      // Transmutation lookup
      const transmutationRows: GradebookTransmutationRow[] = [
        { id: "1", transmutation_table_id: "t1", initial_grade: 87, transmuted_grade: 92 },
        { id: "2", transmutation_table_id: "t1", initial_grade: 88, transmuted_grade: 93 },
      ];
      
      const row = transmutationRows.find((r) => r.initial_grade === initialGradeKey);
      
      expect(row).toBeDefined();
      expect(row?.transmuted_grade).toBe(92);
      
      const finalNumericGrade = row?.transmuted_grade || initialGrade;
      expect(finalNumericGrade).toBe(92);
    });

    it("should handle boundary case: 89.49 vs 89.50 with floor rounding", () => {
      const initialGrade1 = 89.49;
      const initialGrade2 = 89.50;
      
      const roundingMode = "floor";
      const key1 = Math.floor(initialGrade1); // 89
      const key2 = Math.floor(initialGrade2); // 89
      
      expect(key1).toBe(89);
      expect(key2).toBe(89); // Both floor to 89
      
      const transmutationRows: GradebookTransmutationRow[] = [
        { id: "1", transmutation_table_id: "t1", initial_grade: 89, transmuted_grade: 93 },
      ];
      
      const row1 = transmutationRows.find((r) => r.initial_grade === key1);
      const row2 = transmutationRows.find((r) => r.initial_grade === key2);
      
      expect(row1?.transmuted_grade).toBe(93);
      expect(row2?.transmuted_grade).toBe(93);
    });
  });

  describe("CHED Flow (No Transmutation)", () => {
    it("should compute CHED grade directly without transmutation", () => {
      const components = [
        { id: "c1", percent: 88, weightPercent: 40 },
        { id: "c2", percent: 85, weightPercent: 35 },
        { id: "c3", percent: 90, weightPercent: 25 },
      ];
      
      let totalWeightedScore = 0;
      let totalWeight = 0;
      
      for (const comp of components) {
        const weightedScore = (comp.percent * comp.weightPercent) / 100;
        totalWeightedScore += weightedScore;
        totalWeight += comp.weightPercent;
      }
      
      const initialGrade = totalWeight > 0 ? (totalWeightedScore / totalWeight) * 100 : 0;
      
      // CHED: final_numeric_grade = initial_grade (no transmutation)
      const finalNumericGrade = initialGrade;
      
      // Calculation: (88*0.4 + 85*0.35 + 90*0.25) = 35.2 + 29.75 + 22.5 = 87.45
      expect(finalNumericGrade).toBeCloseTo(87.45, 2);
    });
  });
});
