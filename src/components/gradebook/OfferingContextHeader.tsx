"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getOfferingContext, type OfferingContext } from "@/lib/gradebook-offerings";
import { Building2, GraduationCap, BookOpen, Users, Calendar } from "lucide-react";

interface OfferingContextHeaderProps {
  offeringId: string;
}

export function OfferingContextHeader({ offeringId }: OfferingContextHeaderProps) {
  const [context, setContext] = useState<OfferingContext | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchContext = async () => {
      setLoading(true);
      const ctx = await getOfferingContext(offeringId);
      setContext(ctx);
      setLoading(false);
    };

    if (offeringId) {
      fetchContext();
    }
  }, [offeringId]);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-4">
          <div className="text-sm text-muted-foreground">Loading offering context...</div>
        </CardContent>
      </Card>
    );
  }

  if (!context) {
    return (
      <Card className="border-destructive">
        <CardContent className="py-4">
          <div className="text-sm text-destructive">Failed to load offering context</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-6">
      <CardContent className="py-4">
        <div className="flex flex-wrap items-center gap-4 text-sm">
          {/* School */}
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">School:</span>
            <span>{context.school_name}</span>
          </div>

          {/* Grade Level */}
          {context.grade_level && (
            <div className="flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Grade Level:</span>
              <Badge variant="outline">{context.grade_level}</Badge>
            </div>
          )}

          {/* Subject */}
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">Subject:</span>
            <Badge variant="secondary">
              {context.subject_code} - {context.subject_name}
            </Badge>
          </div>

          {/* Section */}
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">Section:</span>
            <span className="font-mono">{context.section_code}</span>
            <span>-</span>
            <span>{context.section_name}</span>
          </div>

          {/* Period */}
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">Period:</span>
            <Badge>{context.term_period}</Badge>
          </div>

          {/* School Year */}
          <div className="flex items-center gap-2">
            <span className="font-medium">School Year:</span>
            <Badge variant="outline">{context.school_year_label}</Badge>
          </div>

          {/* Teachers */}
          {context.teachers.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="font-medium">Teacher(s):</span>
              {context.teachers.map((teacher, idx) => (
                <Badge key={teacher.staff_id} variant={teacher.role === "primary" ? "default" : "outline"}>
                  {teacher.name} ({teacher.role})
                </Badge>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
