import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

const normalizeValues = (value) => (Array.isArray(value) ? value : []);
const stripEmailSuffix = (value = '') => value.replace(/\s*\([^)]*@[^)]*\)\s*$/, '').trim();

const MultiSelectDropdown = ({
  label,
  placeholder = 'Select options',
  helperText,
  options = [],
  selectedValues = [],
  onToggle,
  emptyMessage = 'No options available.',
}) => {
  const normalizedSelectedValues = normalizeValues(selectedValues);
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    const handleDocumentClick = (event) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleDocumentClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleDocumentClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const selectedSummary = useMemo(() => {
    const selectedLabels = options
      .filter((option) => normalizedSelectedValues.includes(option.id))
      .map((option) => stripEmailSuffix(option.label || option.name));

    if (!selectedLabels.length) {
      return placeholder;
    }

    if (selectedLabels.length <= 2) {
      return selectedLabels.join(', ');
    }

    return `${selectedLabels.slice(0, 2).join(', ')} +${selectedLabels.length - 2} more`;
  }, [normalizedSelectedValues, options, placeholder]);

  return (
    <div ref={rootRef} className="relative">
      {label ? (
        <label className="mb-1 block text-sm font-medium text-slate-700">{label}</label>
      ) : null}

      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-300 bg-white px-3 py-2 text-left text-sm text-slate-700"
        aria-expanded={isOpen}
      >
        <div className="min-w-0">
          <p className="line-clamp-1 font-medium text-slate-800">{selectedSummary}</p>
          {helperText ? <p className="line-clamp-1 text-xs text-slate-500">{helperText}</p> : null}
        </div>
        <ChevronDown
          size={16}
          className={`shrink-0 text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 z-40 mt-2 rounded-xl border border-slate-300 bg-white shadow-lg">
          <div className="max-h-64 space-y-2 overflow-auto px-3 py-3">
            {options.length ? options.map((option) => (
              <label
                key={option.id}
                className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
              >
                <input
                  type="checkbox"
                  checked={normalizedSelectedValues.includes(option.id)}
                  onChange={() => onToggle(option.id)}
                  className="mt-0.5 rounded border-slate-300 text-primary focus:ring-primary"
                />
                <span className="min-w-0">
                  <span className="block break-words font-medium text-slate-800">
                    {stripEmailSuffix(option.label || option.name)}
                  </span>
                  {option.description ? (
                    <span className="block break-words text-xs text-slate-500">{option.description}</span>
                  ) : null}
                </span>
              </label>
            )) : (
              <p className="text-sm text-slate-500">{emptyMessage}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MultiSelectDropdown;
