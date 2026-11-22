/* Fundo animado da área do advogado: galáxia de pontos ligados + anel, sem prédios */
(() => {
  const cv = document.createElement('canvas');
  cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:-1;display:block;pointer-events:none';
  document.body.style.background = 'transparent';
  document.body.prepend(cv);
  const ctx = cv.getContext('2d');
  const reduz = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let W, H, DPR, anel, pts = [], mx = 0, my = 0, rx = 0, ry = 0, t = 0;
  const LEVE = (navigator.hardwareConcurrency || 4) <= 4 || (navigator.deviceMemory || 8) <= 4;
  const N = innerWidth < 700 ? 110 : LEVE ? 140 : 220;
  let ultMexeu = performance.now(), ultQuadro = 0;
  ['pointermove', 'keydown', 'wheel', 'pointerdown', 'touchstart'].forEach(ev => addEventListener(ev, () => { ultMexeu = performance.now(); }, { passive: true }));
  function tamanho() {
    DPR = Math.min(devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight;
    cv.width = W * DPR; cv.height = H * DPR; ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    anel = document.createElement('canvas'); anel.width = W * DPR; anel.height = H * DPR;
    const a = anel.getContext('2d'); a.scale(DPR, DPR);
    const r = Math.min(W, H) * .43, cx = W / 2, cy = H * .46;
    for (const [lw, al, bl] of [[10, .16, 60], [5, .3, 30], [2.2, .6, 12]]) {
      a.beginPath(); a.arc(cx, cy, r, 0, 6.2832); a.lineWidth = lw; a.strokeStyle = `rgba(30,144,255,${al})`;
      a.shadowColor = '#1e90ff'; a.shadowBlur = bl; a.stroke();
    }
    a.beginPath(); a.arc(cx, cy, r * 1.09, -.6, 1.1); a.lineWidth = 1.4; a.strokeStyle = 'rgba(251,191,36,.55)'; a.shadowColor = '#fbbf24'; a.shadowBlur = 14; a.stroke();
    a.beginPath(); a.arc(cx, cy, r * 1.09, 2.6, 4.1); a.stroke();
  }
  let ultW = 0;
  tamanho(); ultW = innerWidth;
  addEventListener('resize', () => { if (innerWidth !== ultW || Math.abs(innerHeight - H) > 140) { ultW = innerWidth; tamanho(); } });
  for (let i = 0; i < N; i++) {
    if (i < N * 0.72) {
      const braco = i % 3, r = Math.pow(Math.random(), .7) * 520 + 30, a = r * 0.011 + braco * (Math.PI * 2 / 3) + (Math.random() - .5) * .5;
      pts.push({ x: Math.cos(a) * r, y: (Math.random() - .5) * 40 * (1 - r / 600), z: Math.sin(a) * r, s: Math.random() * 1.4 + .4, c: Math.random() < .22 ? 1 : Math.random() < .12 ? 2 : 0 });
    } else {
      const r = 300 + Math.random() * 600, u = Math.random() * Math.PI * 2, v = Math.acos(2 * Math.random() - 1);
      pts.push({ x: r * Math.sin(v) * Math.cos(u), y: r * Math.cos(v) * .6, z: r * Math.sin(v) * Math.sin(u), s: Math.random() * 1.2 + .3, c: Math.random() < .15 ? 2 : 0 });
    }
  }
  addEventListener('pointermove', e => { mx = e.clientX / W - .5; my = e.clientY / H - .5; }, { passive: true });
  const cor = [[234, 243, 255], [90, 170, 255], [251, 191, 36]];
  const proj = [];
  function quadro(agora) {
    agora = agora || performance.now();
    const parado = agora - ultMexeu > 20000, passo = parado ? 500 : LEVE ? 83 : 41;
    if (document.hidden || agora - ultQuadro < passo) { requestAnimationFrame(quadro); return; }
    const fator = ultQuadro ? Math.min(40, (agora - ultQuadro) / 16.7) : 1; ultQuadro = agora;
    t += reduz ? 0 : .0016 * fator;
    rx += ((.42 + my * .25) - rx) * .04; ry += (mx * .4 - ry) * .04;
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(anel, 0, 0, W, H);
    const cy = Math.cos(t + ry), sy = Math.sin(t + ry), cx = Math.cos(rx), sx = Math.sin(rx), F = 700, esc = Math.min(W, H) / 900;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const x = p.x * cy - p.z * sy, z = p.x * sy + p.z * cy;
      const y2 = p.y * cx - z * sx, z2 = p.y * sx + z * cx + 900;
      const k = F / z2 * esc;
      proj[i] = { x: W / 2 + x * k, y: H * .47 + y2 * k, k, p };
    }
    ctx.lineWidth = .6;
    for (let i = 0; i < proj.length; i++) {
      const a = proj[i];
      for (let j = i + 1; j < proj.length; j++) {
        const b = proj[j], dx = a.x - b.x, dy = a.y - b.y, d = dx * dx + dy * dy;
        if (d < 6400) {
          ctx.strokeStyle = `rgba(80,165,255,${(1 - d / 6400) * .18 * Math.min(1, a.k * 1.3)})`;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
      }
    }
    for (const a of proj) {
      const c = cor[a.p.c], r = a.p.s * a.k * 1.6, brilho = .3 + .5 * Math.min(1, a.k);
      ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${brilho})`;
      ctx.beginPath(); ctx.arc(a.x, a.y, Math.max(.3, r), 0, 6.283); ctx.fill();
      if (a.p.c && r > 1.2) { ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},.08)`; ctx.beginPath(); ctx.arc(a.x, a.y, r * 4, 0, 6.283); ctx.fill(); }
    }
    requestAnimationFrame(quadro);
  }
  quadro();
})();
