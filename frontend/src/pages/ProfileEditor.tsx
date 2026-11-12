import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, BookOpen, Camera, Check, ChevronDown, CircleUserRound, ImagePlus, LayoutGrid, LockKeyhole, Pause, Play, RotateCcw, Sparkles, X, ZoomIn } from 'lucide-react';
import { api, UserSummary } from '../services/api';
import { readUserPreference, writeUserPreference } from '../services/userPreferences';
import './ProfileEditor.css';

interface ProfileEditorProps {
  currentUser: UserSummary;
  onProfileUpdated?: () => void | Promise<void>;
  onClose: () => void;
}

const pronounOptions = ['Prefer not to say', 'she / her', 'he / him', 'they / them', 'Add custom…'];
const formatMediaSize = (bytes: number) => bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(2)} MB` : `${(bytes / 1024).toFixed(0)} KB`;
type ImageKind = 'avatar' | 'banner';
type ImageEditorState = { kind: ImageKind; file: File; url: string; sourceSize: number; isVideo: boolean; scale: number; rotation: number; x: number; y: number; trimStart: number; trimEnd: number };

const hexToHsv = (hex: string) => {
  const parsed = hex.replace('#', '');
  const r = parseInt(parsed.slice(0, 2), 16) / 255, g = parseInt(parsed.slice(2, 4), 16) / 255, b = parseInt(parsed.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
  let hue = 0;
  if (delta) hue = max === r ? ((g - b) / delta + (g < b ? 6 : 0)) * 60 : max === g ? ((b - r) / delta + 2) * 60 : ((r - g) / delta + 4) * 60;
  return { h: hue, s: max ? delta / max : 0, v: max };
};
const hsvToHex = (h: number, s: number, v: number) => {
  const c = v * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = v - c;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return `#${[r, g, b].map(value => Math.round((value + m) * 255).toString(16).padStart(2, '0')).join('')}`;
};

export const ProfileEditor: React.FC<ProfileEditorProps> = ({ currentUser, onProfileUpdated, onClose }) => {
  const avatarPicker = useRef<HTMLInputElement>(null);
  const bannerPicker = useRef<HTMLInputElement>(null);
  const cropVideoRef = useRef<HTMLVideoElement>(null);
  const imageDrag = useRef<{ pointerId: number; x: number; y: number; startX: number; startY: number } | null>(null);
  const [displayName, setDisplayName] = useState(currentUser.display_name || currentUser.full_name || '');
  const [bio, setBio] = useState(currentUser.bio || '');
  const [pronouns, setPronouns] = useState(() => readUserPreference('nexus-profile-pronouns', currentUser.id, 'Prefer not to say'));
  const [accentColor, setAccentColor] = useState(currentUser.accent_color && currentUser.accent_color.toLowerCase() !== '#10b981' ? currentUser.accent_color : '#5865f2');
  const themeStorageKey = `nexus-profile-theme-${currentUser.id}`;
  const storedTheme = (() => {
    try { return JSON.parse(localStorage.getItem(themeStorageKey) || '{}'); } catch { return {}; }
  })();
  const [themeColorA, setThemeColorA] = useState(storedTheme.a || '#5865f2');
  const [themeColorB, setThemeColorB] = useState(storedTheme.b || '#42d8c3');
  const updateThemeColorA = (color: string) => setThemeColorA(color);
  const updateThemeColorB = (color: string) => setThemeColorB(color);
  const mediaStorageKey = `nexus-profile-media-${currentUser.id}`;
  const storedMedia = (() => { try { return JSON.parse(localStorage.getItem(mediaStorageKey) || '{}'); } catch { return {}; } })();
  const [avatarIsVideo, setAvatarIsVideo] = useState(currentUser.avatar_mime_type?.startsWith('video/') ?? Boolean(storedMedia.avatarIsVideo));
  const [bannerIsVideo, setBannerIsVideo] = useState(currentUser.banner_mime_type?.startsWith('video/') ?? Boolean(storedMedia.bannerIsVideo));
  const [avatarEffect, setAvatarEffect] = useState<'none' | 'rotate' | 'shine' | 'pulse'>(storedMedia.avatarEffect || 'none');
  const [avatarUrl, setAvatarUrl] = useState(currentUser.avatar_url || (currentUser.avatar_file_id ? `/api/v1/files/${currentUser.avatar_file_id}/download` : ''));
  const [bannerUrl, setBannerUrl] = useState(currentUser.banner_url || (currentUser.banner_file_id ? `/api/v1/files/${currentUser.banner_file_id}/download` : ''));
  const originalAvatarUrl = currentUser.avatar_url || (currentUser.avatar_file_id ? `/api/v1/files/${currentUser.avatar_file_id}/download` : '');
  const originalBannerUrl = currentUser.banner_url || (currentUser.banner_file_id ? `/api/v1/files/${currentUser.banner_file_id}/download` : '');
  const [pendingAvatar, setPendingAvatar] = useState<File | null>(null);
  const [pendingBanner, setPendingBanner] = useState<File | null>(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [removeBanner, setRemoveBanner] = useState(false);
  const originalBannerMode = originalBannerUrl ? 'image' : 'default';
  const [bannerMode, setBannerMode] = useState<'image' | 'solid' | 'default'>(originalBannerMode);
  const [activeBoardTab, setActiveBoardTab] = useState<'board' | 'activity' | 'reading'>('board');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [imageEditor, setImageEditor] = useState<ImageEditorState | null>(null);
  const [cropTime, setCropTime] = useState(0);
  const [cropDuration, setCropDuration] = useState(0);
  const [cropPlaying, setCropPlaying] = useState(true);
  const [isCloseBlocked, setIsCloseBlocked] = useState(false);
  const initialValues = useRef({ displayName: currentUser.display_name || currentUser.full_name || '', bio: currentUser.bio || '', pronouns, accentColor, themeColorA, themeColorB, avatarEffect });
  const hasUnsavedChanges = displayName.trim() !== initialValues.current.displayName.trim()
    || bio !== initialValues.current.bio
    || pronouns !== initialValues.current.pronouns
    || accentColor !== initialValues.current.accentColor
    || themeColorA !== initialValues.current.themeColorA
    || themeColorB !== initialValues.current.themeColorB
    || avatarEffect !== initialValues.current.avatarEffect
    || pendingAvatar !== null
    || pendingBanner !== null
    || removeAvatar
    || removeBanner
    || bannerMode !== originalBannerMode;

  const raiseUnsavedWarning = () => {
    setIsCloseBlocked(false);
    requestAnimationFrame(() => setIsCloseBlocked(true));
  };

  const requestClose = () => {
    if (hasUnsavedChanges) raiseUnsavedWarning();
    else onClose();
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      requestClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [hasUnsavedChanges]);

  const initials = (displayName || currentUser.username).split(/\s+/).filter(Boolean).map(part => part[0]).join('').slice(0, 2).toUpperCase();

  const openImageEditor = async (kind: ImageKind, file?: File) => {
    if (!file) return;
    const limit = kind === 'avatar' ? 8 : 20;
    let mediaFile = file;
    let isVideo = file.type === 'video/mp4' || file.type === 'video/webm';
    if (!file.type.startsWith('image/') && !isVideo) { setError('Choose an image, GIF, MP4 or WebM file.'); return; }
    const oversizeAnimatedBanner = kind === 'banner' && (isVideo || file.type === 'image/gif') && file.size > limit * 1024 * 1024;
    if (file.size > limit * 1024 * 1024 && !oversizeAnimatedBanner) {
      const message = `${kind === 'avatar' ? 'Profile photos' : 'Profile banners'} must be ${limit} MB or smaller, including GIFs and videos.`;
      setError(message);
      if (kind === 'banner') window.alert('This banner is larger than 20 MB. Choose a smaller file.');
      return;
    }
    if (oversizeAnimatedBanner) setError('This video is over 20 MB. Trim it in the preview to reduce the saved size.');
    if (file.type === 'image/gif') {
      try { setError('Preparing animated preview…'); mediaFile = await gifToVideo(file, kind); isVideo = true; }
      catch { setError('This browser could not prepare the GIF preview. Try a video or still image.'); return; }
    }
    let duration = 0;
    if (isVideo) {
      duration = await getVideoDuration(mediaFile);
      if (!Number.isFinite(duration) || (kind === 'avatar' && duration > 15)) { setError('Animated profile photos must be 15 seconds or shorter.'); return; }
    }
    if (oversizeAnimatedBanner) setError('This video is over 20 MB. Trim it in the preview to reduce the saved size.'); else setError('');
    setCropDuration(duration); setCropTime(0); setCropPlaying(true);
    setImageEditor({ kind, file: mediaFile, url: URL.createObjectURL(mediaFile), sourceSize: file.size, isVideo, scale: 1, rotation: 0, x: 0, y: 0, trimStart: 0, trimEnd: Math.min(duration, 15) });
  };

  const getVideoDuration = (file: File) => new Promise<number>((resolve, reject) => { const media = document.createElement('video'); const source = URL.createObjectURL(file); media.preload = 'metadata'; media.onloadedmetadata = () => { URL.revokeObjectURL(source); resolve(media.duration); }; media.onerror = () => { URL.revokeObjectURL(source); reject(new Error('Could not read video metadata.')); }; media.src = source; });

  const gifToVideo = async (file: File, kind: ImageKind): Promise<File> => {
    if (!('MediaRecorder' in window) || !HTMLCanvasElement.prototype.captureStream) throw new Error('Animated recording is unavailable');
    const sourceUrl = URL.createObjectURL(file);
    const image = new Image(); image.src = sourceUrl;
    await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('GIF could not be read')); });
    const [width, height] = kind === 'avatar' ? [800, 800] : [1600, 500];
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    const context = canvas.getContext('2d'); if (!context) throw new Error('Canvas unavailable');
    const ratio = Math.max(width / image.naturalWidth, height / image.naturalHeight);
    const draw = () => { context.clearRect(0, 0, width, height); context.drawImage(image, (width - image.naturalWidth * ratio) / 2, (height - image.naturalHeight * ratio) / 2, image.naturalWidth * ratio, image.naturalHeight * ratio); };
    const stream = canvas.captureStream(30);
    const mimeType = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find(type => MediaRecorder.isTypeSupported(type));
    if (!mimeType) { URL.revokeObjectURL(sourceUrl); throw new Error('WebM recording unavailable'); }
    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 1_500_000 });
    const chunks: BlobPart[] = [];
    const recorded = new Promise<File>((resolve, reject) => {
      recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      recorder.onerror = () => reject(new Error('GIF recording failed'));
      recorder.onstop = () => resolve(new File([new Blob(chunks, { type: 'video/webm' })], `${file.name.replace(/\.[^.]+$/, '')}.webm`, { type: 'video/webm' }));
    });
    let frame = 0; const drawFrame = () => { draw(); frame = requestAnimationFrame(drawFrame); };
    draw(); recorder.start(); frame = requestAnimationFrame(drawFrame);
    await new Promise(resolve => window.setTimeout(resolve, 5000));
    cancelAnimationFrame(frame); recorder.stop(); stream.getTracks().forEach(track => track.stop()); URL.revokeObjectURL(sourceUrl);
    return recorded;
  };

  const beginImageDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!imageEditor) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    imageDrag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, startX: imageEditor.x, startY: imageEditor.y };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.dataset.cropWidth = String(bounds.width);
    event.currentTarget.dataset.cropHeight = String(bounds.height);
  };

  const moveImageDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = imageDrag.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    setImageEditor(current => current ? {
      ...current,
      x: Math.max(-1, Math.min(1, drag.startX + (event.clientX - drag.x) / bounds.width)),
      y: Math.max(-1, Math.min(1, drag.startY + (event.clientY - drag.y) / bounds.height)),
    } : current);
  };

  const endImageDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (imageDrag.current?.pointerId === event.pointerId) imageDrag.current = null;
  };

  const onCropVideoMetadata = (event: React.SyntheticEvent<HTMLVideoElement>) => {
    const duration = event.currentTarget.duration;
    setCropDuration(duration);
    setImageEditor(current => current ? { ...current, trimEnd: Math.min(current.trimEnd || duration, duration) } : null);
  };

  const onCropVideoTime = (event: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = event.currentTarget;
    if (imageEditor && video.currentTime >= imageEditor.trimEnd) video.currentTime = imageEditor.trimStart;
    setCropTime(video.currentTime);
  };

  const changeTrimStart = (value: number) => {
    setImageEditor(current => current ? { ...current, trimStart: value, trimEnd: Math.max(value + .25, current.trimEnd) } : null);
    if (cropVideoRef.current) cropVideoRef.current.currentTime = value;
  };

  const changeTrimEnd = (value: number) => setImageEditor(current => current ? { ...current, trimEnd: value } : null);
  const seekCropVideo = (value: number) => { if (cropVideoRef.current) { cropVideoRef.current.currentTime = value; setCropTime(value); } };

  const pickThemeColor = (target: 'a' | 'b', event: React.PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const saturation = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width));
    const value = Math.max(0, Math.min(1, 1 - ((event.clientY - bounds.top) / bounds.height)));
    const current = hexToHsv(target === 'a' ? themeColorA : themeColorB);
    const next = hsvToHex(current.h, saturation, value);
    if (target === 'a') updateThemeColorA(next); else updateThemeColorB(next);
  };

  const applyImageEdit = async () => {
    if (!imageEditor) return;
    const { kind, file, url, isVideo, scale, rotation, x, y } = imageEditor;
    if (isVideo) {
      try {
        const adjusted = await cropVideo(file, url, kind, { scale, rotation, x, y, trimStart: imageEditor.trimStart, trimEnd: imageEditor.trimEnd });
        const adjustedUrl = URL.createObjectURL(adjusted);
        if (kind === 'avatar') { setPendingAvatar(adjusted); setAvatarUrl(adjustedUrl); setAvatarIsVideo(true); setRemoveAvatar(false); }
        else { setPendingBanner(adjusted); setBannerUrl(adjustedUrl); setBannerIsVideo(true); setRemoveBanner(false); setBannerMode('image'); }
        URL.revokeObjectURL(url); setImageEditor(null);
      } catch (cropError) { setError(cropError instanceof Error ? cropError.message : 'Could not apply the animated crop.'); }
      return;
    }
    const image = isVideo ? document.createElement('video') : new Image();
    if (isVideo) { (image as HTMLVideoElement).muted = true; (image as HTMLVideoElement).playsInline = true; }
    await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('Could not process this image.')); if (isVideo) { (image as HTMLVideoElement).onloadeddata = () => resolve(); (image as HTMLVideoElement).onerror = () => reject(new Error('Could not process this video.')); } image.src = url; });
    const [width, height] = kind === 'avatar' ? [800, 800] : [1600, 500];
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) return;
    const sourceWidth = isVideo ? (image as HTMLVideoElement).videoWidth : (image as HTMLImageElement).naturalWidth;
    const sourceHeight = isVideo ? (image as HTMLVideoElement).videoHeight : (image as HTMLImageElement).naturalHeight;
    const sourceRatio = sourceWidth / sourceHeight;
    const targetRatio = width / height;
    let drawWidth = width; let drawHeight = height;
    if (sourceRatio > targetRatio) drawHeight = height;
    else drawWidth = width;
    if (sourceRatio > targetRatio) drawWidth = height * sourceRatio;
    else drawHeight = width / sourceRatio;
    context.translate(width / 2 + (x * width), height / 2 + (y * height));
    context.rotate((rotation * Math.PI) / 180);
    context.scale(scale, scale);
    context.drawImage(image, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/webp', .92));
    if (!blob) { setError('Could not prepare this image.'); return; }
    const editedFile = new File([blob], `${file.name.replace(/\.[^.]+$/, '')}.webp`, { type: 'image/webp' });
    const editedUrl = URL.createObjectURL(blob);
    if (kind === 'avatar') { setPendingAvatar(editedFile); setAvatarUrl(editedUrl); setAvatarIsVideo(false); setRemoveAvatar(false); }
    else { setPendingBanner(editedFile); setBannerUrl(editedUrl); setBannerIsVideo(false); setRemoveBanner(false); setBannerMode('image'); }
    setImageEditor(null);
  };

  const cropVideo = async (file: File, sourceUrl: string, kind: ImageKind, crop: { scale: number; rotation: number; x: number; y: number; trimStart: number; trimEnd: number }): Promise<File> => {
    if (!('MediaRecorder' in window) || !HTMLCanvasElement.prototype.captureStream) throw new Error('This browser cannot export edited video.');
    const video = document.createElement('video'); video.src = sourceUrl; video.muted = true; video.playsInline = true;
    await new Promise<void>((resolve, reject) => { video.onloadedmetadata = () => resolve(); video.onerror = () => reject(new Error('Could not load this video.')); });
    const [width, height] = kind === 'avatar' ? [800, 800] : [1600, 500];
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    const context = canvas.getContext('2d'); if (!context) throw new Error('Canvas unavailable');
    const ratio = Math.max(width / video.videoWidth, height / video.videoHeight);
    const drawFrame = () => { context.clearRect(0, 0, width, height); context.save(); context.translate(width / 2 + crop.x * width, height / 2 + crop.y * height); context.rotate(crop.rotation * Math.PI / 180); context.scale(crop.scale, crop.scale); context.drawImage(video, -video.videoWidth * ratio / 2, -video.videoHeight * ratio / 2, video.videoWidth * ratio, video.videoHeight * ratio); context.restore(); };
    const stream = canvas.captureStream(30);
    const mimeType = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find(type => MediaRecorder.isTypeSupported(type));
    if (!mimeType) throw new Error('WebM recording unavailable.');
    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 1_500_000 }); const chunks: BlobPart[] = [];
    const output = new Promise<File>((resolve, reject) => { recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); }; recorder.onerror = () => reject(new Error('Video crop export failed.')); recorder.onstop = () => resolve(new File([new Blob(chunks, { type: 'video/webm' })], `${file.name.replace(/\.[^.]+$/, '')}-edited.webm`, { type: 'video/webm' })); });
    let animationFrame = 0;
    video.currentTime = crop.trimStart;
    await new Promise<void>(resolve => { if (Math.abs(video.currentTime - crop.trimStart) < .01) resolve(); else video.onseeked = () => resolve(); });
    await video.play(); drawFrame(); recorder.start();
    await new Promise<void>(resolve => { const monitor = () => { if (video.currentTime >= crop.trimEnd) { resolve(); return; } drawFrame(); animationFrame = requestAnimationFrame(monitor); }; animationFrame = requestAnimationFrame(monitor); });
    cancelAnimationFrame(animationFrame); if (recorder.state !== 'inactive') recorder.stop(); video.pause(); stream.getTracks().forEach(track => track.stop());
    const edited = await output;
    if (edited.size > (kind === 'avatar' ? 8 : 20) * 1024 * 1024) throw new Error('Edited animation is too large. Reduce its duration or resolution.');
    return edited;
  };

  const resetChanges = () => {
    setDisplayName(initialValues.current.displayName); setBio(initialValues.current.bio); setPronouns(initialValues.current.pronouns); setAccentColor(initialValues.current.accentColor); setThemeColorA(initialValues.current.themeColorA); setThemeColorB(initialValues.current.themeColorB);
    setPendingAvatar(null); setPendingBanner(null); setRemoveAvatar(false); setRemoveBanner(false); setBannerMode(originalBannerMode); setAvatarUrl(originalAvatarUrl); setBannerUrl(originalBannerUrl); setAvatarIsVideo(currentUser.avatar_mime_type?.startsWith('video/') ?? Boolean(storedMedia.avatarIsVideo)); setBannerIsVideo(currentUser.banner_mime_type?.startsWith('video/') ?? Boolean(storedMedia.bannerIsVideo)); setAvatarEffect(initialValues.current.avatarEffect); setIsCloseBlocked(false);
  };

  const saveProfile = async (closeAfterSave = true) => {
    setSaving(true); setError('');
    try {
      if (removeAvatar && !pendingAvatar) {
        await api.deleteAvatar();
        setAvatarUrl('');
      } else if (pendingAvatar) {
        if (pendingAvatar.size > 8 * 1024 * 1024) throw new Error('Profile photos must be 8 MB or smaller, including GIFs and videos.');
        const result = await api.uploadAvatar(pendingAvatar);
        setAvatarUrl(result.avatar_url || `/api/v1/files/${result.avatar_file_id}/download`);
        setAvatarIsVideo(pendingAvatar.type.startsWith('video/'));
      }
      if (removeBanner && !pendingBanner) {
        await api.deleteBanner();
        setBannerUrl('');
      } else if (pendingBanner) {
        if (pendingBanner.size > 20 * 1024 * 1024) throw new Error('Profile banners must be 20 MB or smaller, including GIFs and videos.');
        const result = await api.uploadBanner(pendingBanner);
        setBannerUrl(result.banner_url || `/api/v1/files/${result.banner_file_id}/download`);
        setBannerIsVideo(pendingBanner.type.startsWith('video/'));
      }
      await api.updateProfile({ display_name: displayName.trim(), bio: bio.trim(), accent_color: accentColor });
      writeUserPreference('nexus-profile-pronouns', currentUser.id, pronouns === 'Prefer not to say' ? '' : pronouns);
      try { localStorage.setItem(themeStorageKey, JSON.stringify({ a: themeColorA, b: themeColorB })); } catch { /* theme preview remains available for this session */ }
      try { localStorage.setItem(mediaStorageKey, JSON.stringify({ avatarIsVideo, bannerIsVideo, avatarEffect })); } catch { /* media preferences remain available for this session */ }
      await onProfileUpdated?.();
      window.dispatchEvent(new CustomEvent('nexus-profile-updated'));
      initialValues.current = { displayName: displayName.trim(), bio, pronouns, accentColor, themeColorA, themeColorB, avatarEffect };
      setPendingAvatar(null); setPendingBanner(null); setRemoveAvatar(false); setRemoveBanner(false);
      setIsCloseBlocked(false);
      if (closeAfterSave) onClose();
    } catch (saveError: any) {
      setError(saveError?.message || 'Could not save the profile.');
    } finally { setSaving(false); }
  };

  return <div className="profile-editor-overlay" onMouseDown={event => { if (event.target === event.currentTarget) requestClose(); }}>
  <div className={`profile-editor${isCloseBlocked ? ' is-close-blocked' : ''}`} role="dialog" aria-modal="true" aria-label="Edit main profile" onMouseDown={event => event.stopPropagation()} style={{ '--profile-accent': accentColor, '--profile-theme-a': themeColorA, '--profile-theme-b': themeColorB } as React.CSSProperties}>
    <aside className="profile-editor-controls">
      <div className="profile-editor-controls-head">
        <button type="button" className="profile-editor-title" onClick={requestClose}><span>Main Profile</span><ChevronDown size={15} /></button>
        <button type="button" className="profile-editor-icon-button" aria-label="Close profile editor" onClick={requestClose}><X size={17} /></button>
      </div>
      <form onSubmit={event => event.preventDefault()} className="profile-editor-form">
        <section className="profile-editor-section">
          <label className="profile-editor-label" htmlFor="profile-display-name">Display name</label>
          <input id="profile-display-name" value={displayName} maxLength={120} onChange={event => setDisplayName(event.target.value)} placeholder="Your display name" />
          <small className="profile-editor-hint">Your username stays @{currentUser.username}.</small>
        </section>

        <section className="profile-editor-section">
          <div className="profile-editor-label">Avatar &amp; decoration</div>
          <div className="profile-editor-avatar-row">
            <div className={`profile-editor-avatar-preview avatar-effect-${avatarEffect}`}>{avatarUrl ? (avatarIsVideo ? <video src={avatarUrl} autoPlay loop muted playsInline /> : <img src={avatarUrl} alt="Profile avatar" />) : <span>{initials || <CircleUserRound size={26} />}</span>}</div>
            <button type="button" className="profile-editor-secondary" onClick={() => avatarPicker.current?.click()}><Camera size={15} />Change photo</button>
            {avatarUrl && <button type="button" className="profile-editor-text-button is-danger" onClick={() => { setPendingAvatar(null); setAvatarUrl(''); setRemoveAvatar(true); }}>Remove</button>}
          <input ref={avatarPicker} className="profile-editor-file-input" type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm" onChange={event => { void openImageEditor('avatar', event.target.files?.[0]); event.currentTarget.value = ''; }} />
          </div>
          <small className="profile-editor-hint">PNG, JPG, WebP, GIF, MP4 or WebM · 25 MB max · videos up to 15s</small>
          <div className="profile-editor-effect-row"><label className="profile-editor-label" htmlFor="profile-avatar-effect">Avatar effect</label><select id="profile-avatar-effect" value={avatarEffect} onChange={event => setAvatarEffect(event.target.value as typeof avatarEffect)}><option value="none">None</option><option value="rotate">Rotate</option><option value="shine">Shine</option><option value="pulse">Pulse</option></select></div>
        </section>

        <section className="profile-editor-section">
          <label className="profile-editor-label" htmlFor="profile-banner">Profile banner</label>
          <button type="button" className="profile-editor-banner-picker" onClick={() => bannerPicker.current?.click()} style={{ backgroundColor: accentColor }}>
            {bannerUrl && bannerMode !== 'solid' && (bannerIsVideo ? <video src={bannerUrl} autoPlay loop muted playsInline /> : <img src={bannerUrl} alt="" />)}<ImagePlus size={18} /> <span>{pendingBanner ? 'Banner selected' : bannerMode === 'solid' ? 'Solid color banner' : bannerUrl ? 'Change banner' : 'Upload a banner'}</span>
          </button>
          <input id="profile-banner" ref={bannerPicker} className="profile-editor-file-input" type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm" onChange={event => { void openImageEditor('banner', event.target.files?.[0]); event.currentTarget.value = ''; }} />
          <div className="profile-editor-color-row"><span>Banner color</span><input aria-label="Banner color" type="color" value={accentColor} onChange={event => setAccentColor(event.target.value)} /></div>
          <div className="profile-editor-banner-actions"><button type="button" className="profile-editor-secondary" onClick={() => { setPendingBanner(null); setBannerUrl(''); setRemoveBanner(Boolean(originalBannerUrl)); setBannerMode('solid'); }}>Use solid color</button>{(bannerUrl || originalBannerUrl) && <button type="button" className="profile-editor-text-button is-danger" onClick={() => { setPendingBanner(null); setBannerUrl(''); setRemoveBanner(Boolean(originalBannerUrl)); setBannerMode('default'); }}>Remove banner</button>}</div>
        </section>

        <section className="profile-editor-section">
          <div className="profile-editor-label">Profile theme</div>
          <p className="profile-editor-hint">Blend any two colors for your profile background.</p>
          <div className="profile-editor-theme-preview" style={{ background: `linear-gradient(135deg, ${themeColorA}, ${themeColorB})` }} />
          <div className="profile-editor-theme-colors">{([{ id: 'a', label: 'Color one', value: themeColorA, update: updateThemeColorA }, { id: 'b', label: 'Color two', value: themeColorB, update: updateThemeColorB }] as const).map(color => { const hsv = hexToHsv(color.value); return <label key={color.id}><span>{color.label}</span><div className="profile-editor-theme-picker" style={{ background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${hsv.h}, 100%, 50%))` }} onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); pickThemeColor(color.id, event); }} onPointerMove={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) pickThemeColor(color.id, event); }}><i style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%` }} /></div><input aria-label={`Profile theme ${color.label}`} type="color" value={color.value} onChange={event => color.update(event.target.value)} /></label>; })}</div>
        </section>

        <section className="profile-editor-section">
          <label className="profile-editor-label" htmlFor="profile-bio">About me</label>
          <textarea id="profile-bio" value={bio} maxLength={1000} onChange={event => setBio(event.target.value)} placeholder="A few words about you…" rows={4} />
          <small className="profile-editor-hint profile-editor-counter">{bio.length}/1000</small>
        </section>

        <section className="profile-editor-section">
          <label className="profile-editor-label" htmlFor="profile-pronouns">Pronouns</label>
          <select id="profile-pronouns" value={pronouns} onChange={event => setPronouns(event.target.value)}>{pronounOptions.map(option => <option key={option}>{option}</option>)}</select>
        </section>

        <section className="profile-editor-section profile-editor-beta-section">
          <div className="profile-editor-label">Profile badges <span>(Beta)</span></div>
          <div className="profile-editor-badge-preview"><LockKeyhole size={14} /> Custom badges are coming soon</div>
        </section>

        {error && <p className="profile-editor-error" role="alert">{error}</p>}
      </form>
    </aside>

    <main className="profile-editor-preview-column">
      <div className="profile-editor-preview-card">
        <div className="profile-editor-preview-banner" style={{ backgroundColor: accentColor }}>{bannerMode !== 'solid' && bannerUrl && (bannerIsVideo ? <video src={bannerUrl} autoPlay loop muted playsInline /> : <img src={bannerUrl} alt="" />)}</div>
        <div className="profile-editor-preview-content">
          <div className={`profile-editor-preview-avatar avatar-effect-${avatarEffect}`} style={{ borderColor: accentColor }}>{avatarUrl ? (avatarIsVideo ? <video src={avatarUrl} autoPlay loop muted playsInline /> : <img src={avatarUrl} alt="" />) : <span>{initials || 'N'}</span>}</div>
          <div className="profile-editor-presence" />
          <h1>{displayName.trim() || currentUser.username}</h1>
          <div className="profile-editor-meta"><span>@{currentUser.username}</span>{pronouns !== 'Prefer not to say' && <><i>·</i><span>{pronouns === 'Add custom…' ? 'Pronouns' : pronouns}</span></>}<i>·</i><span>{currentUser.program || 'BS–MS'} · IISER Tirupati</span></div>
          <div className="profile-editor-preview-badges"><span><Check size={13} /> Verified student</span><span className="profile-editor-future-badge"><Sparkles size={13} /> Student badge · Beta</span></div>
          <div className="profile-editor-preview-actions"><button type="button" disabled><BookOpen size={15} /> Open study profile</button><span className="profile-editor-preview-note">This is how your profile appears to other students</span></div>
          <section className="profile-editor-preview-bio"><h2>About</h2><p>{bio.trim() || 'Your bio will appear here.'}</p></section>
          <section className="profile-editor-profile-details"><div><span>Campus</span><strong>IISER Tirupati</strong></div><div><span>Username</span><strong>@{currentUser.username}</strong></div></section>
        </div>
      </div>
    </main>

    <section className="profile-editor-board">
      <nav className="profile-editor-tabs" aria-label="Profile preview sections">
        {([['board', 'Board'], ['activity', 'Activity'], ['reading', 'Reading list']] as const).map(([id, label]) => <button key={id} type="button" className={activeBoardTab === id ? 'active' : ''} onClick={() => setActiveBoardTab(id)}>{label}</button>)}
      </nav>
      {activeBoardTab === 'board' && <>
        <div className="profile-editor-board-heading"><div><h2>Your widgets</h2><p>Study interests and campus activity</p></div><button type="button" title="More profile widgets are coming soon" disabled><LayoutGrid size={14} /> Add widget</button></div>
      </>}
      {activeBoardTab === 'activity' && <div className="profile-editor-empty-state"><div className="profile-editor-empty-icon"><Sparkles size={20} /></div><h2>Campus activity</h2><p>Your shared notes, answers and study-group moments will appear here.</p></div>}
      {activeBoardTab === 'reading' && <>
        <div className="profile-editor-board-heading"><div><h2>Reading list</h2><p>Books and resources you want to explore</p></div></div>
        <article className="profile-editor-widget"><div className="profile-editor-book-row"><div className="profile-editor-book-cover cover-violet"><BookOpen size={22} /></div><div><strong>The Feynman Lectures on Physics</strong><span>Want to read · Physics</span></div></div></article>
        <article className="profile-editor-widget"><div className="profile-editor-book-row"><div className="profile-editor-book-cover cover-teal"><BookOpen size={22} /></div><div><strong>Linear Algebra Done Right</strong><span>Want to read · Mathematics</span></div></div></article>
      </>}
    </section>
    {imageEditor && createPortal(<div className="profile-image-editor-backdrop" role="presentation" style={{ '--pe-panel': 'var(--bg-navigation, #2f3136)', '--pe-card': 'var(--bg-surface, #2f3136)', '--pe-raised': 'var(--bg-elevated, #40444b)', '--pe-border': 'var(--border, #202225)', '--pe-text': 'var(--text-primary, #f2f3f5)', '--pe-muted': 'var(--text-muted, #b9bbbe)', '--profile-accent': accentColor } as React.CSSProperties}>
      <section className="profile-image-editor" role="dialog" aria-modal="true" aria-labelledby="profile-image-editor-title">
        <div className="profile-image-editor-head"><div><h2 id="profile-image-editor-title">Preview and edit {imageEditor.kind === 'avatar' ? 'profile photo' : 'banner'}</h2><p>{imageEditor.isVideo ? 'Edits are rendered into the saved animation.' : 'Your image is uploaded only after you save profile changes.'}</p></div><button type="button" className="profile-editor-icon-button" onClick={() => { URL.revokeObjectURL(imageEditor.url); setImageEditor(null); }} aria-label="Cancel image edit"><X size={17} /></button></div>
        <div className={`profile-image-crop ${imageEditor.kind === 'avatar' ? 'is-avatar' : 'is-banner'}`} onPointerDown={beginImageDrag} onPointerMove={moveImageDrag} onPointerUp={endImageDrag} onPointerCancel={endImageDrag} role="application" aria-label="Drag image to reposition it">{imageEditor.isVideo ? <video ref={cropVideoRef} draggable={false} src={imageEditor.url} autoPlay muted playsInline onLoadedMetadata={onCropVideoMetadata} onTimeUpdate={onCropVideoTime} onPlay={() => setCropPlaying(true)} onPause={() => setCropPlaying(false)} style={{ transform: `translate(${imageEditor.x * 100}%, ${imageEditor.y * 100}%) rotate(${imageEditor.rotation}deg) scale(${imageEditor.scale})` }} /> : <img draggable={false} src={imageEditor.url} alt="Image preview" style={{ transform: `translate(${imageEditor.x * 100}%, ${imageEditor.y * 100}%) rotate(${imageEditor.rotation}deg) scale(${imageEditor.scale})` }} />}<span className="profile-image-crop-guide">Drag to position</span></div>
        {imageEditor.isVideo && <>
          <div className="profile-image-timeline"><button type="button" className="profile-editor-secondary" aria-label={cropPlaying ? 'Pause preview' : 'Play preview'} onClick={() => { const video = cropVideoRef.current; if (!video) return; if (video.paused) void video.play(); else video.pause(); }}>{cropPlaying ? <Pause size={15} /> : <Play size={15} />}</button><input aria-label="Preview timeline" type="range" min={imageEditor.trimStart} max={Math.max(imageEditor.trimStart + .05, imageEditor.trimEnd)} step="0.01" value={Math.min(Math.max(cropTime, imageEditor.trimStart), imageEditor.trimEnd)} onChange={event => seekCropVideo(Number(event.target.value))} /><span>{cropTime.toFixed(1)}s / {imageEditor.trimEnd.toFixed(1)}s</span></div>
          <div className="profile-video-trim"><strong>Trim clip</strong><label>Start <input type="range" min="0" max={Math.max(0, imageEditor.trimEnd - .25)} step=".05" value={imageEditor.trimStart} onChange={event => changeTrimStart(Number(event.target.value))} />{imageEditor.trimStart.toFixed(1)}s</label><label>End <input type="range" min={Math.min(cropDuration, imageEditor.trimStart + .25)} max={Math.min(cropDuration, imageEditor.trimStart + 15)} step=".05" value={Math.min(imageEditor.trimEnd, cropDuration)} onChange={event => changeTrimEnd(Number(event.target.value))} />{imageEditor.trimEnd.toFixed(1)}s</label><p>Original file: <b>{formatMediaSize(imageEditor.sourceSize)}</b><span> · </span>Estimated cropped export: <b>{formatMediaSize((imageEditor.trimEnd - imageEditor.trimStart) * 1_500_000 / 8 + 100_000)}</b></p>{imageEditor.kind === 'banner' && imageEditor.sourceSize > 20 * 1024 * 1024 && <small role="alert">This file is over 20 MB. Trim the clip and apply it to create a smaller video.</small>}</div>
        </>}
        <div className="profile-image-editor-controls"><label><ZoomIn size={15} /> Zoom <input type="range" min="1" max="3" step=".01" value={imageEditor.scale} onChange={event => setImageEditor({ ...imageEditor, scale: Number(event.target.value) })} /></label><button type="button" className="profile-editor-secondary" onClick={() => setImageEditor({ ...imageEditor, rotation: imageEditor.rotation + 90 })}><RotateCcw size={15} /> Rotate</button><button type="button" className="profile-editor-text-button" onClick={() => setImageEditor({ ...imageEditor, scale: 1, rotation: 0, x: 0, y: 0 })}>Reset crop</button></div>
        <div className="profile-image-editor-actions"><button type="button" className="profile-editor-secondary" onClick={() => { URL.revokeObjectURL(imageEditor.url); setImageEditor(null); }}>Cancel</button><button type="button" className="profile-editor-save" onClick={() => void applyImageEdit()}><Check size={15} /> Apply image</button></div>
      </section>
    </div>, document.body)}
  </div>
  {hasUnsavedChanges && <div className={`profile-editor-change-bar${isCloseBlocked ? ' is-warning' : ''}`} role="status"><div><strong>Unsaved profile changes</strong><span>{isCloseBlocked ? 'Save, discard, or keep editing before closing.' : 'Review your changes before closing the profile.'}</span></div><div><button type="button" className="profile-editor-secondary" onClick={resetChanges}>Reset</button><button type="button" className="profile-editor-secondary" onClick={onClose} disabled={saving}>Discard &amp; close</button><button type="button" className="profile-editor-save" onClick={() => void saveProfile()} disabled={saving}>{saving ? 'Saving…' : <><Check size={15} /> Save changes</>}</button></div></div>}
  </div>;
};
