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
