/**
 * Mastermind feedback algorithm — TypeScript reference implementation.
 * This is validated first, then translated line-by-line to Noir.
 *
 * Colors: 0-5 (6 possible colors)
 * Code length: 4
 * Red pegs (correct_position): right color + right position
 * White pegs (correct_color): right color + WRONG position
 */

function computeFeedback(
  secret: number[],
  guess: number[]
): { correctPosition: number; correctColor: number } {
  // Step 1: Count exact matches (red pegs)
  let exactMatches = 0;
  const isExact = [false, false, false, false];

  for (let i = 0; i < 4; i++) {
    if (secret[i] === guess[i]) {
      exactMatches++;
      isExact[i] = true;
    }
  }

  // Step 2: Count color matches excluding exact matches (white pegs)
  // For each color (0-5), count occurrences in secret and guess
  // at NON-exact-match positions, then take min
  let colorMatches = 0;

  for (let color = 0; color < 6; color++) {
    let countInSecret = 0;
    let countInGuess = 0;

    for (let i = 0; i < 4; i++) {
      if (!isExact[i] && secret[i] === color) {
        countInSecret++;
      }
      if (!isExact[i] && guess[i] === color) {
        countInGuess++;
      }
    }

    colorMatches += Math.min(countInSecret, countInGuess);
  }

  return { correctPosition: exactMatches, correctColor: colorMatches };
}

// ============ TEST CASES ============

function test(
  name: string,
  secret: number[],
  guess: number[],
  expectedRed: number,
  expectedWhite: number
) {
  const result = computeFeedback(secret, guess);
  const pass =
    result.correctPosition === expectedRed &&
    result.correctColor === expectedWhite;
  const status = pass ? "PASS" : "FAIL";
  console.log(
    `[${status}] ${name}: secret=[${secret}] guess=[${guess}] => red=${result.correctPosition} white=${result.correctColor} (expected red=${expectedRed} white=${expectedWhite})`
  );
  if (!pass) process.exit(1);
}

// Test 1: Perfect guess (all red pegs)
test("Perfect match", [0, 1, 2, 3], [0, 1, 2, 3], 4, 0);

// Test 2: No matches at all
test("No matches", [0, 1, 2, 3], [4, 5, 4, 5], 0, 0);

// Test 3: All white pegs (all misplaced)
test("All misplaced", [0, 1, 2, 3], [3, 2, 1, 0], 0, 4);

// Test 4: Mix of red and white
test("2 red 1 white", [0, 1, 2, 3], [0, 1, 3, 5], 2, 1);

// Test 5: Duplicate colors in guess — critical edge case
// Secret: [0, 0, 1, 2], Guess: [0, 1, 0, 0]
// Exact: pos 0 (0==0). Non-exact secret: [_, 0, 1, 2], non-exact guess: [_, 1, 0, 0]
// Color 0: secret has 1 (pos 1), guess has 2 (pos 2,3) -> min(1,2)=1
// Color 1: secret has 1 (pos 2), guess has 1 (pos 1) -> min(1,1)=1
// Color 2: secret has 1 (pos 3), guess has 0 -> 0
// Total: red=1, white=2
test("Duplicate in guess", [0, 0, 1, 2], [0, 1, 0, 0], 1, 2);

// Test 6: Duplicate colors in secret
// Secret: [1, 1, 2, 2], Guess: [1, 2, 1, 2]
// Exact: pos 0 (1==1), pos 3 (2==2). Non-exact: secret [_, 1, 2, _], guess [_, 2, 1, _]
// Color 1: secret 1, guess 1 -> 1
// Color 2: secret 1, guess 1 -> 1
// Total: red=2, white=2
test("Duplicates both", [1, 1, 2, 2], [1, 2, 1, 2], 2, 2);

// Test 7: Tricky — guess has more of a color than secret
// Secret: [0, 1, 2, 3], Guess: [0, 0, 0, 0]
// Exact: pos 0 (0==0). Non-exact: secret [_, 1, 2, 3], guess [_, 0, 0, 0]
// Color 0: secret 0, guess 3 -> min(0,3)=0
// Total: red=1, white=0
test("Excess color in guess", [0, 1, 2, 3], [0, 0, 0, 0], 1, 0);

// Test 8: One exact match, rest are misplaced
// Secret: [0, 1, 2, 3], Guess: [0, 3, 1, 2]
// Exact: pos 0. Non-exact: secret [_, 1, 2, 3], guess [_, 3, 1, 2]
// Color 1: s=1, g=1 -> 1; Color 2: s=1, g=1 -> 1; Color 3: s=1, g=1 -> 1
// Total: red=1, white=3
test("1 red 3 white", [0, 1, 2, 3], [0, 3, 1, 2], 1, 3);

// Test 9: All same color in secret
// Secret: [3, 3, 3, 3], Guess: [3, 0, 0, 0]
// Exact: pos 0. Non-exact: secret [_, 3, 3, 3], guess [_, 0, 0, 0]
// Color 3: s=3, g=0 -> 0
// Total: red=1, white=0
test("Same color secret", [3, 3, 3, 3], [3, 0, 0, 0], 1, 0);

// Test 10: All same color everywhere
test("All same", [5, 5, 5, 5], [5, 5, 5, 5], 4, 0);

// Test 11: White pegs should not count exact match positions
// Secret: [0, 1, 0, 1], Guess: [0, 0, 1, 1]
// Exact: pos 0 (0==0), pos 3 (1==1). Non-exact: secret [_, 1, 0, _], guess [_, 0, 1, _]
// Color 0: s=1(pos2), g=1(pos1) -> 1; Color 1: s=1(pos1), g=1(pos2) -> 1
// Total: red=2, white=2
test("Exact exclusion", [0, 1, 0, 1], [0, 0, 1, 1], 2, 2);

console.log("\nAll tests passed!");
