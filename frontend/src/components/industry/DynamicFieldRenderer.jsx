/**
 * Dynamic Field Renderer
 * Renders an accessible, responsive form control based on an industry field definition.
 */

import React from 'react';

export default function DynamicFieldRenderer({
  field,
  value,
  onChange,
  error,
  disabled = false,
}) {
  if (!field || !field.key) return null;

  const {
    key,
    label,
    type,
    required = false,
    options = [],
    placeholder = '',
    helpText = '',
    validation = {},
  } = field;

  const fieldId = `field_${key}`;

  const renderControl = () => {
    switch (type) {
      case 'text':
      case 'phone':
      case 'url':
        return (
          <input
            id={fieldId}
            name={key}
            type={type === 'phone' ? 'tel' : type === 'url' ? 'url' : 'text'}
            value={value ?? ''}
            onChange={(e) => onChange(key, e.target.value)}
            disabled={disabled}
            placeholder={placeholder || (type === 'phone' ? '+91...' : '')}
            maxLength={validation.maxLength || 500}
            className={`w-full px-3.5 py-2.5 rounded-xl border text-sm font-medium transition-all outline-none ${
              error
                ? 'border-rose-300 bg-rose-50/30 text-rose-900 focus:border-rose-500 focus:ring-2 focus:ring-rose-200'
                : 'border-slate-200 bg-white text-slate-800 hover:border-slate-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-100'
            } disabled:bg-slate-50 disabled:text-slate-400`}
            aria-invalid={!!error}
            aria-describedby={error ? `${fieldId}_error` : helpText ? `${fieldId}_help` : undefined}
          />
        );

      case 'number':
        return (
          <input
            id={fieldId}
            name={key}
            type="number"
            value={value ?? ''}
            onChange={(e) => {
              const val = e.target.value;
              onChange(key, val === '' ? null : Number(val));
            }}
            disabled={disabled}
            min={validation.min}
            max={validation.max}
            placeholder={placeholder || '0'}
            className={`w-full px-3.5 py-2.5 rounded-xl border text-sm font-medium transition-all outline-none ${
              error
                ? 'border-rose-300 bg-rose-50/30 text-rose-900 focus:border-rose-500 focus:ring-2 focus:ring-rose-200'
                : 'border-slate-200 bg-white text-slate-800 hover:border-slate-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-100'
            } disabled:bg-slate-50 disabled:text-slate-400`}
            aria-invalid={!!error}
          />
        );

      case 'select':
        return (
          <select
            id={fieldId}
            name={key}
            value={value ?? ''}
            onChange={(e) => onChange(key, e.target.value === '' ? null : e.target.value)}
            disabled={disabled}
            className={`w-full px-3.5 py-2.5 rounded-xl border text-sm font-medium transition-all outline-none bg-white ${
              error
                ? 'border-rose-300 bg-rose-50/30 text-rose-900 focus:border-rose-500 focus:ring-2 focus:ring-rose-200'
                : 'border-slate-200 text-slate-800 hover:border-slate-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-100'
            } disabled:bg-slate-50 disabled:text-slate-400`}
            aria-invalid={!!error}
          >
            <option value="">{placeholder || `-- Select ${label} --`}</option>
            {options.map((opt, i) => {
              const val = typeof opt === 'object' ? opt.value : opt;
              const lbl = typeof opt === 'object' ? opt.label : opt;
              return (
                <option key={i} value={val}>
                  {lbl}
                </option>
              );
            })}
          </select>
        );

      case 'multiselect': {
        const selectedList = Array.isArray(value) ? value : [];
        const toggleOption = (optVal) => {
          const exists = selectedList.includes(optVal);
          const next = exists ? selectedList.filter((item) => item !== optVal) : [...selectedList, optVal];
          onChange(key, next);
        };

        return (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-1.5 p-2 rounded-xl border border-slate-200 bg-slate-50/50 min-h-[44px]">
              {options.map((opt, i) => {
                const val = typeof opt === 'object' ? opt.value : opt;
                const lbl = typeof opt === 'object' ? opt.label : opt;
                const isSelected = selectedList.includes(val);

                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => toggleOption(val)}
                    disabled={disabled}
                    className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                      isSelected
                        ? 'bg-teal-600 text-white shadow-sm'
                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                    } disabled:opacity-50`}
                  >
                    <span>{lbl}</span>
                    {isSelected && <span className="ml-1 text-[10px]">✕</span>}
                  </button>
                );
              })}
            </div>
            {selectedList.length === 0 && (
              <span className="text-xs text-slate-400 italic">No options selected</span>
            )}
          </div>
        );
      }

      case 'date':
        return (
          <input
            id={fieldId}
            name={key}
            type="date"
            value={value ? String(value).slice(0, 10) : ''}
            onChange={(e) => onChange(key, e.target.value || null)}
            disabled={disabled}
            className={`w-full px-3.5 py-2.5 rounded-xl border text-sm font-medium transition-all outline-none ${
              error
                ? 'border-rose-300 bg-rose-50/30 text-rose-900 focus:border-rose-500 focus:ring-2 focus:ring-rose-200'
                : 'border-slate-200 bg-white text-slate-800 hover:border-slate-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-100'
            } disabled:bg-slate-50 disabled:text-slate-400`}
            aria-invalid={!!error}
          />
        );

      case 'boolean':
        return (
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input
              id={fieldId}
              name={key}
              type="checkbox"
              checked={!!value}
              onChange={(e) => onChange(key, e.target.checked)}
              disabled={disabled}
              className="w-4 h-4 rounded text-teal-600 border-slate-300 focus:ring-teal-500 disabled:opacity-50"
            />
            <span className="text-sm font-medium text-slate-700">{label}</span>
          </label>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-1.5">
      {type !== 'boolean' && (
        <label htmlFor={fieldId} className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
          {label}
          {required && <span className="text-rose-500 ml-1">*</span>}
        </label>
      )}

      {renderControl()}

      {helpText && !error && (
        <p id={`${fieldId}_help`} className="text-[11px] text-slate-500">
          {helpText}
        </p>
      )}

      {error && (
        <p id={`${fieldId}_error`} role="alert" className="text-xs font-semibold text-rose-600 flex items-center gap-1">
          <span>⚠</span>
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}
