import { TexEngine, unpackTarGz } from 'glyphtex-engine';
import wasmUrl from 'glyphtex-engine/wasm?url';
import bundleUrl from 'glyphtex-engine/bundle?url';
import sciencePackUrl from 'glyphtex-engine/packs/pack-science.tar.gz?url';

type CompileRequest = { id: number; source: string };
type CompileResponse = {
  id: number;
  pdf?: ArrayBuffer;
  diagnostics?: { severity: string; file: string | null; line: number | null; message: string }[];
  status?: string;
  message?: string | null;
  error?: string;
};

const loadEngine = async () => {
  const engine = await TexEngine.load(fetch(wasmUrl));
  const bundleResponse = await fetch(bundleUrl);
  if (!bundleResponse.ok) throw new Error('Could not load the Tectonic LaTeX bundle.');
  engine.addFiles(await unpackTarGz(new Uint8Array(await bundleResponse.arrayBuffer())));
  const scienceResponse = await fetch(sciencePackUrl);
  if (!scienceResponse.ok) throw new Error('Could not load the Tectonic science packages.');
  engine.addFiles(await unpackTarGz(new Uint8Array(await scienceResponse.arrayBuffer())));
  return engine;
};

const engineReady = loadEngine();
const workerScope = self as unknown as {
  addEventListener(type: 'message', listener: (event: MessageEvent<CompileRequest>) => void): void;
  postMessage(message: unknown, transfer?: Transferable[]): void;
};

workerScope.addEventListener('message', async (event: MessageEvent<CompileRequest>) => {
  const { id, source } = event.data;
  try {
    const engine = await engineReady;
    engine.addFile('main.tex', source);
    const result = engine.compile({ entry: 'main.tex', maxPasses: 4 });
    const pdf = result.status === 'failed' ? undefined : engine.pdf();
    const pdfBuffer = pdf?.slice().buffer;
    const response: CompileResponse = {
      id,
      pdf: pdfBuffer,
      diagnostics: result.diagnostics,
      status: result.status,
      message: result.message,
    };
    workerScope.postMessage(response, pdfBuffer ? [pdfBuffer] : []);
  } catch (error) {
    const response: CompileResponse = { id, error: error instanceof Error ? error.message : 'Tectonic compilation failed.' };
    workerScope.postMessage(response);
  }
});
