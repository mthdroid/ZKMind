'use client';

import { useState } from 'react';
import { CODE_LENGTH } from '@/lib/mastermind';
import ColorPeg from './ColorPeg';
import ColorPicker from './ColorPicker';

interface CodeSetupProps {
  onCommit: (code: number[]) => void;
  loading?: boolean;
}

export default function CodeSetup({ onCommit, loading }: CodeSetupProps) {
  const [code, setCode] = useState<(number | null)[]>([null, null, null, null]);
  const [activeSlot, setActiveSlot] = useState(0);
  const [selectedColor, setSelectedColor] = useState<number | null>(null);

  const handleColorSelect = (color: number) => {
    setSelectedColor(color);
    const newCode = [...code];
    newCode[activeSlot] = color;
    setCode(newCode);
    // Auto-advance to next empty slot
    const nextEmpty = newCode.findIndex((c, i) => i > activeSlot && c === null);
    if (nextEmpty !== -1) setActiveSlot(nextEmpty);
  };

  const handleSlotClick = (index: number) => {
    setActiveSlot(index);
  };

  const isComplete = code.every((c) => c !== null);

  return (
    <div className="flex flex-col items-center gap-6">
      <h2 className="font-pixel text-lg text-purple-400 neon-text">
        Pick Your Secret Code
      </h2>
      <p className="text-gray-400 text-sm text-center">
        Choose 4 colors. Only you will know this code.
      </p>

      {/* Code slots */}
      <div className="flex gap-3">
        {code.map((color, i) => (
          <div
            key={i}
            className={`p-1 rounded-lg ${
              activeSlot === i ? 'ring-2 ring-yellow-400' : ''
            }`}
          >
            <ColorPeg
              colorIndex={color}
              size="lg"
              onClick={() => handleSlotClick(i)}
            />
          </div>
        ))}
      </div>

      {/* Color picker */}
      <ColorPicker onSelect={handleColorSelect} selectedColor={selectedColor} />

      {/* Lock button */}
      <button
        onClick={() => isComplete && onCommit(code as number[])}
        disabled={!isComplete || loading}
        className={`
          font-pixel text-sm px-6 py-3 rounded-lg transition-all
          ${
            isComplete && !loading
              ? 'bg-purple-600 hover:bg-purple-500 text-white cursor-pointer pulse-glow text-purple-400'
              : 'bg-gray-800 text-gray-600 cursor-not-allowed'
          }
        `}
      >
        {loading ? 'Locking...' : 'Lock Code'}
      </button>

      {isComplete && (
        <p className="text-xs text-gray-500 text-center max-w-xs">
          Your code will be hashed (Pedersen) and committed on-chain.
          <br />
          The secret stays with you until the game ends.
        </p>
      )}
    </div>
  );
}
