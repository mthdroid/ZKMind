/**
 * Wallet connection using Freighter (Stellar browser wallet).
 *
 * Uses @stellar/freighter-api v6 package.
 */

import * as StellarSdk from '@stellar/stellar-sdk';
import {
  isConnected as freighterIsConnected,
  requestAccess,
  getAddress,
  signTransaction as freighterSignTx,
} from '@stellar/freighter-api';
import { NETWORK_PASSPHRASE } from './contracts';

export async function isFreighterInstalled(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  try {
    const result = await freighterIsConnected();
    return result.isConnected;
  } catch {
    return false;
  }
}

export async function connectWallet(): Promise<string> {
  const installed = await isFreighterInstalled();
  if (!installed) {
    throw new Error('Freighter wallet not installed. Get it at freighter.app');
  }

  const result = await requestAccess();
  if (result.error) {
    throw new Error(`Freighter access denied: ${result.error}`);
  }

  return result.address;
}

export async function getPublicKey(): Promise<string | null> {
  const installed = await isFreighterInstalled();
  if (!installed) return null;
  try {
    const result = await getAddress();
    if (result.error) return null;
    return result.address;
  } catch {
    return null;
  }
}

export async function signTransaction(tx: StellarSdk.Transaction): Promise<StellarSdk.Transaction> {
  const installed = await isFreighterInstalled();
  if (!installed) {
    throw new Error('Freighter wallet not installed');
  }

  const xdr = tx.toXDR();
  const result = await freighterSignTx(xdr, {
    networkPassphrase: NETWORK_PASSPHRASE,
  });

  if (result.error) {
    throw new Error(`Freighter sign failed: ${result.error}`);
  }

  return StellarSdk.TransactionBuilder.fromXDR(
    result.signedTxXdr,
    NETWORK_PASSPHRASE,
  ) as StellarSdk.Transaction;
}
