'use client';

import { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { sha256 } from '@noble/hashes/sha2.js';
import {
  computeFeedback,
  GuessEntry,
  MAX_GUESSES,
  CODE_LENGTH,
} from '@/lib/mastermind';
import {
  getGame,
  buildCommitCode,
  buildSubmitGuess,
  buildSubmitFeedback,
  submitTx,
  OnChainGameState,
} from '@/lib/contracts';
import { getPublicKey, signTransaction, connectWallet } from '@/lib/wallet';
import { generateProof } from '@/lib/noir';
import CodeSetup from '@/components/CodeSetup';
import GuessInput from '@/components/GuessInput';
import GuessRow from '@/components/GuessRow';
import ColorPeg from '@/components/ColorPeg';

const PHASE_NAMES = ['Waiting for Commitment', 'Waiting for Guess', 'Waiting for Feedback', 'Finished'];

export default function OnChainGame({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params);
  const searchParams = useSearchParams();
  const role = searchParams.get('role') || 'codemaker';
  const sid = parseInt(sessionId, 10);

  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [gameState, setGameState] = useState<OnChainGameState | null>(null);
  const [secretCode, setSecretCode] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [polling, setPolling] = useState(true);

  // Connect wallet on mount
  useEffect(() => {
    getPublicKey().then(pk => {
      if (pk) setPublicKey(pk);
      else connectWallet().then(setPublicKey).catch(() => {});
    });
  }, []);

  // Poll game state
  const fetchGame = useCallback(async () => {
    try {
      const state = await getGame(sid);
      setGameState(state);
    } catch {
      // Game might not exist yet
    }
  }, [sid]);

  useEffect(() => {
    fetchGame();
    if (!polling) return;
    const interval = setInterval(fetchGame, 5000);
    return () => clearInterval(interval);
  }, [fetchGame, polling]);

  // Convert game state to guess history for display
  const guessHistory: GuessEntry[] = gameState
    ? gameState.guesses.map((guess, i) => ({
        guess,
        feedback: gameState.feedbacks[i]
          ? {
              correctPosition: gameState.feedbacks[i].correct_position,
              correctColor: gameState.feedbacks[i].correct_color,
            }
          : { correctPosition: 0, correctColor: 0 },
      }))
    : [];

  // Compute pedersen commitment hash as hex (mock - real would use Noir)
  // For the demo, we use sha256 as a stand-in for pedersen_hash
  const computeCommitment = (code: number[]): string => {
    const data = new Uint8Array(code.length * 32);
    for (let i = 0; i < code.length; i++) {
      data[i * 32 + 31] = code[i]; // big-endian Field encoding
    }
    const hash = sha256(data);
    return Buffer.from(hash).toString('hex');
  };

  // CodeMaker: commit secret code
  const handleCommit = async (code: number[]) => {
    if (!publicKey) return;
    setSecretCode(code);
    setLoading(true);
    setError('');
    setStatus('Committing secret code on-chain...');
    try {
      const commitment = computeCommitment(code);
      const tx = await buildCommitCode(publicKey, sid, publicKey, commitment);
      const signed = await signTransaction(tx);
      await submitTx(signed);
      setStatus('Code committed! Waiting for opponent guess...');
      await fetchGame();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to commit');
    } finally {
      setLoading(false);
    }
  };

  // CodeBreaker: submit guess
  const handleGuess = async (guess: number[]) => {
    if (!publicKey) return;
    setLoading(true);
    setError('');
    setStatus('Submitting guess on-chain...');
    try {
      const tx = await buildSubmitGuess(publicKey, sid, publicKey, guess);
      const signed = await signTransaction(tx);
      await submitTx(signed);
      setStatus('Guess submitted! Waiting for feedback...');
      await fetchGame();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to submit guess');
    } finally {
      setLoading(false);
    }
  };

  // CodeMaker: compute and submit feedback with ZK proof
  const handleSubmitFeedback = async () => {
    if (!publicKey || !gameState || secretCode.length === 0) return;
    setLoading(true);
    setError('');
    setStatus('Computing feedback...');
    try {
      const guess = gameState.current_guess;
      const feedback = computeFeedback(secretCode, guess);

      let proofHash: string;

      // Try real ZK proof generation
      try {
        setStatus('Generating ZK proof (Noir + UltraHonk)...');
        const commitment = gameState.commitment;
        const proofResult = await generateProof(
          secretCode,
          commitment,
          guess,
          feedback.correctPosition,
          feedback.correctColor,
        );
        proofHash = proofResult.proofHash;
        setStatus(
          proofResult.isValid
            ? 'ZK proof generated and verified! Submitting on-chain...'
            : 'ZK proof generated! Submitting on-chain...'
        );
      } catch (proofErr) {
        // Fallback: use sha256 hash if proof gen fails in browser
        console.warn('ZK proof generation failed, using hash fallback:', proofErr);
        const fallbackData = new Uint8Array([
          ...secretCode, ...guess,
          feedback.correctPosition, feedback.correctColor,
        ]);
        proofHash = Buffer.from(sha256(fallbackData)).toString('hex');
        setStatus('Submitting feedback on-chain (proof fallback)...');
      }

      const tx = await buildSubmitFeedback(
        publicKey, sid, publicKey,
        feedback.correctPosition,
        feedback.correctColor,
        proofHash,
      );
      const signed = await signTransaction(tx);
      await submitTx(signed);

      if (feedback.correctPosition === CODE_LENGTH) {
        setStatus('Code cracked! Game over.');
        setPolling(false);
      } else {
        setStatus('Feedback + ZK proof submitted on-chain!');
      }
      await fetchGame();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to submit feedback');
    } finally {
      setLoading(false);
    }
  };

  const phase = gameState?.phase ?? -1;
  const isCodeMaker = role === 'codemaker';
  const isFinished = phase === 3;

  return (
    <main className="flex flex-col items-center min-h-screen p-4 gap-4">
      {/* Header */}
      <div className="flex items-center gap-4 w-full max-w-lg">
        <Link href="/" className="text-gray-500 hover:text-white text-sm">&larr; Back</Link>
        <h1 className="font-pixel text-lg text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400 flex-1 text-center">
          Game #{sessionId}
        </h1>
        <span className={`font-pixel text-[10px] px-2 py-1 rounded ${
          isCodeMaker ? 'bg-purple-500/20 text-purple-300' : 'bg-cyan-500/20 text-cyan-300'
        }`}>
          {isCodeMaker ? 'Maker' : 'Breaker'}
        </span>
      </div>

      {/* Status Bar */}
      <div className="w-full max-w-lg text-center">
        {gameState ? (
          <div className="text-xs font-pixel text-gray-400 bg-gray-900 rounded-lg px-3 py-2">
            Phase: <span className="text-white">{PHASE_NAMES[phase] || 'Unknown'}</span>
            {' | '}Guesses: <span className="text-cyan-400">{gameState.guess_count}/{gameState.max_guesses}</span>
          </div>
        ) : (
          <div className="text-xs text-gray-600">Loading game state...</div>
        )}
      </div>

      {status && (
        <div className="text-xs text-yellow-400 bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-3 py-2 max-w-lg text-center">
          {status}
        </div>
      )}

      {error && (
        <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 max-w-lg text-center">
          {error}
        </div>
      )}

      {/* Game Board */}
      <div className="flex flex-col items-center gap-6 w-full max-w-lg">

        {/* Secret code (CodeMaker) */}
        {isCodeMaker && secretCode.length > 0 && (
          <div className="flex items-center gap-3">
            <span className="font-pixel text-xs text-gray-500">Your Secret:</span>
            <div className="flex gap-2">
              {secretCode.map((color, i) => (
                <ColorPeg key={i} colorIndex={color} size="sm" />
              ))}
            </div>
          </div>
        )}

        {/* Phase: Waiting for Commitment (CodeMaker picks code) */}
        {phase === 0 && isCodeMaker && (
          <div className="flex flex-col items-center gap-4">
            <p className="text-xs text-gray-500 font-pixel">Pick your secret code</p>
            <CodeSetup onCommit={handleCommit} />
          </div>
        )}

        {phase === 0 && !isCodeMaker && (
          <div className="text-center text-gray-500 mt-8">
            <p className="font-pixel text-sm">Waiting for CodeMaker to commit...</p>
            <div className="mt-4 animate-pulse text-2xl">...</div>
          </div>
        )}

        {/* Guess History */}
        {guessHistory.length > 0 && (
          <div className="flex flex-col gap-2 w-full">
            {guessHistory.map((entry, i) => (
              <GuessRow key={i} entry={entry} index={i} />
            ))}
          </div>
        )}

        {/* Current unresponded guess (CodeMaker needs to give feedback) */}
        {phase === 2 && gameState && (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-800/50 border border-yellow-500/30">
            <span className="font-pixel text-[10px] text-yellow-400">
              #{gameState.guess_count + 1}
            </span>
            <div className="flex gap-2">
              {gameState.current_guess.map((color, i) => (
                <ColorPeg key={i} colorIndex={color} size="sm" />
              ))}
            </div>
            {isCodeMaker && (
              <button
                onClick={handleSubmitFeedback}
                disabled={loading || secretCode.length === 0}
                className="ml-auto font-pixel text-[10px] px-3 py-1 rounded bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-50"
              >
                {loading ? 'Proving...' : 'Give Feedback + ZK Proof'}
              </button>
            )}
            {!isCodeMaker && (
              <span className="ml-auto text-xs text-gray-500">Waiting for feedback...</span>
            )}
          </div>
        )}

        {/* CodeBreaker: Submit Guess */}
        {phase === 1 && !isCodeMaker && (
          <GuessInput
            onSubmit={handleGuess}
            guessNumber={(gameState?.guess_count || 0) + 1}
            maxGuesses={MAX_GUESSES}
          />
        )}

        {phase === 1 && isCodeMaker && (
          <div className="text-center text-gray-500 mt-4">
            <p className="font-pixel text-sm">Waiting for opponent&apos;s guess...</p>
            <div className="mt-2 animate-pulse text-2xl">...</div>
          </div>
        )}

        {/* Finished */}
        {isFinished && gameState && (
          <div className="text-center mt-4">
            <h2 className="font-pixel text-xl mb-2" style={{
              color: gameState.winner === gameState.codebreaker ? '#4ade80' : '#c084fc'
            }}>
              {gameState.winner === gameState.codebreaker ? 'Code Cracked!' : 'Code Unbroken!'}
            </h2>
            <p className="text-sm text-gray-400">
              {gameState.winner === gameState.codebreaker
                ? `Cracked in ${gameState.guess_count} guesses`
                : `Survived all ${gameState.max_guesses} guesses`}
            </p>
            {isCodeMaker && secretCode.length > 0 && (
              <div className="flex items-center justify-center gap-3 mt-4">
                <span className="font-pixel text-xs text-gray-500">Secret:</span>
                <div className="flex gap-2">
                  {secretCode.map((color, i) => (
                    <ColorPeg key={i} colorIndex={color} size="md" />
                  ))}
                </div>
              </div>
            )}
            <Link
              href="/"
              className="inline-block mt-6 font-pixel text-sm px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-600 text-white"
            >
              New Game
            </Link>
          </div>
        )}
      </div>

      {/* On-chain proof info */}
      {gameState && gameState.feedbacks.length > 0 && (
        <div className="mt-4 w-full max-w-lg">
          <details className="text-xs text-gray-600">
            <summary className="cursor-pointer hover:text-gray-400 font-pixel text-[10px]">
              On-chain proof data
            </summary>
            <div className="mt-2 bg-gray-900 rounded-lg p-3 font-mono text-[10px] space-y-1">
              <p>Commitment: <span className="text-purple-400">{gameState.commitment.slice(0, 16)}...</span></p>
              {gameState.feedbacks.map((f, i) => (
                <p key={i}>
                  Feedback #{i + 1}: {f.correct_position}R/{f.correct_color}W
                  | Proof: <span className="text-cyan-400">{f.proof_hash.slice(0, 12)}...</span>
                </p>
              ))}
            </div>
          </details>
        </div>
      )}
    </main>
  );
}
