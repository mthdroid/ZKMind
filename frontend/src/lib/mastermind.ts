/**
 * Mastermind game logic — shared between frontend and proof generation.
 */

export const COLORS = ['#EF4444', '#3B82F6', '#22C55E', '#EAB308', '#A855F7', '#F97316'] as const;
export const COLOR_NAMES = ['Red', 'Blue', 'Green', 'Yellow', 'Purple', 'Orange'] as const;
export const CODE_LENGTH = 4;
export const NUM_COLORS = 6;
export const MAX_GUESSES = 12;

export interface Feedback {
  correctPosition: number; // Red pegs
  correctColor: number;    // White pegs
}

/**
 * Compute Mastermind feedback for a guess against a secret code.
 * This is the same algorithm implemented in the Noir circuit.
 */
export function computeFeedback(secret: number[], guess: number[]): Feedback {
  // Step 1: Count exact matches (red pegs)
  let exactMatches = 0;
  const isExact = [false, false, false, false];

  for (let i = 0; i < CODE_LENGTH; i++) {
    if (secret[i] === guess[i]) {
      exactMatches++;
      isExact[i] = true;
    }
  }

  // Step 2: Count color matches excluding exact matches (white pegs)
  let colorMatches = 0;
  for (let color = 0; color < NUM_COLORS; color++) {
    let countInSecret = 0;
    let countInGuess = 0;

    for (let i = 0; i < CODE_LENGTH; i++) {
      if (!isExact[i] && secret[i] === color) countInSecret++;
      if (!isExact[i] && guess[i] === color) countInGuess++;
    }

    colorMatches += Math.min(countInSecret, countInGuess);
  }

  return { correctPosition: exactMatches, correctColor: colorMatches };
}

export type GamePhase =
  | 'lobby'
  | 'waiting_for_commitment'
  | 'waiting_for_guess'
  | 'waiting_for_feedback'
  | 'finished';

export type PlayerRole = 'codemaker' | 'codebreaker';

export interface GuessEntry {
  guess: number[];
  feedback: Feedback;
}
