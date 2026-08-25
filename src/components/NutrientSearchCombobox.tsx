import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTaxonomyContext } from '../context/TaxonomyContext';

interface NutrientSearchComboboxProps {
  value: string;
  printedName?: string;
  onChange: (key: string) => void;
  labelLanguage: string;
}

const HighlightMatch = ({ text, term }: { text: string; term: string | undefined | null; }) => {
    if (!term) return <span>{text}</span>;

    const lowerText = text.toLowerCase();
    const lowerTerm = term.toLowerCase();
    const index = lowerText.indexOf(lowerTerm);

    if (index === -1) return <span>{text}</span>;

    return (
      <span>
        {text.substring(0, index)}
        <span className="bg-indigo-500/30 font-bold text-indigo-900 dark:text-indigo-100">
          {text.substring(index, index + term.length)}
        </span>
        {text.substring(index + term.length)}
      </span>
    );
  };

export const NutrientSearchCombobox: React.FC<NutrientSearchComboboxProps> = ({
  value,
  printedName,
  onChange,
  labelLanguage,
}) => {
  const [searchTerm, setSearchTerm] = useState(value || '');
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [isInputHovered, setIsInputHovered] = useState(false);
  const [isDropdownHovered, setIsDropdownHovered] = useState(false);
  const [preventInputBlur, setPreventInputBlur] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  
  const showDropdown = isInputFocused;
  const showTooltip = isInputFocused || isInputHovered;
  
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { data: taxonomyData, getSynonyms } = useTaxonomyContext();

  const matches = Object.keys(taxonomyData)
    .map(key => {
      const synonyms = getSynonyms(key, labelLanguage);
      const term = searchTerm.toLowerCase();
      let rank = 9;

      if (key.toLowerCase().startsWith(term)) rank = 1;
      else if (synonyms.some(s => s.toLowerCase().startsWith(term))) rank = 2;
      else if (key.toLowerCase().includes(term)) rank = 3;
      else if (synonyms.some(s => s.toLowerCase().includes(term))) rank = 4;

      return { key, rank };
    })
    .filter(item => item.rank <= 4)
    .sort((a, b) => a.rank - b.rank)
    .map(item => item.key);

  const updateDropdownStyle = () => {
    if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        
        const leftPadding = 10;
        const rightPadding = 20;
        let left = Math.max(rect.left, leftPadding);
        const availableWidth = window.innerWidth - leftPadding - rightPadding;
        let width = availableWidth * 0.75;
        width = Math.max(Math.min(availableWidth * 0.75, 320, window.innerWidth - rightPadding - left), 72);
        left = Math.max(Math.min(left, window.innerWidth - rightPadding - width), leftPadding);

        setDropdownStyle({
            position: 'fixed',
            top: rect.bottom,
            left: left,
            width: width,
            zIndex: 9999
        });
    }
  };

  useEffect(() => {
    if (showDropdown) {
        updateDropdownStyle();
        window.addEventListener('scroll', updateDropdownStyle, true);
        window.addEventListener('resize', updateDropdownStyle);
    }
    
    return () => {
        window.removeEventListener('scroll', updateDropdownStyle, true);
        window.removeEventListener('resize', updateDropdownStyle);
    };
  }, [showDropdown]);

  return (
    <div className="relative w-full" ref={containerRef}>
      <input
        ref={inputRef}
        type="text"
        value={showDropdown ? searchTerm : value}
        onChange={e => setSearchTerm(e.target.value)}
        onFocus={() => {
            if (!searchTerm) {
                setSearchTerm(value);
            }
            setIsInputFocused(true);
        }}
        onBlur={() => {
            if (preventInputBlur) {
              setPreventInputBlur(false);
              return;
            }
            setIsInputFocused(false);
        }}
        onMouseEnter={() => setIsInputHovered(true)}
        onMouseLeave={() => setIsInputHovered(false)}
        className="ui-input font-mono px-1.5 py-0.5 text-[11px] text-indigo-600 dark:text-indigo-400"
      />
      {showTooltip && (
          <div 
            className={`absolute z-50 right-full top-1/2 -translate-y-1/2 mr-2 tooltip text-[10px] whitespace-nowrap ${printedName ?'cursor-pointer' : ''}`}
            title={printedName ? 'Click to use the extracted name' : ''}
            onMouseDown={() => {
              if (printedName) {
                setPreventInputBlur(true);
                setSearchTerm(printedName);
                requestAnimationFrame(() => inputRef.current?.focus());
              }
            }}
          >
            {printedName
              ? <>Extracted: {printedName}</>
              : <span className="italic">Manually added</span>
            }
          </div>
      )}
      {showDropdown && createPortal(
        <div 
            ref={dropdownRef}
            style={dropdownStyle} 
            className="mt-1 border rounded-lg shadow-lg max-h-60 overflow-y-auto bg-white border-slate-300 dark:bg-slate-900 dark:border-slate-700"
            /* See updateDropdownStyle for position calculation */
            onMouseEnter={() => setIsDropdownHovered(true)}
            onMouseLeave={() => setIsDropdownHovered(false)}
        >
          {matches.length > 0 ? matches.map(key => (
            <div
                key={key}
                onMouseDown={() => {
                  setPreventInputBlur(true);
                  onChange(key);
                  setSearchTerm('');
                  requestAnimationFrame(() => {
                    inputRef.current?.focus();
                    inputRef.current?.blur();
                  });
                }}
                className="px-2 py-1.5 text-[11px] cursor-pointer hover:bg-indigo-50 text-slate-900 dark:hover:bg-slate-800 dark:text-slate-200"
            >
              {(() => {
                const synonyms = getSynonyms(key, labelLanguage);
                const canonicalName = synonyms[0];
                const otherSynonyms = synonyms.slice(1);
                return (
                  <>
                    <span className="font-medium text-indigo-900 dark:text-indigo-300"><HighlightMatch text={canonicalName} term={searchTerm} /></span>
                    {otherSynonyms.length > 0 && (
                      <span className="block text-[10px] text-slate-600 dark:text-slate-500 italic">
                        {otherSynonyms.map((s, idx) => (
                          <span key={idx}>
                            <HighlightMatch text={s} term={searchTerm} />
                            {idx < otherSynonyms.length - 1 ? ', ' : ''}
                          </span>
                        ))}
                      </span>
                    )}
                    <span className="block text-[10px] text-slate-500 dark:text-slate-400 font-mono"><HighlightMatch text={key} term={searchTerm} /></span>
                  </>
                );
              })()}
            </div>
          )) : (
            <div className="px-2 py-1.5 text-[11px] text-slate-500 dark:text-slate-400">No matches found</div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
};
