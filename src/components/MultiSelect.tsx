'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

interface Props {
  label: string;
  options: string[];
  selected: string[];
  onChange: (values: string[]) => void;
}

export default function MultiSelect({ label, options, selected, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const filtered = query
    ? options.filter((o) => o.toLowerCase().includes(query.toLowerCase()))
    : options;

  function toggle(value: string) {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  }

  function selectAll() {
    onChange(filtered.length < options.length ? [...new Set([...selected, ...filtered])] : options);
  }

  function clearAll() {
    onChange(filtered.length < options.length ? selected.filter((v) => !filtered.includes(v)) : []);
  }

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false);
      setQuery('');
      inputRef.current?.blur();
    }
  }, []);

  const count = selected.length;
  const hasSelection = count > 0 && count < options.length;

  return (
    <div ref={ref} className="relative">
      <div
        onClick={() => { setOpen(true); inputRef.current?.focus(); }}
        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-colors cursor-text w-full
          ${hasSelection
            ? 'bg-blue-600 border-blue-600'
            : 'bg-white border-gray-300 hover:border-gray-400'
          }`}
      >
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          onClick={(e) => e.stopPropagation()}
          placeholder={hasSelection ? `${label} (${count})` : label}
          className={`flex-1 bg-transparent outline-none text-sm font-medium min-w-0
            ${hasSelection
              ? 'text-white placeholder-white/90'
              : 'text-gray-700 placeholder-gray-600'
            }`}
        />
        <svg
          className={`w-4 h-4 flex-shrink-0 transition-transform pointer-events-none
            ${open ? 'rotate-180' : ''}
            ${hasSelection ? 'text-white' : 'text-gray-400'}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-full min-w-[200px] bg-white rounded-lg border border-gray-200 shadow-lg overflow-hidden">
          <div className="flex gap-2 px-2 py-1.5 border-b border-gray-100">
            <button
              onMouseDown={(e) => { e.preventDefault(); selectAll(); }}
              className="flex-1 text-xs text-blue-600 hover:text-blue-800 font-medium py-0.5"
              type="button"
            >
              {query ? 'Add all' : 'All'}
            </button>
            <button
              onMouseDown={(e) => { e.preventDefault(); clearAll(); }}
              className="flex-1 text-xs text-gray-500 hover:text-gray-700 font-medium py-0.5"
              type="button"
            >
              {query ? 'Remove all' : 'Clear'}
            </button>
          </div>
          <div className="max-h-56 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-3 py-3 text-sm text-gray-400 text-center">No results</p>
            ) : (
              filtered.map((opt) => (
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
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
