import { create } from "zustand";

/**
 * Global wallet + auth store.
 *
 * Shape
 * ─────
 *  address   – checksummed wallet address, or null
 *  chainId   – numeric chain id, or null
 *  token     – raw JWT string, or null
 *  user      – { id, wallet } returned by /auth/session, or null
 *  status    – "idle" | "connecting" | "signing" | "authenticated" | "error"
 *  error     – last error message, or null
 *
 * Derived helpers (exported selectors)
 * ─────────────────────────────────────
 *  isAuthenticated(state) – true when both token AND address are present
 */

export const useWalletStore = create((set) => ({
  address: null,
  chainId: null,
  token: null,
  user: null,
  status: "idle",   // idle | connecting | signing | authenticated | error
  error: null,

  // ── setters ────────────────────────────────────────────────────────────────

  setWallet: (address, chainId) =>
    set({ address, chainId, error: null }),

  setToken: (token) =>
    set({ token, error: null }),

  setUser: (user) =>
    set({ user }),

  setStatus: (status) =>
    set({ status }),

  setError: (error) =>
    set({ error, status: "error" }),

  // ── full sign-in commit (called after SIWE verify succeeds) ───────────────

  signIn: ({ address, chainId, token, user }) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("jwt", token);
    }
    set({ address, chainId, token, user, status: "authenticated", error: null });
  },

  // ── disconnect / sign-out ─────────────────────────────────────────────────

  disconnect: () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("jwt");
    }
    set({
      address: null,
      chainId: null,
      token: null,
      user: null,
      status: "idle",
      error: null,
    });
  },
}));

// ── Selector helpers (avoids re-render when unrelated state changes) ────────

/** Returns true only when the user has a valid JWT AND a connected address. */
export const selectIsAuthenticated = (s) => !!(s.token && s.address);

/** Returns a short display string for the address (0x1234…abcd). */
export const selectShortAddress = (s) =>
  s.address ? `${s.address.slice(0, 6)}…${s.address.slice(-4)}` : null;
