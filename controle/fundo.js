/* Fundo animado da área do advogado: rede de pontos ligados, aberta na tela inteira (sem prédios) */
(() => {
  const cv = document.createElement('canvas');
  cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:-1;display:block;pointer-events:none';
  document.body.style.background = 'transparent';
  document.documentElement.style.background = '#020714';
  document.body.prepend(cv);
  const ctx = cv.getContext('2d');
  const reduz = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let W, H, DPR, ceu, mx = 0, my = 0, px = 0, py = 0;
  const LEVE = (navigator.hardwareConcurrency || 4) <= 4 || (navigator.deviceMemory || 8) <= 4;
  let ultMexeu = performance.now(), ultQuadro = 0, pts = [];
  ['pointermove', 'keydown', 'wheel', 'pointerdown', 'touchstart'].forEach(ev => addEventListener(ev, () => { ultMexeu = performance.now(); }, { passive: true }));
  const R = Math.random;
  function nuvem(c, x, y, r, cor, a) { const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(${cor},${a})`); g.addColorStop(1, `rgba(${cor},0)`); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); }
  function semear() {
    // pontos espalhados pela tela toda, em 3 profundidades (os do fundo são menores e mais lentos)
    const N = Math.round(Math.min(LEVE ? 90 : 150, W * H / (LEVE ? 14000 : 9500)));
    pts = [];
    for (let i = 0; i < N; i++) { const z = .35 + R() * .65; pts.push({ x: R() * W, y: R() * H, vx: (R() - .5) * .28 * z, vy: (R() - .5) * .28 * z, z, s: (R() * 1.5 + .9) * z, c: R() < .1 ? 2 : R() < .3 ? 1 : 0 }); }
  }
  function tamanho() {
    DPR = Math.min(devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight;
    cv.width = W * DPR; cv.height = H * DPR; ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ceu = document.createElement('canvas'); ceu.width = W * DPR; ceu.height = H * DPR;
    const c = ceu.getContext('2d'); c.scale(DPR, DPR);
    c.fillStyle = '#020714'; c.fillRect(0, 0, W, H);
    const M = Math.max(W, H);
    nuvem(c, W * .5, H * -.05, M * .75, '14,62,150', .55);
    nuvem(c, W * .1, H * .85, M * .5, '10,40,120', .30);
    nuvem(c, W * .92, H * .7, M * .45, '60,40,140', .20);
    for (let i = 0; i < W * H / 6000; i++) { c.fillStyle = `rgba(200,220,255,${.12 + R() * .35})`; c.fillRect(R() * W, R() * H, R() < .9 ? 1 : 1.6, R() < .9 ? 1 : 1.6); }
    semear();
  }
  let ultW = 0; tamanho(); ultW = innerWidth;
  addEventListener('resize', () => { if (innerWidth !== ultW || Math.abs(innerHeight - H) > 140) { ultW = innerWidth; tamanho(); } });
  addEventListener('pointermove', e => { mx = e.clientX / W - .5; my = e.clientY / H - .5; }, { passive: true });
  const cor = ['220,235,255', '90,170,255', '251,191,36'];
  function quadro(agora) {
    agora = agora || performance.now();
    const parado = agora - ultMexeu > 20000, passo = parado ? 400 : LEVE ? 66 : 33;
    if (document.hidden || agora - ultQuadro < passo) { requestAnimationFrame(quadro); return; }
    const f = ultQuadro ? Math.min(30, (agora - ultQuadro) / 16.7) : 1; ultQuadro = agora;
    px += (mx * 26 - px) * .05; py += (my * 18 - py) * .05;
    ctx.drawImage(ceu, 0, 0, W, H);
    const D = Math.min(190, Math.max(120, W * .13)), D2 = D * D;
    for (const p of pts) {
      if (!reduz) { p.x += p.vx * f; p.y += p.vy * f; }
      if (p.x < -20) p.x = W + 20; else if (p.x > W + 20) p.x = -20;
      if (p.y < -20) p.y = H + 20; else if (p.y > H + 20) p.y = -20;
      p.X = p.x + px * p.z; p.Y = p.y + py * p.z;
    }
    ctx.lineWidth = 1;
    for (let i = 0; i < pts.length; i++) { const a = pts[i];
      for (let j = i + 1; j < pts.length; j++) { const b = pts[j], dx = a.X - b.X, dy = a.Y - b.Y, d = dx * dx + dy * dy;
        if (d < D2) { ctx.strokeStyle = `rgba(90,170,255,${(1 - d / D2) * .42 * Math.min(a.z, b.z)})`; ctx.beginPath(); ctx.moveTo(a.X, a.Y); ctx.lineTo(b.X, b.Y); ctx.stroke(); } } }
    for (const p of pts) {
      ctx.fillStyle = `rgba(${cor[p.c]},${.5 + .45 * p.z})`; ctx.beginPath(); ctx.arc(p.X, p.Y, p.s, 0, 6.283); ctx.fill();
      if (p.c) { ctx.fillStyle = `rgba(${cor[p.c]},.10)`; ctx.beginPath(); ctx.arc(p.X, p.Y, p.s * 4.5, 0, 6.283); ctx.fill(); }
    }
    requestAnimationFrame(quadro);
  }
  quadro();
})();
