# ZKMind - ZK Mastermind on Stellar

> **Mastermind where your opponent can't lie.** Every feedback clue is proven correct by a zero-knowledge proof, enforced on Stellar.

![Noir](https://img.shields.io/badge/Noir-v1.0.0--beta.9-purple)
![Stellar](https://img.shields.io/badge/Stellar-Protocol%2025-blue)
![UltraHonk](https://img.shields.io/badge/Barretenberg-UltraHonk-pink)

---

## The Problem

In the classic board game Mastermind, the CodeMaker gives feedback (red/white pegs) on each guess. But how do you **trust** that feedback in a trustless online environment? A dishonest CodeMaker could lie about the clues to gain an unfair advantage. Centralized servers can enforce rules, but that defeats the purpose of on-chain gaming.

## Our Solution

**ZKMind** uses zero-knowledge proofs to make cheating mathematically impossible. The CodeMaker's secret code is committed on-chain as a Pedersen hash. For every guess, a Noir circuit generates an UltraHonk proof that the feedback is correct - without revealing the secret code. The proof hash is stored on Stellar, creating a verifiable trail of honest play.

**No trust required. No centralized referee. Just math.**

---

## How It Works

```
CodeMaker picks secret [R,B,G,Y]
         |
         v
  pedersen_hash(secret) --> commitment stored on-chain
         |
         v
  CodeBreaker guesses [R,G,B,Y]
         |
         v
  CodeMaker computes feedback: 1 red, 2 white
         |
         v
  Noir circuit proves feedback is honest
  (without revealing the secret!)
         |
         v
  UltraHonk proof generated in browser
         |
         v
  proof_hash stored on Stellar (Soroban contract)
         |
         v
  Anyone can verify the CodeMaker never lied
```

### Game Flow

1. **CodeMaker** picks 4 colors from 6 options and commits a Pedersen hash on-chain
2. **CodeBreaker** submits guesses on-chain (up to 12 attempts)
3. For each guess, **CodeMaker** computes feedback:
   - **Red pegs** = right color, right position
   - **White pegs** = right color, wrong position
4. A **Noir ZK circuit** proves the feedback matches the committed secret
5. The **UltraHonk proof hash** is stored on Stellar alongside the feedback
6. Game ends when code is cracked or 12 guesses are exhausted

---

## Tech Stack

| Layer | Technology | Details |
|-------|-----------|---------|
| **ZK Circuit** | Noir v1.0.0-beta.9 | Mastermind feedback verification, Pedersen hash commitment |
| **Proof System** | Barretenberg UltraHonk v0.87.0 | Browser-based proof generation via `@aztec/bb.js` |
| **Smart Contract** | Soroban (Rust, SDK v23.1.0) | Game state, commitment, feedback + proof hash storage |
| **On-chain Verifier** | P25 UltraHonk Verifier | BN254 native host functions (CAP-0074) |
| **Frontend** | Next.js 16 + Tailwind CSS | Retro pixel art theme, real-time game state polling |
| **Wallet** | Freighter | Stellar browser wallet integration |
| **Game Hub** | Stellar Game Studio | Integration ready via `report_result` |

### Architecture

```
+------------------+     +------------------+     +------------------+
|   Browser (UI)   |     |   Noir Circuit   |     |  Stellar Testnet |
|                  |     |                  |     |                  |
|  Next.js 16      |---->|  main.nr         |     |  ZKMind Contract |
|  Tailwind CSS    |     |  15 tests pass   |     |  9.7KB WASM      |
|  Freighter       |     |  pedersen_hash   |     |                  |
|                  |     +------------------+     |  UltraHonk       |
|  @noir-lang/     |            |                 |  Verifier (P25)  |
|    noir_js       |            v                 |  64.9KB WASM     |
|  @aztec/bb.js    |     +------------------+     |                  |
|                  |     | UltraHonk Proof  |---->|  proof_hash      |
|                  |     | (browser WASM)   |     |  stored on-chain |
+------------------+     +------------------+     +------------------+
```

---

## Deployed Contracts (Testnet)

| Contract | Address | Size |
|----------|---------|------|
| **ZKMind Game** | `CAZNILASDETOWYYF3TX325FIOSRHVPH3VBLSEJ4C3EFCQ2KH25F7VWO3` | 9.7 KB |
| **UltraHonk Verifier** | `CBLH3WI2FHCIUB62RYIJDOPAIDTXIGTLFGJ2GU6DTQJ5YGZSTB4XJAPG` | 64.9 KB |

Verified on-chain: `new_game` -> `commit_code` -> `submit_guess` -> `submit_feedback` -> `get_game` full flow tested on Stellar Testnet.

---

## ZK Circuit

The Noir circuit (`circuits/src/main.nr`) enforces:

1. **Secret code validity** - all values are in range [0,5]
2. **Commitment integrity** - `pedersen_hash(secret_code) == commitment` (CodeMaker can't change the secret mid-game)
3. **Red peg count** - exact position matches are computed correctly
4. **White peg count** - color-only matches (excluding exact matches) are correct
5. **Sanity bound** - total pegs never exceed code length

**15 tests pass**, including edge cases for duplicates, boundary values, and negative tests for dishonest feedback.

---

## Hybrid Verification Model

ZKMind uses a **hybrid verification** architecture:

- **Client-side**: Full ZK proof generation and verification in the browser using `@noir-lang/noir_js` + `@aztec/bb.js` (UltraHonk)
- **On-chain**: Proof hash (`sha256(proof_bytes)`) stored on Stellar alongside feedback
- **P25 Verifier deployed**: A Protocol 25 UltraHonk verifier contract is deployed and ready. On-chain verification using native BN254 host functions (CAP-0074: `bls12_381_g1_add`, `bls12_381_g1_mul`, `bls12_381_multi_pairing_check`) is available for circuits within Soroban's compute budget.

This gives us **cryptographic guarantees** that the CodeMaker's feedback is honest, with proof data anchored on-chain for auditability.

---

## Getting Started

### Prerequisites

- Node.js >= 20
- [Freighter Wallet](https://freighter.app) browser extension
- (Optional) [Nargo v1.0.0-beta.9](https://noir-lang.org) for circuit development
- (Optional) [Stellar CLI](https://stellar.org/developers) for contract deployment

### Run Locally

```bash
# Clone
git clone https://github.com/mthdroid/ZKMind.git
cd ZKMind

# Install frontend dependencies
cd frontend
npm install

# Run dev server
npm run dev
# Open http://localhost:3000
```

### Play the Demo

The **Local Demo** mode (`/game/demo`) lets you play Mastermind instantly without a wallet. Pick a secret code, then try to crack it - all feedback is computed client-side.

### Play On-Chain

1. Install [Freighter Wallet](https://freighter.app) and switch to **Testnet**
2. Fund your account at [Stellar Friendbot](https://friendbot.stellar.org)
3. Connect wallet on the ZKMind homepage
4. Create a game or join an existing session
5. Each feedback submission generates a ZK proof in your browser

---

## Project Structure

```
ZKMind/
  circuits/           # Noir ZK circuit
    src/main.nr       # Mastermind feedback circuit (15 tests)
    Nargo.toml        # Circuit config
    target/           # Compiled circuit + VK
  contracts/
    zkmind/           # Soroban game contract
      src/lib.rs      # Game logic + proof hash storage
      src/test.rs     # 3 integration tests
  frontend/           # Next.js 16 application
    src/
      app/            # Pages (home, demo, on-chain game)
      components/     # UI components (ColorPeg, GuessRow, etc.)
      lib/            # Services (contracts, wallet, noir, mastermind)
    public/circuits/  # Compiled circuit for browser proof gen
  scripts/            # Deployment scripts
```

---

## What Makes ZKMind Special

1. **Real ZK proofs for game integrity** - Not just a concept. Noir circuits compile, tests pass, proofs generate in the browser.

2. **Protocol 25 ready** - UltraHonk verifier deployed using native BN254 host functions (CAP-0074). When compute budgets increase, full on-chain verification is one function call away.

3. **Stellar-native** - Built specifically for Soroban. Pedersen hash commitments, compact proof hashes on-chain, Game Hub integration ready.

4. **Playable now** - Local demo works instantly. On-chain mode works with Freighter on testnet. Not a mockup - a real game.

5. **Elegant circuit design** - Single 77-line Noir circuit handles all Mastermind rules including tricky edge cases (duplicate colors, partial matches). 15 tests covering all scenarios.

---

## Team

Built solo by **mthdroid** for Stellar Hacks: ZK Gaming 2026.

---

*Noir + Stellar + UltraHonk = trustless gaming*
