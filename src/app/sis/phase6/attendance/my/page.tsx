"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { listMyTeacherAttendance, type TeacherAttendance } from "@/lib/phase6/attendance";

export default function MyAttendancePage() {
  const [attendance, setAttendance] = useState<TeacherAttendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await listMyTeacherAttendance();
        setAttendance(data);
        setError(null);
      } catch (err: any) {
        console.error("Error fetching teacher attendance:", err);
        setError(err.message || "Failed to load attendance");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">My Attendance</h1>
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">My Attendance</h1>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Log Attendance
        </Button>
      </div>

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-3">
          {error}
        </div>
      )}

      {attendance.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              No attendance records found. Log your first attendance to get started.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Attendance History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {attendance.map((record) => (
                <div key={record.id} className="flex items-center justify-between p-2 border rounded">
                  <div>
                    <p className="font-medium">{record.attendance_date}</p>
                    <p className="text-sm text-muted-foreground">Status: {record.status}</p>
                    {record.notes && (
                      <p className="text-sm text-muted-foreground">{record.notes}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
