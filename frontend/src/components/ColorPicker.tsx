'use client';

import { COLORS, COLOR_NAMES, NUM_COLORS } from '@/lib/mastermind';
import ColorPeg from './ColorPeg';

interface ColorPickerProps {
  onSelect: (colorIndex: number) => void;
  selectedColor: number | null;
}

export default function ColorPicker({ onSelect, selectedColor }: ColorPickerProps) {
  return (
    <div className="flex gap-3 justify-center">
      {Array.from({ length: NUM_COLORS }, (_, i) => (
        <div key={i} className="flex flex-col items-center gap-1">
          <ColorPeg
            colorIndex={i}
            size="lg"
            onClick={() => onSelect(i)}
            selected={selectedColor === i}
          />
          <span className="text-[10px] font-pixel text-gray-400">{COLOR_NAMES[i]}</span>
        </div>
      ))}
    </div>
  );
}
