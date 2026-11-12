import React, { useMemo } from 'react';
import katex from 'katex';
import 'katex/contrib/mhchem';
import 'katex/dist/katex.min.css';

interface MathRendererProps {
  content: string;
  className?: string;
}

/**
 * Locally bundled KaTeX Mathematical Renderer for NEXUS.
 * Zero external CDN calls; renders formulas offline.
 * Supports inline ($...$) and display ($$...$$) mathematical expressions.
 */
export const MathRenderer: React.FC<MathRendererProps> = ({ content, className = '' }) => {
  const renderedContent = useMemo(() => {
    if (!content) return '';

    // Accept the common TeX delimiters used by LLMs, then normalize them to
    // the dollar syntax understood by the chat renderer. Equations remain
    // formatted output instead of leaking raw TeX delimiters into the UI.
    const normalizedContent = content
      .replace(/\\\[([\s\S]*?)\\\]/g, (_match, math: string) => `$$${math}$$`)
      .replace(/\\\(([\s\S]*?)\\\)/g, (_match, math: string) => `$${math}$`)
      .replace(/^\\begin\{(equation\*?|align\*?|gather\*?|multline\*?)\}([\s\S]*?)\\end\{\1\}$/gm, (_match, environment: string, math: string) => `$$\\begin{${environment}}${math}\\end{${environment}}$$`);

    // Regex to capture $$...$$ (display) and $...$ (inline)
    const regex = /(\$\$[\s\S]*?\$\$|\$[^\$\n]+?\$)/g;
    const parts = normalizedContent.split(regex);

    return parts.map((part, index) => {
      if (part.startsWith('$$') && part.endsWith('$$') && part.length >= 4) {
        const math = part.slice(2, -2).trim();
        try {
          const html = katex.renderToString(math, {
            displayMode: true,
            throwOnError: false,
            strict: false,
            trust: false,
          });
          return <span key={index} dangerouslySetInnerHTML={{ __html: html }} />;
        } catch {
          return <code key={index}>{part}</code>;
        }
      } else if (part.startsWith('$') && part.endsWith('$') && part.length >= 2) {
        const math = part.slice(1, -1).trim();
        try {
          const html = katex.renderToString(math, {
            displayMode: false,
            throwOnError: false,
            strict: false,
            trust: false,
          });
          return <span key={index} dangerouslySetInnerHTML={{ __html: html }} />;
        } catch {
          return <code key={index}>{part}</code>;
        }
      } else {
        // Plain text preserving line breaks
        return <span key={index}>{part}</span>;
      }
    });
  }, [content]);

  return <div className={`math-renderer ${className}`}>{renderedContent}</div>;
};

export default MathRenderer;
