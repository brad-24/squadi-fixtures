'use client';

import { useState, useRef, useEffect } from 'react';

interface Props {
  label: string;
  options: string[];
  selected: string[];
  onChange: (values: string[]) => void;
}

export default function MultiSelect({ label, options, selected, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function toggle(value: string) {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  }

  function selectAll() {
    onChange(options);
  }

  function clearAll() {
    onChange([]);
  }

  const count = selected.length;
  const hasSelection = count > 0 && count < options.length;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-colors w-full justify-between
          ${hasSelection
            ? 'bg-blue-600 text-white border-blue-600'
            : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
          }`}
        type="button"
      >
        <span className="truncate">
          {hasSelection ? `${label} (${count})` : label}
        </span>
        <svg
          className={`w-4 h-4 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full min-w-[200px] bg-white rounded-lg border border-gray-200 shadow-lg overflow-hidden">
          <div className="flex gap-2 p-2 border-b border-gray-100">
            <button
              onClick={selectAll}
              className="flex-1 text-xs text-blue-600 hover:text-blue-800 font-medium py-1"
              type="button"
            >
              All
            </button>
            <button
              onClick={clearAll}
              className="flex-1 text-xs text-gray-500 hover:text-gray-700 font-medium py-1"
              type="button"
            >
              Clear
            </button>
          </div>
          <div className="max-h-56 overflow-y-auto">
            {options.map((opt) => (
              <label
                key={opt}
                className="flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(opt)}
                  onChange={() => toggle(opt)}
                  className="w-4 h-4 text-blue-600 rounded border-gray-300 accent-blue-600"
                />
                <span className="text-sm text-gray-700">{opt}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
