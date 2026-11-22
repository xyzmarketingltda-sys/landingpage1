/* Fundo animado da área do advogado: galáxia espiral com núcleo, nebulosas e campo de estrelas (sem prédios) */
(() => {
  const cv = document.createElement('canvas');
  cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:-1;display:block;pointer-events:none';
  document.body.style.background = 'transparent';
  document.documentElement.style.background = '#01040c';
  document.body.prepend(cv);
  const ctx = cv.getContext('2d');
  const reduz = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let W, H, DPR, ceu, mx = 0, my = 0, rx = 0, ry = 0, t = 0;
  const LEVE = (navigator.hardwareConcurrency || 4) <= 4 || (navigator.deviceMemory || 8) <= 4;
  const CEL = innerWidth < 700;
  const N = CEL ? 520 : LEVE ? 700 : 1300;      // estrelas da galáxia
  const NL = CEL ? 45 : LEVE ? 60 : 90;          // pontos ligados por linhas (constelação)
  let ultMexeu = performance.now(), ultQuadro = 0;
  ['pointermove', 'keydown', 'wheel', 'pointerdown', 'touchstart'].forEach(ev => addEventListener(ev, () => { ultMexeu = performance.now(); }, { passive: true }));
  const R = Math.random;
  function nuvem(c, x, y, r, cor, a) {
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${cor},${a})`); g.addColorStop(.5, `rgba(${cor},${a * .35})`); g.addColorStop(1, `rgba(${cor},0)`);
    c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
  }
  function tamanho() {
    DPR = Math.min(devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight;
    cv.width = W * DPR; cv.height = H * DPR; ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    // céu parado: nebulosas + estrelas distantes (desenhado uma vez)
    ceu = document.createElement('canvas'); ceu.width = W * DPR; ceu.height = H * DPR;
    const c = ceu.getContext('2d'); c.scale(DPR, DPR);
    c.fillStyle = '#01040c'; c.fillRect(0, 0, W, H);
    const M = Math.max(W, H);
    c.globalCompositeOperation = 'lighter';
    nuvem(c, W * .18, H * .22, M * .55, '40,70,200', .20);
    nuvem(c, W * .85, H * .30, M * .50, '120,50,190', .17);
    nuvem(c, W * .70, H * .85, M * .55, '0,120,200', .14);
    nuvem(c, W * .25, H * .80, M * .40, '190,120,30', .08);
    nuvem(c, W * .50, H * .46, M * .45, '30,90,230', .16);
    const ne = Math.round(W * H / (CEL ? 1800 : 2600));
    for (let i = 0; i < ne; i++) {
      const x = R() * W, y = R() * H, q = R(), s = q < .92 ? R() * .8 + .2 : R() * 1.3 + .8;
      const tom = R() < .12 ? '255,220,150' : R() < .3 ? '160,200,255' : '235,242,255';
      c.fillStyle = `rgba(${tom},${.25 + R() * .65})`; c.beginPath(); c.arc(x, y, s, 0, 6.283); c.fill();
      if (s > 1.5) { nuvem(c, x, y, s * 7, tom, .22); }
    }
    c.globalCompositeOperation = 'source-over';
  }
  let ultW = 0; tamanho(); ultW = innerWidth;
  addEventListener('resize', () => { if (innerWidth !== ultW || Math.abs(innerHeight - H) > 140) { ultW = innerWidth; tamanho(); } });
  // galáxia espiral: núcleo + 2 braços principais e 2 fracos
  const pts = [];
  for (let i = 0; i < N; i++) {
    const q = R();
    if (q < .16) { // bojo central
      const r = Math.pow(R(), 1.6) * 110, u = R() * 6.283, v = Math.acos(2 * R() - 1);
      pts.push({ x: r * Math.sin(v) * Math.cos(u), y: r * Math.cos(v) * .55, z: r * Math.sin(v) * Math.sin(u), s: R() * 1.1 + .4, c: R() < .7 ? 2 : 0, a: .9 });
    } else if (q < .93) { // braços
      const br = i % 4 < 3 ? i % 2 : 2 + (i % 8 > 3 ? 1 : 0), forte = br < 2, r = 35 + Math.pow(R(), .85) * 430;
      const ang = Math.log(r / 35) * 2.2 + (forte ? br * Math.PI : Math.PI / 2 + (br - 2) * Math.PI) + (R() + R() - 1) * (forte ? .26 : .5);
      pts.push({ x: Math.cos(ang) * r, y: (R() - .5) * 26 * (1 - r / 600), z: Math.sin(ang) * r, s: R() * 1.3 + .5, c: R() < .28 ? 1 : R() < .08 ? 3 : R() < .06 ? 2 : 0, a: forte ? 1 : .55 });
    } else { // halo
      const r = 250 + R() * 520, u = R() * 6.283, v = Math.acos(2 * R() - 1);
      pts.push({ x: r * Math.sin(v) * Math.cos(u), y: r * Math.cos(v) * .5, z: r * Math.sin(v) * Math.sin(u), s: R() * .9 + .3, c: 0, a: .45 });
    }
  }
  const poeira = [];
  for (let i = 0; i < (CEL ? 44 : 70); i++) { const br = i % 2, r = 50 + (i / 70) * 400 + R() * 30, ang = Math.log(r / 35) * 2.2 + br * Math.PI + (R() - .5) * .15; poeira.push({ x: Math.cos(ang) * r, z: Math.sin(ang) * r, t: 34 + R() * 34, c: i % 5 === 0 ? '170,110,255' : i % 7 === 0 ? '255,200,120' : '60,130,255' }); }
  const lig = [];
  for (let i = 0; i < NL; i++) lig.push(pts[Math.floor(N * .2 + R() * N * .7)]);
  addEventListener('pointermove', e => { mx = e.clientX / W - .5; my = e.clientY / H - .5; }, { passive: true });
  const cor = ['234,243,255', '110,180,255', '255,214,130', '190,140,255'];
  function quadro(agora) {
    agora = agora || performance.now();
    const parado = agora - ultMexeu > 20000, passo = parado ? 500 : LEVE ? 83 : 41;
    if (document.hidden || agora - ultQuadro < passo) { requestAnimationFrame(quadro); return; }
    const fator = ultQuadro ? Math.min(40, (agora - ultQuadro) / 16.7) : 1; ultQuadro = agora;
    t += reduz ? 0 : .0011 * fator;
    rx += ((1.02 + my * .2) - rx) * .04; ry += (mx * .35 - ry) * .04;
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(ceu, 0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    const X0 = W / 2, Y0 = H * .46, esc = Math.min(W, H) / (CEL ? 620 : 760), F = 900;
    const cy = Math.cos(t + ry), sy = Math.sin(t + ry), cx = Math.cos(rx), sx = Math.sin(rx), inc = -.32, ci = Math.cos(inc), si = Math.sin(inc);
    // brilho do núcleo
    nuvem(ctx, X0, Y0, 330 * esc, '70,120,255', .16);
    nuvem(ctx, X0, Y0, 150 * esc, '255,210,140', .30);
    nuvem(ctx, X0, Y0, 55 * esc, '255,245,225', .55);
    for (const d of poeira) {
      const x = d.x * cy - d.z * sy, z = d.x * sy + d.z * cy, y2 = -z * sx, z2 = z * cx + F, k = F / z2 * esc, px = x * k, py = y2 * k;
      nuvem(ctx, X0 + px * ci - py * si, Y0 + px * si + py * ci, d.t * k, d.c, .11);
    }
    for (const p of pts) {
      const x = p.x * cy - p.z * sy, z = p.x * sy + p.z * cy;
      const y2 = p.y * cx - z * sx, z2 = p.y * sx + z * cx + F;
      const k = F / z2 * esc, px = x * k, py = y2 * k;
      p.X = X0 + px * ci - py * si; p.Y = Y0 + px * si + py * ci; p.k = k;
      const r = Math.max(.35, p.s * k * .95), al = Math.min(1, p.a * (.45 + .5 * k));
      ctx.fillStyle = `rgba(${cor[p.c]},${al})`;
      if (r < 1) ctx.fillRect(p.X, p.Y, r * 1.6, r * 1.6); else { ctx.beginPath(); ctx.arc(p.X, p.Y, r, 0, 6.283); ctx.fill(); }
      if (p.c && r > 1.15) { ctx.fillStyle = `rgba(${cor[p.c]},.07)`; ctx.beginPath(); ctx.arc(p.X, p.Y, r * 4.5, 0, 6.283); ctx.fill(); }
    }
    ctx.lineWidth = .6;
    for (let i = 0; i < lig.length; i++) for (let j = i + 1; j < lig.length; j++) {
      const a = lig[i], b = lig[j], dx = a.X - b.X, dy = a.Y - b.Y, d = dx * dx + dy * dy;
      if (d < 7000) { ctx.strokeStyle = `rgba(120,190,255,${(1 - d / 7000) * .22})`; ctx.beginPath(); ctx.moveTo(a.X, a.Y); ctx.lineTo(b.X, b.Y); ctx.stroke(); }
    }
    ctx.globalCompositeOperation = 'source-over';
    // escurece um pouco para o texto continuar fácil de ler
    ctx.fillStyle = 'rgba(1,4,12,.22)'; ctx.fillRect(0, 0, W, H);
    requestAnimationFrame(quadro);
  }
  quadro();
})();
