use std::hash::pedersen_hash;

// ZKMind -- Mastermind feedback verification circuit.
//
// Proves that the CodeMaker's feedback (red pegs, white pegs) is honest
// without revealing the secret code.
//
// Colors: 0-5 (6 possible), Code length: 4
// Red pegs (correct_position): right color + right position
// White pegs (correct_color): right color, wrong position
fn main(
    secret_code: [u8; 4],        // Secret code (PRIVATE) - values 0-5
    commitment: pub Field,        // pedersen_hash(secret_code) - set at game start (PUBLIC)
    guess: pub [u8; 4],          // CodeBreaker's guess (PUBLIC)
    correct_position: pub u8,     // Red pegs (PUBLIC)
    correct_color: pub u8,        // White pegs (PUBLIC)
) {
    // 1. Verify all values in secret_code are valid (0-5)
    for i in 0..4 {
        assert(secret_code[i] < 6, "Secret code value must be 0-5");
    }

    // 2. Verify pedersen_hash(secret_code) == commitment
    //    Proves CodeMaker uses the same code since game start
    let hash_input: [Field; 4] = [
        secret_code[0] as Field,
        secret_code[1] as Field,
        secret_code[2] as Field,
        secret_code[3] as Field,
    ];
    let computed_commitment = pedersen_hash(hash_input);
    assert(computed_commitment == commitment, "Commitment mismatch");

    // 3. Count exact matches (right color + right position) = red pegs
    let mut exact: u8 = 0;
    let mut is_exact: [bool; 4] = [false; 4];
    for i in 0..4 {
        if secret_code[i] == guess[i] {
            exact += 1;
            is_exact[i] = true;
        }
    }
    assert(correct_position == exact, "Wrong correct_position count");

    // 4. Count color matches excluding exact matches = white pegs
    //    For each color c (0-5):
    //      count how many times c appears in secret at NON-exact positions
    //      count how many times c appears in guess at NON-exact positions
    //      white pegs += min(count_secret, count_guess)
    let mut color_matches: u8 = 0;

    for color in 0..6 {
        let c: u8 = color as u8;
        let mut count_secret: u8 = 0;
        let mut count_guess: u8 = 0;

        for i in 0..4 {
            if (!is_exact[i]) & (secret_code[i] == c) {
                count_secret += 1;
            }
            if (!is_exact[i]) & (guess[i] == c) {
                count_guess += 1;
            }
        }

        // min(count_secret, count_guess)
        if count_secret < count_guess {
            color_matches += count_secret;
        } else {
            color_matches += count_guess;
        }
    }
    assert(correct_color == color_matches, "Wrong correct_color count");

    // 5. Sanity check: total pegs cannot exceed code length
    assert(correct_position + correct_color <= 4, "Total pegs exceed 4");
}

// ============ TESTS ============

fn make_commitment(code: [u8; 4]) -> Field {
    pedersen_hash([code[0] as Field, code[1] as Field, code[2] as Field, code[3] as Field])
}

#[test]
fn test_perfect_match() {
    let secret = [0, 1, 2, 3];
    let commitment = make_commitment(secret);
    main(secret, commitment, [0, 1, 2, 3], 4, 0);
}

#[test]
fn test_no_matches() {
    let secret = [0, 1, 2, 3];
    let commitment = make_commitment(secret);
    main(secret, commitment, [4, 5, 4, 5], 0, 0);
}

#[test]
fn test_all_misplaced() {
    let secret = [0, 1, 2, 3];
    let commitment = make_commitment(secret);
    main(secret, commitment, [3, 2, 1, 0], 0, 4);
}

#[test]
fn test_mixed_red_white() {
    let secret = [0, 1, 2, 3];
    let commitment = make_commitment(secret);
    main(secret, commitment, [0, 1, 3, 5], 2, 1);
}

#[test]
fn test_duplicate_in_guess() {
    let secret = [0, 0, 1, 2];
    let commitment = make_commitment(secret);
    main(secret, commitment, [0, 1, 0, 0], 1, 2);
}

#[test]
fn test_duplicates_both() {
    let secret = [1, 1, 2, 2];
    let commitment = make_commitment(secret);
    main(secret, commitment, [1, 2, 1, 2], 2, 2);
}

#[test]
fn test_excess_color_in_guess() {
    let secret = [0, 1, 2, 3];
    let commitment = make_commitment(secret);
    main(secret, commitment, [0, 0, 0, 0], 1, 0);
}

#[test]
fn test_one_red_three_white() {
    let secret = [0, 1, 2, 3];
    let commitment = make_commitment(secret);
    main(secret, commitment, [0, 3, 1, 2], 1, 3);
}

#[test]
fn test_same_color_secret() {
    let secret = [3, 3, 3, 3];
    let commitment = make_commitment(secret);
    main(secret, commitment, [3, 0, 0, 0], 1, 0);
}

#[test]
fn test_all_same() {
    let secret = [5, 5, 5, 5];
    let commitment = make_commitment(secret);
    main(secret, commitment, [5, 5, 5, 5], 4, 0);
}

#[test]
fn test_exact_exclusion() {
    let secret = [0, 1, 0, 1];
    let commitment = make_commitment(secret);
    main(secret, commitment, [0, 0, 1, 1], 2, 2);
}

#[test(should_fail_with = "Wrong correct_position count")]
fn test_reject_wrong_red_count() {
    let secret = [0, 1, 2, 3];
    let commitment = make_commitment(secret);
    main(secret, commitment, [0, 1, 5, 5], 3, 0);
}

#[test(should_fail_with = "Wrong correct_color count")]
fn test_reject_wrong_white_count() {
    let secret = [0, 1, 2, 3];
    let commitment = make_commitment(secret);
    main(secret, commitment, [3, 2, 1, 0], 0, 2);
}

#[test(should_fail_with = "Commitment mismatch")]
fn test_reject_wrong_commitment() {
    let secret = [0, 1, 2, 3];
    let wrong_commitment = make_commitment([5, 5, 5, 5]);
    main(secret, wrong_commitment, [0, 1, 2, 3], 4, 0);
}

#[test(should_fail_with = "Secret code value must be 0-5")]
fn test_reject_invalid_color() {
    let secret = [0, 1, 2, 7];
    let commitment = make_commitment(secret);
    main(secret, commitment, [0, 1, 2, 3], 3, 0);
}
