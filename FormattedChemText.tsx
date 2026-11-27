import React from 'react';

const SUPERSCRIPT_CHAR_MAP: Record<string, string> = {
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
  '⁺': '+',
  '⁻': '−',
};

const SUBSCRIPT_CHAR_MAP: Record<string, string> = {
  '₀': '0',
  '₁': '1',
  '₂': '2',
  '₃': '3',
  '₄': '4',
  '₅': '5',
  '₆': '6',
  '₇': '7',
  '₈': '8',
  '₉': '9',
  'ₑ': 'e',
};

const SCRIPT_TOKEN_REGEX = /([⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻]+|[₀₁₂₃₄₅₆₇₈₉ₑ]+)/g;
const IS_SUPERSCRIPT_RUN = /^[⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻]+$/;
const IS_SUBSCRIPT_RUN = /^[₀₁₂₃₄₅₆₇₈₉ₑ]+$/;
const HAS_ANY_SCRIPT = /[⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻₀₁₂₃₄₅₆₇₈₉ₑ]/;

const SCRIPT_FONT_STYLE: React.CSSProperties = {
  fontFamily: "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif",
  fontFeatureSettings: '"tnum" 1',
};

/**
 * Renders chemical formulas, nuclear isotope notations, ion charges, and equations
 * by replacing Unicode superscripts (⁰-⁹, ⁺, ⁻) and subscripts (₀-₉, ₑ) with
 * standard ASCII glyphs inside uniformly aligned <sup> / <sub> elements.
 *
 * Eliminates font-fallback height mismatches (e.g. ¹²³ vs ⁴⁵⁶⁷⁸⁹) and missing
 * Unicode superscript/subscript glyphs across monospace and system fonts.
 */
export const FormattedChemText: React.FC<{
  text?: string | null;
  className?: string;
}> = ({ text, className = '' }) => {
  if (!text) return null;
  if (!HAS_ANY_SCRIPT.test(text)) {
    return <span className={className}>{text}</span>;
  }

  const parts = text.split(SCRIPT_TOKEN_REGEX);

  return (
    <span className={`inline leading-normal ${className}`}>
      {parts.map((part, idx) => {
        if (!part) return null;

        if (IS_SUPERSCRIPT_RUN.test(part)) {
          const normalized = part
            .split('')
            .map((ch) => SUPERSCRIPT_CHAR_MAP[ch] ?? ch)
            .join('');
          return (
            <sup
              key={idx}
              className="inline-block text-[0.72em] font-bold leading-none tabular-nums tracking-tight text-current relative -top-[0.38em] align-baseline mx-[0.5px]"
              style={SCRIPT_FONT_STYLE}
            >
              {normalized}
            </sup>
          );
        }

        if (IS_SUBSCRIPT_RUN.test(part)) {
          const normalized = part
            .split('')
            .map((ch) => SUBSCRIPT_CHAR_MAP[ch] ?? ch)
            .join('');
          return (
            <sub
              key={idx}
              className="inline-block text-[0.72em] font-bold leading-none tabular-nums tracking-tight text-current relative top-[0.22em] align-baseline mx-[0.5px]"
              style={SCRIPT_FONT_STYLE}
            >
              {normalized}
            </sub>
          );
        }

        return <React.Fragment key={idx}>{part}</React.Fragment>;
      })}
    </span>
  );
};
