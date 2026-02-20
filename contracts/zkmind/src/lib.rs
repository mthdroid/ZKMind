#![no_std]

use soroban_sdk::{
    contract, contractclient, contracterror, contractimpl, contracttype, Address, BytesN, Env, Vec,
};

// ============================================================================
// Game Hub Interface (Stellar Game Studio)
// ============================================================================

#[contractclient(name = "GameHubClient")]
pub trait GameHub {
    fn start_game(
        env: Env,
        game_id: Address,
        session_id: u32,
        player1: Address,
        player2: Address,
        player1_points: i128,
        player2_points: i128,
    );

    fn end_game(env: Env, session_id: u32, player1_won: bool);
}

// ============================================================================
// Errors
// ============================================================================

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    GameNotFound = 1,
    NotCodeMaker = 2,
    NotCodeBreaker = 3,
    InvalidPhase = 4,
    InvalidGuessValue = 5,
    MaxGuessesReached = 6,
    InvalidFeedback = 7,
    GameAlreadyEnded = 8,
}

// ============================================================================
// Data Types
// ============================================================================

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum GamePhase {
    WaitingForCommitment = 0,
    WaitingForGuess = 1,
    WaitingForFeedback = 2,
    Finished = 3,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Feedback {
    pub correct_position: u32,
    pub correct_color: u32,
    pub proof_hash: BytesN<32>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct GameState {
    pub session_id: u32,
    pub codemaker: Address,
    pub codebreaker: Address,
    pub phase: GamePhase,
    pub commitment: BytesN<32>,
    pub guesses: Vec<Vec<u32>>,
    pub feedbacks: Vec<Feedback>,
    pub guess_count: u32,
    pub max_guesses: u32,
    pub winner: Option<Address>,
    pub current_guess: Vec<u32>,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Game(u32),
    GameHubAddress,
    VerifierAddress,
    Admin,
}

// ============================================================================
// Constants
// ============================================================================

const GAME_TTL_LEDGERS: u32 = 518_400; // ~30 days
const MAX_GUESSES: u32 = 12;

// ============================================================================
// Contract
// ============================================================================

#[contract]
pub struct ZKMindContract;

#[contractimpl]
impl ZKMindContract {
    /// Initialize the contract with admin and Game Hub address.
    /// verifier_address is stored for future on-chain ZK verification
    /// when Soroban budget limits support UltraHonk verification.
    pub fn __constructor(env: Env, admin: Address, game_hub: Address, verifier: Address) {
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&DataKey::GameHubAddress, &game_hub);
        env.storage()
            .instance()
            .set(&DataKey::VerifierAddress, &verifier);
    }

    /// Start a new game session. Both players must authorize.
    pub fn new_game(
        env: Env,
        session_id: u32,
        codemaker: Address,
        codebreaker: Address,
    ) -> Result<(), Error> {
        codemaker.require_auth();
        codebreaker.require_auth();

        let game = GameState {
            session_id,
            codemaker: codemaker.clone(),
            codebreaker: codebreaker.clone(),
            phase: GamePhase::WaitingForCommitment,
            commitment: BytesN::from_array(&env, &[0u8; 32]),
            guesses: Vec::new(&env),
            feedbacks: Vec::new(&env),
            guess_count: 0,
            max_guesses: MAX_GUESSES,
            winner: None,
            current_guess: Vec::new(&env),
        };

        let key = DataKey::Game(session_id);
        env.storage().temporary().set(&key, &game);
        env.storage()
            .temporary()
            .extend_ttl(&key, GAME_TTL_LEDGERS, GAME_TTL_LEDGERS);

        Ok(())
    }

    /// CodeMaker commits their secret code hash (pedersen_hash).
    /// The commitment is computed client-side using pedersen_hash([c0,c1,c2,c3]).
    pub fn commit_code(
        env: Env,
        session_id: u32,
        codemaker: Address,
        commitment: BytesN<32>,
    ) -> Result<(), Error> {
        codemaker.require_auth();

        let key = DataKey::Game(session_id);
        let mut game: GameState = env
            .storage()
            .temporary()
            .get(&key)
            .ok_or(Error::GameNotFound)?;

        if game.phase != GamePhase::WaitingForCommitment {
            return Err(Error::InvalidPhase);
        }
        if game.codemaker != codemaker {
            return Err(Error::NotCodeMaker);
        }

        game.commitment = commitment;
        game.phase = GamePhase::WaitingForGuess;

        env.storage().temporary().set(&key, &game);
        env.storage()
            .temporary()
            .extend_ttl(&key, GAME_TTL_LEDGERS, GAME_TTL_LEDGERS);

        Ok(())
    }

    /// CodeBreaker submits a guess (4 colors, values 0-5).
    pub fn submit_guess(
        env: Env,
        session_id: u32,
        codebreaker: Address,
        guess: Vec<u32>,
    ) -> Result<(), Error> {
        codebreaker.require_auth();

        let key = DataKey::Game(session_id);
        let mut game: GameState = env
            .storage()
            .temporary()
            .get(&key)
            .ok_or(Error::GameNotFound)?;

        if game.phase != GamePhase::WaitingForGuess {
            return Err(Error::InvalidPhase);
        }
        if game.codebreaker != codebreaker {
            return Err(Error::NotCodeBreaker);
        }

        if guess.len() != 4 {
            return Err(Error::InvalidGuessValue);
        }
        for i in 0..4 {
            let val = guess.get(i).unwrap();
            if val > 5 {
                return Err(Error::InvalidGuessValue);
            }
        }

        game.current_guess = guess;
        game.phase = GamePhase::WaitingForFeedback;

        env.storage().temporary().set(&key, &game);
        env.storage()
            .temporary()
            .extend_ttl(&key, GAME_TTL_LEDGERS, GAME_TTL_LEDGERS);

        Ok(())
    }

    /// CodeMaker submits feedback with a ZK proof hash.
    ///
    /// The ZK proof is generated and verified client-side using Noir + bb:
    /// - Circuit proves: feedback is correct for the committed secret code
    /// - Proof is verified by the opponent's client before accepting
    /// - proof_hash = sha256(proof_bytes) stored on-chain for auditability
    ///
    /// Architecture note: Full on-chain UltraHonk verification is deployed
    /// at the verifier_address but currently exceeds Soroban budget limits
    /// for circuits of this size. When budget limits are raised, this contract
    /// can be upgraded to call verify_proof on-chain.
    pub fn submit_feedback(
        env: Env,
        session_id: u32,
        codemaker: Address,
        correct_position: u32,
        correct_color: u32,
        proof_hash: BytesN<32>,
    ) -> Result<(), Error> {
        codemaker.require_auth();

        let key = DataKey::Game(session_id);
        let mut game: GameState = env
            .storage()
            .temporary()
            .get(&key)
            .ok_or(Error::GameNotFound)?;

        if game.phase != GamePhase::WaitingForFeedback {
            return Err(Error::InvalidPhase);
        }
        if game.codemaker != codemaker {
            return Err(Error::NotCodeMaker);
        }

        // Validate feedback bounds
        if correct_position > 4 || correct_color > 4 || correct_position + correct_color > 4 {
            return Err(Error::InvalidFeedback);
        }

        let feedback = Feedback {
            correct_position,
            correct_color,
            proof_hash,
        };

        game.guesses.push_back(game.current_guess.clone());
        game.feedbacks.push_back(feedback);
        game.guess_count += 1;

        // Check win: all 4 correct positions
        if correct_position == 4 {
            game.phase = GamePhase::Finished;
            game.winner = Some(game.codebreaker.clone());
        } else if game.guess_count >= game.max_guesses {
            game.phase = GamePhase::Finished;
            game.winner = Some(game.codemaker.clone());
        } else {
            game.phase = GamePhase::WaitingForGuess;
        }

        env.storage().temporary().set(&key, &game);
        env.storage()
            .temporary()
            .extend_ttl(&key, GAME_TTL_LEDGERS, GAME_TTL_LEDGERS);

        // Game Hub reporting is done via separate report_result call

        Ok(())
    }

    /// Get the current game state (read-only).
    pub fn get_game(env: Env, session_id: u32) -> Result<GameState, Error> {
        let key = DataKey::Game(session_id);
        env.storage()
            .temporary()
            .get(&key)
            .ok_or(Error::GameNotFound)
    }

    /// Get the verifier contract address (for client-side reference).
    pub fn get_verifier(env: Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::VerifierAddress)
            .expect("Verifier not set")
    }

    /// Report game result to Game Hub. Can be called by either player after game ends.
    pub fn report_result(env: Env, session_id: u32) -> Result<(), Error> {
        let key = DataKey::Game(session_id);
        let game: GameState = env
            .storage()
            .temporary()
            .get(&key)
            .ok_or(Error::GameNotFound)?;

        if game.phase != GamePhase::Finished {
            return Err(Error::InvalidPhase);
        }

        let game_hub_addr: Address = env
            .storage()
            .instance()
            .get(&DataKey::GameHubAddress)
            .expect("GameHub not set");
        let game_hub = GameHubClient::new(&env, &game_hub_addr);
        let codemaker_won = game.winner == Some(game.codemaker.clone());
        game_hub.end_game(&session_id, &codemaker_won);

        Ok(())
    }

    // ========================================================================
    // Admin Functions
    // ========================================================================

    pub fn get_admin(env: Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("Admin not set")
    }

    pub fn set_admin(env: Env, new_admin: Address) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("Admin not set");
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &new_admin);
    }

    pub fn set_verifier(env: Env, new_verifier: Address) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("Admin not set");
        admin.require_auth();
        env.storage()
            .instance()
            .set(&DataKey::VerifierAddress, &new_verifier);
    }

    pub fn set_hub(env: Env, new_hub: Address) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("Admin not set");
        admin.require_auth();
        env.storage()
            .instance()
            .set(&DataKey::GameHubAddress, &new_hub);
    }

    pub fn upgrade(env: Env, new_wasm_hash: BytesN<32>) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("Admin not set");
        admin.require_auth();
        env.deployer().update_current_contract_wasm(new_wasm_hash);
    }
}

#[cfg(test)]
mod test;
