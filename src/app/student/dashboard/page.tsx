"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, FolderOpen, ClipboardCheck, MessageSquare, Plus } from "lucide-react";
import { getMyStudentRow, getMyAttendance, getMyPortfolio, getMyAssessments, getMyFeedback } from "@/lib/student/student-data";

export default function StudentDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [student, setStudent] = useState<any>(null);
  const [stats, setStats] = useState({
    attendanceCount: 0,
    portfolioCount: 0,
    assessmentsCount: 0,
    feedbackDraftCount: 0,
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const studentData = await getMyStudentRow();
        if (!studentData) {
          router.push("/student/login");
          return;
        }

        setStudent(studentData);

        // Fetch counts - get attendance from last 30 days
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const startDate = thirtyDaysAgo.toISOString().split('T')[0];

        const [attendance, portfolio, assessments, completedFeedback] = await Promise.all([
          getMyAttendance({ startDate }),
          getMyPortfolio(),
          getMyAssessments(),
          getMyFeedback({ status: "completed" }),
        ]);

        setStats({
          attendanceCount: attendance.length,
          portfolioCount: portfolio.length,
          assessmentsCount: assessments.length,
          feedbackDraftCount: completedFeedback.length,
        });
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [router]);

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
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Welcome, {displayName}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Attendance Records</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.attendanceCount}</div>
            <p className="text-xs text-muted-foreground">Total records</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Portfolio Artifacts</CardTitle>
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.portfolioCount}</div>
            <p className="text-xs text-muted-foreground">Evidence you submitted</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Assessments</CardTitle>
            <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.assessmentsCount}</div>
            <p className="text-xs text-muted-foreground">Teacher-reviewed evaluations</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed Feedback</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.feedbackDraftCount}</div>
            <p className="text-xs text-muted-foreground">Your reflections</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/student/attendance">
              <Calendar className="mr-2 h-4 w-4" />
              View Attendance
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/student/my-portfolio">
              <FolderOpen className="mr-2 h-4 w-4" />
              View Portfolio
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/student/assessments">
              <ClipboardCheck className="mr-2 h-4 w-4" />
              View Assessments
            </Link>
          </Button>
          <Button asChild>
            <Link href="/student/feedback/new">
              <Plus className="mr-2 h-4 w-4" />
              Create Feedback
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
