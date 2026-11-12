import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownToLine, BookOpen, Code2, Eye, Moon, PanelLeftClose, PanelLeftOpen, Sun, WandSparkles, X } from 'lucide-react';
import type * as pdfjsTypes from 'pdfjs-dist';
import { MathRenderer } from '../components/MathRenderer';
import { SideNav } from '../components/SideNav';
import { UserSummary } from '../services/api';
import { readUserPreference, writeUserPreference } from '../services/userPreferences';
import { api } from '../services/api';
import { compileLatex, downloadPdf } from '../services/latex';
import './LaTeXEditorPage.css';

function PdfCanvasPage({ document, pageNumber, thumbnail = false, onSelect }: { document: pdfjsTypes.PDFDocumentProxy; pageNumber: number; thumbnail?: boolean; onSelect?: () => void }) {
  const wrapperRef = useRef<HTMLButtonElement | HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(0);
  const [visible, setVisible] = useState(thumbnail);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const resizeObserver = new ResizeObserver(entries => setWidth(entries[0]?.contentRect.width || 0));
    resizeObserver.observe(wrapper);
    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper || thumbnail) return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        setVisible(true);
        observer.disconnect();
      }
    }, { rootMargin: '500px 0px' });
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, [thumbnail]);

  useEffect(() => {
    if (!visible || !width || !canvasRef.current) return;
    let cancelled = false;
    let renderTask: pdfjsTypes.RenderTask | undefined;
    void document.getPage(pageNumber).then(page => {
      if (cancelled || !canvasRef.current) return;
      const base = page.getViewport({ scale: 1 });
      const scale = Math.min(width / base.width, thumbnail ? 1 : 1.35);
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
      const viewport = page.getViewport({ scale: scale * pixelRatio });
      const canvas = canvasRef.current;
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      canvas.style.width = `${viewport.width / pixelRatio}px`;
      canvas.style.height = `${viewport.height / pixelRatio}px`;
      const context = canvas.getContext('2d');
      if (context) renderTask = page.render({ canvasContext: context, viewport });
      return renderTask?.promise;
    }).catch(() => { /* A partially rendered page can retry when the viewer remounts. */ });
    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [document, pageNumber, thumbnail, visible, width]);

  return thumbnail
    ? <button ref={wrapperRef as React.RefObject<HTMLButtonElement>} type="button" className="latex-pdf-thumbnail" onClick={onSelect} aria-label={`Go to page ${pageNumber}`}><canvas ref={canvasRef} /><span>{pageNumber}</span></button>
    : <div ref={wrapperRef as React.RefObject<HTMLDivElement>} className="latex-pdf-page"><canvas ref={canvasRef} /></div>;
}

function PdfPageViewer({ url, showPages }: { url: string; showPages: boolean }) {
  const [document, setDocument] = useState<pdfjsTypes.PDFDocumentProxy | null>(null);
  const [error, setError] = useState('');
  const pagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    setDocument(null);
    setError('');
    let task: pdfjsTypes.PDFDocumentLoadingTask | undefined;
    void Promise.all([import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?url')]).then(([pdfjs, worker]) => {
      if (cancelled) return null;
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
      task = pdfjs.getDocument(url);
      return task.promise;
    }).then(loaded => {
      if (loaded && !cancelled) setDocument(loaded);
    }).catch(reason => {
      if (!cancelled) setError(reason instanceof Error ? reason.message : 'Could not display this PDF.');
    });
    return () => {
      cancelled = true;
      if (task) void task.destroy();
    };
  }, [url]);

  const goToPage = (pageNumber: number) => pagesRef.current?.querySelector(`[data-page="${pageNumber}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  if (error) return <div className="latex-compile-placeholder"><strong>PDF preview unavailable</strong><span>{error}</span></div>;
  if (!document) return <div className="latex-compile-placeholder"><strong>Loading PDF pages…</strong><span>Preparing page previews.</span></div>;

  return <div className={`latex-pdf-viewer${showPages ? '' : ' pages-hidden'}`}>
    {showPages && <nav className="latex-pdf-pages" aria-label="PDF pages">{Array.from({ length: document.numPages }, (_, index) => <PdfCanvasPage key={index + 1} document={document} pageNumber={index + 1} thumbnail onSelect={() => goToPage(index + 1)} />)}</nav>}
    <div className="latex-pdf-document-scroll" ref={pagesRef}>{Array.from({ length: document.numPages }, (_, index) => <section key={index + 1} data-page={index + 1} className="latex-pdf-document-page"><PdfCanvasPage document={document} pageNumber={index + 1} /></section>)}</div>
  </div>;
}

interface LaTeXEditorPageProps {
  currentUser?: UserSummary | null;
  onLogout?: () => void;
}

const SAMPLE_LATEX = String.raw`\documentclass[12pt]{article}
\usepackage{amsmath,amssymb,physics}
\usepackage[version=4]{mhchem}
\usepackage[margin=1in]{geometry}
\title{Derivation of the Dirac Equation}
\author{}
\date{}
\begin{document}
\maketitle
\section{Relativistic Energy Equation}
From special relativity, the energy-momentum relation is
\begin{equation}
E^2 = p^2c^2 + m^2c^4
\end{equation}
Dirac sought a relativistic wave equation that is first-order in both time and spatial derivatives. Assume that energy is linear in momentum:
\begin{equation}
E = c(\alpha_1p_1+\alpha_2p_2+\alpha_3p_3)+\beta mc^2
\end{equation}
\section{Squaring the Energy Equation}
Squaring both sides gives
\begin{align}
E^2 ={}& c^2(\alpha_1^2p_1^2+\alpha_2^2p_2^2+\alpha_3^2p_3^2) \nonumber\\
&+c^2(\{\alpha_1,\alpha_2\}p_1p_2+\{\alpha_2,\alpha_3\}p_2p_3+\{\alpha_3,\alpha_1\}p_3p_1) \nonumber\\
&+mc^3\sum_{i=1}^{3}\{\alpha_i,\beta\}p_i+\beta^2m^2c^4
\end{align}
Comparing this with $E^2=p^2c^2+m^2c^4$, we obtain $\alpha_i^2=I$, $\beta^2=I$, $\{\alpha_i,\alpha_j\}=0$ for $i\ne j$, and $\{\alpha_i,\beta\}=0$.
\section{Quantization}
Using $E\rightarrow i\hbar\frac{\partial}{\partial t}$ and $\vec{p}\rightarrow-i\hbar\vec{\nabla}$, we obtain the Dirac equation in Hamiltonian form:
\begin{equation}
i\hbar\frac{\partial\psi}{\partial t}=\left[-i\hbar c\left(\alpha_1\frac{\partial}{\partial x}+\alpha_2\frac{\partial}{\partial y}+\alpha_3\frac{\partial}{\partial z}\right)+\beta mc^2\right]\psi
\end{equation}
\section{Covariant Form}
Define $\gamma^0=\beta$ and $\gamma^i=\beta\alpha_i$. These matrices satisfy $\{\gamma^\mu,\gamma^\nu\}=2g^{\mu\nu}I$. The covariant equation is
\begin{equation}
\boxed{(i\hbar c\gamma^\mu\partial_\mu-mc^2)\psi=0}
\end{equation}
In natural units, $\hbar=c=1$:
\begin{equation}
\boxed{(i\gamma^\mu\partial_\mu-m)\psi=0}
\end{equation}
\section{Conclusion}
The Dirac equation is first-order in time and spatial derivatives, describes spin-$\frac{1}{2}$ particles, and predicts the existence of antiparticles.
\end{document}`;

type LatexEngine = 'katex' | 'tectonic';
type StarterId = 'math' | 'physics' | 'chemistry';

const FAST_STARTERS: Record<StarterId, { label: string; source: string }> = {
  math: { label: 'Maths · Fast KaTeX', source: String.raw`# KaTeX sample · Mathematics

Derivative:
$$\frac{d}{dx} e^x = e^x$$

Gaussian integral:
$$\int_{-\infty}^{\infty} e^{-x^2}\,dx = \sqrt{\pi}$$` },
  physics: { label: 'Physics · Fast KaTeX', source: String.raw`# Physics quick sheet

Time-dependent Schrödinger equation:
$$i\hbar\frac{\partial}{\partial t}\Psi = \hat{H}\Psi$$

Maxwell equation:
$$\nabla\cdot\mathbf{E}=\frac{\rho}{\varepsilon_0}$$` },
  chemistry: { label: 'Chemistry · Fast KaTeX', source: String.raw`# Chemistry quick sheet

Balanced reaction:
$$\ce{2H2 + O2 -> 2H2O}$$

Acid dissociation:
$$\ce{HA + H2O <=> H3O+ + A-}$$` },
};

const FULL_STARTERS: Record<StarterId, { label: string; source: string }> = {
  math: { label: 'Maths · Full LaTeX', source: String.raw`\documentclass[12pt]{article}
\usepackage{amsmath,amssymb,mathtools}
\usepackage[version=4]{mhchem}
\usepackage[margin=1in]{geometry}
\title{Mathematics Notes}
\author{}
\date{}
\begin{document}
\maketitle
\section{Calculus}
The derivative of the exponential is
\begin{equation}
\frac{d}{dx}e^x=e^x.
\end{equation}
The Gaussian integral is
\begin{equation}
\int_{-\infty}^{\infty}e^{-x^2}\,dx=\sqrt{\pi}.
\end{equation}
\end{document}` },
  physics: { label: 'Physics · Full LaTeX', source: SAMPLE_LATEX },
  chemistry: { label: 'Chemistry · Full LaTeX', source: String.raw`\documentclass[12pt]{article}
\usepackage{amsmath,amssymb}
\usepackage[version=4]{mhchem}
\usepackage[margin=1in]{geometry}
\title{Chemistry Notes}
\author{}
\date{}
\begin{document}
\maketitle
\section{Chemical Equations}
Combustion of hydrogen:
\begin{equation}
\ce{2H2 + O2 -> 2H2O}
\end{equation}
Acid dissociation:
\begin{equation}
\ce{HA + H2O <=> H3O+ + A-}
\end{equation}
\section{Concentration and pH}
\begin{equation}
\mathrm{pH}=-\log_{10}\left[\ce{H3O+}\right]
\end{equation}
\end{document}` },
};

const FAST_SNIPPETS = [
  { label: 'Integral', code: '$$\\int_{a}^{b} f(x)\\,dx$$' },
  { label: 'Fraction', code: '$$\\frac{a}{b}$$' },
  { label: 'Matrix', code: '$$\\begin{pmatrix}a&b\\\\c&d\\end{pmatrix}$$' },
  { label: 'Schrödinger', code: '$$i\\hbar\\frac{\\partial}{\\partial t}\\Psi=\\hat{H}\\Psi$$' },
  { label: 'Reaction', code: '$$\\ce{2H2 + O2 -> 2H2O}$$' },
  { label: 'Equilibrium', code: '$$\\ce{A + B <=> C + D}$$' },
];
const FULL_SNIPPETS = [
  { label: 'Integral', code: '\\begin{equation}\n\\int_{a}^{b} f(x)\\,dx\n\\end{equation}' },
  { label: 'Fraction', code: '$\\frac{d}{dx}\\left(\\frac{f}{g}\\right)$' },
  { label: 'Sum', code: '\\begin{equation}\n\\sum_{n=0}^{\\infty} \\frac{x^n}{n!}=e^x\n\\end{equation}' },
  { label: 'Matrix', code: '\\begin{equation}\n\\begin{pmatrix}a&b\\\\c&d\\end{pmatrix}\n\\end{equation}' },
  { label: 'Schrödinger', code: '\\begin{equation}\ni\\hbar\\frac{\\partial\\Psi}{\\partial t}=\\hat{H}\\Psi\n\\end{equation}' },
  { label: 'Reaction', code: '\\begin{equation}\n\\ce{2H2 + O2 -> 2H2O}\n\\end{equation}' },
];

function LatexDocument({ content }: { content: string }) {
  const blocks = useMemo(() => {
    const result: Array<{ type: 'h1' | 'h2' | 'text' | 'math'; value: string }> = [];
    let source = content;
    if (/\\documentclass\b/.test(source)) {
      const title = source.match(/\\title\s*\{([^}]*)\}/)?.[1]?.trim();
      const documentBody = source.match(/\\begin\s*\{document\}([\s\S]*?)\\end\s*\{document\}/);
      source = documentBody?.[1] || source;
      source = source.replace(/\\maketitle\b/g, '');
      if (title) result.push({ type: 'h1', value: title });
    }
    source = source
      .replace(/\\section\*?\s*\{([^}]*)\}/g, '\n# $1\n')
      .replace(/\\subsection\*?\s*\{([^}]*)\}/g, '\n## $1\n')
      .replace(/\\paragraph\*?\s*\{([^}]*)\}/g, '\n### $1\n');
    const lines = source.split(/\r?\n/);
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i].trim();
      if (!line) continue;
      if (line.startsWith('$$')) {
        let equation = line;
        while (!equation.slice(2).includes('$$') && i + 1 < lines.length) equation += `\n${lines[++i].trim()}`;
        result.push({ type: 'math', value: equation.replace(/^\$\$|\$\$$/g, '') });
      } else if (/^\\begin\{(equation\*?|align\*?|gather\*?|multline\*?)\}/.test(line)) {
        const environment = line.match(/^\\begin\{([^}]+)\}/)?.[1] || 'equation';
        let equation = line;
        while (!equation.includes(`\\end{${environment}}`) && i + 1 < lines.length) equation += `\n${lines[++i].trim()}`;
        result.push({ type: 'math', value: equation });
      } else if (line.startsWith('# ')) result.push({ type: 'h1', value: line.slice(2) });
      else if (line.startsWith('## ')) result.push({ type: 'h2', value: line.slice(3) });
      else if (line.startsWith('### ')) result.push({ type: 'h2', value: line.slice(4) });
      else if (/^\\(usepackage|documentclass|title|author|date|maketitle|end\b|begin\{document\})/.test(line)) continue;
      else result.push({ type: 'text', value: line });
    }
    return result;
  }, [content]);

  return <div className="latex-document-content">{blocks.map((block, index) => {
    if (block.type === 'h1') return <h1 key={index}>{block.value}</h1>;
    if (block.type === 'h2') return <h2 key={index}>{block.value}</h2>;
    if (block.type === 'math') return <div className="latex-display-math" key={index}><MathRenderer content={`$$${block.value}$$`} /></div>;
    return <p key={index}><MathRenderer content={block.value} /></p>;
  })}</div>;
}

function escapeLatexText(value: string) {
  return value.replace(/[#$%&_{}]/g, character => ({ '#': '\\#', '$': '\\$', '%': '\\%', '&': '\\&', '_': '\\_', '{': '\\{', '}': '\\}' }[character] || character));
}

function makeFastPdfSource(content: string) {
  const body: string[] = [];
  const lines = content.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line) { body.push(''); continue; }
    if (line.startsWith('$$')) {
      let equation = line.slice(2);
      while (!equation.includes('$$') && index + 1 < lines.length) equation += `\n${lines[++index].trim()}`;
      equation = equation.replace(/\$\$$/, '');
      body.push(`\\[${equation}\\]`);
    } else if (line.startsWith('# ')) body.push(`\\section*{${escapeLatexText(line.slice(2))}}`);
    else if (line.startsWith('## ')) body.push(`\\subsection*{${escapeLatexText(line.slice(3))}}`);
    else {
      body.push(line.split(/(\$[^$]+\$)/g).map(part => part.startsWith('$') && part.endsWith('$') ? part : escapeLatexText(part)).join(''));
    }
  }
  return String.raw`\documentclass[12pt]{article}
\usepackage{amsmath,amssymb,physics}
\usepackage[version=4]{mhchem}
\usepackage[margin=1in]{geometry}
\begin{document}
${body.join('\n')}
\end{document}`;
}

function readSavedLatexSource(key: string, fallback: string) {
  try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
}

export const LaTeXEditorPage: React.FC<LaTeXEditorPageProps> = ({ currentUser, onLogout }) => {
  const draftPrefix = `nexus-latex-draft:${encodeURIComponent(currentUser?.id ?? 'guest')}`;
  const preferenceUserId = currentUser?.id ?? 'guest';
  const fastDraftKey = `${draftPrefix}:fast`;
  const fullDraftKey = `${draftPrefix}:full`;
  const [engineMode, setEngineMode] = useState<LatexEngine>(() => readUserPreference<LatexEngine>('nexus-latex-engine', preferenceUserId, 'katex') === 'tectonic' ? 'tectonic' : 'katex');
  const [fastContent, setFastContent] = useState(() => readSavedLatexSource(fastDraftKey, FAST_STARTERS.math.source));
  const [fullContent, setFullContent] = useState(() => readSavedLatexSource(fullDraftKey, SAMPLE_LATEX));
  const content = engineMode === 'tectonic' ? fullContent : fastContent;
  const setContent = (next: React.SetStateAction<string>) => {
    const setter = engineMode === 'tectonic' ? setFullContent : setFastContent;
    setter(next);
  };
  const [fastStarterId, setFastStarterId] = useState<StarterId>('math');
  const [fullStarterId, setFullStarterId] = useState<StarterId>('physics');
  const [seriousMode, setSeriousMode] = useState(true);
  const [documentTheme, setDocumentTheme] = useState<'light' | 'dark'>('light');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [showMainPages, setShowMainPages] = useState(true);
  const [showExportPages, setShowExportPages] = useState(true);
  const [documentName, setDocumentName] = useState('dirac-equation');
  const [pdfUrl, setPdfUrl] = useState('');
  const [compiledSource, setCompiledSource] = useState('');
  const [compiledTheme, setCompiledTheme] = useState<'light' | 'dark'>('light');
  const [compiledEngine, setCompiledEngine] = useState<LatexEngine>('tectonic');
  const [compiling, setCompiling] = useState(false);
  const [compileError, setCompileError] = useState('');
  const [draftsLoaded, setDraftsLoaded] = useState(!currentUser);

  useEffect(() => () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl); }, [pdfUrl]);
  useEffect(() => { try { localStorage.setItem(fastDraftKey, fastContent); } catch { /* Keep editing if browser storage is unavailable. */ } }, [fastDraftKey, fastContent]);
  useEffect(() => { try { localStorage.setItem(fullDraftKey, fullContent); } catch { /* Keep editing if browser storage is unavailable. */ } }, [fullDraftKey, fullContent]);
  useEffect(() => { setEngineMode(readUserPreference<LatexEngine>('nexus-latex-engine', preferenceUserId, 'katex') === 'tectonic' ? 'tectonic' : 'katex'); }, [preferenceUserId]);
  useEffect(() => {
    let active = true;
    setDraftsLoaded(!currentUser);
    if (!currentUser) return () => { active = false; };
    void api.getLatexDrafts().then(drafts => {
      if (!active) return;
      if (drafts.katex?.source) setFastContent(drafts.katex.source);
      if (drafts.tectonic?.source) setFullContent(drafts.tectonic.source);
    }).catch(() => { /* The account-scoped local draft remains available offline. */ })
      .finally(() => { if (active) setDraftsLoaded(true); });
    return () => { active = false; };
  }, [preferenceUserId]);
  useEffect(() => {
    if (!currentUser || !draftsLoaded) return;
    const timer = window.setTimeout(() => {
      void api.saveLatexDraft('katex', fastContent).catch(() => { /* Local autosave remains available if the API is offline. */ });
      void api.saveLatexDraft('tectonic', fullContent).catch(() => { /* Local autosave remains available if the API is offline. */ });
    }, 700);
    return () => window.clearTimeout(timer);
  }, [currentUser, draftsLoaded, fastContent, fullContent]);

  const isFullDocument = /\\documentclass\b/.test(content) && /\\begin\{document\}/.test(content);
  const pdfIsCurrent = !!pdfUrl && compiledSource === content && compiledTheme === documentTheme && compiledEngine === engineMode;

  const switchEngine = (next: LatexEngine) => {
    setEngineMode(next);
    writeUserPreference('nexus-latex-engine', preferenceUserId, next);
  };

  const applyStarter = (id: StarterId) => {
    const starter = (engineMode === 'tectonic' ? FULL_STARTERS : FAST_STARTERS)[id];
    setContent(starter.source);
    if (engineMode === 'tectonic') setFullStarterId(id); else setFastStarterId(id);
    setCompileError('');
  };

  const insertSnippet = (code: string) => setContent(previous => {
    const end = previous.lastIndexOf('\\end{document}');
    return end < 0 ? `${previous}\n${code}\n` : `${previous.slice(0, end)}\n${code}\n${previous.slice(end)}`;
  });

  const compile = async () => {
    setCompiling(true);
    setCompileError('');
    try {
      const source = engineMode === 'katex' ? makeFastPdfSource(content) : content;
      const blob = await compileLatex(source, documentName, documentTheme);
      const nextUrl = URL.createObjectURL(blob);
      setPdfUrl(nextUrl);
      setCompiledSource(content);
      setCompiledTheme(documentTheme);
      setCompiledEngine(engineMode);
    } catch (error) {
      setCompileError(error instanceof Error ? error.message : 'LaTeX compilation failed.');
    } finally {
      setCompiling(false);
    }
  };

  const openPdfPreview = async () => {
    setPreviewOpen(true);
    if (!pdfIsCurrent) await compile();
  };
  const savePdf = async () => {
    if (!pdfIsCurrent) await compile();
    if (pdfIsCurrent && pdfUrl) downloadPdf(await fetch(pdfUrl).then(response => response.blob()), documentName);
  };
  const toggleDocumentTheme = () => setDocumentTheme(theme => theme === 'light' ? 'dark' : 'light');

  const editor = <section className="latex-editor-pane">
    <div className="latex-pane-heading"><span><Code2 size={14} /> SOURCE</span><small>{engineMode === 'katex' ? 'Fast KaTeX · text + math' : 'Full LaTeX source'}</small></div>
    <textarea aria-label="LaTeX document source" value={content} onChange={event => setContent(event.target.value)} spellCheck={false} />
  </section>;

  const toolbar = <div className="latex-toolbar">
    <div className="latex-brand"><h1>LaTeX Studio</h1><p>{engineMode === 'katex' ? 'Instant in-browser maths, physics, and chemistry rendering' : 'Full-document Tectonic compiler · PDF output'}</p></div>
    <div className="latex-toolbar-actions">
      <label className="latex-picker-label">Engine<select value={engineMode} onChange={event => switchEngine(event.target.value as LatexEngine)}><option value="katex">Fast · KaTeX</option><option value="tectonic">Full · Tectonic</option></select></label>
      <label className="latex-picker-label">Starter<select value={engineMode === 'tectonic' ? fullStarterId : fastStarterId} onChange={event => applyStarter(event.target.value as StarterId)}>{Object.entries(engineMode === 'tectonic' ? FULL_STARTERS : FAST_STARTERS).map(([id, starter]) => <option key={id} value={id}>{starter.label}</option>)}</select></label>
      {(engineMode === 'tectonic' ? FULL_SNIPPETS : FAST_SNIPPETS).map(snippet => <button type="button" className="latex-tool-button" key={snippet.label} onClick={() => insertSnippet(snippet.code)}>{snippet.label}</button>)}
      <button type="button" className="latex-tool-button" onClick={() => applyStarter(engineMode === 'tectonic' ? fullStarterId : fastStarterId)}>Reset starter</button>
      {engineMode === 'tectonic' && <button type="button" className={`latex-mode-button${seriousMode ? ' active' : ''}`} onClick={() => setSeriousMode(value => !value)}><BookOpen size={14} /> {seriousMode ? 'Exit serious mode' : 'Serious mode'}</button>}
      {import.meta.env.DEV && engineMode === 'tectonic' && <button type="button" className="latex-primary-button" onClick={() => void compile()} disabled={compiling}>{compiling ? 'Compiling…' : 'Compile PDF'}</button>}
      {import.meta.env.DEV && <button type="button" className="latex-primary-button" onClick={() => void openPdfPreview()}><Eye size={15} /> Preview PDF</button>}
    </div>
  </div>;

  const compiledPage = pdfIsCurrent
    ? <PdfPageViewer url={pdfUrl} showPages={showMainPages} />
    : <div className="latex-compile-placeholder"><BookOpen size={24} /><strong>{compiling ? 'Compiling your document…' : isFullDocument ? 'Compile to typeset the full document' : 'Paste a complete LaTeX document to compile'}</strong><span>{compileError || 'The compiler processes document classes, packages, environments, references and equations.'}</span></div>;

  const inner = <main className={`latex-studio${seriousMode ? ' serious' : ''}`}>
    {toolbar}
    {engineMode === 'tectonic' && seriousMode ? <>
      <div className="latex-serious-toolbar"><strong><WandSparkles size={15} /> Full LaTeX editor</strong><span>Live browser preview for text and KaTeX supported equations</span><div><button type="button" className="latex-tool-button" onClick={toggleDocumentTheme}>{documentTheme === 'light' ? <Moon size={14} /> : <Sun size={14} />} {documentTheme === 'light' ? 'Dark page' : 'White page'}</button>{import.meta.env.DEV && <button type="button" className="latex-primary-button" onClick={() => void compile()} disabled={compiling}>{compiling ? 'Compiling…' : 'Compile PDF'}</button>}</div></div>
      <div className="latex-serious-workspace">{editor}<section className="latex-compiled-pane"><div className="latex-pane-heading"><span><Eye size={14} /> LIVE LATEX PREVIEW</span><small>{pdfIsCurrent ? 'PDF ready' : 'KaTeX browser render'}</small>{pdfIsCurrent && <button type="button" className="latex-pages-toggle" aria-expanded={showMainPages} onClick={() => setShowMainPages(open => !open)}>{showMainPages ? <><PanelLeftClose size={13} /> Hide pages</> : <><PanelLeftOpen size={13} /> Show pages</>}</button>}</div><div className={`latex-compiled-scroll ${documentTheme}${pdfIsCurrent ? ' pdf-mode' : ''}`}>{pdfIsCurrent ? compiledPage : <div className={`latex-document-paper ${documentTheme}`}><LatexDocument content={content} /></div>}</div></section></div>
    </> : <div className="latex-standard-workspace">{editor}<section className="latex-live-pane"><div className="latex-pane-heading"><span><Eye size={14} /> {engineMode === 'katex' ? 'LIVE KATEX PREVIEW' : 'LIVE LATEX PREVIEW'}</span><small>{engineMode === 'katex' ? 'Instant KaTeX' : pdfIsCurrent ? 'PDF ready' : 'Browser rendered'}</small>{engineMode === 'tectonic' && pdfIsCurrent && <button type="button" className="latex-pages-toggle" aria-expanded={showMainPages} onClick={() => setShowMainPages(open => !open)}>{showMainPages ? <><PanelLeftClose size={13} /> Hide pages</> : <><PanelLeftOpen size={13} /> Show pages</>}</button>}<button type="button" className="latex-theme-toggle" onClick={toggleDocumentTheme}>{documentTheme === 'light' ? <Moon size={14} /> : <Sun size={14} />} {documentTheme === 'light' ? 'Dark page' : 'White page'}</button></div><div className={`latex-live-scroll ${documentTheme}${pdfIsCurrent ? ' pdf-mode' : ''}`}>{pdfIsCurrent ? compiledPage : <div className={`latex-document-paper ${documentTheme}`}><LatexDocument content={content} /></div>}</div></section></div>}
    {compileError && <div className="latex-error-banner" role="alert">{compileError}</div>}
    {previewOpen && <div className="latex-export-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setPreviewOpen(false); }}><section className="latex-export-dialog" role="dialog" aria-modal="true" aria-labelledby="latex-export-title"><header><div><h2 id="latex-export-title">Review compiled PDF</h2><p>Edit the source and recompile to update the typeset preview.</p></div><button type="button" className="latex-icon-button" onClick={() => setPreviewOpen(false)} aria-label="Close PDF preview"><X size={18} /></button></header><div className="latex-export-name"><label htmlFor="latex-document-name">PDF filename</label><input id="latex-document-name" value={documentName} onChange={event => setDocumentName(event.target.value)} /></div><div className="latex-export-panes"><section className="latex-export-source"><h3>LaTeX source</h3><textarea aria-label="Edit LaTeX source before PDF export" value={content} onChange={event => setContent(event.target.value)} spellCheck={false} /></section><section className="latex-export-rendered"><h3>Compiled PDF</h3><div className={`latex-export-paper ${documentTheme}`}>{pdfIsCurrent ? <PdfPageViewer url={pdfUrl} showPages={showExportPages} /> : <div className="latex-compile-placeholder"><strong>{compiling ? 'Compiling…' : 'Preview needs compilation'}</strong><span>{compileError || 'Compile your source to display the actual PDF.'}</span></div>}</div></section></div><footer><button type="button" className="latex-tool-button" onClick={() => setShowExportPages(open => !open)} aria-expanded={showExportPages}>{showExportPages ? <><PanelLeftClose size={14} /> Hide pages</> : <><PanelLeftOpen size={14} /> Show pages</>}</button><button type="button" className="latex-tool-button" onClick={toggleDocumentTheme}>{documentTheme === 'light' ? <Moon size={14} /> : <Sun size={14} />} {documentTheme === 'light' ? 'Dark preview' : 'White preview'}</button><span>{compileError || (pdfIsCurrent ? 'PDF compiled with Tectonic.' : 'Compile after edits to refresh the document.')}</span><button type="button" className="latex-tool-button" onClick={() => void compile()} disabled={compiling}>{compiling ? 'Compiling…' : 'Compile changes'}</button><button type="button" className="latex-primary-button" onClick={() => void savePdf()} disabled={compiling || !pdfIsCurrent}><ArrowDownToLine size={15} /> Save PDF</button></footer></section></div>}
  </main>;

  if (!currentUser) return <div className="latex-page">{inner}</div>;
  return <div className="latex-page"><SideNav currentUser={currentUser} onLogout={onLogout} />{inner}</div>;
};
