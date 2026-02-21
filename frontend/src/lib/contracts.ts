/**
 * Stellar contract interaction service for ZKMind.
 *
 * Deployed contracts (Testnet):
 *   ZKMind Game:  CAZNILASDETOWYYF3TX325FIOSRHVPH3VBLSEJ4C3EFCQ2KH25F7VWO3
 *   UltraHonk Verifier: CBLH3WI2FHCIUB62RYIJDOPAIDTXIGTLFGJ2GU6DTQJ5YGZSTB4XJAPG
 */

import * as StellarSdk from '@stellar/stellar-sdk';

export const NETWORK = 'testnet';
export const RPC_URL = 'https://soroban-testnet.stellar.org';
export const NETWORK_PASSPHRASE = StellarSdk.Networks.TESTNET;

export const ZKMIND_CONTRACT_ID = 'CAZNILASDETOWYYF3TX325FIOSRHVPH3VBLSEJ4C3EFCQ2KH25F7VWO3';
export const VERIFIER_CONTRACT_ID = 'CBLH3WI2FHCIUB62RYIJDOPAIDTXIGTLFGJ2GU6DTQJ5YGZSTB4XJAPG';

const rpc = new StellarSdk.rpc.Server(RPC_URL);

// Helper: convert hex string to Buffer
function hexToBytes(hex: string): Buffer {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  return Buffer.from(clean, 'hex');
}

// Helper: build a contract call transaction with retry for transient errors
async function buildContractTx(
  sourcePublicKey: string,
  contractId: string,
  method: string,
  args: StellarSdk.xdr.ScVal[],
  maxRetries = 1,
): Promise<StellarSdk.Transaction> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      // Wait for next ledger close (~5s on testnet) before retrying
      await new Promise(r => setTimeout(r, 4000));
    }

    const account = await rpc.getAccount(sourcePublicKey);
    const contract = new StellarSdk.Contract(contractId);

    const tx = new StellarSdk.TransactionBuilder(account, {
      fee: '1000000',
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(contract.call(method, ...args))
      .setTimeout(300)
      .build();

    // Simulate to get proper resource estimates
    const simulated = await rpc.simulateTransaction(tx);
    if (StellarSdk.rpc.Api.isSimulationError(simulated)) {
      const errMsg = typeof simulated.error === 'string'
        ? simulated.error
        : JSON.stringify(simulated.error);
      const events = 'events' in simulated && Array.isArray(simulated.events)
        ? simulated.events.map((e: unknown) => String(e)).join('; ')
        : '';
      lastError = new Error(
        `Simulation failed for ${method}: ${errMsg}${events ? ` | Events: ${events}` : ''}`
      );

      // Retry on contract errors (possible RPC state lag between ledgers)
      if (attempt < maxRetries && errMsg.includes('Error(Contract')) {
        console.warn(`[ZKMind] ${method} simulation failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying...`, errMsg);
        continue;
      }

      throw lastError;
    }

    return StellarSdk.rpc.assembleTransaction(tx, simulated).build();
  }

  throw lastError || new Error(`${method} failed after ${maxRetries + 1} attempts`);
}

// Helper: submit signed transaction and wait for result
async function submitTx(signedTx: StellarSdk.Transaction): Promise<StellarSdk.rpc.Api.GetSuccessfulTransactionResponse> {
  const result = await rpc.sendTransaction(signedTx);
  if (result.status === 'ERROR') {
    throw new Error(`Transaction send failed: ${result.errorResult?.toXDR('base64')}`);
  }

  // Poll for result
  let getResult = await rpc.getTransaction(result.hash);
  while (getResult.status === 'NOT_FOUND') {
    await new Promise(r => setTimeout(r, 2000));
    getResult = await rpc.getTransaction(result.hash);
  }

  if (getResult.status === 'FAILED') {
    throw new Error('Transaction failed on-chain');
  }

  return getResult as StellarSdk.rpc.Api.GetSuccessfulTransactionResponse;
}

// ============================================================================
// Contract Call Builders
// ============================================================================

/**
 * Build new_game transaction.
 */
export async function buildNewGame(
  sourcePublicKey: string,
  sessionId: number,
  codemaker: string,
  codebreaker: string,
): Promise<StellarSdk.Transaction> {
  return buildContractTx(sourcePublicKey, ZKMIND_CONTRACT_ID, 'new_game', [
    StellarSdk.nativeToScVal(sessionId, { type: 'u32' }),
    StellarSdk.nativeToScVal(codemaker, { type: 'address' }),
    StellarSdk.nativeToScVal(codebreaker, { type: 'address' }),
  ]);
}

/**
 * Build commit_code transaction.
 */
export async function buildCommitCode(
  sourcePublicKey: string,
  sessionId: number,
  codemaker: string,
  commitmentHex: string,
): Promise<StellarSdk.Transaction> {
  const commitBytes = hexToBytes(commitmentHex);
  return buildContractTx(sourcePublicKey, ZKMIND_CONTRACT_ID, 'commit_code', [
    StellarSdk.nativeToScVal(sessionId, { type: 'u32' }),
    StellarSdk.nativeToScVal(codemaker, { type: 'address' }),
    StellarSdk.xdr.ScVal.scvBytes(commitBytes),
  ]);
}

/**
 * Build submit_guess transaction.
 */
export async function buildSubmitGuess(
  sourcePublicKey: string,
  sessionId: number,
  codebreaker: string,
  guess: number[],
): Promise<StellarSdk.Transaction> {
  return buildContractTx(sourcePublicKey, ZKMIND_CONTRACT_ID, 'submit_guess', [
    StellarSdk.nativeToScVal(sessionId, { type: 'u32' }),
    StellarSdk.nativeToScVal(codebreaker, { type: 'address' }),
    StellarSdk.nativeToScVal(guess, { type: 'u32' }),
  ]);
}

/**
 * Build submit_feedback transaction.
 * First tries normal simulation. If simulation fails with a contract error,
 * falls back to manual transaction construction using the footprint from
 * a successful get_game simulation. This bypasses the broken simulation
 * while still providing correct footprint and resource estimates.
 */
export async function buildSubmitFeedback(
  sourcePublicKey: string,
  sessionId: number,
  codemaker: string,
  correctPosition: number,
  correctColor: number,
  proofHashHex: string,
): Promise<StellarSdk.Transaction> {
  const proofHashBytes = hexToBytes(proofHashHex);
  const feedbackArgs = [
    StellarSdk.nativeToScVal(sessionId, { type: 'u32' }),
    StellarSdk.nativeToScVal(codemaker, { type: 'address' }),
    StellarSdk.nativeToScVal(correctPosition, { type: 'u32' }),
    StellarSdk.nativeToScVal(correctColor, { type: 'u32' }),
    StellarSdk.xdr.ScVal.scvBytes(proofHashBytes),
  ];

  // Try normal simulation first (no retries - fail fast to try bypass)
  try {
    return await buildContractTx(
      sourcePublicKey, ZKMIND_CONTRACT_ID, 'submit_feedback', feedbackArgs, 0,
    );
  } catch (simError) {
    const simMsg = simError instanceof Error ? simError.message : String(simError);
    console.warn('[ZKMind] submit_feedback simulation failed, trying bypass:', simMsg);

    // Only bypass for contract errors (not network/encoding issues)
    if (!simMsg.includes('Error(Contract')) {
      throw simError;
    }
  }

  // === BYPASS: Build transaction manually without simulation ===
  console.log('[ZKMind] Building submit_feedback with simulation bypass...');

  // Step 1: Simulate get_game to get a valid footprint for this game's storage
  const contract = new StellarSdk.Contract(ZKMIND_CONTRACT_ID);
  const dummySeq = String(Math.floor(Math.random() * 2147483647));
  const dummyAccount = new StellarSdk.Account(
    'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF', dummySeq,
  );
  const getGameTx = new StellarSdk.TransactionBuilder(dummyAccount, {
    fee: '100',
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call('get_game',
      StellarSdk.nativeToScVal(sessionId, { type: 'u32' }),
    ))
    .setTimeout(30)
    .build();

  const getGameSim = await rpc.simulateTransaction(getGameTx);
  if (StellarSdk.rpc.Api.isSimulationError(getGameSim)) {
    throw new Error('Bypass failed: get_game simulation also failed');
  }

  // Step 2: Extract footprint from get_game and upgrade for writes
  const successSim = getGameSim as StellarSdk.rpc.Api.SimulateTransactionSuccessResponse;
  const simData = successSim.transactionData.build();

  const readOnlyKeys: StellarSdk.xdr.LedgerKey[] = [];
  const readWriteKeys: StellarSdk.xdr.LedgerKey[] = [];

  // get_game only reads; submit_feedback needs write access to the game key (temporary)
  for (const key of simData.resources().footprint().readOnly()) {
    if (key.switch().name === 'contractData') {
      const dur = key.contractData().durability().name;
      if (dur === 'temporary') {
        // Game storage key: move to read-write for submit_feedback
        readWriteKeys.push(key);
      } else {
        readOnlyKeys.push(key);
      }
    } else {
      readOnlyKeys.push(key);
    }
  }
  for (const key of simData.resources().footprint().readWrite()) {
    readWriteKeys.push(key);
  }

  // Step 3: Build generous SorobanTransactionData
  const sorobanData = new StellarSdk.SorobanDataBuilder()
    .setFootprint(readOnlyKeys, readWriteKeys)
    .setResources(50_000_000, 20_000, 20_000)  // 50M CPU, 20KB read, 20KB write
    .setResourceFee(5_000_000)  // 5 XLM resource fee
    .build();

  // Step 4: Build auth entry (SourceAccount since codemaker == tx source)
  const authInvocation = new StellarSdk.xdr.SorobanAuthorizedInvocation({
    function: StellarSdk.xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeContractFn(
      new StellarSdk.xdr.InvokeContractArgs({
        contractAddress: new StellarSdk.Address(ZKMIND_CONTRACT_ID).toScAddress(),
        functionName: 'submit_feedback',
        args: feedbackArgs,
      }),
    ),
    subInvocations: [],
  });

  const authEntry = new StellarSdk.xdr.SorobanAuthorizationEntry({
    credentials: StellarSdk.xdr.SorobanCredentials.sorobanCredentialsSourceAccount(),
    rootInvocation: authInvocation,
  });

  // Step 5: Build the transaction with manual soroban data + auth
  const account = await rpc.getAccount(sourcePublicKey);
  const invokeOp = StellarSdk.Operation.invokeHostFunction({
    func: StellarSdk.xdr.HostFunction.hostFunctionTypeInvokeContract(
      new StellarSdk.xdr.InvokeContractArgs({
        contractAddress: new StellarSdk.Address(ZKMIND_CONTRACT_ID).toScAddress(),
        functionName: 'submit_feedback',
        args: feedbackArgs,
      }),
    ),
    auth: [authEntry],
  });

  return new StellarSdk.TransactionBuilder(account, {
    fee: '10000000',  // 10 XLM max fee
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(invokeOp)
    .setSorobanData(sorobanData)
    .setTimeout(300)
    .build();
}

/**
 * Submit a signed transaction and wait for result.
 */
export { submitTx };

// ============================================================================
// Read-only Queries
// ============================================================================

export interface OnChainGameState {
  session_id: number;
  codemaker: string;
  codebreaker: string;
  phase: number;
  commitment: string;
  guesses: number[][];
  feedbacks: { correct_position: number; correct_color: number; proof_hash: string }[];
  guess_count: number;
  max_guesses: number;
  winner: string | null;
  current_guess: number[];
}

/**
 * Read game state directly from ledger storage (bypasses simulation entirely).
 * This is the most reliable way to check on-chain state.
 */
export async function getGameDirect(sessionId: number): Promise<OnChainGameState | null> {
  try {
    // DataKey::Game(session_id) serializes as Vec<[Symbol("Game"), U32(sessionId)]>
    const dataKey = StellarSdk.xdr.ScVal.scvVec([
      StellarSdk.xdr.ScVal.scvSymbol('Game'),
      StellarSdk.nativeToScVal(sessionId, { type: 'u32' }),
    ]);

    const contractAddr = new StellarSdk.Address(ZKMIND_CONTRACT_ID);
    const ledgerKey = StellarSdk.xdr.LedgerKey.contractData(
      new StellarSdk.xdr.LedgerKeyContractData({
        contract: contractAddr.toScAddress(),
        key: dataKey,
        durability: StellarSdk.xdr.ContractDataDurability.temporary(),
      })
    );

    const response = await rpc.getLedgerEntries(ledgerKey);
    if (!response.entries || response.entries.length === 0) return null;

    const entry = response.entries[0];
    const contractData = entry.val.contractData();
    const val = contractData.val();

    return scValToGameState(val);
  } catch (e) {
    console.warn('[ZKMind] getGameDirect failed:', e);
    return null;
  }
}

/**
 * Query game state from the contract via simulation.
 */
export async function getGame(sessionId: number): Promise<OnChainGameState | null> {
  const contract = new StellarSdk.Contract(ZKMIND_CONTRACT_ID);

  // Use random sequence to prevent any RPC caching
  const randomSeq = String(Math.floor(Math.random() * 2147483647));
  const account = new StellarSdk.Account('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF', randomSeq);
  const tx = new StellarSdk.TransactionBuilder(account, {
    fee: '100',
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call('get_game',
      StellarSdk.nativeToScVal(sessionId, { type: 'u32' }),
    ))
    .setTimeout(30)
    .build();

  const simulated = await rpc.simulateTransaction(tx);
  if (StellarSdk.rpc.Api.isSimulationError(simulated)) {
    return null;
  }

  if (!('result' in simulated) || !simulated.result) {
    return null;
  }

  // Parse the result ScVal into a JS object
  const resultVal = simulated.result.retval;
  return scValToGameState(resultVal);
}

// Parse ScVal struct into our GameState interface
function scValToGameState(val: StellarSdk.xdr.ScVal): OnChainGameState {
  const map = val.map();
  if (!map) throw new Error('Expected map');

  const fields: Record<string, StellarSdk.xdr.ScVal> = {};
  for (const entry of map) {
    const key = entry.key().sym().toString();
    fields[key] = entry.val();
  }

  return {
    session_id: fields['session_id'].u32(),
    codemaker: StellarSdk.Address.fromScVal(fields['codemaker']).toString(),
    codebreaker: StellarSdk.Address.fromScVal(fields['codebreaker']).toString(),
    phase: fields['phase'].u32(),
    commitment: Buffer.from(fields['commitment'].bytes()).toString('hex'),
    guesses: parseVecOfVecU32(fields['guesses']),
    feedbacks: parseFeedbacks(fields['feedbacks']),
    guess_count: fields['guess_count'].u32(),
    max_guesses: fields['max_guesses'].u32(),
    winner: fields['winner'].switch().name === 'scvVoid' ? null :
      StellarSdk.Address.fromScVal(fields['winner']).toString(),
    current_guess: parseVecU32(fields['current_guess']),
  };
}

function parseVecU32(val: StellarSdk.xdr.ScVal): number[] {
  const vec = val.vec();
  if (!vec) return [];
  return vec.map(v => v.u32());
}

function parseVecOfVecU32(val: StellarSdk.xdr.ScVal): number[][] {
  const vec = val.vec();
  if (!vec) return [];
  return vec.map(v => parseVecU32(v));
}

function parseFeedbacks(val: StellarSdk.xdr.ScVal): OnChainGameState['feedbacks'] {
  const vec = val.vec();
  if (!vec) return [];
  return vec.map(v => {
    const m = v.map()!;
    const f: Record<string, StellarSdk.xdr.ScVal> = {};
    for (const e of m) {
      f[e.key().sym().toString()] = e.val();
    }
    return {
      correct_position: f['correct_position'].u32(),
      correct_color: f['correct_color'].u32(),
      proof_hash: Buffer.from(f['proof_hash'].bytes()).toString('hex'),
    };
  });
}
