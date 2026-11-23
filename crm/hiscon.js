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
    // fim da tabela: a nota de rodapé ("*Contratos que…"). Quando a tabela continua na página seguinte não há nota:
    // vai até o fim da página (y é negativo para baixo) e o rodapé é cortado depois, pela distância à última linha
    const fimL = ls.find(l => l.y < yCab && /^\*/.test(l.txt.trim())), fimY = fimL ? fimL.y : -1e9;
    let corpo = itens.filter(i => i.y < yCab - 1 && i.y > fimY + 1);
    // âncoras: célula de situação
    const xSit = centros[2];
    const anc = corpo.filter(i => Math.abs(i.x + i.w / 2 - xSit) < 25 && /^(Ativo|Exclu|Suspen|Encerr|Reserv|Inativ)/i.test(i.s.trim())).sort((a, b) => b.y - a.y);
    if (!anc.length) return [];
    if (!fimL) {
      const gaps = anc.slice(1).map((a, k) => anc[k].y - a.y).sort((p, q) => p - q), gap = gaps.length ? gaps[Math.floor(gaps.length / 2)] : 50;
      const lim = anc[anc.length - 1].y - Math.max(22, gap * 0.6);
      corpo = corpo.filter(i => i.y > lim);
    }
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
  // histórico do teto do CNPS (empréstimo) — data de vigência → teto % a.m.
  // revisto em 22/11/2026: 2,14% de mar/2017 a nov/2017; 2,08% até mar/2020 (faltava este degrau); 1,80% na pandemia (até dez/2021); 2,14% de jan/2022 a mar/2023;
  // 1,70% por duas semanas em mar/2023; depois as reduções de 2023-24 e as altas de 2025. A mesma tabela está em contrato-irreg.js (TETO_EMP): mudou aqui, mude lá.
  const TETOS = [['2017-04-01', 2.14], ['2017-11-09', 2.08], ['2020-03-23', 1.80], ['2022-01-01', 2.14], ['2023-03-16', 1.70], ['2023-03-28', 1.97], ['2023-08-25', 1.91], ['2023-10-23', 1.84], ['2023-12-04', 1.80], ['2024-01-11', 1.76],
    ['2024-02-28', 1.72], ['2024-04-24', 1.68], ['2024-05-27', 1.66], ['2025-01-09', 1.80], ['2025-03-25', 1.85]];
  // vale o MAIOR teto que esteve em vigor nos 15 dias antes da averbação: o contrato é assinado alguns dias antes de aparecer no extrato,
  // e assim nem a queda nem a alta do teto geram apontamento errado (antes, na alta, o teto antigo e menor ainda valia por 10 dias)
  const tetoEm = d => { if (!d || d < TETOS[0][0]) return null; const de = new Date(new Date(d).getTime() - 15 * 864e5).toISOString().slice(0, 10); let t = null; TETOS.forEach(([ini, v], i) => { const fim = (TETOS[i + 1] || ['9999'])[0]; if (ini <= d && fim > de) t = Math.max(t || 0, v); }); return t; };
  const ESPECIES_VEDADAS = { '9': 'complemento acidente do trabalho rural', '10': 'auxílio-doença acidentário rural', '13': 'auxílio-doença rural', '15': 'auxílio-reclusão rural', '25': 'auxílio-reclusão', '31': 'auxílio por incapacidade temporária (auxílio-doença)', '35': 'auxílio-doença ex-combatente', '36': 'auxílio-acidente previdenciário', '39': 'auxílio-invalidez estudante', '47': 'abono de permanência', '48': 'abono de permanência', '50': 'auxílio-doença (plano básico)', '53': 'auxílio-reclusão (plano básico)', '61': 'auxílio-natalidade', '62': 'auxílio-funeral', '63': 'auxílio-funeral rural', '64': 'auxílio-funeral', '91': 'auxílio-doença acidentário', '94': 'auxílio-acidente' };
  const BANCOS_TERMO = /caixa|inter\b|077|facta|935|cobuccio|picpay|380|inbursa|012 /i;
  const IN204 = '2026-05-19';                        // prazo máx. 108x + anuência biométrica no Meu INSS (a selfie no contrato é de 2023)
  const IN190 = '2025-07-16';                        // volta da autorização judicial p/ representante de incapaz
  const fmt = v => v == null ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const dBR = s => s ? s.split('-').reverse().join('/') : '—';
  const meses = (a, b) => { if (!a || !b) return null; const [y1, m1] = a.split('-').map(Number), [y2, m2] = b.split('-').map(Number); return (y2 - y1) * 12 + (m2 - m1); };
  const id = c => `${c.contrato} (${c.banco})`;

  function analisarHiscon(h) {
    const A = [], add = (nivel, titulo, tese, contratos, detalhe) => A.push({ nivel, titulo, tese, contratos: contratos || [], detalhe: detalhe || '' });
    const C = h.contratos, vistos = new Set(), U = C.filter(c => { const k = c.contrato + '|' + c.emprestado; if (vistos.has(k)) return false; vistos.add(k); return true; }), ativos = C.filter(c => c.tipo === 'ativo'), novos = C.filter(c => /nova/i.test(c.origem));

    // 0. espécie que não admite consignado (IN 138, Anexo II)
    const esp = String(Number(h.especie || 0));
    if (ESPECIES_VEDADAS[esp] && C.length) A.unshift({ nivel: 'alto', titulo: `⚠️ Benefício que não admite consignado (espécie ${esp})`, tese: `A espécie ${esp} — ${ESPECIES_VEDADAS[esp]} — está no Anexo II da IN PRES/INSS 138/2022 (espécies não permitidas). Nenhum empréstimo ou cartão poderia ter sido averbado: nulidade de todos os contratos, devolução em dobro e dano moral.`, contratos: C.map(id), detalhe: `${C.length} contrato(s) averbado(s) em benefício não elegível.` });
    // carência acima do permitido (até 90 dias adicionais ao prazo normal)
    U.forEach(c => { if (c.inclusao && c.primeiro) { const d = Math.round((new Date(c.primeiro) - new Date(c.inclusao)) / 864e5); const vedada = c.inclusao >= '2022-12-13' && c.inclusao < IN204; if (d > (vedada ? 100 : 150)) add('medio', 'Carência longa antes da 1ª parcela', vedada ? 'Entre dez/2022 e 18/05/2026 a norma do INSS proibia carência no consignado (IN PRES/INSS 138/2022, art. 12, IV, revogado só pela IN 204/2026). Intervalo longo até o primeiro desconto faz os juros correrem sem pagamento e aumenta a dívida: conferir no contrato se houve carência e pedir o recálculo sem ela.' : c.inclusao >= IN204 ? 'Desde 19/05/2026 o início dos descontos pode ser adiado em até 3 meses, com autorização do beneficiário e comunicação por escrito (IN PRES/INSS 138/2022, art. 5º, § 16, incluído pela IN 204/2026). Carência maior, ou sem essa autorização, faz os juros correrem sem pagamento e aumenta a dívida — verificar se foi informada e pedida pelo cliente.' : 'Intervalo longo entre a averbação e o primeiro desconto: os juros correm sem pagamento e aumentam a dívida. A norma do INSS só admitiu carência em períodos específicos — verificar no contrato se ela foi informada e pedida pelo cliente.', [id(c)], `${d} dias entre a inclusão (${dBR(c.inclusao)}) e o 1º desconto (${dBR(c.primeiro)}).`); } });

    // 1. representante legal / incapaz
    if (h.representante) {
      const apos = C.filter(c => c.inclusao && c.inclusao >= IN190);
      add('alto', 'Benefício com representante legal (incapaz/menor)', 'Contrato feito em benefício de incapaz/menor exige autorização judicial (CC arts. 1.691, 1.748, 1.774 e 1.781; IN PRES/INSS 190/2025 após ACP do MPF/TRF-3). Sem alvará, cabe pedido de nulidade, devolução dos descontos e dano moral.',
        C.map(id), 'Vale para contratos de qualquer data.' + (apos.length ? ` ${apos.length} deles após 16/07/2025 (publicação da IN 190), quando o INSS voltou a exigir alvará judicial expressamente (reforça a tese).` : ' Conferir se havia alvará judicial na contratação.'));
      if (h.bpc && C.length) A.unshift({ nivel: 'alto', titulo: '⚠️ LOAS/BPC com representante legal — prioridade', tese: 'Qualquer empréstimo em BPC/LOAS recebido por representante legal (curador, tutor, pai/mãe de menor ou incapaz) é forte candidato à nulidade, em qualquer data: o dinheiro do incapaz só pode ser comprometido com autorização judicial (CC arts. 1.691, 1.748 e 1.774), e o benefício assistencial é verba alimentar de quem não tem outra renda. Pedir nulidade de todos os contratos, devolução dos descontos e dano moral.', contratos: C.map(id), detalhe: `${C.length} contrato(s) no extrato — todos entram, independentemente da data.` });
      if (C.some(c => c.inclusao >= '2026-04-01')) add('alto', 'Benefício com representante legal: contrato novo depois da trava de abr/2026', 'Segundo a regra divulgada pelo INSS, desde 1º/04/2026 não se averba consignado novo em benefício pago a representante legal nem em nome de menor de idade, em qualquer espécie de benefício (inclusive BPC). Contrato incluído depois dessa data não deveria existir: pedir ao banco a prova de quem autorizou e como a operação passou pela trava.', C.filter(c => c.inclusao >= '2026-04-01').map(id));
    }
    if (h.procurador) { const pr = C.filter(c => c.inclusao >= '2022-12-13'), lei = pr.filter(c => c.inclusao >= '2026-01-07').length; add('medio', 'Benefício recebido por procurador', 'Procurador não pode autorizar desconto de consignado: a norma do INSS já vedava (IN PRES/INSS 138/2022, art. 5º, § 4º) e, desde 07/01/2026, a lei proíbe contratar ou desbloquear o benefício por procuração ou por central telefônica (Lei 8.213/1991, art. 115, § 13, incluído pela Lei 15.327/2026). Verificar quem assinou cada contrato.', pr.map(id), pr.length ? `${pr.length} contrato(s) desde dez/2022` + (lei ? `, ${lei} já na vigência da lei de 2026.` : '.') : ''); }

    // 2. valor zerado / não liberado
    novos.forEach(c => {
      if ((c.liberado == null || c.liberado === 0) && c.emprestado > 0 && !c.pago)
        add('alto', 'Contrato novo sem valor liberado', 'Averbação nova com valor liberado zerado: o cliente pode não ter recebido o dinheiro. Tese de inexistência/nulidade do contrato, repetição do indébito em dobro (CDC art. 42) e dano moral.', [id(c)], `Emprestado ${fmt(c.emprestado)}, liberado ${fmt(c.liberado)}.`);
    });

    // 3. diferença não explicada (seguro prestamista / tarifas embutidas)
    U.forEach(c => {
      if (c.emprestado && c.liberado > 0) {
        const dif = c.emprestado - c.liberado - (c.iof || 0) - (c.pago || 0);
        if (dif > 20) add('alto', 'Valor financiado maior que o liberado (possível seguro/tarifa embutida)', 'Diferença entre valor emprestado e (liberado + IOF + dívida paga) indica cobrança embutida — típico de seguro prestamista ou "pacote de benefícios". No consignado do INSS isso é vedado: a IN PRES/INSS 138/2022 (art. 12, V) proíbe incluir o prêmio de seguro prestamista nos descontos, e condicionar o empréstimo ao seguro é venda casada (CDC, art. 39, I; STJ, Tema 972). Pedir o contrato para confirmar.' + (BANCOS_TERMO.test(c.banco || '') ? ' ⭐ Este banco assinou Termo de Compromisso com o INSS para suspender o seguro prestamista e restituir os valores cobrados — reforça muito o pedido.' : ''), [id(c)], `Diferença de ${fmt(dif)} (${(dif / c.emprestado * 100).toFixed(1)}% do contrato).`);
      }
      if (c.cetM && c.jurosM && c.cetM - c.jurosM >= 0.25) add('medio', 'CET bem acima dos juros', 'CET muito maior que a taxa de juros sugere encargos embutidos (seguro, tarifa). Reforça a análise de seguro prestamista/venda casada.', [id(c)], `Juros ${c.jurosM}% a.m. x CET ${c.cetM}% a.m.`);
    });

    // 3b. taxa implícita (calculada pela parcela x prazo x valor) maior que a declarada
    U.forEach(c => {
      if (!(c.emprestado > 0 && c.parcela > 0 && c.parcelas > 0) || c.tipo === 'excluido') return;
      const dias = c.inclusao && c.primeiro ? Math.max(30, (new Date(c.primeiro) - new Date(c.inclusao)) / 864e5) : 30;
      const r = taxaImplicita(c.emprestado - (c.iof || 0), c.parcela, c.parcelas, dias);
      if (r != null && c.cetM && r - c.cetM > 0.15) add('alto', 'Parcela maior do que a taxa informada permite', 'Recalculando pela parcela, prazo e valor financiado, a taxa real fica acima da taxa/CET informados — indica encargo oculto (seguro, tarifa) ou cálculo irregular. Cabe revisão e devolução da diferença em dobro (CDC art. 42).', [id(c)], `Taxa real ≈ ${r.toFixed(2)}% a.m. x CET informado ${c.cetM}% a.m.`);
      { const t = tetoEm(c.inclusao); if (r != null && t && r > t + 0.15 && !(c.jurosM > t)) add('alto', 'Taxa real acima do teto do INSS', `Pela parcela e prazo, a taxa efetiva passa do teto do CNPS vigente na contratação (${t}% a.m.). O STF confirmou que o INSS pode fixar esse teto (ADI 7.759, julgamento encerrado em 28/08/2026).`, [id(c)], `≈ ${r.toFixed(2)}% a.m. em ${dBR(c.inclusao)} (teto ${t}%).`); }
    });

    // 4. juros acima do teto
    U.forEach(c => { const t = tetoEm(c.inclusao); if (t && c.jurosM > t + 0.001) add('alto', 'Juros acima do teto do INSS na data da contratação', `O teto do CNPS muda com o tempo; na data deste contrato era ${t}% a.m. Juros acima do teto vigente: revisão do contrato e restituição do excedente, com pedido de devolução em dobro (STJ, Tema 929). O STF confirmou que o INSS pode fixar esse teto (ADI 7.759, julgamento encerrado em 28/08/2026).`, [id(c)], `${c.jurosM}% a.m. em ${dBR(c.inclusao)} — teto da época ${t}% a.m.`); });

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
    Object.entries(porDia).forEach(([d, g]) => { if (g.length > 1 && d >= IN204) add('alto', 'Mais de um contrato no mesmo dia (após bloqueio automático)', 'Pela lei de 2026, cada contratação bloqueia o benefício de novo e exige outro desbloqueio, com biometria e anuência no Meu INSS (Lei 8.213/1991, art. 115, §§ 9º e 12, incluídos pela Lei 15.327/2026). Dois ou mais contratos no mesmo dia são forte indício de contratação sem a participação do cliente. Pedir prova da anuência/biometria de cada um (ônus do banco).', g.map(id), dBR(d)); else if (g.length > 1 && new Set(g.map(c => c.parcela)).size > 1) add('medio', 'Vários contratos novos no mesmo dia', 'Mais de uma averbação nova na mesma data: verificar se o cliente reconhece todas (possível contratação não solicitada).', g.map(id), dBR(d)); });

    // 7. refinanciamento / portabilidade em sequência (giro de carteira)
    C.filter(c => c.tipo === 'excluido' && /refinanc|portab/i.test(c.motivoExcl)).forEach(c => {
      const m = meses(c.inclusao, c.exclusao), dias = c.inclusao && c.exclusao ? Math.round((new Date(c.exclusao) - new Date(c.inclusao)) / 864e5) : null;
      if (dias != null && dias <= 10) add('medio', 'Contrato trocado em poucos dias', 'Contrato portado/refinanciado poucos dias depois de incluído: típico de operação casada (portabilidade + refinanciamento) para gerar comissão, sem benefício real ao cliente. Falha no dever de informação e prática abusiva (CDC arts. 6º, III, e 39, V). Serve de reforço para outra tese; sozinho não sustenta a ação.', [id(c)], `Incluído em ${dBR(c.inclusao)} e excluído em ${dBR(c.exclusao)} (${dias} dia(s)) — ${c.motivoExcl}.`);
      else if (m != null && m < 12) add('info', 'Refinanciado/portado antes de 12 meses', 'Refinanciamentos e portabilidades sucessivos em pouco tempo ("giro de carteira") podem configurar prática abusiva e falha no dever de informação (CDC arts. 6º, III, e 39). Verificar se houve troco real ao cliente. É argumento de apoio: sozinho não sustenta a ação.', [id(c)], `Incluído em ${dBR(c.inclusao)}, excluído em ${dBR(c.exclusao)} (${m} meses) — ${c.motivoExcl}.`);
    });
    C.filter(c => /refinanc/i.test(c.origem) && c.pago && c.emprestado && c.emprestado - c.pago - (c.iof || 0) < 50)
      .forEach(c => add('medio', 'Refinanciamento sem troco', 'Refinanciamento em que praticamente todo o valor quitou a dívida anterior — o cliente não recebeu dinheiro novo e teve o prazo/juros estendidos.', [id(c)], `Emprestado ${fmt(c.emprestado)}, dívida paga ${fmt(c.pago)}.`));

    // 8. cartão consignado RMC/RCC
    const cart = [...h.cartoes.RMC.map(c => ({ ...c, t: 'RMC' })), ...h.cartoes.RCC.map(c => ({ ...c, t: 'RCC' }))];
    if (cart.length) add('alto', `Cartão consignado ativo (${cart.map(c => c.t).join(' + ')})`, 'Tese do cartão consignado (RMC/RCC): o cliente acha que contratou empréstimo e paga só o mínimo, gerando dívida que não acaba. Pedido de nulidade ou conversão em empréstimo consignado, devolução em dobro dos descontos e dano moral (dever de informação, CDC arts. 6º, III, 31 e 52). ATENÇÃO: o assunto está no Tema 1.414 do STJ, ainda sem julgamento. A suspensão nacional dos processos sobre validade e abusividade do cartão consignado foi determinada em março/2026 e confirmada pela Segunda Seção em 08/04/2026 (só os cumprimentos de sentença seguem). Em 02/10/2026 o tema passou a incluir o prazo para pedir (decadência de 4 anos do art. 178 do Código Civil, ou nenhum prazo, por se tratar de nulidade) e o dano moral presumido (o Tema 1.328 foi incorporado). A ação pode ficar parada até o julgamento: avalie com o cliente antes de entrar. Há tribunais que não suspendem quando o pedido é de inexistência da contratação (o cliente nunca pediu cartão), e não de conversão em empréstimo.', cart.map(c => `${c.t} incluído em ${dBR(c.inclusao)} — limite ${fmt(c.limite)}, reserva ${fmt(c.reservado)}`));
    cart.forEach(k => {
      const mesmoDia = U.filter(c => c.inclusao && k.inclusao && Math.abs(new Date(c.inclusao) - new Date(k.inclusao)) <= 3 * 864e5);
      if (mesmoDia.length) add('alto', `Cartão ${k.t} contratado junto com empréstimo`, 'Cartão consignado averbado no mesmo dia (ou em até 3 dias) de um empréstimo: forte indício de venda casada — o cliente pediu empréstimo e recebeu também um cartão (CDC art. 39, I). Pedido de cancelamento, devolução em dobro dos descontos do cartão e dano moral.', mesmoDia.map(id), `${k.t} incluído em ${dBR(k.inclusao)}.`);
    });
    // TCU Acórdão 1094/2026 (cautelar, fim de abr/2026): novas operações de RMC/RCC suspensas
    // refinanciamento/portabilidade que mantém a parcela e estica o prazo (TJMT/TJPR: nulidade por vício de consentimento)
    C.filter(c => /refinanc|portab/i.test(c.origem) && c.inclusao && c.parcela && c.parcelas).forEach(c => {
      const ant = C.find(e => e !== c && e.exclusao && /refinanc|portab/i.test(e.motivoExcl || '') && e.parcela && e.parcelas
        && Math.abs(new Date(e.exclusao) - new Date(c.inclusao)) <= 5 * 864e5 && Math.abs(e.parcela - c.parcela) / e.parcela <= 0.08);
      if (!ant) return;
      const restantes = ant.inicio && ant.parcelas ? ant.parcelas - Math.max(0, meses(ant.inicio + '-01', c.inclusao) || 0) : ant.parcelas;
      if (c.parcelas >= restantes + 12) add('alto', 'Prazo esticado mantendo a mesma parcela', 'A operação manteve praticamente a mesma parcela, mas reiniciou/aumentou o prazo, com pouco ou nenhum dinheiro novo ao cliente. Os tribunais anulam quando a portabilidade/refinanciamento serve só para alongar a dívida sem vantagem e sem informação clara (vício de consentimento — CC art. 145; CDC arts. 6º, III, e 39). Pedir retorno ao contrato anterior, devolução em dobro e dano moral.', [id(ant), id(c)], `Parcela ${fmt(ant.parcela)} → ${fmt(c.parcela)}; faltavam ~${Math.max(0, restantes)} parcelas e o novo contrato tem ${c.parcelas}.`);
    });
    // IOF acima do máximo legal (PF: 0,38% + 0,0082%/dia limitado a 365 dias ≈ 3,38%)
    U.forEach(c => { if (c.iof && c.emprestado && c.emprestado > c.iof) { const p = c.iof / (c.emprestado - c.iof) * 100; if (p > 3.5) add('medio', 'IOF acima do máximo legal', 'Para pessoa física o IOF de empréstimo é 0,38% + 0,0082% ao dia, limitado a 365 dias (≈ 3,38% do valor). IOF maior indica cobrança indevida ou algo embutido na base (seguro/tarifa). Pedir restituição do excedente.', [id(c)], `IOF ${fmt(c.iof)} = ${p.toFixed(2)}% do valor.`); } });
    cart.filter(k => k.inclusao && k.inclusao >= '2026-04-29').forEach(k => add('alto', `Cartão ${k.t} contratado com a modalidade suspensa`, 'Novas operações de cartão de crédito consignado (RMC) e de cartão consignado de benefício (RCC) estão suspensas desde 29/04/2026 por medida cautelar do TCU (Acórdão 1.094/2026), mantida em 07/10/2026 (Acórdão 2.799/2026, que liberou só o empréstimo pessoal). A MP 1.355/2026, que previa o fim gradual dos cartões, perdeu a validade em 31/08/2026, mas a suspensão do TCU continua. Cartão novo averbado depois de 29/04/2026 é contratação irregular: pedir nulidade, devolução integral e atualizada dos descontos (Lei 15.327/2026, arts. 2º e 3º) e dano moral. Conferir antes se não é só a troca de banco de um cartão antigo.', [], `${k.t} incluído em ${dBR(k.inclusao)}.`));
    if (h.bpc && h.cartoes.RMC.length && h.cartoes.RCC.length) add('alto', 'BPC com RMC e RCC ao mesmo tempo', 'Para BPC (espécies 87/88) a margem de cartão é de 5% e o beneficiário pode optar por somente UMA modalidade (RMC ou RCC).', []);
    const desc = h.descontosCartao;
    // RMC/RCC "dívida que nunca acaba": descontos mensais e saldo que não cai
    const porBanco = {}; desc.forEach(d => { if (d.saldo != null) (porBanco[d.banco] = porBanco[d.banco] || []).push(d); });
    Object.entries(porBanco).forEach(([b, l]) => {
      if (l.length < 4) return; l.sort((a, z) => (a.competencia || '').localeCompare(z.competencia || ''));
      const ini = l[0].saldo, fim = l[l.length - 1].saldo, pago = l.reduce((x, d) => x + (d.desconto || 0), 0);
      if (ini > 0 && fim >= ini * 0.95 && pago > 0 && fim > (l[l.length - 1].desconto || 0) * 1.5) add('alto', 'Cartão consignado: saldo não diminui (dívida que nunca acaba)', 'Os descontos mensais só pagam o mínimo da fatura e o saldo devedor não cai. Os tribunais anulam ou convertem o cartão em empréstimo consignado comum, com devolução em dobro (CDC art. 42, parágrafo único) e dano moral — "empréstimo travestido de cartão".', [], `${b || 'Cartão'}: saldo ${fmt(ini)} → ${fmt(fim)} em ${l.length} meses, apesar de ${fmt(pago)} descontados.`);
    });
    if (desc.length >= 4) {
      const totDesc = desc.reduce((s, d) => s + (d.desconto || 0), 0);
      add('info', 'Descontos de cartão no período', 'Soma dos descontos de cartão listados no HISCON (base para cálculo de devolução).', [], `${desc.length} descontos, total ${fmt(totDesc)}.`);
    }

    // 9. margem extrapolada
    if (h.margem.extrapolada > 0 || (h.margem.extrapoladaModal || []).some(v => v > 0)) add('alto', 'Margem consignável extrapolada', 'Descontos acima do limite legal de comprometimento do benefício (Lei 10.820/2003, art. 6º, e Lei 8.213/1991, art. 115, VI). O limite é de 45% (35% para empréstimo, 5% para cartão de crédito e 5% para cartão benefício); no BPC, 35% (30% + 5%). Entre 19/05 e 31/08/2026 valeu o limite único de 40% da MP 1.355/2026, que perdeu a validade. Cabe pedido de adequação e devolução do excedente.', [], `Extrapolada: ${fmt(h.margem.extrapolada)}.`);

    // 10. BPC — informação
    if (h.bpc) add('info', 'Benefício assistencial (BPC/LOAS)', 'Consignado em BPC é permitido (Lei 14.431/2022, STF ADI 7.223), com margem de 30% + 5% de cartão. Atenção redobrada a vulnerabilidade: contratos abusivos têm forte apelo de dano moral.', []);
    if (h.bloqueado && C.some(c => c.inclusao && c.inclusao >= addDias(h.emissao, -90))) add('medio', 'Benefício bloqueado para empréstimo, mas com contrato recente', 'Benefício consta bloqueado; verificar se o contrato recente foi feito após o bloqueio (contratação irregular).', C.filter(c => c.inclusao >= addDias(h.emissao, -90)).map(id));

    // 11. contratos após biometria obrigatória
    const posBio = novos.filter(c => c.inclusao >= IN204);
    if (posBio.length) add('info', 'Contratos após a anuência biométrica no Meu INSS (19/05/2026)', 'Desde 19/05/2026 o titular tem de confirmar cada consignado por biometria facial no Meu INSS, em até 5 dias; sem a confirmação, a proposta é cancelada (Lei 8.213/1991, art. 115, § 9º, incluído pela Lei 15.327/2026; IN PRES/INSS 138/2022, art. 5º, IX e §§ 18 e 19). Desde ago/2026 (IN 213/2026) quem não tem biometria nas bases do governo pode confirmar com login Gov.br e dados bancários. Se o cliente não confirmou de nenhuma forma, o contrato é irregular. Isso não se confunde com a selfie no contrato, exigida desde 2023 (IN 138/2022).', posBio.map(id));

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
    if (D.totalSeguro > 0) R.alertas.unshift({ nivel: 'alto', titulo: '✅ TEM SEGURO PRESTAMISTA: ' + $R(D.totalSeguro), tese: 'Onde achou: “' + D.seguro.map(x => x.trecho).join(' | ') + '”. No consignado INSS a IN PRES/INSS 138/2022 (art. 12, V) proíbe vincular seguro prestamista ou outro produto ao empréstimo, com qualquer nome (proteção financeira, seguro de vida etc.). Também é venda casada (CDC art. 39, I; STJ Tema 972) — restituição em dobro e dano moral.' + (/caixa|inter\b|facta|cobuccio|picpay|inbursa/i.test(D.banco || '') ? ' ⭐ Este banco assinou Termo de Compromisso com o INSS para suspender o seguro e restituir os valores.' : '') });
    else if (seguro) R.alertas.push({ nivel: 'info', titulo: 'Contrato cita seguro prestamista, mas sem valor cobrado', tese: 'Aparece só em cláusula ou com valor zerado / marcado NÃO. Se tiver dúvida, abra o PDF e confira o quadro de valores.' });
    if (D.totalPacote > 0) R.alertas.unshift({ nivel: 'alto', titulo: '✅ TEM PACOTE DE BENEFÍCIOS: ' + $R(D.totalPacote), tese: 'Onde achou: “' + D.pacote.map(x => x.trecho).join(' | ') + '”. Produto adicional embutido no consignado: típico de venda casada (CDC art. 39, I). Pedir devolução em dobro.' });
    else if (pacote) R.alertas.push({ nivel: 'info', titulo: 'Contrato cita pacote/assistência, mas sem valor cobrado', tese: 'Conferir no PDF se houve cobrança.' });
    const vTar = (T.match(/tarifa de (?:cadastro|abertura)[^R\d]{0,20}(?:R\$\s*)?([\d.]+,\d{2})/i) || [])[1];
    if (tarifa && (!vTar || Number(vTar.replace(/\./g, '').replace(',', '.')) > 0)) R.alertas.push({ nivel: 'medio', titulo: 'Tarifa de cadastro/abertura cobrada', tese: 'Verificar legalidade da tarifa (Res. CMN 3.919/2010; STJ Temas 618/620): só é válida no início do relacionamento e se prevista.' });
    if (tem(/cart[ãa]o de cr[ée]dito consignado|reserva de margem consign[áa]vel|\bRMC\b|\bRCC\b|cart[ãa]o benef[ií]cio/i)) R.alertas.push({ nivel: 'alto', titulo: 'Contrato de cartão consignado (RMC/RCC)', tese: 'Verificar se o cliente foi informado de que contratava CARTÃO e não empréstimo (dever de informação, CDC arts. 6º, III, e 52). Tese de conversão em empréstimo consignado e devolução em dobro. ATENÇÃO: o assunto está no Tema 1.414 do STJ, ainda sem julgamento. A suspensão nacional dos processos sobre validade e abusividade do cartão consignado foi determinada em março/2026 e confirmada pela Segunda Seção em 08/04/2026 (só os cumprimentos de sentença seguem). Em 02/10/2026 o tema passou a incluir o prazo para pedir (decadência de 4 anos do art. 178 do Código Civil, ou nenhum prazo, por se tratar de nulidade) e o dano moral presumido (o Tema 1.328 foi incorporado). A ação pode ficar parada até o julgamento: avalie com o cliente antes de entrar. Há tribunais que não suspendem quando o pedido é de inexistência da contratação (o cliente nunca pediu cartão), e não de conversão em empréstimo.' });
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
      const corte = janela.slice(m[0].length).search(/\b(IOF|CET|juros|taxa|liberad|parcela|quantidade|financiad|valor\s+(?:base|total)|total\s+(?:financiado|do\s+empr)|tarifa|TAC|l[íi]quido|creditad|quita[çc]|saldo|refinanci|retido|portado|devedor|\d{2}\/\d{2}\/\d{4}|valor\s+(?:da|das|do)\s+(?:opera|parcel|princip))/i);
      const trecho = corte >= 0 ? janela.slice(0, m[0].length + corte) : janela;
      if (/\bIOF\s*(?:do|da|de|sobre|s\/)?\s*(?:o\s+)?$/i.test(T.slice(Math.max(0, ini - 25), ini))) continue;
      const depois = T.slice(ini + m[0].length, ini + m[0].length + 60), antes2 = T.slice(Math.max(0, ini - 30), ini);
      if (/^[^\d]{0,6}(,?\s*se (contratad|houver|aplic)|\s*n[ãa]o [ée] obrigat|\s*poder[áa]|\s*apartad|\s*para quita)/i.test(depois) || /(abatido o|cancelar.{0,20}|contratar)\s*$/i.test(antes2)) continue;
      if (/(?:parcelas?|presta[çc](?:[ãa]o|[õo]es)|mensalidades?)\s+d[oe]\s*$/i.test(antes2)) continue;   // "valor da parcela do seguro" e "quantidade de parcelas do seguro" não são o prêmio
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
    if (r.banco && /\bSEGUE\b|QUALI|QI SOCIEDADE/.test(r.banco)) r.banco = 'QI Sociedade de Crédito';   // Segue / Quali / QI = mesma instituição: QI Sociedade de Crédito
    const vistos = new Set(), uniq = a => a.filter(x => { const k = x.v.toFixed(2); if (vistos.has(k)) return false; vistos.add(k); return true; });
    r.seguro = uniq(acharValores(T, ROT_SEGURO));
    // quadro "Seguro Prestamista ( )SIM (X)NÃO" (Paraná Banco e parecidos): o seguro NÃO foi contratado e o número que vem
    // depois de "Valor do Seguro R$" é o valor da parcela, que fica na mesma linha do quadro
    const semSeguro = /SeguroPrestamista\*?\(\)SIM\(X\)N[ÃA]O/i.test(T.replace(/\s+/g, ''));
    if (semSeguro) { r.seguro = []; r.seguroNaoMarcado = true; }
    r.pacote = uniq(acharValores(T, ROT_PACOTE));
    // layout tipo Paraná Banco: rótulos num bloco e valores preenchidos depois ("15,06 X 95,43 ...")
    if (!semSeguro && !r.seguro.length && /Seguro Prestamista\*?\s*\(\s*X?\s*\)\s*SIM.{0,40}Valor do Seguro R\$/i.test(T)) {
      const i = T.search(/Valor do Seguro R\$/i), bloco = T.slice(i, i + 900);
      const mx = bloco.match(/\d,\d{2}\s+X\s+(\d{1,3}(?:\.\d{3})*,\d{2})/) || bloco.match(/\(\s*X\s*\)\s*SIM.{0,60}?R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2})/i);
      const v = mx ? Number(mx[1].replace(/\./g, '').replace(',', '.')) : 0;
      if (v > 0) r.seguro.push({ v, trecho: 'Quadro "Seguro Prestamista (X) SIM" · valor ' + mx[1] + ' (conferir)' });
    }
    // layout QI / VCTEX (CCB): tabela "12. Valor do Prêmio do Seguro" com uma linha por data — usa a linha da data de emissão
    if (!semSeguro && !r.seguro.length && /Pr[êe]mio/i.test(T) && /do\s+Seguro/i.test(T)) {
      const em = (T.match(/Data de Emiss[ãa]o:?\s*(\d{2}\/\d{2}\/\d{4})/i) || [])[1];
      const RX = /(\d{2}\/\d{2}\/\d{4})\s+(?:R\$\s?[\d.]+,\d{2}\s+){4,6}[\d.,]+\s?%\s+[\d.,]+\s?%\s+R\$\s?(\d{1,3}(?:\.\d{3})*,\d{2})/g;
      let mq, pri = null, certo = null;
      while ((mq = RX.exec(T))) { if (!pri) pri = mq; if (em && mq[1] === em) { certo = mq; break; } }
      const mm = certo || pri, v = mm ? Number(mm[2].replace(/\./g, '').replace(',', '.')) : 0;
      if (v > 0) r.seguro.push({ v, trecho: 'Tabela · Valor do Prêmio do Seguro R$ ' + mm[2] + ' (' + mm[1] + ')' });
    }
    // PDFs que quebram palavras ("Prestam ista", "Seg uro"): tenta no texto sem espaços
    if (!semSeguro && !r.seguro.length) {
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

  // Giro de carteira: quantos contratos do HISCON foram trocados (refinanciamento/portabilidade) e em quanto tempo.
  // Usado pelo robô de irregularidades para cruzar com os contratos baixados na pasta do cliente.
  function giroCarteira(h) {
    const vistos = new Set(), L = [], dd = (a, b) => Math.round((new Date(b) - new Date(a)) / 864e5);
    const cod = c => (String(c.banco || '').match(/^\d{3}/) || [String(c.banco || '').toLowerCase()])[0], curto = s => String(s || '').replace(/^\d{3}\s*-\s*/, '');
    (h.contratos || []).forEach(c => {
      const k = c.contrato + '|' + c.inclusao; if (!c.contrato || vistos.has(k)) return; vistos.add(k);
      if (c.parcelas > 200 || !c.inclusao) return;                       // linha mal lida
      const me = c.motivoExcl || '', mot = /refinanc/i.test(me) ? 'refin' : /portab/i.test(me) ? 'port' : me.trim() && !/^exclus[ãa]o\s+(pelo\s+)?banco$/i.test(me.trim()) ? 'outro' : '';   // "Exclusão Banco" não diz o motivo: a ligação sai pela data
      const org = /refinanc/i.test(c.origem || '') ? 'refin' : /portab/i.test(c.origem || '') ? 'port' : /nova/i.test(c.origem || '') ? 'nova' : '';
      L.push({ n: c.contrato, banco: c.banco, inc: c.inclusao, exc: c.exclusao || null, org, mot, dias: null, parcela: c.parcela, parcelas: c.parcelas, emprestado: c.emprestado });
    });
    L.sort((a, b) => a.inc < b.inc ? -1 : a.inc > b.inc ? 1 : 0);
    // liga cada contrato ao anterior: o que foi encerrado na mesma data (ou poucos dias antes) em que este entrou
    const usado = new Set();
    L.forEach((B, i) => {
      if (B.org === 'nova') return;
      let best = null, bs = 1e9;
      L.forEach((A, j) => {
        if (j === i || !A.exc || A.inc >= B.inc || usado.has(j) || A.mot === 'outro') return;
        const d = dd(A.exc, B.inc), semPista = !A.mot && !B.org;
        if (d < -2 || d > (semPista ? 5 : 7)) return;
        const sc = Math.abs(d) * 10 + (A.parcela && B.parcela ? Math.min(50, Math.abs(A.parcela - B.parcela) / A.parcela * 50) : 25)
          + ((B.org === 'refin' || A.mot === 'refin') && cod(A) !== cod(B) ? 40 : 0) + ((B.org === 'port' || A.mot === 'port') && cod(A) === cod(B) ? 40 : 0);
        if (sc < bs) { bs = sc; best = j; }
      });
      if (best == null) return;
      const A = L[best]; usado.add(best); B.a = best; A.s = i;
      if (!A.mot) { A.mot = cod(A) === cod(B) ? 'refin' : 'port'; A.inf = true; }     // motivo deduzido pela data
      if (!B.org) B.org = A.mot;
    });
    L.forEach(c => { if ((c.mot === 'refin' || c.mot === 'port') && c.exc) c.dias = dd(c.inc, c.exc); });
    const tempo = d => d == null ? '' : d < 60 ? d + ' dia(s)' : Math.floor(d / 30.4) + ' meses';
    const passo = c => `${curto(c.banco)} nº ${c.n} (${dBR(c.inc)}${c.exc ? ' a ' + dBR(c.exc) : ', ainda ativo'})`;
    const cadeiaTxt = idx => idx.map((i, k) => passo(L[i]) + (k < idx.length - 1 ? ` → ${L[i].mot === 'port' ? 'portabilidade' : 'refinanciamento'}${L[i].dias != null ? ' após ' + tempo(L[i].dias) : ''} → ` : '')).join('');
    const cadeias = L.map((c, i) => i).filter(i => L[i].a == null && L[i].s != null).map(i => { const r = [i]; let g = 0; while (L[r[r.length - 1]].s != null && g++ < 40) r.push(L[r[r.length - 1]].s); return r; })
      .sort((a, b) => b.length - a.length);
    const trocas = L.filter(c => c.mot === 'refin' || c.mot === 'port'), curtos = trocas.filter(c => c.dias != null && c.dias >= 0 && c.dias < 365), relampago = curtos.filter(c => c.dias <= 10);
    const porBanco = {}; trocas.forEach(c => { porBanco[c.banco] = (porBanco[c.banco] || 0) + 1; });
    const maior = Object.entries(porBanco).sort((a, b) => b[1] - a[1])[0] || null;
    // rebaixado em 22/11/2026: nas sentenças lidas não há procedência só pelo giro e refinanciamento/portabilidade é o grupo que mais perde.
    // Nunca é forte: atenção só para o giro pesado (25+ trocas antes de 12 meses); o resto é informativo, como reforço de outra tese.
    const nivel = curtos.length >= 25 ? 'medio' : curtos.length >= 5 ? 'info' : 'ok';
    const g = { total: L.length, trocas: trocas.length, curtos: curtos.length, relampago: relampago.length, nascidos: L.filter(c => c.org === 'refin' || c.org === 'port').length,
      maiorBanco: maior ? { banco: maior[0], n: maior[1] } : null, maiorCadeia: cadeias[0] ? cadeias[0].length : 0, nivel, lista: L.slice(0, 150), cadeias: cadeias.slice(0, 8).map(cadeiaTxt), alerta: null };
    if (nivel !== 'ok' || cadeias.length) {
      g.alerta = { cod: 'giro', r2: true, nivel: nivel === 'ok' ? 'info' : nivel, titulo: `Giro de carteira: ${trocas.length} contrato(s) trocado(s) por refinanciamento/portabilidade` + (curtos.length ? `, ${curtos.length} com menos de 12 meses` : ''),
        tese: `O HISCON mostra ${L.length} contrato(s) de empréstimo; ${trocas.length} foram encerrados por refinanciamento ou portabilidade` + (curtos.length ? `, sendo ${curtos.length} antes de completar 12 meses` : '') + (relampago.length ? ` (${relampago.length} em até 10 dias)` : '') + (maior && maior[1] > 1 ? `. Só no ${curto(maior[0])} foram ${maior[1]} trocas` : '')
          + `. Trocas sucessivas em pouco tempo indicam "giro de carteira": a operação serve para gerar comissão e alongar a dívida, sem vantagem real ao cliente — prática abusiva e falha no dever de informação (CDC arts. 6º, III, e 39, IV e V). Conferir em cada troca se houve troco de verdade e se o cliente pediu. SOZINHO, O GIRO NÃO SUSTENTA A AÇÃO: nas sentenças de consignado do INSS lidas no Diário de Justiça até 22/11/2026, as que tratam de refinanciamento ou portabilidade são o grupo que mais perde (51% improcedentes, 45% favoráveis; no seguro prestamista são 63% favoráveis) e nenhuma foi julgada procedente só pela quantidade de trocas. Use como reforço de outra tese (contrato não reconhecido, seguro, juros): ganha quem prova que o cliente não pediu a operação ou não recebeu o troco.`
          + (cadeias.length ? ' HISTÓRICO DAS TROCAS — ' + cadeias.slice(0, 5).map((c, k) => `(${k + 1}) ` + cadeiaTxt(c)).join(' · ') + '.' : '')
          + (L.some(c => c.inf) ? ' Parte das ligações foi deduzida pela data (um contrato encerrado no dia em que o outro entrou).' : '') };
    }
    return g;
  }
  root.detectarSeguro = detectarSeguro;
  root.textoPdf = textoPdf; root.analisarContrato = analisarContrato;
  root.__hisc = { itensDaPagina, linhas, tabelaEmprestimos };   // para diagnóstico do leitor no servidor
  root.lerHiscon = lerHiscon; root.analisarHiscon = analisarHiscon; root.giroCarteira = giroCarteira;
  if (typeof module !== 'undefined') module.exports = { lerHiscon, analisarHiscon, giroCarteira };
})(typeof window !== 'undefined' ? window : globalThis);
