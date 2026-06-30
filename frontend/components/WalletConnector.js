"use client";

/**
 * WalletConnector – Nav button that drives the full SIWE sign-in flow.
 *
 * States handled:
 *  idle          → "Connect Wallet" button
 *  connecting    → spinner (requesting MetaMask accounts)
 *  signing       → spinner (waiting for user to sign SIWE message)
 *  authenticated → address chip + Disconnect button
 *  error         → error pill + retry button
 */

import { useAuth } from "@/lib/useAuth";
import { selectShortAddress, useWalletStore } from "@/lib/store";

export function WalletConnector() {
  const { connect, logout, isLoading, status } = useAuth();
  const shortAddress = useWalletStore(selectShortAddress);
  const error = useWalletStore((s) => s.error);

  // ── authenticated ─────────────────────────────────────────────────────────
  if (status === "authenticated") {
    return (
      <div className="flex items-center gap-3 group">
        <div className="rounded-full bg-gradient-to-r from-brand-500/10 to-blue-500/10 px-3 py-1 border border-brand-500/30 group-hover:border-brand-500/60 transition-all">
          <span className="text-xs text-brand-200 font-medium">{shortAddress}</span>
        </div>
        <button type="button" className="btn-ghost text-sm" onClick={logout}>
          Disconnect
        </button>
      </div>
    );
  }

  // ── loading (connecting or waiting for signature) ─────────────────────────
  if (isLoading) {
    const label = status === "signing" ? "Sign message…" : "Connecting…";
    return (
      <button type="button" disabled className="btn-primary text-sm opacity-75 cursor-not-allowed flex items-center gap-2">
        <Spinner />
        {label}
      </button>
    );
  }

  // ── error state ───────────────────────────────────────────────────────────
  if (status === "error") {
    return (
      <div className="flex items-center gap-2">
        <span
          title={error ?? undefined}
          className="max-w-[160px] truncate text-xs text-red-400 border border-red-500/30 rounded-full px-3 py-1"
        >
          {error ?? "Error"}
        </span>
        <button type="button" className="btn-ghost text-sm text-red-400 hover:text-red-300" onClick={connect}>
          Retry
        </button>
      </div>
    );
  }

  // ── idle – default ────────────────────────────────────────────────────────
  return (
    <button
      type="button"
      className="btn-primary text-sm group relative overflow-hidden"
      onClick={connect}
    >
      {/* Animated gradient background */}
      <div className="absolute inset-0 bg-gradient-to-r from-brand-500 via-blue-400 to-brand-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300 animate-slide-in" />
      <span className="relative z-10 flex items-center gap-2">
        <span className="inline-block w-2 h-2 bg-white rounded-full group-hover:animate-pulse" />
        Connect Wallet
      </span>
    </button>
  );
}

// ── tiny inline spinner ────────────────────────────────────────────────────
function Spinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}
