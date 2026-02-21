'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { connectWallet, getPublicKey, isFreighterInstalled } from '@/lib/wallet';
import { buildNewGame, submitTx, ZKMIND_CONTRACT_ID, VERIFIER_CONTRACT_ID } from '@/lib/contracts';
import { signTransaction } from '@/lib/wallet';

export default function Home() {
  const [sessionId, setSessionId] = useState('');
  const [role, setRole] = useState<'codemaker' | 'codebreaker'>('codemaker');
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [hasFreighter, setHasFreighter] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    isFreighterInstalled().then(setHasFreighter);
    getPublicKey().then(setPublicKey);
  }, []);

  const handleConnect = async () => {
    setConnecting(true);
    setError('');
    try {
      const key = await connectWallet();
      setPublicKey(key);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Connection failed');
    } finally {
      setConnecting(false);
    }
  };

  const generateSessionId = () => {
    const id = Math.floor(Math.random() * 0xffffff) + 1;
    setSessionId(id.toString());
  };

  const handleCreateGame = async () => {
    if (!publicKey || !sessionId) return;
    setCreating(true);
    setError('');
    try {
      const sid = parseInt(sessionId, 10);
      const tx = await buildNewGame(publicKey, sid, publicKey, publicKey);
      const signed = await signTransaction(tx);
      await submitTx(signed);
      window.location.href = `/game/${sid}?role=${role}`;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create game');
    } finally {
      setCreating(false);
    }
  };

  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-4 gap-8">
      <div className="text-center">
        <h1 className="font-pixel text-3xl md:text-4xl text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-500 to-cyan-400 mb-4">
          ZKMind
        </h1>
        <p className="font-pixel text-xs text-gray-400 mb-2">ZK Mastermind on Stellar</p>
        <p className="text-sm text-gray-500 max-w-md">
          Mastermind where your opponent{' '}
          <span className="text-cyan-400 font-semibold">can&apos;t lie</span> about
          the clues. Every feedback proven by zero-knowledge proofs.
        </p>
      </div>

      <div className="w-full max-w-sm">
        {publicKey ? (
          <div className="flex items-center justify-center gap-2 text-xs text-green-400 bg-green-500/10 border border-green-500/30 rounded-lg px-4 py-2">
            <span className="w-2 h-2 rounded-full bg-green-400" />
            <span className="font-mono truncate max-w-[200px]">{publicKey}</span>
          </div>
        ) : (
          <button
            onClick={handleConnect}
            disabled={connecting}
            className="w-full font-pixel text-xs px-6 py-3 rounded-lg bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 text-white transition-all disabled:opacity-50"
          >
            {connecting ? 'Connecting...' : hasFreighter ? 'Connect Freighter' : 'Install Freighter'}
          </button>
        )}
      </div>

      <div className="flex flex-col gap-6 w-full max-w-sm">
        <Link
          href="/game/demo"
          className="block text-center font-pixel text-sm px-6 py-4 rounded-xl bg-gradient-to-r from-gray-700 to-gray-600 hover:from-gray-600 hover:to-gray-500 text-white transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          Play Local Demo
        </Link>

        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-gray-800" />
          <span className="font-pixel text-[10px] text-gray-600">PLAY ON-CHAIN</span>
          <div className="flex-1 h-px bg-gray-800" />
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => setRole('codemaker')}
            className={`flex-1 font-pixel text-xs py-3 rounded-lg border transition-all ${
              role === 'codemaker'
                ? 'border-purple-500 bg-purple-500/20 text-purple-300'
                : 'border-gray-700 text-gray-500 hover:border-gray-600'
            }`}
          >
            CodeMaker
          </button>
          <button
            onClick={() => setRole('codebreaker')}
            className={`flex-1 font-pixel text-xs py-3 rounded-lg border transition-all ${
              role === 'codebreaker'
                ? 'border-cyan-500 bg-cyan-500/20 text-cyan-300'
                : 'border-gray-700 text-gray-500 hover:border-gray-600'
            }`}
          >
            CodeBreaker
          </button>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Session ID (number)"
            value={sessionId}
            onChange={(e) => setSessionId(e.target.value.replace(/[^0-9]/g, ''))}
            className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm font-mono text-gray-300 placeholder-gray-600 focus:outline-none focus:border-purple-500"
          />
          <button onClick={generateSessionId} className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-400 hover:text-white transition-colors">
            Random
          </button>
        </div>

        <Link
          href={sessionId ? `/game/${sessionId}?role=${role}` : '#'}
          className={`block text-center font-pixel text-xs px-6 py-3 rounded-lg transition-all ${
            sessionId && publicKey
              ? 'bg-gray-800 border border-gray-600 hover:bg-gray-700 text-white'
              : 'bg-gray-900 border border-gray-800 text-gray-700 pointer-events-none'
          }`}
        >
          Join Existing Game
        </Link>

        <button
          onClick={handleCreateGame}
          disabled={!sessionId || !publicKey || creating}
          className={`font-pixel text-xs px-6 py-3 rounded-lg transition-all ${
            sessionId && publicKey && !creating
              ? 'bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 text-white'
              : 'bg-gray-900 border border-gray-800 text-gray-700 cursor-not-allowed'
          }`}
        >
          {creating ? 'Creating...' : 'Create New Game'}
        </button>

        {error && (
          <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 text-center">
            {error}
          </div>
        )}
      </div>

      {/* How it Works */}
      <div className="w-full max-w-sm mt-2">
        <details className="group">
          <summary className="cursor-pointer font-pixel text-[10px] text-gray-600 hover:text-gray-400 text-center">
            How it works
          </summary>
          <div className="mt-3 grid grid-cols-1 gap-3 text-xs text-gray-400">
            <div className="flex gap-3 items-start bg-gray-900/50 rounded-lg p-3 border border-gray-800">
              <span className="text-purple-400 font-pixel text-lg leading-none">1</span>
              <div>
                <p className="text-gray-300 font-medium">CodeMaker picks a secret</p>
                <p className="text-[11px] mt-1">4 colors are chosen and committed on-chain via Pedersen hash. The secret never leaves your browser.</p>
              </div>
            </div>
            <div className="flex gap-3 items-start bg-gray-900/50 rounded-lg p-3 border border-gray-800">
              <span className="text-cyan-400 font-pixel text-lg leading-none">2</span>
              <div>
                <p className="text-gray-300 font-medium">CodeBreaker guesses</p>
                <p className="text-[11px] mt-1">Each guess is submitted on-chain. Red pegs = right color + position. White pegs = right color, wrong position.</p>
              </div>
            </div>
            <div className="flex gap-3 items-start bg-gray-900/50 rounded-lg p-3 border border-gray-800">
              <span className="text-pink-400 font-pixel text-lg leading-none">3</span>
              <div>
                <p className="text-gray-300 font-medium">ZK proves honesty</p>
                <p className="text-[11px] mt-1">A Noir circuit generates an UltraHonk proof that feedback is correct - without revealing the secret code. No lying possible.</p>
              </div>
            </div>
          </div>
        </details>
      </div>

      <div className="text-center text-xs text-gray-700 mt-4 space-y-1">
        <p className="font-mono text-[10px]">Game: {ZKMIND_CONTRACT_ID.slice(0, 12)}...</p>
        <p className="font-mono text-[10px]">Verifier: {VERIFIER_CONTRACT_ID.slice(0, 12)}...</p>
        <p className="mt-2">
          <span className="text-purple-500">Noir</span> +{' '}
          <span className="text-cyan-500">Stellar</span> +{' '}
          <span className="text-pink-500">UltraHonk</span>
        </p>
        <p>Stellar Hacks: ZK Gaming 2026</p>
      </div>
    </main>
  );
}
