import { api } from './api';

export async function compileLatex(source: string, filename = 'document', theme: 'light' | 'dark' = 'light'): Promise<Blob> {
  const token = api.getToken();
  const response = await fetch('/api/v1/latex/compile', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ source, filename, theme }),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    if (response.status === 405) {
      throw new Error('Full LaTeX PDF compilation is not available on the hosted Worker yet. KaTeX preview works in your browser; run the local FastAPI backend to compile PDFs.');
    }
    throw new Error(payload?.detail || `LaTeX compilation failed (${response.status}).`);
  }
  return response.blob();
}

export function downloadPdf(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename.replace(/\.pdf$/i, '').trim() || 'document'}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
