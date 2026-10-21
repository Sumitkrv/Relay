import React from 'react';
import { Search, X } from 'lucide-react';

export default function SearchInput({
  value,
  onChange,
  placeholder = 'Search...',
  onClear,
  className = '',
  size = 'md',
  disabled = false,
  autoFocus = false,
  ariaLabel = 'Search',
}) {
  const handleClear = () => {
    if (onClear) onClear();
    else if (onChange) onChange({ target: { value: '' } });
  };

  return (
    <div className={`search-input-wrap size-${size} ${className} ${disabled ? 'disabled' : ''}`}>
      <Search size={size === 'sm' ? 14 : 16} className="search-icon" />
      <input
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        autoFocus={autoFocus}
        aria-label={ariaLabel}
        className="search-native-input"
      />
      {value && (
        <button
          type="button"
          onClick={handleClear}
          className="search-clear-btn"
          aria-label="Clear search input"
        >
          <X size={13} />
        </button>
      )}
    </div>
  );
}
