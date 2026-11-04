/**
 * ThanosInfinitySnap - Rigged Thanos Infinity Gauntlet Animation (Pure JS)
 * 
 * Exact Choreography:
 * 1. Glove comes into the screen from the bottom with ALL FIVE FINGERS OPEN
 * 2. The folding: Fingers fold/curl into the snapping posture as stones ignite
 * 3. Snapping: Thumb snaps down across palm, shockwave pulse fires
 * 4. A white screen appears: Full-screen blinding whiteout flash covers the entire screen
 * 5. Stationary gauntlet after the snap: The gauntlet stays resting stationary on screen
 * 
 * 100% Alpha Transparent Canvas Overlay
 */

class ThanosInfinitySnap {
  constructor(options = {}) {
    this.sound = options.sound ?? true;
    this.audioCtx = null;
    this.activeAnimations = [];
    this.isRunning = false;

    // Create 100% Transparent Fullscreen Overlay
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'thanos-rigged-snap-layer';
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
    this.ctx = this.canvas.getContext('2d', { alpha: true });

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
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

  playAudio() {
    if (!this.sound) return;
    try {
      this.initAudio();
      if (!this.audioCtx) return;
      if (this.audioCtx.state === 'suspended') this.audioCtx.resume();

      const now = this.audioCtx.currentTime;

      // 1. Cosmic charging hum while fingers fold
      const humOsc = this.audioCtx.createOscillator();
      const humGain = this.audioCtx.createGain();
      humOsc.type = 'sawtooth';
      humOsc.frequency.setValueAtTime(90, now + 0.85);
      humOsc.frequency.exponentialRampToValueAtTime(340, now + 1.55);
      humGain.gain.setValueAtTime(0.001, now + 0.85);
      humGain.gain.linearRampToValueAtTime(0.14, now + 1.5);
      humGain.gain.linearRampToValueAtTime(0.001, now + 1.55);
      humOsc.connect(humGain);
      humGain.connect(this.audioCtx.destination);
      humOsc.start(now + 0.85);
      humOsc.stop(now + 1.55);

      // 2. Crisp Snap Click at t = 1.55s
      const snapBuf = this.audioCtx.createBuffer(1, this.audioCtx.sampleRate * 0.08, this.audioCtx.sampleRate);
      const snapData = snapBuf.getChannelData(0);
      for (let i = 0; i < snapData.length; i++) {
        snapData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.audioCtx.sampleRate * 0.012));
      }
      const snapSource = this.audioCtx.createBufferSource();
      snapSource.buffer = snapBuf;
      const snapFilter = this.audioCtx.createBiquadFilter();
      snapFilter.type = 'highpass';
      snapFilter.frequency.value = 1900;
      snapSource.connect(snapFilter);
      snapFilter.connect(this.audioCtx.destination);
      snapSource.start(now + 1.55);

      // 3. Deep Cosmic Shockwave Boom (t = 1.55s to 3.2s)
      const boomBuf = this.audioCtx.createBuffer(1, this.audioCtx.sampleRate * 1.8, this.audioCtx.sampleRate);
      const boomData = boomBuf.getChannelData(0);
      for (let i = 0; i < boomData.length; i++) boomData[i] = Math.random() * 2 - 1;
      const boomNoise = this.audioCtx.createBufferSource();
      boomNoise.buffer = boomBuf;

      const boomFilter = this.audioCtx.createBiquadFilter();
      boomFilter.type = 'lowpass';
      boomFilter.frequency.setValueAtTime(800, now + 1.55);
      boomFilter.frequency.exponentialRampToValueAtTime(25, now + 3.1);

      const boomGain = this.audioCtx.createGain();
      boomGain.gain.setValueAtTime(0.95, now + 1.55);
      boomGain.gain.exponentialRampToValueAtTime(0.001, now + 3.1);

      boomNoise.connect(boomFilter);
      boomFilter.connect(boomGain);
      boomGain.connect(this.audioCtx.destination);
      boomNoise.start(now + 1.55);
      boomNoise.stop(now + 3.1);
    } catch (e) {}
  }

  snap(config = {}) {
    const w = this.width || window.innerWidth;
    const h = this.height || window.innerHeight;
    const x = config.x ?? (w / 2);
    const targetY = config.targetY ?? (h * 0.52);

    this.playAudio();

    const anim = {
      x,
      targetY,
      startY: h + 220,
      totalDuration: 3.6,
      snapTime: 1.55,
      flashStartTime: 1.55,
      flashEndTime: 2.25,
      elapsed: 0,
      hasSnapped: false,
      sparks: []
    };

    this.activeAnimations.push(anim);

    if (!this.isRunning) {
      this.isRunning = true;
      this.lastTimestamp = performance.now();
      requestAnimationFrame((t) => this.loop(t));
    }
  }

  drawFingerSegment(ctx, x1, y1, x2, y2, w1, w2) {
    const dx = x2 - x1, dy = y2 - y1;
    const dist = Math.hypot(dx, dy);
    if (dist < 1) return;
    const nx = -dy / dist, ny = dx / dist;

    // Dark outline
    ctx.fillStyle = '#1e140a';
    ctx.beginPath();
    ctx.moveTo(x1 + nx * (w1 / 2), y1 + ny * (w1 / 2));
    ctx.lineTo(x2 + nx * (w2 / 2), y2 + ny * (w2 / 2));
    ctx.lineTo(x2 - nx * (w2 / 2), y2 - ny * (w2 / 2));
    ctx.lineTo(x1 - nx * (w1 / 2), y1 - ny * (w1 / 2));
    ctx.closePath();
    ctx.fill();

    // Gold fill
    ctx.fillStyle = '#ebaf2d';
    ctx.beginPath();
    ctx.moveTo(x1 + nx * (w1 / 2 - 2.5), y1 + ny * (w1 / 2 - 2.5));
    ctx.lineTo(x2 + nx * (w2 / 2 - 2.5), y2 + ny * (w2 / 2 - 2.5));
    ctx.lineTo(x2 - nx * (w2 / 2 - 2.5), y2 - ny * (w2 / 2 - 2.5));
    ctx.lineTo(x1 - nx * (w1 / 2 - 2.5), y1 - ny * (w1 / 2 - 2.5));
    ctx.closePath();
    ctx.fill();

    // Shadow facet
    ctx.fillStyle = '#b97d14';
    ctx.beginPath();
    ctx.moveTo(x1 - nx * (w1 / 2 - 2.5), y1 - ny * (w1 / 2 - 2.5));
    ctx.lineTo(x2 - nx * (w2 / 2 - 2.5), y2 - ny * (w2 / 2 - 2.5));
    ctx.lineTo(x2 - nx * (w2 * 0.1), y2 - ny * (w2 * 0.1));
    ctx.lineTo(x1 - nx * (w1 * 0.1), y1 - ny * (w1 * 0.1));
    ctx.closePath();
    ctx.fill();

    // Highlight line
    ctx.strokeStyle = '#ffdc6e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x1 + nx * (w1 * 0.25), y1 + ny * (w1 * 0.25));
    ctx.lineTo(x2 + nx * (w2 * 0.25), y2 + ny * (w2 * 0.25));
    ctx.stroke();
  }

  drawFoldingFinger(ctx, bx, by, angleDeg, len, curl, bw = 28, tw = 18) {
    const rad = (angleDeg * Math.PI) / 180;
    const l1 = len * 0.38, l2 = len * 0.34, l3 = len * 0.32;
    const curlAng = curl * 80 * (Math.PI / 180);

    const a1 = rad - curlAng * 0.4;
    const j1x = bx + Math.cos(a1) * l1, j1y = by + Math.sin(a1) * l1;

    const a2 = a1 - curlAng * 0.7;
    const j2x = j1x + Math.cos(a2) * l2, j2y = j1y + Math.sin(a2) * l2;

    const a3 = a2 - curlAng * 0.9;
    const tipX = j2x + Math.cos(a3) * l3, tipY = j2y + Math.sin(a3) * l3;

    this.drawFingerSegment(ctx, bx, by, j1x, j1y, bw, bw * 0.88);
    this.drawFingerSegment(ctx, j1x, j1y, j2x, j2y, bw * 0.88, bw * 0.72);
    this.drawFingerSegment(ctx, j2x, j2y, tipX, tipY, bw * 0.72, tw);

    ctx.fillStyle = '#1e140a';
    ctx.beginPath();
    ctx.arc(tipX, tipY, tw * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ebaf2d';
    ctx.beginPath();
    ctx.arc(tipX, tipY, tw * 0.35, 0, Math.PI * 2);
    ctx.fill();

    return { x: tipX, y: tipY };
  }

  drawGauntlet(ctx, x, y, curlProgress, snapState, gemPower) {
    ctx.save();
    ctx.translate(x, y);

    const scale = 0.95;
    const baseW = 360 * scale;
    const baseH = 500 * scale;

    const pBase = { x: -baseW * 0.30, y: -baseH * 0.24 }; // Pinky (Orange)
    const rBase = { x: -baseW * 0.16, y: -baseH * 0.26 }; // Ring (Red)
    const mBase = { x: 0.04 * baseW,  y: -baseH * 0.28 }; // Middle (Blue)
    const iBase = { x: 0.22 * baseW,  y: -baseH * 0.25 }; // Index (Purple)
    const tBase = { x: 0.40 * baseW,  y: -baseH * 0.02 }; // Thumb (Green)

    // 1. Folded or straight fingers
    // Pinky
    this.drawFoldingFinger(ctx, pBase.x, pBase.y, -105, 95 * scale, curlProgress * 1.0, 24 * scale, 16 * scale);
    // Ring
    this.drawFoldingFinger(ctx, rBase.x, rBase.y, -95, 120 * scale, curlProgress * 1.0, 27 * scale, 18 * scale);
    // Middle (Snap finger)
    if (snapState < 0.5) {
      this.drawFoldingFinger(ctx, mBase.x, mBase.y, -90, 135 * scale, curlProgress * 0.85, 29 * scale, 19 * scale);
    } else {
      this.drawFoldingFinger(ctx, mBase.x, mBase.y, -75, 100 * scale, 1.15, 29 * scale, 18 * scale);
    }
    // Index
    this.drawFoldingFinger(ctx, iBase.x, iBase.y, -82, 124 * scale, curlProgress * 0.35, 28 * scale, 18 * scale);

    // 2. Gauntlet Base Armor Plate & Forearm
    ctx.fillStyle = '#ebaf2d';
    ctx.strokeStyle = '#1e140a';
    ctx.lineWidth = 5 * scale;

    // Forearm
    ctx.beginPath();
    ctx.moveTo(-baseW * 0.42, baseH * 0.45);
    ctx.lineTo(-baseW * 0.35, baseH * 0.05);
    ctx.lineTo(baseW * 0.35, baseH * 0.05);
    ctx.lineTo(baseW * 0.42, baseH * 0.45);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Shadow facet
    ctx.fillStyle = '#b97d14';
    ctx.beginPath();
    ctx.moveTo(baseW * 0.05, baseH * 0.05);
    ctx.lineTo(baseW * 0.35, baseH * 0.05);
    ctx.lineTo(baseW * 0.42, baseH * 0.45);
    ctx.lineTo(baseW * 0.1, baseH * 0.45);
    ctx.closePath();
    ctx.fill();

    // Hand Plate
    ctx.fillStyle = '#ebaf2d';
    ctx.beginPath();
    ctx.moveTo(-baseW * 0.35, baseH * 0.05);
    ctx.lineTo(-baseW * 0.44, -baseH * 0.16);
    ctx.lineTo(-baseW * 0.38, -baseH * 0.28);
    ctx.lineTo(baseW * 0.32, -baseH * 0.28);
    ctx.lineTo(baseW * 0.44, -baseH * 0.10);
    ctx.lineTo(baseW * 0.35, baseH * 0.05);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Filigree ridge
    ctx.strokeStyle = '#1e140a';
    ctx.lineWidth = 4 * scale;
    ctx.beginPath();
    ctx.moveTo(-baseW * 0.30, -baseH * 0.05);
    ctx.lineTo(0, baseH * 0.02);
    ctx.lineTo(baseW * 0.30, -baseH * 0.05);
    ctx.stroke();

    // 3. Thumb
    if (snapState < 0.5) {
      const startA = -25, targetA = -140;
      const curA = startA + (targetA - startA) * curlProgress;
      this.drawFoldingFinger(ctx, tBase.x, tBase.y, curA, 105 * scale, curlProgress * 0.75, 32 * scale, 22 * scale);
    } else {
      this.drawFoldingFinger(ctx, tBase.x, tBase.y, -165, 90 * scale, 1.15, 32 * scale, 20 * scale);
    }

    // 4. The 6 Infinity Stones
    const stones = [
      { x: pBase.x + 8,  y: pBase.y + 12, r: 12 * scale, color: '#ff8811', glow: 'rgba(249, 115, 22,' }, // Orange (Soul)
      { x: rBase.x + 5,  y: rBase.y + 10, r: 13 * scale, color: '#cc1122', glow: 'rgba(239, 68, 68,' },  // Red (Reality)
      { x: mBase.x + 2,  y: mBase.y + 8,  r: 14 * scale, color: '#0099ff', glow: 'rgba(14, 165, 233,' }, // Blue (Space)
      { x: iBase.x - 2,  y: iBase.y + 10, r: 13 * scale, color: '#aa22cc', glow: 'rgba(147, 51, 234,' }, // Purple (Power)
      { x: tBase.x - 12, y: tBase.y + 18, r: 13 * scale, color: '#22aa44', glow: 'rgba(34, 197, 94,' },  // Green (Time)
      { x: 0,            y: -baseH * 0.12, r: 24 * scale, color: '#ffd600', glow: 'rgba(255, 215, 0,' }, // Mind (Yellow)
    ];

    for (const s of stones) {
      if (gemPower > 0.2) {
        const grad = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r * (1.8 + gemPower * 1.5));
        grad.addColorStop(0, `${s.glow} ${0.8 * Math.min(1, gemPower)})`);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r * (1.8 + gemPower * 1.5), 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = '#1e140a';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r + 3 * scale, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(s.x - s.r * 0.35, s.y - s.r * 0.35, s.r * 0.28, 0, Math.PI * 2);
      ctx.fill();
    }

    // Lightning arcs
    if (gemPower > 0.5) {
      ctx.strokeStyle = `rgba(255, 255, 255, ${Math.min(1, (gemPower - 0.5) / 0.5)})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let i = 0; i < stones.length - 1; i++) {
        const p1 = stones[i], p2 = stones[i + 1];
        const mx = (p1.x + p2.x) / 2 + (Math.random() - 0.5) * 14;
        const my = (p1.y + p2.y) / 2 + (Math.random() - 0.5) * 14;
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(mx, my);
        ctx.lineTo(p2.x, p2.y);
      }
      ctx.stroke();
    }

    ctx.restore();
  }

  loop(timestamp) {
    const dt = Math.min(0.1, (timestamp - this.lastTimestamp) / 1000);
    this.lastTimestamp = timestamp;
    const w = this.width || window.innerWidth;
    const h = this.height || window.innerHeight;

    // Clear canvas to 100% transparency every frame
    this.ctx.clearRect(0, 0, w, h);

    for (let aIdx = this.activeAnimations.length - 1; aIdx >= 0; aIdx--) {
      const anim = this.activeAnimations[aIdx];
      anim.elapsed += dt;

      let currentY, curlProgress, snapState, gemPower;

      // 1. Glove comes into screen from bottom with ALL FIVE FINGERS OPEN
      if (anim.elapsed < 0.85) {
        const p = anim.elapsed / 0.85;
        const ease = 1 - Math.pow(1 - p, 3);
        currentY = anim.startY - (anim.startY - anim.targetY) * ease;
        curlProgress = 0.0; // Open fingers!
        snapState = 0.0;
        gemPower = 0.1 * ease;
      }
      // 2. The folding: fingers fold down into snap posture
      else if (anim.elapsed < anim.snapTime) {
        currentY = anim.targetY;
        const chargeP = (anim.elapsed - 0.85) / (anim.snapTime - 0.85);
        curlProgress = Math.min(1.0, Math.pow(chargeP, 1.25));
        snapState = 0.0;
        gemPower = 0.15 + 0.85 * Math.pow(chargeP, 1.6);
        currentY += (Math.random() - 0.5) * 3 * chargeP; // tension shake
      }
      // 3. The snapping & STAYING STATIONARY AFTER SNAP
      else {
        if (!anim.hasSnapped) {
          anim.hasSnapped = true;
          const colors = ['#ffd600', '#aa22cc', '#0099ff', '#cc1122', '#22aa44', '#ff8811'];
          for (let i = 0; i < 60; i++) {
            const ang = Math.random() * Math.PI * 2;
            const spd = Math.random() * 8 + 3;
            anim.sparks.push({
              x: anim.x + 20,
              y: anim.targetY - 80,
              vx: Math.cos(ang) * spd,
              vy: Math.sin(ang) * spd - (Math.random() * 3 + 1),
              size: Math.random() * 4 + 2,
              color: colors[Math.floor(Math.random() * colors.length)],
              life: 1.0,
              decay: 1 / (60 * (1.0 + Math.random() * 0.5))
            });
          }
        }
        // STATIONARY: Gauntlet remains in target position!
        currentY = anim.targetY;
        curlProgress = 1.0;
        snapState = 1.0; // Thumb snapped down!
        gemPower = Math.max(0, 1.0 - (anim.elapsed - anim.snapTime) * 1.5);
      }

      // Draw stationary gauntlet (stays at alpha 1.0, does not disappear!)
      this.drawGauntlet(this.ctx, anim.x, currentY, curlProgress, snapState, gemPower);

      // Sparks
      for (let i = anim.sparks.length - 1; i >= 0; i--) {
        const sp = anim.sparks[i];
        sp.x += sp.vx;
        sp.y += sp.vy;
        sp.vx *= 0.96;
        sp.vy = sp.vy * 0.96 - 0.04;
        sp.life -= sp.decay;
        if (sp.life <= 0) { anim.sparks.splice(i, 1); continue; }

        this.ctx.fillStyle = sp.color;
        this.ctx.globalAlpha = Math.max(0, sp.life);
        this.ctx.beginPath();
        this.ctx.arc(sp.x, sp.y, sp.size * sp.life, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.globalAlpha = 1.0;
      }

      // 4. WHITE SCREEN FLASH (AFTER THE SNAP)
      if (anim.elapsed >= anim.flashStartTime && anim.elapsed <= anim.flashEndTime) {
        const flashDur = anim.flashEndTime - anim.flashStartTime;
        const flashP = (anim.elapsed - anim.flashStartTime) / flashDur;
        const flashAlpha = Math.pow(1.0 - flashP, 1.4);

        this.ctx.save();
        this.ctx.fillStyle = `rgba(255, 255, 255, ${flashAlpha})`;
        this.ctx.fillRect(0, 0, w, h);
        this.ctx.restore();
      }

      // Notice: we do NOT remove or hide the gauntlet after totalDuration; it stays stationary!
    }

    if (this.activeAnimations.length > 0) {
      requestAnimationFrame((t) => this.loop(t));
    }
  }
}

// Module export & window binding
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ThanosInfinitySnap;
}
if (typeof window !== 'undefined') {
  window.ThanosInfinitySnap = ThanosInfinitySnap;
}
