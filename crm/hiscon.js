/* Leitor e analisador de HISCON (Histórico de Empréstimo Consignado - Meu INSS).
   Roda 100% no navegador: o PDF nunca sai do computador.
   Uso: const h = await lerHiscon(pdfDoc); const alertas = analisarHiscon(h); */
(function (root) {
  const num = s => { if (s == null) return null; const t = String(s).replace(/[^\d,.-]/g, ''); if (!t) return null; const v = Number(t.replace(/\./g, '').replace(',', '.')); return isNaN(v) ? null : v; };
  const dt = s => { const m = String(s || '').match(/(\d{2})\/(\d{2})\/(\d{2,4})/); if (!m) return null; const a = m[3].length === 2 ? '20' + m[3] : m[3]; return `${a}-${m[2]}-${m[1]}`; };
  const comp = s => { const m = String(s || '').match(/(\d{2})\/(\d{4})/); return m ? `${m[2]}-${m[1]}` : null; };
  const BANCOS = { '001': 'Banco do Brasil', '012': 'Inbursa', '029': 'Itaú Consignado', '033': 'Santander', '041': 'Banrisul', '069': 'Crefisa', '070': 'BRB', '104': 'Caixa', '121': 'Agibank', '149': 'Facta', '169': 'Olé', '237': 'Bradesco', '254': 'Paraná Banco', '318': 'BMG', '329': 'QI SCD', '335': 'Digio', '336': 'C6 Bank', '341': 'Itaú', '380': 'PicPay', '389': 'Mercantil', '394': 'Bradesco Financiamentos', '402': 'Ágil (Cobuccio)', '422': 'Safra', '623': 'Pan', '626': 'C6 Consignado', '643': 'Pine', '707': 'Daycoval', '739': 'Cetelem', '748': 'Sicredi', '756': 'Sicoob', '935': 'Facta' };
  const nomeBanco = s => { const t = String(s || '').replace(/\s+/g, ' ').trim(), m = t.match(/(\d{3})\s*-/); return m && BANCOS[m[1]] ? `${m[1]} - ${BANCOS[m[1]]}` : t; };
  const limpa = s => String(s || '').replace(/\s+/g, ' ').trim();

  async function itensDaPagina(page) {
    const tc = await page.getTextContent(), [a, b, c, d, e, f] = page.getViewport({ scale: 1 }).transform;
    // converte para coordenadas da página já "desvirada" (o HISCON vem em paisagem/rotacionado)
    return tc.items.filter(i => i.str && i.str.trim()).map(i => {
      const px = i.transform[4], py = i.transform[5];
      return { s: i.str, x: a * px + c * py + e, y: -(b * px + d * py + f), w: i.width, h: Math.hypot(i.transform[2], i.transform[3]) || 6 };
    });
  }

  // agrupa itens em "linhas visuais" por y
  function linhas(itens, tol = 2) {
    const ord = [...itens].sort((a, b) => b.y - a.y || a.x - b.x), out = [];
    for (const it of ord) {
      const l = out.find(l => Math.abs(l.y - it.y) <= tol);
      if (l) l.itens.push(it); else out.push({ y: it.y, itens: [it] });
    }
    out.forEach(l => { l.itens.sort((a, b) => a.x - b.x); l.txt = l.itens.map(i => i.s).join(' '); });
    return out;
  }

  // Lê uma tabela de empréstimos: usa a última linha do cabeçalho (a que tem PARCELA e EMPRESTADO) para achar o centro de cada coluna
  const COLS_EMP = ['contrato', 'banco', 'situacao', 'origem', 'inclusao', 'inicio', 'fim', 'parcelas', 'parcela', 'emprestado', 'liberado', 'iof', 'cetM', 'cetA', 'jurosM', 'jurosA', 'pago', 'primeiro', 'suspBanco', 'suspInss', 'reatBanco', 'reatInss', 'exclusao', 'origemExcl', 'motivoExcl'];
  function tabelaEmprestimos(itens, tipo) {
    const ls = linhas(itens);
    const iCab = ls.findIndex(l => /EMPRESTADO/.test(l.txt) && /PARCELA/.test(l.txt));
    if (iCab < 0) return [];
    const cab = ls[iCab].itens.map(i => ({ c: i.x + i.w / 2 }));
    const centros = cab.map(c => c.c);
    const nomes = COLS_EMP.slice(0, centros.length);
    const yCab = ls[iCab].y;
    const fimY = (ls.find(l => l.y < yCab && /^\*/.test(l.txt.trim())) || { y: -1 }).y;
    const corpo = itens.filter(i => i.y < yCab - 1 && i.y > fimY + 1);
    // âncoras: célula de situação
    const xSit = centros[2];
    const anc = corpo.filter(i => Math.abs(i.x + i.w / 2 - xSit) < 25 && /^(Ativo|Exclu|Suspen|Encerr|Reserv|Inativ)/i.test(i.s.trim())).sort((a, b) => b.y - a.y);
    if (!anc.length) return [];
    const regs = [];
    // cada item vai para a coluna mais próxima; dentro da coluna, itens colados verticalmente formam um bloco (célula),
    // e o bloco inteiro vai para a linha (âncora) mais próxima do seu centro
    const colDe = i => { const cx = i.x + i.w / 2; let best = 0, d = 1e9; centros.forEach((c, j) => { const dd = Math.abs(c - cx); if (dd < d) { d = dd; best = j; } }); return best; };
    const porCol = {};
    corpo.forEach(i => (porCol[colDe(i)] = porCol[colDe(i)] || []).push(i));
    const celulas = anc.map(() => ({}));
    Object.entries(porCol).forEach(([j, its]) => {
      its.sort((p, q) => q.y - p.y || p.x - q.x);
      const blocos = []; let cur = null;
      its.forEach(i => { if (cur && cur.ult - i.y <= (i.h || 6) * 1.6) { cur.it.push(i); cur.ult = i.y; } else blocos.push(cur = { it: [i], ult: i.y }); });
      blocos.forEach(bl => {
        const ys = bl.it.map(i => i.y), cy = (Math.max(...ys) + Math.min(...ys)) / 2;
        let k = 0, d = 1e9; anc.forEach((a, n) => { const dd = Math.abs(a.y - cy); if (dd < d) { d = dd; k = n; } });
        const cel = celulas[k]; (cel[nomes[j]] = cel[nomes[j]] || []).push(...bl.it.map(i => i.s.trim()));
      });
    });
    anc.forEach((a, k) => {
      const cel = celulas[k];
      const junta = (k, esp) => (cel[k] || []).join(esp ? ' ' : '');
      regs.push({
        tipo, contrato: junta('contrato'), banco: nomeBanco(junta('banco', 1)),
        situacao: limpa(junta('situacao', 1)).replace('Excluí do', 'Excluído').replace(/^Exclu.*/, 'Excluído'),
        origem: limpa(junta('origem')).replace(/^o(?=Averba)/, '').replace(/Averbação/i, 'Averbação ').replace(/ão(por|nova)/, 'ão $1').replace(/por(\S)/, 'por $1').replace(/\s+/g, ' ').replace(/Refinanciament$/, 'Refinanciamento').replace(/^Migradodocontrato/, 'Migrado do contrato '),
        inclusao: dt(junta('inclusao')), inicio: comp(junta('inicio')), fim: comp(junta('fim')), parcelas: num(junta('parcelas')),
        parcela: num(junta('parcela')), emprestado: num(junta('emprestado')), liberado: num(junta('liberado')), iof: num(junta('iof')),
        cetM: num(junta('cetM')), cetA: num(junta('cetA')), jurosM: num(junta('jurosM')), jurosA: num(junta('jurosA')),
        pago: num(junta('pago')), primeiro: dt(junta('primeiro')), exclusao: dt(junta('exclusao')),
        origemExcl: '', motivoExcl: limpa(junta('origemExcl', 1) + ' ' + junta('motivoExcl', 1)).replace(/(\w)- /g, '$1').replace(/refinancia mento/i, 'refinanciamento').replace(/portabilida de/i, 'portabilidade').replace(/titularidad e/i, 'titularidade').replace(/\.+$/, '')
      });
    });
    return regs;
  }

  function tabelaCartoes(itens) {
    const out = []; let sec = null;
    for (const l of linhas(itens)) {
      if (/CART[ÃA]O DE CR[ÉE]DITO - (RMC|RCC)/.test(l.txt)) { sec = l.txt.match(/(RMC|RCC)/)[1]; continue; }
      if (/DESCONTOS DE CART/.test(l.txt)) sec = null;
      if (sec && /(Ativo|Suspen)/.test(l.txt) && /\d{2}\/\d{2}\/\d{2}/.test(l.txt) && /R\$/.test(l.txt)) {
        const vals = l.txt.match(/R\$\s?[\d.]+,\d{2}/g) || [];
        out.push({ t: sec, contrato: l.txt.trim().split(/\s+/)[0], banco: (l.txt.match(/\d{3} - [A-ZÀ-Ú0-9 .&]+?(?=\s+(Ativo|Suspen))/) || [''])[0], suspenso: /Suspen/.test(l.txt),
          inclusao: dt((l.txt.match(/\d{2}\/\d{2}\/\d{2,4}/) || [])[0]), limite: num(vals[0]), reservado: num(vals[1]) });
      }
    }
    return out;
  }

  async function lerHiscon(pdf) {
    const h = { nome: '', beneficio: '', especie: '', nb: '', situacaoBeneficio: '', procurador: null, representante: null, pensaoAlimenticia: null,
      bloqueado: null, elegivel: null, pagoEm: '', emissao: null, margem: {}, contratos: [], cartoes: { RMC: [], RCC: [] }, descontosCartao: [], texto: '' };
    const paginas = [];
    for (let p = 1; p <= pdf.numPages; p++) paginas.push(await itensDaPagina(await pdf.getPage(p)));
    const todos = paginas.map(it => linhas(it).map(l => l.txt).join('\n'));
    const txt = h.texto = todos.join('\n');
    if (!/HIST[ÓO]RICO DE/i.test(txt) || !/CONSIGNADO/i.test(txt)) throw new Error('Este PDF não parece ser um HISCON (Histórico de Empréstimo Consignado do Meu INSS).');
    const lin = txt.split('\n').map(limpa);
    const iC = lin.findIndex(l => /EMPR[ÉE]STIMO CONSIGNADO/.test(l));
    h.nome = lin.slice(iC + 1).find(l => l && !/Benef/i.test(l)) || '';
    const iB = lin.findIndex(l => /^Benef[ií]cio$/i.test(l));
    h.beneficio = (lin.slice(iB + 1).find(l => l && !/^N[ºo°]/.test(l)) || '').replace(/N[ºo°] Benef.*/, '').trim();
    h.nb = (txt.match(/N[ºo°]\s*Benef[ií]cio:\s*([\d.\-]+)/) || [])[1] || '';
    h.situacaoBeneficio = (txt.match(/Situa[çc][ãa]o:\s*(\w+)/) || [])[1] || '';
    h.pagoEm = limpa((txt.match(/Pago em:\s*(.+?)(?:\s{2,}|N[ãa]o|Possui|$)/m) || [])[1]);
    h.procurador = !/N[ãa]o possui procurador/i.test(txt);
    h.representante = !/N[ãa]o possui representante legal/i.test(txt);
    h.pensaoAlimenticia = !/N[ãa]o [ée] pens[ãa]o aliment/i.test(txt);
    h.bloqueado = /Bloqueado para empr[ée]stimo/i.test(txt);
    h.elegivel = /Eleg[ií]vel para empr[ée]stimos/i.test(txt) && !/N[ãa]o eleg[ií]vel/i.test(txt);
    h.emissao = dt((txt.match(/(\d{2}\/\d{2}\/\d{4})\s+\d{2}:\d{2}:\d{2}/) || [])[1]);
    const v = re => num((txt.match(re) || [])[1]);
    h.margem = { base: v(/BASE DE C[ÁA]LCULO\s+(R\$[\d.,]+)/), maximo: v(/M[ÁA]XIMO DE COMPROMETIMENTO PERMITIDO\s+(R\$[\d.,]+)/),
      comprometido: v(/TOTAL COMPROMETIDO\s+(R\$[\d.,]+)/), extrapolada: v(/MARGEM EXTRAPOLADA\*+\s+(R\$[\d.,]+)/) };
    const mExt = txt.match(/MARGEM EXTRAPOLADA\*+\s+R\$[\d.,]+\s+R\$[\d.,]+\s+R\$[\d.,]+/g);
    if (mExt) h.margem.extrapoladaModal = (mExt[mExt.length - 1].match(/R\$[\d.,]+/g) || []).map(num);
    // espécie pelo nome do benefício
    const b = h.beneficio.toUpperCase();
    h.especie = /PRESTA[ÇC][ÃA]O CONTINUADA|AMPARO SOCIAL|LOAS/.test(b) ? (/IDOSO/.test(b) ? '88' : '87') : /PENS[ÃA]O/.test(b) ? 'pensao' : /APOSENT/.test(b) ? 'aposentadoria' : /AUX[IÍ]LIO/.test(b) ? 'auxilio' : 'outro';
    h.bpc = /^8[78]$/.test(h.especie);
    // tabelas
    paginas.forEach(it => {
      const t = linhas(it).map(l => l.txt).join('\n');
      if (/EMPR[ÉE]STIMOS BANC[ÁA]RIOS/.test(t)) {
        const tipo = /EXCLU[ÍI]DOS E ENCERRADOS/.test(t) ? 'excluido' : 'ativo';
        h.contratos.push(...tabelaEmprestimos(it, tipo));
      }
      if (/CART[ÃA]O DE CR[ÉE]DITO/.test(t)) {
        tabelaCartoes(it).forEach(c => h.cartoes[c.t].push(c));
        linhas(it).forEach(l => {
          const m = l.txt.match(/(\d{2}\/\d{4})\s+(R\$[\d.,]+)\s+(R\$[\d.,]+)\s+(R\$[\d.,]+)\s+(R\$[\d.,]+)/);
          if (m && /Encerrado|Ativo|Aberto|Pendente/i.test(l.txt)) h.descontosCartao.push({ banco: (l.txt.match(/\d{3} - [A-ZÀ-Ú .&]+?(?=\s{1,}(Encerrado|Ativo|Aberto|Pendente))/) || [''])[0].trim(), competencia: comp(m[1]), saldo: num(m[2]), desconto: num(m[3]), utilizado: num(m[4]), iof: num(m[5]) });
        });
      }
    });
    return h;
  }

  /* ===================== REGRAS (teses) ===================== */
  const TETO_JUROS = 1.85, TETO_CARTAO = 2.46;      // CNPS, vigentes em 2026
  const IN204 = '2026-05-19';                        // prazo máx. 108x + biometria obrigatória
  const IN190 = '2025-08-27';                        // volta da autorização judicial p/ representante de incapaz
  const fmt = v => v == null ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const dBR = s => s ? s.split('-').reverse().join('/') : '—';
  const meses = (a, b) => { if (!a || !b) return null; const [y1, m1] = a.split('-').map(Number), [y2, m2] = b.split('-').map(Number); return (y2 - y1) * 12 + (m2 - m1); };
  const id = c => `${c.contrato} (${c.banco})`;

  function analisarHiscon(h) {
    const A = [], add = (nivel, titulo, tese, contratos, detalhe) => A.push({ nivel, titulo, tese, contratos: contratos || [], detalhe: detalhe || '' });
    const C = h.contratos, vistos = new Set(), U = C.filter(c => { const k = c.contrato + '|' + c.emprestado; if (vistos.has(k)) return false; vistos.add(k); return true; }), ativos = C.filter(c => c.tipo === 'ativo'), novos = C.filter(c => /nova/i.test(c.origem));

    // 1. representante legal / incapaz
    if (h.representante) {
      const apos = C.filter(c => c.inclusao && c.inclusao >= IN190);
      add('alto', 'Benefício com representante legal (incapaz/menor)', 'Contrato feito em benefício de incapaz/menor exige autorização judicial (CC arts. 1.691, 1.748, 1.774 e 1.781; IN PRES/INSS 190/2025 após ACP do MPF/TRF-3). Sem alvará, cabe pedido de nulidade, devolução dos descontos e dano moral.',
        C.map(id), apos.length ? `${apos.length} contrato(s) após 27/08/2025, quando o INSS voltou a exigir alvará judicial.` : 'Conferir se havia alvará judicial na contratação.');
      if (h.bpc && C.some(c => c.inclusao >= '2026-04-01')) add('alto', 'BPC com representante legal: contratação vedada desde abr/2026', 'Desde abril/2026 não são permitidas novas contratações de consignado em BPC pago a representante legal.', C.filter(c => c.inclusao >= '2026-04-01').map(id));
    }
    if (h.procurador) add('medio', 'Benefício recebido por procurador', 'Desde 19/05/2026 é proibida a contratação mediante procuração de terceiros (IN 204/2026). Verificar se o procurador contratou em nome do titular.', C.filter(c => c.inclusao >= IN204).map(id));

    // 2. valor zerado / não liberado
    novos.forEach(c => {
      if ((c.liberado == null || c.liberado === 0) && c.emprestado > 0 && !c.pago)
        add('alto', 'Contrato novo sem valor liberado', 'Averbação nova com valor liberado zerado: o cliente pode não ter recebido o dinheiro. Tese de inexistência/nulidade do contrato, repetição do indébito em dobro (CDC art. 42) e dano moral.', [id(c)], `Emprestado ${fmt(c.emprestado)}, liberado ${fmt(c.liberado)}.`);
    });

    // 3. diferença não explicada (seguro prestamista / tarifas embutidas)
    U.forEach(c => {
      if (c.emprestado && c.liberado > 0) {
        const dif = c.emprestado - c.liberado - (c.iof || 0) - (c.pago || 0);
        if (dif > 20) add('alto', 'Valor financiado maior que o liberado (possível seguro/tarifa embutida)', 'Diferença entre valor emprestado e (liberado + IOF + dívida paga) indica cobrança embutida — típico de seguro prestamista ou "pacote de benefícios" (venda casada, CDC art. 39, I; Tema 972 STJ). Pedir o contrato para confirmar.', [id(c)], `Diferença de ${fmt(dif)} (${(dif / c.emprestado * 100).toFixed(1)}% do contrato).`);
      }
      if (c.cetM && c.jurosM && c.cetM - c.jurosM >= 0.25) add('medio', 'CET bem acima dos juros', 'CET muito maior que a taxa de juros sugere encargos embutidos (seguro, tarifa). Reforça a análise de seguro prestamista/venda casada.', [id(c)], `Juros ${c.jurosM}% a.m. x CET ${c.cetM}% a.m.`);
    });

    // 3b. taxa implícita (calculada pela parcela x prazo x valor) maior que a declarada
    U.forEach(c => {
      if (!(c.emprestado > 0 && c.parcela > 0 && c.parcelas > 0) || c.tipo === 'excluido') return;
      const dias = c.inclusao && c.primeiro ? Math.max(30, (new Date(c.primeiro) - new Date(c.inclusao)) / 864e5) : 30;
      const r = taxaImplicita(c.emprestado - (c.iof || 0), c.parcela, c.parcelas, dias);
      if (r != null && c.cetM && r - c.cetM > 0.15) add('alto', 'Parcela maior do que a taxa informada permite', 'Recalculando pela parcela, prazo e valor financiado, a taxa real fica acima da taxa/CET informados — indica encargo oculto (seguro, tarifa) ou cálculo irregular. Cabe revisão e devolução da diferença em dobro (CDC art. 42).', [id(c)], `Taxa real ≈ ${r.toFixed(2)}% a.m. x CET informado ${c.cetM}% a.m.`);
      if (r != null && r > TETO_JUROS + 0.15 && c.inclusao >= '2025-01-01' && !(c.jurosM > TETO_JUROS)) add('alto', 'Taxa real acima do teto do INSS', `Pela parcela e prazo, a taxa efetiva passa do teto de ${TETO_JUROS}% a.m.`, [id(c)], `≈ ${r.toFixed(2)}% a.m.`);
    });

    // 4. juros acima do teto
    U.forEach(c => { if (c.jurosM > TETO_JUROS + 0.001 && c.inclusao >= '2025-01-01') add('alto', 'Juros acima do teto do INSS', `Teto do CNPS para empréstimo consignado: ${TETO_JUROS}% a.m. Juros acima do teto: revisão/restituição do excedente.`, [id(c)], `${c.jurosM}% a.m. (incluído em ${dBR(c.inclusao)}).`); });

    // 5. prazo acima do permitido
    U.forEach(c => { const max = c.inclusao && c.inclusao >= IN204 ? 108 : 96; if (c.parcelas > max) add('alto', `Prazo acima do máximo (${max} parcelas)`, 'Número de parcelas acima do limite normativo vigente na data da contratação.', [id(c)], `${c.parcelas} parcelas em ${dBR(c.inclusao)}.`); });

    // 6. contratos idênticos / duplicados
    const grupos = {};
    U.forEach(c => { const k = [c.inclusao, c.parcela, c.emprestado].join('|'); (grupos[k] = grupos[k] || []).push(c); });
    Object.values(grupos).forEach(g => {
      const nums = new Set(g.map(c => c.contrato));
      if (g.length > 1 && nums.size > 1) add('alto', 'Contratos idênticos na mesma data', 'Contratos com mesma data, mesma parcela e mesmo valor: indício de duplicidade/fraude. Pedir os contratos e comprovantes de crédito.', g.map(id));
    });
    const porDia = {};
    novos.forEach(c => { (porDia[c.inclusao] = porDia[c.inclusao] || []).push(c); });
    Object.entries(porDia).forEach(([d, g]) => { if (g.length > 1 && new Set(g.map(c => c.parcela)).size > 1) add('medio', 'Vários contratos novos no mesmo dia', 'Mais de uma averbação nova na mesma data: verificar se o cliente reconhece todas (possível contratação não solicitada).', g.map(id), dBR(d)); });

    // 7. refinanciamento / portabilidade em sequência (giro de carteira)
    C.filter(c => c.tipo === 'excluido' && /refinanc|portab/i.test(c.motivoExcl)).forEach(c => {
      const m = meses(c.inclusao, c.exclusao), dias = c.inclusao && c.exclusao ? Math.round((new Date(c.exclusao) - new Date(c.inclusao)) / 864e5) : null;
      if (dias != null && dias <= 10) add('alto', 'Contrato substituído em poucos dias', 'Contrato portado/refinanciado poucos dias depois de incluído: típico de operação casada (portabilidade + refinanciamento) para gerar comissão, sem benefício real ao cliente. Falha no dever de informação e prática abusiva (CDC arts. 6º, III, e 39, V).', [id(c)], `Incluído em ${dBR(c.inclusao)} e excluído em ${dBR(c.exclusao)} (${dias} dia(s)) — ${c.motivoExcl}.`);
      else if (m != null && m < 12) add('medio', 'Refinanciado/portado com menos de 12 meses', 'Refinanciamentos e portabilidades sucessivos em pouco tempo ("giro de carteira") podem configurar prática abusiva e falha no dever de informação (CDC arts. 6º, III, e 39). Verificar se houve troco real ao cliente.', [id(c)], `Incluído em ${dBR(c.inclusao)}, excluído em ${dBR(c.exclusao)} (${m} meses) — ${c.motivoExcl}.`);
    });
    C.filter(c => /refinanc/i.test(c.origem) && c.pago && c.emprestado && c.emprestado - c.pago - (c.iof || 0) < 50)
      .forEach(c => add('medio', 'Refinanciamento sem troco', 'Refinanciamento em que praticamente todo o valor quitou a dívida anterior — o cliente não recebeu dinheiro novo e teve o prazo/juros estendidos.', [id(c)], `Emprestado ${fmt(c.emprestado)}, dívida paga ${fmt(c.pago)}.`));

    // 8. cartão consignado RMC/RCC
    const cart = [...h.cartoes.RMC.map(c => ({ ...c, t: 'RMC' })), ...h.cartoes.RCC.map(c => ({ ...c, t: 'RCC' }))];
    if (cart.length) add('alto', `Cartão consignado ativo (${cart.map(c => c.t).join(' + ')})`, 'Tese do cartão consignado (RMC/RCC): o cliente acha que contratou empréstimo e paga só o mínimo, gerando dívida que não acaba. Pedido de nulidade ou conversão em empréstimo consignado, devolução em dobro dos descontos e dano moral (dever de informação, CDC arts. 6º, III, 31 e 52).', cart.map(c => `${c.t} incluído em ${dBR(c.inclusao)} — limite ${fmt(c.limite)}, reserva ${fmt(c.reservado)}`));
    cart.forEach(k => {
      const mesmoDia = U.filter(c => c.inclusao && k.inclusao && Math.abs(new Date(c.inclusao) - new Date(k.inclusao)) <= 3 * 864e5);
      if (mesmoDia.length) add('alto', `Cartão ${k.t} contratado junto com empréstimo`, 'Cartão consignado averbado no mesmo dia (ou em até 3 dias) de um empréstimo: forte indício de venda casada — o cliente pediu empréstimo e recebeu também um cartão (CDC art. 39, I). Pedido de cancelamento, devolução em dobro dos descontos do cartão e dano moral.', mesmoDia.map(id), `${k.t} incluído em ${dBR(k.inclusao)}.`);
    });
    if (h.bpc && h.cartoes.RMC.length && h.cartoes.RCC.length) add('alto', 'BPC com RMC e RCC ao mesmo tempo', 'Para BPC (espécies 87/88) a margem de cartão é de 5% e o beneficiário pode optar por somente UMA modalidade (RMC ou RCC).', []);
    const desc = h.descontosCartao;
    if (desc.length >= 4) {
      const totDesc = desc.reduce((s, d) => s + (d.desconto || 0), 0);
      add('info', 'Descontos de cartão no período', 'Soma dos descontos de cartão listados no HISCON (base para cálculo de devolução).', [], `${desc.length} descontos, total ${fmt(totDesc)}.`);
    }

    // 9. margem extrapolada
    if (h.margem.extrapolada > 0 || (h.margem.extrapoladaModal || []).some(v => v > 0)) add('alto', 'Margem consignável extrapolada', 'Descontos acima do limite legal de comprometimento do benefício (Lei 10.820/2003 e Lei 8.213/91, art. 115, VI). Cabe pedido de adequação e devolução do excedente.', [], `Extrapolada: ${fmt(h.margem.extrapolada)}.`);

    // 10. BPC — informação
    if (h.bpc) add('info', 'Benefício assistencial (BPC/LOAS)', 'Consignado em BPC é permitido (Lei 14.431/2022, STF ADI 7.223), com margem de 30% + 5% de cartão. Atenção redobrada a vulnerabilidade: contratos abusivos têm forte apelo de dano moral.', []);
    if (h.bloqueado && C.some(c => c.inclusao && c.inclusao >= addDias(h.emissao, -90))) add('medio', 'Benefício bloqueado para empréstimo, mas com contrato recente', 'Benefício consta bloqueado; verificar se o contrato recente foi feito após o bloqueio (contratação irregular).', C.filter(c => c.inclusao >= addDias(h.emissao, -90)).map(id));

    // 11. contratos após biometria obrigatória
    const posBio = novos.filter(c => c.inclusao >= IN204);
    if (posBio.length) add('info', 'Contratos após a biometria obrigatória (19/05/2026)', 'Desde 19/05/2026 todo consignado exige anuência por biometria facial no Meu INSS. Se o cliente não fez a biometria, o contrato é irregular.', posBio.map(id));

    const peso = { alto: 0, medio: 1, info: 2 };
    return A.sort((a, b) => peso[a.nivel] - peso[b.nivel]);
  }
  function taxaImplicita(pv, pmt, n, dias) {     // taxa mensal (%) do fluxo: recebe PV hoje, paga n parcelas a partir de "dias"
    if (pmt * n <= pv) return 0;
    const ext = (dias || 30) / 30 - 1;
    let lo = 0.00001, hi = 0.2;
    for (let k = 0; k < 80; k++) { const i = (lo + hi) / 2, v = pmt * (1 - Math.pow(1 + i, -n)) / i / Math.pow(1 + i, ext); if (v > pv) lo = i; else hi = i; }
    return (lo + hi) / 2 * 100;
  }
  function addDias(iso, n) { if (!iso) return '9999'; const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }

  /* ===================== CONTRATO (PDF do banco) ===================== */
  async function textoPdf(pdf) {
    let t = '';
    for (let p = 1; p <= pdf.numPages; p++) t += linhas(await itensDaPagina(await pdf.getPage(p))).map(l => l.txt).join('\n') + '\n';
    return t;
  }
  function analisarContrato(t, nomeArq) {
    const T = t.replace(/\s+/g, ' '), tem = re => re.test(T), ach = re => (T.match(re) || [])[1];
    const R = { arquivo: nomeArq, imagem: T.replace(/\W/g, '').length < 300, itens: [], alertas: [] };
    if (R.imagem) { R.alertas.push({ nivel: 'medio', titulo: 'PDF sem texto (escaneado/foto)', tese: 'Não dá para ler automaticamente. Abra e confira manualmente: assinatura, seguro, data/hora e testemunhas.' }); return R; }
    R.banco = ach(/(BANCO [A-ZÀ-Ú0-9 .&]{3,40}?(S\.?\/?A\.?|LTDA))/i) || '';
    R.contrato = ach(/(?:CCB|C[ée]dula|Contrato|Proposta|Opera[çc][ãa]o)\s*(?:n[ºo°.]*|n[úu]mero|:)?\s*[:\-]?\s*([A-Z]{0,4}\d[\d.\-\/]{5,})/i) || '';
    R.cpf = ach(/(\d{3}\.?\d{3}\.?\d{3}-?\d{2})/) || '';
    const ok = (nome, cond, obs, peso) => R.itens.push({ nome, ok: !!cond, obs: obs || '', peso: peso || 'medio' });
    const valor = re => { const v = ach(re); return v ? Number(v.replace(/\./g, '').replace(',', '.')) : null; };
    // 1-6: informações obrigatórias (CDC art. 52, Res. CMN 4.881/3.517 – CET, IN 138/2022)
    ok('Identificação do cliente (nome e CPF)', R.cpf, R.cpf);
    ok('Número do contrato/CCB', R.contrato, R.contrato);
    ok('Valor total financiado', tem(/valor (total )?(do )?(empr[ée]stimo|financiado|da opera|do cr[ée]dito|total)/i));
    ok('Valor líquido liberado ao cliente', tem(/valor (l[ií]quido|liberado|creditado|a ser creditado|do cr[ée]dito)/i));
    ok('Taxa de juros mensal e anual', tem(/juros.{0,40}(mensal|a\.?\s?m)/i) && tem(/(anual|a\.?\s?a\.?)/i));
    ok('CET (Custo Efetivo Total)', tem(/CET|custo efetivo total/i), '', 'alto');
    ok('IOF discriminado', tem(/IOF/));
    ok('Quantidade e valor das parcelas', tem(/parcela/i) && tem(/(quantidade|n[úu]mero|prazo).{0,30}parcela|parcelas?.{0,20}\d{2,3}/i));
    ok('Conta de crédito do valor (banco/agência/conta)', tem(/ag[êe]ncia/i) && tem(/conta/i));
    ok('Autorização expressa de desconto no benefício', tem(/autoriz.{0,80}(desconto|consigna).{0,80}benef/i) || tem(/desconto.{0,60}benef[ií]cio.{0,60}autoriz/i), '', 'alto');
    // assinatura
    const icp = tem(/ICP-?Brasil|certificado digital/i), bio = tem(/biometria|selfie|reconhecimento facial|liveness|prova de vida/i),
      geo = tem(/geolocaliza|latitude|longitude/i), ip = tem(/\bIP\b|endere[çc]o IP|\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/), hash = tem(/hash|SHA-?256|c[óo]digo de verifica/i),
      dh = ach(/(\d{2}\/\d{2}\/\d{4}\s*(?:às|as|-|,)?\s*\d{2}:\d{2}(?::\d{2})?)/i), eletr = tem(/assinatura eletr[ôo]nica|assinado eletronicamente|assinado digitalmente|clicksign|docusign|zapsign|d4sign|unico|idwall/i);
    R.assinatura = icp ? 'Eletrônica qualificada (ICP-Brasil)' : eletr || bio ? 'Eletrônica avançada' : 'Física/manuscrita (ou não identificada)';
    ok('Tipo de assinatura identificado', icp || eletr || bio, R.assinatura, 'alto');
    if (eletr || bio) {
      ok('Biometria facial / selfie com prova de vida', bio);
      ok('Geolocalização registrada', geo);
      ok('IP registrado', ip);
      ok('Data e hora da assinatura', dh, dh || '');
      ok('Hash / código de integridade do documento', hash);
    }
    // seguro e encargos embutidos
    const seguro = tem(/seguro prestamista|prestamista|seguro de prote[çc][ãa]o financeira|seguro de vida/i), pacote = tem(/pacote de benef[ií]cios|assist[êe]ncia (funeral|residencial|sa[úu]de)|clube de benef|capitaliza[çc][ãa]o/i), tarifa = tem(/tarifa de cadastro|TAC\b|tarifa de abertura/i);
    const D = detectarSeguro(t, nomeArq), $R = v => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    R.seguroValor = D.totalSeguro; R.pacoteValor = D.totalPacote;
    if (D.totalSeguro > 0) R.alertas.unshift({ nivel: 'alto', titulo: '✅ TEM SEGURO PRESTAMISTA: ' + $R(D.totalSeguro), tese: 'Onde achou: “' + D.seguro.map(x => x.trecho).join(' | ') + '”. Seguro embutido no empréstimo: conferir termo de adesão separado com opção de recusa e livre escolha da seguradora. Sem isso, venda casada (CDC art. 39, I; STJ Tema 972) — restituição em dobro e dano moral.' });
    else if (seguro) R.alertas.push({ nivel: 'info', titulo: 'Contrato cita seguro prestamista, mas sem valor cobrado', tese: 'Aparece só em cláusula ou com valor zerado / marcado NÃO. Se tiver dúvida, abra o PDF e confira o quadro de valores.' });
    if (D.totalPacote > 0) R.alertas.unshift({ nivel: 'alto', titulo: '✅ TEM PACOTE DE BENEFÍCIOS: ' + $R(D.totalPacote), tese: 'Onde achou: “' + D.pacote.map(x => x.trecho).join(' | ') + '”. Produto adicional embutido no consignado: típico de venda casada (CDC art. 39, I). Pedir devolução em dobro.' });
    else if (pacote) R.alertas.push({ nivel: 'info', titulo: 'Contrato cita pacote/assistência, mas sem valor cobrado', tese: 'Conferir no PDF se houve cobrança.' });
    const vTar = (T.match(/tarifa de (?:cadastro|abertura)[^R\d]{0,20}(?:R\$\s*)?([\d.]+,\d{2})/i) || [])[1];
    if (tarifa && (!vTar || Number(vTar.replace(/\./g, '').replace(',', '.')) > 0)) R.alertas.push({ nivel: 'medio', titulo: 'Tarifa de cadastro/abertura cobrada', tese: 'Verificar legalidade da tarifa (Res. CMN 3.919/2010; STJ Temas 618/620): só é válida no início do relacionamento e se prevista.' });
    if (tem(/cart[ãa]o de cr[ée]dito consignado|reserva de margem consign[áa]vel|\bRMC\b|\bRCC\b|cart[ãa]o benef[ií]cio/i)) R.alertas.push({ nivel: 'alto', titulo: 'Contrato de cartão consignado (RMC/RCC)', tese: 'Verificar se o cliente foi informado de que contratava CARTÃO e não empréstimo (dever de informação, CDC arts. 6º, III, e 52). Tese de conversão em empréstimo consignado e devolução em dobro.' });
    if (tem(/a rogo|testemunha/i)) R.alertas.push({ nivel: 'info', titulo: 'Contrato com assinatura a rogo / testemunhas', tese: 'Cliente possivelmente analfabeto: conferir se há assinatura a rogo E duas testemunhas identificadas (CC art. 595). Sem isso, o contrato é nulo.' });
    else if (!(icp || eletr || bio)) R.alertas.push({ nivel: 'medio', titulo: 'Se o cliente for analfabeto: falta assinatura a rogo e testemunhas', tese: 'Contrato com analfabeto exige assinatura a rogo e duas testemunhas (CC art. 595 — STJ). Perguntar ao cliente se sabe ler e escrever.' });
    if (tem(/curador|tutor|representante legal|guardi[ãa]o/i)) R.alertas.push({ nivel: 'alto', titulo: 'Contratado por representante legal', tese: 'Contrato assinado por curador/tutor/representante: exige alvará judicial (CC arts. 1.691, 1.748, 1.774; IN 190/2025). Sem alvará: nulidade.' });
    if (tem(/procura[çd]/i) && tem(/procurador/i)) R.alertas.push({ nivel: 'medio', titulo: 'Contratação por procurador', tese: 'Desde 19/05/2026 é vedada a contratação de consignado mediante procuração de terceiros.' });
    if ((eletr || bio) && !bio) R.alertas.push({ nivel: 'alto', titulo: 'Assinatura eletrônica sem biometria', tese: 'Contrato eletrônico sem prova de biometria/selfie e prova de vida: a jurisprudência só valida a contratação digital com mecanismos idôneos de identificação (IN 138/2022). Sem isso, tese de inexistência/fraude.' });
    if ((eletr || bio) && !geo && !ip) R.alertas.push({ nivel: 'medio', titulo: 'Sem geolocalização/IP no registro da assinatura', tese: 'Falta de trilha de auditoria (IP, geolocalização, data/hora) enfraquece a prova do banco. Útil para pedir perícia/inversão do ônus (CDC art. 6º, VIII).' });
    R.itens.filter(i => !i.ok && i.peso === 'alto').forEach(i => R.alertas.push({ nivel: 'alto', titulo: 'Falta no contrato: ' + i.nome, tese: 'Informação/requisito obrigatório ausente — falha no dever de informação (CDC arts. 6º, III, 31 e 52) e na forma exigida pela IN PRES/INSS 138/2022.' }));
    const peso = { alto: 0, medio: 1, info: 2 }; R.alertas.sort((a, b) => peso[a.nivel] - peso[b.nivel]);
    return R;
  }

  /* ===================== LOTE: seguro prestamista / pacote de benefícios ===================== */
  // procura os rótulos e o valor em R$ logo depois; ignora IOF, taxas (%), valores zerados e cláusulas sem valor
  const ROT_SEGURO = /(seguro\s+prestamista|prestamista|seguro\s+de\s+prote[çc][ãa]o\s+financeira|seguro\s+de\s+vida|pr[êe]mio\s+(?:do\s+)?seguro|valor\s+(?:do\s+)?seguro|seguro\s+(?:financiado|contratado)|\bseguros?\b)/gi;
  const ROT_PACOTE = /(pacote\s+de\s+benef[ií]cios|cesta\s+de\s+(?:servi[çc]os|benef[ií]cios)|assist[êe]ncia\s+(?:funeral|residencial|sa[úu]de|odontol[óo]gica|farm[áa]cia|24h)|clube\s+de\s+(?:benef[ií]cios|vantagens)|t[íi]tulo\s+de\s+capitaliza[çc][ãa]o|capitaliza[çc][ãa]o|plano\s+de\s+benef[ií]cios|benef[ií]cios?\s+adicionais)/gi;
  const NUM = /(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2})(?!\s*%)/g;
  function acharValores(T, rot) {
    const achados = [];
    let m; rot.lastIndex = 0;
    while ((m = rot.exec(T))) {
      const ini = m.index, janela = T.slice(ini, ini + 170);
      // corta a janela no próximo rótulo de outra coisa (IOF, juros, CET, liberado, parcela, total)
      const corte = janela.slice(m[0].length).search(/\b(IOF|CET|juros|taxa|liberad|parcela|total\s+(?:financiado|do\s+empr)|tarifa|TAC|l[íi]quido|creditad|quita[çc]|saldo|refinanci|retido|portado|devedor|\d{2}\/\d{2}\/\d{4}|valor\s+(?:da|das|do)\s+(?:opera|parcel|princip))/i);
      const trecho = corte >= 0 ? janela.slice(0, m[0].length + corte) : janela;
      if (/\bIOF\s*(?:do|da|de|sobre|s\/)?\s*(?:o\s+)?$/i.test(T.slice(Math.max(0, ini - 25), ini))) continue;
      const depois = T.slice(ini + m[0].length, ini + m[0].length + 60), antes2 = T.slice(Math.max(0, ini - 30), ini);
      if (/^[^\d]{0,6}(,?\s*se (contratad|houver|aplic)|\s*n[ãa]o [ée] obrigat|\s*poder[áa]|\s*apartad|\s*para quita)/i.test(depois) || /(abatido o|cancelar.{0,20}|contratar)\s*$/i.test(antes2)) continue;
      if (/\(\s*\)\s*SIM\s*\(\s*X\s*\)\s*N[ÃA]O/i.test(T.slice(ini, ini + 80))) continue;   // marcado "NÃO" no quadro         // "IOF do seguro" etc.
      let n; NUM.lastIndex = 0;
      while ((n = NUM.exec(trecho))) {
        const v = Number(n[1].replace(/\./g, '').replace(',', '.'));
        const antes = trecho.slice(Math.max(0, n.index - 18), n.index);
        if (/IOF|CET|juros/i.test(antes)) continue;
        const meio = trecho.slice(m[0].length, n.index);
        if (/\.\s+[A-ZÀ-Ú]|\b(declar|autoriz|poder|ser[áa]|caso|cl[áa]usula|termo)/i.test(meio) || meio.split(/\s+/).length > 9) break; // texto de cláusula, não valor
        if (v === 0) break;                                        // valor zerado = não contratado
        if (v > 0) { achados.push({ v, trecho: trecho.slice(0, n.index + n[0].length).trim() }); break; }
      }
    }
    return achados;
  }
  function detectarSeguro(texto, arquivo) {
    const T = texto.replace(/\s+/g, ' ');
    const r = { arquivo, imagem: T.replace(/\W/g, '').length < 60 };
    r.cpf = (T.match(/(\d{3}\.\d{3}\.\d{3}-\d{2})/) || [])[1] || '';
    r.nome = ((T.match(/(?:Nome(?: completo)?|Emitente|Cliente|Tomador|Contratante|Mutu[áa]rio)\s*[:\-]?\s*([A-ZÀ-Ú][A-ZÀ-Ú ]{6,60}?)(?=\s+(?:CPF|RG|Data|Nacionalidade|Estado|Endere|Sexo|N[ºo°]|\d))/) || [])[1] || '').trim();
    const bm = T.match(/(BANCO [A-ZÀ-Ú0-9 .&]{2,30}?(?:S\.?\/?A\.?|LTDA))|(FACTA|C6|AGIBANK|PAN|BMG|MERCANTIL|PARAN[ÁA] BANCO|QI SOCIEDADE|BANRISUL|DAYCOVAL|SAFRA|INBURSA|PICPAY|PRESEN[ÇC]A|BRB|CREFISA|OL[ÉE]|ITA[ÚU]|BRADESCO|SANTANDER|CAIXA|BANCO DO BRASIL|PINE|SEGUE|FINANTO|QUALI)/i);
    r.banco = bm ? (bm[1] || bm[2]).toUpperCase().replace(/\s+/g, ' ') : '';
    const vistos = new Set(), uniq = a => a.filter(x => { const k = x.v.toFixed(2); if (vistos.has(k)) return false; vistos.add(k); return true; });
    r.seguro = uniq(acharValores(T, ROT_SEGURO));
    r.pacote = uniq(acharValores(T, ROT_PACOTE));
    // layout tipo Paraná Banco: rótulos num bloco e valores preenchidos depois ("15,06 X 95,43 ...")
    if (!r.seguro.length && /Seguro Prestamista\*?\s*\(\s*X?\s*\)\s*SIM.{0,40}Valor do Seguro R\$/i.test(T)) {
      const i = T.search(/Valor do Seguro R\$/i), bloco = T.slice(i, i + 900);
      const mx = bloco.match(/\d,\d{2}\s+X\s+(\d{1,3}(?:\.\d{3})*,\d{2})/) || bloco.match(/\(\s*X\s*\)\s*SIM.{0,60}?R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2})/i);
      const v = mx ? Number(mx[1].replace(/\./g, '').replace(',', '.')) : 0;
      if (v > 0) r.seguro.push({ v, trecho: 'Quadro "Seguro Prestamista (X) SIM" · valor ' + mx[1] + ' (conferir)' });
    }
    // PDFs que quebram palavras ("Prestam ista", "Seg uro"): tenta no texto sem espaços
    if (!r.seguro.length) {
      const C = T.replace(/\s+/g, '');
      const mc = C.match(/(?:ValordoSeguro|Pr[êe]miodoSeguro|SeguroPrestamista|ValordoPr[êe]mio)R?\$?:?(\d{1,3}(?:\.\d{3})*,\d{2})(?!%)/i);
      const naoMarcado = /\(\)SIM\(X\)N[ÃA]O/i.test(C);
      const v = mc ? Number(mc[1].replace(/\./g, '').replace(',', '.')) : 0;
      if (v > 0 && !naoMarcado) r.seguro.push({ v, trecho: 'Seguro ' + mc[1] + ' (texto quebrado no PDF — conferir)' });
    }
    r.totalSeguro = r.seguro.reduce((a, x) => a + x.v, 0); r.totalPacote = r.pacote.reduce((a, x) => a + x.v, 0);
    r.tem = r.totalSeguro > 0 || r.totalPacote > 0;
    return r;
  }
  root.detectarSeguro = detectarSeguro;
  root.textoPdf = textoPdf; root.analisarContrato = analisarContrato;
  root.lerHiscon = lerHiscon; root.analisarHiscon = analisarHiscon;
  if (typeof module !== 'undefined') module.exports = { lerHiscon, analisarHiscon };
})(typeof window !== 'undefined' ? window : globalThis);
