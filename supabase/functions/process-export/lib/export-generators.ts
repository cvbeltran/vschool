// Export Generation Helpers
// Created: 2024
// Description: Helper functions for generating export files (PDF, CSV, Excel)
// Enforces Phase 5 boundaries: read-only consumption of Phase 4 grade records

export interface ExportData {
  studentGrades?: any[];
  transcriptRecords?: any[];
  students?: any[];
  schoolYears?: any[];
  programs?: any[];
  sections?: any[];
}

export interface ExportResult {
  fileBuffer: Uint8Array;
  fileName: string;
  contentType: string;
}

/**
 * Generate a simple PDF file (placeholder implementation)
 * In production, use a proper PDF library like pdfkit or puppeteer
 */
export function generatePDF(
  title: string,
  data: ExportData,
  params: Record<string, any>
): ExportResult {
  // Minimal PDF structure that produces a valid, downloadable PDF file
  const pdfParts: string[] = [];

  // PDF Header
  pdfParts.push("%PDF-1.4\n");

  // Catalog object
  pdfParts.push("1 0 obj\n");
  pdfParts.push("<< /Type /Catalog /Pages 2 0 R >>\n");
  pdfParts.push("endobj\n");

  // Pages object
  pdfParts.push("2 0 obj\n");
  pdfParts.push("<< /Type /Pages /Kids [3 0 R] /Count 1 >>\n");
  pdfParts.push("endobj\n");

  // Page object
  pdfParts.push("3 0 obj\n");
  pdfParts.push(
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> >>\n"
  );
  pdfParts.push("endobj\n");

  // Content stream
  const contentLines: string[] = [];
  contentLines.push("BT /F1 16 Tf 50 750 Td (" + escapePDFString(title) + ") Tj ET");
  contentLines.push(
    "BT /F1 10 Tf 50 730 Td (Generated: " +
      escapePDFString(new Date().toISOString()) +
      ") Tj ET"
  );

  if (data.studentGrades && data.studentGrades.length > 0) {
    contentLines.push(
      "BT /F1 10 Tf 50 710 Td (Records: " +
        data.studentGrades.length.toString() +
        ") Tj ET"
    );
    // Add student data (simplified)
    let yPos = 690;
    for (let i = 0; i < Math.min(10, data.studentGrades.length); i++) {
      const grade = data.studentGrades[i];
      const student = grade.students;
      const studentName = student
        ? `${student.first_name || ""} ${student.last_name || ""}`
        : "Unknown";
      contentLines.push(
        `BT /F1 9 Tf 50 ${yPos} Td (${escapePDFString(studentName)}) Tj ET`
      );
      yPos -= 15;
    }
  }

  const content = contentLines.join("\n");
  pdfParts.push("4 0 obj\n");
  pdfParts.push(`<< /Length ${content.length} >>\n`);
  pdfParts.push("stream\n");
  pdfParts.push(content + "\n");
  pdfParts.push("endstream\n");
  pdfParts.push("endobj\n");

  // Xref table
  pdfParts.push("xref\n");
  pdfParts.push("0 5\n");
  pdfParts.push("0000000000 65535 f\n");
  pdfParts.push("0000000009 00000 n\n");
  pdfParts.push("0000000058 00000 n\n");
  pdfParts.push("0000000115 00000 n\n");
  pdfParts.push("0000000306 00000 n\n");

  // Trailer
  pdfParts.push("trailer\n");
  pdfParts.push("<< /Size 5 /Root 1 0 R >>\n");
  pdfParts.push("startxref\n");
  pdfParts.push("0\n");
  pdfParts.push("%%EOF\n");

  const pdfContent = pdfParts.join("");

  return {
    fileBuffer: new TextEncoder().encode(pdfContent),
    fileName: `${title.toLowerCase().replace(/\s+/g, "_")}_${Date.now()}.pdf`,
    contentType: "application/pdf",
  };
}

/**
 * Generate CSV file from transcript records or student grades
 */
export function generateCSV(
  data: ExportData,
  params: Record<string, any>
): ExportResult {
  const rows: string[] = [];

  if (data.transcriptRecords && data.transcriptRecords.length > 0) {
    // CSV header for transcript records
    rows.push(
      "Student ID,Student Name,Student Number,LRN,School Year,Term Period,Course Name,Grade Value,Credits"
    );

    for (const record of data.transcriptRecords) {
      const student = record.students;
      const schoolYear = record.school_years;
      rows.push(
        [
          record.student_id || "",
          student
            ? `${student.first_name || ""} ${student.last_name || ""}`.trim()
            : "",
          student?.student_number || "",
          student?.lrn || "",
          schoolYear?.name || "",
          record.term_period || "",
          record.course_name || "",
          record.grade_value || "",
          record.credits?.toString() || "",
        ]
          .map((cell) => escapeCSV(cell))
          .join(",")
      );
    }
  } else if (data.studentGrades && data.studentGrades.length > 0) {
    // CSV header for student grades
    rows.push(
      "Student ID,Student Name,Student Number,LRN,School Year,Term Period,Program,Section,Grade Value,Status"
    );

    for (const grade of data.studentGrades) {
      const student = grade.students;
      const schoolYear = grade.school_years;
      const program = grade.programs;
      const section = grade.sections;
      rows.push(
        [
          grade.student_id || "",
          student
            ? `${student.first_name || ""} ${student.last_name || ""}`.trim()
            : "",
          student?.student_number || "",
          student?.lrn || "",
          schoolYear?.name || "",
          grade.term_period || "",
          program?.name || "",
          section?.name || "",
          grade.grade_value || "",
          grade.status || "",
        ]
          .map((cell) => escapeCSV(cell))
          .join(",")
      );
    }
  } else {
    throw new Error("No data available for CSV export");
  }

  const csvContent = rows.join("\n");

  return {
    fileBuffer: new TextEncoder().encode(csvContent),
    fileName: `export_${Date.now()}.csv`,
    contentType: "text/csv",
  };
}

/**
 * Generate Excel file (placeholder - CSV format for now)
 * In production, use a proper Excel library like exceljs
 */
export function generateExcel(
  data: ExportData,
  params: Record<string, any>
): ExportResult {
  // For now, generate CSV format (Excel can open CSV files)
  // In production, use exceljs or similar library to generate proper .xlsx files
  const csvResult = generateCSV(data, params);
  return {
    ...csvResult,
    fileName: csvResult.fileName.replace(".csv", ".xlsx"),
    contentType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Escape special characters for PDF strings
 */
function escapePDFString(str: string): string {
  return str
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r");
}

/**
 * Escape CSV cell values
 */
function escapeCSV(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return "";
  }

  const str = String(value);

  // If value contains comma, newline, or quote, wrap in quotes and escape quotes
  if (str.includes(",") || str.includes("\n") || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}
