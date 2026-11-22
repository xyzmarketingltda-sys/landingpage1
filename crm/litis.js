/* Conferência de litispendência no Diário de Justiça Eletrônico Nacional (API pública do CNJ).
   O Diário não tem busca por CPF, mas tem busca no TEXTO das publicações. Então a conferência é feita por três caminhos,
   do mais forte para o mais fraco:
     1) CPF escrito no texto da publicação            -> mesma pessoa, sem homônimo
     2) número do contrato escrito no texto            -> mesmo contrato, que é exatamente o que define a litispendência
     3) nome da parte, no tribunal do estado do cliente -> pode ser homônimo; só vale como indício
   Roda no navegador (tela de Processos) e no robô (edge function), por isso não usa DOM. */
(function (root) {
  const API = 'https://comunicaapi.pje.jus.br/api/v1/comunicacao';
  const BANCOS = [['Bradesco', /bradesco/i], ['Itaú', /ita[úu]/i], ['Pan', /\bpan\b/i], ['BMG', /\bbmg\b/i], ['C6', /\bc6\b/i], ['Daycoval', /daycoval/i], ['Santander', /santander|\bol[ée]\b/i], ['Mercantil', /mercantil/i], ['Safra', /safra/i], ['Facta', /facta/i], ['Agibank', /agibank|agiplan/i], ['Banrisul', /banrisul|rio grande do sul s/i], ['Caixa', /caixa econ[ôo]mica|\bcef\b/i], ['Banco do Brasil', /banco do brasil/i], ['Pine', /\bpine\b/i], ['BRB', /\bbrb\b/i], ['Paraná Banco', /paran[áa] banco/i], ['Inbursa', /inbursa/i], ['Master', /\bmaster\b/i], ['Crefisa', /crefisa/i], ['PicPay', /picpay/i], ['Digio', /digio/i], ['Cetelem', /cetelem|bnp paribas/i], ['Inter', /banco inter\b|\binter s/i], ['QI / Quali', /\bqi\b|quali/i], ['Parati', /parati/i], ['Presença', /presen[çc]a/i], ['Segue', /\bsegue\b/i], ['Finanto', /finanto/i], ['Sicoob', /sicoob/i], ['Sicredi', /sicredi/i], ['Nubank', /nubank|nu pagamentos|nu financeira/i], ['Crefaz', /crefaz/i], ['Capital Consig', /capital consig/i], ['Zema', /\bzema\b/i], ['Alfa', /banco alfa|financeira alfa/i], ['Votorantim / BV', /votorantim|\bbv\b/i]];
  const bancosEm = t => BANCOS.filter(([, re]) => re.test(t || '')).map(([k]) => k);
  const so = v => String(v || '').replace(/\D/g, '');
  const chave = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z ]/g, ' ').replace(/\s+/g, ' ').trim();
  const limpar = h => String(h || '').slice(0, 80000).replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim();
  const TRF = { TRF1: 'AC AM AP BA DF GO MA MT PA PI RO RR TO', TRF2: 'RJ ES', TRF3: 'SP MS', TRF4: 'RS SC PR', TRF5: 'AL CE PB PE RN SE', TRF6: 'MG' };
  const tribunaisDaUF = uf => uf ? [uf === 'DF' ? 'TJDFT' : 'TJ' + uf, Object.keys(TRF).find(k => TRF[k].split(' ').includes(uf))].filter(Boolean) : [];
  const FAIXAS = [[1000, 19999, 'SP'], [20000, 28999, 'RJ'], [29000, 29999, 'ES'], [30000, 39999, 'MG'], [40000, 48999, 'BA'], [49000, 49999, 'SE'], [50000, 56999, 'PE'], [57000, 57999, 'AL'], [58000, 58999, 'PB'], [59000, 59999, 'RN'], [60000, 63999, 'CE'], [64000, 64999, 'PI'], [65000, 65999, 'MA'], [66000, 68899, 'PA'], [68900, 68999, 'AP'], [69000, 69299, 'AM'], [69300, 69399, 'RR'], [69400, 69899, 'AM'], [69900, 69999, 'AC'], [70000, 72799, 'DF'], [72800, 72999, 'GO'], [73000, 73699, 'DF'], [73700, 76799, 'GO'], [76800, 76999, 'RO'], [77000, 77999, 'TO'], [78000, 78899, 'MT'], [79000, 79999, 'MS'], [80000, 87999, 'PR'], [88000, 89999, 'SC'], [90000, 99999, 'RS']];
  const cepUF = cep => { const n = Number(so(cep).slice(0, 5)); if (so(cep).length !== 8) return ''; const f = FAIXAS.find(([a, b]) => n >= a && n <= b); return f ? f[2] : ''; };
  const espera = ms => new Promise(r => setTimeout(r, ms));

  async function pagina(q, pag, tam) {
    const u = API + '?' + q + '&itensPorPagina=' + tam + '&pagina=' + pag;
    for (let t = 0; t < 3; t++) {
      const r = await fetch(u, { headers: { Accept: 'application/json' } });
      if (r.status === 429) { try { await r.text(); } catch (e) {} if (t === 2) throw new Error('429'); await espera(6000 * (t + 1)); continue; }
      if (!r.ok) { try { await r.text(); } catch (e) {} throw new Error('http ' + r.status); }
      const j = await r.json(); return { total: j.count || 0, itens: j.items || [] };
    }
  }
  async function buscar(q, o) { o = o || {}; const tam = o.tam || 100, max = o.max || 2, out = []; let total = 0;
    for (let p = 1; p <= max; p++) { const r = await pagina(q, p, tam); total = r.total; out.push(...r.itens); if (r.itens.length < tam) break; await espera(o.pausa || 700); }
    return { total, itens: out }; }

  const RES = [['parcial', /julgo\s+(?:parcialmente\s+procedente|procedente[s]?\s+em\s+parte)|parcialmente\s+procedente/i], ['improcedente', /julgo\s+(?:totalmente\s+)?improcedente|improcedente[s]?\s+o[s]?\s+pedido/i], ['procedente', /julgo\s+(?:totalmente\s+)?procedente|procedente[s]?\s+o[s]?\s+pedido/i], ['acordo', /homologo[^.]{0,80}(?:acordo|transa[çc][ãa]o)/i], ['extinto', /julgo\s+extint|extingo\s+o\s+(?:processo|feito)/i]];
  const resultado = t => { const i = t.search(/\bjulgo\b|\bhomologo\b|ante o exposto|diante do exposto|isso posto|posto isso/i); const d = t.slice(Math.max(0, i)); const r = RES.find(([, re]) => re.test(d)); return r ? r[0] : null; };

  /* p = { cpf, nome, cep ou uf, contratos: [{ n, banco }] }   o = { aviso(texto), pausa, maxContratos, meses, federal }
     devolve { achados: [...], consultas, erros: [...], bancos: [...], uf } */
  async function verificar(p, o) {
    o = o || {}; const aviso = o.aviso || (() => {}), pausa = o.pausa || 700, M = new Map(), erros = []; let consultas = 0;
    const cpf = so(p.cpf), cpfFmt = cpf.length === 11 ? cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : '', nome = chave(p.nome), uf = p.uf || cepUF(p.cep);
    const bancosCli = [...new Set((p.contratos || []).flatMap(k => bancosEm(k.banco)))];
    const nums = [...new Set((p.contratos || []).map(k => so(k.n)).filter(n => n.length >= 7 && n.length <= 20))].slice(0, o.maxContratos || 12);
    const por = (it, prova, contrato) => {
      if (it.ativo === false) return; const n = it.numeroprocessocommascara || it.numero_processo || '?';
      if (!M.has(n)) M.set(n, { numero: n, tribunal: it.siglaTribunal || '', orgao: it.nomeOrgao || '', classe: it.nomeClasse || '', nomes: new Map(), pubs: new Map(), provas: new Set(), contratos: new Set() });
      const a = M.get(n); a.provas.add(prova); if (contrato) a.contratos.add(contrato);
      (it.destinatarios || []).forEach(d => a.nomes.set(d.nome, d.polo));
      if (!a.pubs.has(it.id)) a.pubs.set(it.id, { id: it.id, dia: it.data_disponibilizacao, tipo: it.tipoDocumento || it.tipoComunicacao || 'Publicação', link: /^https:\/\//.test(it.link || '') ? it.link : '', txt: limpar(it.texto) });
    };
    const tenta = async (rotulo, fn) => { aviso(rotulo); try { consultas++; await fn(); } catch (e) { erros.push(rotulo + ': ' + e.message); if (/429/.test(e.message)) throw e; } await espera(pausa); };
    try {
      if (cpfFmt) await tenta('CPF no texto das publicações', async () => { const r = await buscar('texto=' + encodeURIComponent(cpfFmt), { pausa });
        r.itens.forEach(it => { if (limpar(it.texto).replace(/\s/g, '').includes(cpfFmt)) por(it, 'cpf'); }); });
      for (const n of nums) await tenta('contrato nº ' + n, async () => { const r = await buscar('texto=' + n, { max: 1, pausa }); const re = new RegExp('(^|\\D)' + n + '(\\D|$)');
        r.itens.forEach(it => { const t = limpar(it.texto); if (re.test(t) && /contrato|empr[ée]stimo|consign|c[ée]dula|opera[çc][ãa]o/i.test(t)) por(it, 'contrato', n); }); });
      if (nome.split(' ').length >= 2) {
        const de = new Date(Date.now() - (o.meses || 24) * 30.4 * 864e5).toISOString().slice(0, 10), ate = new Date().toISOString().slice(0, 10);
        const tribs = tribunaisDaUF(uf).filter(t => o.federal !== false || !/^TRF/.test(t) || bancosCli.includes('Caixa'));
        for (const t of (tribs.length ? tribs : [''])) await tenta('nome' + (t ? ' no ' + t : ' no Brasil todo'), async () => {
          const r = await buscar('nomeParte=' + encodeURIComponent(p.nome.trim()) + (t ? '&siglaTribunal=' + t : '') + '&dataDisponibilizacaoInicio=' + de + '&dataDisponibilizacaoFim=' + ate, { max: 2, pausa });
          r.itens.forEach(it => { if ((it.destinatarios || []).some(d => chave(d.nome) === nome)) por(it, t ? 'nome_uf' : 'nome'); }); });
      }
    } catch (e) { /* 429: devolve o que já tem, com o erro anotado */ }
    const achados = [...M.values()].map(a => {
      const pubs = [...a.pubs.values()].sort((x, y) => String(y.dia).localeCompare(String(x.dia))), partes = [...a.nomes].map(([n, polo]) => n + (polo === 'A' ? ' (autor)' : polo === 'P' ? ' (réu)' : '')).slice(0, 8).join('; ');
      const tudo = pubs.map(x => x.txt.slice(0, 3000)).join(' ');
      const bancos = bancosEm(partes).length ? bancosEm(partes) : bancosEm(tudo.slice(0, 4000)), conflito = bancos.filter(b => bancosCli.includes(b));
      const certo = a.provas.has('cpf') || a.provas.has('contrato'), sent = pubs.find(x => /senten[çc]a|ac[óo]rd[ãa]o/i.test(x.tipo) || /\bjulgo\s+(?:\w+\s+)?(?:im)?procedente/i.test(x.txt));
      // nível: contrato citado = litispendência quase certa; CPF + mesmo banco = mesma pessoa contra o mesmo banco; nome é só indício
      const nivel = a.provas.has('contrato') ? 'contrato' : a.provas.has('cpf') ? (conflito.length ? 'cpf_banco' : 'cpf') : conflito.length ? (a.provas.has('nome_uf') ? 'nome_uf_banco' : 'nome_banco') : 'nome';
      const area = /consignad|empr[ée]stimo|\bRMC\b|\bRCC\b|cart[ãa]o de cr[ée]dito|seguro prestamista/i.test(tudo) || bancos.length ? 'Bancário' : /\bINSS\b|previdenci|aposentadoria|aux[íi]lio|\bBPC\b|\bLOAS\b|pens[ãa]o por morte/i.test(tudo + ' ' + partes) ? 'Previdenciário' : 'Outra área';
      return { numero: a.numero, tribunal: a.tribunal, orgao: a.orgao, classe: a.classe, partes, bancos, conflito, provas: [...a.provas], contratos: [...a.contratos], certo, nivel, area, sentenca: sent ? { dia: sent.dia, resultado: resultado(sent.txt) } : null, pubs };
    });
    const peso = { contrato: 0, cpf_banco: 1, nome_uf_banco: 2, nome_banco: 3, cpf: 4, nome: 5 };
    achados.sort((x, y) => (peso[x.nivel] - peso[y.nivel]) || String(y.pubs[0].dia).localeCompare(String(x.pubs[0].dia)));
    return { achados, consultas, erros, bancos: bancosCli, uf, contratosConferidos: nums.length };
  }
  const ROTULO = { contrato: 'cita o número do contrato', cpf_banco: 'CPF confere e é contra banco dos contratos', cpf: 'CPF confere, outro réu', nome_uf_banco: 'mesmo nome, no estado do cliente, contra banco dos contratos', nome_banco: 'mesmo nome contra banco dos contratos (pode ser homônimo)', nome: 'mesmo nome (pode ser homônimo)' };
  root.XYZLitis = { verificar, buscar, bancosEm, cepUF, tribunaisDaUF, limpar, resultado, ROTULO, BANCOS };
  if (typeof module !== 'undefined') module.exports = root.XYZLitis;
})(typeof window !== 'undefined' ? window : globalThis);
