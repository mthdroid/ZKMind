/**
 * Wallet connection using Freighter (Stellar browser wallet).
 *
 * Freighter injects a global `window.freighterApi` object.
 * We detect it, request access, and provide sign helpers.
 */

import * as StellarSdk from '@stellar/stellar-sdk';
import { NETWORK_PASSPHRASE } from './contracts';

declare global {
  interface Window {
    freighterApi?: {
      isConnected: () => Promise<boolean>;
      getPublicKey: () => Promise<string>;
      signTransaction: (
        xdr: string,
        opts: { networkPassphrase: string }
      ) => Promise<string>;
      getNetwork: () => Promise<string>;
      requestAccess: () => Promise<{ error?: string }>;
    };
  }
}

export function isFreighterInstalled(): boolean {
  return typeof window !== 'undefined' && !!window.freighterApi;
}

export async function connectWallet(): Promise<string> {
  if (!isFreighterInstalled()) {
    throw new Error('Freighter wallet not installed. Get it at freighter.app');
  }

  const api = window.freighterApi!;
  const result = await api.requestAccess();
  if (result.error) {
    throw new Error(`Freighter access denied: ${result.error}`);
  }

  return api.getPublicKey();
}

export async function getPublicKey(): Promise<string | null> {
  if (!isFreighterInstalled()) return null;
  try {
    const connected = await window.freighterApi!.isConnected();
    if (!connected) return null;
    return window.freighterApi!.getPublicKey();
  } catch {
    return null;
  }
}

export async function signTransaction(tx: StellarSdk.Transaction): Promise<StellarSdk.Transaction> {
  if (!isFreighterInstalled()) {
    throw new Error('Freighter wallet not installed');
  }

  const xdr = tx.toXDR();
  const signedXdr = await window.freighterApi!.signTransaction(xdr, {
    networkPassphrase: NETWORK_PASSPHRASE,
  });

  return StellarSdk.TransactionBuilder.fromXDR(
    signedXdr,
    NETWORK_PASSPHRASE,
  ) as StellarSdk.Transaction;
}
