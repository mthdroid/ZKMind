'use client';

import { GuessEntry } from '@/lib/mastermind';
import ColorPeg from './ColorPeg';
import FeedbackPegs from './FeedbackPegs';

interface GuessRowProps {
  entry: GuessEntry;
  index: number;
  animated?: boolean;
}

export default function GuessRow({ entry, index, animated = false }: GuessRowProps) {
  return (
    <div className="flex items-center gap-4 py-2 px-3 bg-gray-900/50 rounded-lg border border-gray-800">
      <span className="text-xs font-pixel text-gray-500 w-6 text-right">
        {index + 1}
      </span>
      <div className="flex gap-2">
        {entry.guess.map((color, i) => (
          <ColorPeg key={i} colorIndex={color} size="md" />
        ))}
      </div>
      <div className="ml-2">
        <FeedbackPegs feedback={entry.feedback} animated={animated} />
      </div>
      {entry.feedback.correctPosition === 4 && (
        <span className="text-green-400 font-pixel text-xs ml-2 neon-text">CRACKED!</span>
      )}
    </div>
  );
}
