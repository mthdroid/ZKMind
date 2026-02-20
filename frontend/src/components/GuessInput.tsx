'use client';

import { useState } from 'react';
import { CODE_LENGTH } from '@/lib/mastermind';
import ColorPeg from './ColorPeg';
import ColorPicker from './ColorPicker';

interface GuessInputProps {
  onSubmit: (guess: number[]) => void;
  disabled?: boolean;
  guessNumber: number;
  maxGuesses: number;
}

export default function GuessInput({
  onSubmit,
  disabled,
  guessNumber,
  maxGuesses,
}: GuessInputProps) {
  const [guess, setGuess] = useState<(number | null)[]>([null, null, null, null]);
  const [activeSlot, setActiveSlot] = useState(0);
  const [selectedColor, setSelectedColor] = useState<number | null>(null);

  const handleColorSelect = (color: number) => {
    setSelectedColor(color);
    const newGuess = [...guess];
    newGuess[activeSlot] = color;
    setGuess(newGuess);
    const nextEmpty = newGuess.findIndex((c, i) => i > activeSlot && c === null);
    if (nextEmpty !== -1) setActiveSlot(nextEmpty);
  };

  const handleSubmit = () => {
    if (guess.every((c) => c !== null)) {
      onSubmit(guess as number[]);
      setGuess([null, null, null, null]);
      setActiveSlot(0);
      setSelectedColor(null);
    }
  };

  const isComplete = guess.every((c) => c !== null);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex items-center gap-3">
        <span className="font-pixel text-xs text-cyan-400">
          Guess {guessNumber}/{maxGuesses}
        </span>
      </div>

      {/* Guess slots */}
      <div className="flex gap-3">
        {guess.map((color, i) => (
          <div
            key={i}
            className={`p-1 rounded-lg ${activeSlot === i ? 'ring-2 ring-cyan-400' : ''}`}
          >
            <ColorPeg
              colorIndex={color}
              size="lg"
              onClick={() => setActiveSlot(i)}
            />
          </div>
        ))}
      </div>

      {/* Color picker */}
      <ColorPicker onSelect={handleColorSelect} selectedColor={selectedColor} />

      {/* Submit button */}
      <button
        onClick={handleSubmit}
        disabled={!isComplete || disabled}
        className={`
          font-pixel text-sm px-6 py-3 rounded-lg transition-all
          ${
            isComplete && !disabled
              ? 'bg-cyan-600 hover:bg-cyan-500 text-white cursor-pointer'
              : 'bg-gray-800 text-gray-600 cursor-not-allowed'
          }
        `}
      >
        {disabled ? 'Waiting...' : 'Guess!'}
      </button>
    </div>
  );
}
