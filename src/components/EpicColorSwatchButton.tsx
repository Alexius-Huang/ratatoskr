import { useState } from 'react';
import { EPIC_PALETTE, defaultEpicColor } from '../lib/epicColor';

type Props = {
  epicNumber: number;
  color?: string;
  onChange: (hex: string | null) => void;
  disabled?: boolean;
};

export function EpicColorSwatchButton({ epicNumber, color, onChange, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const displayColor = color ?? defaultEpicColor(epicNumber);
  const hasExplicitColor = color !== undefined;

  const handleTriggerClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!disabled) setOpen((prev) => !prev);
  };

  const handleTriggerBlur = () => {
    setTimeout(() => setOpen(false), 150);
  };

  const handleSelect = (e: React.MouseEvent, hex: string) => {
    e.stopPropagation();
    onChange(hex);
    setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
    setOpen(false);
  };

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        aria-label={hasExplicitColor ? `Epic color: ${color}. Click to change` : 'Set epic color'}
        onClick={handleTriggerClick}
        onBlur={handleTriggerBlur}
        disabled={disabled}
        className="w-3.5 h-3.5 rounded-full border-2 transition-colors disabled:cursor-not-allowed focus:outline-none focus:ring-1 focus:ring-nord-8"
        style={{ backgroundColor: displayColor, borderColor: hasExplicitColor ? displayColor : '#4c566a' }}
      />

      {open && (
        <div
          className="absolute top-full left-0 mt-1 z-50 bg-nord-1 border border-nord-3 rounded shadow-lg p-2 w-[7.5rem]"
          onMouseDown={(e) => e.preventDefault()}
        >
          <div className="grid grid-cols-4 gap-1 mb-2">
            {EPIC_PALETTE.map((hex) => (
              <button
                key={hex}
                type="button"
                aria-label={hex}
                onClick={(e) => handleSelect(e, hex)}
                className="w-5 h-5 rounded-full border-2 transition-all hover:scale-110 focus:outline-none"
                style={{
                  backgroundColor: hex,
                  borderColor: color === hex ? '#eceff4' : hex,
                }}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={handleClear}
            className="w-full text-center text-xs text-nord-4 hover:text-nord-6 transition-colors py-0.5"
          >
            Reset to default
          </button>
        </div>
      )}
    </div>
  );
}
