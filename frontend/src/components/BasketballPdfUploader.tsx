import React, { useRef, useState } from 'react';
import { FileText, Upload, X } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import './BasketballPdfUploader.css';

interface BasketballPdfUploaderProps {
  file: File | null;
  onChange: (file: File | null) => void;
  disabled?: boolean;
}

export const BasketballPdfUploader: React.FC<BasketballPdfUploaderProps> = ({ file, onChange, disabled = false }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [shotKey, setShotKey] = useState(0);
  const [fileError, setFileError] = useState('');
  const reducedMotion = useReducedMotion();

  const selectFile = (picked?: File) => {
    if (!picked) return;
    if (picked.type !== 'application/pdf' || !picked.name.toLowerCase().endsWith('.pdf')) { setFileError('Only PDF files can be attached.'); return; }
    if (picked.size > 10 * 1024 * 1024) { setFileError('PDFs must be 10 MB or smaller.'); return; }
    setFileError('');
    onChange(picked);
    setShotKey(value => value + 1);
  };

  const onDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!disabled) selectFile(event.dataTransfer.files?.[0]);
  };

  return <div className="daily-question-pdf-uploader" onDragOver={event => event.preventDefault()} onDrop={onDrop}>
    <input ref={inputRef} type="file" accept="application/pdf,.pdf" hidden disabled={disabled} onChange={event => { selectFile(event.target.files?.[0]); event.target.value = ''; }} />
    <button type="button" className="daily-question-pdf-picker" disabled={disabled} onClick={() => inputRef.current?.click()}>
      <span className="daily-question-pdf-icon"><FileText size={17} /></span>
      <span className="daily-question-pdf-copy"><strong>{file ? file.name : 'Attach a PDF (optional)'}</strong><small>{file ? `${(file.size / 1024 / 1024).toFixed(1)} MB · up to 10 MB` : 'Drop a PDF here or choose a file · up to 10 MB'}</small></span>
      <span className="daily-question-pdf-choose"><Upload size={14} /> {file ? 'Replace' : 'Choose PDF'}</span>
    </button>
    {file && <button type="button" className="daily-question-pdf-remove" aria-label="Remove attached PDF" onClick={() => onChange(null)} disabled={disabled}><X size={14} /></button>}
    <div className="daily-question-basket-stage" aria-hidden="true">
      <img className="daily-question-basket-net" src="/assets/upload-figma/basketball-net.png" alt="" />
      <img className="daily-question-basket-rim" src="/assets/upload-figma/basketball-rim.png" alt="" />
    {file && !reducedMotion && <motion.img key={shotKey} className="daily-question-basket-ball" src="/assets/upload-figma/flying-file.png" alt="" initial={{ x: -4, y: 45, rotate: -30, scale: 0.7, opacity: 0 }} animate={{ x: 44, y: -3, rotate: 14, scale: 0.52, opacity: [0, 1, 1, 0] }} transition={{ duration: 1.05, ease: 'easeIn' }} />}
    </div>
    {fileError && <span className="daily-question-pdf-error" role="alert">{fileError}</span>}
    <span className="daily-question-pdf-sr-status" role="status">{file ? `PDF selected: ${file.name}` : ''}</span>
  </div>;
};
