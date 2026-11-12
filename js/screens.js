'use strict';

// ===== Historia de introducción =====
const STORY = [
  { text: 'Había una vez un malvado. Un malvado MUY malvado.\nEse malvado eres tú.', scene: 'villain' },
  { text: 'Llevabas meses tramando el plan perfecto:\nsecuestrar a la Princesa Petunia.', scene: 'plan' },
  { text: 'Pero el gran día, al llegar al castillo...\n¡el Conde Cuernos se te había adelantado!', scene: 'stolen' },
  { text: 'Se la llevó a su guarida, al otro lado de\n10 niveles repletos de trampas.', scene: 'path' },
  { text: 'Solo queda una cosa por hacer:\nrescatarla... para poder secuestrarla tú.', scene: 'resolve' },
];

// ===== Final =====
const ENDING = [
  { text: 'Tras mil trampas, por fin llegaste a la jaula.\nEl Conde Cuernos huyó llorando.', scene: 'cage' },
  { text: 'La rescataste... y, como buen malvado,\nla secuestraste en el acto.', scene: 'kidnap' },
  { text: 'La princesa suspiró. Era su tercer secuestro de la semana.', scene: 'twist' },
];

function paperBackground(marginX = 70) {
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, VW, VH);
  ctx.strokeStyle = 'rgba(90,140,200,0.2)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let y = 64; y < VH; y += 32) { ctx.moveTo(0, y + 0.5); ctx.lineTo(VW, y + 0.5); }
  ctx.stroke();
  if (marginX !== null && marginX > -10 && marginX < VW + 10) {
    ctx.strokeStyle = 'rgba(220,80,80,0.35)';
    ctx.beginPath();
    ctx.moveTo(marginX, 0);
    ctx.lineTo(marginX, VH);
    ctx.stroke();
  }
}

function groundLine(y) {
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  Draw.seg(ctx, 40, y, 480, y, 1.5);
  Draw.seg(ctx, 480, y, 920, y, 1.5);
  ctx.stroke();
}

function blink(t) { return Math.floor(t * 2) % 2 === 0; }

// Altura de la cabeza (sombrero incluido) de un monigote a una escala dada
const headTop = (feetY, s) => feetY - 58 * s;

// Monigote llevando a la princesa en brazos por encima de la cabeza
function carrying(drawCarrier, x, gy, s, t, o = {}) {
  drawCarrier(ctx, x, gy, Object.assign({ scale: s, t, phase: t * 14, speed: 1, pose: 'carry' }, o));
  ctx.save();
  ctx.translate(x, gy - s * 58);
  ctx.rotate(-Math.PI / 2);
  Draw.princess(ctx, 0, 22 * (s / 2.2), { scale: s * 0.9, t, facing: -1, pose: 'cheer' });
  ctx.restore();
}

// ===== Título =====
function drawTitle(t) {
  paperBackground();
  Draw.wobblyText(ctx, '¡ESA PRINCESA', VW / 2, 100, 64, INK, t);
  Draw.wobblyText(ctx, 'ES MÍA!', VW / 2, 168, 74, COL.hero, t + 1);
  Draw.text(ctx, '10 niveles · cero enemigos · demasiadas trampas', VW / 2, 206, 22, '#6b5f55');

  const gy = 405, s = 2;
  groundLine(gy);
  Draw.hero(ctx, 300, gy, { scale: s, t, facing: 1, grin: true, brows: true });
  Draw.princess(ctx, 640, gy, { scale: s, t, facing: -1 });
  Draw.rival(ctx, 720, gy, { scale: s, t, facing: -1, pose: 'laugh' });
  Draw.bubble(ctx, 300, headTop(gy, s) - 4, 'Esa princesa es MÍA', 20);
  Draw.bubble(ctx, 720, headTop(gy, s) - 4, '¡Jo, jo, jo!', 20);

  if (blink(t)) Draw.text(ctx, 'Pulsa ESPACIO para empezar', VW / 2, 452, 30);
  const sv = G.save;
  if (sv && sv.level > 0 && sv.level < LEVELS.length) {
    Draw.text(ctx, `C — continuar en el nivel ${sv.level + 1} (${sv.deaths} muertes)`, VW / 2, 486, 22, COL.hero);
  } else if (sv && typeof sv.best === 'number') {
    Draw.text(ctx, `Récord: juego completado con ${sv.best} muertes`, VW / 2, 486, 22, COL.rival);
  }
  Draw.text(ctx, '← → moverse · ESPACIO saltar · R reiniciar · ESC pausa · M sonido · H ayuda · T temblor', VW / 2, 522, 17, '#6b5f55');
}

// ===== Historia =====
function drawStory(t) {
  paperBackground();
  const page = STORY[G.storyPage];
  ctx.save();
  drawScene(page.scene, G.stateT);
  ctx.restore();
  drawCaption(page.text, G.storyPage, STORY.length, t, 'ESPACIO para seguir · ESC para saltar');
}

function drawCaption(text, page, total, t, hint) {
  Draw.wrap(ctx, text, VW / 2, 410, 820, 28, 34);
  for (let i = 0; i < total; i++) {
    ctx.beginPath();
    ctx.arc(VW / 2 - (total - 1) * 10 + i * 20, 490, 4, 0, Math.PI * 2);
    ctx.fillStyle = i === page ? INK : 'rgba(43,38,34,0.25)';
    ctx.fill();
  }
  if (blink(t)) Draw.text(ctx, hint, VW / 2, 522, 18, '#6b5f55');
}

function drawScene(name, t) {
  const gy = 340;
  if (name === 'villain') {
    groundLine(gy);
    Draw.hero(ctx, VW / 2, gy, { scale: 3, t, grin: true, brows: true });
    if (t > 0.3) Draw.bubble(ctx, VW / 2 + 30, headTop(gy, 3) - 4, 'Muajajajá', 24);
  } else if (name === 'plan') {
    groundLine(gy);
    Draw.hero(ctx, 230, gy, { scale: 2.4, t, brows: true });
    ctx.save();
    ctx.translate(500, 170);
    ctx.rotate(-0.03);
    ctx.fillStyle = '#fff';
    ctx.fillRect(-140, -70, 280, 150);
    ctx.beginPath();
    Draw.rect(ctx, -140, -70, 280, 150, 1.5);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.4;
    ctx.stroke();
    Draw.text(ctx, 'EL PLAN', 0, -42, 24);
    Draw.princess(ctx, -80, 50, { scale: 1.3, t: 0 });
    ctx.beginPath();
    ctx.moveTo(-50, 20); ctx.lineTo(40, 20); ctx.lineTo(30, 12); ctx.moveTo(40, 20); ctx.lineTo(30, 28);
    ctx.stroke();
    Draw.text(ctx, '¡MÍA!', 85, 30, 30, COL.hero);
    ctx.restore();
    Draw.princess(ctx, 770, gy, { scale: 2.4, t, facing: -1 });
  } else if (name === 'stolen') {
    groundLine(gy);
    const x = 400 + Math.min(t * 140, 380);
    ctx.strokeStyle = 'rgba(43,38,34,0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 3; i++) { ctx.moveTo(x - 70 - i * 10, gy - 30 - i * 25); ctx.lineTo(x - 120 - i * 10, gy - 30 - i * 25); }
    ctx.stroke();
    carrying(Draw.rival.bind(Draw), x, gy, 2.2, t, { grin: true });
    Draw.bubble(ctx, x, gy - 2.2 * 58 - 40, '¡Socorro!', 20);
    Draw.hero(ctx, 170, gy, { scale: 2.4, t, facing: 1 });
    if (t > 0.4) Draw.bubble(ctx, 175, headTop(gy, 2.4) - 4, '¿¡EH!?', 24);
  } else if (name === 'path') {
    const pts = [];
    for (let i = 0; i < 10; i++) pts.push([130 + i * 78, 280 - Math.sin(i * 0.9) * 50 - i * 12]);
    ctx.setLineDash([8, 8]);
    ctx.strokeStyle = 'rgba(43,38,34,0.6)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
    ctx.stroke();
    ctx.setLineDash([]);
    pts.forEach(([px, py], i) => {
      ctx.beginPath();
      ctx.arc(px, py, 15, 0, Math.PI * 2);
      ctx.fillStyle = i < 9 ? '#fff' : COL.gold;
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.stroke();
      Draw.text(ctx, String(i + 1), px, py + 7, 18);
      if (i > 0 && i < 9 && Math.floor(t * 3) % 9 === i) Draw.skull(ctx, px, py - 30, 0.9);
    });
    const [cx, cy] = pts[9];
    ctx.fillStyle = '#d8d0c4';
    ctx.fillRect(cx - 30, cy - 95, 60, 60);
    ctx.beginPath();
    Draw.rect(ctx, cx - 30, cy - 95, 60, 60, 1);
    for (let i = 0; i < 3; i++) Draw.rect(ctx, cx - 30 + i * 22, cy - 107, 16, 12, 0.6);
    ctx.lineWidth = 2;
    ctx.stroke();
    Draw.rival(ctx, cx - 60, cy - 18, { scale: 1.2, t, facing: -1, pose: 'laugh' });
    Draw.princess(ctx, cx + 5, cy - 60, { scale: 0.9, t, facing: -1 });
    Draw.hero(ctx, pts[0][0] - 50, pts[0][1] + 15, { scale: 1.4, t });
  } else if (name === 'resolve') {
    groundLine(gy);
    Draw.hero(ctx, VW / 2, gy, { scale: 3, t, pose: 'cheer', brows: true, grin: true });
    if (t > 0.3) Draw.bubble(ctx, VW / 2, headTop(gy, 3) - 4, '¡Esa princesa es MÍA!', 26);
  } else if (name === 'cage') {
    groundLine(gy);
    Draw.cage(ctx, 470, gy - 2.2 * 64, 2.2 * 50, 2.2 * 64, t, true);
    Draw.princess(ctx, 525, gy, { scale: 2.2, t, facing: -1 });
    Draw.hero(ctx, 330, gy, { scale: 2.4, t, grin: true, brows: true });
    Draw.bubble(ctx, 330, headTop(gy, 2.4) - 4, 'Hola, princesa', 22);
    const rx = 760 + Math.min(t * 120, 200);
    Draw.rival(ctx, rx, gy, { scale: 2, t, phase: t * 14, speed: 1, pose: 'cheer' });
    if (rx < VW + 20) Draw.bubble(ctx, rx, headTop(gy, 2) - 4, '¡Buaaa! ¡No es justo!', 20);
  } else if (name === 'kidnap') {
    groundLine(gy);
    const x = 300 + Math.min(t * 150, 360);
    carrying(Draw.hero.bind(Draw), x, gy, 2.2, t, { grin: true });
    Draw.bubble(ctx, x, gy - 2.2 * 58 - 40, '¡Por fin es MÍA!', 22);
  } else if (name === 'twist') {
    groundLine(gy);
    Draw.hero(ctx, 330, gy, { scale: 2.4, t, facing: 1 });
    Draw.princess(ctx, 600, gy, { scale: 2.4, t, facing: -1 });
    Draw.bubble(ctx, 600, headTop(gy, 2.4) - 4, '¿Me dejas en casa antes de cenar? Mañana me secuestra un dragón.', 20, 300);
    if (t > 1.2) Draw.bubble(ctx, 330, headTop(gy, 2.4) - 4, '...Vale.', 22);
  }
}

// ===== Cartel de inicio de nivel =====
function drawIntro(t) {
  paperBackground();
  const lv = LEVELS[G.levelIndex];
  Draw.wobblyText(ctx, `NIVEL ${G.levelIndex + 1}`, VW / 2, 92, 58, INK, t);
  Draw.text(ctx, lv.name, VW / 2, 138, 32, COL.hero);

  // nota del Conde: la altura se adapta al texto
  const lines = Draw.lines(ctx, `«${lv.taunt}»`, 470, 25);
  const noteH = 110 + lines.length * 30;
  ctx.save();
  ctx.translate(420, 175 + noteH / 2);
  ctx.rotate(-0.02);
  ctx.fillStyle = COL.note;
  ctx.shadowColor = 'rgba(0,0,0,0.15)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 4;
  ctx.fillRect(-270, -noteH / 2, 540, noteH);
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = 'rgba(240,220,140,0.7)';
  ctx.fillRect(-40, -noteH / 2 - 12, 80, 22); // celo
  const top = -noteH / 2;
  Draw.text(ctx, 'Nota del Conde Cuernos:', -245, top + 36, 20, '#8a7e72', 'left');
  lines.forEach((l, i) => Draw.text(ctx, l, 0, top + 74 + i * 30, 25));
  Draw.text(ctx, '— C. C.', 245, noteH / 2 - 16, 22, COL.rival, 'right');
  ctx.restore();

  Draw.rival(ctx, 820, 430, { scale: 2, t, facing: -1, pose: 'laugh' });

  if (G.deaths > 0) Draw.text(ctx, `Muertes acumuladas: ${G.deaths}`, VW / 2, 475, 20, '#6b5f55');
  if (blink(t)) Draw.text(ctx, 'ESPACIO para empezar', VW / 2, 515, 28);
}

// ===== Nivel superado (encima del juego) =====
function drawClearOverlay(t) {
  const a = Math.min(1, G.stateT * 3);
  ctx.fillStyle = `rgba(247,241,225,${0.85 * a})`;
  ctx.fillRect(0, 0, VW, VH);
  if (a < 1) return;
  const final = G.L.door && G.L.door.cage;
  Draw.wobblyText(ctx, final ? '¡La princesa es TUYA!' : '¡Nivel superado!', VW / 2, 120, 56, COL.hero, t);
  const d = G.levelDeaths;
  Draw.text(ctx, `Muertes en este nivel: ${d}`, VW / 2, 190, 28);
  Draw.text(ctx, `Tiempo: ${fmtTime(G.levelTime)}`, VW / 2, 226, 28);
  Draw.text(ctx, `Muertes totales: ${G.deaths}`, VW / 2, 260, 24, '#6b5f55');
  const quip =
    d === 0 ? '¿Cero muertes? ¿Seguro que no has hecho trampa?' :
    d < 5 ? 'Nada mal para un malvado de segunda.' :
    d < 15 ? 'La princesa empieza a impacientarse.' :
    d < 40 ? 'El Conde Cuernos se está partiendo de risa.' :
             'Quizá lo tuyo no sea el secuestro...';
  // la frase va en su propia franja; el monigote celebra debajo sin taparla
  Draw.wrap(ctx, quip, VW / 2, 310, 800, 24, 30, COL.rival);
  Draw.hero(ctx, VW / 2, 478, { scale: 1.5, t, pose: 'cheer', grin: true });
  if (G.stateT > 0.6 && blink(t)) Draw.text(ctx, 'ESPACIO para continuar', VW / 2, 510, 26);
}

// ===== Final =====
function drawEnding(t) {
  paperBackground();
  const page = ENDING[G.endingPage];
  ctx.save();
  drawScene(page.scene, G.stateT);
  ctx.restore();
  drawCaption(page.text, G.endingPage, ENDING.length, t, 'ESPACIO para seguir');
}

function rankFor(deaths) {
  if (deaths <= 20) return 'Archimalvado legendario';
  if (deaths <= 60) return 'Malvado profesional';
  if (deaths <= 150) return 'Malvado de andar por casa';
  return 'Becario del mal';
}

function drawFin(t) {
  paperBackground();
  Draw.wobblyText(ctx, 'FIN', VW / 2, 110, 90, COL.hero, t);
  Draw.text(ctx, '...hasta el próximo secuestro', VW / 2, 150, 24, '#6b5f55');
  Draw.text(ctx, `Muertes totales: ${G.deaths}`, VW / 2, 215, 32);
  Draw.text(ctx, `Tiempo total: ${fmtTime(G.totalTime)}`, VW / 2, 255, 28);
  Draw.text(ctx, `Rango: ${rankFor(G.deaths)}`, VW / 2, 300, 30, COL.rival);
  if (G.newRecord) Draw.wobblyText(ctx, '¡NUEVO RÉCORD!', VW / 2, 345, 30, COL.hero, t);
  else if (G.save && typeof G.save.best === 'number') Draw.text(ctx, `Récord: ${G.save.best} muertes`, VW / 2, 345, 24, '#6b5f55');
  Draw.text(ctx, 'Reta a tus amigos a hacerlo con menos muertes.', VW / 2, 385, 22);

  const gy = 480;
  carrying(Draw.hero.bind(Draw), 250 + ((t * 90) % 560), gy, 1.2, t, { grin: true });
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  Draw.seg(ctx, 40, gy, 920, gy, 1.5);
  ctx.stroke();
  if (G.stateT > 1.2 && blink(t)) Draw.text(ctx, 'ESPACIO para volver al título', VW / 2, 522, 20, '#6b5f55');
}

function fmtTime(s) {
  const m = Math.floor(s / 60), r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, '0')}`;
}
