import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

function escapeCsvValue(value: string | null | undefined): string {
  if (value === null || value === undefined) {
    return "";
  }
  const stringValue = String(value);
  if (stringValue.includes(",") || stringValue.includes('"') || stringValue.includes("\n")) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

function generateCsv(rows: any[], headers: string[]): string {
  const csvRows = [headers.join(",")];
  
  for (const row of rows) {
    const values = headers.map((header) => escapeCsvValue(row[header]));
    csvRows.push(values.join(","));
  }
  
  return csvRows.join("\n");
}

export async function GET() {
  const { data, error } = await supabaseServer
    .from("students")
    .select("id, first_name, last_name, email, batch_id, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const headers = ["id", "first_name", "last_name", "email", "batch_id", "created_at"];
  const csv = generateCsv(data || [], headers);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": 'attachment; filename="students.csv"',
    },
  });
}

