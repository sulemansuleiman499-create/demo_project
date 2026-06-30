"use client";

/**
 * AuthHydrate – mounts once inside <Providers> and silently restores
 * an existing authenticated session from localStorage on page load/refresh.
 *
 * Flow:
 *   localStorage("jwt") exists
 *     → GET /auth/session (validates token server-side)
 *     → success: re-populate store (address, user, token)
 *     → 401:    clear stale JWT, store stays unauthenticated
 */

import { useEffect } from "react";
import { useAuth } from "@/lib/useAuth";

export function AuthHydrate() {
  const { restoreSession } = useAuth();

  useEffect(() => {
    restoreSession();
    // Run once on mount only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
