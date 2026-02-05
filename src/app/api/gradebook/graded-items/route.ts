import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { listGradedItems } from "@/lib/gradebook";
import { logError } from "@/lib/logger";

async function verifyAccess(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) {
    return { user: null, profile: null, error: "Unauthorized" };
  }

  const token = authHeader.replace("Bearer ", "");
  if (!token) {
    return { user: null, profile: null, error: "Unauthorized" };
  }

  const { data: { user }, error: authError } = await supabaseServer.auth.getUser(token);

  if (authError || !user) {
    return { user: null, profile: null, error: "Unauthorized" };
  }

  const { data: profile, error: profileError } = await supabaseServer
    .from("profiles")
    .select("role, organization_id")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return { user: null, profile: null, error: "User profile not found" };
  }

  return { user, profile, error: null };
}

/**
 * GET /api/gradebook/graded-items
 * List graded items with filters
 */
export async function GET(request: NextRequest) {
  try {
    const { user, profile, error: authError } = await verifyAccess(request);
    if (authError || !user || !profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const sectionId = searchParams.get("section_id");
    const termPeriod = searchParams.get("term_period");
    const componentId = searchParams.get("component_id");

    if (!sectionId) {
      return NextResponse.json(
        { error: "Missing required parameter: section_id" },
        { status: 400 }
      );
    }

    const items = await listGradedItems({
      section_id: sectionId,
      term_period: termPeriod || undefined,
      component_id: componentId || undefined,
    });

    return NextResponse.json({ items });
  } catch (error: any) {
    logError("gradebook_graded_items_list", error, { message: error.message });
    return NextResponse.json(
      { error: error.message || "Failed to list graded items" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/gradebook/graded-items
 * Create graded item
 */
export async function POST(request: NextRequest) {
  try {
    const { user, profile, error: authError } = await verifyAccess(request);
    if (authError || !user || !profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only admin/registrar/teacher can create items
    if (!["admin", "principal", "registrar", "teacher", "mentor"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const {
      section_id, // Legacy support
      section_subject_offering_id, // Preferred for new workflows
      school_year_id,
      term_period,
      component_id,
      title,
      description,
      max_points,
      due_at,
      school_id,
    } = body;

    // Require at least one of section_id or section_subject_offering_id
    if (!section_subject_offering_id && !section_id) {
      return NextResponse.json(
        {
          error: "Missing required field: section_id OR section_subject_offering_id",
        },
        { status: 400 }
      );
    }

    if (!school_year_id || !term_period || !component_id || !title || !max_points) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: school_year_id, term_period, component_id, title, max_points",
        },
        { status: 400 }
      );
    }

    // Verify teacher has access to section or offering (RLS will enforce, but check here too)
    if (profile.role === "teacher" || profile.role === "mentor") {
      // Initialize debug info early
      let debugInfo: any = {
        user_id: user.id,
        user_email: (user as any).email || "not available",
        profile_role: profile.role,
        section_id: section_id || null,
        section_subject_offering_id: section_subject_offering_id || null,
      };

      // First, find the staff record for this user
      const { data: staffRecord, error: staffError } = await supabaseServer
        .from("staff")
        .select("id, user_id")
        .eq("user_id", user.id)
        .single();

      debugInfo.staff_check = {
        error: staffError?.message,
        found: !!staffRecord,
        staff_id: staffRecord?.id,
      };

      if (staffError || !staffRecord) {
        console.error("Staff record check failed:", JSON.stringify(debugInfo, null, 2));
        return NextResponse.json(
          {
            error: "Staff record not found for this user. Please ensure you have a staff record.",
            debug: debugInfo,
          },
          { status: 403 }
        );
      }

      let hasAccess = false;
      const today = new Date().toISOString().split("T")[0];
      debugInfo.staff_id = staffRecord.id;
      debugInfo.today = today;

      // Check offering assignment first (preferred for new workflows)
      if (section_subject_offering_id) {
        const { data: subjectTeachers, error: subjectError } = await supabaseServer
          .from("section_subject_teachers")
          .select("id, end_date, section_subject_offering_id")
          .eq("section_subject_offering_id", section_subject_offering_id)
          .eq("staff_id", staffRecord.id)
          .is("archived_at", null);

        debugInfo.offering_check = {
          checked: true,
          error: subjectError?.message || null,
          found: subjectTeachers?.length || 0,
          assignments: subjectTeachers || [],
          active_assignments: 0,
        };

        if (subjectError) {
          console.error("Error checking section_subject_teachers:", subjectError);
        }

        if (!subjectError && subjectTeachers && subjectTeachers.length > 0) {
          // Filter in JavaScript: end_date IS NULL OR end_date >= CURRENT_DATE
          const activeAssignments = subjectTeachers.filter(
            (st: any) => !st.end_date || st.end_date >= today
          );
          debugInfo.offering_check.active_assignments = activeAssignments.length;
          if (activeAssignments.length > 0) {
            hasAccess = true;
          }
        }
      } else {
        debugInfo.offering_check = {
          checked: false,
          reason: "section_subject_offering_id not provided",
        };
      }

      // Fallback to section assignment (legacy) - only if offering check didn't find access
      // This allows teachers assigned to the section (homeroom) OR any subject offering in that section
      if (!hasAccess && section_id) {
        // First check direct section assignment (homeroom)
        const { data: sectionTeachers, error: sectionError } = await supabaseServer
          .from("section_teachers")
          .select("id, end_date, section_id")
          .eq("section_id", section_id)
          .eq("staff_id", staffRecord.id)
          .is("archived_at", null);

        debugInfo.section_check = {
          checked: true,
          error: sectionError?.message || null,
          found: sectionTeachers?.length || 0,
          assignments: sectionTeachers || [],
          active_assignments: 0,
        };

        if (sectionError) {
          console.error("Error checking section_teachers:", sectionError);
        }

        if (!sectionError && sectionTeachers && sectionTeachers.length > 0) {
          // Filter in JavaScript: end_date IS NULL OR end_date >= CURRENT_DATE
          const activeAssignments = sectionTeachers.filter(
            (st: any) => !st.end_date || st.end_date >= today
          );
          debugInfo.section_check.active_assignments = activeAssignments.length;
          if (activeAssignments.length > 0) {
            hasAccess = true;
          }
        }

        // If still no access, check if teacher is assigned to ANY subject offering in this section
        if (!hasAccess) {
          const { data: subjectOfferings, error: offeringsError } = await supabaseServer
            .from("section_subject_teachers")
            .select(`
              id,
              end_date,
              section_subject_offering_id,
              offering:section_subject_offerings!inner(section_id)
            `)
            .eq("staff_id", staffRecord.id)
            .is("archived_at", null);

          if (!offeringsError && subjectOfferings && subjectOfferings.length > 0) {
            // Filter to only offerings in this section
            const sectionOfferings = subjectOfferings.filter((sst: any) => {
              const offering = sst.offering as any;
              return offering?.section_id === section_id;
            });

            debugInfo.section_check.offering_assignments_found = sectionOfferings.length;

            if (sectionOfferings.length > 0) {
              // Check if any are active
              const activeOfferings = sectionOfferings.filter(
                (sst: any) => !sst.end_date || sst.end_date >= today
              );
              debugInfo.section_check.active_offering_assignments = activeOfferings.length;
              if (activeOfferings.length > 0) {
                hasAccess = true;
              }
            }
          } else {
            debugInfo.section_check.offering_assignments_found = 0;
          }
        }
      } else if (!section_id) {
        debugInfo.section_check = {
          checked: false,
          reason: "section_id not provided",
        };
      } else {
        debugInfo.section_check = {
          checked: false,
          reason: "skipped - offering check already granted access",
        };
      }

      if (!hasAccess) {
        // Ensure debugInfo is fully populated
        debugInfo.hasAccess = false;
        debugInfo.final_check = {
          offering_checked: !!section_subject_offering_id,
          section_checked: !!section_id,
          offering_granted_access: debugInfo.offering_check?.active_assignments > 0,
          section_granted_access: debugInfo.section_check?.active_assignments > 0,
        };
        
        // Log debug info for troubleshooting
        console.error("Access denied for teacher:", JSON.stringify(debugInfo, null, 2));
        
        // Provide more detailed error message
        const errorDetails: string[] = [];
        if (section_subject_offering_id) {
          errorDetails.push(`offering ${section_subject_offering_id}`);
        }
        if (section_id) {
          errorDetails.push(`section ${section_id}`);
        }
        
        // Return response with debug info
        const response = {
          error: `You do not have access to this ${errorDetails.join(" or ")}. Please ensure you are assigned as a teacher for this offering or section.`,
          debug: debugInfo,
        };
        
        console.error("Returning 403 response:", JSON.stringify(response, null, 2));
        
        return NextResponse.json(response, { status: 403 });
      }
    }

    // Insert using PostgreSQL function that bypasses RLS
    // We've already verified authorization above, so we can safely bypass RLS
    console.log("Calling insert_graded_item RPC function with params:", {
      p_organization_id: profile.organization_id,
      p_school_id: school_id || null,
      p_section_id: section_id || null,
      p_section_subject_offering_id: section_subject_offering_id || null,
      p_school_year_id: school_year_id,
      p_term_period: term_period,
      p_component_id: component_id,
      p_title: title,
      p_max_points: parseFloat(max_points),
    });

    const { data: itemData, error: rpcError } = await supabaseServer.rpc("insert_graded_item", {
      p_organization_id: profile.organization_id,
      p_school_id: school_id || null,
      p_section_id: section_id || null,
      p_section_subject_offering_id: section_subject_offering_id || null,
      p_school_year_id: school_year_id,
      p_term_period: term_period,
      p_component_id: component_id,
      p_title: title,
      p_description: description || null,
      p_max_points: parseFloat(max_points),
      p_due_at: due_at || null,
      p_created_by: user.id,
    });

    if (rpcError) {
      console.error("RPC Error details:", {
        message: rpcError.message,
        details: rpcError.details,
        hint: rpcError.hint,
        code: rpcError.code,
      });
      
      // If function doesn't exist, fall back to direct insert
      if (rpcError.message?.includes("function") && rpcError.message?.includes("does not exist")) {
        console.warn("insert_graded_item function not found, falling back to direct insert");
        const { data: item, error: insertError } = await supabaseServer
          .from("gradebook_graded_items")
          .insert([
            {
              organization_id: profile.organization_id,
              school_id: school_id || null,
              section_id: section_id || null,
              section_subject_offering_id: section_subject_offering_id || null,
              school_year_id,
              term_period,
              component_id,
              title,
              description: description || null,
              max_points: parseFloat(max_points),
              due_at: due_at || null,
              created_by: user.id,
            },
          ])
          .select(`
            *,
            component:gradebook_components(*)
          `)
          .single();

        if (insertError) {
          console.error("Direct insert also failed:", insertError);
          throw new Error(`Failed to create graded item: ${insertError.message}`);
        }
        console.log("Direct insert succeeded, item created:", item?.id);
        return NextResponse.json({ item });
      }
      throw new Error(`Failed to create graded item: ${rpcError.message}`);
    }

    console.log("RPC function call succeeded. Response data:", {
      itemData,
      itemDataLength: itemData?.length,
      itemDataType: typeof itemData,
    });

    if (!itemData || itemData.length === 0) {
      console.error("Function returned no data. itemData:", itemData);
      throw new Error("Failed to create graded item: function returned no data");
    }

    const itemRow = itemData[0];
    console.log("Extracted item row:", itemRow);

    // Fetch component separately since function doesn't return relations
    const { data: component, error: componentError } = await supabaseServer
      .from("gradebook_components")
      .select("*")
      .eq("id", component_id)
      .single();

    if (componentError) {
      console.warn("Failed to fetch component:", componentError);
    }

    const item = {
      ...itemRow,
      component: component || null,
    };

    console.log("Returning created item:", item?.id);
    return NextResponse.json({ item });
  } catch (error: any) {
    logError("gradebook_graded_items_create", error, { message: error.message });
    // Include debug info if available in error
    const debugInfo = (error as any).debug || {};
    return NextResponse.json(
      { 
        error: error.message || "Failed to create graded item",
        debug: debugInfo,
      },
      { status: 500 }
    );
  }
}
