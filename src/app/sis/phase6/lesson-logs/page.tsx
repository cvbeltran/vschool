"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { listLessonLogs, type LessonLog } from "@/lib/phase6/lesson-logs";

export default function LessonLogsPage() {
  const router = useRouter();
  const [logs, setLogs] = useState<LessonLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await listLessonLogs();
        setLogs(data);
        setError(null);
      } catch (err: any) {
        console.error("Error fetching lesson logs:", err);
        setError(err.message || "Failed to load lesson logs");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Lesson Logs</h1>
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Lesson Logs</h1>
        <Button onClick={() => router.push("/sis/phase6/lesson-logs/new")}>
          <Plus className="mr-2 h-4 w-4" />
          Create Lesson Log
        </Button>
      </div>

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-3">
          {error}
        </div>
      )}

      {logs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              No lesson logs found. Create your first lesson log to get started.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {logs.map((log) => (
            <Card key={log.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">
                      {log.week_start_date} - {log.week_end_date}
                    </p>
                    {log.syllabus && (
                      <p className="text-sm text-muted-foreground">
                        Syllabus: {log.syllabus.name}
                      </p>
                    )}
                    {log.teacher && (
                      <p className="text-sm text-muted-foreground">
                        Teacher: {log.teacher.first_name} {log.teacher.last_name}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/sis/phase6/lesson-logs/${log.id}`)}
                  >
                    View
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
