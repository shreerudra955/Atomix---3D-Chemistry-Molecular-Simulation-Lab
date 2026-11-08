import React from 'react';

export interface IsotopeNuclideProps {
  massNumber: number;
  symbol: string;
  atomicNumber?: number;
  className?: string;
  showZ?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
}

/**
 * Renders standard IUPAC nuclear notation with the mass number (A) positioned
 * precisely on the upper-left of the element symbol: ^A X (or stacked ^A_Z X).
 *
 * Designed to ensure:
 * 1. Digit 4 is 100% visible across all environments (no missing unicode superscript glyph).
 * 2. 1-digit, 2-digit, and 3-digit mass numbers (e.g. 1H, 14C, 238U, 294Og) align cleanly
 *    without clipping, squishing, or font baseline misalignments.
 * 3. Proportional typographic scaling with tabular numbers so multi-digit mass numbers stay neat.
 */
export const IsotopeNuclide: React.FC<IsotopeNuclideProps> = ({
  massNumber,
  symbol,
  atomicNumber,
  className = '',
  showZ = false,
  size = 'md',
}) => {
  // Strip any accidental leading unicode superscripts or numbers from symbol
  const cleanSymbol = symbol.replace(/^[⁰¹²³⁴⁵⁶⁷⁸⁹0-9]+/, '').trim() || symbol;

  // Extract optional descriptor (e.g., "H (D)" -> base "H", extra "(D)")
  const [baseSymbol, ...extras] = cleanSymbol.split(' ');
  const extraText = extras.join(' ');

  const sizeStyles = {
    xs: {
      wrap: 'text-[11px]',
      supText: 'text-[8.5px]',
      subText: 'text-[7.5px]',
      supOffset: '-translate-y-[0.38em]',
      symbolText: 'text-[11px]',
      gap: 'mr-[1px]',
    },
    sm: {
      wrap: 'text-xs',
      supText: 'text-[9.5px]',
      subText: 'text-[8px]',
      supOffset: '-translate-y-[0.4em]',
      symbolText: 'text-xs',
      gap: 'mr-[1.5px]',
    },
    md: {
      wrap: 'text-sm',
      supText: 'text-[10.5px]',
      subText: 'text-[9px]',
      supOffset: '-translate-y-[0.42em]',
      symbolText: 'text-sm',
      gap: 'mr-[1.5px]',
    },
    lg: {
      wrap: 'text-base',
      supText: 'text-xs',
      subText: 'text-[10px]',
      supOffset: '-translate-y-[0.44em]',
      symbolText: 'text-base',
      gap: 'mr-[2px]',
    },
    xl: {
      wrap: 'text-xl',
      supText: 'text-sm',
      subText: 'text-xs',
      supOffset: '-translate-y-[0.46em]',
      symbolText: 'text-xl',
      gap: 'mr-[2.5px]',
    },
  }[size];

  // Stacked notation: Mass number (A) top-left, Atomic number (Z) bottom-left
  if (showZ && atomicNumber !== undefined) {
    return (
      <span className={`inline-flex items-center leading-none select-none ${className}`}>
        <span className="inline-flex flex-col items-end justify-center mr-[2px] leading-none select-none">
          <span className={`${sizeStyles.supText} font-extrabold leading-none tabular-nums tracking-tighter text-sky-300`}>
            {massNumber}
          </span>
          <span className={`${sizeStyles.subText} font-bold leading-none tabular-nums tracking-tighter text-slate-400 mt-[1px]`}>
            {atomicNumber}
          </span>
        </span>
        <span className={`${sizeStyles.symbolText} font-black leading-none tracking-tight`}>
          {baseSymbol}
        </span>
        {extraText && (
          <span className="ml-1 text-[0.8em] font-medium opacity-80">
            {extraText}
          </span>
        )}
      </span>
    );
  }

  // Standard inline notation with mass number on the upper-left of the symbol
  return (
    <span className={`inline-flex items-baseline font-mono tracking-tight leading-none select-none ${sizeStyles.wrap} ${className}`}>
      <span
        className={`inline-block font-black leading-none tabular-nums text-current opacity-90 select-none ${sizeStyles.supText} ${sizeStyles.supOffset} ${sizeStyles.gap}`}
        style={{
          fontFamily: "'JetBrains Mono', 'Inter', system-ui, -apple-system, sans-serif",
          fontFeatureSettings: '"tnum" 1',
        }}
      >
        {massNumber}
      </span>
      <span className={`font-black leading-none ${sizeStyles.symbolText}`}>
        {baseSymbol}
      </span>
      {extraText && (
        <span className="ml-1 text-[0.8em] font-medium opacity-80">
          {extraText}
        </span>
      )}
    </span>
  );
};

const SUPERSCRIPT_MAP: Record<string, string> = {
  '⁰': '0',
  '¹': '1',
  '²': '2',
  '³': '3',
  '⁴': '4',
  '⁵': '5',
  '⁶': '6',
  '⁷': '7',
  '⁸': '8',
  '⁹': '9',
};

/**
 * Parses any text that might contain unicode superscripts (e.g. "²⁴⁸Cm + 3.76 prompt neutrons", "²⁴Mg", "2 ⁴He")
 * and converts the superscripts to standard digits inside <sup> with robust styling.
 * This guarantees that digit '4' is 100% visible and 3-digit isotopes never clip or squish.
 */
export const FormattedNuclideString: React.FC<{ text?: string | null; className?: string }> = ({
  text,
  className = '',
}) => {
  if (!text) return null;
  if (!/[⁰¹²³⁴⁵⁶⁷⁸⁹]/.test(text)) {
    return <span className={className}>{text}</span>;
  }

  // Split text by runs of unicode superscript digits
  const parts = text.split(/([⁰¹²³⁴⁵⁶⁷⁸⁹]+)/g);

  return (
    <span className={`inline-flex items-baseline leading-none ${className}`}>
      {parts.map((part, index) => {
        if (/^[⁰¹²³⁴⁵⁶⁷⁸⁹]+$/.test(part)) {
          const regularDigits = part
            .split('')
            .map((c) => SUPERSCRIPT_MAP[c] || c)
            .join('');
          return (
            <sup
              key={index}
              className="text-[0.68em] font-black leading-none tabular-nums tracking-tight text-current opacity-90 mr-[1px] relative -top-[0.38em]"
              style={{
                fontFamily: "'JetBrains Mono', 'Inter', system-ui, -apple-system, sans-serif",
                fontFeatureSettings: '"tnum" 1',
              }}
            >
              {regularDigits}
            </sup>
          );
        }
        return <span key={index}>{part}</span>;
      })}
    </span>
  );
};

      
