# 💥 Transparent Explosion Assets & Drop-in Animation

Generated transparent explosion animation matching your exact requirements:
- **Duration**: **2.4 seconds**
- **Radius**: **Massive blast radius** (expands over 750px+)
- **Objects**: **200+ flying items** (tumbling jagged shrapnel, rock chunks, expanding shockwave rings, fiery blasts, and streaking embers)
- **Background**: **100% Alpha Transparent** (Zero background color or box artifacts)

---

## 📁 Ready-to-Use Transparent Files

| File | Format | Best For | Code Snippet |
| :--- | :--- | :--- | :--- |
| [**`explosion.webm`**](file:///c:/NEXUS-a%20new%20breakthrough-2.discord/animations%20for%20the%20web/explosion.webm) | Transparent Video (VP9 + Alpha) | Modern HTML5 `<video>`, smooth 36fps playback | `<video src="explosion.webm" autoplay loop muted playsinline></video>` |
| [**`explosion.png`**](file:///c:/NEXUS-a%20new%20breakthrough-2.discord/animations%20for%20the%20web/explosion.png) | 32-bit APNG (Animated PNG) | Drop-in `<img>` tag with crisp anti-aliased transparency | `<img src="explosion.png" alt="Explosion" />` |
| [**`explosion.gif`**](file:///c:/NEXUS-a%20new%20breakthrough-2.discord/animations%20for%20the%20web/explosion.gif) | Transparent GIF | Legacy image tag support | `<img src="explosion.gif" alt="Explosion" />` |
| [**`explosion.js`**](file:///c:/NEXUS-a%20new%20breakthrough-2.discord/animations%20for%20the%20web/explosion.js) | Interactive Canvas Script | Click-to-explode / event-triggered overlay | `boom.explode(x, y)` |

---

## 🛠️ How to Add Into Your Webpage

### Option 1: As a Transparent Video (`explosion.webm`)
```html
<video 
  src="explosion.webm" 
  autoplay 
  loop 
  muted 
  playsinline 
  style="background: transparent; width: 500px; height: 500px; pointer-events: none;">
</video>
```

### Option 2: As an Animated Image (`explosion.png` / APNG)
```html
<!-- Fully transparent 32-bit alpha PNG, works in Chrome, Edge, Firefox, Safari -->
<img 
  src="explosion.png" 
  alt="Explosion Animation" 
  style="background: transparent; width: 500px; height: 500px; pointer-events: none;" 
/>
```

### Option 3: As an Interactive Click/Event Script (`explosion.js`)
If you want the explosion to detonate when the user clicks anywhere, clicks a button, or when an event occurs:

```html
<script src="explosion.js"></script>
<script>
  const boom = new ExplosionSystem({ sound: true });

  // Detonate at center or mouse coordinates
  window.addEventListener('click', (e) => {
    boom.explode(e.clientX, e.clientY);
  });
</script>
```
