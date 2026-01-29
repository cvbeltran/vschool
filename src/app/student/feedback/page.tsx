"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Edit } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getMyFeedback, type StudentFeedback } from "@/lib/student/student-data";

function FeedbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<StudentFeedback[]>([]);
  const [filteredFeedback, setFilteredFeedback] = useState<StudentFeedback[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    // Check for success message
    if (searchParams.get("submitted") === "true") {
      setShowSuccess(true);
      // Remove query param from URL
      router.replace("/student/feedback");
      // Hide success message after 5 seconds
      setTimeout(() => setShowSuccess(false), 5000);
    }
  }, [searchParams, router]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await getMyFeedback();
        setFeedback(data);
        setFilteredFeedback(data);
      } catch (error) {
        console.error("Error fetching feedback:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    if (statusFilter === "all") {
      setFilteredFeedback(feedback);
    } else {
      setFilteredFeedback(feedback.filter((f) => f.status === statusFilter));
    }
  }, [feedback, statusFilter]);

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "completed":
        return "default";
      case "draft":
        return "secondary";
      default:
        return "outline";
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">My Feedback</h1>
          <p className="text-muted-foreground mt-2">
            Create and manage your feedback entries
          </p>
        </div>
        <Button asChild>
          <Link href="/student/feedback/new">
            <Plus className="mr-2 h-4 w-4" />
            Create Feedback
          </Link>
        </Button>
      </div>

      {/* Success Message */}
      {showSuccess && (
        <div className="bg-green-50 border border-green-200 text-green-800 p-4 rounded-md">
          Feedback submitted successfully!
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Feedback List */}
      <Card>
        <CardHeader>
          <CardTitle>Feedback Entries ({filteredFeedback.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredFeedback.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p className="mb-4">No feedback submitted yet</p>
              <Button asChild variant="outline">
                <Link href="/student/feedback/new">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Your First Feedback
                </Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredFeedback.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-start justify-between border-b pb-4 last:border-b-0 last:pb-0"
                >
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium">
                        {entry.feedback_dimension?.dimension_name || "Feedback"}
                      </h3>
                      <Badge variant={getStatusBadgeVariant(entry.status)}>
                        {entry.status}
                      </Badge>
                      {entry.is_anonymous && (
                        <Badge variant="outline">Anonymous</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Quarter: {entry.quarter}
                    </p>
                    {entry.teacher && (
                      <p className="text-sm text-muted-foreground">
                        Teacher: {entry.teacher.first_name} {entry.teacher.last_name}
                      </p>
                    )}
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {entry.feedback_text}
                    </p>
                    <div className="text-xs text-muted-foreground">
                      Created: {new Date(entry.created_at).toLocaleDateString()}
                      {entry.status === "completed" && entry.provided_at && (
                        <> · Submitted: {new Date(entry.provided_at).toLocaleDateString()}</>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/student/feedback/${entry.id}`}>
                        View
                      </Link>
                    </Button>
                    {entry.status === "draft" && (
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/student/feedback/${entry.id}/edit`}>
                          <Edit className="mr-2 h-4 w-4" />
                          Edit
                        </Link>
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function FeedbackPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    }>
      <FeedbackContent />
    </Suspense>
  );
}
