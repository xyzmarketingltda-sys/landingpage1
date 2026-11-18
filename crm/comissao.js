/* XYZ · regras de comissão dos advogados + Pix (usado no CRM e na página de pagamento) */
(function (root) {
  const brl = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  function aplicarRegra(regra, linhas) {
    // linhas: clientes do advogado no mês → agrupa por cliente (CPF), pois paga por cliente e não por processo
    const grupos = {}; linhas.forEach(c => { const k = (c.cpf || '').replace(/\D/g, '') || c.nome; (grupos[k] = grupos[k] || []).push(c); });
    const itens = Object.values(grupos).map(g => {
      const seg = g.filter(c => (c.produto || 'seguro') === 'seguro'), rev = g.filter(c => c.produto === 'revisional');
      const valor = seg.reduce((x, c) => x + (Number(c.valor) || 0), 0), facta = seg.some(c => /facta/i.test(c.banco || ''));
      let v = 0, obs = '', semValor = seg.length > 0 && !valor;
      if (!regra) obs = 'sem regra cadastrada';
      else if (regra.tipo === 'por_cliente' || regra.por_cliente) { v = regra.v; obs = 'por cliente (' + g.length + ' processo(s))'; semValor = false; }
      else if (regra.tipo === 'por_processo') { v = g.length * regra.v; obs = g.length + ' processo(s) × ' + brl(regra.v); semValor = false; }
      else if (regra.tipo === 'percentual') { obs = regra.pct + '% no êxito'; semValor = false; }
      else if (regra.tipo === 'faixas_cliente') {
        if (seg.length && valor) { const f = regra.faixas.find(x => valor >= x.min); if (f) { v = f.v; obs = 'seguro ' + brl(valor); } else if (facta && regra.facta_min && valor >= regra.facta_min) { v = regra.facta_v; obs = 'Facta ' + brl(valor); } else obs = 'abaixo da faixa (' + brl(valor) + ')'; }
        if (rev.length && regra.revisional_v) { v += regra.revisional_v; obs += (obs ? ' + ' : '') + 'juros abusivos'; }
        if (semValor) obs = 'sem valor do seguro';
      }
      return { cliente: g[0].nome, cpf: g[0].cpf, bancos: [...new Set(g.map(c => c.banco).filter(Boolean))].join(', '), processos: g.length, valor, v, obs, semValor };
    });
    return itens;
  }
  // vencimento: dia 31 do mês de referência (ou o último dia, se o mês for menor)
  function vencimento(mesIso) { const [a, m] = mesIso.split('-').map(Number); return new Date(a, m, 0); }
  // Pix copia e cola (BR Code estático) — chave CNPJ da XYZ no BTG
  const PIX = { chave: '46643124000196', chaveFmt: '46.643.124/0001-96', banco: 'Banco BTG Pactual', nome: 'XYZ MARKETING LTDA', cidade: 'TAUBATE' };
  const campo = (id, v) => id + String(v.length).padStart(2, '0') + v;
  function crc16(s) { let c = 0xFFFF; for (let i = 0; i < s.length; i++) { c ^= s.charCodeAt(i) << 8; for (let j = 0; j < 8; j++) c = c & 0x8000 ? (c << 1) ^ 0x1021 : c << 1; c &= 0xFFFF; } return c.toString(16).toUpperCase().padStart(4, '0'); }
  function pixPayload(valor, txid) {
    const t = String(txid || '***').replace(/[^A-Za-z0-9]/g, '').slice(0, 25) || '***';
    let p = campo('00', '01') + campo('26', campo('00', 'br.gov.bcb.pix') + campo('01', PIX.chave)) + campo('52', '0000') + campo('53', '986');
    if (valor > 0) p += campo('54', Number(valor).toFixed(2));
    p += campo('58', 'BR') + campo('59', PIX.nome) + campo('60', PIX.cidade) + campo('62', campo('05', t)) + '6304';
    return p + crc16(p);
  }
  root.XYZComissao = { aplicarRegra, vencimento, pixPayload, PIX, brl };
})(typeof window !== 'undefined' ? window : globalThis);
