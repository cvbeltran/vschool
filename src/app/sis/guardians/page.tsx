"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, ChevronDown } from "lucide-react";
import { fetchTaxonomyItems } from "@/lib/taxonomies";
import { TAXONOMY_KEYS } from "@/lib/constants/student-columns";
import type { TaxonomyItem } from "@/lib/taxonomies";
import { useOrganization } from "@/lib/hooks/use-organization";

interface StudentInfo {
  id: string;
  name: string;
  email: string | null;
  relationship_label: string | null;
}

interface GroupedGuardian {
  id: string;
  guardian_name: string;
  guardian_email: string | null;
  guardian_phone: string | null;
  students: StudentInfo[];
  // For display purposes - show the most common relationship if multiple
  relationship_label: string | null;
}

export default function GuardiansPage() {
  const router = useRouter();
  const { organizationId, isSuperAdmin, isLoading: orgLoading } = useOrganization();
  const [guardians, setGuardians] = useState<GroupedGuardian[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openDropdowns, setOpenDropdowns] = useState<Set<string>>(new Set());
  const [dropdownPositions, setDropdownPositions] = useState<Map<string, { top: number; left: number }>>(new Map());
  const buttonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  const toggleDropdown = (guardianId: string, event: React.MouseEvent<HTMLButtonElement>) => {
    const button = event.currentTarget;
    buttonRefs.current.set(guardianId, button);
    
    setOpenDropdowns((prev) => {
      const next = new Set(prev);
      if (next.has(guardianId)) {
        // Close this dropdown
        next.delete(guardianId);
        setDropdownPositions((pos) => {
          const newPos = new Map(pos);
          newPos.delete(guardianId);
          return newPos;
        });
      } else {
        // Close all other dropdowns first, then open this one
        next.clear();
        next.add(guardianId);
        // Calculate position - position dropdown directly below button with no gap
        const rect = button.getBoundingClientRect();
        setDropdownPositions((pos) => {
          const newPos = new Map();
          // Position at button bottom, then use negative margin to eliminate gap
          newPos.set(guardianId, {
            top: rect.bottom + window.scrollY,
            left: rect.left + window.scrollX,
          });
          return newPos;
        });
      }
      return next;
    });
  };

  useEffect(() => {
    const fetchData = async () => {
      if (orgLoading) return; // Wait for organization context
      
      try {
        setLoading(true);
        setError(null);

        // Fetch guardians with their student relationships - filter by organization_id unless super admin
        let query = supabase
          .from("guardians")
          .select(`
            id,
            name,
            email,
            phone,
            student_guardians!inner(
              relationship_id,
              student:students(
                id,
                legal_first_name,
                legal_last_name,
                preferred_name,
                first_name,
                last_name,
                primary_email,
                email
              )
            )
          `);
        
        if (!isSuperAdmin && organizationId) {
          query = query.eq("organization_id", organizationId);
        }
        
        const { data: guardiansData, error: guardiansError } = await query.order("name", { ascending: true });

        if (guardiansError) {
          console.error("Error fetching guardians:", guardiansError);
          setError(guardiansError.message || "Failed to fetch guardian data.");
          setLoading(false);
          return;
        }

        if (!guardiansData || guardiansData.length === 0) {
          setGuardians([]);
          setLoading(false);
          return;
        }

        // Collect unique relationship IDs
        const relationshipIds = new Set<string>();
        guardiansData.forEach((guardian) => {
          guardian.student_guardians?.forEach((sg: any) => {
            if (sg.relationship_id) {
              relationshipIds.add(sg.relationship_id);
            }
          });
        });

        // Fetch relationship taxonomy items
        const relationshipMap = new Map<string, string>();
        if (relationshipIds.size > 0) {
          const relationshipResult = await fetchTaxonomyItems(
            TAXONOMY_KEYS.guardianRelationship
          );
          
          relationshipResult.items.forEach((item: TaxonomyItem) => {
            relationshipMap.set(item.id, item.label);
          });
        }

        // Transform guardians data into GroupedGuardian format
        const guardianArray: GroupedGuardian[] = guardiansData.map((guardian) => {
          const students: StudentInfo[] = [];
          
          guardian.student_guardians?.forEach((sg: any) => {
            const student = sg.student;
            if (student) {
              // Use legal names if available, fallback to legacy names
              const studentFirstName = student.legal_first_name || student.first_name || "";
              const studentLastName = student.legal_last_name || student.last_name || "";
              const studentName = student.preferred_name 
                ? `${student.preferred_name} (${studentFirstName} ${studentLastName})`
                : `${studentFirstName} ${studentLastName}`.trim();
              
              const studentEmail = student.primary_email || student.email || null;
              
              const relationshipLabel = sg.relationship_id
                ? relationshipMap.get(sg.relationship_id) || null
                : null;

              students.push({
                id: student.id,
                name: studentName,
                email: studentEmail,
                relationship_label: relationshipLabel,
              });
            }
          });

          // Determine relationship label - if guardian has multiple students with different relationships,
          // show the most common one or "Multiple" if they're all different
          let relationshipLabel: string | null = null;
          if (students.length > 0) {
            const relationships = students
              .map((s) => s.relationship_label)
              .filter((r) => r !== null);
            
            if (relationships.length > 0) {
              // Count occurrences
              const counts = new Map<string, number>();
              relationships.forEach((rel) => {
                counts.set(rel!, (counts.get(rel!) || 0) + 1);
              });
              
              // Find most common
              let maxCount = 0;
              let mostCommon = relationships[0] || null;
              counts.forEach((count, rel) => {
                if (count > maxCount) {
                  maxCount = count;
                  mostCommon = rel;
                }
              });
              
              // If all relationships are the same, use that; otherwise show "Multiple"
              const uniqueRelationships = new Set(relationships);
              relationshipLabel = uniqueRelationships.size === 1 
                ? mostCommon 
                : "Multiple";
            } else if (students.length === 1) {
              relationshipLabel = students[0].relationship_label;
            }
          }

          return {
            id: guardian.id,
            guardian_name: guardian.name,
            guardian_email: guardian.email,
            guardian_phone: guardian.phone,
            students: students.sort((a, b) => a.name.localeCompare(b.name)),
            relationship_label: relationshipLabel,
          };
        }).filter((guardian) => guardian.students.length > 0); // Only show guardians with at least one student

        setGuardians(guardianArray);
      } catch (err) {
        console.error("Unexpected error:", err);
        setError("An unexpected error occurred. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    if (!orgLoading) {
      fetchData();

      // Set up real-time subscription to listen for changes to guardians and student_guardians tables
      const channel = supabase
        .channel("guardians-changes")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "guardians",
          },
          () => {
            fetchData();
          }
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "student_guardians",
          },
          () => {
            fetchData();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [organizationId, isSuperAdmin, orgLoading]);

  // Close dropdowns when clicking outside and update positions on scroll/resize
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      // Check if click is outside any guardian dropdown button or dropdown content
      const clickedDropdown = target.closest(".guardian-dropdown");
      const clickedDropdownContent = target.closest(`[data-dropdown-id]`);
      if (!clickedDropdown && !clickedDropdownContent) {
        setOpenDropdowns(new Set());
        setDropdownPositions(new Map());
      }
    };

    const updatePositions = () => {
      setDropdownPositions((prev) => {
        const newPos = new Map();
        prev.forEach((pos, guardianId) => {
          const button = buttonRefs.current.get(guardianId);
          if (button) {
            const rect = button.getBoundingClientRect();
            // Position at button bottom, then use negative margin to eliminate gap
            newPos.set(guardianId, {
              top: rect.bottom + window.scrollY,
              left: rect.left + window.scrollX,
            });
          }
        });
        return newPos;
      });
    };

    if (openDropdowns.size > 0) {
      document.addEventListener("mousedown", handleClickOutside);
      window.addEventListener("scroll", updatePositions, true);
      window.addEventListener("resize", updatePositions);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
        window.removeEventListener("scroll", updatePositions, true);
        window.removeEventListener("resize", updatePositions);
      };
    }
  }, [openDropdowns]);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Guardians</h1>
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Guardians</h1>
        <Card>
          <CardContent className="py-8 text-center">
            <div className="text-destructive mb-2">Error</div>
            <div className="text-sm text-muted-foreground">{error}</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Guardians</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Guardian information linked to student records
          </p>
        </div>
      </div>

      {guardians.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="text-muted-foreground mb-2">No guardians available yet</div>
            <div className="text-sm text-muted-foreground">
              Guardian information will appear here after it is added to student records.
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="px-4 py-3 text-left text-sm font-medium">
                    Guardian Name
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium">
                    Relationship
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium">
                    Email
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium">
                    Phone
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium">
                    Students
                  </th>
                </tr>
              </thead>
              <tbody>
                {guardians.map((guardian) => {
                  const isOpen = openDropdowns.has(guardian.id);
                  const studentCount = guardian.students.length;
                  const position = dropdownPositions.get(guardian.id);
                  
                  return (
                    <tr key={guardian.id} className="border-b hover:bg-muted/50">
                      <td className="px-4 py-3 text-sm font-medium">
                        {guardian.guardian_name || <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {guardian.relationship_label || <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {guardian.guardian_email || <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {guardian.guardian_phone || <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="guardian-dropdown">
                          <Button
                            ref={(el) => {
                              if (el) buttonRefs.current.set(guardian.id, el);
                            }}
                            variant="outline"
                            size="sm"
                            onClick={(e) => toggleDropdown(guardian.id, e)}
                            className="gap-2"
                          >
                            <span>
                              {studentCount} {studentCount === 1 ? "Student" : "Students"}
                            </span>
                            <ChevronDown 
                              className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
                            />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          
          {/* Render dropdowns in portal to avoid clipping */}
          {typeof window !== "undefined" &&
            guardians.map((guardian) => {
              const isOpen = openDropdowns.has(guardian.id);
              const position = dropdownPositions.get(guardian.id);
              if (!isOpen || !position) return null;
              
              return createPortal(
                <div
                  key={`dropdown-${guardian.id}`}
                  data-dropdown-id={guardian.id}
                  className="fixed z-[9999] min-w-[280px] rounded-md border bg-popover shadow-lg"
                  style={{
                    top: `${position.top}px`,
                    left: `${position.left}px`,
                    marginTop: '-40px',
                    borderTop: 'none',
                    borderTopLeftRadius: '0',
                    borderTopRightRadius: '0',
                  }}
                >
                  <div className="p-1 max-h-[400px] overflow-y-auto">
                    {guardian.students.map((student, index) => (
                      <div
                        key={student.id}
                        className={`rounded-sm px-3 py-2 hover:bg-accent ${
                          index !== guardian.students.length - 1 ? "mb-1" : ""
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm">{student.name}</div>
                            {student.email && (
                              <div className="text-xs text-muted-foreground truncate">
                                {student.email}
                              </div>
                            )}
                            {student.relationship_label && (
                              <div className="text-xs text-muted-foreground mt-0.5">
                                {student.relationship_label}
                              </div>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              router.push(`/sis/students/${student.id}?tab=guardians`);
                              setOpenDropdowns(new Set());
                              setDropdownPositions(new Map());
                            }}
                            className="gap-1 h-7 px-2 flex-shrink-0"
                          >
                            <ExternalLink className="size-3" />
                            View
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>,
                document.body
              );
            })}
        </>
      )}
    </div>
  );
}
