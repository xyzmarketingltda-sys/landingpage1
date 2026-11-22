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

  /* Situação do processo, lida das publicações (sem IA): em que fase está, o que já aconteceu e o que costuma vir depois.
     pubs = [{ dia, tipo, txt ou texto }]. É leitura automática do que saiu no Diário: serve de resumo, não substitui os autos. */
  const MARCOS = [
    ['arquivado', 9, /arquivem-se|arquivado definitivamente|baixa definitiva|remetam-se ao arquivo/i, 'Arquivado', 'Processo encerrado. Se havia valor a receber, confira se o alvará foi levantado antes do arquivamento.'],
    ['alvara', 8, /alvar[áa]|mandado de levantamento|levantamento d[eo]s? valor|expe[çc]a-se .{0,30}(?:of[íi]cio|guia) .{0,40}transfer/i, 'Alvará / levantamento', 'Dinheiro liberado ou em liberação. Acompanhar a expedição e o crédito na conta.'],
    ['execucao', 7, /cumprimento de senten|pagamento volunt[áa]rio|art\.?\s*523|penhora|sisbajud|bacenjud|impugna[çc][ãa]o ao cumprimento/i, 'Cumprimento de sentença', 'Fase de cobrança. O banco é intimado a pagar em 15 dias; sem pagamento, cabe multa de 10% e penhora.'],
    ['transito', 6, /tr[âa]nsito em julgado|transitou em julgado|transitad[ao] em julgado/i, 'Trânsito em julgado', 'Decisão definitiva. Próximo passo: pedir o cumprimento de sentença com a planilha de cálculo.'],
    ['acordao', 5, /ac[óo]rd[ãa]o|acordam os|negaram provimento|deram (?:parcial )?provimento|turma recursal/i, 'Acórdão (recurso julgado)', 'Recurso julgado. Ver se cabem embargos de declaração; depois, aguardar o trânsito em julgado.'],
    ['recurso', 4, /recurso inominado|apela[çc][ãa]o|contrarraz[õo]es|embargos de declara[çc][ãa]o/i, 'Recurso', 'Há recurso em andamento. Conferir prazo de contrarrazões ou aguardar o julgamento.'],
    ['sentenca', 3, /\bjulgo\s+(?:\w+\s+)?(?:im)?procedente|julgo\s+extint|homologo[^.]{0,80}(?:acordo|transa)/i, 'Sentença', 'Sentença publicada. Conferir o prazo de recurso (10 dias úteis no Juizado, 15 na Vara) e se vale recorrer.'],
    ['instrucao', 2, /per[íi]cia|perito|laudo pericial|audi[êe]ncia|especifi\w+ (?:as )?provas/i, 'Instrução (provas, perícia ou audiência)', 'Fase de provas. Conferir data de audiência ou prazo para falar sobre o laudo.'],
    ['replica', 1, /r[ée]plica|manifest\w+(?:-se)? sobre a contesta|contesta[çc][ãa]o/i, 'Contestação / réplica', 'O banco contestou. Próximo passo: réplica e, depois, provas ou julgamento.'],
    ['inicio', 0, /cite-se|cita[çc][ãa]o|emend\w+ (?:a )?(?:peti[çc][ãa]o )?inicial|tutela de urg[êe]ncia|gratuidade/i, 'Início (citação, emenda ou liminar)', 'Processo no começo. Conferir se há emenda a cumprir e se a liminar foi decidida.']];
  function situacao(pubs) {
    const L = (pubs || []).map(x => ({ dia: String(x.dia || '').slice(0, 10), tipo: x.tipo || '', t: String(x.txt != null ? x.txt : x.texto || '') })).filter(x => x.dia).sort((a, b) => a.dia.localeCompare(b.dia));
    if (!L.length) return null;
    const visto = {}, marcos = [];
    L.forEach(x => { const alvo = x.tipo + ' ' + x.t; let m = MARCOS.find(k => (k[0] === 'sentenca' && /senten[çc]a/i.test(x.tipo)) || (k[0] === 'acordao' && /ac[óo]rd[ãa]o/i.test(x.tipo))) || MARCOS.find(k => k[2].test(alvo));
      if (!m) return; const r = m[0] === 'sentenca' ? resultado(x.t) : null;
      if (!visto[m[0]] || visto[m[0]].dia < x.dia) visto[m[0]] = { dia: x.dia, rank: m[1], rot: m[3], prox: m[4], res: r };
      const ult = marcos[marcos.length - 1]; if (!ult || ult.cod !== m[0]) marcos.push({ cod: m[0], dia: x.dia, rot: m[3] + (r ? ': ' + ({ procedente: 'procedente', parcial: 'parcialmente procedente', improcedente: 'improcedente', acordo: 'acordo homologado', extinto: 'extinto' })[r] : '') }); });
    const at = Object.values(visto).sort((a, b) => b.dia.localeCompare(a.dia) || b.rank - a.rank)[0], ult = L[L.length - 1];
    const dias = Math.round((Date.now() - new Date(ult.dia + 'T12:00:00').getTime()) / 864e5);
    return { fase: at ? at.rot : 'Em andamento (sem fase identificada)', desde: at ? at.dia : ult.dia, proximo: at ? at.prox : 'Abra a última publicação para ver o que o juiz determinou.', resultado: visto.sentenca ? visto.sentenca.res : null, sentencaEm: visto.sentenca ? visto.sentenca.dia : null,
      ultima: { dia: ult.dia, tipo: ult.tipo }, parado: dias, marcos, total: L.length, primeira: L[0].dia };
  }
  const ROTULO = { contrato: 'cita o número do contrato', cpf_banco: 'CPF confere e é contra banco dos contratos', cpf: 'CPF confere, outro réu', nome_uf_banco: 'mesmo nome, no estado do cliente, contra banco dos contratos', nome_banco: 'mesmo nome contra banco dos contratos (pode ser homônimo)', nome: 'mesmo nome (pode ser homônimo)' };
  root.XYZLitis = { verificar, buscar, bancosEm, cepUF, tribunaisDaUF, limpar, resultado, situacao, ROTULO, BANCOS };
  if (typeof module !== 'undefined') module.exports = root.XYZLitis;
})(typeof window !== 'undefined' ? window : globalThis);
