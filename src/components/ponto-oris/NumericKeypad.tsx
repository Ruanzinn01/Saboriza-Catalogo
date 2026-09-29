import { Delete } from "lucide-react";

interface NumericKeypadProps {
  onDigit: (digit: string) => void;
  onBackspace: () => void;
  disabled?: boolean;
}

const ROWS = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
];

export function NumericKeypad({ onDigit, onBackspace, disabled }: NumericKeypadProps) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {ROWS.flat().map((digit) => (
        <button
          key={digit}
          type="button"
          disabled={disabled}
          onClick={() => onDigit(digit)}
          className="h-16 rounded-2xl bg-white text-2xl font-semibold text-[#26313D] shadow-sm transition active:scale-95 active:bg-[#F4F6F8] disabled:opacity-50"
        >
          {digit}
        </button>
      ))}
      <div />
      <button
        type="button"
        disabled={disabled}
        onClick={() => onDigit("0")}
        className="h-16 rounded-2xl bg-white text-2xl font-semibold text-[#26313D] shadow-sm transition active:scale-95 active:bg-[#F4F6F8] disabled:opacity-50"
      >
        0
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={onBackspace}
        aria-label="Apagar"
        className="flex h-16 items-center justify-center rounded-2xl bg-white text-[#26313D] shadow-sm transition active:scale-95 active:bg-[#F4F6F8] disabled:opacity-50"
      >
        <Delete size={24} />
      </button>
    </div>
  );
}
