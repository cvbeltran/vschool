"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Key } from "lucide-react";
import { getMyStudentRow } from "@/lib/student/student-data";

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [student, setStudent] = useState<any>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await getMyStudentRow();
        setStudent(data);
      } catch (error) {
        console.error("Error fetching student data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  const displayName = student?.preferred_name 
    || (student?.legal_first_name && student?.legal_last_name 
      ? `${student.legal_first_name} ${student.legal_last_name}` 
      : "Student");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-2">
          Manage your account settings
        </p>
      </div>

      {/* Account Information */}
      <Card>
        <CardHeader>
          <CardTitle>Account Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {student?.legal_first_name && student?.legal_last_name && (
            <div>
              <p className="text-sm font-medium text-muted-foreground">Legal Name</p>
              <p>{student.legal_first_name} {student.legal_last_name}</p>
            </div>
          )}
          {student?.preferred_name && (
            <div>
              <p className="text-sm font-medium text-muted-foreground">Preferred Name</p>
              <p>{student.preferred_name}</p>
            </div>
          )}
          {student?.student_number && (
            <div>
              <p className="text-sm font-medium text-muted-foreground">Student Number</p>
              <p>{student.student_number}</p>
            </div>
          )}
          {student?.primary_email && (
            <div>
              <p className="text-sm font-medium text-muted-foreground">Email</p>
              <p>{student.primary_email}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Security */}
      <Card>
        <CardHeader>
          <CardTitle>Security</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm font-medium mb-2">Password</p>
            <p className="text-sm text-muted-foreground mb-4">
              Change your password to keep your account secure.
            </p>
            <Button asChild>
              <Link href="/student/reset-password">
                <Key className="mr-2 h-4 w-4" />
                Change Password
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Profile Preferences (Placeholder) */}
      <Card>
        <CardHeader>
          <CardTitle>Profile Preferences</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Profile preferences and additional settings will be available here in the future.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
