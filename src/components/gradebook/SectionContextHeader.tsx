"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getSectionContext, type SectionContext } from "@/lib/gradebook-section-context";
import { Building2, GraduationCap, BookOpen, Users } from "lucide-react";

interface SectionContextHeaderProps {
  sectionId: string;
  period?: string; // Optional term/quarter/semester
}

export function SectionContextHeader({ sectionId, period }: SectionContextHeaderProps) {
  const [context, setContext] = useState<SectionContext | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchContext = async () => {
      setLoading(true);
      const ctx = await getSectionContext(sectionId);
      setContext(ctx);
      setLoading(false);
    };

    if (sectionId) {
      fetchContext();
    }
  }, [sectionId]);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-4">
          <div className="text-sm text-muted-foreground">Loading section context...</div>
        </CardContent>
      </Card>
    );
  }

  if (!context) {
    return (
      <Card className="border-destructive">
        <CardContent className="py-4">
          <div className="text-sm text-destructive">Failed to load section context</div>
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
          {context.subject_name ? (
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Subject:</span>
              <Badge variant="secondary">
                {context.subject_code} - {context.subject_name}
              </Badge>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Subject:</span>
              <span className="text-muted-foreground">Not set</span>
            </div>
          )}

          {/* Section */}
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">Section:</span>
            <span className="font-mono">{context.section_code}</span>
            <span>-</span>
            <span>{context.section_name}</span>
          </div>

          {/* Period */}
          {period && (
            <div className="flex items-center gap-2">
              <span className="font-medium">Period:</span>
              <Badge>{period}</Badge>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
