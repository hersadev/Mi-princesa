'use strict';

// ===== Constantes compartidas =====
const T = 30;          // tamaño de casilla en píxeles
const ROWS = 18;       // filas de un nivel (18 * 30 = 540)
const VW = 960, VH = 540;

const INK = '#2b2622';
const PAPER = '#f7f1e1';
const FONT = '"Gochi Hand", "Comic Sans MS", "Chalkboard SE", cursive';

const COL = {
  ground: '#e9dcb9',
  hatch: '#c9b78a',
  grass: '#6a9a3a',
  block: '#efc27e',
  blockLine: '#c8955a',
  steel: '#cfcfcf',
  hero: '#c0392b',     // capa del protagonista
  rival: '#6c3483',    // capa del Conde Cuernos
  dress: '#f19cbb',
  hair: '#e2a93b',
  gold: '#f4c430',
  wood: '#b9824f',
  note: '#fffbe8',
};

// ===== Utilidades de dibujo "a mano" =====
const Draw = {
  boil: 0,   // cambia unas veces por segundo para que las líneas "tiemblen"
  motion: 1, // 1 = temblor normal, 0.35 = suave, 0 = sin temblor (lo fija el juego)
  amp: 1,    // cuánto se desvía el trazo "a mano"

  hash(a, b, s) {
    let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(s | 0, 1274126177);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  },

  jit(x, y, amt) { return (this.hash(Math.round(x), Math.round(y), this.boil) - 0.5) * 2 * amt * this.amp; },

  // Añade al path actual un segmento con temblor. Las esquinas compartidas tiemblan igual.
  seg(ctx, x1, y1, x2, y2, amt = 1.2) {
    const ax = x1 + this.jit(x1, y1, amt), ay = y1 + this.jit(y1, x1 + 7, amt);
    const bx = x2 + this.jit(x2, y2, amt), by = y2 + this.jit(y2, x2 + 7, amt);
    const mx = (ax + bx) / 2 + this.jit(x1 + x2, y1 + y2 + 3, amt);
    const my = (ay + by) / 2 + this.jit(y1 + y2, x1 + x2 + 5, amt);
    ctx.moveTo(ax, ay);
    ctx.quadraticCurveTo(mx, my, bx, by);
  },

  rect(ctx, x, y, w, h, amt) {
    this.seg(ctx, x, y, x + w, y, amt);
    this.seg(ctx, x + w, y, x + w, y + h, amt);
    this.seg(ctx, x + w, y + h, x, y + h, amt);
    this.seg(ctx, x, y + h, x, y, amt);
  },

  roundRect(ctx, x, y, w, h, r) {
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  },

  font(size) { return `${size}px ${FONT}`; },

  text(ctx, str, x, y, size, color = INK, align = 'center') {
    ctx.font = this.font(size);
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(str, x, y);
  },

  // Texto con letras ligeramente bailonas (títulos)
  wobblyText(ctx, str, x, y, size, color = INK, t = 0) {
    ctx.font = this.font(size);
    ctx.fillStyle = color;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    const total = ctx.measureText(str).width;
    let cx = x - total / 2;
    for (let i = 0; i < str.length; i++) {
      const ch = str[i], w = ctx.measureText(ch).width;
      ctx.save();
      ctx.translate(cx + w / 2, y + Math.sin(t * 3 + i * 0.7) * size * 0.04 * this.motion);
      ctx.rotate((this.hash(i, 3, this.boil) - 0.5) * 0.12 * Math.max(this.motion, 0.4));
      ctx.fillText(ch, -w / 2, 0);
      ctx.restore();
      cx += w;
    }
  },

  // Parte un texto en líneas que caben en maxW (respeta los \n)
  lines(ctx, str, maxW, size) {
    ctx.font = this.font(size);
    const out = [];
    for (const para of str.split('\n')) {
      let line = '';
      for (const word of para.split(' ')) {
        const test = line ? line + ' ' + word : word;
        if (ctx.measureText(test).width > maxW && line) { out.push(line); line = word; } else line = test;
      }
      out.push(line);
    }
    return out;
  },

  // Texto en varias líneas; devuelve el número de líneas
  wrap(ctx, str, x, y, maxW, size, lineH, color = INK, align = 'center') {
    const ls = this.lines(ctx, str, maxW, size);
    ls.forEach((l, i) => this.text(ctx, l, x, y + i * lineH, size, color, align));
    return ls.length;
  },

  // Bocadillo de diálogo. (x, y) = punta del rabito. Hace salto de línea y nunca
  // se sale de la pantalla: se desplaza hacia dentro si hace falta.
  bubble(ctx, x, y, str, size = 20, maxW = 320) {
    const ls = this.lines(ctx, str, maxW, size);
    ctx.font = this.font(size);
    const lineH = size + 4;
    const w = Math.max(...ls.map((l) => ctx.measureText(l).width)) + 24;
    const h = ls.length * lineH + 12;
    const bx = Math.max(8, Math.min(VW - w - 8, x - w / 2));
    const by = Math.max(8, y - h - 12);
    const tx = Math.max(bx + 14, Math.min(bx + w - 14, x));
    const tipY = Math.max(by + h + 6, y);
    ctx.beginPath();
    this.roundRect(ctx, bx, by, w, h, 10);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(tx - 7, by + h - 1);
    ctx.lineTo(x, tipY);
    ctx.lineTo(tx + 7, by + h - 1);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(tx - 7, by + h);
    ctx.lineTo(x, tipY);
    ctx.lineTo(tx + 7, by + h);
    ctx.stroke();
    ls.forEach((l, i) => this.text(ctx, l, bx + w / 2, by + 6 + size * 0.85 + i * lineH, size));
  },

  // ===== Monigote =====
  // x = centro, y = pies. Opciones: facing, phase, speed (0..1), air, vy, t,
  // scale, pose ('carry' | 'cheer' | 'laugh'), y accesorios: hat, mustache, cape,
  // horns, brows, crown, dress, hair, grin.
  stick(ctx, x, y, o = {}) {
    const f = o.facing || 1, ph = o.phase || 0, sp = o.speed || 0, t = o.t || 0;
    ctx.save();
    ctx.translate(x, y);
    if (o.scale) ctx.scale(o.scale, o.scale);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = INK;

    const hip = -18, sh = -31, hy = -39, R = 7;
    const bob = o.air ? 0 : Math.abs(Math.sin(ph)) * 1.6 * sp + (o.pose === 'laugh' ? Math.abs(Math.sin(t * 12)) * 2 : 0);
    ctx.translate(0, -bob);

    // capa
    if (o.cape) {
      const flap = Math.sin(t * 9) * 2 + sp * 7 + (o.air ? 5 : 0);
      ctx.fillStyle = o.cape;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-f * 1, sh - 1);
      ctx.lineTo(-f * (9 + flap), hip + 5 - (o.air ? 5 : 0));
      ctx.lineTo(-f * 2, hip + 2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // pelo largo (detrás de la cabeza)
    if (o.hair) {
      ctx.strokeStyle = o.hair;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-R + 1, hy - 3);
      ctx.quadraticCurveTo(-R - 4, hy + 6, -R + 1, sh + 5);
      ctx.moveTo(R - 1, hy - 3);
      ctx.quadraticCurveTo(R + 4, hy + 6, R - 1, sh + 5);
      ctx.stroke();
      ctx.strokeStyle = INK;
    }

    // ángulos (0 = hacia abajo)
    let l1, l2, a1, a2;
    if (o.pose === 'carry' || o.pose === 'cheer') {
      const s = Math.sin(ph) * 0.75 * sp;
      l1 = s; l2 = -s;
      a1 = 2.75; a2 = -2.75;
      if (o.pose === 'cheer') { a1 = 2.4 + Math.sin(t * 10) * 0.2; a2 = -2.4 - Math.sin(t * 10) * 0.2; }
    } else if (o.air) {
      const up = (o.vy || 0) < 0;
      l1 = 0.6 * f; l2 = -0.3 * f;
      a1 = up ? 2.5 : 1.9; a2 = up ? -2.5 : -1.9;
    } else {
      const s = Math.sin(ph) * 0.75 * sp;
      l1 = s; l2 = -s;
      a1 = 0.35 - s * 0.9; a2 = -0.35 + s * 0.9;
      if (o.pose === 'laugh') { a1 = 1.2; a2 = -1.2; }
    }

    ctx.lineWidth = 2.6;
    ctx.beginPath();
    // piernas
    const legTop = o.dress ? hip + 6 : hip, legLen = o.dress ? 12 : 17;
    for (const a of [l1, l2]) {
      const fx = Math.sin(a) * legLen, fy = legTop + Math.cos(a) * legLen;
      ctx.moveTo(0, legTop);
      ctx.lineTo(fx, fy);
      ctx.lineTo(fx + f * 4, fy);
    }
    // cuerpo
    ctx.moveTo(0, hy + R);
    ctx.lineTo(0, hip);
    // brazos
    for (const a of [a1, a2]) {
      ctx.moveTo(0, sh + 2);
      ctx.lineTo(Math.sin(a) * 13, sh + 2 + Math.cos(a) * 13);
    }
    ctx.stroke();

    // vestido
    if (o.dress) {
      ctx.fillStyle = o.dress;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, sh + 1);
      ctx.lineTo(-11, hip + 7);
      ctx.lineTo(11, hip + 7);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // cabeza
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(0, hy, R, 0, Math.PI * 2);
    ctx.fillStyle = PAPER;
    ctx.fill();
    ctx.stroke();
    // ojo
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(f * 3, hy - 1, 1.3, 0, Math.PI * 2);
    ctx.fill();

    ctx.lineWidth = 1.8;
    if (o.brows) {
      ctx.beginPath();
      ctx.moveTo(f * 0.5, hy - 5.5);
      ctx.lineTo(f * 5.5, hy - 3.5);
      ctx.stroke();
    }
    if (o.grin || o.pose === 'laugh') {
      ctx.beginPath();
      ctx.arc(f * 2.5, hy + 2, 2.6, 0.1, Math.PI - 0.1);
      ctx.stroke();
    }
    if (o.mustache) {
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(f * 1, hy + 3);
      ctx.quadraticCurveTo(f * 5, hy + 6, f * 9, hy + 1);
      ctx.moveTo(f * 1, hy + 3);
      ctx.quadraticCurveTo(-f * 1.5, hy + 6, -f * 3.5, hy + 2);
      ctx.stroke();
    }
    // sudor en la frente (ayuda): una gota, y dos si está muy cerca del peligro
    if (o.sweat > 0.3) {
      this.drop(ctx, -f * 8.5, hy - 1, 1.1 + o.sweat * 0.8);
      if (o.sweat > 0.7) this.drop(ctx, -f * 6, hy + 6, 1.2);
      ctx.strokeStyle = INK;
    }
    if (o.hat) {
      ctx.fillStyle = INK;
      ctx.fillRect(-5.5, hy - R - 11, 11, 11);
      ctx.fillRect(-9, hy - R - 1.5, 18, 2.6);
      ctx.fillStyle = COL.hero;
      ctx.fillRect(-5.5, hy - R - 4.5, 11, 2.6);
    }
    if (o.horns) {
      ctx.fillStyle = '#b03030';
      ctx.lineWidth = 1.5;
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(s * 2, hy - R + 1);
        ctx.lineTo(s * 9, hy - R - 8);
        ctx.lineTo(s * 6.5, hy - R + 3);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    }
    if (o.crown) {
      ctx.fillStyle = COL.gold;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-6, hy - R + 1);
      ctx.lineTo(-6, hy - R - 7);
      ctx.lineTo(-3, hy - R - 3);
      ctx.lineTo(0, hy - R - 8);
      ctx.lineTo(3, hy - R - 3);
      ctx.lineTo(6, hy - R - 7);
      ctx.lineTo(6, hy - R + 1);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  },

  hero(ctx, x, y, o = {}) {
    this.stick(ctx, x, y, Object.assign({ hat: true, mustache: true, cape: COL.hero }, o));
  },
  rival(ctx, x, y, o = {}) {
    this.stick(ctx, x, y, Object.assign({ horns: true, brows: true, cape: COL.rival }, o));
  },
  princess(ctx, x, y, o = {}) {
    this.stick(ctx, x, y, Object.assign({ crown: true, dress: COL.dress, hair: COL.hair }, o));
  },

  // ===== Elementos del escenario =====
  spikes(ctx, x, y, rise) {
    if (rise <= 0) return;
    const h = 18 * rise, base = y + T;
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const sx = x + i * 10;
      ctx.moveTo(sx, base);
      ctx.lineTo(sx + 5, base - h);
      ctx.lineTo(sx + 10, base);
    }
    ctx.fillStyle = COL.steel;
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.stroke();
  },

  // Bloque de pinchos que cae del techo (pinchos hacia abajo)
  dropSpike(ctx, x, y) {
    ctx.beginPath();
    this.rect(ctx, x + 2, y, T - 4, 11, 1);
    ctx.fillStyle = '#9a9a9a';
    ctx.fillRect(x + 2, y, T - 4, 11);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const sx = x + 3 + i * 8;
      ctx.moveTo(sx, y + 11);
      ctx.lineTo(sx + 4, y + T);
      ctx.lineTo(sx + 8, y + 11);
    }
    ctx.fillStyle = COL.steel;
    ctx.fill();
    ctx.stroke();
  },

  saw(ctx, x, y, r, ang) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.beginPath();
    const n = 12;
    for (let i = 0; i < n * 2; i++) {
      const a = (i / (n * 2)) * Math.PI * 2, rr = i % 2 ? r * 0.78 : r;
      ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fillStyle = COL.steel;
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.35, 0, Math.PI * 2);
    ctx.moveTo(-r * 0.35, 0);
    ctx.lineTo(r * 0.35, 0);
    ctx.stroke();
    ctx.restore();
  },

  door(ctx, x, y, w, h, legs = null, bite = 0) {
    if (legs !== null) {
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2.4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      const s = Math.sin(legs) * 6;
      ctx.moveTo(x + 9, y + h);
      ctx.lineTo(x + 9 + s, y + h + 10);
      ctx.moveTo(x + w - 9, y + h);
      ctx.lineTo(x + w - 9 - s, y + h + 10);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(x, y + h);
    ctx.lineTo(x, y + w / 2);
    ctx.arc(x + w / 2, y + w / 2, w / 2, Math.PI, 0);
    ctx.lineTo(x + w, y + h);
    ctx.closePath();
    ctx.fillStyle = COL.wood;
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.4;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + w / 3, y + 8);
    ctx.lineTo(x + w / 3, y + h);
    ctx.moveTo(x + (2 * w) / 3, y + 8);
    ctx.lineTo(x + (2 * w) / 3, y + h);
    ctx.strokeStyle = 'rgba(43,38,34,0.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x + w - 7, y + h * 0.58, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = COL.gold;
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.stroke();
    if (bite > 0) {
      // la puerta falsa abre la boca
      const my = y + h * 0.5, open = 14 * bite;
      ctx.fillStyle = '#3a1010';
      ctx.fillRect(x + 2, my - open, w - 4, open * 2);
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        const tx = x + 2 + i * ((w - 4) / 4), tw = (w - 4) / 4;
        ctx.moveTo(tx, my - open);
        ctx.lineTo(tx + tw / 2, my - open + 8);
        ctx.lineTo(tx + tw, my - open);
        ctx.moveTo(tx, my + open);
        ctx.lineTo(tx + tw / 2, my + open - 8);
        ctx.lineTo(tx + tw, my + open);
      }
      ctx.fillStyle = '#fff';
      ctx.fill();
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
    this.text(ctx, 'SALIDA', x + w / 2, y - 6, 14);
  },

  spring(ctx, x, y, w, squash) {
    const base = y + 12, top = y + squash * 6;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.beginPath();
    const n = 4;
    for (let i = 0; i <= n; i++) {
      const yy = base - ((base - top - 3) * i) / n;
      ctx.lineTo(x + (i % 2 ? 8 : w - 8), yy);
    }
    ctx.stroke();
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(x + 3, top, w - 6, 4);
    ctx.strokeRect(x + 3, top, w - 6, 4);
  },

  sign(ctx, x, y, str) {
    ctx.font = this.font(15);
    const tw = ctx.measureText(str).width, w = tw + 16, h = 24, bx = x - w / 2, by = y - 58;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    this.seg(ctx, x, y, x, by + h, 0.8);
    ctx.stroke();
    ctx.fillStyle = '#f3dcae';
    ctx.fillRect(bx, by, w, h);
    ctx.beginPath();
    this.rect(ctx, bx, by, w, h, 1);
    ctx.lineWidth = 2;
    ctx.stroke();
    this.text(ctx, str, x, by + 17, 15);
  },

  cloud(ctx, x, y, s) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.beginPath();
    ctx.moveTo(-20, 10);
    ctx.arc(-8, 2, 13, Math.PI * 0.75, Math.PI * 1.6);
    ctx.arc(14, -6, 18, Math.PI * 1.15, Math.PI * 1.9);
    ctx.arc(36, 2, 13, Math.PI * 1.4, Math.PI * 0.3);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(110,130,160,0.55)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  },

  // Gota de sudor con la punta hacia arriba (g = -1: al revés, para la gravedad invertida)
  drop(ctx, x, y, r, g = 1) {
    ctx.save();
    ctx.translate(x, y);
    if (g < 0) ctx.scale(1, -1);
    ctx.beginPath();
    ctx.moveTo(0, -r * 2.3);
    ctx.quadraticCurveTo(r * 1.1, -r * 0.6, r, 0);
    ctx.arc(0, 0, r, 0, Math.PI);
    ctx.quadraticCurveTo(-r * 1.1, -r * 0.6, 0, -r * 2.3);
    ctx.closePath();
    ctx.fillStyle = '#7fc4ef';
    ctx.fill();
    ctx.strokeStyle = '#2e86c1';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();
  },

  ceilSpikes(ctx, x, y) {
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const sx = x + i * 10;
      ctx.moveTo(sx, y);
      ctx.lineTo(sx + 5, y + 18);
      ctx.lineTo(sx + 10, y);
    }
    ctx.fillStyle = COL.steel;
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.stroke();
  },

  // Prensa: barra desde el techo + bloque con pinchos abajo
  crusher(ctx, x, y0, y, shiver) {
    const sx = x + (shiver ? Math.sin(Date.now() / 18) * 1.5 * this.motion : 0);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.fillStyle = '#b8b8b8';
    ctx.fillRect(sx + 11, y0 - 4, 8, y - y0 + 6);
    ctx.strokeRect(sx + 11, y0 - 4, 8, y - y0 + 6);
    ctx.fillStyle = '#8c8c8c';
    ctx.fillRect(sx + 1, y, T - 2, 18);
    ctx.beginPath();
    this.rect(ctx, sx + 1, y, T - 2, 18, 1);
    ctx.stroke();
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const px = sx + 1 + i * 7;
      ctx.moveTo(px, y + 18);
      ctx.lineTo(px + 3.5, y + T);
      ctx.lineTo(px + 7, y + 18);
    }
    ctx.fillStyle = COL.steel;
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#e74c3c';
    ctx.beginPath();
    ctx.arc(sx + T / 2, y + 9, 2.5, 0, Math.PI * 2);
    ctx.fill();
  },

  // Bloque intermitente: state = 'on' | 'warn' | 'off'
  blink(ctx, x, y, state, alt) {
    const col = alt ? '#9ed2f0' : '#f5a6c8';
    if (state === 'off') {
      ctx.setLineDash([4, 5]);
      ctx.strokeStyle = 'rgba(43,38,34,0.35)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x + 2, y + 2, T - 4, T - 4);
      ctx.setLineDash([]);
      return;
    }
    // aviso de que va a desaparecer: parpadeo rápido, o semitransparente si el temblor está reducido
    if (state === 'warn' && this.motion === 1 && Math.floor(Date.now() / 90) % 2) return;
    ctx.save();
    if (state === 'warn' && this.motion < 1) ctx.globalAlpha = 0.45;
    ctx.fillStyle = col;
    ctx.fillRect(x, y, T, T);
    ctx.beginPath();
    this.rect(ctx, x, y, T, T);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.4;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x + T / 2, y + T / 2, 5, 0, Math.PI * 2);
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  },

  shooter(ctx, x, y, dir) {
    ctx.fillStyle = '#a3794f';
    ctx.fillRect(x, y, T, T);
    ctx.beginPath();
    this.rect(ctx, x, y, T, T);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.4;
    ctx.stroke();
    ctx.fillStyle = INK;
    ctx.beginPath();
    const mx = dir < 0 ? x : x + T;
    ctx.arc(mx, y + T / 2, 6, dir < 0 ? -Math.PI / 2 : Math.PI / 2, dir < 0 ? Math.PI / 2 : Math.PI * 1.5);
    ctx.fill();
    // ojos malvados
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(x + 7, y + 7, 5, 3);
    ctx.fillRect(x + 18, y + 7, 5, 3);
  },

  arrow(ctx, x, y, dir) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - dir * 10, y);
    ctx.lineTo(x + dir * 10, y);
    ctx.moveTo(x + dir * 10, y);
    ctx.lineTo(x + dir * 5, y - 4);
    ctx.moveTo(x + dir * 10, y);
    ctx.lineTo(x + dir * 5, y + 4);
    ctx.moveTo(x - dir * 10, y);
    ctx.lineTo(x - dir * 13, y - 3);
    ctx.moveTo(x - dir * 10, y);
    ctx.lineTo(x - dir * 13, y + 3);
    ctx.stroke();
  },

  gravPad(ctx, x, y, t, up) {
    const cx = x + T / 2, cy = y + T / 2, r = 12 + Math.sin(t * 5) * 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(155,89,182,0.25)';
    ctx.fill();
    ctx.strokeStyle = '#8e44ad';
    ctx.lineWidth = 2.4;
    ctx.stroke();
    const d = up ? -1 : 1;
    ctx.beginPath();
    ctx.moveTo(cx, cy - d * 7);
    ctx.lineTo(cx, cy + d * 7);
    ctx.moveTo(cx - 5, cy + d * 2);
    ctx.lineTo(cx, cy + d * 7);
    ctx.lineTo(cx + 5, cy + d * 2);
    ctx.stroke();
  },

  platform(ctx, x, y, w, h) {
    ctx.fillStyle = '#c9a26b';
    ctx.fillRect(x, y, w, h);
    ctx.beginPath();
    this.rect(ctx, x, y, w, h, 1);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.4;
    ctx.stroke();
    ctx.beginPath();
    for (let px = x + 15; px < x + w - 5; px += 15) {
      ctx.moveTo(px, y + 3);
      ctx.lineTo(px, y + h - 3);
    }
    ctx.strokeStyle = 'rgba(43,38,34,0.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  },

  // Muro de pinchos que persigue. x = borde derecho (los pinchos)
  chaseWall(ctx, x, left) {
    ctx.fillStyle = '#5b4b5a';
    ctx.fillRect(left, 0, x - left - 10, VH);
    ctx.beginPath();
    for (let y = 0; y < VH; y += 20) {
      ctx.moveTo(x - 10, y);
      ctx.lineTo(x + 8, y + 10);
      ctx.lineTo(x - 10, y + 20);
    }
    ctx.fillStyle = COL.steel;
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - 10, 0);
    ctx.lineTo(x - 10, VH);
    ctx.lineWidth = 3;
    ctx.stroke();
    // carita enfadada
    for (const yy of [140, 330]) {
      this.text(ctx, '>:(', x - 40, yy, 26, '#f7f1e1');
    }
  },

  cage(ctx, x, y, w, h, t, open) {
    ctx.save();
    if (!open) this.princess(ctx, x + w / 2, y + h, { t, facing: -1, pose: Math.sin(t * 2) > 0.6 ? 'cheer' : undefined });
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(x, y + h);
    ctx.lineTo(x, y + 14);
    ctx.quadraticCurveTo(x + w / 2, y - 10, x + w, y + 14);
    ctx.lineTo(x + w, y + h);
    ctx.stroke();
    if (!open) {
      ctx.beginPath();
      for (let bx = x + 10; bx < x + w - 4; bx += 10) {
        ctx.moveTo(bx, y + 6);
        ctx.lineTo(bx, y + h);
      }
      ctx.lineWidth = 1.8;
      ctx.stroke();
    }
    ctx.fillStyle = COL.gold;
    ctx.fillRect(x - 3, y + h - 5, w + 6, 6);
    ctx.strokeRect(x - 3, y + h - 5, w + 6, 6);
    ctx.beginPath();
    ctx.arc(x + w / 2, y - 5, 5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  },

  skull(ctx, x, y, s = 1) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, -2, 9, Math.PI * 0.85, Math.PI * 0.15);
    ctx.lineTo(5, 9);
    ctx.lineTo(-5, 9);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(-3.5, -1, 2.4, 0, Math.PI * 2);
    ctx.arc(3.5, -1, 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },
};
