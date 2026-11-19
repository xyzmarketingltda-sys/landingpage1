/* Leitores dos documentos do Meu INSS (Histórico de Créditos, CNIS, Carta de Concessão) e do Registrato do Banco Central.
   Roda 100% no navegador: o PDF nunca sai do computador.
   Uso: const t = await textoPdf(pdf); const tipo = XYZDocs.tipoDoc(t); const d = XYZDocs.ler(t); XYZDocs.cruzar(hiscon, [d, ...]) */
(function (root) {
  const num = s => { if (s == null) return null; const t = String(s).replace(/[^\d,.-]/g, ''); if (!t) return null; const v = Number(t.replace(/\./g, '').replace(',', '.')); return isNaN(v) ? null : v; };
  const dt = s => { const m = String(s || '').match(/(\d{2})\/(\d{2})\/(\d{4})/); return m ? `${m[3]}-${m[2]}-${m[1]}` : null; };
  const comp = s => { const m = String(s || '').match(/(\d{2})\/(\d{4})/); return m ? `${m[2]}-${m[1]}` : null; };
  const limpa = s => String(s || '').replace(/\s+/g, ' ').trim();
  const so = s => String(s || '').replace(/\D/g, '');
  const semAc = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
  const brl = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const dBR = s => s ? s.split('-').reverse().join('/') : '—';
  const cBR = s => s ? s.split('-').reverse().join('/') : '—';
  const pega = (t, re, i = 1) => { const m = t.match(re); return m ? limpa(m[i]) : ''; };

  function tipoDoc(t) {
    if (/Hist[óo]rico de Cr[ée]ditos/i.test(t) && /Rubrica/i.test(t)) return 'hiscre';
    if (/Carta de Concess[ãa]o/i.test(t)) return 'carta';
    if (/Rela[çc][õo]es Previdenci[áa]rias/i.test(t) && /CNIS|Extrato Previdenci[áa]rio/i.test(t)) return 'cnis';
    if (/Contas e Relacionamentos|\(CCS\)/i.test(t)) return 'ccs';
    if (/Empr[ée]stimos e Financiamentos|\(SCR\)/i.test(t)) return 'scr';
    return null;
  }
  const NOMES = { hiscre: 'Extrato de pagamentos (histórico de créditos)', carta: 'Carta de concessão', cnis: 'CNIS', ccs: 'Registrato — contas e relacionamentos', scr: 'Registrato — empréstimos e financiamentos' };

  /* ---------- Histórico de Créditos (extrato de pagamentos do benefício) ---------- */
  function lerHiscre(t) {
    const L = t.split('\n').map(limpa), R = { tipo: 'hiscre', meses: [] };
    R.nome = pega(t, /^\s*Nome:\s*(.+)$/m); R.cpf = so(pega(t, /CPF:\s*([\d.\-]+)/)); R.nascimento = dt(pega(t, /Data de Nascimento:\s*(\d{2}\/\d{2}\/\d{4})/i));
    R.nb = so(pega(t, /NB:\s*([\d.\-]+)/)); const e = t.match(/Esp[ée]cie:\s*(\d{2})\s*-\s*(.+)/); R.especie = e ? e[1] : ''; R.especieNome = e ? limpa(e[2]) : '';
    R.dib = dt(pega(t, /\(DIB\):\s*(\d{2}\/\d{2}\/\d{4})/)); R.dip = dt(pega(t, /\(DIP\):\s*(\d{2}\/\d{2}\/\d{4})/)); R.dcb = dt(pega(t, /\(DCB\):\s*(\d{2}\/\d{2}\/\d{4})/));
    R.mr = num(pega(t, /MR:\s*R\$\s*([\d.,]+)/)); R.ini = comp(pega(t, /Compet\. Inicial:\s*(\d{2}\/\d{4})/)); R.fim = comp(pega(t, /Compet\. Final:\s*(\d{2}\/\d{4})/));
    let m = null;
    for (const l of L) {
      let x;
      if ((x = l.match(/^(\d{2}\/\d{4})\s+\d{2}\/\d{2}\/\d{4}\s+R\$\s*([\d.,]+)\s*(.*)$/))) {
        const c = comp(x[1]); m = R.meses.find(k => k.comp === c);
        if (!m) { m = { comp: c, liquido: 0, status: '', rubricas: [] }; R.meses.push(m); }
        m.liquido += num(x[2]) || 0; m.status = (x[3].match(/\b(Pago|N[ãa]o Pago|Bloqueado|Invalidado|Pendente|Cancelado|Estornado)\b/i) || [])[1] || m.status; continue;
      }
      if (m && (x = l.match(/^(\d{3})\s+(.+?)\s+R\$\s*([\d.,]+)$/))) m.rubricas.push({ cod: x[1], desc: x[2], valor: num(x[3]) || 0 });
    }
    R.meses.sort((a, b) => a.comp.localeCompare(b.comp));
    R.meses.forEach(k => {
      const s = c => k.rubricas.filter(r => r.cod === c).reduce((a, r) => a + r.valor, 0);
      k.mr = s('101'); k.emp = s('216'); k.rmc = s('217'); k.rcc = s('268');
    });
    if (!R.meses.length) throw new Error('Histórico de créditos sem competências legíveis.');
    return R;
  }

  /* ---------- Registrato: Contas e Relacionamentos (CCS) ---------- */
  function lerCcs(t) {
    const R = { tipo: 'ccs', relacoes: [] };
    R.nome = pega(t, /Nome:\s*(.+)/); R.cpf = so(pega(t, /CPF\/CNPJ:\s*([\d.\-\/]+)/)); R.emissao = dt(pega(t, /emitido por:.*? em (\d{2}\/\d{2}\/\d{4})/));
    t.split('\n').map(limpa).forEach(l => {
      const x = l.match(/^(\d{2}\.\d{3}\.\d{3})\s*-\s*(.+?)\s+(\d{2}\/\d{2}\/\d{4})\s+(Ativo|\d{2}\/\d{2}\/\d{4})$/i);
      if (x) R.relacoes.push({ cnpj: so(x[1]), inst: x[2], inicio: dt(x[3]), fim: /ativo/i.test(x[4]) ? null : dt(x[4]) });
    });
    if (!R.relacoes.length) throw new Error('Relatório de contas (CCS) sem instituições legíveis.');
    return R;
  }

  /* ---------- Registrato: Empréstimos e Financiamentos (SCR) — leitura genérica ---------- */
  function lerScr(t) {
    const R = { tipo: 'scr', linhas: [], generico: true };
    R.nome = pega(t, /Nome:\s*(.+)/); R.cpf = so(pega(t, /CPF(?:\/CNPJ)?:\s*([\d.\-\/]+)/)); R.base = comp(pega(t, /(?:Data[- ]base|M[êe]s de refer[êe]ncia|Per[ií]odo)[^\d]{0,20}(\d{2}\/\d{4})/i));
    let inst = '';
    t.split('\n').map(limpa).forEach(l => {
      const i = l.match(/^(\d{2}\.\d{3}\.\d{3})\s*-\s*(.+?)(?:\s+R\$.*)?$/); if (i) inst = i[2];
      const vals = (l.match(/R\$\s*[\d.]+,\d{2}/g) || []).map(num);
      if (vals.length && /consign|cart[ãa]o|cheque|pessoal|financ|limite|vencid|preju[ií]zo|em dia|a vencer|cr[ée]dito/i.test(l)) R.linhas.push({ inst, txt: l, valores: vals, vencida: /vencid|preju[ií]zo|atras/i.test(l), consignado: /consign/i.test(l), limite: /limite/i.test(l) });
    });
    return R;
  }

  /* ---------- Carta de Concessão / Memória de Cálculo ---------- */
  function lerCarta(t) {
    const u = t.replace(/\s+/g, ' '), R = { tipo: 'carta', salarios: [], dependentes: [] };
    R.nome = pega(t, /^\s*Nome:\s*(.+)$/m); R.nit = pega(t, /Nit:\s*([\d.\-]+)/i); R.emissao = dt(pega(t, /(\d{2}\/\d{2}\/\d{4})\s+\d{2}:\d{2}:\d{2}/));
    R.nb = so(pega(u, /N[úu]mero do Benef[ií]cio:\s*([\d.\-]+)/)); R.ddb = dt(pega(u, /Data de Concess[ãa]o do Benef[ií]cio:\s*(\d{2}\/\d{2}\/\d{4})/));
    const e = u.match(/concedid[oa]\s+(.+?)\s*\((\d{2})\)/i); R.especieNome = e ? limpa(e[1]) : ''; R.especie = e ? e[2] : '';
    R.der = dt(pega(u, /requerido em\s*(\d{2}\/\d{2}\/\d{4})/i)); R.rmi = num(pega(u, /renda mensal(?: inicial)? de R\$\s*([\d.]+,\d{2})/i)); R.dib = dt(pega(u, /vig[êe]ncia a partir de\s*(\d{2}\/\d{2}\/\d{4})/i));
    // modelo antigo da carta (tudo em maiúsculas): "NOME NIT OL NB" numa linha e os dados na seguinte
    if (!R.nb) { const m = t.match(/^(.+?)\s+(\d[\d.]{8,}-\d)\s+([\d.]+)\s+(\d{3}\.\d{3}\.\d{3}-\d)\s*$/m); if (m) { R.nome = R.nome || limpa(m[1]); R.nit = R.nit || m[2]; R.nb = so(m[4]); } }
    R.dip = dt(pega(u, /in[íi]cio do pagamento a partir de\s*(\d{2}\/\d{2}\/\d{4})/i)); if (!R.dib) R.dib = R.dip;
    R.primeiroPgto = dt(pega(u, /compare[çc]a a partir de\s*(\d{2}\/\d{2}\/\d{4})/i));
    if (!R.emissao) R.emissao = dt(pega(u, /DATA:\s*(\d{2}\/\d{2}\/\d{4})/i));
    R.aps = pega(t, /Aps:\s*(.+)/i);
    t.split('\n').map(limpa).forEach(l => {
      const x = l.match(/^(\d{3})\s+(\d{2}\/\d{4})\s+([\d.]+,\d{2})\s+(\d+,\d{3,6})\s+([\d.]+,\d{2})\s*(.*)$/);
      if (x) R.salarios.push({ seq: +x[1], comp: comp(x[2]), sal: num(x[3]), indice: num(x[4]), corr: num(x[5]), desc: /DESCONSID/i.test(x[6]), obs: x[6] });
    });
    R.fator = num(pega(u, /Fator Previdenci[áa]rio\s*=\s*=?\s*([\d,]+)/i));
    let x = u.match(/Tempo de contribui[çc][ãa]o\s*=\s*(\d+)\s*ano\(s\)\s*(\d+)\s*mes\(es\)\s*(\d+)\s*dia/i);
    if (x) R.tc = { a: +x[1], m: +x[2], d: +x[3], meses: +x[1] * 12 + +x[2] + (+x[3]) / 30 };
    x = u.match(/Tempo de contribui[çc][ãa]o\s*=\s*(\d+)\s*grupos? de 12/i); if (x) R.grupos = +x[1];
    R.es = num(pega(u, /Expectativa de Sobrevida\s*=\s*([\d,]+)/i)); R.idade = num(pega(u, /Idade\s*=\s*(\d+)\s*ano/i));
    x = u.match(/M[ée]dia dos\s*(\d+)%\s*maiores sal[áa]rios de contribui[çc][ãa]o\s*=\s*([\d.,]+)\s*\/\s*(\d+)\s*=\s*([\d.,]+)/i);
    if (x) R.media = { pct: +x[1], soma: num(x[2]), div: +x[3], valor: num(x[4]) };
    x = u.match(/Sal[áa]rio de Benef[ií]cio\s*=[^=]*=\s*([\d.,]+)\s*(\(\s*SAL[ÁA]RIO M[ÍI]NIMO\s*\))?/i); if (x) { R.sb = num(x[1]); R.noMinimo = !!x[2]; }
    { const c = pega(u, /onde,?\s*Coeficiente\s*=\s*([\d.,]+)/i); R.coef = c ? parseFloat(c.replace(',', '.')) : null; if (R.coef != null && R.coef > 1.5) R.coef = R.coef / 100; }
    x = u.match(/Per[ií]odo adicional de contribui[çc][ãa]o para aposentadoria proporcional\s*=\s*(\d+)\s*ano\(s\)\s*(\d+)\s*mes\(es\)\s*(\d+)\s*dia/i);
    if (x) R.pedagio = { a: +x[1], m: +x[2], d: +x[3] };
    R.instituidor = pega(t, /Instituidor[^:]*:\s*(.+)/i);
    R.lei = pega(u, /C[áa]lculo de Benef[ií]cios segundo a\s*(.+?)\s*Seq\./i);
    R.temMemoria = R.salarios.length > 0 && !!R.media;
    if (!R.nb && !R.dib) throw new Error('Carta de concessão sem número do benefício ou data de início legível.');
    return R;
  }

  /* ---------- CNIS (Extrato Previdenciário) ---------- */
  const RE_IND = /\b([A-Z]{3,5}(?:-[A-Z0-9]+)+|IEAN|IDT|ACNISVR|IGFIP-INF|IVIN-JORN-PARC)\b/g;
  function lerCnis(t) {
    const fimLeg = t.search(/Legenda de Indicadores/i), corpo = fimLeg > 0 ? t.slice(0, fimLeg) : t;
    const L = corpo.split('\n').map(limpa), R = { tipo: 'cnis', vinculos: [] };
    const id = t.match(/NIT:\s*([\d.\-]+)\s+CPF:\s*([\d.\-]+)\s+Nome:\s*(.+)/);
    if (id) { R.nit = id[1]; R.cpf = so(id[2]); R.nome = limpa(id[3]); }
    R.nascimento = dt(pega(t, /Data de nascimento:\s*(\d{2}\/\d{2}\/\d{4})/i)); R.emissao = dt(pega(t, /Extrato Previdenci[áa]rio\s*(\d{2}\/\d{2}\/\d{4})/i)) || dt(pega(t, /(\d{2}\/\d{2}\/\d{4})\s+\d{2}:\d{2}:\d{2}/));
    let v = null, modo = '';
    L.forEach((l, i) => {
      if (/^(P[áa]gina \d|INSS$|CNIS -|Extrato Previdenci|Identifica[çc][ãa]o do Filiado|NIT:|Data de nascimento|Rela[çc][õo]es Previd|Matr[íi]cula do|Seq\. NIT|O INSS poder|O segurado somente|ou agrupamento)/i.test(l)) return;
      const cab = l.match(/^(\d{1,3})\s+(\d{3}\.\d{5}\.\d{2}-\d)\s+(.*)$/);
      if (cab && /\d{2}\/\d{2}\/\d{4}|Benef[ií]cio|INDEFERIDO/i.test(cab[3])) {
        const resto = cab[3], datas = resto.match(/\d{2}\/\d{2}\/\d{4}/g) || [];
        v = { seq: +cab[1], inicio: dt(datas[0]), fim: dt(datas[1]) || null, indicadores: [], rem: [] };
        if (/\bBenef[ií]cio\b/.test(resto)) {
          v.tipo = 'beneficio'; v.nb = (resto.match(/^(\d{9,10})\b/) || [])[1] || '';
          const sit = (resto.match(/(\d{1,2}\s*-\s*[A-ZÀ-Ú ]+)$/) || [])[1] || '';
          const meio = resto.replace(/^.*?Benef[ií]cio\s*/, '').slice(0, sit ? -sit.length : undefined);
          let e = meio.match(/(\d{2})\s*-\s*([A-ZÀ-Ú .\/]+?)(?=\s+\d{2}\/\d{2}\/\d{4}|\s*$)/);
          if (!e) { const ant = (L[i - 1] || '').match(/^(\d{2})\s*-\s*([A-ZÀ-Ú .\/]+)$/); if (ant) e = [0, ant[1], ant[2] + ' ' + ((L[i + 1] || '').match(/^[A-ZÀ-Ú ]+$/) || [''])[0]]; }
          v.especie = e ? e[1] : ''; v.especieNome = e ? limpa(e[2]) : '';
          v.situacao = limpa(sit);
          v.origem = 'Benefício ' + v.especie + (v.especieNome ? ' - ' + v.especieNome : '');
        } else if (/RECOLHIMENTO/.test(resto)) {
          v.tipo = 'recolhimento'; v.filiado = limpa((resto.match(/RECOLHIMENTO\s+(.+?)\s+\d{2}\/\d{2}\/\d{4}/) || [])[1]); v.origem = 'Recolhimento' + (v.filiado ? ' (' + v.filiado + ')' : '');
          v.indicadores = (resto.replace(/.*\d{2}\/\d{2}\/\d{4}/, '').match(RE_IND) || []);
        } else {
          v.tipo = 'emprego'; const c = resto.match(/^(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}|\d{2}\.\d{3}\.\d{5}\/\d{2}|\d{3}\.\d{3}\.\d{3}-\d{2}|[\d.\/\-]{8,20})\s+/);
          v.cnpj = c ? c[1] : ''; v.origem = limpa(resto.slice(c ? c[0].length : 0).replace(/\s*\d{2}\/\d{2}\/\d{4}.*$/, '').replace(/\s+(Empregado ou Agente|Empregado|Trabalhador Avulso|Contribuinte Individual|Empregado Dom[ée]stico|Segurado Especial|P[úu]blico)$/i, ''));
          const TF = /\s*(Empregado ou Agente|Empregado Dom[ée]stico|Empregado|Trabalhador Avulso|Contribuinte Individual|Segurado Especial|P[úu]blico)\s*$/i;
          if (!v.origem) v.origem = limpa(((L[i - 1] || '').match(/^[A-ZÀ-Ú0-9][A-ZÀ-Ú0-9 .,&\/\-]+/) ? (L[i - 1] || '').replace(TF, '') : '') + ' ' + (/^(Remunera|Indicadores|Seq\.)/i.test(L[i + 1] || '') ? '' : (L[i + 1] || '').replace(TF, '')));
          const viz = resto + ' ' + (L[i - 1] || '') + ' ' + (L[i + 1] || '');
          v.filiado = /Segurado Especial/i.test(viz) ? 'Segurado Especial' : /Trabalhador Avulso/i.test(viz) ? 'Trabalhador Avulso' : /Empregado Dom[ée]stico/i.test(viz) ? 'Empregado Doméstico' : /Contribuinte Individual/i.test(viz) ? 'Contribuinte Individual' : 'Empregado';
          v.ultRemun = comp((resto.match(/\s(\d{2}\/\d{4})\s*$/) || [])[1]);
        }
        R.vinculos.push(v); modo = ''; return;
      }
      if (!v) return;
      if (/^Indicadores:/i.test(l)) { v.indicadores.push(...(l.match(RE_IND) || [])); return; }
      if (/^Remunera[çc][õo]es$/i.test(l)) { modo = 'rem'; return; }
      if (/^Contribui[çc][õo]es$/i.test(l)) { modo = 'con'; return; }
      if (/^Compet[êe]ncia/i.test(l)) return;
      if (modo === 'con') {
        const re = /(\d{2}\/\d{4})\s+(\d{2}\/\d{2}\/\d{4})\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})((?:\s+(?!\d{2}\/\d{4})[A-Z][A-Z0-9\-]+,?)*)/g; let x, achou = false;
        while ((x = re.exec(l))) { achou = true; v.rem.push({ comp: comp(x[1]), valor: num(x[4]), contrib: num(x[3]), pago: dt(x[2]), ind: (x[5].match(RE_IND) || []) }); }
        if (achou) return;
      }
      if (modo) {
        const re = /(\d{2}\/\d{4})\s+([\d.]+,\d{2})((?:\s+(?!\d{2}\/\d{4})[A-Z][A-Z0-9\-]+,?)*)/g; let x;
        while ((x = re.exec(l))) v.rem.push({ comp: comp(x[1]), valor: num(x[2]), ind: (x[3].match(RE_IND) || []) });
      }
    });
    if (!R.vinculos.length) throw new Error('CNIS sem vínculos legíveis.');
    return R;
  }

  function ler(t) {
    const tp = tipoDoc(t); if (!tp) return null;
    return { hiscre: lerHiscre, carta: lerCarta, cnis: lerCnis, ccs: lerCcs, scr: lerScr }[tp](t);
  }

  /* ---------- a quem pertence (liga o anexo ao HISCON do mesmo cliente) ---------- */
  const mesmoNome = (a, b) => { a = semAc(a); b = semAc(b); if (!a || !b) return false; if (a === b) return true; const pa = a.split(' '), pb = b.split(' '); return pa[0] === pb[0] && pa[pa.length - 1] === pb[pb.length - 1] && pa.length > 1; };
  function mesmaPessoa(h, d) {
    if (!h || !d) return false;
    if (so(h.nb) && so(d.nb) && so(h.nb) === so(d.nb)) return true;
    return mesmoNome(h.nome, d.nome) || (d.instituidor && mesmoNome(h.nome, d.instituidor));
  }
  const anos = (de, ate) => { if (!de || !ate) return null; const a = new Date(de + 'T12:00:00'), b = new Date(ate + 'T12:00:00'); let n = b.getFullYear() - a.getFullYear(); if (b.getMonth() < a.getMonth() || (b.getMonth() === a.getMonth() && b.getDate() < a.getDate())) n--; return n; };
  const dias = (de, ate) => Math.round((new Date(ate + 'T12:00:00') - new Date(de + 'T12:00:00')) / 864e5);
  const CH_BANCO = ['FACTA', 'PAN', 'BMG', 'C6', 'PARANA', 'ITAU', 'BRADESCO', 'SANTANDER', 'BRASIL', 'CAIXA', 'DAYCOVAL', 'MERCANTIL', 'AGIBANK', 'SAFRA', 'OLE', 'CREFISA', 'BANRISUL', 'INTER', 'QI', 'MASTER', 'PICPAY', 'SICOOB', 'SICREDI', 'INBURSA', 'CETELEM', 'BRB', 'PINE', 'DIGIO', 'BV', 'VOTORANTIM', 'FINANTO', 'HAPPY', 'CAPITAL', 'ALFA', 'PAULISTA', 'SEGURO', 'NUBANK', 'NU', 'ORIGINAL', 'SOFISA', 'BARIGUI', 'CCB', 'SENFF', 'FICSA', 'ZEMA', 'NEON', 'WILL', 'MERCADO'];
  const chaves = n => { const t = ' ' + semAc(n).replace(/[^A-Z0-9 ]/g, ' ') + ' '; return CH_BANCO.filter(k => t.includes(' ' + k + ' ') || (k.length > 4 && t.includes(k))); };
  const mesmoBanco = (a, b) => { const ka = chaves(a), kb = chaves(b); return ka.some(k => k !== 'BRASIL' && kb.includes(k)) || (ka.includes('BRASIL') && kb.includes('BRASIL') && /BCO DO BRASIL|BANCO DO BRASIL/.test(semAc(a)) && /BCO DO BRASIL|BANCO DO BRASIL/.test(semAc(b))); };

  /* ---------- CRUZAMENTOS com o HISCON ---------- */
  const ASSOC = /CONTRIB|MENSALIDADE|ASSOCIA|SINDIC|CONFEDERA|FEDERA[ÇC]|ENTIDADE|UNI[ÃA]O|APOSENTADOS|PENSIONISTAS|CONAFER|SINDNAPI|AMBEC|CEBAP|UNASPUB|CONTAG|COBAP|AAPB|ABAMSP|CAAP|MASTER PREV|ABCB|UNIVERSO|APDAP|AAPEN|ABSP/i;
  function cruzarHiscre(h, cr) {
    const A = [], add = (nivel, titulo, tese, detalhe) => A.push({ nivel, titulo, tese, detalhe: detalhe || '', fonte: 'Extrato de pagamentos' });
    const ult = cr.meses[cr.meses.length - 1], per = `${cBR(cr.meses[0].comp)} a ${cBR(ult.comp)} (${cr.meses.length} competências)`;
    const tot = k => cr.meses.reduce((a, m) => a + (m[k] || 0), 0), tEmp = tot('emp'), tRmc = tot('rmc'), tRcc = tot('rcc');
    add('info', `Descontado no período: ${brl(tEmp + tRmc + tRcc)}`, `Período do extrato: ${per}. Empréstimos consignados ${brl(tEmp)} · cartão RMC ${brl(tRmc)} · cartão RCC ${brl(tRcc)}. Para o cálculo completo da restituição, peça ao cliente o extrato de pagamentos desde a primeira parcela (o Meu INSS deixa escolher o período).`);
    const C = (h && h.contratos) || [], ativos = C.filter(c => c.tipo === 'ativo' && c.parcela > 0);
    // quanto já foi descontado por contrato (liga pelo valor exato da parcela)
    if (h) {
      const usados = new Map(), lin = [];
      ativos.forEach(c => {
        const k = c.parcela.toFixed(2); usados.set(k, (usados.get(k) || 0) + 1);
        let n = 0; cr.meses.forEach(m => { if (m.rubricas.filter(r => r.cod === '216' && r.valor.toFixed(2) === k).length >= usados.get(k)) n++; });
        c._descMeses = n; c._descTotal = n * c.parcela;
        lin.push(`${c.banco || 'banco'} · contrato ${c.contrato || '—'} · parcela ${brl(c.parcela)} → ${n} desconto(s) = ${brl(n * c.parcela)}`);
      });
      if (lin.length) add('info', 'Quanto cada contrato ativo já descontou (no período do extrato)', 'Ligação feita pelo valor exato da parcela — confira quando houver dois contratos de mesma parcela.', lin.join(' | '));
      // descontos do último mês sem contrato ativo correspondente
      const sobra = ativos.map(c => c.parcela.toFixed(2)), semPar = [];
      ult.rubricas.filter(r => r.cod === '216').forEach(r => { const i = sobra.indexOf(r.valor.toFixed(2)); if (i >= 0) sobra.splice(i, 1); else semPar.push(r.valor); });
      const defas = h.emissao && ult.comp ? Math.abs(dias(ult.comp + '-15', h.emissao)) > 75 : false;
      if (semPar.length) add(defas ? 'medio' : 'alto', `${semPar.length} desconto(s) de empréstimo sem contrato ativo no HISCON`, `Na competência ${cBR(ult.comp)} há desconto de consignação (rubrica 216) cujo valor não bate com a parcela de nenhum contrato ativo do HISCON: ${semPar.map(brl).join(', ')}.${defas ? ' O HISCON e o extrato são de datas diferentes — gere os dois no mesmo dia para confirmar.' : ' Pode ser contrato já excluído que continua descontando, ou contrato que não aparece no HISCON.'}`);
      if (sobra.length && !defas) add('info', `${sobra.length} contrato(s) ativo(s) sem desconto na última competência`, `Parcelas ${sobra.map(v => brl(Number(v))).join(', ')} não aparecem no extrato de ${cBR(ult.comp)} — pode ser contrato recém-averbado, suspenso ou com carência.`);
      // contrato excluído que continuou descontando
      const exc = [];
      C.filter(c => c.tipo === 'excluido' && c.parcela > 0 && c.exclusao).forEach(c => {
        const k = c.parcela.toFixed(2), depois = cr.meses.filter(m => m.comp > c.exclusao.slice(0, 7) && m.rubricas.filter(r => r.cod === '216' && r.valor.toFixed(2) === k).length > ativos.filter(a => a.parcela.toFixed(2) === k).length);
        if (depois.length >= 2) exc.push(`${c.banco || 'banco'} contrato ${c.contrato || '—'} (excluído em ${dBR(c.exclusao)}): parcela de ${brl(c.parcela)} ainda descontada em ${depois.length} competência(s) depois`);
      });
      if (exc.length) add('alto', 'Desconto continuou depois do contrato excluído/encerrado', 'Cobrança indevida após o fim do contrato — restituição em dobro (CDC, art. 42, parágrafo único). Conferir pelo valor da parcela.', exc.join(' | '));
      // cartão descontando sem cartão no HISCON
      const temCartao = h.cartoes && Object.values(h.cartoes).some(l => l && l.length);
      if ((tRmc + tRcc) > 0 && !temCartao) add('alto', 'Desconto de cartão (RMC/RCC) sem cartão no HISCON', `O extrato mostra ${brl(tRmc + tRcc)} descontados de cartão consignado no período, mas o HISCON não lista cartão. Conferir a origem do desconto.`);
    }
    if (tRmc > 0 || tRcc > 0) add('medio', `Cartão consignado: ${brl(tRmc + tRcc)} descontados em ${cr.meses.filter(m => m.rmc + m.rcc > 0).length} competência(s)`, 'Desconto mensal de RMC (rubrica 217) e/ou RCC (rubrica 268). Se o cliente achava que era empréstimo comum, ou nunca usou o cartão, é a tese do "empréstimo travestido de cartão": some os descontos e compare com o valor recebido (fatura do cartão ajuda a provar).', `RMC ${brl(tRmc)} · RCC ${brl(tRcc)}`);
    // margem estourada no mês
    const pior = (k, lim) => cr.meses.filter(m => m.mr > 0 && m[k] / m.mr > lim + 0.004).sort((a, b) => b[k] / b.mr - a[k] / a.mr)[0];
    const pe = pior('emp', 0.35), pr = pior('rmc', 0.05), pc = pior('rcc', 0.05);
    if (pe) add('alto', `Empréstimos acima de 35% do benefício (${(pe.emp / pe.mr * 100).toFixed(1)}% em ${cBR(pe.comp)})`, `Na competência ${cBR(pe.comp)} os descontos de empréstimo somaram ${brl(pe.emp)} para um benefício de ${brl(pe.mr)}. O limite legal para empréstimo consignado é 35% (Lei 10.820/2003, art. 6º, § 5º). Conferir a base de cálculo no HISCON.`);
    if (pr) add('medio', `RMC acima de 5% do benefício (${(pr.rmc / pr.mr * 100).toFixed(1)}% em ${cBR(pr.comp)})`, `Desconto de RMC de ${brl(pr.rmc)} para benefício de ${brl(pr.mr)} — limite de 5%.`);
    if (pc) add('medio', `RCC acima de 5% do benefício (${(pc.rcc / pc.mr * 100).toFixed(1)}% em ${cBR(pc.comp)})`, `Desconto de RCC de ${brl(pc.rcc)} para benefício de ${brl(pc.mr)} — limite de 5%.`);
    // outros descontos (associações, etc.)
    const out = {};
    cr.meses.forEach(m => m.rubricas.forEach(r => { if (r.cod[0] === '2' && !['216', '217', '268', '215', '218'].includes(r.cod)) { const k = r.cod + ' ' + r.desc; (out[k] = out[k] || { n: 0, t: 0, desc: r.desc }); out[k].n++; out[k].t += r.valor; } }));
    Object.entries(out).forEach(([k, o]) => {
      if (ASSOC.test(o.desc)) add('alto', `Mensalidade de associação/sindicato: ${brl(o.t)} em ${o.n} desconto(s)`, `Rubrica ${k}. Desconto associativo só vale com autorização expressa do segurado — se o cliente não reconhece, cabe exclusão, restituição em dobro e dano moral. Conferir também o ressarcimento administrativo aberto pelo INSS para descontos associativos não autorizados.`);
      else add('info', `Outro desconto no benefício: ${o.desc} — ${brl(o.t)} em ${o.n} lançamento(s)`, `Rubrica ${k}. Conferir a origem (imposto de renda, pensão alimentícia, consignação diversa).`);
    });
    return A;
  }

  function cruzarCcs(h, cc) {
    const A = [], add = (nivel, titulo, tese, detalhe) => A.push({ nivel, titulo, tese, detalhe: detalhe || '', fonte: 'Registrato (contas)' });
    const ref = cc.emissao || new Date().toISOString().slice(0, 10), rec = cc.relacoes.filter(r => dias(r.inicio, ref) <= 730).sort((a, b) => b.inicio.localeCompare(a.inicio));
    add('info', `${cc.relacoes.filter(r => !r.fim).length} relacionamento(s) bancário(s) ativo(s), ${rec.length} aberto(s) nos últimos 2 anos`, 'Confirme com o cliente se ele reconhece todas as contas — conta que ele não abriu é sinal de fraude (a conta costuma ser aberta só para receber o crédito do empréstimo).', rec.map(r => `${r.inst} desde ${dBR(r.inicio)}`).join(' | '));
    if (h) {
      const junto = [];
      (h.contratos || []).forEach(c => { if (!c.inclusao) return; cc.relacoes.forEach(r => { if (mesmoBanco(c.banco, r.inst) && Math.abs(dias(r.inicio, c.inclusao)) <= 10) junto.push(`${r.inst}: relacionamento iniciado em ${dBR(r.inicio)} · contrato ${c.contrato || '—'} incluído em ${dBR(c.inclusao)} (${brl(c.emprestado)})`); }); });
      if (junto.length) add('medio', `${junto.length} contrato(s) com conta aberta na mesma semana`, 'O relacionamento com o banco começou junto com o empréstimo. Sozinho não é irregular, mas, se o cliente não reconhece a conta ou o contrato, é o padrão de contratação por terceiro: pedir ao banco o dossiê (selfie, IP, geolocalização) e o comprovante do crédito.', junto.join(' | '));
    }
    return A;
  }

  function cruzarScr(h, sc) {
    const A = [], add = (nivel, titulo, tese, detalhe) => A.push({ nivel, titulo, tese, detalhe: detalhe || '', fonte: 'Registrato (empréstimos)' });
    if (!sc.linhas.length) { add('info', 'Relatório de empréstimos (SCR) anexado, mas não consegui ler os valores', 'Leitura genérica: este modelo de relatório ainda não foi calibrado com um documento real. Confira à mão e me envie um exemplo para ajustar.'); return A; }
    const insts = [...new Set(sc.linhas.map(l => l.inst).filter(Boolean))], venc = sc.linhas.filter(l => l.vencida && l.valores.some(v => v > 0));
    add('info', `Dívidas registradas no Banco Central em ${insts.length} instituição(ões)`, 'Leitura genérica do relatório (ainda não calibrada com um documento real — confira os valores no PDF). Serve para ver dívidas fora do consignado e avaliar superendividamento (Lei 14.181/2021): compare o total das parcelas com a renda do benefício.', insts.join(' | '));
    if (venc.length) add('medio', `${venc.length} linha(s) com dívida vencida ou em prejuízo`, 'Há operações em atraso no SCR — indício de superendividamento; conferir no PDF de quais bancos.', venc.slice(0, 8).map(l => (l.inst ? l.inst + ': ' : '') + l.txt.slice(0, 90)).join(' | '));
    if (h) { const fora = insts.filter(i => !(h.contratos || []).some(c => mesmoBanco(c.banco, i))); if (fora.length) add('info', `${fora.length} instituição(ões) com dívida que não aparecem no HISCON`, 'Crédito fora do consignado do INSS (pessoal, cartão, débito em conta). Débito em conta que consome o benefício também pode ser discutido.', fora.join(' | ')); }
    return A;
  }

  function cruzarConcessao(h, ca, cn) {
    const A = [], add = (nivel, titulo, tese, detalhe) => A.push({ nivel, titulo, tese, detalhe: detalhe || '', fonte: ca ? 'Carta de concessão' : 'CNIS' });
    const nasc = cn && cn.nascimento, C = (h && h.contratos) || [];
    if (ca && ca.ddb && ca.ddb >= '2019-04-01' && C.length) {
      const cedo = C.filter(c => c.inclusao && dias(ca.ddb, c.inclusao) >= 0 && dias(ca.ddb, c.inclusao) < 90);
      const forte = cedo.some(c => dias(ca.ddb, c.inclusao) < 30) && ca.ddb < '2025-01-01';
      if (cedo.length) add(forte ? 'alto' : 'medio', `${cedo.length} contrato(s) averbado(s) menos de 90 dias depois da concessão`, `O benefício foi concedido em ${dBR(ca.ddb)}. Benefício concedido desde 01/04/2019 nasce bloqueado para consignado por 90 dias contados da data de despacho (IN PRES/INSS 138/2022, art. 8º; antes, IN 28/2008 na redação da IN 100/2018). Contrato dentro desse prazo indica desbloqueio irregular ou assédio logo após a concessão. Exceções a conferir na data do contrato: durante a pandemia o prazo caiu para 30 dias, e para benefícios concedidos a partir de 01/01/2025 a IN 172/2024 admitiu a contratação desde a concessão com o banco pagador do benefício.`, cedo.map(c => `${c.banco || 'banco'} ${c.contrato || ''} em ${dBR(c.inclusao)} (${dias(ca.ddb, c.inclusao)} dias depois)`).join(' | '));
    }
    if (ca && ['31', '91'].includes(ca.especie) && C.length) add('alto', 'Benefício temporário (auxílio por incapacidade) com consignado', `A carta mostra espécie ${ca.especie} (${ca.especieNome}). Auxílio por incapacidade temporária não admite empréstimo consignado.`);
    if (nasc && C.length) {
      const id = C.filter(c => c.inclusao).map(c => ({ c, i: anos(nasc, c.inclusao) })), i80 = id.filter(x => x.i >= 80), i70 = id.filter(x => x.i >= 70 && x.i < 80), men = id.filter(x => x.i < 18);
      if (men.length) add('alto', `${men.length} contrato(s) feito(s) quando o titular era menor de idade`, 'Contratação em nome de menor exige representante legal e, para o INSS, autorização judicial.', men.map(x => `${x.c.banco || ''} ${dBR(x.c.inclusao)} (${x.i} anos)`).join(' | '));
      if (i80.length || i70.length) add('info', `Idade na contratação: ${i80.length} contrato(s) com 80 anos ou mais, ${i70.length} entre 70 e 79`, `Nascimento em ${dBR(nasc)}. Idoso é consumidor hipervulnerável (Estatuto da Pessoa Idosa; CDC, art. 39, IV) — reforça vício de consentimento e dever de informação, e dá prioridade especial na tramitação acima de 80 anos.`, i80.concat(i70).slice(0, 10).map(x => `${x.c.banco || ''} ${dBR(x.c.inclusao)}: ${x.i} anos`).join(' | '));
    }
    if (cn && C.length) {
      const b = cn.vinculos.filter(v => v.tipo === 'beneficio' && v.inicio && /ATIVO|CESSADO/i.test(v.situacao || '')), temp = b.filter(v => ['31', '91'].includes(v.especie));
      const durante = []; temp.forEach(v => C.forEach(c => { if (c.inclusao && c.inclusao >= v.inicio && (!v.fim || c.inclusao <= v.fim) && !b.some(o => !['31', '91'].includes(o.especie) && o.inicio <= c.inclusao && (!o.fim || o.fim >= c.inclusao))) durante.push(`${c.banco || ''} ${c.contrato || ''} em ${dBR(c.inclusao)} (auxílio de ${dBR(v.inicio)} a ${dBR(v.fim)})`); }));
      if (durante.length) add('alto', `${durante.length} contrato(s) averbado(s) enquanto o cliente recebia auxílio por incapacidade`, 'Pelo CNIS, na data do contrato o único benefício ativo era auxílio por incapacidade temporária, que não admite consignado.', durante.join(' | '));
    }
    if ((ca || cn) && !h) add('info', 'Carta de concessão / CNIS anexados', 'Com o HISCON do mesmo cliente o sistema confere se houve contrato nos 90 dias de bloqueio depois da concessão, contrato durante auxílio por incapacidade e a idade do titular em cada contratação.');
    else if ((ca || cn) && !A.length) add('info', 'Carta de concessão / CNIS conferidos: nada de irregular nos contratos', 'Data de concessão, espécie e idade do titular não apontam problema nos contratos do HISCON. Para saber se o benefício em si pode ser revisto, use o botão Previdenciário.');
    return A;
  }

  // anexos: lista de documentos lidos; devolve os alertas dos que pertencem ao cliente do HISCON
  function cruzar(h, anexos) {
    const meus = (anexos || []).filter(d => !h || mesmaPessoa(h, d)), A = [];
    const um = tp => meus.filter(d => d.tipo === tp).pop();
    const cr = um('hiscre'), cc = um('ccs'), sc = um('scr'), ca = um('carta'), cn = um('cnis');
    try { if (cr) A.push(...cruzarHiscre(h, cr)); } catch (e) { console.error(e); }
    try { if (cc) A.push(...cruzarCcs(h, cc)); } catch (e) { console.error(e); }
    try { if (sc) A.push(...cruzarScr(h, sc)); } catch (e) { console.error(e); }
    try { if (ca || cn) A.push(...cruzarConcessao(h, ca, cn)); } catch (e) { console.error(e); }
    const ord = { alto: 0, medio: 1, info: 2 };
    return { alertas: A.sort((a, b) => ord[a.nivel] - ord[b.nivel]), usados: meus };
  }

  root.XYZDocs = { tipoDoc, ler, lerHiscre, lerCcs, lerScr, lerCarta, lerCnis, cruzar, mesmaPessoa, mesmoNome, NOMES, util: { num, dt, comp, limpa, so, semAc, brl, dBR, cBR, anos, dias } };
})(typeof window !== 'undefined' ? window : globalThis);
