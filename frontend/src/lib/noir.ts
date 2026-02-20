/**
 * ZK Proof generation using Noir + Barretenberg (UltraHonk).
 *
 * Generates proofs in the browser that the CodeMaker's feedback is honest,
 * without revealing the secret code.
 *
 * Stack: @noir-lang/noir_js v1.0.0-beta.9 + @aztec/bb.js v0.87.0
 */

import { Noir } from '@noir-lang/noir_js';
import { UltraHonkBackend } from '@aztec/bb.js';
import { sha256 } from '@noble/hashes/sha2.js';

// Cached instances to avoid re-initialization
let cachedCircuit: any = null;
let cachedNoir: Noir | null = null;
let cachedBackend: UltraHonkBackend | null = null;

export interface ProofResult {
  proof: Uint8Array;
  publicInputs: string[];
  proofHash: string; // sha256 of proof bytes (stored on-chain)
  isValid: boolean;
}

/**
 * Load the compiled Noir circuit.
 */
async function loadCircuit() {
  if (cachedCircuit) return cachedCircuit;
  const response = await fetch('/circuits/mastermind.json');
  if (!response.ok) throw new Error('Failed to load circuit');
  cachedCircuit = await response.json();
  return cachedCircuit;
}

/**
 * Initialize Noir and UltraHonk backend.
 */
async function initBackend() {
  const circuit = await loadCircuit();

  if (!cachedNoir) {
    cachedNoir = new Noir(circuit);
  }

  if (!cachedBackend) {
    cachedBackend = new UltraHonkBackend(circuit.bytecode, { threads: 1 });
  }

  return { noir: cachedNoir, backend: cachedBackend };
}

/**
 * Generate a ZK proof that the feedback (correct_position, correct_color)
 * is honest for the given secret_code, commitment, and guess.
 *
 * @param secretCode - The secret code (4 values, 0-5) - PRIVATE input
 * @param commitment - The pedersen_hash commitment (hex) - PUBLIC input
 * @param guess - The guess (4 values, 0-5) - PUBLIC input
 * @param correctPosition - Red pegs count - PUBLIC input
 * @param correctColor - White pegs count - PUBLIC input
 */
export async function generateProof(
  secretCode: number[],
  commitment: string,
  guess: number[],
  correctPosition: number,
  correctColor: number,
): Promise<ProofResult> {
  const { noir, backend } = await initBackend();

  // Prepare circuit inputs matching circuits/src/main.nr
  const inputs = {
    secret_code: secretCode.map(String),
    commitment: commitment.startsWith('0x') ? commitment : `0x${commitment}`,
    guess: guess.map(String),
    correct_position: String(correctPosition),
    correct_color: String(correctColor),
  };

  // Generate witness
  const { witness } = await noir.execute(inputs);

  // Generate UltraHonk proof with keccak oracle hash (for on-chain compatibility)
  const proofData = await backend.generateProof(witness, { keccak: true });

  // Verify locally
  let isValid = false;
  try {
    isValid = await backend.verifyProof(proofData, { keccak: true });
  } catch {
    // Verification might fail in some browser environments
    console.warn('Local proof verification skipped');
  }

  // Compute proof hash for on-chain storage
  const proofHash = Buffer.from(sha256(proofData.proof)).toString('hex');

  return {
    proof: proofData.proof,
    publicInputs: proofData.publicInputs,
    proofHash,
    isValid,
  };
}

/**
 * Clean up WASM resources.
 */
export async function destroyBackend() {
  if (cachedBackend) {
    await cachedBackend.destroy();
    cachedBackend = null;
  }
  cachedNoir = null;
}
