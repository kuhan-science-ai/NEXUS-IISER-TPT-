import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { readUserPreference, writeUserPreference } from '../services/userPreferences';
import './assistant-companion.css';

const CompanionModel = lazy(() => import('./AssistantCompanionModel'));
const POSITION_KEY = 'nexus-ai-companion-position';
const IDLE_MOTIONS = ['float', 'lean', 'bounce', 'peek', 'sway'];
const COMPANION_WIDTH = 228;
const COMPANION_HEIGHT = 336;
const MOBILE_COMPANION_WIDTH = 190;
const MOBILE_COMPANION_HEIGHT = 280;

type Position = { left: number; top: number };
type PetDrag = { x: number; y: number; left: number; top: number };
const REACTION_ANIMATION_IDS = [1, 2, 3, 4] as const;
type PetAnimation = { source: (typeof REACTION_ANIMATION_IDS)[number]; key: number };

function randomReactionAnimation(): PetAnimation['source'] {
  return REACTION_ANIMATION_IDS[Math.floor(Math.random() * REACTION_ANIMATION_IDS.length)];
}

function readPosition(userId: string): Position | null {
  const value = readUserPreference<Position | null>(POSITION_KEY, userId, null);
  if (!value || !Number.isFinite(value.left) || !Number.isFinite(value.top)) return null;
  const width = window.innerWidth <= 560 ? MOBILE_COMPANION_WIDTH : COMPANION_WIDTH;
  const height = window.innerWidth <= 560 ? MOBILE_COMPANION_HEIGHT : COMPANION_HEIGHT;
  return { left: Math.max(0, Math.min(window.innerWidth - width, value.left)), top: Math.max(0, Math.min(window.innerHeight - height, value.top)) };
}

export function AssistantCompanionPet({ userId, companionId }: { userId: string; companionId: string }) {
  const [position, setPosition] = useState<Position | null>(() => readPosition(userId));
  const [animation, setAnimation] = useState<PetAnimation | null>(() => ({ source: 2, key: 0 }));
  const [idleAnimationReady, setIdleAnimationReady] = useState(false);
  const [modelFailed, setModelFailed] = useState(false);
  const [idleMotion, setIdleMotion] = useState(0);
  const drag = useRef<PetDrag | null>(null);
  const dragged = useRef(false);
  const animationKey = useRef(0);
  const idleAnimationRef = useRef<HTMLVideoElement | null>(null);
  const previousCompanion = useRef({ userId, companionId });
  const markModelFailed = useCallback(() => setModelFailed(true), []);

  useEffect(() => {
    setPosition(readPosition(userId));
    setModelFailed(false);
    if (previousCompanion.current.userId !== userId || previousCompanion.current.companionId !== companionId) {
      previousCompanion.current = { userId, companionId };
      animationKey.current += 1;
      setAnimation({ source: 2, key: animationKey.current });
    }
  }, [userId, companionId]);

  useEffect(() => {
    const idleAnimation = idleAnimationRef.current;
    if (!idleAnimation) return;
    if (animation) {
      idleAnimation.pause();
      idleAnimation.currentTime = 0;
      return;
    }
    void idleAnimation.play().catch(() => setIdleAnimationReady(false));
  }, [animation]);

  useEffect(() => {
    let timeout = 0;
    let previous = -1;
    let active = true;
    const next = () => {
      timeout = window.setTimeout(() => {
        if (!active) return;
        let motion = Math.floor(Math.random() * IDLE_MOTIONS.length);
        if (IDLE_MOTIONS.length > 1 && motion === previous) motion = (motion + 1) % IDLE_MOTIONS.length;
        previous = motion;
        setIdleMotion(motion);
        next();
      }, 2800 + Math.random() * 3200);
    };
    next();
    return () => { active = false; window.clearTimeout(timeout); };
  }, [userId, companionId]);

  useEffect(() => {
    const move = (event: PointerEvent) => {
      const activeDrag = drag.current;
      if (!activeDrag) return;
      if (Math.abs(event.clientX - activeDrag.x) + Math.abs(event.clientY - activeDrag.y) > 5) dragged.current = true;
      const width = Math.min(window.innerWidth <= 560 ? MOBILE_COMPANION_WIDTH : COMPANION_WIDTH, window.innerWidth - 24);
      const height = Math.min(window.innerWidth <= 560 ? MOBILE_COMPANION_HEIGHT : COMPANION_HEIGHT, window.innerHeight - 24);
      setPosition({
        left: Math.max(0, Math.min(window.innerWidth - width, activeDrag.left + event.clientX - activeDrag.x)),
        top: Math.max(0, Math.min(window.innerHeight - height, activeDrag.top + event.clientY - activeDrag.y)),
      });
    };
    const end = () => {
      if (drag.current && dragged.current) {
        setPosition(current => {
          if (current) writeUserPreference(POSITION_KEY, userId, current);
          return current;
        });
      }
      drag.current = null;
    };
    const resize = () => setPosition(current => {
      if (!current) return current;
      const width = Math.min(window.innerWidth <= 560 ? MOBILE_COMPANION_WIDTH : COMPANION_WIDTH, window.innerWidth - 24);
      const height = Math.min(window.innerWidth <= 560 ? MOBILE_COMPANION_HEIGHT : COMPANION_HEIGHT, window.innerHeight - 24);
      const next = {
        left: Math.max(0, Math.min(window.innerWidth - width, current.left)),
        top: Math.max(0, Math.min(window.innerHeight - height, current.top)),
      };
      writeUserPreference(POSITION_KEY, userId, next);
      return next;
    });
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
      window.removeEventListener('resize', resize);
    };
  }, [userId]);

  const beginDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    dragged.current = false;
    drag.current = { x: event.clientX, y: event.clientY, left: rect.left, top: rect.top };
  };

  const playReaction = () => {
    if (dragged.current) { dragged.current = false; return; }
    const source = randomReactionAnimation();
    animationKey.current += 1;
    setAnimation({ source, key: animationKey.current });
  };

  const width = Math.min(window.innerWidth <= 560 ? MOBILE_COMPANION_WIDTH : COMPANION_WIDTH, Math.max(140, window.innerWidth - 24));
  const positionStyle: React.CSSProperties = position
    ? { left: position.left, top: position.top }
    : { right: 20, bottom: 18 };

  return <div
    className="nexus-assistant-companion"
    data-playing={animation ? 'true' : undefined}
    data-idle-playing={!animation ? 'true' : undefined}
    data-idle-ready={idleAnimationReady ? 'true' : undefined}
    onPointerDown={beginDrag}
    style={{ ...positionStyle, width }}
    title="Hold and drag to move · Click to play one of the animations"
  >
    <button className="nexus-assistant-companion-action" onClick={playReaction} aria-label="Play a random assistant animation" type="button">
      {!modelFailed ? <Suspense fallback={<img className={`nexus-assistant-companion-fallback nexus-assistant-idle-${IDLE_MOTIONS[idleMotion]}`} src="/assistants/waifu-2/idle.webp" alt="" />}>
        <CompanionModel onError={markModelFailed} idleMotionClass={`nexus-assistant-idle-${IDLE_MOTIONS[idleMotion]}`} />
      </Suspense> : <img className={`nexus-assistant-companion-fallback nexus-assistant-idle-${IDLE_MOTIONS[idleMotion]}`} src="/assistants/waifu-2/idle.webp" alt="" />}
      <video
        ref={idleAnimationRef}
        className="nexus-assistant-companion-default-animation"
        src="/assistants/waifu-2/default-ani.webm"
        muted
        loop
        playsInline
        preload="auto"
        aria-hidden="true"
        onCanPlay={() => setIdleAnimationReady(true)}
        onError={() => setIdleAnimationReady(false)}
      />
      {animation && <video
        key={animation.key}
        className="nexus-assistant-companion-animation"
        src={`/assistants/waifu-2/ani-${animation.source}.webm`}
        autoPlay
        muted
        playsInline
        preload="auto"
        onEnded={() => setAnimation(null)}
        onError={() => setAnimation(null)}
      />}
    </button>
    <span className="nexus-assistant-companion-hint" aria-hidden="true">Click for animation</span>
  </div>;
}
