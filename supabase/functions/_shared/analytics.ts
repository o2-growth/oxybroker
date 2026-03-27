// deno-lint-ignore-file no-explicit-any

export interface AnalyticsEvent {
  event_type: "page_view" | "ui_action" | "api_call" | "domain_event";
  event_name: string;
  user_id?: string | null;
  role?: string | null;
  route?: string;
  session_id?: string;
  request_id?: string;
  entity_type?: string;
  entity_id?: string;
  status?: string;
  duration_ms?: number;
  metadata?: Record<string, unknown>;
}

// PII keys to sanitize
const PII_KEYS = ["email", "name", "full_name", "phone", "address", "cpf", "password"];

function sanitizeMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  if (!metadata || typeof metadata !== "object") return {};
  
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    const lowerKey = key.toLowerCase();
    if (PII_KEYS.some(pii => lowerKey.includes(pii))) continue;
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      sanitized[key] = sanitizeMetadata(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

export async function logAnalyticsEvent(
  supabaseAdmin: any,
  event: AnalyticsEvent
): Promise<void> {
  try {
    const sanitizedMetadata = event.metadata ? sanitizeMetadata(event.metadata) : {};
    
    await supabaseAdmin.from("analytics_events").insert({
      event_type: event.event_type,
      event_name: event.event_name,
      user_id: event.user_id,
      role: event.role,
      route: event.route,
      session_id: event.session_id || "backend",
      request_id: event.request_id,
      entity_type: event.entity_type,
      entity_id: event.entity_id,
      status: event.status,
      duration_ms: event.duration_ms,
      metadata: sanitizedMetadata,
    });
  } catch (err) {
    // Log but don't fail - analytics should never break main flow
    console.warn("Failed to log analytics event:", err);
  }
}

// Get amount bucket for privacy (avoid exact amounts in analytics)
export function getAmountBucket(amount: number): string {
  if (amount < 100) return "0-100";
  if (amount < 500) return "100-500";
  if (amount < 1000) return "500-1000";
  if (amount < 5000) return "1000-5000";
  return "5000+";
}
