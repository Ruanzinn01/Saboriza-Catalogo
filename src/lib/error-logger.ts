import { supabaseUntyped } from "@/lib/supabase-untyped";
import { resolveCurrentCompanyId } from "@/lib/current-company";

let installed = false;

function logError(message: string, stack: string | null, severity: "ERROR" | "WARNING" = "ERROR") {
  void resolveCurrentCompanyId().then((companyId) => {
    if (!companyId) return;
    void supabaseUntyped.from("client_errors").insert({
      company_id: companyId,
      message: message.slice(0, 2000),
      stack: stack?.slice(0, 8000) ?? null,
      url: window.location.href,
      user_agent: navigator.userAgent,
      severity,
    });
  });
}

export function reportError(error: unknown, context?: string) {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? (error.stack ?? null) : null;
  logError(context ? `${context}: ${message}` : message, stack);
}

export function installGlobalErrorLogging() {
  if (installed) return;
  installed = true;

  window.addEventListener("error", (event) => {
    logError(event.message, event.error?.stack ?? null);
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    const message = reason instanceof Error ? reason.message : String(reason);
    const stack = reason instanceof Error ? (reason.stack ?? null) : null;
    logError(`Promise rejeitada: ${message}`, stack);
  });
}
