import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Move, MousePointer2, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { UserSummary } from '../services/api';
import { readUserPreference, userPreferenceStorageKey, writeUserPreference } from '../services/userPreferences';
import './VisualEditor.css';

type ElementEdit = {
  x: number;
  y: number;
  width?: number;
  height?: number;
  base?: { translate: string; width: string; height: string };
};

const storageKey = (pathname: string, userId: string) => userPreferenceStorageKey(`nexus-visual-edits:${pathname}`, userId);

function getElementSelector(element: HTMLElement): string {
  if (element.dataset.dashboardWidget) return `[data-dashboard-widget="${element.dataset.dashboardWidget}"]`;
  if (element.id) return `#${CSS.escape(element.id)}`;

  const parts: string[] = [];
  let current: HTMLElement | null = element;
  while (current && current !== document.body && current.id !== 'root') {
    const tag = current.tagName.toLowerCase();
    const classes = Array.from(current.classList).filter((name) => !name.startsWith('is-'));
    const classSelector = classes.length ? `${tag}.${classes.map(CSS.escape).join('.')}` : tag;
    const parent = current.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter((child) => child.tagName === current!.tagName);
      if (siblings.length > 1) parts.unshift(`${classSelector}:nth-of-type(${siblings.indexOf(current) + 1})`);
      else parts.unshift(classSelector);
    } else parts.unshift(classSelector);
    const selector = parts.join(' > ');
    try { if (document.querySelectorAll(selector).length === 1) return selector; } catch { /* continue building */ }
    current = parent instanceof HTMLElement ? parent : null;
  }
  return parts.join(' > ');
}

function loadEdits(pathname: string, userId: string): Record<string, ElementEdit> {
  try { return JSON.parse(localStorage.getItem(storageKey(pathname, userId)) || '{}') as Record<string, ElementEdit>; }
  catch { return {}; }
}

function loadDockPosition(userId: string): { left: number; top: number } | null {
  const value = readUserPreference<{ left: number; top: number } | null>('nexus-visual-editor-position', userId, null);
  return value && Number.isFinite(value.left) && Number.isFinite(value.top)
    ? { left: value.left, top: value.top }
    : null;
}

export const VisualEditor: React.FC<{ currentUser: UserSummary | null }> = ({ currentUser }) => {
  const { pathname } = useLocation();
  const userId = currentUser?.id || 'guest';
  const [active, setActive] = useState(false);
  const [toggleRevealed, setToggleRevealed] = useState(false);
  const [toggleShining, setToggleShining] = useState(false);
  const [selected, setSelected] = useState<HTMLElement | null>(null);
  const [hovered, setHovered] = useState<HTMLElement | null>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [version, setVersion] = useState(0);
  const [edits, setEdits] = useState<Record<string, ElementEdit>>({});
  const draggingRef = useRef(false);
  const [dockPosition, setDockPosition] = useState<{ left: number; top: number } | null>(() => loadDockPosition(userId));
  const [panelPlacement, setPanelPlacement] = useState<'above' | 'below'>('above');
  const [panelAlign, setPanelAlign] = useState<'left' | 'right'>('right');
  const [panelMaxHeight, setPanelMaxHeight] = useState(420);
  const dockPositionRef = useRef(dockPosition);
  const dockDragRef = useRef<{ pointerX: number; pointerY: number; left: number; top: number; width: number; height: number } | null>(null);
  const dockWasDragged = useRef(false);
  const toggleShineTimer = useRef<number | null>(null);
  const toggleRevealedRef = useRef(false);

  useEffect(() => {
    const onShortcut = (event: KeyboardEvent) => {
      if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.key.toLowerCase() !== 'c') return;
      const target = event.target as HTMLElement | null;
      if (target?.matches('input, textarea, select, [contenteditable="true"]')) return;
      event.preventDefault();
      const reveal = !toggleRevealedRef.current;
      toggleRevealedRef.current = reveal;
      setToggleRevealed(reveal);
      if (reveal) {
        setToggleShining(true);
        if (toggleShineTimer.current) window.clearTimeout(toggleShineTimer.current);
        toggleShineTimer.current = window.setTimeout(() => setToggleShining(false), 2100);
      } else {
        setActive(false);
        setToggleShining(false);
        if (toggleShineTimer.current) window.clearTimeout(toggleShineTimer.current);
      }
    };
    window.addEventListener('keydown', onShortcut);
    return () => { window.removeEventListener('keydown', onShortcut); if (toggleShineTimer.current) window.clearTimeout(toggleShineTimer.current); };
  }, []);

  useEffect(() => {
    const next = loadDockPosition(userId);
    setDockPosition(next);
    dockPositionRef.current = next;
  }, [userId]);

  const highlighted = hovered || selected;
  const selectedSelector = useMemo(() => selected ? getElementSelector(selected) : '', [selected]);
  const currentEdit = selectedSelector ? edits[selectedSelector] || { x: 0, y: 0 } : { x: 0, y: 0 };
  const styles = selected ? getComputedStyle(selected) : null;

  useEffect(() => {
    const moveDock = (event: PointerEvent) => {
      const drag = dockDragRef.current;
      if (!drag) return;
      if (Math.abs(event.clientX - drag.pointerX) > 4 || Math.abs(event.clientY - drag.pointerY) > 4) dockWasDragged.current = true;
      if (!dockWasDragged.current) return;
      const next = {
        left: Math.max(8, Math.min(window.innerWidth - drag.width - 8, drag.left + event.clientX - drag.pointerX)),
        top: Math.max(8, Math.min(window.innerHeight - drag.height - 8, drag.top + event.clientY - drag.pointerY)),
      };
      dockPositionRef.current = next;
      setDockPosition(next);
    };
    const endDock = () => {
      if (dockDragRef.current && dockWasDragged.current && dockPositionRef.current) writeUserPreference('nexus-visual-editor-position', userId, dockPositionRef.current);
      dockDragRef.current = null;
    };
    window.addEventListener('pointermove', moveDock);
    window.addEventListener('pointerup', endDock);
    window.addEventListener('pointercancel', endDock);
    return () => { window.removeEventListener('pointermove', moveDock); window.removeEventListener('pointerup', endDock); window.removeEventListener('pointercancel', endDock); };
  }, [userId]);

  useEffect(() => {
    if (!dockPosition) return;
    let frame = 0;
    const clampDock = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const toggle = document.querySelector<HTMLElement>('[data-nexus-visual-editor] .nexus-editor-toggle');
        if (!toggle) return;
        const bounds = toggle.getBoundingClientRect();
        const next = {
          left: Math.max(8, Math.min(window.innerWidth - bounds.width - 8, bounds.left)),
          top: Math.max(8, Math.min(window.innerHeight - bounds.height - 8, bounds.top)) - 2,
        };
        if (Math.abs(next.left - dockPosition.left) > 1 || Math.abs(next.top - dockPosition.top) > 1) {
          dockPositionRef.current = next;
          setDockPosition(next);
          writeUserPreference('nexus-visual-editor-position', userId, next);
        }
      });
    };
    clampDock();
    window.addEventListener('resize', clampDock);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('resize', clampDock); };
  }, [dockPosition, userId]);

  const beginDockDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const initial = { left: bounds.left, top: bounds.top };
    dockPositionRef.current = initial;
    dockWasDragged.current = false;
    dockDragRef.current = { pointerX: event.clientX, pointerY: event.clientY, left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height };
  };

  const setEdit = useCallback((selector: string, edit: ElementEdit, element?: HTMLElement) => {
    const prior = loadEdits(pathname, userId)[selector];
    const base = edit.base || prior?.base || (element ? {
      translate: element.style.translate,
      width: element.style.width,
      height: element.style.height,
    } : { translate: '', width: '', height: '' });
    const completeEdit = { ...edit, base };
    if (element) {
      element.style.translate = `${completeEdit.x}px ${completeEdit.y}px`;
      if (completeEdit.width != null) element.style.width = `${completeEdit.width}px`;
      if (completeEdit.height != null) element.style.height = `${completeEdit.height}px`;
    }
    setEdits((current) => {
      const next = { ...current, [selector]: completeEdit };
      localStorage.setItem(storageKey(pathname, userId), JSON.stringify(next));
      return next;
    });
    setVersion((value) => value + 1);
  }, [pathname, userId]);

  useEffect(() => {
    setSelected(null);
    setHovered(null);
    const saved = loadEdits(pathname, userId);
    setEdits(saved);
    const apply = () => {
      Object.entries(saved).forEach(([selector, edit]) => {
        let element: HTMLElement | null = null;
        try { element = document.querySelector<HTMLElement>(selector); } catch { return; }
        if (!element) return;
        element.style.translate = `${edit.x}px ${edit.y}px`;
        if (edit.width != null) element.style.width = `${edit.width}px`;
        if (edit.height != null) element.style.height = `${edit.height}px`;
      });
    };
    const frame = requestAnimationFrame(apply);
    const observer = new MutationObserver(apply);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => { cancelAnimationFrame(frame); observer.disconnect(); };
  }, [pathname, userId]);

  useEffect(() => {
    if (!active) {
      setSelected(null);
      setHovered(null);
      setRect(null);
      return;
    }
    const onPointerMove = (event: PointerEvent) => {
      if (draggingRef.current) return;
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (!target || target.closest('[data-nexus-visual-editor]')) return;
      if (selected && target === selected) return;
      setHovered(target.closest<HTMLElement>('#root *'));
    };
    const onClick = (event: MouseEvent) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (!target || target.closest('[data-nexus-visual-editor]')) return;
      const element = target.closest<HTMLElement>('#root *');
      if (!element || element === document.body || element.id === 'root') return;
      event.preventDefault();
      event.stopPropagation();
      setSelected(element);
      setHovered(null);
      const selector = getElementSelector(element);
      const restored = loadEdits(pathname, userId)[selector];
      if (restored) {
        element.style.translate = `${restored.x}px ${restored.y}px`;
        if (restored.width != null) element.style.width = `${restored.width}px`;
        if (restored.height != null) element.style.height = `${restored.height}px`;
      }
      setVersion((value) => value + 1);
    };
    document.addEventListener('pointermove', onPointerMove, true);
    document.addEventListener('click', onClick, true);
    return () => {
      document.removeEventListener('pointermove', onPointerMove, true);
      document.removeEventListener('click', onClick, true);
    };
  }, [active, pathname, selected, userId]);

  useEffect(() => {
    if (!highlighted) { setRect(null); return; }
    const update = () => setRect(highlighted.getBoundingClientRect());
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => { window.removeEventListener('scroll', update, true); window.removeEventListener('resize', update); };
  }, [highlighted, version]);

  useEffect(() => {
    if (!active) return;
    let frame = 0;
    const updatePanelPlacement = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const root = document.querySelector<HTMLElement>('[data-nexus-visual-editor]');
        const toggle = root?.querySelector<HTMLElement>('.nexus-editor-toggle');
        const panel = root?.querySelector<HTMLElement>('.nexus-editor-panel');
        if (!toggle || !panel) return;
        const buttonBounds = toggle.getBoundingClientRect();
        const panelBounds = panel.getBoundingClientRect();
        if (dockPosition) {
          const safeLeft = Math.max(8, Math.min(window.innerWidth - buttonBounds.width - 8, buttonBounds.left));
          const safeTop = Math.max(8, Math.min(window.innerHeight - buttonBounds.height - 8, buttonBounds.top)) - 2;
          if (Math.abs(safeLeft - dockPosition.left) > 1 || Math.abs(safeTop - dockPosition.top) > 1) {
            setDockPosition({ left: safeLeft, top: safeTop });
          }
        }
        const above = buttonBounds.top - 12;
        const below = window.innerHeight - buttonBounds.bottom - 12;
        const required = Math.min(panel.scrollHeight, Math.max(120, window.innerHeight - 32));
        const placement = above >= required || above >= below ? 'above' : 'below';
        const available = placement === 'above' ? above : below;
        setPanelPlacement(placement);
        setPanelAlign(buttonBounds.left < panelBounds.width + 16 ? 'left' : 'right');
        setPanelMaxHeight(Math.max(120, Math.min(420, available - 12)));
      });
    };
    updatePanelPlacement();
    window.addEventListener('resize', updatePanelPlacement);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('resize', updatePanelPlacement); };
  }, [active, dockPosition, pathname]);

  useEffect(() => {
    if (!active || !selected) return;
    let startX = 0;
    let startY = 0;
    let initial: ElementEdit = { ...(edits[selectedSelector] || { x: 0, y: 0 }) };
    let latestEdit: ElementEdit = initial;
    let operation: 'move' | 'resize' | null = null;
    const pointerDown = (event: PointerEvent) => {
      if (event.target instanceof HTMLElement && event.target.closest('[data-nexus-visual-editor]')) return;
      if (!(event.target instanceof Node) || !selected.contains(event.target)) return;
      event.preventDefault();
      event.stopPropagation();
      operation = event.clientX > selected.getBoundingClientRect().right - 28 && event.clientY > selected.getBoundingClientRect().bottom - 28 ? 'resize' : 'move';
      startX = event.clientX;
      startY = event.clientY;
      const bounds = selected.getBoundingClientRect();
      const storedEdit = loadEdits(pathname, userId)[selectedSelector] || { x: 0, y: 0 };
      initial = {
        ...storedEdit,
        base: storedEdit.base || { translate: selected.style.translate, width: selected.style.width, height: selected.style.height },
        width: storedEdit.width ?? bounds.width,
        height: storedEdit.height ?? bounds.height,
      };
      latestEdit = initial;
      window.addEventListener('pointermove', pointerMove, true);
      window.addEventListener('pointerup', pointerUp, true);
      draggingRef.current = true;
    };
    const pointerMove = (event: PointerEvent) => {
      if (!operation) return;
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      const next = operation === 'move'
        ? { ...initial, x: initial.x + dx, y: initial.y + dy }
        : { ...initial, width: Math.max(56, (initial.width || 0) + dx), height: Math.max(40, (initial.height || 0) + dy) };
      latestEdit = next;
      selected.style.translate = `${next.x}px ${next.y}px`;
      if (next.width != null) selected.style.width = `${next.width}px`;
      if (next.height != null) selected.style.height = `${next.height}px`;
      setEdits((current) => ({ ...current, [selectedSelector]: next }));
      setVersion((value) => value + 1);
    };
    const pointerUp = () => {
      window.removeEventListener('pointermove', pointerMove, true);
      window.removeEventListener('pointerup', pointerUp, true);
      if (operation) {
        const saved = loadEdits(pathname, userId);
        saved[selectedSelector] = latestEdit;
        localStorage.setItem(storageKey(pathname, userId), JSON.stringify(saved));
      }
      draggingRef.current = false;
      operation = null;
    };
    selected.addEventListener('pointerdown', pointerDown, true);
    return () => {
      selected.removeEventListener('pointerdown', pointerDown, true);
      window.removeEventListener('pointermove', pointerMove, true);
      window.removeEventListener('pointerup', pointerUp, true);
    };
  }, [active, selected, pathname, selectedSelector, userId]);

  const updateDimension = (key: 'width' | 'height', value: string) => {
    if (!selected || !selectedSelector) return;
    const dimension = Math.max(40, Number(value) || 40);
    setEdit(selectedSelector, { ...currentEdit, [key]: dimension }, selected);
  };

  const resetSelection = () => {
    if (!selected || !selectedSelector) return;
    const edit = edits[selectedSelector] || loadEdits(pathname, userId)[selectedSelector];
    if (edit?.base?.translate) selected.style.translate = edit.base.translate;
    else selected.style.removeProperty('translate');
    if (edit?.base?.width) selected.style.width = edit.base.width;
    else selected.style.removeProperty('width');
    if (edit?.base?.height) selected.style.height = edit.base.height;
    else selected.style.removeProperty('height');
    setEdits((current) => {
      const next = { ...current };
      delete next[selectedSelector];
      localStorage.setItem(storageKey(pathname, userId), JSON.stringify(next));
      return next;
    });
    setSelected(null);
    setRect(null);
  };

  const resetPage = () => {
    const saved = loadEdits(pathname, userId);
    Object.entries(saved).forEach(([selector, edit]) => {
      let element: HTMLElement | null = null;
      try { element = document.querySelector<HTMLElement>(selector); } catch { return; }
      if (!element) return;
      if (edit.base?.translate) element.style.translate = edit.base.translate;
      else element.style.removeProperty('translate');
      if (edit.base?.width) element.style.width = edit.base.width;
      else element.style.removeProperty('width');
      if (edit.base?.height) element.style.height = edit.base.height;
      else element.style.removeProperty('height');
    });
    localStorage.removeItem(storageKey(pathname, userId));
    setEdits({});
    setSelected(null);
    setHovered(null);
    setRect(null);
    if (pathname === '/dashboard') window.dispatchEvent(new Event('nexus-reset-dashboard-layout'));
  };

  if (typeof document === 'undefined' || !currentUser) return null;
  return createPortal(
    <>
      {active && rect && <div className={`nexus-editor-outline${selected ? ' is-selected' : ''}`} style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }} aria-hidden="true" />}
      {active && selected && rect && <div className="nexus-editor-resize-grip" style={{ left: rect.right - 10, top: rect.bottom - 10 }} aria-hidden="true" />}
      <section className={`nexus-visual-editor${pathname === '/ai' ? ' is-ai-page' : ''}${active ? ` is-panel-${panelPlacement} is-panel-align-${panelAlign}` : ''}`} data-nexus-visual-editor aria-label="Visual page customizer" style={dockPosition ? { left: dockPosition.left, top: 'auto', right: 'auto', bottom: Math.max(8, window.innerHeight - dockPosition.top - 40) } : undefined}>
        {active && <div className="nexus-editor-panel" style={{ maxHeight: panelMaxHeight }}>
          <div className="nexus-editor-panel-title"><SlidersHorizontal size={15} /> Page customizer</div>
          {selected ? <>
            <div className="nexus-editor-node"><span>{selected.tagName.toLowerCase()}</span><code>{Math.round(rect?.width || 0)} × {Math.round(rect?.height || 0)} px</code></div>
            <div className="nexus-editor-hint"><Move size={13} /> Drag to move · lower-right corner to resize</div>
            <div className="nexus-editor-fields">
              <label>Width<input type="number" min="40" value={Math.round(currentEdit.width ?? rect?.width ?? 0)} onChange={(event) => updateDimension('width', event.target.value)} /></label>
              <label>Height<input type="number" min="40" value={Math.round(currentEdit.height ?? rect?.height ?? 0)} onChange={(event) => updateDimension('height', event.target.value)} /></label>
            </div>
            <div className="nexus-editor-style"><span>Color</span><code>{styles?.color || '—'}</code><span>Font</span><code>{styles?.fontSize || '—'} {styles?.fontFamily.split(',')[0]}</code></div>
            <button className="nexus-editor-reset" onClick={resetSelection}><RotateCcw size={13} /> Reset selected</button>
          </> : <p className="nexus-editor-hint"><MousePointer2 size={14} /> Click any page element to inspect and adjust it.</p>}
          <button className="nexus-editor-reset nexus-editor-reset-page" onClick={resetPage}><RotateCcw size={13} /> Restore default page layout</button>
        </div>}
        {toggleRevealed && <button className={`nexus-editor-toggle${active ? ' active' : ''}${toggleShining ? ' is-shining' : ''}`} onPointerDown={beginDockDrag} onClick={() => { if (dockWasDragged.current) { dockWasDragged.current = false; return; } setActive((value) => !value); }} title="Drag to move · click to customize" style={{ touchAction: 'none', cursor: 'grab' }} aria-pressed={active}>
          <span><SlidersHorizontal size={15} /> {active ? 'Done' : 'Customize'}</span>
        </button>}
      </section>
    </>,
    document.body,
  );
};

