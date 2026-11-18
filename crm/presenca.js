// Presença em tempo real da equipe (quem está logado) + eventos do escritório virtual
window.XYZPresenca = (() => {
  let canal = null, ouvintes = {}, pronto = false, fila = [];
  return {
    entrar(sb, eu, h) {
      if (h) ouvintes = h;
      if (canal) return canal;
      canal = sb.channel('escritorio-xyz', { config: { presence: { key: eu.id }, broadcast: { self: true } } });
      canal.on('presence', { event: 'sync' }, () => ouvintes.sync && ouvintes.sync(canal.presenceState()));
      canal.on('broadcast', { event: 'acao' }, ({ payload }) => ouvintes.acao && ouvintes.acao(payload));
      canal.on('broadcast', { event: 'venda' }, ({ payload }) => ouvintes.venda && ouvintes.venda(payload));
      canal.on('broadcast', { event: 'desafio' }, ({ payload }) => { try { window.XYZAlertaDesafio(payload); } catch (e) {} ouvintes.desafio && ouvintes.desafio(payload); });
      canal.subscribe(async st => {
        if (st !== 'SUBSCRIBED') return;
        pronto = true;
        await canal.track({ id: eu.id, nome: eu.nome, desde: Date.now() });
        fila.splice(0).forEach(m => canal.send(m));
      });
      return canal;
    },
    ouvir(h) { ouvintes = h; if (canal && h.sync) h.sync(canal.presenceState()); },
    enviar(ev, payload) {
      const m = { type: 'broadcast', event: ev, payload };
      if (canal && pronto) canal.send(m); else fila.push(m);
    },
    sair() { if (canal) canal.unsubscribe(); canal = null; pronto = false; }
  };
})();

// ---------- alerta de desafio: som de dinheiro + notificação, funciona em qualquer aba do sistema ----------
window.XYZSomDinheiro = () => {
  try {
    const C = new (window.AudioContext || window.webkitAudioContext)(), t0 = C.currentTime;
    const tom = (f, t, d, tipo = 'square', v = .12) => { const o = C.createOscillator(), g = C.createGain(); o.type = tipo; o.frequency.setValueAtTime(f, t0 + t);
      g.gain.setValueAtTime(0, t0 + t); g.gain.linearRampToValueAtTime(v, t0 + t + .01); g.gain.exponentialRampToValueAtTime(.0001, t0 + t + d); o.connect(g).connect(C.destination); o.start(t0 + t); o.stop(t0 + t + d + .05); };
    // moedas caindo (arpejo) + "ka-ching" de caixa registradora
    [988, 1319, 1568, 1976, 1568, 1976, 2637].forEach((f, i) => tom(f, i * .07, .18, 'square', .08));
    tom(2093, .62, .5, 'triangle', .18); tom(2637, .66, .6, 'triangle', .14); tom(3136, .70, .7, 'sine', .1);
    [0, .12, .24].forEach(d => tom(1046, 1.1 + d, .12, 'square', .06));
  } catch (e) {}
};
window.XYZAlertaDesafio = d => {
  if (!d || location.pathname.includes('/controle')) return;
  window.XYZSomDinheiro();
  const msg = `⚡ DESAFIO: ${d.titulo} — prêmio R$ ${Number(d.premio || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  try { if ('Notification' in window && Notification.permission === 'granted') { const n = new Notification('⚡ Novo desafio no escritório XYZ!', { body: msg.replace('⚡ DESAFIO: ', ''), requireInteraction: true }); n.onclick = () => { window.focus(); location.href = (location.pathname.includes('/controle') ? '../crm/' : '') + 'escritorio.html?desafio=1'; }; } } catch (e) {}
  if (document.hidden) { const orig = document.title; let k = 0; const it = setInterval(() => { document.title = k++ % 2 ? orig : '💰 NOVO DESAFIO!'; if (!document.hidden && k > 4) { clearInterval(it); document.title = orig; } }, 900); }
  if (/escritorio\.html/.test(location.pathname)) return;
  let b = document.getElementById('xyz-desafio-alerta');
  if (!b) { b = document.createElement('div'); b.id = 'xyz-desafio-alerta'; document.body.appendChild(b);
    b.style.cssText = 'position:fixed;left:50%;top:18px;transform:translateX(-50%);z-index:999;background:linear-gradient(180deg,#1a1205,#0b0b14);border:1px solid #fbbf24;box-shadow:0 0 30px rgba(251,191,36,.5);color:#fde68a;padding:14px 18px;border-radius:8px;font:600 14px Inter,sans-serif;display:flex;gap:14px;align-items:center;max-width:92vw'; }
  b.innerHTML = `<span style="font-size:26px">💰</span><div><div style="letter-spacing:2px;font-size:11px;color:#fbbf24">NOVO DESAFIO</div><b style="font-size:16px;color:#fff7d6">${String(d.titulo).replace(/</g, '&lt;')}</b><div style="font-size:12px;color:#cfe3ff">Prêmio: R$ ${Number(d.premio || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div></div><a href="escritorio.html?desafio=1" style="background:linear-gradient(180deg,#b45309,#78350f);color:#fff;border:1px solid #fbbf24;padding:8px 14px;border-radius:4px;text-decoration:none;font-weight:800;letter-spacing:1px;font-size:12px">IR PRO ESCRITÓRIO</a><button style="background:none;border:0;color:#93a9c9;font-size:18px;cursor:pointer" onclick="this.parentNode.remove()">✕</button>`;
};
// pede permissão de notificação no primeiro clique (exigência do navegador)
document.addEventListener('click', () => { try { if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission(); } catch (e) {} }, { once: true });
