"use client";

/**
 * useAuth – single hook for all auth operations.
 *
 * Encapsulates the full SIWE flow:
 *   1. Request MetaMask accounts  (eth_requestAccounts)
 *   2. Fetch nonce from backend   (POST /auth/nonce)
 *   3. Build & sign SIWE message  (personal_sign via ethers signer)
 *   4. Verify signature on server (POST /auth/verify)  → JWT
 *   5. Fetch session              (GET  /auth/session)  → user object
 *   6. Commit everything to store (signIn)
 *
 * On page refresh, AuthHydrate calls restoreSession() which:
 *   - reads the JWT from localStorage
 *   - validates it against GET /auth/session
 *   - re-populates address + user without requiring re-signing
 */

import { useCallback } from "react";
import { BrowserProvider } from "ethers";
import { SiweMessage } from "siwe";
import { api } from "@/lib/api";
import { useWalletStore } from "@/lib/store";

const EXPECTED_CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID || 31337);

export function useAuth() {
  const { status, error, address, token, user, setStatus, setError, signIn, disconnect } =
    useWalletStore();

  // ── connect + sign-in ─────────────────────────────────────────────────────

  const connect = useCallback(async () => {
    if (typeof window === "undefined" || !window.ethereum) {
      setError("No Web3 wallet detected. Please install MetaMask.");
      return;
    }

    try {
      // 1. Request accounts
      setStatus("connecting");
      const provider = new BrowserProvider(window.ethereum);
      await provider.send("eth_requestAccounts", []);

      const network = await provider.getNetwork();
      const chainId = Number(network.chainId);
      const signer = await provider.getSigner();
      const addr = await signer.getAddress();

      // Optional: warn on wrong network (don't hard-block — server validates)
      if (EXPECTED_CHAIN_ID !== 31337 && chainId !== EXPECTED_CHAIN_ID) {
        console.warn(
          `Connected to chain ${chainId}, expected ${EXPECTED_CHAIN_ID}. ` +
          "Some features may not work correctly."
        );
      }

      // 2. Get nonce
      const { nonce } = await api("/auth/nonce", {
        method: "POST",
        body: JSON.stringify({ walletAddress: addr }),
      });

      // 3. Build & sign SIWE message
      setStatus("signing");
      const siweMessage = new SiweMessage({
        domain: window.location.host,
        address: addr,
        statement: "Sign in to NFT Airdrop Platform",
        uri: window.location.origin,
        version: "1",
        chainId,
        nonce,
      });

      const prepared = siweMessage.prepareMessage();
      let signature;
      try {
        signature = await signer.signMessage(prepared);
      } catch (signErr) {
        // User rejected the signature prompt
        if (signErr.code === 4001 || signErr.code === "ACTION_REJECTED") {
          setError("Signature request was cancelled.");
        } else {
          setError("Failed to sign message: " + (signErr.message ?? "unknown error"));
        }
        setStatus("idle");
        return;
      }

      // 4. Verify on server → receive JWT
      const { token: jwt } = await api("/auth/verify", {
        method: "POST",
        body: JSON.stringify({ message: prepared, signature }),
      });

      // 5. Fetch session to get the full user object
      const sessionUser = await fetchSession(jwt);

      // 6. Commit to store (also persists JWT to localStorage)
      signIn({ address: addr, chainId, token: jwt, user: sessionUser });
    } catch (err) {
      const msg =
        err?.data?.error ||   // shaped API error
        err?.message ||
        "Authentication failed";
      setError(msg);
    }
  }, [setStatus, setError, signIn]);

  // ── sign-out ──────────────────────────────────────────────────────────────

  const logout = useCallback(async () => {
    // Fire-and-forget: invalidate server session if we have a token
    if (token) {
      api("/auth/logout", { method: "POST" }).catch(() => {});
    }
    disconnect();
  }, [token, disconnect]);

  // ── restore session on page refresh ──────────────────────────────────────

  const restoreSession = useCallback(async () => {
    if (typeof window === "undefined") return;

    const storedJwt = localStorage.getItem("jwt");
    if (!storedJwt) return;

    try {
      setStatus("connecting");

      // Validate the JWT is still good + get wallet address from server
      const session = await fetchSession(storedJwt);
      if (!session) throw new Error("Session expired");

      // Re-derive address from MetaMask if already connected (no re-sign)
      let addr = null;
      let chainId = null;
      if (window.ethereum) {
        try {
          const provider = new BrowserProvider(window.ethereum);
          const accounts = await provider.send("eth_accounts", []); // non-prompting
          if (accounts.length > 0) {
            const signer = await provider.getSigner();
            addr = await signer.getAddress();
            const network = await provider.getNetwork();
            chainId = Number(network.chainId);
          }
        } catch {
          // MetaMask not unlocked — fall back to server wallet
        }
      }

      // If MetaMask isn't unlocked, use the wallet address from the session
      if (!addr) addr = session.wallet;

      signIn({ address: addr, chainId, token: storedJwt, user: session });
    } catch {
      // JWT is expired / invalid — clear it silently
      localStorage.removeItem("jwt");
      disconnect();
    }
  }, [setStatus, signIn, disconnect]);

  return {
    // State
    address,
    token,
    user,
    status,
    error,
    isAuthenticated: !!(token && address),
    isLoading: status === "connecting" || status === "signing",

    // Actions
    connect,
    logout,
    restoreSession,
  };
}

// ── Internal helper ──────────────────────────────────────────────────────────

/**
 * Calls GET /auth/session with the given JWT and returns the user object.
 * Throws if the token is invalid or expired (server returns 401).
 */
async function fetchSession(jwt) {
  const data = await api("/auth/session", {
    headers: { Authorization: `Bearer ${jwt}` },
  });
  // data = { id, wallet, email, settings }
  return data;
}
