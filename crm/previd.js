/* Triagem previdenciária: aponta indícios de revisão do benefício a partir do CNIS + Carta de Concessão (+ histórico de créditos).
   Não substitui o cálculo do advogado: todo valor é ESTIMATIVA para priorizar os casos.
   Situação das teses conferida em nov/2026 (ver TESES no fim). Uso: XYZPrevid.analisar([docs], { sexo: 'F'|'M'|null }) */
(function (root) {
  const U = root.XYZDocs.util, { brl, dBR, cBR, anos, dias, semAc } = U;
  const REFORMA = '2019-11-13', L14331 = '2022-05-05', L13846 = '2019-06-18', MP676 = '2015-06-18';
  const TETO = [['1994-07', 582.86], ['1995-05', 832.66], ['1996-05', 957.56], ['1997-06', 1031.87], ['1998-06', 1081.50], ['1998-12', 1200], ['1999-06', 1255.32], ['2000-06', 1328.25], ['2001-06', 1430], ['2002-06', 1561.56], ['2003-06', 1869.34], ['2004-01', 2400], ['2004-05', 2508.72], ['2005-05', 2668.15], ['2006-04', 2801.56], ['2006-08', 2801.82], ['2007-04', 2894.28], ['2008-03', 3038.99], ['2009-02', 3218.90], ['2010-01', 3467.40], ['2011-01', 3691.74], ['2012-01', 3916.20], ['2013-01', 4159], ['2014-01', 4390.24], ['2015-01', 4663.75], ['2016-01', 5189.82], ['2017-01', 5531.31], ['2018-01', 5645.80], ['2019-01', 5839.45], ['2020-01', 6101.06], ['2021-01', 6433.57], ['2022-01', 7087.22], ['2023-01', 7507.49], ['2024-01', 7786.02], ['2025-01', 8157.41], ['2026-01', 8475.55]];
  const SM = [['1994-07', 64.79], ['1994-09', 70], ['1995-05', 100], ['1996-05', 112], ['1997-05', 120], ['1998-05', 130], ['1999-05', 136], ['2000-04', 151], ['2001-04', 180], ['2002-04', 200], ['2003-04', 240], ['2004-05', 260], ['2005-05', 300], ['2006-04', 350], ['2007-04', 380], ['2008-03', 415], ['2009-02', 465], ['2010-01', 510], ['2011-01', 540], ['2011-03', 545], ['2012-01', 622], ['2013-01', 678], ['2014-01', 724], ['2015-01', 788], ['2016-01', 880], ['2017-01', 937], ['2018-01', 954], ['2019-01', 998], ['2020-01', 1039], ['2020-02', 1045], ['2021-01', 1100], ['2022-01', 1212], ['2023-01', 1302], ['2023-05', 1320], ['2024-01', 1412], ['2025-01', 1518], ['2026-01', 1621]];
  const em = (tab, c) => { let v = tab[0][1]; for (const [d, x] of tab) if (d <= c) v = x; return v; };
  const maisMeses = (c, n) => { const [a, m] = c.split('-').map(Number), t = a * 12 + (m - 1) + n; return `${Math.floor(t / 12)}-${String(t % 12 + 1).padStart(2, '0')}`; };
  const difMeses = (a, b) => { const [ya, ma] = a.split('-').map(Number), [yb, mb] = b.split('-').map(Number); return (yb - ya) * 12 + (mb - ma); };
  const am = m => { m = Math.round(m); const a = Math.floor(m / 12), r = m % 12; return (a ? a + (a === 1 ? ' ano' : ' anos') : '') + (a && r ? ' e ' : '') + (r || !a ? r + (r === 1 ? ' mês' : ' meses') : ''); };
  const pct = v => (v * 100).toFixed(v * 100 % 1 ? 1 : 0) + '%';
  const APOS = ['41', '42', '46', '57'], INCAP = ['32', '92'], PENSAO = ['21', '93'], TEMP = ['31', '91'], ASSIST = ['87', '88'];
  const ESPECIAL_RE = /HOSPITAL|SANTA CASA|CLINICA|LABORAT|FRIGORIF|ABATEDOURO|METALURG|SIDERURG|FUNDIC|MINERA|QUIMIC|PETRO|POSTO |COMBUST|TEXTIL|FIACAO|TECELAGEM|CERAMIC|CURTUME|GRAFIC|VIDRO|BORRACHA|CALCADO|USINA|MADEIREIRA|SERRARIA|GALVAN|TINTAS|PLASTIC|CELULOSE|CIMENTO|MARMOR|PEDREIRA|FERRO|ACO |ACOS |ELETRIC|ENERGIA|SANEAMENTO|LIMPEZA URBANA|COLETA|OXIGENIO|GASES|SOLDA|CALDEIR|MECANIC|FARMAC|RADIOL|ODONTO|ENFERM|AMBULAN|TRANSPORT|VIACAO|ONIBUS|VIGILAN|SEGURANCA/;
  const PEND_RE = /^(PEXT|PVIN|AEXT|PADM|PREC|PREM|IREC-LC123|IREC-INDPEND|IREM-INDPEND|IVIN|PRPPS|IGFIP|PSC|IREC-FBR|IREC-MEI|IREC-LC)/;

  function sexoPalpite(nome, ca) {
    if (ca && ca.dib >= REFORMA && ca.coef > 0.6 && ca.coef < 1 && ca.tc) { const l = Math.floor(ca.tc.meses / 12) - Math.round((ca.coef - 0.6) / 0.02); if (l === 15) return ['F', 'pelo coeficiente da carta']; if (l === 20) return ['M', 'pelo coeficiente da carta']; }
    if (ca && ca.especie === '42' && ca.dib < REFORMA && ca.coef === 1 && ca.tc && ca.tc.a >= 30 && ca.tc.a < 35 && !ca.pedagio) return ['F', 'pelo tempo de contribuição da carta'];
    const p = semAc(nome).split(' ')[0] || '';
    if (/^(INES|RAQUEL|ISABEL|IZABEL|BEATRIZ|ALICE|IVONE|ELIANE|ROSANE|SIMONE|IRENE|MARLENE|ARLETE|SUELI|SUELY|MIRIAM|CARMEM|CARMEN|LURDES|LOURDES|DOLORES|MERCEDES|ESTER|ESTHER|RUTH|RUTE|JUDITE|JUDITH|EDITE|IVETE|ELISABETE|ELIZABETH|ELISABETH|ELIZABETE|SOLANGE|ROSEMEIRE|ROSIMEIRE|NAIR|NOEMI|DAGMAR|GLADIS|SIRLEI|SIRLEY|SHIRLEY|LENIR|DENISE|CLEIDE|NEIDE|NEUZA|CLEONICE|EUNICE|BERENICE|IRACI|IRACY|JACI|JUCI|DULCE|ROSE|ROSELI|ROSELY|MARLI|MARLY|NELI|NELY|LEONI|EDNA)$/.test(p)) return ['F', 'pelo nome'];
    if (/A$/.test(p) && !/^(LUCA|JOSUA|NOA|JOSA|GARCIA|SILVA|BATISTA|COSTA)$/.test(p)) return ['F', 'pelo nome'];
    if (/(O|OS|SON|TON|ALDO|ERTO|IAS|EL|IL|OR|US|UR)$/.test(p)) return ['M', 'pelo nome'];
    return [null, ''];
  }

  // meses de contribuição pelo CNIS (aproximação por competência)
  function tempoCnis(cn, ate) {
    const set = new Set(), pend = new Set(), add = (ini, fim, alvo) => { if (!ini) return; let c = ini.slice(0, 7); const f = (fim || ini).slice(0, 7); for (let i = 0; c <= f && c <= ate && i < 900; i++) { alvo.add(c); c = maisMeses(c, 1); } };
    const V = cn.vinculos, contribs = [];
    V.filter(v => v.tipo === 'emprego').forEach(v => { const fim = v.fim || (v.ultRemun ? v.ultRemun + '-28' : v.rem.length ? v.rem.map(r => r.comp).sort().pop() + '-28' : v.inicio); add(v.inicio, fim, set); });
    V.filter(v => v.tipo === 'recolhimento').forEach(v => v.rem.forEach(r => { if (r.comp > ate) return; if (r.ind.some(i => /MENOR-MIN/.test(i))) pend.add(r.comp); else set.add(r.comp); }));
    set.forEach(c => contribs.push(c)); const ult = contribs.sort().pop() || '';
    // benefício por incapacidade conta como tempo quando intercalado com contribuição (STF Tema 1125)
    V.filter(v => v.tipo === 'beneficio' && [...TEMP, ...INCAP].includes(v.especie) && v.inicio && v.fim && /CESSADO/i.test(v.situacao || '')).forEach(v => { if (ult > v.fim.slice(0, 7)) add(v.inicio, v.fim, set); });
    const todos = [...set].filter(c => c <= ate);
    return { meses: todos.length, pre94: todos.filter(c => c < '1994-07').length, ateReforma: todos.filter(c => c <= '2019-11').length, pendentes: [...pend].filter(c => !set.has(c)).length, primeiro: todos.sort()[0] || null };
  }

  function analisar(docs, op) {
    op = op || {};
    const hoje = op.hoje || new Date().toISOString().slice(0, 10), hojeC = hoje.slice(0, 7);
    const ca = docs.filter(d => d.tipo === 'carta').pop() || null, hc = docs.filter(d => d.tipo === 'hiscre').pop() || null;
    const cns = docs.filter(d => d.tipo === 'cnis'), titular = (ca || hc || cns[0] || {}).nome || '';
    const ehPensao = PENSAO.includes((ca || hc || {}).especie || '');
    // na pensão, o cálculo é sobre a vida do instituidor (falecido): só serve o CNIS dele
    const cnInst = ca && ca.instituidor ? cns.find(c => root.XYZDocs.mesmoNome(c.nome, ca.instituidor)) : null;
    const cnTit = cns.find(c => root.XYZDocs.mesmoNome(c.nome, titular)) || (!cnInst ? cns[0] : null) || null;
    const cn = ehPensao ? cnInst : cnTit;                 // CNIS que explica o cálculo
    const benCnis = cnTit ? cnTit.vinculos.filter(v => v.tipo === 'beneficio' && /ATIVO/i.test(v.situacao || '')).pop() : null;
    const B = {
      nome: titular, especie: (ca && ca.especie) || (hc && hc.especie) || (benCnis && benCnis.especie) || '', especieNome: (ca && ca.especieNome) || (hc && hc.especieNome) || (benCnis && benCnis.especieNome) || '',
      nb: (ca && ca.nb) || (hc && hc.nb) || (benCnis && benCnis.nb) || '', dib: (ca && ca.dib) || (hc && hc.dib) || (benCnis && benCnis.inicio) || null, ddb: (ca && ca.ddb) || null, der: (ca && ca.der) || null,
      dip: (hc && hc.dip) || (ca && ca.dip) || null, primeiroPgto: (ca && ca.primeiroPgto) || null, rmi: ca ? ca.rmi : null, mrAtual: hc ? hc.mr : null, nascimento: (cnTit && cnTit.nascimento) || (hc && hc.nascimento) || null, instituidor: (ca && ca.instituidor) || ''
    };
    const esp = B.especie, dibC = B.dib ? B.dib.slice(0, 7) : null, posReforma = B.dib && B.dib >= REFORMA;
    let [sexo, sexoFonte] = op.sexo ? [op.sexo, 'informado'] : (ehPensao ? [null, ''] : sexoPalpite(B.nome, ca));
    B.sexo = sexo; B.sexoFonte = sexoFonte; B.idadeDib = B.nascimento && B.dib && !ehPensao ? anos(B.nascimento, B.dib) : (ca && ca.idade) || null;
    const T = [], pedir = new Set();
    const add = (nivel, id, titulo, texto, x) => { const t = Object.assign({ nivel, id, titulo, texto, base: '', numeros: '', ganho: null, decai: true }, x || {}); T.push(t); return t; };

    /* ---- prazo de decadência (10 anos; art. 103 da Lei 8.213) ---- */
    let prazo = null;
    const assist = ASSIST.includes(esp);                  // BPC/LOAS: não há cálculo a revisar, então não há prazo de 10 anos
    { const base = B.primeiroPgto || B.ddb || B.dip || B.dib;
      if (base && !assist) { const ini = maisMeses(base.slice(0, 7), 1), lim = maisMeses(ini, 120), falta = difMeses(hojeC, lim);
        prazo = { limite: lim, faltam: falta, estado: falta < 0 ? 'vencido' : falta <= 12 ? 'urgente' : 'ok', base: B.primeiroPgto ? 'data do primeiro pagamento informada na carta' : B.ddb ? 'data de concessão' : B.dip ? 'data de início do pagamento' : 'data de início do benefício' }; } }
    const decaiu = prazo && prazo.estado === 'vencido';
    const nv = n => decaiu ? 'venc' : n;                 // tese sujeita à decadência: se o prazo passou, vai para "prazo vencido"
    const pd = x => { if (!decaiu) pedir.add(x); };       // documento que só interessa se a tese ainda couber
    const obsDec = decaiu ? ` ⏰ Prazo de 10 anos vencido em ${cBR(prazo.limite)} (estimado) — só resta conferir se houve pedido de revisão ou ação dentro do prazo.` : '';

    /* ---- valores de hoje (estimativa: benefício acima do mínimo é reajustado como o teto) ---- */
    const smHoje = em(SM, hojeC), fatorReaj = dibC ? em(TETO, hojeC) / em(TETO, dibC < '1994-07' ? '1994-07' : dibC) : 1;
    const smDib = dibC ? em(SM, dibC < '1994-07' ? '1994-07' : dibC) : null, tetoDib = dibC ? em(TETO, dibC < '1994-07' ? '1994-07' : dibC) : null;
    const noMinimo = ca && B.rmi && smDib && (ca.noMinimo || Math.abs(B.rmi - smDib) < 1);
    const hojeDe = rmi => Math.max(smHoje, rmi * fatorReaj);
    const mrBase = B.mrAtual || (B.rmi ? hojeDe(B.rmi) : null);
    const mesesPagos = B.dib ? Math.max(0, difMeses(dibC, hojeC)) : 0;
    const ganhoDe = novaRmi => { if (!B.rmi || !mrBase) return null; const novo = Math.max(smHoje, noMinimo ? novaRmi * fatorReaj : mrBase * novaRmi / B.rmi), mensal = novo - mrBase; return mensal > 1 ? { novaRmi, mensal, atrasados: mensal * Math.min(mesesPagos, 60) * 13 / 12, pct: novaRmi / B.rmi - 1 } : null; };
    const rmiDe = (media, mult) => Math.max(smDib || 0, Math.min(tetoDib || 1e9, media * mult));
    const multCarta = ca && ca.media ? ((ca.fator > 0 && ca.sb && Math.abs(ca.sb - ca.media.valor * ca.fator) < 1.5 ? ca.fator : 1) * (ca.coef || 1)) : 1;
    const fatorAplicado = ca && ca.media && ca.fator > 0 && ca.sb && Math.abs(ca.sb - ca.media.valor * ca.fator) < 1.5;

    /* ---- tempo ---- */
    const tC = cn ? tempoCnis(cn, (B.der || B.dib || hoje).slice(0, 7)) : null;
    const tcMeses = ca && ca.tc ? ca.tc.meses : (tC ? tC.meses : null);
    const tcReforma = tC ? tC.ateReforma : (ca && ca.tc && B.der ? ca.tc.meses - Math.max(0, difMeses('2019-11', B.der.slice(0, 7))) : null);
    const limiar = sexo === 'M' ? 20 : 15, tcMin = sexo === 'M' ? 420 : 360;

    const semSaida = decaiu && B.dib >= '2004-01-01';     // prazo vencido e sem tese de teto: não adianta pedir mais documento
    if (assist) { /* tratado no bloco do BPC, mais abaixo */ }
    else if (semSaida) add('info', 'vencido', 'Com o prazo vencido, só vale aprofundar em três situações', '(1) o cliente pediu revisão ao INSS ou entrou com ação dentro dos 10 anos; (2) ganhou ação trabalhista depois da concessão — o prazo conta do trânsito em julgado (STJ, Tema 1.117); (3) o benefício foi concedido ou revisto por decisão judicial em data posterior. Fora disso, não compensa pedir mais documentos.', { decai: false });
    else {
      if (!ca) add('info', 'sem-carta', 'Falta a carta de concessão', 'Sem a carta de concessão (com a memória de cálculo) só dá para olhar o tempo de contribuição e os vínculos. Peça ao cliente: Meu INSS → "Carta de concessão". Com ela o sistema compara salário por salário com o CNIS e simula as revisões.', { decai: false });
      if (ca && !ca.temMemoria) { add('info', 'sem-memoria', 'A carta veio sem a memória de cálculo', `Benefícios antigos (este é de ${dBR(B.dib)}) costumam sair sem a lista de salários. Para conferir o cálculo, peça a cópia do processo administrativo (Meu INSS → "Cópia de processo") ou os extratos CONBAS/REVSIT/INFBEN em uma agência.`, { decai: false }); pedir.add('Cópia do processo administrativo do benefício (memória de cálculo)'); }
      if (!cn && !ehPensao) { add('info', 'sem-cnis', 'Falta o CNIS', 'Sem o CNIS não dá para comparar os salários usados pelo INSS com os que estão no cadastro, nem achar vínculos fora do cálculo. Peça: Meu INSS → "Extrato de contribuição (CNIS)" completo, com remunerações.', { decai: false }); pedir.add('CNIS completo (extrato de contribuição com remunerações)'); }
    }
    if (ehPensao && !cnInst) { add('info', 'cnis-instituidor', 'Pensão: o cálculo é sobre a vida do instituidor', `A renda da pensão vem do benefício (ou dos salários) de ${B.instituidor || 'quem faleceu'}. ${cns.length ? 'O CNIS anexado é do pensionista e não serve para conferir esse cálculo. ' : ''}Anexe o CNIS do instituidor e, se ele era aposentado, a carta de concessão da aposentadoria dele: o pensionista pode pedir a revisão do benefício originário e receber os reflexos na pensão (STJ, Tema 1.057).`, { decai: false, base: 'STJ Tema 1.057' }); pedir.add('CNIS e carta de concessão do instituidor (falecido)'); }

    /* ---- 1. Teto (EC 20/1998 e EC 41/2003) — sem decadência ---- */
    if (B.dib && B.dib < '2004-01-01' && !TEMP.includes(esp) && !assist) {
      const txt = 'Quando o salário de benefício foi limitado ao teto na concessão, o excedente deve ser reaproveitado nos tetos novos das EC 20/1998 (R$ 1.200) e 41/2003 (R$ 2.400). Não revisa o ato de concessão, então não tem decadência: só prescrevem as parcelas de mais de 5 anos.';
      if (B.dib >= '1988-10-05' && B.dib <= '1991-04-05') add('medio', 'teto', 'Benefício do "buraco negro" (05/10/1988 a 05/04/1991): conferir revisão do teto', txt + ' Para benefícios desse período o STF também admite a readequação (Tema 930). Conferir no processo administrativo se a média superava o teto e se o INSS já revisou.', { decai: false, base: 'STF Temas 76 e 930; art. 144 da Lei 8.213' });
      else if (ca && ca.temMemoria && ca.media.valor > tetoDib * 1.001 && B.dib >= '1994-07-01') { const g = ganhoDe(B.rmi * Math.min(ca.media.valor / tetoDib, 2400 / tetoDib)); add('alto', 'teto', 'Salário de benefício limitado ao teto na concessão', txt, { decai: false, base: 'STF Tema 76 (RE 564.354)', numeros: `Média ${brl(ca.media.valor)} × teto da época ${brl(tetoDib)} — excedente de ${pct(ca.media.valor / tetoDib - 1)}`, ganho: g }); }
      else if (B.rmi && tetoDib && B.dib >= '1994-07-01' && B.rmi >= tetoDib * 0.9) add('medio', 'teto', 'Renda inicial próxima do teto da época: conferir revisão do teto', txt + ' A carta não mostra a média antes da limitação — pedir a memória de cálculo.', { decai: false, base: 'STF Tema 76 (RE 564.354)', numeros: `RMI ${brl(B.rmi)} · teto em ${cBR(dibC)}: ${brl(tetoDib)}` });
    }

    /* ---- 2. Salários do CNIS × salários usados pelo INSS (inclui atividades concomitantes) ---- */
    let comparacao = null;
    if (ca && ca.temMemoria && cn) {
      const porComp = {}; cn.vinculos.filter(v => v.tipo !== 'beneficio').forEach(v => v.rem.forEach(r => { if (!r.valor) return; const k = porComp[r.comp] = porComp[r.comp] || { total: 0, vinc: [] }; k.total += r.valor; k.vinc.push({ seq: v.seq, origem: v.origem, valor: r.valor, ind: r.ind.concat(v.indicadores) }); }));
      const usados = {}; ca.salarios.forEach(s => { const u = usados[s.comp] = usados[s.comp] || { sal: 0, indice: s.indice, desc: s.desc }; u.sal += s.sal; });
      const comps = Object.keys(usados).sort(), ini = comps[0], fim = comps[comps.length - 1];
      const indDe = c => { if (usados[c]) return usados[c].indice; const antes = comps.filter(x => x < c).pop(), depois = comps.find(x => x > c); if (antes && depois) { const p = difMeses(antes, c) / difMeses(antes, depois); return usados[antes].indice + (usados[depois].indice - usados[antes].indice) * p; } return usados[antes || depois].indice; };
      const menor = [], falta = [], conc = [], minimo = [];
      Object.keys(porComp).sort().forEach(c => {
        if (c < '1994-07' || c >= dibC) return; const k = porComp[c], cnv = Math.min(k.total, em(TETO, c)), u = usados[c];
        if (!u) { falta.push({ comp: c, cnis: cnv, carta: null, vinc: k.vinc }); return; }
        if (u.sal + 0.5 < cnv * 0.99) { const reg = { comp: c, cnis: cnv, carta: u.sal, vinc: k.vinc }; (k.vinc.length > 1 ? conc : menor).push(reg); }
      });
      comps.forEach(c => { if (!porComp[c] && Math.abs(usados[c].sal - em(SM, c)) < 0.5 && cn.vinculos.some(v => v.tipo === 'emprego' && v.inicio && v.inicio.slice(0, 7) <= c && (!v.fim || v.fim.slice(0, 7) >= c))) minimo.push(c); });
      // recálculo da média com os valores do CNIS
      const recalc = lista => {
        const novo = {}; comps.forEach(c => novo[c] = usados[c].sal * usados[c].indice); lista.forEach(r => novo[r.comp] = r.cnis * indDe(r.comp));
        const v = Object.values(novo).sort((a, b) => b - a), n = ca.media.pct === 80 ? Math.max(1, Math.floor(v.length * 0.8 + 1e-9)) : v.length, nOrig = ca.salarios.filter(s => !s.desc).length;
        const div = ca.media.div > nOrig ? Math.max(ca.media.div, n) : n; return v.slice(0, n).reduce((a, b) => a + b, 0) / div;
      };
      const todas = menor.concat(conc, falta), mediaNova = todas.length ? recalc(todas) : null;
      comparacao = { menor, conc, falta, minimo, mediaNova, ini, fim };
      if (todas.length) {
        const novaRmi = rmiDe(mediaNova, multCarta), g = mediaNova > ca.media.valor * 1.005 ? ganhoDe(novaRmi) : null;
        const partes = [conc.length && `${conc.length} competência(s) com mais de um vínculo em que o INSS usou menos que a soma`, menor.length && `${menor.length} com salário menor que o do CNIS`, falta.length && `${falta.length} com remuneração no CNIS e fora do cálculo`].filter(Boolean).join('; ');
        add(nv(g && g.pct >= 0.02 ? 'alto' : 'medio'), 'salarios', conc.length && B.dib < L13846 ? 'Atividades concomitantes e salários a menor no cálculo' : 'Salários do CNIS diferentes dos usados no cálculo',
          `Comparando mês a mês o CNIS com a memória de cálculo: ${partes}. ` + (conc.length ? 'Em atividades concomitantes, o salário de contribuição é a SOMA de todas as remunerações do mês, limitada ao teto (STJ, Tema 1.070) — antes de 18/06/2019 o INSS calculava a atividade secundária à parte. ' : '') + 'Remuneração que está no CNIS e não entrou (ou entrou a menor) é erro de fato: pede-se a retificação com o próprio CNIS, holerites e CTPS.' + obsDec,
          { base: 'STJ Tema 1.070; arts. 29-A e 32 da Lei 8.213', numeros: `Média da carta ${brl(ca.media.valor)} → média refeita com o CNIS ${brl(mediaNova)} (estimativa${falta.length ? '; índice dos meses faltantes interpolado' : ''})`, ganho: g });
        pd('Holerites/CTPS dos meses divergentes (lista no detalhe)');
      } else add('info', 'salarios', 'Salários conferidos: o cálculo bate com o CNIS', `Comparei ${comps.length} competências da memória de cálculo com o CNIS e não achei salário a menor nem mês com remuneração fora do cálculo.`, { decai: false });
      if (minimo.length >= 3) { add(nv('medio'), 'sal-minimo', `${minimo.length} mês(es) calculados pelo salário mínimo por falta de remuneração no CNIS`, 'Há vínculo de emprego no período, mas o CNIS não traz a remuneração e o INSS usou o salário mínimo. Com holerites, ficha financeira, CTPS com anotações de salário ou RAIS dá para pôr o valor real.' + obsDec, { base: 'art. 29-A da Lei 8.213; art. 36, § 2º, do Decreto 3.048', numeros: minimo.slice(0, 24).map(cBR).join(', ') + (minimo.length > 24 ? '…' : '') }); pd('Holerites ou ficha financeira dos meses calculados pelo salário mínimo'); }
    }

    /* ---- 3. Tempo de contribuição e pendências do CNIS ---- */
    if (cn) {
      const pend = cn.vinculos.filter(v => v.tipo !== 'beneficio' && (v.indicadores.some(i => PEND_RE.test(i)) || v.rem.some(r => r.ind.some(i => PEND_RE.test(i))) || (v.tipo === 'emprego' && !v.fim)));
      const lista = pend.map(v => `${v.origem || 'vínculo ' + v.seq} (${dBR(v.inicio)} a ${v.fim ? dBR(v.fim) : 'sem data fim'})${[...new Set(v.indicadores.concat(v.rem.flatMap(r => r.ind)))].filter(i => PEND_RE.test(i)).length ? ' — ' + [...new Set(v.indicadores.concat(v.rem.flatMap(r => r.ind)))].filter(i => PEND_RE.test(i)).join(', ') : ''}`);
      const tempoPesa = APOS.includes(esp) || (posReforma && INCAP.includes(esp)) || ehPensao;
      if (ca && ca.tc && tC && tC.meses - ca.tc.meses >= 6) { add(nv(tempoPesa ? 'medio' : 'info'), 'tempo', `CNIS mostra cerca de ${am(tC.meses - ca.tc.meses)} a mais que o tempo computado`, `A carta computou ${am(ca.tc.meses)}; somando os vínculos do CNIS até o requerimento dá cerca de ${am(tC.meses)} (contagem por competência, aproximada). Tempo a mais ${APOS.includes(esp) ? 'muda coeficiente, fator previdenciário ou a regra aplicável' : 'pode mudar o coeficiente'}.` + obsDec, { base: 'art. 29-A da Lei 8.213 (retificação do CNIS)', numeros: lista.length ? 'Vínculos com pendência: ' + lista.join(' | ') : '' }); pd('CTPS completa (todas as páginas de contrato)'); }
      else if (lista.length && tempoPesa) { add(nv('medio'), 'pendencias', `${pend.length} vínculo(s) com pendência no CNIS — o INSS pode não ter contado`, 'Indicadores como PEXT/AEXT (vínculo extemporâneo), PREC-MENOR-MIN (recolhimento abaixo do mínimo), PREM-EXT e vínculo sem data de saída costumam ficar fora da contagem até serem comprovados com CTPS, holerites ou complementação.' + obsDec, { base: 'art. 29-A da Lei 8.213; EC 103, art. 29 (complementação)', numeros: lista.join(' | ') }); pd('CTPS completa (todas as páginas de contrato)'); }
      if (tC && tC.pendentes) add('info', 'abaixo-min', `${tC.pendentes} recolhimento(s) abaixo do mínimo`, 'Competência com contribuição abaixo do salário mínimo não conta como tempo nem carência até ser complementada, agrupada ou usada com excedente de outro mês.', { decai: false, base: 'EC 103, art. 29; CF, art. 195, § 14' });
    }

    /* ---- 4. Atividade especial ---- */
    if (cn && !assist && (APOS.includes(esp) || (posReforma && INCAP.includes(esp)) || !ca)) {
      const cand = cn.vinculos.filter(v => v.tipo === 'emprego' && v.inicio && v.inicio < REFORMA).map(v => { const iean = v.indicadores.includes('IEAN') || v.rem.some(r => r.ind.includes('IEAN')), nome = ESPECIAL_RE.test(semAc(v.origem || '') + ' '); const fim = (v.fim || (v.ultRemun ? v.ultRemun + '-28' : v.inicio)); return (iean || nome) ? { v, iean, meses: Math.max(1, difMeses(v.inicio.slice(0, 7), (fim < REFORMA ? fim : REFORMA).slice(0, 7)) + 1), vig: /VIGILAN|SEGURANCA/.test(semAc(v.origem)) } : null; }).filter(Boolean);
      if (cand.length) {
        const tot = cand.reduce((a, c) => a + c.meses, 0), fat = sexo === 'M' ? 0.4 : sexo === 'F' ? 0.2 : null, forte = cand.some(c => c.iean);
        add(nv(forte ? 'alto' : 'medio'), 'especial', forte ? 'Empresa declarou exposição a agente nocivo (IEAN) — tempo especial' : 'Vínculos em atividade com cara de especial',
          `${cand.length} vínculo(s), cerca de ${am(tot)} até 13/11/2019. Tempo especial reconhecido converte em comum com acréscimo de 40% (homem) ou 20% (mulher) para períodos até a Reforma${fat ? ` — aqui, até ${am(tot * fat)} a mais` : ''}. Isso pode mudar o fator, o coeficiente ou até a espécie (aposentadoria especial com 25 anos). Prova: PPP e LTCAT de cada empresa; até 28/04/1995 basta a categoria profissional.` + (cand.some(c => c.vig) ? ' Atenção ao vigilante: o STF (Tema 1.209, fev/2026) decidiu que a atividade não é especial pelo risco — só resta o enquadramento por categoria até 28/04/1995.' : '') + (ca && ca.tc && tC && ca.tc.meses - tC.meses >= 6 ? ` A carta já tem ${am(ca.tc.meses - tC.meses)} a mais que o CNIS — parte pode já ter sido convertida.` : '') + obsDec,
          { base: 'arts. 57 e 58 da Lei 8.213; EC 103, art. 25, § 2º; STF Temas 555 e 1.209', numeros: cand.map(c => `${c.v.origem} (${dBR(c.v.inicio)} a ${c.v.fim ? dBR(c.v.fim) : cBR(c.v.ultRemun)})${c.iean ? ' — IEAN' : ''}`).join(' | ') });
        pd('PPP (Perfil Profissiográfico Previdenciário) de cada empresa listada');
      }
    }

    /* ---- 5. Regra 85/95 (afasta o fator previdenciário) ---- */
    if (ca && esp === '42' && B.dib >= MP676 && B.dib < REFORMA && fatorAplicado && ca.fator < 1 && ca.tc) {
      const idade = B.nascimento ? dias(B.nascimento, B.der || B.dib) / 365.25 : (ca.idade != null ? ca.idade + 0.5 : null);
      if (idade != null) {
        const pontos = idade + ca.tc.meses / 12, extra = B.dib >= '2018-12-31' ? 1 : 0, rF = 85 + extra, rM = 95 + extra, req = sexo === 'M' ? rM : sexo === 'F' ? rF : null;
        const ok = req ? pontos >= req : pontos >= rM, talvez = !req && pontos >= rF && pontos < rM;
        if (ok || talvez) { const g = ganhoDe(rmiDe(ca.media.valor, ca.coef || 1)); add(nv(ok ? 'alto' : 'medio'), '8595', `Fator previdenciário aplicado com ${pontos.toFixed(1)} pontos (regra ${rF}/${rM})`, `Idade + tempo de contribuição na data do requerimento somam ${pontos.toFixed(1)} pontos${B.nascimento ? '' : ' (idade aproximada: falta a data de nascimento)'}. Quem atinge ${rF} (mulher) ou ${rM} (homem), com 30/35 anos de contribuição, pode afastar o fator — e o INSS aplicou fator de ${String(ca.fator).replace('.', ',')}.${talvez ? ' Vale se for mulher: confirme o sexo acima.' : ''}` + obsDec, { base: 'art. 29-C da Lei 8.213 (Lei 13.183/2015)', numeros: `RMI com fator ${brl(B.rmi)} → sem fator ${brl(rmiDe(ca.media.valor, ca.coef || 1))}`, ganho: g }); }
        else if (req && req - pontos <= 3) add('info', '8595', `Faltaram ${(req - pontos).toFixed(1)} pontos para a regra ${rF}/${rM}`, 'Com tempo especial convertido ou vínculo que ficou fora da contagem, os pontos podem ser alcançados e o fator previdenciário cai.', { base: 'art. 29-C da Lei 8.213' });
      }
    }

    /* ---- 6. Benefícios pós-Reforma (EC 103/2019): regra mais vantajosa, coeficiente, descarte e divisor ---- */
    if (ca && ca.temMemoria && posReforma && (APOS.includes(esp) || esp === '32')) {
      const naoDesc = ca.salarios.filter(s => !s.desc), todosCorr = ca.salarios.map(s => s.corr).sort((a, b) => b - a), n = naoDesc.length, coef = ca.coef || 1;
      // 6a. divisor mínimo
      if (ca.media.div > n) {
        if (B.dib < L14331 && APOS.includes(esp)) { const m2 = ca.media.soma / n, g = ganhoDe(rmiDe(m2, multCarta)); add(nv('alto'), 'divisor', `Divisor mínimo aplicado na lacuna de 13/11/2019 a 04/05/2022 (dividiu por ${ca.media.div}, havia ${n} salários)`, 'Entre a Reforma e a Lei 14.331/2022 não existia divisor mínimo: a média é a soma dos salários dividida pelo número de contribuições do período de cálculo, ainda que poucas. TNU (Tema 353, fev/2026) e a 2ª Turma do STJ (ago/2026) mandaram recalcular.' + obsDec, { base: 'TNU Tema 353; STJ REsp 2.193.427/RS; EC 103, art. 26', numeros: `Média ${brl(ca.media.valor)} → ${brl(m2)}`, ganho: g }); }
        else if (B.dib >= L14331) add('info', 'divisor', `Divisor mínimo de ${ca.media.div} aplicado (legal desde 05/05/2022)`, 'A Lei 14.331/2022 fixou divisor mínimo de 108 meses para quem se filiou até julho de 1994 (exceto incapacidade permanente). Só cabe discutir se o fato gerador (data em que completou os requisitos) for anterior a 05/05/2022.', { decai: false, base: 'art. 135-A da Lei 8.213' });
      }
      // 6b. coeficiente esperado
      if (tcMeses && sexo && coef < 1 && !['46'].includes(esp)) { const esper = Math.min(1, 0.6 + 0.02 * Math.max(0, Math.floor(tcMeses / 12) - limiar)); if (esper > coef + 0.019) { const g = ganhoDe(rmiDe(ca.media.valor, esper)); add(nv('medio'), 'coef', `Coeficiente de ${pct(coef)} parece baixo para ${am(tcMeses)} de contribuição`, `Pela regra da Reforma o coeficiente é 60% + 2% por ano que passar de ${limiar} anos (${sexo === 'M' ? 'homem' : 'mulher'}): daria ${pct(esper)}. Conferir se o INSS deixou tempo de fora.` + obsDec, { base: 'EC 103, art. 26, § 2º', ganho: g }); } }
      // 6c. pedágio de 100% (art. 20): 100% da média
      if (APOS.includes(esp) && esp !== '41' && coef < 1 && sexo && tcReforma != null && tcMeses && B.idadeDib != null) { const falta = Math.max(0, tcMin - tcReforma), idMin = sexo === 'M' ? 60 : 57; if (B.idadeDib >= idMin && tcMeses >= tcMin + falta) { const g = ganhoDe(rmiDe(ca.media.valor, 1)); add(nv('alto'), 'pedagio100', 'Tinha direito à regra do pedágio de 100%: benefício de 100% da média', `Na data do requerimento tinha ${B.idadeDib} anos e ${am(tcMeses)} de contribuição; em 13/11/2019 faltavam ${am(falta)} para os ${tcMin / 12} anos, e o pedágio (o dobro do que faltava) foi cumprido. Essa regra paga 100% da média, e o INSS concedeu com coeficiente de ${pct(coef)} — ele é obrigado a conceder o melhor benefício.` + obsDec, { base: 'EC 103, art. 20; STF Tema 334 (melhor benefício)', numeros: `${pct(coef)} → 100% da média de ${brl(ca.media.valor)}`, ganho: g }); } }
      // 6d. direito adquirido antes da Reforma
      if (APOS.includes(esp) && sexo && tcReforma != null && B.nascimento) {
        const idRef = anos(B.nascimento, REFORMA), pre = ca.salarios.filter(s => s.comp < '2019-11').map(s => s.corr).sort((a, b) => b - a), n80 = Math.max(1, Math.floor(pre.length * 0.8 + 1e-9)), m80 = pre.length ? pre.slice(0, n80).reduce((a, b) => a + b, 0) / n80 : 0;
        const pontos = idRef + tcReforma / 12;
        if (tcReforma >= tcMin && pontos >= (sexo === 'M' ? 96 : 86) && m80) { const nr = rmiDe(m80, 1), g = nr > B.rmi * 1.02 ? ganhoDe(nr) : null; if (g) add(nv('alto'), 'adquirido', 'Direito adquirido antes da Reforma: aposentadoria integral sem fator (86/96 pontos)', `Em 13/11/2019 já tinha cerca de ${am(tcReforma)} de contribuição e ${idRef} anos (${pontos.toFixed(1)} pontos). Pela regra antiga, a renda é 100% da média dos 80% maiores salários, sem fator. O INSS deve conceder o benefício mais vantajoso.` + obsDec, { base: 'EC 103, art. 3º; STF Tema 334; art. 29-C da Lei 8.213', numeros: `Média dos 80% maiores até 10/2019 ≈ ${brl(m80)} × RMI concedida ${brl(B.rmi)}`, ganho: g }); }
        else if (tcReforma >= tcMin && coef < 1) add(nv('medio'), 'adquirido', 'Já tinha tempo para se aposentar antes da Reforma: simular a regra antiga', `Em 13/11/2019 já tinha cerca de ${am(tcReforma)} de contribuição (mínimo de ${tcMin / 12} anos). Pela regra antiga a renda é a média dos 80% maiores salários × fator previdenciário; dependendo da idade pode superar os ${pct(coef)} concedidos. Precisa de simulação com a tábua do IBGE.` + obsDec, { base: 'EC 103, art. 3º; STF Tema 334' });
        if (esp === '41' && idRef >= (sexo === 'M' ? 65 : 60) && tC && tC.ateReforma >= 180 && m80) { const c0 = Math.min(1, 0.7 + 0.01 * Math.floor(tC.ateReforma / 12)), nr = rmiDe(m80, c0), g = nr > B.rmi * 1.02 ? ganhoDe(nr) : null; if (g) add(nv('alto'), 'adquirido-idade', 'Direito adquirido à aposentadoria por idade pela regra antiga', `Em 13/11/2019 já tinha ${idRef} anos e ${tC.ateReforma} contribuições. Regra antiga: 70% + 1% por ano de contribuição (aqui ${pct(c0)}) sobre a média dos 80% maiores salários.` + obsDec, { base: 'EC 103, art. 3º; art. 50 da Lei 8.213', numeros: `≈ ${brl(nr)} × RMI concedida ${brl(B.rmi)}`, ganho: g }); }
      }
      // 6e. descarte de contribuições (art. 26, § 6º)
      const tcSim = tcMeses != null ? tcMeses : (esp === '32' && coef <= 0.6 ? n : null);
      if (ca.media.pct === 100 && n >= 2 && tcSim != null) {
        const asc = naoDesc.map(s => s.corr).sort((a, b) => a - b), soma = asc.reduce((a, b) => a + b, 0), filiadoAntes94 = !tC || !tC.primeiro || tC.primeiro < '1994-07';
        const divMin = B.dib >= L14331 && esp !== '32' && filiadoAntes94 ? 108 : 0, lim = sexo ? limiar : 15, coefFixo = coef === 1;
        const minMeses = esp === '32' ? 12 : esp === '41' ? 180 : (sexo === 'M' ? 420 : 360);
        let melhor = null, acum = 0;
        for (let k = 1; k < n; k++) { acum += asc[k - 1]; const tk = tcSim - k; if (tk < minMeses || n - k < (esp === '32' ? 12 : 1)) break; const ck = coefFixo ? 1 : Math.min(1, 0.6 + 0.02 * Math.max(0, Math.floor(tk / 12) - lim)), mk = (soma - acum) / Math.max(n - k, divMin), r = rmiDe(mk, ck); if (!melhor || r > melhor.rmi) melhor = { k, rmi: r, media: mk, coef: ck }; }
        const atual = rmiDe(soma / Math.max(n, divMin, ca.media.div > n && B.dib >= L14331 ? ca.media.div : 0), coef);
        if (melhor && melhor.rmi > Math.max(atual, B.rmi) * 1.01) { const g = ganhoDe(melhor.rmi); add(nv(g && g.pct >= 0.03 && esp !== '32' ? 'alto' : 'medio'), 'descarte', `Descarte de ${melhor.k} contribuição(ões) baixas aumenta a renda`, `A Reforma permite excluir da média as contribuições que reduzem o benefício, desde que sobre o tempo mínimo exigido — o tempo descartado não conta para mais nada. Simulação: tirando as ${melhor.k} menores, a média vai de ${brl(soma / n)} para ${brl(melhor.media)} e o coeficiente ${melhor.coef === coef ? 'continua em ' + pct(coef) : 'passa de ' + pct(coef) + ' para ' + pct(melhor.coef)}.${!sexo ? ' (Simulado com limiar de 15 anos: confirme o sexo acima.)' : ''}${coefFixo ? ' Como o coeficiente é de 100%, confira se o tempo que sobra ainda cumpre a regra usada na concessão.' : ''}${esp === '32' ? ' Atenção: o INSS só aplica o descarte às aposentadorias programadas; para incapacidade é tese a sustentar em juízo.' : ''}${B.dib < L14331 && APOS.includes(esp) ? ' Na lacuna de 13/11/2019 a 04/05/2022 não há divisor mínimo (TNU Tema 353), o que permite descartar até ficar com poucas contribuições altas.' : ''}` + obsDec, { base: 'EC 103, art. 26, § 6º; TNU Tema 353', numeros: `RMI ${brl(B.rmi)} → ${brl(melhor.rmi)} (estimativa)`, ganho: g }); }
      }
    }

    /* ---- 7. Incapacidade permanente ---- */
    if (INCAP.includes(esp) && B.dib) {
      if (posReforma && esp === '32') {
        const antes = cnTit ? cnTit.vinculos.filter(v => v.tipo === 'beneficio' && TEMP.includes(v.especie) && v.inicio && v.inicio < REFORMA && v.fim && Math.abs(dias(v.fim, B.dib)) <= 62).pop() : null;
        if (antes) { let g = null, num = ''; if (ca && ca.temMemoria) { const v = ca.salarios.map(s => s.corr).sort((a, b) => b - a), n80 = Math.max(1, Math.floor(v.length * 0.8 + 1e-9)), m80 = v.slice(0, n80).reduce((a, b) => a + b, 0) / n80, nr = rmiDe(m80, 1); g = ganhoDe(nr); num = `Coeficiente ${pct(ca.coef || 0.6)} sobre ${brl(ca.media.valor)} → 100% da média dos 80% maiores ≈ ${brl(nr)}`; }
          add(nv('alto'), 'incap-anterior', 'Incapacidade começou antes da Reforma: cálculo pela regra antiga (100%)', `O CNIS mostra auxílio por incapacidade de ${dBR(antes.inicio)} a ${dBR(antes.fim)}, emendado na aposentadoria de ${dBR(B.dib)}. Se a incapacidade vem de antes de 13/11/2019, aplica-se a lei da data do fato gerador: 100% do salário de benefício, e não os 60% + 2% da Reforma. O Tema 1.300 do STF só validou a regra nova para incapacidade constatada DEPOIS da Reforma. Prova: laudos e a data de início da incapacidade (DII) fixada pela perícia.` + obsDec, { base: 'art. 44 da Lei 8.213 (redação anterior); tempus regit actum; STF Tema 1.300 a contrario sensu', numeros: num, ganho: g }); pd('Laudo da perícia do INSS com a data de início da incapacidade (DII) — Meu INSS → "Laudo médico pericial"'); }
        else add('nao', 'incap-integral', 'Aposentadoria por incapacidade integral (100%) — tese encerrada', 'O STF decidiu em 18/12/2025 (Tema 1.300) que é constitucional pagar 60% + 2% por ano quando a incapacidade é constatada depois da Reforma. Não propor a tese da integralidade.' + (cnTit ? '' : ' Exceção a conferir com o CNIS: incapacidade (auxílio-doença) iniciada antes de 13/11/2019.'), { decai: false, base: 'STF Tema 1.300 (RE 1.469.150)' });
        add('info', 'incap-acid', 'Se a incapacidade veio de acidente ou doença do trabalho, a renda é de 100%', 'Aposentadoria por incapacidade acidentária (espécie 92) continua com 100% da média mesmo depois da Reforma. Se houve CAT, doença ocupacional ou acidente de trajeto e o INSS concedeu como previdenciária (32), cabe a conversão.', { base: 'EC 103, art. 26, § 3º, II' });
      }
      add('info', 'incap-25', 'Precisa de ajuda permanente de outra pessoa? Adicional de 25%', 'Aposentado por incapacidade permanente que depende de terceiro para os atos do dia a dia tem direito a 25% a mais, mesmo acima do teto. Não vale para outras aposentadorias (STF, Tema 1.095).', { decai: false, base: 'art. 45 da Lei 8.213' });
    }

    /* ---- 8. Art. 29, II (benefícios por incapacidade e pensões de 1999 a 2009) ---- */
    if (B.dib && B.dib >= '1999-11-29' && B.dib <= '2009-08-18' && [...INCAP, ...TEMP, ...PENSAO].includes(esp))
      add('info', 'art29', 'Benefício de 1999–2009: conferir se a revisão do art. 29, II foi paga', `Nesse período o INSS calculou benefícios por incapacidade e pensões com 100% dos salários, em vez dos 80% maiores.${ca && ca.media ? ` A carta mostra média dos ${ca.media.pct}%.` : ''} O INSS reconheceu o erro e pagou por acordo em ação civil pública (cronograma até 2022). O prazo para ação nova, em regra, já passou — vale consultar no Meu INSS se a revisão foi processada e se os atrasados foram pagos.`, { decai: false, base: 'art. 29, II, da Lei 8.213; ACP 0002320-59.2012.4.03.6183' });

    /* ---- 9. Pensão por morte ---- */
    if (ehPensao && B.dib) {
      if (posReforma) add('nao', 'pensao-cotas', 'Pensão de 100% para óbito depois da Reforma — tese encerrada', 'O STF validou as cotas de 50% + 10% por dependente (ADI 7.051 e outras). Só há 100% quando existe dependente inválido ou com deficiência intelectual, mental ou grave, ou quando o valor fica no salário mínimo.', { decai: false, base: 'EC 103, art. 23; STF ADI 7.051' });
      add('info', 'pensao-reflexo', 'Revisar o benefício de quem faleceu aumenta a pensão', 'Tudo o que valeria para revisar a aposentadoria do instituidor (teto, salários a menor, tempo especial, concomitantes) reflete na pensão, e o pensionista tem legitimidade para pedir. O prazo de 10 anos, porém, conta do benefício originário.', { decai: false, base: 'STJ Tema 1.057' });
      const outro = cnTit ? cnTit.vinculos.find(v => v.tipo === 'beneficio' && /ATIVO/i.test(v.situacao || '') && APOS.concat(INCAP).includes(v.especie)) : null;
      if (outro && posReforma) add('info', 'acumulo', 'Acumula pensão com aposentadoria: conferir o redutor', 'Depois da Reforma, quem acumula pensão e aposentadoria recebe o maior benefício inteiro e só uma parte do menor (faixas de 60%, 40%, 20% e 10%). Conferir se o redutor foi aplicado no benefício certo e pelas faixas corretas.', { decai: false, base: 'EC 103, art. 24' });
    }

    /* ---- 10. Aposentadoria por idade antes da Reforma: coeficiente ---- */
    if (ca && esp === '41' && B.dib < REFORMA && ca.coef && ca.coef < 1 && tC) { const esper = Math.min(1, 0.7 + 0.01 * Math.floor(tC.meses / 12)); if (esper > ca.coef + 0.009) { const g = ca.media ? ganhoDe(rmiDe(ca.media.valor, esper * (fatorAplicado ? ca.fator : 1))) : null; add(nv('medio'), 'coef-idade', `Coeficiente de ${pct(ca.coef)} com cerca de ${am(tC.meses)} no CNIS`, `Na aposentadoria por idade anterior à Reforma o coeficiente é 70% + 1% a cada 12 contribuições (até 100%). Pelo CNIS daria ${pct(esper)} — conferir quais vínculos ficaram fora.` + obsDec, { base: 'art. 50 da Lei 8.213', ganho: g }); } }

    /* ---- BPC/LOAS (espécies 87 e 88): não se revisa valor; procura-se benefício melhor e atrasados ---- */
    if (assist) {
      add('info', 'bpc', 'BPC/LOAS não tem revisão de cálculo', 'O benefício assistencial é sempre de 1 salário mínimo, não paga 13º e não deixa pensão por morte. O que pode existir é (1) direito a um benefício previdenciário no lugar dele, com 13º e pensão, e (2) atrasados de pedido negado antes da concessão. É isso que a triagem procura abaixo.', { decai: false, base: 'Lei 8.742/1993 (LOAS), art. 20' });
      const V = cnTit ? cnTit.vinculos : [], bpcIni = B.dib || (benCnis && benCnis.inicio);
      if (!cnTit) { add('info', 'sem-cnis', 'Falta o CNIS', 'É no CNIS que aparecem os benefícios anteriores (auxílio cessado, pedidos negados) e as contribuições. Peça: Meu INSS → "Extrato de contribuição (CNIS)".', { decai: false }); pedir.add('CNIS completo (extrato de contribuição)'); }
      // auxílio por incapacidade cessado antes do BPC por deficiência: indício de que a incapacidade nunca acabou
      const ces = V.filter(v => v.tipo === 'beneficio' && [...TEMP, ...INCAP].includes(v.especie) && v.inicio && v.fim && /CESSADO/i.test(v.situacao || '') && (!bpcIni || v.fim < bpcIni)).sort((a, b) => b.fim.localeCompare(a.fim))[0];
      if (ces && esp === '87') {
        const dur = difMeses(ces.inicio.slice(0, 7), ces.fim.slice(0, 7)), vao = bpcIni ? difMeses(ces.fim.slice(0, 7), bpcIni.slice(0, 7)) : null;
        // piso dos atrasados: salário mínimo dos meses sem benefício dentro dos últimos 5 anos + 13º que o BPC não paga
        const de = [maisMeses(ces.fim.slice(0, 7), 1), maisMeses(hojeC, -60)].sort().pop(), ate = bpcIni ? maisMeses(bpcIni.slice(0, 7), -1) : hojeC; let atras = 0, n = 0;
        for (let c = de; c <= ate && n < 61; c = maisMeses(c, 1), n++) atras += em(SM, c) * 13 / 12;
        if (bpcIni) for (let a = Math.max(+bpcIni.slice(0, 4), +hojeC.slice(0, 4) - 5); a < +hojeC.slice(0, 4); a++) atras += em(SM, a + '-12');
        const tentou = V.filter(v => v.tipo === 'beneficio' && TEMP.concat(INCAP).includes(v.especie) && /INDEFERIDO/i.test(v.situacao || '')).length;
        const contribAntes = tempoCnis(cnTit, ces.inicio.slice(0, 7)).meses;
        add(dur >= 12 ? 'alto' : 'medio', 'restabelecer', 'Auxílio por incapacidade cessado e hoje recebe BPC por deficiência: avaliar restabelecimento e aposentadoria por incapacidade',
          `O CNIS mostra auxílio por incapacidade (espécie ${ces.especie}) de ${dBR(ces.inicio)} a ${dBR(ces.fim)} — ${am(dur)} —${vao != null ? ` e, ${am(vao)} depois, a concessão do BPC à pessoa com deficiência` : ' e depois o BPC à pessoa com deficiência'}.${tentou ? ` Há ainda ${tentou} pedido(s) de auxílio indeferido(s).` : ''}${contribAntes < 12 ? ` O auxílio saiu com apenas ${contribAntes} contribuição(ões): houve dispensa de carência (acidente ou doença grave do art. 151), que vale também para a aposentadoria.` : ''} Se a doença ou deficiência é a mesma e a incapacidade não cessou em ${dBR(ces.fim)}, a alta foi indevida: cabe pedir o restabelecimento do auxílio desde a cessação e a conversão em aposentadoria por incapacidade permanente. Quem estava incapaz não perde a qualidade de segurado, e a própria avaliação do BPC (impedimento de longo prazo) ajuda a provar. Vantagens sobre o BPC: 13º salário, pensão por morte para os dependentes, não depende da renda da família nem do CadÚnico, e adicional de 25% se precisar de cuidador. Como a incapacidade é anterior à Reforma, a aposentadoria é de 100% do salário de benefício. Não há prazo de 10 anos para restabelecer benefício cessado; prescrevem só as parcelas de mais de 5 anos, e o BPC recebido é descontado. Ponto de atenção: com a alta há mais de 5 anos, parte dos juízes exige novo requerimento administrativo antes da ação — os pedidos negados depois da alta ajudam a suprir isso.`,
          { decai: false, base: 'arts. 15, 42, 59 e 62 da Lei 8.213; STF ADI 6.096 (sem decadência para cessação ou indeferimento); Súmula 85 do STJ', numeros: n ? `Sem benefício de ${cBR(de)} a ${cBR(ate)} (${n} meses dentro dos últimos 5 anos)` : '', ganho: { novaRmi: null, mensal: smHoje / 12, atrasados: atras, pct: 0, piso: true } });
        pedir.add('Laudos, exames e receitas de ' + ces.fim.slice(0, 4) + ' até hoje (para mostrar que a incapacidade não cessou)'); pedir.add('Laudo da perícia que cessou o auxílio e a avaliação médica e social do BPC (Meu INSS → "Laudo médico pericial" e cópia do processo)');
      }
      const neg = V.filter(v => v.tipo === 'beneficio' && /INDEFERIDO/i.test(v.situacao || ''));
      if (neg.length) { const porEsp = {}; neg.forEach(v => porEsp[v.especie] = (porEsp[v.especie] || 0) + 1);
        add('medio', 'indeferidos', `${neg.length} pedido(s) negado(s) antes: conferir as datas para cobrar atrasados`, `O CNIS registra pedidos indeferidos (${Object.entries(porEsp).map(([e, q]) => q + ' da espécie ' + e).join(', ')}), mas não mostra a data. Se o BPC foi negado antes e a deficiência e a renda da família já eram as mesmas, cabe cobrar as parcelas desde o primeiro requerimento (limitadas aos últimos 5 anos). Indeferimento não tem prazo de decadência.`, { decai: false, base: 'STF ADI 6.096; Súmula 85 do STJ; LOAS, art. 20' }); pedir.add('Datas e motivos dos pedidos negados (Meu INSS → "Consultar pedidos" / cópia dos processos)'); }
      if (tC && tC.meses >= 180) add('alto', 'bpc-aposentadoria', `Tem cerca de ${am(tC.meses)} de contribuição: pode ter direito a aposentadoria no lugar do BPC`, esp === '88' ? 'Com 180 contribuições e a idade mínima, a aposentadoria por idade substitui o BPC com vantagem: paga 13º, deixa pensão e não depende da renda da família. Conferir a idade na data do pedido e, se faltar pouco, tempo rural ou vínculos fora do CNIS (aposentadoria híbrida, STJ Tema 1.007).' : 'Com 15 anos de contribuição na condição de pessoa com deficiência, cabe a aposentadoria por idade da pessoa com deficiência (60 anos homem, 55 mulher) ou, com mais tempo, a por tempo de contribuição da LC 142/2013 — ambas com 13º e pensão.', { decai: false, base: esp === '88' ? 'art. 48 da Lei 8.213; STJ Tema 1.007' : 'LC 142/2013' });
      else if (tC && tC.meses >= 120 && esp === '88') add('info', 'bpc-aposentadoria', `Faltam cerca de ${180 - tC.meses} contribuições para a aposentadoria por idade`, 'Vale procurar tempo que não está no CNIS (rural, CTPS antiga, carnês) — completando 180 contribuições, a aposentadoria por idade substitui o BPC com 13º e pensão.', { decai: false, base: 'art. 48 da Lei 8.213; STJ Tema 1.007' });
      add('info', 'bpc-cuidados', 'Cuidados para não perder o BPC', 'Manter o CadÚnico atualizado (no máximo 2 anos sem atualizar) e avisar mudança de renda ou de endereço: o INSS revisa o benefício periodicamente. Se a pessoa com deficiência começar a trabalhar, o BPC é suspenso e ela pode pedir o auxílio-inclusão (metade do BPC).', { decai: false, base: 'LOAS, arts. 21 e 26-A (Lei 14.176/2021); Decreto 11.016/2022' });
    }

    /* ---- 11. Indícios pelos indicadores do CNIS ---- */
    if (cn) {
      const inds = new Set(cn.vinculos.flatMap(v => v.indicadores.concat(v.rem.flatMap(r => r.ind))));
      if ([...inds].some(i => /PROC-TRAB|RECL/.test(i))) { add('medio', 'trabalhista', 'CNIS tem vínculo ou remuneração vinda de processo trabalhista', 'Verbas salariais reconhecidas na Justiça do Trabalho entram no salário de contribuição e podem aumentar a média. O prazo de 10 anos conta do trânsito em julgado da sentença trabalhista, não da concessão.', { decai: false, base: 'STJ Tema 1.117' }); pedir.add('Sentença, cálculos e certidão de trânsito em julgado da ação trabalhista'); }
      const aa = cn.vinculos.find(v => v.tipo === 'beneficio' && ['94', '36'].includes(v.especie) && v.inicio && B.dib && v.inicio < B.dib);
      if (aa && APOS.includes(esp)) add(nv('medio'), 'aux-acidente', 'Recebia auxílio-acidente antes de se aposentar', `O valor mensal do auxílio-acidente (desde ${dBR(aa.inicio)}) integra o salário de contribuição para o cálculo da aposentadoria. Conferir na memória de cálculo se foi somado.` + obsDec, { base: 'art. 31 da Lei 8.213' });
    }

    /* ---- 12. Teses que NÃO cabem mais (para ninguém vender tese morta) ---- */
    const pre94Carta = ca && ca.temMemoria && ca.salarios.some(x => x.comp <= '1994-09');
    if (APOS.concat(INCAP, PENSAO).includes(esp) && ((tC && tC.pre94 >= 12) || (!tC && pre94Carta)) && B.dib && B.dib >= '1999-11-29') add('nao', 'vida-toda', 'Revisão da vida toda — encerrada', `${tC && tC.pre94 ? `O CNIS tem ${tC.pre94} contribuições anteriores a julho de 1994, mas o` : 'O'} STF validou a regra de transição da Lei 9.876/1999 (ADIs 2.110 e 2.111, 2024), cancelou a tese do Tema 1.102 (nov/2025) e encerrou o caso em definitivo em julho de 2026. Não propor.`, { decai: false, base: 'STF ADIs 2.110/2.111; Tema 1.102 cancelado' });

    /* ---- o que perguntar (o que nenhum documento mostra) ---- */
    const perguntas = [];
    if (assist) { perguntas.push('A doença ou deficiência de hoje é a mesma que deu o auxílio no passado? Desde quando não consegue trabalhar?'); perguntas.push('Trabalhou com carteira, pagou carnê ou trabalhou na roça em algum período que não aparece no CNIS?'); perguntas.push('Tem dependentes (cônjuge, filhos menores)? O BPC não deixa pensão; o benefício previdenciário deixa.'); }
    if (!assist && (APOS.includes(esp) || !esp)) { perguntas.push('Trabalhou na roça antes de 1991 (mesmo criança, com os pais)? Tempo rural pode ser averbado sem contribuição.'); perguntas.push('Serviu ao Exército, foi aluno-aprendiz ou trabalhou em órgão público com regime próprio? Esse tempo pode ser trazido por certidão.'); }
    if (!assist) perguntas.push('Ganhou ação trabalhista depois da concessão? As verbas entram no cálculo (prazo conta do trânsito em julgado).');
    if (!INCAP.includes(esp) && !assist) perguntas.push('Trabalhou com ruído, produto químico, hospital, frio, eletricidade? Pedir o PPP de cada empresa.');
    if (APOS.includes(esp)) perguntas.push('Tem deficiência (física, auditiva, visual, mental) desde antes de se aposentar? A aposentadoria da pessoa com deficiência (LC 142/2013) tem regras melhores.');
    if (noMinimo && !assist) add('info', 'minimo', 'Benefício concedido no salário mínimo', 'Revisão só compensa se a renda recalculada passar do salário mínimo — as estimativas acima já consideram isso.', { decai: false });

    const ord = { alto: 0, medio: 1, info: 2, venc: 3, nao: 4 }; T.sort((a, b) => ord[a.nivel] - ord[b.nivel] || ((b.ganho && b.ganho.mensal) || 0) - ((a.ganho && a.ganho.mensal) || 0));
    const melhor = T.filter(t => t.ganho && t.nivel !== 'nao' && t.nivel !== 'venc').sort((a, b) => b.ganho.mensal - a.ganho.mensal)[0] || null;
    return { B, prazo, teses: T, pedir: [...pedir], perguntas, comparacao, tempoCnis: tC, melhor, temCarta: !!ca, temCnis: !!cn, cnis: cn, carta: ca, docs };
  }

  root.XYZPrevid = { analisar, sexoPalpite, util: { am, pct, maisMeses, difMeses, em, TETO, SM } };
})(typeof window !== 'undefined' ? window : globalThis);
