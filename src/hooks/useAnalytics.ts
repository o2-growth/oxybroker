import { useEffect, useRef, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const SESSION_KEY = "analytics_session_id";

function getOrCreateSessionId(): string {
  let sessionId = localStorage.getItem(SESSION_KEY);
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, sessionId);
  }
  return sessionId;
}

interface LogEventParams {
  event_type: "page_view" | "ui_action" | "api_call" | "domain_event";
  event_name: string;
  route?: string;
  referrer?: string;
  entity_type?: string;
  entity_id?: string;
  status?: string;
  duration_ms?: number;
  metadata?: Record<string, unknown>;
  request_id?: string;
}

async function logEvent(params: LogEventParams): Promise<void> {
  try {
    const sessionId = getOrCreateSessionId();
    const { data: { session } } = await supabase.auth.getSession();
    
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    };

    if (session?.access_token) {
      headers["Authorization"] = `Bearer ${session.access_token}`;
    }

    // Fire and forget - don't block UI
    fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/log-event`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        ...params,
        session_id: sessionId,
      }),
    }).catch((err) => {
      console.warn("Analytics log failed:", err);
    });
  } catch (err) {
    console.warn("Analytics error:", err);
  }
}

export function useAnalytics() {
  const location = useLocation();
  const previousPath = useRef<string | null>(null);

  // Track page views on route change
  useEffect(() => {
    const currentPath = location.pathname;
    
    if (previousPath.current !== currentPath) {
      logEvent({
        event_type: "page_view",
        event_name: "page_view",
        route: currentPath,
        referrer: previousPath.current || document.referrer || undefined,
      });
      previousPath.current = currentPath;
    }
  }, [location.pathname]);

  // Track UI actions
  const trackAction = useCallback((
    name: string,
    metadata?: Record<string, unknown>,
    entityType?: string,
    entityId?: string
  ) => {
    logEvent({
      event_type: "ui_action",
      event_name: name,
      route: location.pathname,
      entity_type: entityType,
      entity_id: entityId,
      metadata,
    });
  }, [location.pathname]);

  // Track API calls with timing
  const trackApiCall = useCallback((
    fnName: string,
    status: "success" | "error",
    durationMs: number,
    metadata?: Record<string, unknown>,
    entityType?: string,
    entityId?: string
  ) => {
    logEvent({
      event_type: "api_call",
      event_name: fnName,
      route: location.pathname,
      status,
      duration_ms: durationMs,
      entity_type: entityType,
      entity_id: entityId,
      metadata,
    });
  }, [location.pathname]);

  // Track domain/business events
  const trackDomainEvent = useCallback((
    name: string,
    status: string,
    metadata?: Record<string, unknown>,
    entityType?: string,
    entityId?: string
  ) => {
    logEvent({
      event_type: "domain_event",
      event_name: name,
      route: location.pathname,
      status,
      entity_type: entityType,
      entity_id: entityId,
      metadata,
    });
  }, [location.pathname]);

  return {
    trackAction,
    trackApiCall,
    trackDomainEvent,
  };
}

// Standalone function for use outside React components (e.g., edge functions response handlers)
export { logEvent };
