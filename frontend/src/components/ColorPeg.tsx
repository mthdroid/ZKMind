'use client';

import { COLORS, COLOR_NAMES } from '@/lib/mastermind';

interface ColorPegProps {
  colorIndex: number | null;
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  selected?: boolean;
  className?: string;
}

const sizes = {
  sm: 'w-6 h-6',
  md: 'w-10 h-10',
  lg: 'w-14 h-14',
};

export default function ColorPeg({ colorIndex, size = 'md', onClick, selected, className = '' }: ColorPegProps) {
  const sizeClass = sizes[size];
  const color = colorIndex !== null ? COLORS[colorIndex] : undefined;
  const name = colorIndex !== null ? COLOR_NAMES[colorIndex] : 'Empty';

  return (
    <button
      type="button"
      onClick={onClick}
      title={name}
      className={`
        ${sizeClass} rounded-full border-2 transition-all duration-150
        ${color ? 'border-white/30' : 'border-gray-600 border-dashed'}
        ${selected ? 'ring-2 ring-yellow-400 ring-offset-2 ring-offset-gray-950 scale-110' : ''}
        ${onClick ? 'cursor-pointer hover:scale-110 active:scale-95' : 'cursor-default'}
        ${className}
      `}
      style={color ? { backgroundColor: color } : { backgroundColor: '#1f2937' }}
      disabled={!onClick}
    />
  );
}
