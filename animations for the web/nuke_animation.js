/**
 * NuclearBombDrop - High Impact Nuclear Drop Animation
 * 
 * Specs:
 * - Fat-nosed bulbous nuclear bomb with Radiation Hazard Badge (☢)
 * - Impact creates realistic land breakage / ground fissure fractures (no circle shockwave lines)
 * - Rising fireball & mushroom cloud smoke forms
 * - FULL-SCREEN FLASHBANG washes over the entire screen AFTER the smoke is formed
 * - 100% Alpha Transparent (cleared every frame, stops when idle)
 */

class NuclearBombDrop {
  constructor(options = {}) {
    this.canvas = options.canvas || null;
    this.sound = options.sound ?? true;
    this.audioCtx = null;
    this.isCustom = !!this.canvas;

    if (!this.canvas) {
      this.canvas = document.createElement('canvas');
      this.canvas.id = 'nuke-transparent-layer';
      Object.assign(this.canvas.style, {
        position: 'fixed',
        top: '0',
        left: '0',
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        zIndex: '999999',
        background: 'transparent'
      });
      document.body.appendChild(this.canvas);
      this.resize();
      window.addEventListener('resize', () => this.resize());
    }

    this.ctx = this.canvas.getContext('2d', { alpha: true });
    this.activeAnimations = [];
    this.isRunning = false;
  }

  resize() {
    if (this.isCustom) return;
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = window.innerWidth * dpr;
    this.canvas.height = window.innerHeight * dpr;
    this.ctx.scale(dpr, dpr);
    this.width = window.innerWidth;
    this.height = window.innerHeight;
  }

  initAudio() {
    if (!this.audioCtx && (window.AudioContext || window.webkitAudioContext)) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioCtx();
    }
  }

  playNukeAudio() {
    if (!this.sound) return;
    try {
      this.initAudio();
      if (!this.audioCtx) return;
      if (this.audioCtx.state === 'suspended') this.audioCtx.resume();

      // 1. Falling bomb whistle
      const osc = this.audioCtx.createOscillator();
      const oscGain = this.audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1300, this.audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(320, this.audioCtx.currentTime + 0.95);
      oscGain.gain.setValueAtTime(0.18, this.audioCtx.currentTime);
      oscGain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.95);
      osc.connect(oscGain);
      oscGain.connect(this.audioCtx.destination);
      osc.start();
      osc.stop(this.audioCtx.currentTime + 0.95);

      // 2. Delayed massive flashbang blast (1.35s in)
      setTimeout(() => {
        const dur = 2.4;
        const buf = this.audioCtx.createBuffer(1, this.audioCtx.sampleRate * dur, this.audioCtx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

        const noise = this.audioCtx.createBufferSource();
        noise.buffer = buf;

        const filter = this.audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1000, this.audioCtx.currentTime);
        filter.frequency.exponentialRampToValueAtTime(30, this.audioCtx.currentTime + dur);

        const gain = this.audioCtx.createGain();
        gain.gain.setValueAtTime(1.0, this.audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + dur);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.audioCtx.destination);

        noise.start();
        noise.stop(this.audioCtx.currentTime + dur);
      }, 1350);
    } catch (e) {}
  }

  dropAndDetonate(config = {}) {
    const w = this.width || window.innerWidth;
    const h = this.height || window.innerHeight;
    const x = config.x ?? (w / 2);
    const targetY = config.targetY ?? (h * 0.72);
    const scale = config.scale ?? 1.2;

    this.playNukeAudio();

    // Generate jagged land breakage fissures
    const cracks = [
      this.createFissure(x, targetY, 0, 300 * scale),
      this.createFissure(x, targetY, 180, 300 * scale),
      this.createFissure(x, targetY, 30, 220 * scale),
      this.createFissure(x, targetY, 150, 220 * scale),
      this.createFissure(x, targetY, -20, 160 * scale),
      this.createFissure(x, targetY, -160, 160 * scale),
    ];

    const anim = {
      x,
      targetY,
      scale,
      startY: -120,
      dropTime: 0.95,
      flashStartTime: 1.35,  // Screen flashes AFTER smoke forms
      flashEndTime: 2.05,
      totalDuration: 3.6,
      elapsed: 0,
      hasImpacted: false,
      cracks,
      earthDebris: [],
      stemSmoke: [],
      capSmoke: []
    };

    this.activeAnimations.push(anim);

    if (!this.isRunning) {
      this.isRunning = true;
      this.lastTimestamp = performance.now();
      requestAnimationFrame((t) => this.loop(t));
    }
  }

  createFissure(sx, sy, angleDeg, len) {
    const pts = [{ x: sx, y: sy }];
    let cx = sx, cy = sy;
    let rad = (angleDeg * Math.PI) / 180;
    const steps = 8;
    const stepLen = len / steps;
    for (let s = 0; s < steps; s++) {
      rad += (Math.random() - 0.5) * 0.7;
      cx += Math.cos(rad) * stepLen;
      cy += Math.sin(rad) * stepLen * 0.45;
      pts.push({ x: cx, y: cy });
    }
    return pts;
  }

  triggerImpact(anim) {
    anim.hasImpacted = true;
    const { x, targetY, scale } = anim;

    // 1. Shattered Earth debris
    for (let i = 0; i < 60; i++) {
      const angle = -Math.PI * 0.95 + Math.random() * Math.PI * 0.9;
      const speed = (Math.random() * 16 + 5) * scale;
      anim.earthDebris.push({
        x: x + (Math.random() - 0.5) * 40 * scale,
        y: targetY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - (Math.random() * 4 + 2) * scale,
        size: (Math.random() * 8 + 4) * scale,
        rotation: Math.random() * Math.PI * 2,
        rotV: (Math.random() - 0.5) * 0.3,
        drag: 0.97,
        gravity: 0.28 * scale,
        life: 1.0,
        decay: 1 / (60 * (1.8 + Math.random() * 0.6))
      });
    }

    // 2. Rising Mushroom Stem
    for (let i = 0; i < 90; i++) {
      const vx = (Math.random() - 0.5) * 3 * scale;
      const vy = -(Math.random() * 6 + 3.5) * scale;
      anim.stemSmoke.push({
        x: x + (Math.random() - 0.5) * 30 * scale,
        y: targetY,
        vx,
        vy,
        size: (Math.random() * 16 + 12) * scale,
        life: 1.0,
        decay: 1 / (60 * (2.0 + Math.random() * 0.6))
      });
    }

    // 3. Rolling Mushroom Cap
    for (let i = 0; i < 110; i++) {
      const curlDir = Math.random() < 0.5 ? 1 : -1;
      const vx = curlDir * (Math.random() * 7 + 2.5) * scale;
      const vy = -(Math.random() * 6 + 3) * scale;
      anim.capSmoke.push({
        x,
        y: targetY - 30 * scale,
        vx,
        vy,
        size: (Math.random() * 24 + 16) * scale,
        life: 1.0,
        decay: 1 / (60 * (2.2 + Math.random() * 0.6))
      });
    }
  }

  drawFatNuke(x, y, angle) {
    this.ctx.save();
    this.ctx.translate(x, y);
    this.ctx.rotate(angle);

    const bw = 34; // bulbous fat width
    const bl = 50;

    // Tail box struts & wings
    this.ctx.fillStyle = '#28302d';
    this.ctx.fillRect(-bw * 1.05, -bl * 0.95, bw * 2.1, 10);
    this.ctx.beginPath();
    this.ctx.moveTo(-bw * 0.4, -bl * 0.45);
    this.ctx.lineTo(-bw * 1.05, -bl * 0.95);
    this.ctx.lineTo(-bw * 0.85, -bl * 0.95);
    this.ctx.lineTo(-bw * 0.2, -bl * 0.45);
    this.ctx.fill();

    this.ctx.beginPath();
    this.ctx.moveTo(bw * 0.4, -bl * 0.45);
    this.ctx.lineTo(bw * 1.05, -bl * 0.95);
    this.ctx.lineTo(bw * 0.85, -bl * 0.95);
    this.ctx.lineTo(bw * 0.2, -bl * 0.45);
    this.ctx.fill();

    // Bulbous Fat Body
    this.ctx.fillStyle = '#3a4436'; // Olive drab
    this.ctx.beginPath();
    this.ctx.moveTo(-bw * 0.55, -bl * 0.55);
    this.ctx.bezierCurveTo(-bw * 1.15, 0, -bw * 1.1, bl * 0.6, 0, bl * 0.88); // Fat round nose
    this.ctx.bezierCurveTo(bw * 1.1, bl * 0.6, bw * 1.15, 0, bw * 0.55, -bl * 0.55);
    this.ctx.closePath();
    this.ctx.fill();

    // Highlight
    this.ctx.strokeStyle = 'rgba(165, 185, 160, 0.5)';
    this.ctx.lineWidth = 5;
    this.ctx.beginPath();
    this.ctx.arc(-bw * 0.35, bl * 0.1, bw * 0.65, Math.PI * 0.8, Math.PI * 1.4);
    this.ctx.stroke();

    // Yellow Radiation Trefoil Badge (☢)
    const badgeY = bl * 0.1;
    const badgeR = 16;
    this.ctx.fillStyle = '#f5be0b';
    this.ctx.beginPath();
    this.ctx.arc(0, badgeY, badgeR, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.lineWidth = 1.5;
    this.ctx.strokeStyle = '#141816';
    this.ctx.stroke();

    // 3 Fan Blades
    this.ctx.fillStyle = '#141816';
    for (let b = 0; b < 3; b++) {
      const a = (b * Math.PI * 2) / 3 - Math.PI / 2;
      this.ctx.beginPath();
      this.ctx.moveTo(0, badgeY);
      this.ctx.arc(0, badgeY, badgeR * 0.78, a - 0.45, a + 0.45);
      this.ctx.closePath();
      this.ctx.fill();
    }

    // Yellow inner hole
    this.ctx.fillStyle = '#f5be0b';
    this.ctx.beginPath();
    this.ctx.arc(0, badgeY, badgeR * 0.38, 0, Math.PI * 2);
    this.ctx.fill();

    // Center black dot
    this.ctx.fillStyle = '#141816';
    this.ctx.beginPath();
    this.ctx.arc(0, badgeY, badgeR * 0.22, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.restore();
  }

  loop(timestamp) {
    const dt = Math.min(0.1, (timestamp - this.lastTimestamp) / 1000);
    this.lastTimestamp = timestamp;

    const w = this.width || window.innerWidth;
    const h = this.height || window.innerHeight;

    this.ctx.clearRect(0, 0, w, h);

    for (let aIdx = this.activeAnimations.length - 1; aIdx >= 0; aIdx--) {
      const anim = this.activeAnimations[aIdx];
      anim.elapsed += dt;

      // 1. FALLING FAT BOMB
      if (anim.elapsed < anim.dropTime) {
        const dropProg = anim.elapsed / anim.dropTime;
        const currentY = anim.startY + (anim.targetY - anim.startY) * Math.pow(dropProg, 1.9);
        const wobble = Math.sin(dropProg * Math.PI * 3.5) * 0.035;
        this.drawFatNuke(anim.x, currentY, wobble);
      } else {
        if (!anim.hasImpacted) {
          this.triggerImpact(anim);
        }

        const blastTime = anim.elapsed - anim.dropTime;

        // 2. LAND BREAKAGE FISSURES (No circle shockwave lines!)
        const fissureProg = Math.min(1.0, blastTime / 0.45);
        const fissureAlpha = blastTime < 2.0 ? 1.0 : Math.max(0, 1.0 - (blastTime - 2.0) / 0.7);

        this.ctx.save();
        for (const pts of anim.cracks) {
          const numVis = Math.max(2, Math.floor(pts.length * fissureProg));
          const sub = pts.slice(0, numVis);
          if (sub.length >= 2) {
            // Molten core
            this.ctx.strokeStyle = `rgba(255, 120, 20, ${0.9 * fissureAlpha})`;
            this.ctx.lineWidth = 3;
            this.ctx.beginPath();
            this.ctx.moveTo(sub[0].x, sub[0].y);
            for (let i = 1; i < sub.length; i++) this.ctx.lineTo(sub[i].x, sub[i].y);
            this.ctx.stroke();

            // Dark cracked earth
            this.ctx.strokeStyle = `rgba(35, 25, 20, ${fissureAlpha})`;
            this.ctx.lineWidth = 5;
            this.ctx.beginPath();
            this.ctx.moveTo(sub[0].x, sub[0].y);
            for (let i = 1; i < sub.length; i++) this.ctx.lineTo(sub[i].x, sub[i].y);
            this.ctx.stroke();
          }
        }
        this.ctx.restore();

        // 3. SHATTERED EARTH DEBRIS
        for (let i = anim.earthDebris.length - 1; i >= 0; i--) {
          const d = anim.earthDebris[i];
          d.x += d.vx;
          d.y += d.vy;
          d.vx *= d.drag;
          d.vy = d.vy * d.drag + d.gravity;
          d.rotation += d.rotV;
          d.life -= d.decay;
          if (d.life <= 0) { anim.earthDebris.splice(i, 1); continue; }

          this.ctx.save();
          this.ctx.translate(d.x, d.y);
          this.ctx.rotate(d.rotation);
          this.ctx.fillStyle = `rgba(60, 48, 38, ${Math.min(1, d.life * 2)})`;
          this.ctx.fillRect(-d.size / 2, -d.size / 2, d.size, d.size);
          this.ctx.restore();
        }

        // 4. RISING MUSHROOM STEM
        this.ctx.save();
        this.ctx.globalCompositeOperation = 'lighter';
        for (let i = anim.stemSmoke.length - 1; i >= 0; i--) {
          const sp = anim.stemSmoke[i];
          sp.x += sp.vx;
          sp.y += sp.vy;
          sp.vx *= 0.95;
          sp.vy = sp.vy * 0.95 - 0.07;
          sp.life -= sp.decay;
          if (sp.life <= 0) { anim.stemSmoke.splice(i, 1); continue; }

          const curSize = sp.size * (1 + (1 - sp.life) * 2.0);
          const alpha = Math.max(0, sp.life);
          const red = 255;
          const green = Math.max(30, Math.floor(220 * sp.life));
          const blue = Math.max(10, Math.floor(50 * sp.life));

          this.ctx.fillStyle = `rgba(${red}, ${green}, ${blue}, ${alpha * 0.75})`;
          this.ctx.beginPath();
          this.ctx.arc(sp.x, sp.y, Math.max(1, curSize), 0, Math.PI * 2);
          this.ctx.fill();
        }

        // 5. ROLLING MUSHROOM CAP
        for (let i = anim.capSmoke.length - 1; i >= 0; i--) {
          const cp = anim.capSmoke[i];
          cp.x += cp.vx;
          cp.y += cp.vy;
          cp.vx *= 0.97;
          cp.vy = cp.vy * 0.96 - 0.04;
          if (Math.abs(cp.x - anim.x) > 75 * anim.scale) cp.vy += 0.14;

          cp.life -= cp.decay;
          if (cp.life <= 0) { anim.capSmoke.splice(i, 1); continue; }

          const curSize = cp.size * (1 + (1 - cp.life) * 2.2);
          const alpha = Math.max(0, cp.life);
          let r = 255, g = Math.floor(180 * cp.life), b = 40;
          if (cp.life < 0.4) {
            const sm = Math.floor(50 * (cp.life / 0.4));
            r = sm + 20; g = sm + 5; b = sm;
          }

          this.ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha * 0.8})`;
          this.ctx.beginPath();
          this.ctx.arc(cp.x, cp.y, Math.max(1, curSize), 0, Math.PI * 2);
          this.ctx.fill();
        }
        this.ctx.restore();

        // 6. ENTIRE SCREEN FLASH (AFTER SMOKE HAS FORMED)
        if (anim.elapsed >= anim.flashStartTime && anim.elapsed <= anim.flashEndTime) {
          const flashDuration = anim.flashEndTime - anim.flashStartTime;
          const flashProgress = (anim.elapsed - anim.flashStartTime) / flashDuration;
          const flashAlpha = Math.pow(1.0 - flashProgress, 1.3);

          this.ctx.save();
          this.ctx.fillStyle = `rgba(255, 255, 255, ${flashAlpha})`;
          this.ctx.fillRect(0, 0, w, h);
          this.ctx.restore();
        }
      }

      if (anim.elapsed >= anim.totalDuration) {
        this.activeAnimations.splice(aIdx, 1);
      }
    }

    if (this.activeAnimations.length > 0) {
      requestAnimationFrame((t) => this.loop(t));
    } else {
      this.isRunning = false;
      this.ctx.clearRect(0, 0, w, h);
    }
  }
}

if (typeof window !== 'undefined') {
  window.NuclearBombDrop = NuclearBombDrop;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = NuclearBombDrop;
}
