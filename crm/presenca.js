// Presença em tempo real da equipe (quem está logado) + eventos do escritório virtual
window.XYZPresenca = (() => {
  let canal = null, ouvintes = {}, pronto = false, fila = [];
  return {
    entrar(sb, eu, h) {
      if (h) ouvintes = h;
      window.__xyzEu = eu;
      if (canal) return canal;
      canal = sb.channel('escritorio-xyz', { config: { presence: { key: eu.id }, broadcast: { self: true } } });
      canal.on('presence', { event: 'sync' }, () => ouvintes.sync && ouvintes.sync(canal.presenceState()));
      canal.on('broadcast', { event: 'acao' }, ({ payload }) => ouvintes.acao && ouvintes.acao(payload));
      canal.on('broadcast', { event: 'venda' }, ({ payload }) => { if (payload && payload.zapsign) { try { window.XYZAlertaAssinatura(payload); } catch (e) {} } ouvintes.venda && ouvintes.venda(payload); });
      canal.on('broadcast', { event: 'desafio' }, ({ payload }) => { try { window.XYZAlertaDesafio(payload); setTimeout(() => window.XYZLembretes(sb), 2000); } catch (e) {} ouvintes.desafio && ouvintes.desafio(payload); });
      canal.subscribe(async st => {
        if (st !== 'SUBSCRIBED') return;
        pronto = true;
        await canal.track({ id: eu.id, nome: eu.nome, desde: Date.now() });
        try { window.XYZLembretes(sb); window.XYZPedirAviso(); } catch (e) {}
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
  const me = window.__xyzEu; if (d.atendente_id && me && me.papel !== 'admin' && d.atendente_id !== me.id) return;
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
// ---------- cliente assinou a procuração no ZapSign: som + notificação do Windows + faixa na tela (para a atendente dona e para o admin) ----------
const _assinVistas = {};
window.XYZAlertaAssinatura = d => {
  if (!d || location.pathname.includes('/controle')) return;
  const me = window.__xyzEu; if (!me || (me.papel !== 'admin' && d.id !== me.id)) return;
  const chave = d.tok || (d.cliente || '') + '|' + (d.id || ''); if (_assinVistas[chave]) return; _assinVistas[chave] = 1;
  const nome = String(d.cliente || 'Cliente').trim(), quem = me.papel === 'admin' && d.atendente ? ' (' + d.atendente + ')' : '';
  window.XYZSomDinheiro();
  try { if ('Notification' in window && Notification.permission === 'granted') { const n = new Notification('✍️ Procuração assinada!', { body: nome + ' assinou no ZapSign' + quem + '. Lance no CRM.', tag: 'zap-' + chave, requireInteraction: true }); n.onclick = () => { window.focus(); if (/escritorio\.html|hiscon\.html/.test(location.pathname)) location.href = './'; n.close(); }; } } catch (e) {}
  if (document.hidden) { const orig = document.title; let k = 0; const it = setInterval(() => { document.title = k++ % 2 ? orig : '✍️ ASSINOU!'; if (!document.hidden && k > 4) { clearInterval(it); document.title = orig; } }, 900); }
  let b = document.getElementById('xyz-assinou-alerta');
  if (!b) { b = document.createElement('div'); b.id = 'xyz-assinou-alerta'; document.body.appendChild(b);
    b.style.cssText = 'position:fixed;left:50%;top:18px;transform:translateX(-50%);z-index:998;background:linear-gradient(180deg,#052e1b,#0b0b14);border:1px solid #34d399;box-shadow:0 0 30px rgba(52,211,153,.45);color:#d1fae5;padding:12px 16px;border-radius:8px;font:600 14px Inter,sans-serif;display:flex;gap:12px;align-items:center;max-width:92vw;cursor:pointer'; b.onclick = () => b.remove(); }
  b.innerHTML = '<span style="font-size:24px">✍️</span><div><div style="letter-spacing:2px;font-size:11px;color:#34d399">PROCURAÇÃO ASSINADA</div><b style="font-size:15px;color:#fff"></b><div style="font-size:12px;color:#a7f3d0">assinou no ZapSign' + quem.replace(/</g, '&lt;') + ' · clique para fechar</div></div>';
  b.querySelector('b').textContent = nome;
  clearTimeout(b._t); b._t = setTimeout(() => b.remove(), 20000);
};
// pede permissão de notificação no primeiro clique (exigência do navegador)
document.addEventListener('click', () => { try { if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission(); } catch (e) {} }, { once: true });

// ---------- notificação do Windows (perto do relógio) + lembretes de 1h e 15min antes do fim ----------
window.XYZNotificar = (titulo, corpo, tag) => {
  try {
    if (!('Notification' in window) || Notification.permission !== 'granted') return false;
    const n = new Notification(titulo, { body: corpo, tag: tag || undefined, requireInteraction: true, renotify: !!tag });
    n.onclick = () => { window.focus(); location.href = (location.pathname.includes('/controle') ? '../crm/' : '') + 'escritorio.html?desafio=1'; };
    return true;
  } catch (e) { return false; }
};
const lembretesAgendados = {};
window.XYZLembretes = async sb => {
  if (location.pathname.includes('/controle')) return;
  try {
    const agora = new Date().toISOString();
    const me = window.__xyzEu; if (me && me.papel === 'admin') return;
    let q = sb.from('desafios').select('id,titulo,premio,fim').lte('inicio', agora).gt('fim', agora);
    if (me) q = q.or('atendente_id.is.null,atendente_id.eq.' + me.id);
    const { data } = await q;
    (data || []).forEach(d => [60, 15].forEach(min => {
      const chave = d.id + '-' + min, quando = new Date(d.fim).getTime() - min * 60000 - Date.now();
      if (lembretesAgendados[chave] || quando < -60000) return;
      lembretesAgendados[chave] = setTimeout(() => {
        const k = 'xyz-lembrete-' + chave; try { if (localStorage.getItem(k)) return; localStorage.setItem(k, '1'); } catch (e) {}
        const txt = min === 60 ? 'Falta 1 hora' : 'Faltam 15 minutos';
        window.XYZNotificar(`⏰ ${txt} — desafio "${d.titulo}"`, `Prêmio R$ ${Number(d.premio || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}. Lance seus clientes no CRM agora pra contar!`, 'desafio-' + d.id);
        window.XYZSomDinheiro();
      }, Math.max(0, quando));
    }));
  } catch (e) {}
};
// convite para ativar os avisos do Windows (o navegador só deixa pedir com um clique)
window.XYZPedirAviso = () => {
  if (location.pathname.includes('/controle') || !('Notification' in window) || Notification.permission !== 'default' || document.getElementById('xyz-pedir-aviso')) return;
  const b = document.createElement('button'); b.id = 'xyz-pedir-aviso'; b.textContent = '🔔 Ativar avisos dos desafios';
  b.style.cssText = 'position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:998;background:linear-gradient(180deg,#b45309,#78350f);color:#fff7d6;border:1px solid #fbbf24;border-radius:99px;padding:9px 18px;font:700 13px Inter,sans-serif;cursor:pointer;box-shadow:0 0 20px rgba(251,191,36,.45)';
  b.onclick = async () => { const r = await Notification.requestPermission(); b.remove(); if (r === 'granted') window.XYZNotificar('✅ Avisos ativados', 'Você vai receber os desafios relâmpago aqui, perto do relógio do Windows.', 'teste'); };
  document.body.appendChild(b);
};
