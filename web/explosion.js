/**
 * ExplosionSystem - High-Impact Transparent Explosion Animation
 * 
 * Specifications:
 * - 100% Transparent Background (Canvas cleared every frame)
 * - Duration: 2.0 to 2.5 seconds
 * - Massive Radius: Expands 400px - 700px across the viewport
 * - High Object Count: 200+ flying objects (jagged shrapnel rocks, fiery blasts, smoke puffs, and streaking embers)
 * - Zero external dependencies
 */

class ExplosionSystem {
  constructor(options = {}) {
    this.enableSound = options.sound ?? false;
    this.particles = [];
    this.debris = [];
    this.shockwaves = [];
    this.flashes = [];
    this.isRunning = false;
    this.audioCtx = null;

    if (options.canvas) {
      this.canvas = options.canvas;
      this.isCustomCanvas = true;
    } else {
      this.canvas = document.createElement('canvas');
      this.canvas.id = 'transparent-explosion-canvas';
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
      this.isCustomCanvas = false;
      this.resizeFullscreen();
      window.addEventListener('resize', () => this.resizeFullscreen());
    }

    this.ctx = this.canvas.getContext('2d', { alpha: true });
    this.setupDPI();
  }

  setupDPI() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    const w = rect.width || window.innerWidth;
    const h = rect.height || window.innerHeight;

    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.ctx.scale(dpr, dpr);
    this.width = w;
    this.height = h;
  }

  resizeFullscreen() {
    if (this.isCustomCanvas) return;
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

  playExplosionSound() {
    if (!this.enableSound) return;
    try {
      this.initAudio();
      if (!this.audioCtx) return;
      if (this.audioCtx.state === 'suspended') this.audioCtx.resume();

      // Deep rumble explosion sound lasting ~2.2s
      const bufferSize = this.audioCtx.sampleRate * 2.2;
      const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = this.audioCtx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.audioCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(600, this.audioCtx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(30, this.audioCtx.currentTime + 2.0);

      const gain = this.audioCtx.createGain();
      gain.gain.setValueAtTime(0.8, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 2.2);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.audioCtx.destination);

      noise.start();
      noise.stop(this.audioCtx.currentTime + 2.2);
    } catch (e) {}
  }

  /**
   * Detonate explosion with large radius and extended duration (2.0 - 2.5s)
   */
  explode(x = window.innerWidth / 2, y = window.innerHeight / 2, options = {}) {
    const {
      scale = 1.6,            // Large radius multiplier
      particleCount = 220,    // High object count
      duration = 2.4          // 2.4 seconds total lifetime
    } = options;

    this.playExplosionSound();

    // 1. Initial Flash Bloom
    this.flashes.push({
      x, y,
      radius: 200 * scale,
      opacity: 1,
      decay: 0.05
    });

    // 2. Shockwaves (Multiple propagating rings)
    this.shockwaves.push(
      { x, y, radius: 10, maxRadius: 420 * scale, speed: 14 * scale, opacity: 1, color: '255, 200, 100', width: 8 },
      { x, y, radius: 10, maxRadius: 360 * scale, speed: 10 * scale, opacity: 1, color: '255, 120, 40', width: 6 },
      { x, y, radius: 10, maxRadius: 280 * scale, speed: 7 * scale, opacity: 1, color: '255, 60, 20', width: 4 }
    );

    // 3. Jagged Flying Debris & Rocks (50+ objects with physical tumbling)
    for (let i = 0; i < 60; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (Math.random() * 12 + 4) * scale;
      const numPts = Math.floor(Math.random() * 3) + 4;
      const pts = [];
      const baseRadius = (Math.random() * 7 + 4) * scale;
      for (let p = 0; p < numPts; p++) {
        const a = p * (Math.PI * 2 / numPts) + (Math.random() - 0.5) * 0.4;
        const r = baseRadius * (0.6 + Math.random() * 0.7);
        pts.push({ x: Math.cos(a) * r, y: Math.sin(a) * r });
      }

      this.debris.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - (Math.random() * 4 + 1) * scale,
        pts,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.25,
        drag: 0.98,
        gravity: 0.16 * scale,
        life: 1.0,
        decay: 1 / (60 * (1.8 + Math.random() * 0.6)), // lasts 1.8 to 2.4s
        color: Math.random() < 0.35 ? '#ff7700' : '#334155'
      });
    }

    // 4. Primary Fire, Smoke & Spark Particles (160+ items)
    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const isSpark = Math.random() < 0.45;
      const speed = isSpark
        ? (Math.random() * 18 + 5) * scale    // High-speed streaking embers
        : (Math.random() * 9 + 2) * scale;    // Expanding fire/smoke cloud

      const particleLifetime = isSpark
        ? (1.4 + Math.random() * 0.9)         // 1.4s - 2.3s
        : (1.8 + Math.random() * 0.7);        // 1.8s - 2.5s

      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - (Math.random() * 2),
        size: isSpark ? (Math.random() * 3 + 2) * scale : (Math.random() * 16 + 8) * scale,
        initialSize: isSpark ? (Math.random() * 3 + 2) * scale : (Math.random() * 16 + 8) * scale,
        life: 1.0,
        decay: 1 / (60 * particleLifetime),
        drag: isSpark ? 0.975 : 0.94,
        gravity: isSpark ? 0.15 * scale : -0.04 * scale,
        isSpark,
        trail: []
      });
    }

    if (!this.isRunning) {
      this.isRunning = true;
      this.animate();
    }
  }

  animate() {
    // 100% CLEAR - Pure transparency every frame
    this.ctx.clearRect(0, 0, this.width, this.height);
    this.ctx.save();

    // 1. Core Flash Bloom
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const f = this.flashes[i];
      f.opacity -= f.decay;
      if (f.opacity <= 0) {
        this.flashes.splice(i, 1);
        continue;
      }
      this.ctx.beginPath();
      const grad = this.ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.radius);
      grad.addColorStop(0, `rgba(255, 255, 240, ${f.opacity})`);
      grad.addColorStop(0.3, `rgba(255, 170, 50, ${f.opacity * 0.8})`);
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      this.ctx.fillStyle = grad;
      this.ctx.arc(f.x, f.y, f.radius, 0, Math.PI * 2);
      this.ctx.fill();
    }

    // 2. Expanding Shockwaves
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const s = this.shockwaves[i];
      s.radius += s.speed;
      s.opacity = Math.max(0, 1 - (s.radius / s.maxRadius));
      if (s.radius >= s.maxRadius || s.opacity <= 0) {
        this.shockwaves.splice(i, 1);
        continue;
      }
      this.ctx.beginPath();
      this.ctx.strokeStyle = `rgba(${s.color}, ${s.opacity * 0.9})`;
      this.ctx.lineWidth = s.width * (1 - s.radius / s.maxRadius);
      this.ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
      this.ctx.stroke();
    }

    // 3. Jagged Shrapnel / Rocks (Physical Objects flying out)
    for (let i = this.debris.length - 1; i >= 0; i--) {
      const d = this.debris[i];
      d.x += d.vx;
      d.y += d.vy;
      d.vx *= d.drag;
      d.vy = d.vy * d.drag + d.gravity;
      d.rotation += d.rotSpeed;
      d.life -= d.decay;

      if (d.life <= 0) {
        this.debris.splice(i, 1);
        continue;
      }

      const alpha = Math.min(1, d.life * 2);
      this.ctx.save();
      this.ctx.translate(d.x, d.y);
      this.ctx.rotate(d.rotation);
      this.ctx.fillStyle = d.color;
      this.ctx.globalAlpha = alpha;
      this.ctx.beginPath();
      for (let p = 0; p < d.pts.length; p++) {
        if (p === 0) this.ctx.moveTo(d.pts[p].x, d.pts[p].y);
        else this.ctx.lineTo(d.pts[p].x, d.pts[p].y);
      }
      this.ctx.closePath();
      this.ctx.fill();
      this.ctx.restore();
    }

    // 4. Fire, Smoke and Streaking Embers
    this.ctx.globalCompositeOperation = 'lighter';
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];

      if (p.isSpark) {
        p.trail.push({ x: p.x, y: p.y });
        if (p.trail.length > 5) p.trail.shift();
      }

      p.x += p.vx;
      p.y += p.vy;
      p.vx *= p.drag;
      p.vy = p.vy * p.drag + p.gravity;
      p.life -= p.decay;

      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      const alpha = Math.max(0, p.life);

      if (p.isSpark) {
        // Streaking golden ember
        this.ctx.beginPath();
        this.ctx.fillStyle = `rgba(255, 230, 150, ${alpha})`;
        this.ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
        this.ctx.fill();

        // Trail
        if (p.trail.length >= 2) {
          this.ctx.beginPath();
          this.ctx.strokeStyle = `rgba(255, 150, 40, ${alpha * 0.6})`;
          this.ctx.lineWidth = p.size * 0.8;
          this.ctx.moveTo(p.trail[0].x, p.trail[0].y);
          for (let t = 1; t < p.trail.length; t++) {
            this.ctx.lineTo(p.trail[t].x, p.trail[t].y);
          }
          this.ctx.stroke();
        }
      } else {
        // Fire / expanding smoke puff
        const curSize = p.initialSize * (1 + (1 - p.life) * 2.2);
        // Cools from bright orange/yellow down to smoky red
        const red = 255;
        const green = Math.max(30, Math.floor(180 * p.life));
        const blue = Math.max(10, Math.floor(40 * p.life));

        const grad = this.ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, Math.max(2, curSize));
        grad.addColorStop(0, `rgba(${red}, ${green}, ${blue}, ${alpha * 0.85})`);
        grad.addColorStop(0.5, `rgba(${red - 30}, ${Math.floor(green * 0.5)}, 20, ${alpha * 0.4})`);
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

        this.ctx.fillStyle = grad;
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, Math.max(2, curSize), 0, Math.PI * 2);
        this.ctx.fill();
      }
    }

    this.ctx.restore();

    // Loop continues as long as particles exist; when done, canvas remains 100% transparent
    if (this.particles.length > 0 || this.debris.length > 0 || this.shockwaves.length > 0 || this.flashes.length > 0) {
      requestAnimationFrame(() => this.animate());
    } else {
      this.isRunning = false;
      this.ctx.clearRect(0, 0, this.width, this.height);
    }
  }
}

// Global exposure
if (typeof window !== 'undefined') {
  window.ExplosionSystem = ExplosionSystem;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ExplosionSystem;
}
