#![cfg(test)]

use soroban_sdk::{testutils::Address as _, Address, BytesN, Env, Vec};

use crate::{Error, GamePhase, ZKMindContract, ZKMindContractClient};

fn setup_test() -> (Env, ZKMindContractClient<'static>, Address, Address) {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let game_hub = Address::generate(&env);
    let verifier = Address::generate(&env);

    let contract_id = env.register(ZKMindContract, (&admin, &game_hub, &verifier));
    let client = ZKMindContractClient::new(&env, &contract_id);

    let codemaker = Address::generate(&env);
    let codebreaker = Address::generate(&env);

    (env, client, codemaker, codebreaker)
}

#[test]
fn test_new_game_and_commit() {
    let (env, client, codemaker, codebreaker) = setup_test();

    client.new_game(&1u32, &codemaker, &codebreaker);

    let game = client.get_game(&1u32);
    assert_eq!(game.phase, GamePhase::WaitingForCommitment);
    assert_eq!(game.codemaker, codemaker);
    assert_eq!(game.codebreaker, codebreaker);

    // Commit a code hash
    let commitment = BytesN::from_array(&env, &[0xABu8; 32]);
    client.commit_code(&1u32, &codemaker, &commitment);

    let game = client.get_game(&1u32);
    assert_eq!(game.phase, GamePhase::WaitingForGuess);
    assert_eq!(game.commitment, commitment);
}

#[test]
fn test_full_game_codebreaker_wins() {
    let (env, client, codemaker, codebreaker) = setup_test();

    client.new_game(&1u32, &codemaker, &codebreaker);

    let commitment = BytesN::from_array(&env, &[0xABu8; 32]);
    client.commit_code(&1u32, &codemaker, &commitment);

    // Submit a guess
    let mut guess = Vec::new(&env);
    guess.push_back(0u32);
    guess.push_back(1u32);
    guess.push_back(2u32);
    guess.push_back(3u32);
    client.submit_guess(&1u32, &codebreaker, &guess);

    let game = client.get_game(&1u32);
    assert_eq!(game.phase, GamePhase::WaitingForFeedback);

    // Submit feedback: perfect match (4 red pegs)
    let proof_hash = BytesN::from_array(&env, &[0xCDu8; 32]);
    client.submit_feedback(&1u32, &codemaker, &4u32, &0u32, &proof_hash);

    let game = client.get_game(&1u32);
    assert_eq!(game.phase, GamePhase::Finished);
    assert_eq!(game.winner, Some(codebreaker));
    assert_eq!(game.guess_count, 1);
}

#[test]
fn test_game_continues_after_partial_match() {
    let (env, client, codemaker, codebreaker) = setup_test();

    client.new_game(&1u32, &codemaker, &codebreaker);

    let commitment = BytesN::from_array(&env, &[0xABu8; 32]);
    client.commit_code(&1u32, &codemaker, &commitment);

    // Submit guess
    let mut guess = Vec::new(&env);
    guess.push_back(0u32);
    guess.push_back(1u32);
    guess.push_back(2u32);
    guess.push_back(3u32);
    client.submit_guess(&1u32, &codebreaker, &guess);

    // Partial match: 1 red, 2 white
    let proof_hash = BytesN::from_array(&env, &[0xCDu8; 32]);
    client.submit_feedback(&1u32, &codemaker, &1u32, &2u32, &proof_hash);

    let game = client.get_game(&1u32);
    assert_eq!(game.phase, GamePhase::WaitingForGuess);
    assert_eq!(game.guess_count, 1);
    assert_eq!(game.feedbacks.len(), 1);
}
