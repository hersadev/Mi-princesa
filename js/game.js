'use strict';

// ===== Física =====
const PHYS = {
  grav: 2200,        // px/s²
  cutGrav: 2.4,      // gravedad extra al soltar ESPACIO subiendo (salto corto)
  maxFall: 900,
  run: 250,
  accGround: 2600,
  accAir: 1700,
  fricGround: 2600,
  fricAir: 450,
  jump: 700,         // ≈ 111 px de altura (3,7 casillas)
  spring: 1150,      // ≈ 300 px
  coyote: 0.09,      // margen para saltar justo después de dejar el borde
  buffer: 0.12,      // margen para saltar justo antes de tocar el suelo
};

const ARROW_RANGE = 15 * T; // las flechas caen tras recorrer 15 casillas

const DEATH_MSGS = {
  spike: ['¡Pincho!', 'Eso pincha.', 'Eso no estaba ahí...', '¿Quién pone pinchos AHÍ?'],
  saw: ['En rodajas.', 'Cortado en juliana.', 'Bzzzzt.'],
  fall: ['Adiós...', 'Al vacío.', 'El suelo era mentira.', 'Plof.'],
  up: ['Te caíste hacia arriba.', 'Hasta el infinito... y más allá.', 'Adiós, gravedad.'],
  drop: ['¡Cuidado arriba!', 'Te cayó el techo.', 'Mira hacia arriba.'],
  crush: ['¡PLAF!', 'Aplastado como un sello.', 'Ahora eres un dibujo plano. Más plano.'],
  arrow: ['¡Flechazo!', 'Diana.', 'Amor a primera flecha.'],
  door: ['La puerta muerde.', 'Era una puerta con hambre.', '¡ÑAM!'],
  chase: ['El muro te alcanzó.', 'Demasiado lento.', 'El muro te manda saludos.'],
  reset: ['Rendición táctica.', 'Volvamos a empezar.'],
  any: ['La princesa bosteza.', 'El Conde Cuernos se ríe de ti.', 'Muy malvado, poco hábil.', 'Clásico.', 'Uy.'],
};

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let scale = 1;

const SAVE_KEY = 'esa-princesa-es-mia:v1';

const G = {
  state: 'title',   // title | story | intro | play | dead | clear | ending | fin
  stateT: 0,
  t: 0,
  paused: false,
  levelIndex: 0,
  L: null,
  player: null,
  cam: 0,
  shake: 0,
  flash: 0,
  particles: [],
  texts: [],
  voice: null,
  tauntsDone: new Set(),
  deaths: 0,
  levelDeaths: 0,
  levelTime: 0,
  totalTime: 0,
  storyPage: 0,
  endingPage: 0,
  deathMsg: '',
  save: null,
  newRecord: false,
};

// ===== Guardado =====
function loadSave() {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (s && typeof s.level === 'number') return s;
  } catch (e) { /* sin almacenamiento: no pasa nada */ }
  return null;
}

function writeSave(extra = {}) {
  const best = G.save && typeof G.save.best === 'number' ? G.save.best : null;
  G.save = Object.assign({ level: G.levelIndex, deaths: G.deaths, time: G.totalTime, best }, extra);
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(G.save)); } catch (e) { /* ignorar */ }
}

// ===== Utilidades =====
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const isMassTile = (g) => g === 1 || g === 3;
const onScreen = (x) => x > G.cam - 60 && x < G.cam + VW + 60;

function setState(s) { G.state = s; G.stateT = 0; }

// Perfil de la prensa: espera arriba, baja de golpe, espera abajo, sube despacio
function crushProfile(u) {
  if (u < 0.4) return 0;
  if (u < 0.5) return ((u - 0.4) / 0.1) ** 2;
  if (u < 0.65) return 1;
  return 1 - (u - 0.65) / 0.35;
}

// ===== Construcción del nivel =====
function buildLevel(def) {
  const rows = def.map.slice();
  while (rows.length < ROWS) rows.unshift('');
  const W = Math.max(...rows.map((r) => r.length));
  const L = {
    def, W, pxW: W * T, time: 0,
    grid: [], spikes: [], ents: [], saws: [], signs: [], clouds: [], arrows: [],
    start: { x: 2 * T, y: 14 * T - 10 }, door: null, chase: null, rival: null,
    blinkPeriod: def.blinkPeriod || 2.6, shootEvery: def.shootEvery || 1.8,
  };
  const crushers = [];

  for (let r = 0; r < ROWS; r++) {
    const row = [];
    for (let c = 0; c < W; c++) {
      const ch = rows[r][c] || '.';
      const x = c * T, y = r * T;
      let g = 0;
      switch (ch) {
        case '#': g = 1; break;
        case '=': g = 2; break;
        case 'F': g = 3; break;
        case 'f': g = 4; break;
        case '^': L.spikes.push({ x, y, hidden: false, rise: 1 }); break;
        case 'h': L.spikes.push({ x, y, hidden: true, popped: false, rise: 0 }); break;
        case 'w': L.spikes.push({ x, y, ceil: true, rise: 1 }); break;
        case 'C': L.ents.push({ type: 'crumble', x, y, w: T, h: T, solid: true, timer: -1, vy: 0, falling: false }); break;
        case 'I': L.ents.push({ type: 'invis', x, y, w: T, h: T, solid: false, shown: false, bump: 0 }); break;
        case 'J': L.ents.push({ type: 'invis', x, y, w: T, h: T, solid: true, shown: false, bump: 0, faith: true }); break;
        case 'v': L.ents.push({ type: 'drop', x, y, w: T, h: T, state: 'idle', vy: 0 }); break;
        case 'S': L.ents.push({ type: 'spring', x, y: y + T - 12, w: T, h: 12, squash: 0 }); break;
        case 'K': { const e = { type: 'crusher', x, y, y0: y, w: T, h: T, range: 0, phase: 0, down: false, c, r }; L.ents.push(e); crushers.push(e); break; }
        case 'B': case 'b': L.ents.push({ type: 'blink', x, y, w: T, h: T, solid: true, alt: ch === 'b', vis: 'on' }); break;
        case '<': case '>': {
          const dir = ch === '<' ? -1 : 1;
          L.ents.push({ type: 'shooter', x, y, w: T, h: T, solid: true, dir, timer: 0.3 + ((c + r) % 2) * L.shootEvery * 0.5 });
          break;
        }
        case 'G': L.ents.push({ type: 'grav', x, y, w: T, h: T }); break;
        case 'X': L.ents.push({ type: 'fakedoor', x, y: y + T - 60, w: T, h: 60, bite: 0 }); break;
        case 'o': L.saws.push({ bx: x + T / 2, by: y + T / 2, x: x + T / 2, y: y + T / 2, r: 20, dx: 0, dy: 0, range: 0, speed: 0, phase: 0 }); break;
        case 'P': L.start = { x: x + T / 2 - 8, y: y + T - 40 }; break;
        case 'D':
          L.door = {
            x, y: y + T - 60, w: T, h: 60, moving: false, sx: 0, tx: 0, ty: 0, legs: 0,
            flee: (def.doorFlee || []).map(([fc, fr]) => ({ x: fc * T, y: fr * T + T - 60 })),
          };
          break;
        case 'Z': L.door = { x: x - 10, y: y + T - 64, w: 50, h: 64, moving: false, flee: [], cage: true }; break;
      }
      row.push(g);
    }
    L.grid.push(row);
  }

  // recorrido de cada prensa: hasta el primer suelo que tenga debajo
  crushers.forEach((e) => {
    let rr = e.r + 1;
    while (rr < ROWS && L.grid[rr][e.c] !== 1 && L.grid[rr][e.c] !== 2) rr++;
    e.range = Math.max(0, rr * T - (e.y0 + T));
    // "ola verde": cada prensa va un poco por detrás de la anterior, al ritmo de una carrera
    e.phase = (((-e.c * 0.05) % 1) + 1) % 1;
  });

  for (const s of def.saws || []) {
    L.saws.push({
      bx: s.c * T + T / 2, by: s.r * T + T / 2, x: 0, y: 0, r: s.size || 20,
      dx: s.dx || 0, dy: s.dy || 0, range: (s.range || 0) * T, speed: s.speed || 1, phase: s.phase || 0,
    });
  }
  for (const p of def.platforms || []) {
    L.ents.push({
      type: 'mover', bx: p.c * T, by: p.r * T, x: p.c * T, y: p.r * T, w: (p.w || 2) * T, h: 15,
      dx: p.dx || 0, dy: p.dy || 0, range: (p.range || 0) * T, speed: p.speed || 1, phase: p.phase || 0,
      solid: true, mdx: 0, mdy: 0,
    });
  }
  L.signs = (def.signs || []).map((s) => ({ x: s.c * T + T / 2, y: s.r * T + T, text: s.text }));
  if (def.chase) L.chase = { x: -80, speed: def.chase.speed || 180, delay: def.chase.delay || 1.5 };
  if (def.rival) L.rival = { x: def.rival.c * T + T / 2, y: 15 * T, state: 'idle', phase: 0 };

  // nubes con semilla fija para que no cambien al morir
  let seed = def.name.length * 7919 + W;
  const rnd = () => ((seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 4294967296);
  for (let x = -100; x < L.pxW * 0.4 + VW + 200; x += 180 + rnd() * 160) {
    L.clouds.push({ x, y: 40 + rnd() * 120, s: 0.6 + rnd() * 0.7 });
  }
  updateMoving(L, 0);
  return L;
}

function makePlayer(L) {
  return {
    x: L.start.x, y: L.start.y, w: 16, h: 40, vx: 0, vy: 0, gdir: 1, gravLock: false,
    onGround: false, ground: null, facing: 1, coyote: 0, jumpBuf: 0, phase: 0, springing: false,
  };
}

// ===== Colisiones =====
function forEachSolid(L, box, fn, except = null) {
  const c0 = Math.floor(box.x / T), c1 = Math.floor((box.x + box.w - 0.001) / T);
  const r0 = Math.floor(box.y / T), r1 = Math.floor((box.y + box.h - 0.001) / T);
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      if (c < 0 || c >= L.W) { fn({ x: c * T, y: r * T, w: T, h: T }); continue; } // paredes laterales
      if (r < 0 || r >= ROWS) continue;
      const g = L.grid[r][c];
      if (g === 1 || g === 2) fn({ x: c * T, y: r * T, w: T, h: T });
    }
  }
  for (const e of L.ents) if (e.solid && e !== except && overlap(box, e)) fn(e);
}

function hitsSolid(L, box, except) {
  let hit = false;
  forEachSolid(L, box, (s) => { if (overlap(box, s)) hit = true; }, except);
  return hit;
}

function isSolidAt(L, x, y) {
  const c = Math.floor(x / T), r = Math.floor(y / T);
  if (r >= 0 && r < ROWS && c >= 0 && c < L.W) {
    const g = L.grid[r][c];
    if (g === 1 || g === 2) return true;
  }
  for (const e of L.ents) if (e.solid && x >= e.x && x < e.x + e.w && y >= e.y && y < e.y + e.h) return true;
  return false;
}

// ===== Flujo de juego =====
function newGame() {
  G.deaths = 0;
  G.totalTime = 0;
  G.levelIndex = 0;
  G.storyPage = 0;
  setState('story');
}

function goToLevel(i) {
  G.levelIndex = i;
  G.levelDeaths = 0;
  G.levelTime = 0;
  G.tauntsDone = new Set();
  writeSave();
  setState('intro');
}

function startLevel() {
  resetLevel();
  G.paused = false;
  setState('play');
}

function resetLevel() {
  G.L = buildLevel(LEVELS[G.levelIndex]);
  G.player = makePlayer(G.L);
  G.particles = [];
  G.texts = [];
  G.cam = clamp(G.player.x - VW / 2 + 60, 0, Math.max(0, G.L.pxW - VW));
}

function respawn() {
  resetLevel();
  setState('play');
}

function die(cause) {
  if (G.state !== 'play') return;
  setState('dead');
  G.deaths++;
  G.levelDeaths++;
  G.shake = 12;
  G.flash = 1;
  G.deathMsg = Math.random() < 0.65 ? pick(DEATH_MSGS[cause] || DEATH_MSGS.any) : pick(DEATH_MSGS.any);
  spawnLimbs(G.player);
  Sfx.death();
  writeSave();
}

function win() {
  const p = G.player, d = G.L.door;
  setState('clear');
  Sfx.win();
  for (let i = 0; i < 40; i++) {
    G.particles.push({
      type: 'confetti', x: d.x + d.w / 2, y: d.y + 20,
      vx: (Math.random() - 0.5) * 500, vy: -200 - Math.random() * 400,
      t: 0, life: 2, a: Math.random() * 6, va: (Math.random() - 0.5) * 20,
      color: pick([COL.hero, COL.gold, COL.dress, '#3498db', '#2ecc71']),
    });
  }
  p.hidden = true;
  G.voice = null;
  if (d.cage) {
    // fin del juego: se reinicia el guardado y se apunta el récord
    const prevBest = G.save && typeof G.save.best === 'number' ? G.save.best : null;
    G.newRecord = prevBest === null || G.deaths < prevBest;
    writeSave({ level: 0, best: G.newRecord ? G.deaths : prevBest });
  } else {
    G.levelIndex++;        // el siguiente nivel queda desbloqueado
    writeSave();
    G.levelIndex--;
  }
}

function nextLevel() {
  if (G.L.door.cage) { G.endingPage = 0; setState('ending'); return; }
  const n = G.levelIndex + 1;
  if (n < LEVELS.length) goToLevel(n);
  else setState('fin');
}

function say(text, who = 'rival') {
  G.voice = { text, who, t: 0, life: 2.2 + text.length * 0.045 };
}

// ===== Entrada según estado =====
function handleInput() {
  const pr = (c) => Input.wasPressed(c);
  const confirm = pr('Space') || pr('Enter');

  if (pr('KeyM')) {
    const on = Sfx.toggle();
    if (G.player && G.state === 'play') addText(G.player.x + 8, G.player.y - 20, on ? 'Sonido: sí' : 'Sonido: no', 18);
  }

  switch (G.state) {
    case 'title':
      if (pr('KeyC') && G.save && G.save.level > 0 && G.save.level < LEVELS.length) {
        G.deaths = G.save.deaths || 0;
        G.totalTime = G.save.time || 0;
        goToLevel(G.save.level);
      } else if (confirm) newGame();
      break;

    case 'story':
      if (pr('Escape')) goToLevel(0);
      else if (confirm) {
        G.storyPage++;
        G.stateT = 0;
        if (G.storyPage >= STORY.length) goToLevel(0);
        else Sfx.blip();
      }
      break;

    case 'intro':
      if (confirm && G.stateT > 0.25) startLevel();
      break;

    case 'play':
      if (pr('Escape') || pr('KeyP')) G.paused = !G.paused;
      if (G.paused) {
        if (pr('KeyQ')) { G.paused = false; setState('title'); }
        else if (pr('KeyR')) { G.paused = false; die('reset'); }
        break;
      }
      if (pr('KeyR')) { die('reset'); break; }
      if (pr('Space')) G.player.jumpBuf = PHYS.buffer;
      break;

    case 'dead':
      if (confirm && G.stateT > 0.35) respawn();
      break;

    case 'clear':
      if (confirm && G.stateT > 0.6) nextLevel();
      break;

    case 'ending':
      if (confirm && G.stateT > 0.4) {
        G.endingPage++;
        G.stateT = 0;
        if (G.endingPage >= ENDING.length) setState('fin');
        else Sfx.blip();
      }
      break;

    case 'fin':
      if (confirm && G.stateT > 1.2) setState('title');
      break;
  }
}

// ===== Actualización =====
function step(dt) {
  G.t += dt;
  G.stateT += dt;
  if (G.paused) return;

  if (G.state === 'play') {
    updateWorld(dt);
    if (G.state === 'play') updatePlayer(dt);
    if (G.state === 'play') {
      G.levelTime += dt;
      G.totalTime += dt;
      updateCamera(dt);
    }
  } else if (G.state === 'dead' || G.state === 'clear') {
    updateWorld(dt);
    if (G.state === 'dead' && G.stateT > 1.1) respawn();
  }

  if (G.L) updateParticles(dt);
  if (G.voice) {
    G.voice.t += dt;
    if (G.voice.t > G.voice.life) G.voice = null;
  }
  G.shake = Math.max(0, G.shake - dt * 40);
  G.flash = Math.max(0, G.flash - dt * 3);
}

// sierras, plataformas, prensas y bloques intermitentes (dependen solo del tiempo)
function updateMoving(L, dt) {
  for (const s of L.saws) {
    const off = s.range * (0.5 - 0.5 * Math.cos(L.time * s.speed + s.phase));
    s.x = s.bx + s.dx * off;
    s.y = s.by + s.dy * off;
  }
  const p = G.player;
  const playing = G.state === 'play' && p && dt > 0;
  for (const e of L.ents) {
    if (e.type === 'mover') {
      const off = e.range * (0.5 - 0.5 * Math.cos(L.time * e.speed + e.phase));
      const nx = e.bx + e.dx * off, ny = e.by + e.dy * off;
      e.mdx = nx - e.x;
      e.mdy = ny - e.y;
      e.x = nx;
      e.y = ny;
      if (!playing) continue;
      if (p.ground === e) {
        // te lleva encima
        p.x += e.mdx;
        p.y += e.mdy;
        if (hitsSolid(L, p, e)) { p.x -= e.mdx; }
      } else if (overlap(p, e)) {
        // te empuja
        if (e.mdy < 0 && p.y + p.h <= e.y + 12) { p.y = e.y - p.h; p.vy = 0; p.onGround = true; p.ground = e; }
        else if (e.mdy > 0 && p.y > e.y) { p.y = e.y + e.h; if (hitsSolid(L, p, e)) die('crush'); }
        else if (e.mdx !== 0) { p.x = e.mdx > 0 ? e.x + e.w : e.x - p.w; if (hitsSolid(L, p, e)) die('crush'); }
      }
    } else if (e.type === 'crusher') {
      const u = (L.time / 2.4 + e.phase) % 1;
      e.y = e.y0 + crushProfile(u) * e.range;
      e.shiver = u > 0.3 && u < 0.4;
      const down = u >= 0.5 && u < 0.65;
      if (down && !e.down && onScreen(e.x)) {
        G.shake = Math.max(G.shake, 4);
        Sfx.thud();
        dust(e.x + T / 2, e.y + T, 4);
      }
      e.down = down;
    } else if (e.type === 'blink') {
      const u = (L.time / L.blinkPeriod + (e.alt ? 0.5 : 0)) % 1;
      const on = u < 0.6;
      if (on && !e.solid && playing && overlap(p, e)) continue; // no aparece encima de ti
      e.solid = on;
      e.vis = !on ? 'off' : u > 0.45 ? 'warn' : 'on';
    }
  }
}

function updateWorld(dt) {
  const L = G.L;
  L.time += dt;
  updateMoving(L, dt);

  for (const s of L.spikes) if (s.hidden && s.popped) s.rise = Math.min(1, s.rise + dt * 14);

  for (const e of L.ents) {
    if (e.type === 'crumble') {
      if (e.timer > 0) {
        e.timer -= dt;
        if (e.timer <= 0) { e.solid = false; e.falling = true; }
      }
      if (e.falling && e.y < VH + 100) {
        e.vy = Math.min(e.vy + 1800 * dt, 900);
        e.y += e.vy * dt;
      }
    } else if (e.type === 'drop' && e.state === 'fall') {
      e.vy = Math.min(e.vy + 2600 * dt, 1100);
      e.y += e.vy * dt;
      const cx = e.x + T / 2, by = e.y + T;
      if (by > VH + 60 || isSolidAt(L, cx, by)) {
        e.state = 'gone';
        dust(cx, Math.min(by, VH), 12);
        Sfx.thud();
        G.shake = Math.max(G.shake, 5);
      }
    } else if (e.type === 'spring') {
      e.squash = Math.max(0, e.squash - dt * 5);
    } else if (e.type === 'invis') {
      e.bump = Math.max(0, e.bump - dt * 6);
    } else if (e.type === 'shooter') {
      e.timer -= dt;
      if (e.timer <= 0) {
        e.timer += L.shootEvery;
        L.arrows.push({ x: e.dir < 0 ? e.x - 12 : e.x + T + 12, y: e.y + T / 2, vx: e.dir * 320, left: ARROW_RANGE });
        if (onScreen(e.x)) Sfx.tone(700, 0.06, 'triangle', 0.04, 400);
      }
    } else if (e.type === 'fakedoor' && e.bite > 0) {
      e.bite = Math.min(1, e.bite + dt * 8);
    }
  }

  for (const a of L.arrows) {
    a.x += a.vx * dt;
    a.left -= Math.abs(a.vx) * dt;
    if (a.left <= 0) { a.dead = true; if (onScreen(a.x)) dust(a.x, a.y, 2); continue; }
    const tip = a.x + Math.sign(a.vx) * 10;
    if (tip < -40 || tip > L.pxW + 40) a.dead = true;
    else if (isSolidAt(L, tip, a.y)) { a.dead = true; if (onScreen(a.x)) dust(tip, a.y, 3); }
  }
  L.arrows = L.arrows.filter((a) => !a.dead);

  const d = L.door;
  if (d && d.moving) {
    const dist = d.tx - d.x, stepX = 650 * dt;
    d.legs += dt * 22;
    if (Math.abs(dist) <= stepX) {
      d.x = d.tx;
      d.y = d.ty;
      d.moving = false;
      dust(d.x + d.w / 2, d.y + d.h, 8);
    } else {
      d.x += Math.sign(dist) * stepX;
      const prog = (d.x - d.sx) / (d.tx - d.sx);
      d.y = d.ty - Math.sin(prog * Math.PI) * Math.min(220, Math.abs(d.tx - d.sx) * 0.3);
    }
  }

  if (L.chase && G.state === 'play' && L.time > L.chase.delay) L.chase.x += L.chase.speed * dt;

  const rv = L.rival;
  if (rv && rv.state === 'run') {
    rv.x += 300 * dt;
    rv.phase += dt * 16;
  }
}

function updatePlayer(dt) {
  const p = G.player, L = G.L, gd = p.gdir;
  const left = Input.isDown('ArrowLeft'), right = Input.isDown('ArrowRight'), held = Input.isDown('Space');
  const dir = (right ? 1 : 0) - (left ? 1 : 0);

  // horizontal
  if (dir) {
    const acc = p.onGround ? PHYS.accGround : PHYS.accAir;
    const turn = Math.sign(p.vx) === -dir ? 1.8 : 1;
    p.vx += dir * acc * turn * dt;
    p.facing = dir;
  } else {
    const fr = (p.onGround ? PHYS.fricGround : PHYS.fricAir) * dt;
    p.vx = Math.abs(p.vx) <= fr ? 0 : p.vx - Math.sign(p.vx) * fr;
  }
  p.vx = clamp(p.vx, -PHYS.run, PHYS.run);

  // salto (con gravedad invertida, "arriba" es hacia abajo)
  p.coyote = p.onGround ? PHYS.coyote : p.coyote - dt;
  p.jumpBuf -= dt;
  if (p.jumpBuf > 0 && p.coyote > 0) {
    p.vy = -PHYS.jump * gd;
    p.jumpBuf = 0;
    p.coyote = 0;
    p.onGround = false;
    p.ground = null;
    p.springing = false;
    Sfx.jump();
  }
  if (p.vy * gd >= 0) p.springing = false;
  let g = PHYS.grav;
  if (p.vy * gd < 0 && !held && !p.springing) g *= PHYS.cutGrav;
  p.vy += g * gd * dt;
  if (p.vy * gd > PHYS.maxFall) p.vy = PHYS.maxFall * gd;

  // mover X
  p.x += p.vx * dt;
  forEachSolid(L, p, (s) => {
    if (!overlap(p, s)) return;
    if (p.vx > 0) p.x = s.x - p.w;
    else if (p.vx < 0) p.x = s.x + s.w;
    if (s.type === 'invis' && !s.shown) { s.shown = true; s.bump = 1; Sfx.bonk(); }
    p.vx = 0;
  });

  // mover Y
  const wasGround = p.onGround, prevTop = p.y, prevBottom = p.y + p.h, impact = p.vy * gd;
  p.y += p.vy * dt;
  p.onGround = false;
  p.ground = null;

  // bloques invisibles: aparecen al golpearlos desde abajo
  if (p.vy < 0 && gd === 1) {
    for (const e of L.ents) {
      if (e.type === 'invis' && !e.shown && !e.faith && overlap(p, e) && prevTop >= e.y + e.h - 1) {
        e.shown = true;
        e.solid = true;
        e.bump = 1;
        Sfx.bonk();
        addText(e.x + T / 2, e.y - 4, '¡Toc!', 18);
      }
    }
  }
  forEachSolid(L, p, (s) => {
    if (!overlap(p, s)) return;
    if (p.vy > 0) p.y = s.y - p.h;
    else if (p.vy < 0) p.y = s.y + s.h;
    if (p.vy * gd > 0) { p.onGround = true; p.ground = s; }
    if (s.type === 'invis' && !s.shown) { s.shown = true; s.bump = 1; Sfx.bonk(); }
    p.vy = 0;
  });

  if (!wasGround && p.onGround && impact > 450) dust(p.x + p.w / 2, gd > 0 ? p.y + p.h : p.y, 5);

  // bloques que se desmoronan
  if (p.ground && p.ground.type === 'crumble' && p.ground.timer < 0) {
    p.ground.timer = 0.3;
    Sfx.crack();
  }

  // muelles
  if (gd === 1) {
    for (const e of L.ents) {
      if (e.type === 'spring' && p.vy >= 0 && overlap(p, e) && prevBottom <= e.y + e.h + 1) {
        p.y = e.y - p.h;
        p.vy = -PHYS.spring;
        p.springing = true;
        p.onGround = false;
        p.coyote = 0;
        e.squash = 1;
        Sfx.spring();
      }
    }
  }

  // círculos de gravedad
  let onPad = false;
  for (const e of L.ents) {
    if (e.type !== 'grav' || !overlap(p, e)) continue;
    onPad = true;
    if (!p.gravLock) {
      p.gdir *= -1;
      p.gravLock = true;
      p.vy = p.gdir * 150;
      p.onGround = false;
      p.ground = null;
      Sfx.tone(300, 0.3, 'sine', 0.08, p.gdir > 0 ? 150 : 700);
    }
  }
  if (!onPad) p.gravLock = false;

  p.phase += Math.abs(p.vx) * dt * 0.055;

  // ===== Peligros =====
  const pb = { x: p.x + 2, y: p.y + 3, w: p.w - 4, h: p.h - 4 }; // caja un poco indulgente
  const pcx = p.x + p.w / 2;

  for (const s of L.spikes) {
    if (s.hidden && !s.popped) {
      if (Math.abs(pcx - (s.x + T / 2)) < 46 && p.y + p.h > s.y - 50 && p.y < s.y + T) {
        s.popped = true;
        Sfx.trap();
      }
      continue;
    }
    if (s.rise < 0.5) continue;
    const h = 14 * s.rise;
    const box = s.ceil ? { x: s.x + 4, y: s.y, w: T - 8, h: 14 } : { x: s.x + 4, y: s.y + T - h, w: T - 8, h };
    if (overlap(pb, box)) return die('spike');
  }

  for (const s of L.saws) {
    const nx = clamp(s.x, pb.x, pb.x + pb.w), ny = clamp(s.y, pb.y, pb.y + pb.h);
    if ((nx - s.x) ** 2 + (ny - s.y) ** 2 < (s.r * 0.85) ** 2) return die('saw');
  }

  for (const a of L.arrows) {
    if (overlap(pb, { x: a.x - 10, y: a.y - 3, w: 20, h: 6 })) return die('arrow');
  }

  for (const e of L.ents) {
    if (e.type === 'drop' && e.state !== 'gone') {
      if (e.state === 'idle' && pcx > e.x - 70 && pcx < e.x + T + 30 && p.y > e.y) {
        e.state = 'fall';
        Sfx.trap();
      }
      if (overlap(pb, { x: e.x + 6, y: e.y + 4, w: T - 12, h: T - 4 })) return die('drop');
    } else if (e.type === 'crusher') {
      if (overlap(pb, { x: e.x + 3, y: e.y + 2, w: T - 6, h: T - 2 })) return die('crush');
    } else if (e.type === 'fakedoor') {
      if (overlap(pb, { x: e.x + 6, y: e.y + 10, w: e.w - 12, h: e.h - 10 })) {
        e.bite = 0.01;
        return die('door');
      }
    }
  }

  if (gd === 1 && p.y > VH + 40) return die('fall');
  if (gd === -1 && p.y + p.h < -40) return die('up');
  if (L.chase && p.x < L.chase.x + 4) return die('chase');

  // frases del Conde
  (L.def.taunts || []).forEach((tn, i) => {
    if (!G.tauntsDone.has(i) && pcx > tn.c * T) {
      G.tauntsDone.add(i);
      say(tn.text, tn.who);
    }
  });

  // el Conde huye al verte llegar
  const rv = L.rival;
  if (rv && rv.state === 'idle' && rv.x - pcx < 260) {
    rv.state = 'run';
    say('¡NOOO! ¡Mi princesa! ¡Me voy, pero volveré!');
  }

  // puerta / jaula
  const d = L.door;
  if (d && !d.moving) {
    const dcx = d.x + d.w / 2;
    if (d.flee.length && Math.abs(pcx - dcx) < 95 && Math.abs(p.y + p.h - (d.y + d.h)) < 90) {
      const n = d.flee.shift();
      d.sx = d.x;
      d.tx = n.x;
      d.ty = n.y;
      d.moving = true;
      addText(dcx, d.y - 24, pick(['¡Ja!', '¡Por aquí no!', '¡Pillado!... no.', '¡Adiós!']), 24);
      Sfx.taunt();
    } else if (!d.flee.length && overlap(pb, { x: d.x + 6, y: d.y + 10, w: d.w - 12, h: d.h - 10 })) {
      win();
    }
  }
}

function updateCamera(dt) {
  const p = G.player;
  const target = p.x + p.w / 2 - VW / 2 + p.facing * 50;
  G.cam += (target - G.cam) * Math.min(1, dt * 5);
  G.cam = clamp(G.cam, 0, Math.max(0, G.L.pxW - VW));
}

// ===== Partículas =====
function dust(x, y, n = 6) {
  for (let i = 0; i < n; i++) {
    G.particles.push({
      type: 'dust', x, y, vx: (Math.random() - 0.5) * 140, vy: -Math.random() * 90,
      t: 0, life: 0.35 + Math.random() * 0.3, r: 2 + Math.random() * 3,
    });
  }
}

function spawnLimbs(p) {
  const cx = p.x + p.w / 2, top = p.y;
  const parts = [
    { k: 'head', x: cx, y: top + 4 },
    { k: 'hat', x: cx, y: top - 8 },
    { k: 'seg', len: 14, x: cx, y: top + 20 },
    { k: 'seg', len: 13, x: cx - 4, y: top + 16 },
    { k: 'seg', len: 13, x: cx + 4, y: top + 16 },
    { k: 'seg', len: 17, x: cx - 3, y: top + 32 },
    { k: 'seg', len: 17, x: cx + 3, y: top + 32 },
  ];
  for (const part of parts) {
    G.particles.push(Object.assign(part, {
      type: 'limb', vx: (Math.random() - 0.5) * 460, vy: -250 - Math.random() * 380,
      a: Math.random() * 6, va: (Math.random() - 0.5) * 22, t: 0, life: 99,
    }));
  }
  dust(cx, top + 20, 10);
}

function addText(x, y, text, size = 22) {
  G.texts.push({ x, y, text, size, t: 0, life: 1.3 });
}

function updateParticles(dt) {
  const L = G.L;
  for (const q of G.particles) {
    q.t += dt;
    if (q.type === 'dust') {
      q.vy += 200 * dt;
    } else if (q.type === 'limb') {
      q.vy += 1800 * dt;
      q.a += q.va * dt;
      if (q.vy > 0 && isSolidAt(L, q.x, q.y + 4)) {
        q.y = Math.floor((q.y + 4) / T) * T - 4;
        q.vy *= -0.35;
        q.vx *= 0.6;
        q.va *= 0.6;
      }
    } else if (q.type === 'confetti') {
      q.vy += 500 * dt;
      q.vx *= 1 - dt;
      q.a += q.va * dt;
    }
    q.x += q.vx * dt;
    q.y += q.vy * dt;
  }
  G.particles = G.particles.filter((q) => q.t < q.life && q.y < VH + 200);
  for (const s of G.texts) s.t += dt;
  G.texts = G.texts.filter((s) => s.t < s.life);
}

// ===== Dibujo del juego =====
function render() {
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  const t = G.t;
  switch (G.state) {
    case 'title': drawTitle(t); break;
    case 'story': drawStory(t); break;
    case 'intro': drawIntro(t); break;
    case 'ending': drawEnding(t); break;
    case 'fin': drawFin(t); break;
    default:
      drawGame();
      if (G.state === 'clear') drawClearOverlay(t);
  }
}

function drawGame() {
  const L = G.L, cam = G.cam;
  paperBackground(40 - cam);

  const sx = (Math.random() - 0.5) * G.shake, sy = (Math.random() - 0.5) * G.shake;
  ctx.save();
  ctx.translate(-Math.round(cam) + sx, sy);

  for (const c of L.clouds) {
    const x = c.x + cam * 0.6;
    if (x - cam > -120 && x - cam < VW + 60) Draw.cloud(ctx, x, c.y, c.s);
  }
  for (const s of L.signs) if (s.x - cam > -200 && s.x - cam < VW + 200) Draw.sign(ctx, s.x, s.y, s.text);

  drawTiles(L, cam);
  drawEntities(L);
  for (const s of L.spikes) {
    if (s.x < cam - T || s.x > cam + VW) continue;
    if (s.ceil) Draw.ceilSpikes(ctx, s.x, s.y);
    else Draw.spikes(ctx, s.x, s.y, s.rise);
  }
  for (const s of L.saws) {
    if (s.range > 0) {
      ctx.setLineDash([4, 6]);
      ctx.strokeStyle = 'rgba(43,38,34,0.3)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(s.bx, s.by);
      ctx.lineTo(s.bx + s.dx * s.range, s.by + s.dy * s.range);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    Draw.saw(ctx, s.x, s.y, s.r, L.time * 9);
  }
  for (const a of L.arrows) if (onScreen(a.x)) Draw.arrow(ctx, a.x, a.y, Math.sign(a.vx));

  const d = L.door;
  if (d && d.cage) Draw.cage(ctx, d.x, d.y, d.w, d.h, G.t, G.state === 'clear');
  else if (d) Draw.door(ctx, d.x, d.y - (d.moving ? 10 : 0), d.w, d.h, d.moving ? d.legs : null);

  const rv = L.rival;
  if (rv && rv.x < L.pxW + 60) {
    Draw.rival(ctx, rv.x, rv.y, rv.state === 'run'
      ? { t: G.t, phase: rv.phase, speed: 1, facing: 1, pose: 'cheer' }
      : { t: G.t, facing: -1, pose: 'laugh' });
  }

  const p = G.player;
  if (G.state === 'play' && !p.hidden) {
    const o = {
      facing: p.facing, phase: p.phase, speed: Math.abs(p.vx) / PHYS.run,
      air: !p.onGround, vy: p.vy * p.gdir, t: G.t,
    };
    if (p.gdir < 0) {
      ctx.save();
      ctx.translate(p.x + p.w / 2, p.y + p.h / 2);
      ctx.scale(1, -1);
      Draw.hero(ctx, 0, p.h / 2, o);
      ctx.restore();
    } else {
      Draw.hero(ctx, p.x + p.w / 2, p.y + p.h, o);
    }
  }
  if (G.state === 'clear' && d && d.cage) {
    Draw.hero(ctx, d.x - 20, d.y + d.h, { t: G.t, pose: 'cheer', grin: true });
    Draw.princess(ctx, d.x + d.w / 2, d.y + d.h, { t: G.t, facing: -1 });
  }

  if (L.chase) Draw.chaseWall(ctx, L.chase.x, cam - 20);

  drawParticles();
  for (const s of G.texts) {
    ctx.globalAlpha = 1 - s.t / s.life;
    // los textos flotantes nunca se salen de la pantalla
    ctx.font = Draw.font(s.size);
    const half = ctx.measureText(s.text).width / 2 + 6;
    const x = clamp(s.x, cam + half, cam + VW - half);
    const y = Math.max(80, s.y - s.t * 35);
    Draw.text(ctx, s.text, x, y, s.size, COL.rival);
    ctx.globalAlpha = 1;
  }
  ctx.restore();

  if (L.chase && L.chase.x < cam - 20 && G.state === 'play') {
    const dist = Math.round((G.player.x - L.chase.x) / T);
    Draw.text(ctx, `◄ muro a ${dist} pasos`, 16, 92, 20, '#8e2b2b', 'left');
  }

  drawHUD();
  drawVoice();

  if (G.flash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${G.flash * 0.6})`;
    ctx.fillRect(0, 0, VW, VH);
  }
  if (G.state === 'dead' && G.stateT > 0.12) {
    ctx.save();
    ctx.translate(VW / 2, 220);
    ctx.rotate(-0.04);
    const s = Math.min(1, (G.stateT - 0.12) * 8);
    ctx.scale(s, s);
    Draw.wrap(ctx, G.deathMsg, 0, 0, 760, 46, 50, COL.hero);
    ctx.restore();
    Draw.text(ctx, `Muerte nº ${G.deaths}`, VW / 2, 268, 22, '#6b5f55');
  }
  if (G.paused) {
    ctx.fillStyle = 'rgba(247,241,225,0.85)';
    ctx.fillRect(0, 0, VW, VH);
    Draw.wobblyText(ctx, 'PAUSA', VW / 2, 220, 64, INK, G.t);
    Draw.text(ctx, 'ESC — seguir jugando', VW / 2, 290, 26);
    Draw.text(ctx, 'R — reiniciar nivel (cuenta como muerte)', VW / 2, 326, 22, '#6b5f55');
    Draw.text(ctx, 'Q — volver al título', VW / 2, 358, 22, '#6b5f55');
  }
}

// Lo que dice el Conde (o la princesa) aparece arriba a la izquierda con su retrato
function drawVoice() {
  const v = G.voice;
  if (!v || G.paused) return;
  const a = Math.min(1, v.t * 6, (v.life - v.t) * 4);
  ctx.save();
  ctx.globalAlpha = Math.max(0, a);
  const px = 46, py = 200;
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.beginPath();
  ctx.arc(px, py - 32, 34, 0, Math.PI * 2);
  ctx.fill();
  if (v.who === 'princess') Draw.princess(ctx, px, py, { t: G.t, scale: 1.3 });
  else Draw.rival(ctx, px, py, { t: G.t, scale: 1.3, pose: 'laugh' });
  Draw.bubble(ctx, px + 18, py - 66, v.text, 20, 400);
  ctx.restore();
}

function drawTiles(L, cam) {
  const c0 = Math.max(0, Math.floor(cam / T) - 1), c1 = Math.min(L.W - 1, Math.ceil((cam + VW) / T) + 1);
  const mass = (c, r) => (c < 0 || c >= L.W || r >= ROWS || r < 0 ? r >= 0 || L.grid[0][clamp(c, 0, L.W - 1)] === 1 : isMassTile(L.grid[r][c]));

  // relleno
  ctx.fillStyle = COL.ground;
  for (let r = 0; r < ROWS; r++) {
    for (let c = c0; c <= c1; c++) if (isMassTile(L.grid[r][c])) ctx.fillRect(c * T, r * T, T + 0.6, T + 0.6);
  }
  ctx.fillStyle = COL.block;
  for (let r = 0; r < ROWS; r++) {
    for (let c = c0; c <= c1; c++) {
      const g = L.grid[r][c];
      if (g === 2 || g === 4) ctx.fillRect(c * T, r * T, T, T);
    }
  }

  // tramado interior del suelo (estable, no tiembla)
  ctx.beginPath();
  for (let r = 0; r < ROWS; r++) {
    for (let c = c0; c <= c1; c++) {
      if (!isMassTile(L.grid[r][c])) continue;
      const h = Draw.hash(c, r, 99);
      if (h < 0.55) continue;
      const x = c * T + 6 + h * 12, y = r * T + 10 + Draw.hash(r, c, 7) * 12;
      ctx.moveTo(x, y + 6);
      ctx.lineTo(x + 7, y);
    }
  }
  ctx.strokeStyle = COL.hatch;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // contornos
  ctx.beginPath();
  for (let r = 0; r < ROWS; r++) {
    for (let c = c0; c <= c1; c++) {
      const g = L.grid[r][c], x = c * T, y = r * T;
      if (isMassTile(g)) {
        if (!mass(c, r - 1)) Draw.seg(ctx, x, y, x + T, y);
        if (!mass(c, r + 1)) Draw.seg(ctx, x, y + T, x + T, y + T);
        if (!mass(c - 1, r)) Draw.seg(ctx, x, y, x, y + T);
        if (!mass(c + 1, r)) Draw.seg(ctx, x + T, y, x + T, y + T);
      } else if (g === 2 || g === 4) {
        Draw.rect(ctx, x, y, T, T);
      }
    }
  }
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.4;
  ctx.stroke();

  // detalle de ladrillo en bloques
  ctx.beginPath();
  for (let r = 0; r < ROWS; r++) {
    for (let c = c0; c <= c1; c++) {
      const g = L.grid[r][c];
      if (g !== 2 && g !== 4) continue;
      const x = c * T, y = r * T;
      ctx.moveTo(x + 3, y + T / 2);
      ctx.lineTo(x + T - 3, y + T / 2);
      ctx.moveTo(x + T / 2, y + 3);
      ctx.lineTo(x + T / 2, y + T / 2);
    }
  }
  ctx.strokeStyle = COL.blockLine;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // hierba (solo en suelo con cielo encima)
  ctx.beginPath();
  for (let r = 0; r < ROWS; r++) {
    for (let c = c0; c <= c1; c++) {
      if (!isMassTile(L.grid[r][c]) || (r > 0 && isMassTile(L.grid[r - 1][c])) || r < 3) continue;
      const y = r * T;
      for (let k = 0; k < 3; k++) {
        const px = c * T + 5 + k * 10 + Draw.hash(c, k, 5) * 4;
        ctx.moveTo(px - 3, y);
        ctx.lineTo(px - 1, y - 5);
        ctx.moveTo(px + 1, y);
        ctx.lineTo(px + 3, y - 4);
      }
    }
  }
  ctx.strokeStyle = COL.grass;
  ctx.lineWidth = 1.6;
  ctx.stroke();
}

function drawEntities(L) {
  for (const e of L.ents) {
    if (e.x + (e.w || T) < G.cam - 40 || e.x > G.cam + VW + 40) continue;
    if (e.type === 'crumble') {
      if (e.y > VH + 40) continue;
      const shake = e.timer > 0 ? Math.sin(G.t * 90) * 2 : 0;
      const x = e.x + shake, y = e.y;
      ctx.fillStyle = COL.block;
      ctx.fillRect(x, y, T, T);
      ctx.beginPath();
      Draw.rect(ctx, x, y, T, T);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2.4;
      ctx.stroke();
      // grietas (la única pista)
      ctx.beginPath();
      ctx.moveTo(x + 8, y + 2);
      ctx.lineTo(x + 12, y + 10);
      ctx.lineTo(x + 9, y + 16);
      ctx.moveTo(x + 22, y + T - 2);
      ctx.lineTo(x + 19, y + T - 9);
      ctx.strokeStyle = COL.blockLine;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else if (e.type === 'invis') {
      if (!e.shown) continue;
      const y = e.y - e.bump * 6;
      ctx.fillStyle = '#f7e3b5';
      ctx.fillRect(e.x, y, T, T);
      ctx.beginPath();
      Draw.rect(ctx, e.x, y, T, T);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2.4;
      ctx.stroke();
      Draw.text(ctx, e.faith ? ':)' : ':P', e.x + T / 2, y + 21, 18, COL.rival);
    } else if (e.type === 'drop') {
      if (e.state !== 'gone') Draw.dropSpike(ctx, e.x, e.y);
    } else if (e.type === 'spring') {
      Draw.spring(ctx, e.x, e.y, e.w, e.squash);
    } else if (e.type === 'crusher') {
      Draw.crusher(ctx, e.x, e.y0, e.y, e.shiver);
    } else if (e.type === 'blink') {
      Draw.blink(ctx, e.x, e.y, e.vis, e.alt);
    } else if (e.type === 'shooter') {
      Draw.shooter(ctx, e.x, e.y, e.dir);
    } else if (e.type === 'grav') {
      Draw.gravPad(ctx, e.x, e.y, G.t, e.y < VH / 2 ? false : true);
    } else if (e.type === 'fakedoor') {
      Draw.door(ctx, e.x, e.y, e.w, e.h, null, e.bite);
    } else if (e.type === 'mover') {
      Draw.platform(ctx, e.x, e.y, e.w, e.h);
    }
  }
}

function drawParticles() {
  for (const q of G.particles) {
    if (q.type === 'dust') {
      ctx.globalAlpha = 1 - q.t / q.life;
      ctx.beginPath();
      ctx.arc(q.x, q.y, q.r, 0, Math.PI * 2);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.globalAlpha = 1;
    } else if (q.type === 'limb') {
      ctx.save();
      ctx.translate(q.x, q.y);
      ctx.rotate(q.a);
      ctx.strokeStyle = INK;
      ctx.lineCap = 'round';
      if (q.k === 'head') {
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.arc(0, 0, 7, 0, Math.PI * 2);
        ctx.fillStyle = PAPER;
        ctx.fill();
        ctx.stroke();
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(1, -3); ctx.lineTo(5, 1); ctx.moveTo(5, -3); ctx.lineTo(1, 1); // ojo en X
        ctx.stroke();
      } else if (q.k === 'hat') {
        ctx.fillStyle = INK;
        ctx.fillRect(-5.5, -11, 11, 11);
        ctx.fillRect(-9, -1, 18, 2.6);
        ctx.fillStyle = COL.hero;
        ctx.fillRect(-5.5, -4, 11, 2.6);
      } else {
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.moveTo(0, -q.len / 2);
        ctx.lineTo(0, q.len / 2);
        ctx.stroke();
      }
      ctx.restore();
    } else if (q.type === 'confetti') {
      ctx.save();
      ctx.translate(q.x, q.y);
      ctx.rotate(q.a);
      ctx.globalAlpha = Math.max(0, 1 - q.t / q.life);
      ctx.fillStyle = q.color;
      ctx.fillRect(-4, -2, 8, 4);
      ctx.restore();
    }
  }
}

function drawHUD() {
  const lv = LEVELS[G.levelIndex];
  ctx.fillStyle = 'rgba(247,241,225,0.75)';
  ctx.fillRect(0, 0, VW, 44);
  Draw.text(ctx, `Nivel ${G.levelIndex + 1}/${TOTAL_LEVELS} · ${lv.name}`, 16, 32, 24, INK, 'left');
  Draw.skull(ctx, VW - 110, 24, 1.1);
  Draw.text(ctx, `× ${G.deaths}`, VW - 92, 33, 26, INK, 'left');
  Draw.text(ctx, fmtTime(G.levelTime), VW - 16, 66, 20, '#6b5f55', 'right');
  Draw.text(ctx, 'R reiniciar · ESC pausa', VW - 16, VH - 12, 15, 'rgba(43,38,34,0.45)', 'right');
}

// ===== Arranque =====
function resize() {
  const s = Math.min(innerWidth / VW, innerHeight / VH);
  const cw = Math.floor(VW * s), ch = Math.floor(VH * s);
  canvas.style.width = cw + 'px';
  canvas.style.height = ch + 'px';
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(cw * dpr);
  canvas.height = Math.round(ch * dpr);
  scale = canvas.width / VW;
}

const STEP = 1 / 120;
let last = performance.now(), acc = 0;

function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  Draw.boil = Math.floor(now / 140) % 4;
  handleInput();
  acc += dt;
  while (acc >= STEP) { step(STEP); acc -= STEP; }
  render();
  Input.endFrame();
  requestAnimationFrame(frame);
}

G.save = loadSave();
Input.init();
addEventListener('resize', resize);
addEventListener('blur', () => { if (G.state === 'play') G.paused = true; });
resize();

// Atajos de desarrollo para ver una pantalla concreta:
// index.html#story=2, #intro=4, #play=3@40 (nivel 4, columna 40), #clear=2, #ending=1, #fin
(function devJump() {
  const m = location.hash.match(/^#(\w+)(?:=(\d+))?(?:@(\d+))?/);
  if (!m) return;
  const [, st, a, b] = m, n = +(a || 0);
  if (st === 'story') { G.storyPage = n; setState('story'); }
  else if (st === 'intro') { G.levelIndex = n; setState('intro'); }
  else if (st === 'ending') { G.endingPage = n; setState('ending'); }
  else if (st === 'fin') setState('fin');
  else if (st === 'play' || st === 'clear') {
    G.levelIndex = n;
    resetLevel();
    if (b) {
      G.player.x = +b * T;
      G.player.y = 0;
      while (G.player.y < VH && !hitsSolid(G.L, { x: G.player.x, y: G.player.y + 1, w: 16, h: 40 })) G.player.y += 5;
      G.cam = clamp(G.player.x - VW / 2, 0, Math.max(0, G.L.pxW - VW));
    }
    setState('play');
    if (st === 'clear') { win(); G.stateT = 5; }
  }
})();

requestAnimationFrame(frame);
