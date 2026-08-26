'use client';

import React, { useState, useRef } from 'react';
import { FiTag, FiX } from 'react-icons/fi';

interface TagInputProps {
  id?: string;
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  theme?: 'purple' | 'cyan' | 'green' | 'amber';
  icon?: React.ReactNode;
  maxTags?: number;
}

export const TagInput: React.FC<TagInputProps> = ({
  id,
  tags,
  onChange,
  placeholder = 'Type and press Enter or comma...',
  theme = 'purple',
  icon,
  maxTags
}) => {
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const addTag = (valueToAdd?: string) => {
    const raw = valueToAdd !== undefined ? valueToAdd : inputValue;
    const items = raw
      .split(/[,]+/)
      .map(s => s.trim().replace(/^[-*•]\s*/, ''))
      .filter(Boolean);

    if (items.length === 0) return;

    const newTags = [...tags];
    for (const item of items) {
      if (!newTags.includes(item) && (!maxTags || newTags.length < maxTags)) {
        newTags.push(item);
      }
    }

    onChange(newTags);
    setInputValue('');
  };

  const removeTag = (index: number) => {
    onChange(tags.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag();
    } else if (e.key === 'Backspace' && inputValue === '' && tags.length > 0) {
      removeTag(tags.length - 1);
    }
  };

  return (
    <div
      className="interactive-tag-box"
      onClick={() => inputRef.current?.focus()}
    >
      {tags.map((tag, idx) => (
        <span key={`${tag}-${idx}`} className={`tag-chip-interactive tag-chip-${theme}`}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
            {icon || <FiTag style={{ fontSize: '0.75rem' }} />} {tag}
          </span>
          <button
            type="button"
            className="tag-chip-remove"
            onClick={(e) => {
              e.stopPropagation();
              removeTag(idx);
            }}
            title={`Remove ${tag}`}
            aria-label={`Remove ${tag}`}
          >
            <FiX style={{ fontSize: '0.75rem' }} />
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        id={id}
        type="text"
        className="tag-box-input"
        placeholder={tags.length === 0 ? placeholder : '+ Add more (press Enter)...'}
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => addTag()}
      />
    </div>
  );
};
