/**
 * Audit Logging Helper
 * Creates audit_events records for all create/update/delete operations
 */

import { supabase } from "@/lib/supabase/client";

export interface AuditLogPayload {
  organization_id: string;
  school_id?: string | null;
  actor_id: string;
  action: "create" | "update" | "delete";
  entity_type: string;
  entity_id: string;
  before?: Record<string, any> | null;
  after?: Record<string, any> | null;
  event_data?: Record<string, any>;
}

/**
 * Create an audit log entry
 */
export async function createAuditLog(payload: AuditLogPayload): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    throw new Error("No active session");
  }

  // Map action to event_type and event_category
  const eventType = `${payload.entity_type}_${payload.action}`;
  const eventCategory = payload.entity_type;

  const { error } = await supabase.from("audit_events").insert({
    organization_id: payload.organization_id,
    school_id: payload.school_id || null,
    event_type: eventType,
    event_category: eventCategory,
    actor_id: payload.actor_id,
    target_entity_type: payload.entity_type,
    target_entity_id: payload.entity_id,
    event_data: {
      action: payload.action,
      before: payload.before || null,
      after: payload.after || null,
      ...(payload.event_data || {}),
    },
  });

  if (error) {
    console.error("Failed to create audit log:", error);
    // Don't throw - audit logging should not break the main operation
    // but log the error for debugging
  }
}
