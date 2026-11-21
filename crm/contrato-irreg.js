/* XYZ — leitor de irregularidades em contratos de consignado (PDF do banco, lido inteiro).
   Usado pelo robô do Drive (função ler-contrato) e pela tela crm/irregularidades.html.
   Não guarda nomes nem CPFs de terceiros: só fatos (datas, taxa, sim/não) e os apontamentos.

   Regras usadas (pesquisadas em nov/2026):
   • Representante legal (tutor, curador, guardião) — IN INSS 28/2008 não previa; IN 100/2018 (31/12/2018) passou a exigir
     autorização judicial; IN 136/2022 (12/08/2022) dispensou a autorização; o TRF3 suspendeu essa dispensa em jun/2025
     e a IN 190/2025 (DOU 16/07/2025) voltou a exigir autorização judicial para contratos novos. Código Civil arts. 1.691, 1.748 e 1.781.
   • Teto de juros do CNPS — tabela abaixo (datas de vigência aproximadas; há folga de 45 dias na comparação).
   • Analfabeto — CC art. 595: assinatura a rogo e duas testemunhas (STJ, 3ª Turma, 2026: contratação digital sem isso é nula).
   • Tarifa de cadastro/TAC — vedada no consignado do INSS (IN 28/2008, art. 13, II; IN 138/2022, art. 12).
   • Prazo — 96 parcelas até 18/05/2026; 108 desde 19/05/2026 (IN 204/2026). Mesma regra do leitor de HISCON.
   • Biometria (selfie) no contrato: obrigatória desde a IN 138/2022, implantada em 2023. A anuência biométrica no Meu INSS é de 19/05/2026 (Lei 15.327/2026). */
(function (root) {
  const TETO_EMP = [['2000-01-01', 2.5], ['2017-04-01', 2.14], ['2017-10-06', 2.08], ['2020-03-23', 1.80], ['2022-01-01', 2.14], ['2023-03-16', 1.70], ['2023-03-28', 1.97], ['2023-08-25', 1.91], ['2023-10-23', 1.84], ['2023-12-13', 1.80], ['2024-01-11', 1.76], ['2024-02-28', 1.72], ['2024-04-24', 1.68], ['2024-06-03', 1.66], ['2025-01-09', 1.80], ['2025-03-25', 1.85]];
  const MESES = { janeiro: 1, fevereiro: 2, 'março': 3, marco: 3, abril: 4, maio: 5, junho: 6, julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12 };
  const p2 = n => String(n).padStart(2, '0');
  const hojeISO = () => new Date().toISOString().slice(0, 10);
  const menosDias = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };
  function tetoEm(iso) {          // maior teto que valeu nos 45 dias antes do contrato (as datas de vigência variam alguns dias)
    const de = menosDias(iso, 45); let t = 0;
    TETO_EMP.forEach(([d, v], i) => { const fim = (TETO_EMP[i + 1] || ['9999'])[0]; if (d <= iso && fim > de) t = Math.max(t, v); });
    return t;
  }
  // todas as datas de um trecho, em ISO (aceita 20/12/2023, 04-07-2024, 2/7/2025 e "20 de Dezembro de 2023")
  function datas(s) {
    const out = []; let m;
    const A = /(?<!\d)(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})(?!\d)/g, B = /(?<!\d)(\d{1,2})\s+de\s+([A-Za-zçÇ]+)\s+de\s+(\d{4})/g;
    while ((m = A.exec(s))) { const d = +m[1], mo = +m[2], y = +m[3]; if (d >= 1 && d <= 31 && mo >= 1 && mo <= 12 && y >= 1900 && y <= 2100) out.push({ iso: y + '-' + p2(mo) + '-' + p2(d), i: m.index, hora: /^[\s,às\/|-]{0,6}\d{1,2}:\d{2}/i.test(s.slice(m.index + m[0].length, m.index + m[0].length + 12)) }); }
    while ((m = B.exec(s))) { const mo = MESES[m[2].toLowerCase()]; if (mo) out.push({ iso: m[3] + '-' + p2(mo) + '-' + p2(+m[1]), i: m.index, hora: /^[\s,às\/|-]{0,6}\d{1,2}:\d{2}/i.test(s.slice(m.index + m[0].length, m.index + m[0].length + 12)) }); }
    return out.sort((a, b) => a.i - b.i);
  }
  const num = s => Number(String(s).replace(/\./g, '').replace(',', '.'));
  const idade = (nasc, em) => { let a = +em.slice(0, 4) - +nasc.slice(0, 4); if (em.slice(5) < nasc.slice(5)) a--; return a; };
  const dBR = iso => iso ? iso.slice(8) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : '';

  // extra.fotos = quantas fotos (imagens grandes, tipo selfie ou documento) o PDF traz; quem conta é o robô (a tela não sabe)
  function analisar(texto, arquivo, extra) {
    const L = String(texto || '').split('\n'), T = L.join(' ').replace(/\s+/g, ' '), C = T.replace(/\s+/g, '');
    const R = { arquivo: arquivo || '', tipo: 'contrato', alertas: [] };
    const add = (cod, nivel, titulo, tese) => R.alertas.push({ cod, nivel, titulo, tese });
    if (T.replace(/\W/g, '').length < 300) { R.tipo = 'imagem'; return R; }
    const emprestimo = /c[ée]dula\s*de\s*cr[ée]dito|CCB\b|empr[ée]stimo|consigna/i.test(T) && /parcela/i.test(T) && /juros|CET\b/i.test(T);
    if (!emprestimo || (/outorgante|honor[áa]rios advocat[íi]cios|procura[çc][ãa]o ad judicia/i.test(T) && !/c[ée]dula\s*de\s*cr[ée]dito/i.test(T))) { R.tipo = 'outro'; return R; }
    const hoje = hojeISO();
    R.cartao = /cart[ãa]o\s+(?:de\s+cr[ée]dito\s+)?consignado|reserva de margem|\bRMC\b|\bRCC\b|cart[ãa]o\s+benef[íi]cio/i.test(T.slice(0, 2500));
    const bm = T.match(/(BANCO [A-ZÀ-Ú0-9 .&]{2,30}?(?:S\.?\/?A\.?|LTDA))|(FACTA|C6|AGIBANK|PAN\b|BMG|MERCANTIL|PARAN[ÁA] BANCO|QI SOCIEDADE|BANRISUL|DAYCOVAL|SAFRA|INBURSA|PICPAY|BRB|CREFISA|ITA[ÚU]|BRADESCO|SANTANDER|CAIXA|PINE|QUALI)/i);
    R.banco = bm ? (bm[1] || bm[2]).toUpperCase().replace(/\s+/g, ' ') : '';

    /* ---------- data do contrato ---------- */
    const todas = datas(T).filter(d => d.iso >= '2004-01-01' && d.iso <= hoje);
    let data = null, aprox = false;
    const rot = /(?:Local\s+e\s+)?Data\s+(?:e\s+hora\s+)?d[ae]\s+(?:Emiss[ãa]o|contrata[çc][ãa]o|opera[çc][ãa]o|solicita[çc][ãa]o|assinatura|proposta)/ig; let m;
    while (!data && (m = rot.exec(T))) { const d = datas(T.slice(m.index, m.index + 140)).filter(x => x.iso >= '2004-01-01' && x.iso <= hoje)[0]; if (d) data = d.iso; }
    if (!data) { const a = /assinad[oa]\s+(?:eletronicamente|digitalmente)[^.]{0,120}/ig; while (!data && (m = a.exec(T))) { const d = datas(m[0]).filter(x => x.iso >= '2004-01-01' && x.iso <= hoje)[0]; if (d) data = d.iso; } }
    if (!data) { const h = todas.filter(d => d.hora).map(d => d.iso).sort()[0]; if (h) data = h; }
    if (!data) { const pv = T.match(/(?:Primeiro\s+(?:desconto|vencimento)|Data\s+da\s+primeira\s+parcela|1[ºª°]\s+vencimento)[^\d]{0,60}(\d{2}\/\d{2}\/\d{4})/i); if (pv) { data = menosDias(datas(pv[1])[0].iso, 45); aprox = true; } }
    R.data = data; R.dataAprox = aprox;

    /* ---------- nascimento e idade ---------- */
    const nasc = [], fortes = [], emissoes = new Set();
    L.forEach(l => { const k = l.search(/(?:data\s+(?:de\s+)?)?(?:emiss[ãa]o|expedi[çc][ãa]o)\s*\.?:?/i); if (k >= 0 && !/nasc/i.test(l.slice(k))) datas(l.slice(k)).slice(0, 1).forEach(d => emissoes.add(d.iso)); });
    L.forEach((l, i) => {
      const k = l.search(/(?:D(?:ata|t)?\.?\s*(?:de\s+)?Nas[ci]{1,2}(?:i?mento|\.)?|Nascimento)\s*\.?:?/i); if (k < 0 || /pa[íi]s de resid[êe]ncia|local de nascimento|validada/i.test(l)) return;
      // só vale a data que vem logo depois do rótulo "nascimento"; o que vem depois de "emissão/expedição/validade" é data do documento
      const resto = l.slice(k), corte = resto.slice(10).search(/emiss[ãa]o|expedi[çc][ãa]o|validade|admiss[ãa]o|[óo]rg[ãa]o\s+(?:emissor|expedidor)/i);
      let ds = datas(corte >= 0 ? resto.slice(0, corte + 10) : resto), forte = ds.length > 0;
      if (!ds.length && !datas(resto).length && L[i + 1]) ds = datas(L[i + 1]);        // rótulo numa linha, valores na de baixo
      const v = ds.map(d => d.iso).filter(d => d >= '1900-01-01' && d < (data || hoje) && !emissoes.has(d)).sort()[0];   // a mais antiga (a outra costuma ser a emissão do RG)
      if (v) { nasc.push(v); if (forte) fortes.push(v); }
    });
    R.nasc = nasc.sort()[0] || null;
    const maisNovo = fortes.sort().slice(-1)[0] || null;      // "possível menor" só com data colada no rótulo de nascimento
    if (R.nasc && data) R.idade = idade(R.nasc, data);

    /* ---------- representante legal / procurador (campo preenchido, não a cláusula) ---------- */
    const VAZIO = /^(?:--+|—+|n[ãa]o(?:\s+se\s+aplica|\s+possui|\s+h[áa])?|n\/?a|nenhum|\*+|x{3,}|\.+|_+)?$/i, CPF = /\d{3}\.?\d{3}\.?\d{3}-?\d{2}/;
    let rep = false, repNao = false, campoRep = false;
    L.forEach((l, i) => {
      const k = l.search(/representante\s+legal(?:\s*\/\s*procurador)?[^:]{0,25}:|dados\s+do\s+representante|procurador\s*:/i); if (k < 0) return;
      if (/declar|poder[áa]|civilmente|por si ou|qualificad[oa] (?:no|nesta)|se obriga|autoriz|indicad[oa]/i.test(l) && !/:\s*$/.test(l.trim()) && !/^[^a-z]*(?:REPRESENTANTE|Representante Legal:)/.test(l.trim())) return;   // cláusula
      if (/(?:emitente|cliente|titular|benefici[áa]rio)\s*(?:\/|ou)\s*$/i.test(l.slice(0, k))) return;   // linha de assinatura "Emitente ou Representante Legal:"
      campoRep = true;
      const depois = l.slice(k).split(':').slice(1).join(':').replace(/CPF\s*:?/ig, ' ').replace(/\(quando aplic[áa]vel\)/i, '').trim();
      if (/^sim\b/i.test(depois)) { rep = true; return; }
      if (/^n[ãa]o\b/i.test(depois)) { repNao = true; return; }
      const bloco = [depois].concat(L.slice(i + 1, i + 4).filter((x, j, a) => !a.slice(0, j + 1).some(y => /^(?:QUADRO|ATEN[ÇC][ÃA]O|Dados|[IVX]+\s*[–-]|\d+\.\s+[A-Z]|\*)/i.test(y.trim()))));
      bloco.forEach((b, j) => {
        const v = j === 0 ? b : (/^(?:Nome|CPF)/i.test(b.trim()) ? b.replace(/Nome(?:\s+do\s+representante(?:\s+legal)?)?\s*:?/ig, ' ').replace(/CPF(?:\s+do\s+representante(?:\s+legal)?)?\s*:?/ig, ' ').trim() : '');
        if (!v || VAZIO.test(v)) return;
        if (CPF.test(v) || /^[A-Za-zÀ-ú]{2,}(?:\s+[A-Za-zÀ-ú]{2,}){1,7}$/.test(v)) rep = true;
      });
    });
    if (repNao && !rep) R.representante = false; else if (rep) R.representante = true; else R.representante = campoRep ? false : null;

    /* ---------- assinatura ---------- */
    const icp = /ICP-?Brasil/i.test(T), bio = /biometria|selfie|reconhecimento facial|liveness|prova de vida/i.test(T),
      geo = /geolocaliza[çc][ãa]o\s*:?\s*-?\d|latitude\s*(?:e\s*longitude)?\s*:?\s*-?\d|-?\d{1,2}\.\d{4,},\s*-?\d{1,3}\.\d{4,}/i.test(T),
      ip = /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b|\b[0-9a-f]{1,4}:[0-9a-f]{1,4}:[0-9a-f:]{6,}/i.test(T),
      eletr = /assinatura eletr[ôo]nica|assinad[oa] eletronicamente|assinad[oa] digitalmente|clicksign|docusign|bemsign|unico\b|certisign/i.test(T);
    R.assinatura = eletr || bio ? 'digital' : icp ? 'ICP' : 'física ou não identificada';
    R.biometria = bio; R.geo = geo; R.ip = ip;
    const fotos = extra && typeof extra.fotos === 'number' ? extra.fotos : null; R.fotos = fotos;

    /* ---------- analfabeto / a rogo ---------- */
    const rogo = /assina\s+o\s+rogado\s*:\s*(?!POLEGAR)[A-ZÀ-Ú]{3,}\s+[A-ZÀ-Ú]{2,}\s+[A-ZÀ-Ú]{2,}/.test(T) || /n[ãa]o[\s-]alfabetizad[oa]\s*:?\s*\(?\s*(?:sim|x)\s*\)?|analfabet[oa]\s*:\s*\(?\s*(?:sim|x)\b|\(\s*x\s*\)\s*(?:analfabet|n[ãa]o[\s-]alfabetizad)|impress[ãa]o\s+digital\s+do\s+(?:emitente|cliente)\s*:\s*\S/i.test(T);
    R.analfabeto = rogo;

    /* ---------- números ---------- */
    const taxas = []; let t;
    const RX = [/Taxa\s+de\s+Juros[^:]{0,70}\(%\s*a\.?\s?m[^)]*\)\s*:\s*(\d{1,2},\d{2,8})\s*%/ig,
      /(?:Taxa\s+de\s+juros\s+mensal|Juros?\s+mensal(?:\s+da\s+opera[çc][ãa]o)?|Juros\s+Remunerat[óo]rios)\s*:?\s*(?:de\s+)?(\d{1,2},\d{2,8})\s*%/ig,
      /(?:taxa\s+(?:m[áa]xima\s+)?de\s+juros|juros\s+pr[ée]-?fixados)[^%]{0,90}?(\d{1,2},\d{2,8})\s*%\s*%?\s*(?:\([^)]{0,120}\)\s*)?(?:a\.?\s?m\b|ao\s+m[êe]s)/ig,
      /a\.m\.\s*:\s*(\d{1,2},\d{2,8})\s*%\s*Taxa\s+de\s+juros/ig,
      /Taxa\s+de\s+Juros\s+Mensal[^%]{0,160}?(\d{1,2},\d{2,8})\s*%/ig];
    RX.forEach(rx => { while ((t = rx.exec(T))) { const antes = T.slice(Math.max(0, t.index - 30), t.index); if (/mora|multa|CET|custo efetivo/i.test(antes) || /mora|multa|atraso/i.test(t[0])) continue; const v = num(t[1]); if (v > 0.3 && v < 6) taxas.push(v); } });
    if (taxas.length) R.taxa = Math.min.apply(null, taxas);
    const pc = T.match(/N[ºo°] de Parcelas 10\. Primeiro Vencimento(?: 11\.)?[^\d]{0,30}(\d{2,3})\s+\d{2}\/\d{2}\/\d{4}/i) || T.match(/(?:Quantidade|Qtde|N[ºo°.]*|N[úu]mero)\s*(?:m[áa]x\.?\s*)?de\s+Parcelas[^\d]{0,40}(\d{2,3})(?!\d|[.,\/]\d|\s*\.\s*[A-Za-z])/i); if (pc) R.parcelas = +pc[1];
    const vl = T.match(/Valor\s+(?:l[íi]quido|liberado)(?:\s+(?:ao|do)\s+(?:cliente|cr[ée]dito|emitente))?[^R\d]{0,40}R\$\s*([\d.]+,\d{2})/i); if (vl) R.liberado = num(vl[1]);
    const vf = T.match(/(?:Valor\s+)?Total\s+(?:financiado|de\s+cr[ée]dito|do\s+empr[ée]stimo)[^R\d]{0,30}R\$\s*([\d.]+,\d{2})/i); if (vf) R.financiado = num(vf[1]);
    const tc = T.match(/Tarifa\s+de\s+(?:cadastro|abertura)[^R\d%]{0,30}(?:\(\d,\d{2}%\)\s*)?R\$\s*([\d.]+,\d{2})/i); if (tc) R.tac = num(tc[1]);
    const S = root.detectarSeguro ? root.detectarSeguro(texto, arquivo) : null;
    if (S) { R.seguro = S.totalSeguro || 0; R.pacote = S.totalPacote || 0; }

    R.loas = /esp[ée]cie(?:\s+do\s+benef[íi]cio)?\s*:?\s*8[78]\b|\b8[78]\s*[-–]\s*(?:amparo|benef)/i.test(T);   // BPC/LOAS (espécies 87 e 88)
    /* ---------- apontamentos ---------- */
    const quando = data ? (aprox ? 'por volta de ' : 'em ') + dBR(data) : 'em data não identificada';
    const regraRep = !data ? 'Confira a data do contrato: fora do período de ago/2022 a jun/2025 a contratação por representante exigia autorização judicial.'
      : data < '2018-12-31' ? 'Na época (IN INSS 28/2008, antes da IN 100/2018) o consignado não podia ser contratado por representante legal — o desconto só valia com autorização do próprio titular.'
        : data < '2022-08-12' ? 'Na época (IN INSS 100/2018) o tutor ou curador só podia contratar com AUTORIZAÇÃO JUDICIAL. Sem alvará no processo do banco: nulidade e devolução.'
          : data < '2025-07-16' ? 'Na época a IN INSS 136/2022 dispensava a autorização judicial, mas o TRF3 (jun/2025) considerou essa dispensa ilegal e o Código Civil (arts. 1.691, 1.748 e 1.781) exige autorização do juiz para o representante contrair dívida em nome do incapaz. Tese de nulidade discutível — vale analisar.'
            : 'Desde a IN INSS 190/2025 (DOU de 16/07/2025, em cumprimento à decisão do TRF3), o banco não pode aceitar contrato só com a assinatura do representante: exige AUTORIZAÇÃO JUDICIAL. Sem alvará: nulidade.';
    const menor = R.idade != null && R.idade < 18, menorDuv = !menor && maisNovo && data && idade(maisNovo, data) < 18 && idade(maisNovo, data) >= 0;
    if (menor) add('menor', 'alto', 'Titular menor de idade na data do contrato (' + R.idade + ' anos)', 'Contrato feito ' + quando + ' com titular nascido em ' + dBR(R.nasc) + '. Quem assinou foi um representante. ' + regraRep);
    else if (menorDuv) add('menor', 'medio', 'Possível menor de idade no contrato — conferir', 'O contrato traz mais de uma data de nascimento e uma delas (' + dBR(maisNovo) + ') indica menor de 18 anos ' + quando + '. Abra o PDF e veja quem é o titular e quem assinou. ' + regraRep);
    if (R.representante === true && !menor) add('representante', data && data >= '2022-08-12' && data < '2025-07-16' ? 'medio' : 'alto', 'Contrato assinado por representante legal ou procurador', 'O campo de representante legal/procurador está preenchido (contrato ' + quando + '). ' + regraRep + (data && data >= '2026-05-19' ? ' Desde 19/05/2026 também é vedada a contratação por procuração de terceiros.' : ''));
    if (rogo) add('analfabeto', eletr || bio ? 'alto' : 'medio', 'Cliente analfabeto ou impedido de assinar', (eletr || bio ? 'Contrato DIGITAL com cliente marcado como analfabeto/assinatura a rogo: o STJ (3ª Turma, 2026) anulou empréstimo assim, porque faltam a assinatura a rogo e as duas testemunhas do art. 595 do Código Civil. ' : '') + 'Conferir no PDF se há assinatura a rogo E duas testemunhas identificadas (CC art. 595). Sem isso, o contrato é nulo.');
    if (R.tac > 0) add('tac', 'alto', 'Tarifa de cadastro cobrada: R$ ' + R.tac.toFixed(2).replace('.', ','), 'No consignado do INSS é vedada a cobrança de tarifa de cadastro/TAC e de qualquer taxa administrativa (IN INSS 28/2008, art. 13, II; IN 138/2022, art. 12). Pedir devolução em dobro.');
    if (R.taxa && data && !R.cartao) { const teto = tetoEm(data); R.teto = teto; if (R.taxa > teto + 0.005) add('juros', 'medio', 'Juros acima do teto do INSS: ' + String(R.taxa).replace('.', ',') + '% a.m. (teto ' + String(teto).replace('.', ',') + '%)', 'Contrato ' + quando + ' com taxa acima do teto fixado pelo CNPS para a época. Conferir a data exata no PDF (o teto mudou várias vezes) e, confirmando, pedir a readequação da taxa e a devolução da diferença.'); }
    if (R.parcelas > 108) add('prazo', 'alto', 'Prazo acima do permitido: ' + R.parcelas + ' parcelas', 'O prazo máximo do consignado do INSS é de 108 parcelas (IN INSS 204/2026; antes eram 96).');
    else if (R.parcelas > 96 && data && data < '2026-05-19') add('prazo', 'medio', 'Prazo acima do permitido na época: ' + R.parcelas + ' parcelas', 'Até 18/05/2026 o prazo máximo era de 96 parcelas (108 só a partir de 19/05/2026). Conferir a data do contrato.');
    // selfie/biometria: a anuência por biometria é feita no Meu INSS, e o contrato digital também tem de trazer a selfie do cliente
    if (eletr || bio) {
      // A biometria NO CONTRATO é obrigatória desde a IN INSS 138/2022 (art. 5º, III; implantação 60 dias após a vigência, ajustada pela IN 143, de fev/2023).
      // 19/05/2026 (Lei 15.327/2026) é outra coisa: a anuência biométrica no Meu INSS. Uma não substitui a outra.
      const novo = data && data >= '2023-04-01', regra = (novo ? ' Desde 2023 a autorização do consignado tem de ser assinada com reconhecimento biométrico (IN INSS 138/2022, art. 5º, III, com a IN 143/2023): a selfie precisa estar no contrato.' : ' O contrato é anterior à obrigatoriedade da biometria (IN INSS 138/2022, implantada em 2023); vale como indício, não como exigência da época.')
        + (data && data >= '2026-05-19' ? ' Além disso, desde 19/05/2026 (Lei 15.327/2026) o titular confirma a operação por biometria no Meu INSS — é outra etapa, que não dispensa a selfie no contrato.' : '');
      if (fotos === 0 && !bio) add('sem-selfie', 'medio' /* fica em ATENÇÃO: com a regra de 2023 quase todo contrato sem foto viraria forte (306 de 356 em 20/11/2026) — decisão do Lucas */, 'Contrato digital sem selfie e sem registro de biometria', 'O PDF não traz foto do cliente nem menciona biometria ou prova de vida. Sem a selfie no contrato o banco não prova que foi o próprio cliente quem contratou — tese de inexistência da contratação/fraude, com inversão do ônus da prova (CDC art. 6º, VIII).' + regra);
      else if (fotos === 0) add('sem-selfie', 'medio', 'Contrato cita biometria, mas a selfie não está no PDF', 'O texto fala em biometria facial, porém o arquivo não traz a foto do cliente. Pedir ao banco o dossiê completo da contratação (selfie, prova de vida, IP e geolocalização); se não apresentar, reforça a tese de que o cliente não contratou.' + regra);
      else if (fotos == null && !bio) add('sem-selfie', 'medio', 'Contrato digital sem registro de biometria no texto', 'O texto não menciona biometria nem prova de vida. Abrir o PDF e conferir se há a selfie do cliente.' + regra);
      else if (fotos > 0 && !bio) add('foto', 'info', 'Tem foto no PDF, sem menção a biometria no texto', 'O arquivo traz ' + fotos + ' foto(s). Conferir se uma delas é a selfie do próprio cliente (e não só a foto do documento).');
    }
    // requisitos técnicos e de segurança do contrato digital (IN INSS 138/2022, art. 5º, e nota técnica Dataprev NT/DRN/001/2022):
    // o robô só consegue ver se o PDF TRAZ cada registro; não tem como validar se o hash confere ou se a prova de vida é certificada
    if (eletr || bio) {
      const REQ = [
        ['Selfie / biometria facial', bio || fotos > 0],
        ['Prova de vida (liveness)', /liveness|prova de vida|vivacidade/i.test(T)],
        ['Documento de identificação do cliente', fotos >= 2 || /documento de identifica[çc][ãa]o|foto do documento|\b(?:RG|CNH)\b[^.]{0,40}(?:capturad|anexad|apresentad|frente|verso)/i.test(T)],
        ['Geolocalização', geo],
        ['Endereço IP', ip],
        ['Data e hora da assinatura', todas.some(d => d.hora)],
        ['Hash / código de integridade do documento', /\bhash\b|SHA-?(?:1|256|512)|c[óo]digo de (?:verifica|autentica|integridade|valida)|\b[0-9a-f]{40,}\b/i.test(T)],
        ['Identificação do aparelho ou navegador', /user-?agent|Mozilla\/|navegador|identificador do aparelho|dispositivo utilizado|modelo do (?:celular|aparelho)|IMEI/i.test(T)],
        ['Plataforma ou certificado de assinatura', icp || /clicksign|docusign|bemsign|certisign|unico\b|serasa|plataforma de assinatura|certificado digital|MP n?[ºo°]? ?2\.200/i.test(T)]];
      const falta = REQ.filter(r => !r[1]).map(r => r[0]);
      R.requisitos = { total: REQ.length, ok: REQ.length - falta.length, falta };
      const trilha = falta.filter(f => !/Selfie/.test(f));     // a selfie tem apontamento próprio
      // faltou qualquer um dos registros principais (prova de vida, geolocalização, IP, data e hora, hash): aponta. Os demais são só informativos.
      // só vira apontamento quando faltam pelo menos 3 dos 4 registros de rastreio; 'prova de vida' quase nunca vem escrita no PDF e sozinha não conta
      const principal = trilha.filter(f => /Geolocaliza|Endere[çc]o IP|Data e hora|Hash/.test(f));
      if (trilha.length) add('requisitos', principal.length >= 3 ? 'medio' : 'info', 'Contrato digital sem ' + trilha.length + ' de ' + REQ.length + ' registros de segurança', 'Não aparecem no PDF: ' + trilha.join('; ') + '. A IN INSS 138/2022 (art. 5º) e a nota técnica da Dataprev (NT/DRN/001/2022) exigem biometria com prova de vida, registro de data e hora e mecanismo que mostre que o documento não foi alterado; a jurisprudência cobra ainda IP, geolocalização e hash. Faltando esses registros, cabe pedir o dossiê completo ao banco e a inversão do ônus da prova (CDC art. 6º, VIII).');
    }
    if (R.assinatura === 'física ou não identificada') add('sem-assinatura', 'info', 'Assinatura não identificada no PDF', 'O texto não mostra assinatura eletrônica. Pode ser contrato físico (assinatura em imagem) ou via sem assinatura: abrir e conferir.');
    if (R.liberado != null && R.financiado > 0 && R.liberado / R.financiado < 0.1 && /refinanc|quita[çc][ãa]o\s+d[ae]\s+d[íi]vida/i.test(T)) add('troco', 'info', 'Refinanciamento com troco baixo: R$ ' + R.liberado.toFixed(2).replace('.', ','), 'O cliente recebeu menos de 10% do valor financiado (R$ ' + R.financiado.toFixed(2).replace('.', ',') + '); o resto quitou dívida anterior. Perguntar se ele pediu o refinanciamento — é padrão comum em contratação não solicitada.');
    if (R.cartao) add('cartao', 'info', 'Contrato de cartão consignado (RMC/RCC)', 'Verificar se o cliente sabia que contratava CARTÃO e não empréstimo (CDC arts. 6º, III, e 52). Tese de conversão em empréstimo consignado e devolução em dobro.');
    if (R.loas) R.alertas.forEach(x => { if (x.cod === 'menor' || x.cod === 'representante') { x.nivel = 'alto'; x.titulo = 'BPC/LOAS · ' + x.titulo; x.tese += ' O benefício é BPC/LOAS (assistencial, de subsistência): empréstimo feito pelo representante em nome do menor ou incapaz compromete o mínimo existencial e reforça a tese de nulidade.'; } });
    const peso = { alto: 0, medio: 1, info: 2 }; R.alertas.sort((a, b) => peso[a.nivel] - peso[b.nivel]);
    R.nivel = (R.alertas[0] || {}).nivel || 'ok';
    return R;
  }
  root.XYZContrato = { analisar, tetoEm, TETO_EMP };
  if (typeof module !== 'undefined') module.exports = root.XYZContrato;
})(typeof window !== 'undefined' ? window : globalThis);
