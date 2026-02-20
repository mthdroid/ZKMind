'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import {
  computeFeedback,
  GuessEntry,
  MAX_GUESSES,
  CODE_LENGTH,
  COLORS,
  COLOR_NAMES,
} from '@/lib/mastermind';
import CodeSetup from '@/components/CodeSetup';
import GuessInput from '@/components/GuessInput';
import GuessRow from '@/components/GuessRow';
import ColorPeg from '@/components/ColorPeg';
import FeedbackPegs from '@/components/FeedbackPegs';

type DemoPhase = 'setup' | 'playing' | 'finished';

export default function DemoGame() {
  const [phase, setPhase] = useState<DemoPhase>('setup');
  const [secretCode, setSecretCode] = useState<number[]>([]);
  const [guessHistory, setGuessHistory] = useState<GuessEntry[]>([]);
  const [showSecret, setShowSecret] = useState(false);
  const [winner, setWinner] = useState<'codebreaker' | 'codemaker' | null>(null);
  const [lastAnimated, setLastAnimated] = useState(-1);

  const handleCommit = useCallback((code: number[]) => {
    setSecretCode(code);
    setPhase('playing');
  }, []);

  const handleGuess = useCallback(
    (guess: number[]) => {
      const feedback = computeFeedback(secretCode, guess);
      const entry: GuessEntry = { guess, feedback };
      const newHistory = [...guessHistory, entry];
      setGuessHistory(newHistory);
      setLastAnimated(newHistory.length - 1);

      // Check win conditions
      if (feedback.correctPosition === CODE_LENGTH) {
        setWinner('codebreaker');
        setPhase('finished');
        setShowSecret(true);
      } else if (newHistory.length >= MAX_GUESSES) {
        setWinner('codemaker');
        setPhase('finished');
        setShowSecret(true);
      }
    },
    [secretCode, guessHistory]
  );

  const handlePlayAgain = () => {
    setPhase('setup');
    setSecretCode([]);
    setGuessHistory([]);
    setShowSecret(false);
    setWinner(null);
    setLastAnimated(-1);
  };

  return (
    <main className="flex flex-col items-center min-h-screen p-4 gap-6">
      {/* Header */}
      <div className="flex items-center gap-4 w-full max-w-lg">
        <Link href="/" className="text-gray-500 hover:text-white text-sm">
          &larr; Back
        </Link>
        <h1 className="font-pixel text-lg text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400 flex-1 text-center">
          ZKMind Demo
        </h1>
        <div className="w-12" /> {/* Spacer for centering */}
      </div>

      {/* Phase: Setup */}
      {phase === 'setup' && (
        <div className="flex flex-col items-center gap-4 mt-8">
          <p className="text-xs text-gray-500 font-pixel">
            Local demo — no blockchain, instant feedback
          </p>
          <CodeSetup onCommit={handleCommit} />
        </div>
      )}

      {/* Phase: Playing */}
      {phase === 'playing' && (
        <div className="flex flex-col items-center gap-6 w-full max-w-lg">
          {/* Secret code (hidden/shown) */}
          <div className="flex items-center gap-3">
            <span className="font-pixel text-xs text-gray-500">Secret:</span>
            <div className="flex gap-2">
              {secretCode.map((color, i) => (
                <div key={i} className="relative">
                  {showSecret ? (
                    <ColorPeg colorIndex={color} size="sm" />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center">
                      <span className="text-gray-600 text-xs">?</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={() => setShowSecret(!showSecret)}
              className="text-xs text-gray-600 hover:text-gray-400 ml-2"
            >
              {showSecret ? 'Hide' : 'Peek'}
            </button>
          </div>

          {/* Guess history */}
          <div className="flex flex-col gap-2 w-full">
            {guessHistory.map((entry, i) => (
              <GuessRow
                key={i}
                entry={entry}
                index={i}
                animated={i === lastAnimated}
              />
            ))}
          </div>

          {/* Guess input */}
          <GuessInput
            onSubmit={handleGuess}
            guessNumber={guessHistory.length + 1}
            maxGuesses={MAX_GUESSES}
          />
        </div>
      )}

      {/* Phase: Finished */}
      {phase === 'finished' && (
        <div className="flex flex-col items-center gap-6 mt-8 w-full max-w-lg">
          {/* Winner announcement */}
          <div className="text-center">
            {winner === 'codebreaker' ? (
              <>
                <h2 className="font-pixel text-xl text-green-400 mb-2">
                  Code Cracked!
                </h2>
                <p className="text-gray-400">
                  CodeBreaker cracked the code in{' '}
                  <span className="text-cyan-400 font-bold">
                    {guessHistory.length}
                  </span>{' '}
                  guesses!
                </p>
              </>
            ) : (
              <>
                <h2 className="font-pixel text-xl text-purple-400 mb-2">
                  Code Unbroken!
                </h2>
                <p className="text-gray-400">
                  CodeMaker wins! Code survived all {MAX_GUESSES} guesses.
                </p>
              </>
            )}
          </div>

          {/* Reveal secret */}
          <div className="flex items-center gap-3">
            <span className="font-pixel text-xs text-gray-500">
              Secret Code:
            </span>
            <div className="flex gap-2">
              {secretCode.map((color, i) => (
                <ColorPeg key={i} colorIndex={color} size="md" />
              ))}
            </div>
          </div>

          {/* Full history */}
          <div className="flex flex-col gap-2 w-full">
            {guessHistory.map((entry, i) => (
              <GuessRow key={i} entry={entry} index={i} />
            ))}
          </div>

          {/* Play again */}
          <button
            onClick={handlePlayAgain}
            className="font-pixel text-sm px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 text-white transition-all"
          >
            Play Again
          </button>
        </div>
      )}
    </main>
  );
}
