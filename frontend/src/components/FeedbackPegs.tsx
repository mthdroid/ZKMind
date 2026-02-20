'use client';

import { Feedback } from '@/lib/mastermind';

interface FeedbackPegsProps {
  feedback: Feedback;
  animated?: boolean;
}

export default function FeedbackPegs({ feedback, animated = false }: FeedbackPegsProps) {
  const pegs: ('red' | 'white' | 'empty')[] = [];

  for (let i = 0; i < feedback.correctPosition; i++) pegs.push('red');
  for (let i = 0; i < feedback.correctColor; i++) pegs.push('white');
  while (pegs.length < 4) pegs.push('empty');

  return (
    <div className="grid grid-cols-2 gap-1">
      {pegs.map((peg, i) => (
        <div
          key={i}
          className={`
            w-4 h-4 rounded-full border
            ${peg === 'red' ? 'bg-red-500 border-red-400' : ''}
            ${peg === 'white' ? 'bg-white border-gray-300' : ''}
            ${peg === 'empty' ? 'bg-gray-800 border-gray-700' : ''}
            ${animated ? 'peg-animate' : ''}
          `}
          style={animated ? { animationDelay: `${i * 0.15}s` } : undefined}
        />
      ))}
    </div>
  );
}
