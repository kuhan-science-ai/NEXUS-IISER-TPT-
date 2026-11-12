import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { api, UserSummary } from '../services/api';
import './AcademicResourceMetadataModal.css';

export interface StagedAcademicResource { file: File; pages: number; }
export interface EditableAcademicResource { id: string; title: string; subject_code: string; publisher_name: string; pages: number; original_filename: string; size_bytes: number; thumbnail_url?: string | null; banner_url?: string | null; }
interface Props { staged?: StagedAcademicResource; resource?: EditableAcademicResource; user: UserSummary; onClose: () => void; onUploaded: () => void; }
const formatSize = (size: number) => size >= 1024 * 1024 ? `${(size / 1024 / 1024).toFixed(2)} MB` : `${(size / 1024).toFixed(1)} KB`;

export const AcademicResourceMetadataModal: React.FC<Props> = ({ staged, resource, user, onClose, onUploaded }) => {
  const [title, setTitle] = useState(resource?.title || staged?.file.name.replace(/\.pdf$/i, '') || '');
  const [subjectCode, setSubjectCode] = useState(resource?.subject_code || '');
  const accountName = user.display_name || user.full_name || user.username;
  const [useAccountName, setUseAccountName] = useState(!resource || resource.publisher_name === accountName);
  const [publisher, setPublisher] = useState(resource?.publisher_name || accountName);
  const [pages, setPages] = useState(resource?.pages || staged?.pages || 1);
  const [replacementPdf, setReplacementPdf] = useState<File | null>(null);
  const [thumbnail, setThumbnail] = useState<File | null>(null);
  const [banner, setBanner] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState('');
  const [bannerPreview, setBannerPreview] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

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

  const chooseImage = (file: File | undefined, setFile: (file: File | null) => void) => {
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) { setError('Cover and banner images must be 4 MB or smaller.'); return; }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { setError('Choose a JPG, PNG, or WebP image.'); return; }
    setError(''); setFile(file);
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
      <div className="academic-resource-file-summary"><span className="academic-resource-pdf">PDF</span><div><strong>{staged?.file.name || resource?.original_filename}</strong><small>{pages} pages · {formatSize(staged?.file.size || resource?.size_bytes || 0)}</small></div></div>
      {resource && <label>Replace PDF (optional)<input type="file" accept="application/pdf,.pdf" onChange={async event => { const file = event.target.files?.[0]; if (!file) return; try { const [pdfjs, worker] = await Promise.all([import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?url')]); pdfjs.GlobalWorkerOptions.workerSrc = worker.default; const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise; setPages(pdf.numPages); setReplacementPdf(file); setError(''); } catch { setError('Choose a valid PDF file.'); } }} /></label>}
      {resource && <label>Pages<input type="number" required min={1} max={100000} value={pages} onChange={event => setPages(Number(event.target.value))} /></label>}
      <label>Title<input required maxLength={200} value={title} onChange={event => setTitle(event.target.value)} placeholder="Resource title" /></label>
      <label>Subject code<input required maxLength={40} value={subjectCode} onChange={event => setSubjectCode(event.target.value)} placeholder="e.g. PHY 301" /></label>
      <label>Publisher name<input required maxLength={120} disabled={useAccountName} value={useAccountName ? accountName : publisher} onChange={event => setPublisher(event.target.value)} placeholder="Publisher name" /></label>
      <label className="academic-resource-account-choice"><input type="checkbox" checked={useAccountName} onChange={event => { setUseAccountName(event.target.checked); if (!event.target.checked) setPublisher(''); }} /> Use my account name ({accountName})</label>
      <div className="academic-resource-artwork-fields">
        <label className="academic-resource-artwork-picker">File thumbnail <small>Optional square profile image · JPG, PNG, WebP · max 4 MB</small><input type="file" accept="image/jpeg,image/png,image/webp" onChange={event => chooseImage(event.target.files?.[0], setThumbnail)} />{thumbnailPreview && <img className="academic-resource-thumbnail-preview" src={thumbnailPreview} alt="Thumbnail preview" />}</label>
        <label className="academic-resource-artwork-picker">Banner image <small>Optional wide header image. Text and details stay in a separate panel.</small><input type="file" accept="image/jpeg,image/png,image/webp" onChange={event => chooseImage(event.target.files?.[0], setBanner)} />{bannerPreview && <img className="academic-resource-banner-preview" src={bannerPreview} alt="Banner preview" />}</label>
      </div>
      {error && <p className="academic-resource-error" role="alert">{error}</p>}
      <footer><button type="button" className="academic-resource-discard" onClick={onClose} disabled={saving}>Discard</button><button type="submit" className="academic-resource-upload" disabled={saving}>{saving ? 'Saving…' : resource ? 'Save changes' : 'Upload file'}</button></footer>
    </form>
  </div>;
};
