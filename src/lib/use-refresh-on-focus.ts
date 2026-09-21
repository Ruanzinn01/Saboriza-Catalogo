import { useEffect, useRef } from "react";

export function useRefreshOnFocus(refresh: () => void, minIntervalMs = 15000) {
  const refreshRef = useRef(refresh);
  const lastRunRef = useRef(Date.now());

  useEffect(() => {
    refreshRef.current = refresh;
  });

  useEffect(() => {
    function run() {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastRunRef.current < minIntervalMs) return;
      lastRunRef.current = Date.now();
      refreshRef.current();
    }
    document.addEventListener("visibilitychange", run);
    window.addEventListener("focus", run);
    return () => {
      document.removeEventListener("visibilitychange", run);
      window.removeEventListener("focus", run);
    };
  }, [minIntervalMs]);
}
