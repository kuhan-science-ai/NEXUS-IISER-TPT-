type Diagnostic = { severity: string; file: string | null; line: number | null; message: string };
type CompileResponse = {
  id: number;
  pdf?: ArrayBuffer;
  diagnostics?: Diagnostic[];
  status?: string;
  message?: string | null;
  error?: string;
};

let worker: Worker | null = null;
let nextRequestId = 0;
const pending = new Map<number, { resolve: (result: { pdf: Blob; diagnostics: Diagnostic[]; status: string }) => void; reject: (error: Error) => void }>();

function rejectPending(error: Error) {
  pending.forEach(request => request.reject(error));
  pending.clear();
  worker?.terminate();
  worker = null;
}

function getWorker() {
  if (worker) return worker;
  worker = new Worker(new URL('../workers/tectonic.worker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = (event: MessageEvent<CompileResponse>) => {
    const response = event.data;
    const request = pending.get(response.id);
    if (!request) return;
    pending.delete(response.id);
    if (response.error) {
      request.reject(new Error(response.error));
    } else if (!response.pdf) {
      const diagnostics = response.diagnostics?.map(item => `${item.file || 'document.tex'}${item.line ? `:${item.line}` : ''}: ${item.message}`).join('\n');
      request.reject(new Error(diagnostics || response.message || 'Tectonic did not produce a PDF.'));
    } else {
      request.resolve({ pdf: new Blob([response.pdf], { type: 'application/pdf' }), diagnostics: response.diagnostics || [], status: response.status || 'spotless' });
    }
  };
  worker.onerror = event => rejectPending(new Error(event.message || 'The Tectonic worker stopped unexpectedly.'));
  return worker;
}

export function compileWithTectonic(source: string) {
  const id = ++nextRequestId;
  return new Promise<{ pdf: Blob; diagnostics: Diagnostic[]; status: string }>((resolve, reject) => {
    pending.set(id, { resolve, reject });
    try { getWorker().postMessage({ id, source }); }
    catch (error) { pending.delete(id); reject(error instanceof Error ? error : new Error('Could not start Tectonic.')); }
  });
}
