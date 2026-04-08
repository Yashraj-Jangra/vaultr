"use client";

import { useState } from 'react';
import { ethers } from 'ethers';
import { signInWithCustomToken } from 'firebase/auth';
import { auth } from '@/lib/firebase/client';

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> } & Record<string, unknown>;
  }
}

export const useWeb3Auth = () => {
  const [address, setAddress] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = async () => {
    setIsAuthenticating(true);
    setError(null);

    try {
      if (!window.ethereum) throw new Error("No Web3 wallet found. Please install MetaMask or similar.");

      await window.ethereum.request({ method: "eth_requestAccounts" });
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const userAddress = await signer.getAddress();

      // Standard SIWE Message format
      const message = `Sign in to _vaultr.\n\nAddress: ${userAddress}\nNonce: ${Date.now()}`;

      // Request signature from the wallet
      const signature = await signer.signMessage(message);

      // Verify and get Firebase Token
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: userAddress, signature, message }),
      });

      const data = await res.json();

      if (!res.ok) {
        // Expose backend error if any (e.g., config error)
        throw new Error(data.error || "Failed to verify signature.");
      }

      const { token } = data;

      if (!token) throw new Error("Authentication backend returned an invalid token.");

      // Log into Firebase utilizing the returned token
      await signInWithCustomToken(auth, token);
      setAddress(userAddress);

    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to authenticate");
    } finally {
      setIsAuthenticating(false);
    }
  };

  const logout = async () => {
    await auth.signOut();
    setAddress(null);
  };

  return { address, isAuthenticating, error, login, logout };
};
