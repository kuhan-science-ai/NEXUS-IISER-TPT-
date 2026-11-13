import React, { useEffect, useRef, useState } from 'react';
import { RotateCcw, X, ZoomIn, Check } from 'lucide-react';
import { api, UserSummary } from '../services/api';
import './AcademicResourceMetadataModal.css';

export interface StagedAcademicResource { file: File; pages: number; }
export type AcademicResourceAnimation = 'none' | 'fire-grid' | 'flower-grid';
export interface EditableAcademicResource { id: string; title: string; subject_code: string; publisher_name: string; pages: number; original_filename: string; size_bytes: number; thumbnail_url?: string | null; banner_url?: string | null; animation?: AcademicResourceAnimation; animation_color?: string; }
interface Props { staged?: StagedAcademicResource; resource?: EditableAcademicResource; user: UserSummary; onClose: () => void; onUploaded: () => void; }
const formatSize = (size: number) => size >= 1024 * 1024 ? `${(size / 1024 / 1024).toFixed(2)} MB` : `${(size / 1024).toFixed(1)} KB`;
const hueFromHex = (hex: string) => { const [r, g, b] = hex.match(/[0-9a-f]{2}/gi)?.map(value => parseInt(value, 16) / 255) || [1, .4, 0]; const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min; if (!d) return 0; const hue = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4; return Math.round((hue * 60 - 22 + 360) % 360); };
type CropKind = 'thumbnail' | 'banner';
type CropState = { kind: CropKind; file: File; url: string; scale: number; rotation: number; x: number; y: number };

export const AcademicResourceMetadataModal: React.FC<Props> = ({ staged, resource, user, onClose, onUploaded }) => {
  const [title, setTitle] = useState(resource?.title || staged?.file.name.replace(/\.pdf$/i, '') || '');
  const [subjectCode, setSubjectCode] = useState(resource?.subject_code || '');
  const accountName = user.display_name || user.full_name || user.username;
  const [useAccountName, setUseAccountName] = useState(!resource || resource.publisher_name === accountName);
  const [publisher, setPublisher] = useState(resource?.publisher_name || accountName);
  const [pages, setPages] = useState(resource?.pages || staged?.pages || 1);
  const [animation, setAnimation] = useState<AcademicResourceAnimation>(resource?.animation === 'fire-grid' || resource?.animation === 'flower-grid' ? resource.animation : 'none');
  const [animationColor, setAnimationColor] = useState(resource?.animation_color || '#ff6a00');
  const [replacementPdf, setReplacementPdf] = useState<File | null>(null);
  const [thumbnail, setThumbnail] = useState<File | null>(null);
  const [banner, setBanner] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState('');
  const [bannerPreview, setBannerPreview] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [crop, setCrop] = useState<CropState | null>(null);
  const cropDrag = useRef<{ id: number; x: number; y: number; startX: number; startY: number } | null>(null);

  useEffect(() => {
    if (!thumbnail) { setThumbnailPreview(''); return; }
    const url = URL.createObjectURL(thumbnail); setThumbnailPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [thumbnail]);
  useEffect(() => {
    if (!banner) { setBannerPreview(''); return; }
    const url = URL.createObjectURL(banner); setBannerPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [banner]);

  const chooseImage = (file: File | undefined, kind: CropKind) => {
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) { setError('Cover and banner images must be 4 MB or smaller.'); return; }
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) { setError('Choose a JPG, PNG, WebP, or GIF image.'); return; }
    setError(''); setCrop({ kind, file, url: URL.createObjectURL(file), scale: 1, rotation: 0, x: 0, y: 0 });
  };

  const applyCrop = async () => {
    if (!crop) return;
    const image = new Image(); image.src = crop.url;
    try { await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('Could not read this image.')); }); }
    catch { setError('Could not read this image.'); return; }
    const [width, height] = crop.kind === 'thumbnail' ? [800, 800] : [1600, 500];
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    const context = canvas.getContext('2d'); if (!context) return;
    const ratio = Math.max(width / image.naturalWidth, height / image.naturalHeight);
    context.translate(width / 2 + crop.x * width, height / 2 + crop.y * height);
    context.rotate(crop.rotation * Math.PI / 180); context.scale(crop.scale, crop.scale);
    context.drawImage(image, -image.naturalWidth * ratio / 2, -image.naturalHeight * ratio / 2, image.naturalWidth * ratio, image.naturalHeight * ratio);
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/webp', .92));
    if (!blob) { setError('Could not prepare this image.'); return; }
    const output = new File([blob], `${crop.file.name.replace(/\.[^.]+$/, '')}.webp`, { type: 'image/webp' });
    if (crop.kind === 'thumbnail') setThumbnail(output); else setBanner(output);
    URL.revokeObjectURL(crop.url); setCrop(null);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(''); setSaving(true);
    try {
      const form = new FormData();
      if (staged) form.append('file', staged.file, staged.file.name);
      if (replacementPdf) form.append('file', replacementPdf, replacementPdf.name);
      form.append('title', title.trim());
      form.append('subject_code', subjectCode.trim());
      form.append('publisher_name', (useAccountName ? accountName : publisher).trim());
      form.append('pages', String(pages));
      form.append('animation', animation);
      form.append('animation_color', animationColor);
      if (thumbnail) form.append('thumbnail', thumbnail, thumbnail.name);
      if (banner) form.append('banner', banner, banner.name);
      const saved = resource ? await api.updateResource(resource.id, form) : await api.uploadResource(form);
      window.dispatchEvent(new CustomEvent('nexus-resource-uploaded', { detail: { title: saved.title, resourceId: saved.id } }));
      onUploaded();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'The resource could not be uploaded.'); }
    finally { setSaving(false); }
  };

  return <div className="academic-resource-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !saving) onClose(); }}>
    <form className="academic-resource-modal" role="dialog" aria-modal="true" aria-labelledby="academic-resource-modal-title" onSubmit={submit}>
      <header><div><span>ACADEMIC REPOSITORY</span><h2 id="academic-resource-modal-title">{resource ? 'Edit resource' : 'Add resource details'}</h2><p>{resource ? 'Update the details or replace the PDF.' : 'Your PDF is verified and ready to publish.'}</p></div><button type="button" aria-label="Close" onClick={onClose} disabled={saving}><X size={18} /></button></header>
      <div className="academic-resource-editor-layout"><div className="academic-resource-editor-fields"><div className="academic-resource-file-summary"><span className="academic-resource-pdf">PDF</span><div><strong>{staged?.file.name || replacementPdf?.name || resource?.original_filename}</strong><small>{pages} pages · {formatSize(staged?.file.size || replacementPdf?.size || resource?.size_bytes || 0)}</small></div></div>
      {resource && <label>Replace PDF (optional)<input type="file" accept="application/pdf,.pdf" onChange={async event => { const file = event.target.files?.[0]; if (!file) return; try { const [pdfjs, worker] = await Promise.all([import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?url')]); pdfjs.GlobalWorkerOptions.workerSrc = worker.default; const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise; setPages(pdf.numPages); setReplacementPdf(file); setError(''); } catch { setError('Choose a valid PDF file.'); } }} /></label>}
      {resource && <label>Pages<input type="number" required min={1} max={100000} value={pages} onChange={event => setPages(Number(event.target.value))} /></label>}
      <label>Title<input required maxLength={200} value={title} onChange={event => setTitle(event.target.value)} placeholder="Resource title" /></label>
      <label>Subject code<input required maxLength={40} value={subjectCode} onChange={event => setSubjectCode(event.target.value)} placeholder="e.g. PHY 301" /></label>
      <label>Publisher name<input required maxLength={120} disabled={useAccountName} value={useAccountName ? accountName : publisher} onChange={event => setPublisher(event.target.value)} placeholder="Publisher name" /></label>
      <label className="academic-resource-account-choice"><input type="checkbox" checked={useAccountName} onChange={event => { setUseAccountName(event.target.checked); if (!event.target.checked) setPublisher(''); }} /> Use my account name ({accountName})</label>
      <div className="academic-resource-artwork-fields">
        <label className="academic-resource-artwork-picker">File thumbnail <small>Optional square profile image · JPG, PNG, WebP, GIF · max 4 MB</small><input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={event => { chooseImage(event.target.files?.[0], 'thumbnail'); event.currentTarget.value = ''; }} />{thumbnailPreview && <img className="academic-resource-thumbnail-preview" src={thumbnailPreview} alt="Thumbnail preview" />}</label>
        <label className="academic-resource-artwork-picker">Banner image <small>Optional wide header image · JPG, PNG, WebP, GIF. Drag, zoom, and rotate to fit.</small><input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={event => { chooseImage(event.target.files?.[0], 'banner'); event.currentTarget.value = ''; }} />{bannerPreview && <img className="academic-resource-banner-preview" src={bannerPreview} alt="Banner preview" />}</label>
      </div>
      </div><aside className="academic-resource-overview"><span>LIVE OVERVIEW</span><div className="academic-resource-animation-stage">{animation === 'fire-grid' && <img src="/resource-grid-flame-frame.webp" alt="Transparent fire frame preview" style={{ filter: `hue-rotate(${hueFromHex(animationColor)}deg) saturate(1.8)` }} />}{animation === 'flower-grid' && <img src="/resource-flower-frame.webp" alt="Transparent flower frame preview" />}{animation === 'none' && <span>No animation selected</span>}</div><fieldset className="academic-resource-animation-options"><legend>Card animation</legend><label className={animation === 'fire-grid' ? 'is-selected' : ''}><input type="radio" name="academic-resource-animation" value="fire-grid" checked={animation === 'fire-grid'} onChange={() => setAnimation('fire-grid')} /><span><strong>Fire frame</strong><small>Recolorable animated border</small></span></label><label className={animation === 'flower-grid' ? 'is-selected' : ''}><input type="radio" name="academic-resource-animation" value="flower-grid" checked={animation === 'flower-grid'} onChange={() => setAnimation('flower-grid')} /><span><strong>Flower frame</strong><small>Transparent animated border</small></span></label><label className={animation === 'none' ? 'is-selected' : ''}><input type="radio" name="academic-resource-animation" value="none" checked={animation === 'none'} onChange={() => setAnimation('none')} /><span><strong>None</strong><small>No card animation</small></span></label></fieldset>{animation === 'fire-grid' && <label className="academic-resource-animation-color">Fire color<input type="color" value={animationColor} onChange={event => setAnimationColor(event.target.value)} /></label>}<small>Choose one option. The selected animation plays in this preview and around the resource card.</small></aside></div>
      {error && <p className="academic-resource-error" role="alert">{error}</p>}
      <footer><button type="button" className="academic-resource-discard" onClick={onClose} disabled={saving}>Discard</button><button type="submit" className="academic-resource-upload" disabled={saving}>{saving ? 'Saving…' : resource ? 'Save changes' : 'Upload file'}</button></footer>
    </form>
    {crop && <div className="academic-resource-crop-backdrop"><section className="academic-resource-crop-modal" role="dialog" aria-modal="true" aria-labelledby="resource-crop-title"><header><div><h3 id="resource-crop-title">Adjust {crop.kind === 'thumbnail' ? 'file picture' : 'banner'}</h3><p>{crop.file.type === 'image/gif' ? 'Preview the GIF, then apply the selected frame.' : 'Drag to reposition, zoom, or rotate.'}</p></div><button type="button" onClick={() => { URL.revokeObjectURL(crop.url); setCrop(null); }} aria-label="Cancel crop"><X size={17} /></button></header><div className={`academic-resource-crop-stage ${crop.kind === 'thumbnail' ? 'is-square' : 'is-banner'}`} onPointerDown={event => { cropDrag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, startX: crop.x, startY: crop.y }; event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={event => { const drag = cropDrag.current; if (!drag || drag.id !== event.pointerId) return; const rect = event.currentTarget.getBoundingClientRect(); setCrop(current => current ? { ...current, x: Math.max(-1, Math.min(1, drag.startX + (event.clientX - drag.x) / rect.width)), y: Math.max(-1, Math.min(1, drag.startY + (event.clientY - drag.y) / rect.height)) } : current); }} onPointerUp={() => { cropDrag.current = null; }} onPointerCancel={() => { cropDrag.current = null; }}><img src={crop.url} alt="Crop preview" draggable={false} style={{ transform: `translate(${crop.x * 100}%,${crop.y * 100}%) rotate(${crop.rotation}deg) scale(${crop.scale})` }} /></div><div className="academic-resource-crop-controls"><label><ZoomIn size={15} /> Zoom <input type="range" min="1" max="3" step=".01" value={crop.scale} onChange={event => setCrop({ ...crop, scale: Number(event.target.value) })} /></label><button type="button" onClick={() => setCrop({ ...crop, rotation: crop.rotation + 90 })}><RotateCcw size={15} /> Rotate</button><button type="button" onClick={() => setCrop({ ...crop, scale: 1, rotation: 0, x: 0, y: 0 })}>Reset</button></div><footer><button type="button" onClick={() => { URL.revokeObjectURL(crop.url); setCrop(null); }}>Cancel</button><button type="button" className="primary" onClick={() => void applyCrop()}><Check size={15} /> Apply crop</button></footer></section></div>}
  </div>;
};
