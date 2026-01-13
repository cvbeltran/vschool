"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/lib/supabase/client";

interface TranscriptGeneratorPanelProps {
  onGenerate: (
    studentId: string,
    schoolYearId: string,
    termPeriod: string
  ) => void;
  onCancel: () => void;
  organizationId: string | null;
}

export function TranscriptGeneratorPanel({
  onGenerate,
  onCancel,
  organizationId,
}: TranscriptGeneratorPanelProps) {
  const [students, setStudents] = useState<
    Array<{ id: string; first_name: string | null; last_name: string | null }>
  >([]);
  const [schoolYears, setSchoolYears] = useState<
    Array<{ id: string; year_label: string }>
  >([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const [selectedSchoolYearId, setSelectedSchoolYearId] = useState<string>("");
  const [selectedTermPeriod, setSelectedTermPeriod] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch students
        let studentsQuery = supabase
          .from("students")
          .select("id, first_name, last_name")
          .order("last_name", { ascending: true });

        if (organizationId) {
          studentsQuery = studentsQuery.eq("organization_id", organizationId);
        }

        const { data: studentsData } = await studentsQuery;
        setStudents(studentsData || []);

        // Fetch school years
        let schoolYearsQuery = supabase
          .from("school_years")
          .select("id, year_label")
          .order("start_date", { ascending: false });

        if (organizationId) {
          schoolYearsQuery = schoolYearsQuery.eq("organization_id", organizationId);
        }

        const { data: schoolYearsData } = await schoolYearsQuery;
        setSchoolYears(schoolYearsData || []);
      } catch (err: any) {
        console.error("Error fetching data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [organizationId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentId || !selectedSchoolYearId || !selectedTermPeriod) {
      alert("Please fill all required fields");
      return;
    }
    onGenerate(selectedStudentId, selectedSchoolYearId, selectedTermPeriod);
  };

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Generate Transcript</DialogTitle>
        </DialogHeader>
        {loading ? (
          <p>Loading...</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="student">Student *</Label>
              <Select
                value={selectedStudentId}
                onValueChange={setSelectedStudentId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select student" />
                </SelectTrigger>
                <SelectContent>
                  {students.map((student) => (
                    <SelectItem key={student.id} value={student.id}>
                      {student.first_name} {student.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="school_year">School Year *</Label>
              <Select
                value={selectedSchoolYearId}
                onValueChange={setSelectedSchoolYearId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select school year" />
                </SelectTrigger>
                <SelectContent>
                  {schoolYears.map((year) => (
                    <SelectItem key={year.id} value={year.id}>
                      {year.year_label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="term_period">Term Period *</Label>
              <Select
                value={selectedTermPeriod}
                onValueChange={setSelectedTermPeriod}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select term" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Q1">Q1</SelectItem>
                  <SelectItem value="Q2">Q2</SelectItem>
                  <SelectItem value="Q3">Q3</SelectItem>
                  <SelectItem value="Q4">Q4</SelectItem>
                  <SelectItem value="Semester 1">Semester 1</SelectItem>
                  <SelectItem value="Semester 2">Semester 2</SelectItem>
                  <SelectItem value="Full Year">Full Year</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
              <Button type="submit">Generate</Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
