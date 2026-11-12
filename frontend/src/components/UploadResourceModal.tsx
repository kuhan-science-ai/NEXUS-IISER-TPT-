import React, { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { readUserPreference, writeUserPreference } from '../services/userPreferences';
import { uploadMotion } from './figmaUploadMotion';
import './UploadResourceModal.css';

interface UploadResourceModalProps { isOpen: boolean; onClose: () => void; onUploadSuccess?: () => void; onStage?: (file: File, pages: number) => void; currentUserId: string; }
type FileStatus = 'pending' | 'uploading' | 'success' | 'error';
interface UploadItem { id: string; file: File; status: FileStatus; message?: string; point?: { x: number; y: number }; }

const FIGMA_W = 1080;
const FIGMA_H = 1350;
const MAX_FILE_BYTES = 50 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(['pdf']);
const PROJECTILE_END = 0.2463;
const PROJECTILE_DURATION = 2.1;
const FIGMA_PROJECTILE_MOTION = (() => {
  const source = uploadMotion['60:1218'];
  const animate: Record<string, number[]> = {};
  const transition: Record<string, { duration: number; times: number[]; ease: any }> = {};
  for (const [property, values] of Object.entries(source.animate) as [string, number[]][]) {
    const track = source.transition[property];
    const times: number[] = track.times;
    const nextIndex = times.findIndex((time) => time > PROJECTILE_END);
    const included = nextIndex < 0 ? times.length : nextIndex;
    const lastIncluded = included - 1;
    const clippedValues = values.slice(0, included);
    const clippedTimes = times.slice(0, included);
    if (nextIndex >= 0) {
      const t0 = times[lastIncluded]; const t1 = times[nextIndex];
      const ratio = (PROJECTILE_END - t0) / (t1 - t0);
      clippedValues.push(values[lastIncluded] + (values[nextIndex] - values[lastIncluded]) * ratio);
      clippedTimes.push(PROJECTILE_END);
    }
    animate[property] = clippedValues;
    transition[property] = {
      duration: PROJECTILE_DURATION,
      times: clippedTimes.map((time) => time / PROJECTILE_END),
      ease: Array.isArray(track.ease) ? track.ease.slice(0, clippedTimes.length - 1) : track.ease,
    };
  }
  return { initial: source.initial, animate, transition };
})();
const aimNodes = [
  { id: '60:839', x: 221.27, y: 953.99, size: 12 }, { id: '60:872', x: 248.75, y: 816.84, size: 11.6 },
  { id: '60:905', x: 276.22, y: 702.28, size: 11.2 }, { id: '60:938', x: 303.69, y: 610.26, size: 10.8 },
  { id: '60:971', x: 331.16, y: 540.75, size: 10.4 }, { id: '60:1004', x: 358.64, y: 493.74, size: 10 },
  { id: '60:1037', x: 386.11, y: 469.22, size: 9.6 }, { id: '60:1070', x: 413.58, y: 467.22, size: 9.2 },
  { id: '60:1103', x: 441.05, y: 487.68, size: 8.8 }, { id: '60:1136', x: 468.53, y: 530.58, size: 8.4 },
];
const BASKET_POINT_SPOTS = [
  { x: 598, y: 590 }, { x: 462, y: 612 }, { x: 575, y: 665 },
  { x: 495, y: 690 }, { x: 620, y: 648 }, { x: 530, y: 565 },
];

const fileExtension = (name: string) => name.split('.').pop()?.toLowerCase() || '';
const readDroppedEntry = async (entry: any): Promise<File[]> => {
  if (entry.isFile) return new Promise((resolve) => entry.file((file: File) => resolve([file]), () => resolve([])));
  if (!entry.isDirectory) return [];
  const reader = entry.createReader();
  const entries: any[] = [];
  while (true) {
    const batch: any[] = await new Promise((resolve) => reader.readEntries(resolve, () => resolve([])));
    if (!batch.length) break;
    entries.push(...batch);
  }
  return (await Promise.all(entries.map(readDroppedEntry))).flat();
};

export const UploadResourceModal: React.FC<UploadResourceModalProps> = ({ isOpen, onClose, onUploadSuccess, onStage, currentUserId }) => {
  const [scale, setScale] = useState(0.7);
  const [items, setItems] = useState<UploadItem[]>([]);
  const [processing, setProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [activeShotId, setActiveShotId] = useState<string | null>(null);
  const [playShotAnimation, setPlayShotAnimation] = useState(() => {
    return readUserPreference<'on' | 'off'>('nexus-upload-shot-animation', currentUserId, 'on') !== 'off';
  });
  const [countdown, setCountdown] = useState<number | null>(null);
  useEffect(() => { setPlayShotAnimation(readUserPreference<'on' | 'off'>('nexus-upload-shot-animation', currentUserId, 'on') !== 'off'); }, [currentUserId]);
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const countdownTimer = useRef<number | null>(null);
  const prefersReducedMotion = useReducedMotion();
  const successCount = items.filter((item) => item.status === 'success').length;
  const completed = items.length > 0 && !processing;

  const motionFor = (id: string) => {
    const data = uploadMotion[id];
    return prefersReducedMotion || !playShotAnimation || items.length ? { initial: data.initial, animate: data.initial } : data;
  };
  const style = (left: number, top: number, width?: number, height?: number): React.CSSProperties => ({ left, top, ...(width ? { width } : {}), ...(height ? { height } : {}) });

  useEffect(() => {
    const updateScale = () => setScale(Math.min((window.innerWidth - 96) / FIGMA_W, (window.innerHeight - 96) / FIGMA_H, 0.64));
    updateScale(); window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, []);
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape' && !processing && countdown === null) onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose, processing, countdown]);
  useEffect(() => {
    if (!isOpen) {
      if (countdownTimer.current !== null) window.clearInterval(countdownTimer.current);
      countdownTimer.current = null;
      setItems([]); setProcessing(false); setCountdown(null);
    }
  }, [isOpen]);
  useEffect(() => {
    folderInput.current?.setAttribute('webkitdirectory', '');
    folderInput.current?.setAttribute('directory', '');
  }, [isOpen]);

  if (!isOpen) return null;

  const updateItem = (id: string, update: Partial<UploadItem>) => setItems((current) => current.map((item) => item.id === id ? { ...item, ...update } : item));
  const startUpload = async (files: File[]) => {
    const uniqueFiles = files.filter((file, index) => fileExtension(file.name) === 'pdf' && files.findIndex((candidate) => candidate.name === file.name && candidate.size === file.size && candidate.lastModified === file.lastModified) === index).slice(0, 1);
    if (!uniqueFiles.length || processing) return;
    const batch: UploadItem[] = uniqueFiles.map((file, index) => ({ id: `${file.name}-${file.lastModified}-${index}`, file, status: 'pending' }));
    setItems(batch); setProcessing(true);
    let staged: { file: File; pages: number } | null = null;

    for (const item of batch) {
      const { file } = item;
      const animateThisShot = playShotAnimation && !prefersReducedMotion;
      setActiveShotId(animateThisShot ? item.id : null);
      const shotDuration = animateThisShot ? new Promise<void>((resolve) => window.setTimeout(resolve, PROJECTILE_DURATION * 1000 + 100)) : Promise.resolve();
      let failure: string | undefined;
      if (file.size > MAX_FILE_BYTES) failure = 'File exceeds the 50 MB limit';
      else if (!ALLOWED_EXTENSIONS.has(fileExtension(file.name))) failure = 'Unsupported file type';
      else {
        updateItem(item.id, { status: 'uploading' });
        try {
          const bytes = new Uint8Array(await file.slice(0, 5).arrayBuffer());
          if (new TextDecoder().decode(bytes) !== '%PDF-') throw new Error('This file does not contain a valid PDF header');
          const [pdfjs, worker] = await Promise.all([import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?url')]);
          pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
          const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
          staged = { file, pages: pdf.numPages };
          await pdf.destroy();
          await shotDuration;
        } catch (error) {
          await shotDuration;
          failure = error instanceof Error ? error.message : 'Upload failed';
        }
      }
      if (failure) {
        await shotDuration;
        updateItem(item.id, { status: 'error', message: failure });
      } else {
        const point = BASKET_POINT_SPOTS[Math.floor(Math.random() * BASKET_POINT_SPOTS.length)];
        updateItem(item.id, { status: 'success', point });
      }
      setActiveShotId(null);
    }
    setActiveShotId(null);
    setProcessing(false);
    if (staged) {
      onUploadSuccess?.();
      let remaining = 3;
      setCountdown(remaining);
      countdownTimer.current = window.setInterval(() => {
        remaining -= 1;
        if (remaining <= 0) {
          if (countdownTimer.current !== null) window.clearInterval(countdownTimer.current);
          countdownTimer.current = null;
          onStage?.(staged!.file, staged!.pages);
          onClose();
        } else setCountdown(remaining);
      }, 1000);
    }
  };

  const choose = (input: React.RefObject<HTMLInputElement | null>) => input.current?.click();
  const onFilesPicked = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []); event.target.value = '';
    void startUpload(files);
  };
  const onFilesDropped = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault(); setIsDragging(false);
    const entries = Array.from(event.dataTransfer.items).map((item) => (item as DataTransferItem & { webkitGetAsEntry?: () => any }).webkitGetAsEntry?.()).filter(Boolean);
    const files = entries.length ? (await Promise.all(entries.map(readDroppedEntry))).flat() : Array.from(event.dataTransfer.files);
    void startUpload(files);
  };

  return (
    <div className="nexus-upload-overlay nexus-upload-overlay-faithful" role="presentation" onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }} onDragLeave={(event) => { if (event.currentTarget === event.target) setIsDragging(false); }} onDrop={onFilesDropped}>
      <div className="nexus-upload-frame-holder" style={{ width: FIGMA_W * scale, height: FIGMA_H * scale }} onClick={(event) => event.stopPropagation()}>
        <div className="nexus-upload-canvas" style={{ transform: `scale(${scale})` }} role="dialog" aria-modal="true" aria-label="Upload files">
          <button type="button" className="figma-close-button" onClick={onClose} disabled={processing || countdown !== null} aria-label="Close upload">×</button>
          <p className="figma-upload-title" style={style(80, 88)} data-node-id="60:758">Upload files</p>
          <p className="figma-upload-subtitle" style={style(80, 150)} data-node-id="60:759">{processing ? 'Files are flying to the hoop…' : completed ? 'PDF verification results' : 'Choose a PDF to verify, or drag it here.'}</p>
          <motion.div className="figma-scoreboard" style={style(841, 92, 159, 48)} data-node-id="60:766" {...motionFor('60:766')}>
            <p className="figma-score-label" data-node-id="60:767">Verified</p>
            <div className="figma-score-digits" data-node-id="60:768">{items.length ? <div className="figma-score-digit figma-score-result"><p>{successCount}</p></div> : <><motion.div className="figma-score-digit figma-score-zero" data-node-id="60:777" {...motionFor('60:777')}><p>0</p></motion.div><motion.div className="figma-score-digit figma-score-one" data-node-id="60:786" {...motionFor('60:786')}><p>1</p></motion.div></>}</div>
          </motion.div>

          <motion.div className={`figma-dropzone ${isDragging ? 'is-dragging-file' : ''}`} style={style(160, 225, 760, 415)} data-node-id="60:801" {...motionFor('60:801')} onClick={() => !items.length && choose(fileInput)} role="button" tabIndex={0} aria-label="Drop files here or choose files" onKeyDown={(event) => { if ((event.key === 'Enter' || event.key === ' ') && !items.length) choose(fileInput); }}>
            <input ref={fileInput} type="file" accept="application/pdf,.pdf" hidden onChange={onFilesPicked} />
            <input ref={folderInput} type="file" accept="application/pdf,.pdf" hidden onChange={onFilesPicked} />
            <div className="figma-upload-icon" style={style(354, 41, 52, 52)} data-node-id="60:802"><img src="/assets/upload-figma/upload-icon.png" alt="" /></div>
            <p className="figma-drop-title" style={style(0, 120, 760)} data-node-id="60:804">{processing ? 'Taking the shot!' : completed ? `${successCount} of ${items.length} verified` : 'Drop a PDF here'}</p>
            <p className="figma-drop-hint" style={style(0, 176, 760)} data-node-id="60:805">{processing ? 'Your PDF is being verified locally' : completed ? 'Review the verification result below' : 'PDF · up to 50 MB'}</p>
            <div className="figma-target" style={style(280, 275, 200, 120)} data-node-id="60:806" />
            {!items.length && !countdown && <div className="figma-picker-actions"><button type="button" className="figma-pick-button" onClick={(event) => { event.stopPropagation(); choose(fileInput); }}>Choose PDF</button></div>}
          </motion.div>

          {!items.length && <label className="figma-animation-toggle" style={style(80, 190)}><input type="checkbox" checked={playShotAnimation} onChange={(event) => { const enabled = event.target.checked; setPlayShotAnimation(enabled); writeUserPreference('nexus-upload-shot-animation', currentUserId, enabled ? 'on' : 'off'); }} /><span>Play shot animation</span></label>}

          {aimNodes.map((aim, index) => <motion.div key={aim.id} className="figma-aim" style={style(aim.x, aim.y, 32, 32)} data-node-id={aim.id} {...motionFor(aim.id)}><span style={{ transform: `scale(${aim.size / 32})` }}><img src={`/assets/upload-figma/aim-${String(index + 1).padStart(2, '0')}.svg`} alt="" /></span></motion.div>)}
          <motion.div className="figma-rim-mount" style={style(522, 628, 36, 14)} data-node-id="60:1143" {...motionFor('60:1143')} />
          <motion.div className="figma-rim-back" style={style(420, 622, 240, 36)} data-node-id="60:1150" {...motionFor('60:1150')}><img src="/assets/upload-figma/basketball-rim-back.svg" alt="" /></motion.div>
          {activeShotId && playShotAnimation && !prefersReducedMotion && items.filter((item) => item.id === activeShotId).map((item) => <motion.div key={item.id} className="figma-file-flight figma-user-file uploading" style={{ ...style(190, 985, 120, 150), transformOrigin: '0 0' }} transformTemplate={({ x = '0px', y = '0px', rotate = '0deg', scaleX = '1', scaleY = '1' }) => `translate(${x}, ${y}) translate(50%, 50%) rotate(${rotate}) scale(${scaleX}, ${scaleY}) translate(-50%, -50%)`} initial={FIGMA_PROJECTILE_MOTION.initial} animate={FIGMA_PROJECTILE_MOTION.animate} transition={FIGMA_PROJECTILE_MOTION.transition}><img src="/assets/upload-figma/flying-file.png" alt="" /><span title={item.file.name}>{item.file.name}</span></motion.div>)}
          <motion.div className="figma-net" style={style(425, 646, 230, 150)} data-node-id="60:1250" {...motionFor('60:1250')}><img src="/assets/upload-figma/basketball-net.png" alt="" /></motion.div>
          <motion.div className="figma-rim-front" style={style(420, 622, 240, 36)} data-node-id="60:1258" {...motionFor('60:1258')}><img src="/assets/upload-figma/basketball-rim.png" alt="" /></motion.div>
          {playShotAnimation && items.filter((item) => item.status === 'success').map((item) => <motion.span key={item.id} className="figma-plus-one" style={style(item.point?.x ?? 598, item.point?.y ?? 590)} initial={{ opacity: 0, y: 14, scale: 0.4 }} animate={{ opacity: [0, 1, 1, 0], y: [14, -4, -4, -36], scale: [0.4, 1.15, 1, 0.9] }} transition={{ duration: 2.4, delay: 0, ease: 'easeOut' }}>+1</motion.span>)}
          {countdown !== null && <div className="figma-upload-countdown">Verified ✓<span>Opening Academic Repository in {countdown}…</span></div>}

          {completed && <div className="figma-results">
            {items.map((item, index) => <motion.div key={item.id} className={`figma-result-row ${item.status}`} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.06 }}>
              <span className="figma-result-file" aria-hidden="true">{fileExtension(item.file.name).toUpperCase().slice(0, 4)}</span>
              <span className="figma-result-name" title={item.file.name}>{item.file.name}<small>{(item.file.size / (1024 * 1024)).toFixed(2)} MB{item.message ? ` · ${item.message}` : ''}</small></span>
              <span className="figma-result-status">{item.status === 'success' ? <><img src="/assets/upload-figma/upload-success.png" alt="" />Verified successfully</> : item.status === 'error' ? <><b aria-hidden="true">×</b>Verification failed</> : <><i />Verifying…</>}</span>
            </motion.div>)}
          </div>}
          {!items.length && playShotAnimation && <motion.div className="figma-file-flight" style={{ ...style(190, 985, 120, 150), transformOrigin: '0 0' }} transformTemplate={({ x = '0px', y = '0px', rotate = '0deg', scaleX = '1', scaleY = '1' }) => `translate(${x}, ${y}) translate(50%, 50%) rotate(${rotate}) scale(${scaleX}, ${scaleY}) translate(-50%, -50%)`} data-node-id="60:1218" {...motionFor('60:1218')}><img src="/assets/upload-figma/flying-file.png" alt="" /></motion.div>}
          {!items.length && playShotAnimation && <><motion.p className="figma-plus-one" style={style(600, 610)} data-node-id="60:1280" {...motionFor('60:1280')}>+1</motion.p><motion.div className="figma-cursor figma-cursor-arrow" style={style(246.6, 1056.6, 47.6, 68)} data-node-id="60:1405" {...motionFor('60:1405')}><img src="/assets/upload-figma/cursor.png" alt="" /></motion.div><motion.div className="figma-cursor figma-cursor-open" style={style(218.8, 1024, 57.6, 64)} data-node-id="60:1448" {...motionFor('60:1448')}><img src="/assets/upload-figma/open-hand.svg" alt="" /></motion.div><motion.div className="figma-cursor figma-cursor-closed" style={style(219.6, 1026.4, 57.6, 64)} data-node-id="60:1499" {...motionFor('60:1499')}><img src="/assets/upload-figma/closed-hand.svg" alt="" /></motion.div></>}
          {completed && countdown === null && <button type="button" className="figma-done-button" onClick={onClose}>Done</button>}
        </div>
      </div>
    </div>
  );
};
