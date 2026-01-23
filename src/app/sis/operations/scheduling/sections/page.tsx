"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useOrganization } from "@/lib/hooks/use-organization";
import { supabase } from "@/lib/supabase/client";
import { listSections, type Section } from "@/lib/phase6/operations";
import {
  listSectionTeachers,
  listSectionMeetings,
  type SectionTeacher,
  type SectionMeeting,
} from "@/lib/phase6/scheduling";
import { Toast, ToastContainer } from "@/components/ui/toast";
import { CalendarClock, Users, Clock } from "lucide-react";

export default function SectionSchedulingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { organizationId, isSuperAdmin, isLoading: orgLoading } = useOrganization();
  const [toasts, setToasts] = useState<Toast[]>([]);
  
  const [sections, setSections] = useState<Section[]>([]);
  const [selectedSection, setSelectedSection] = useState<Section | null>(null);
  const [sectionTeachers, setSectionTeachers] = useState<SectionTeacher[]>([]);
  const [sectionMeetings, setSectionMeetings] = useState<SectionMeeting[]>([]);
  const [loading, setLoading] = useState(true);

  const showToast = (message: string, type: Toast["type"] = "success") => {
    const id = Math.random().toString(36).substring(7);
    setToasts((prev) => [...prev, { id, message, type }]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  // Fetch sections (only on mount or when org changes)
  useEffect(() => {
    const fetchSections = async () => {
      if (orgLoading || !organizationId) return;
      setLoading(true);
      try {
        const data = await listSections();
        setSections(data);
        
        // Select section from URL if present (only on initial load)
        const sectionId = searchParams.get("section");
        if (sectionId) {
          const section = data.find((s) => s.id === sectionId);
          if (section) {
            setSelectedSection(section);
          }
        }
      } catch (error: any) {
        console.error("Error fetching sections:", error);
        showToast(error.message || "Failed to load sections", "error");
      } finally {
        setLoading(false);
      }
    };

    fetchSections();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, orgLoading]); // Only depend on org, not searchParams

  // Fetch teachers and meetings for selected section
  useEffect(() => {
    const fetchSectionData = async () => {
      if (!selectedSection) {
        setSectionTeachers([]);
        setSectionMeetings([]);
        return;
      }

      try {
        const [teachers, meetings] = await Promise.all([
          listSectionTeachers({ section_id: selectedSection.id }),
          listSectionMeetings({ section_id: selectedSection.id }),
        ]);
        setSectionTeachers(teachers);
        setSectionMeetings(meetings);
      } catch (error: any) {
        console.error("Error fetching section data:", error);
        showToast(error.message || "Failed to load section data", "error");
      }
    };

    fetchSectionData();
  }, [selectedSection]);

  // Update URL when section changes (but only if different from current URL)
  useEffect(() => {
    const currentSectionId = searchParams.get("section");
    
    if (selectedSection) {
      // Only update URL if it's different from what we're setting
      if (currentSectionId !== selectedSection.id) {
        router.replace(`/sis/operations/scheduling/sections?section=${selectedSection.id}`, { scroll: false });
      }
    } else {
      // Clear section from URL if no section selected and URL has a section param
      if (currentSectionId) {
        router.replace(`/sis/operations/scheduling/sections`, { scroll: false });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSection]); // Only depend on selectedSection, not searchParams or router

  const handleSectionSelect = (sectionId: string) => {
    const section = sections.find((s) => s.id === sectionId);
    setSelectedSection(section || null);
  };

  const getDayName = (dayNumber: number): string => {
    const days = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    return days[dayNumber] || "";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Section Scheduling</h1>
      </div>

      {/* Section Selector */}
      <Card>
        <CardHeader>
          <CardTitle>Select Section</CardTitle>
        </CardHeader>
        <CardContent>
          <Select
            value={selectedSection?.id || "none"}
            onValueChange={handleSectionSelect}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a section" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Select a section...</SelectItem>
              {sections.map((section) => (
                <SelectItem key={section.id} value={section.id}>
                  {section.name} ({section.code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {loading ? (
        <Card>
          <CardContent className="py-8">
            <div className="text-center text-muted-foreground">Loading...</div>
          </CardContent>
        </Card>
      ) : selectedSection ? (
        <>
          {/* Section Info */}
          <Card>
            <CardHeader>
              <CardTitle>{selectedSection.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">Code</div>
                  <div className="font-medium">{selectedSection.code}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Status</div>
                  <Badge variant={selectedSection.is_active ? "default" : "secondary"}>
                    {selectedSection.is_active ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Assigned Teachers */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Assigned Teachers ({sectionTeachers.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {sectionTeachers.length === 0 ? (
                <div className="text-center text-muted-foreground py-4">
                  No teachers assigned to this section.
                </div>
              ) : (
                <div className="space-y-2">
                  {sectionTeachers.map((st) => (
                    <div
                      key={st.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div>
                        <div className="font-medium">
                          {st.staff?.first_name} {st.staff?.last_name}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Role: <Badge variant="outline">{st.role}</Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Meeting Patterns */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarClock className="h-5 w-5" />
                Meeting Patterns ({sectionMeetings.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {sectionMeetings.length === 0 ? (
                <div className="text-center text-muted-foreground py-4">
                  No meeting patterns defined for this section.
                </div>
              ) : (
                <div className="space-y-2">
                  {sectionMeetings.map((meeting) => (
                    <div
                      key={meeting.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">
                            {meeting.start_time} - {meeting.end_time}
                          </span>
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          Days: {meeting.days_of_week.map(getDayName).join(", ")}
                          {meeting.period && ` • Period: ${meeting.period.name}`}
                          {meeting.room && ` • Room: ${meeting.room.code}`}
                        </div>
                      </div>
                      <Badge variant={meeting.status === "active" ? "default" : "secondary"}>
                        {meeting.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="text-sm text-muted-foreground">
            <strong>Note:</strong> To manage teachers and meeting patterns, use the admin interface.
            Teachers can view their assigned sections and meeting schedules here.
          </div>
        </>
      ) : (
        <Card>
          <CardContent className="py-8">
            <div className="text-center text-muted-foreground">
              Please select a section to view its scheduling information.
            </div>
          </CardContent>
        </Card>
      )}

      {/* Toast Container */}
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </div>
  );
}
