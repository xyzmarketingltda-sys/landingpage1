/* Modelos de peças da XYZ — texto próprio, escrito a partir das teses do revisor e das decisões favoráveis publicadas.
   SÃO MODELOS: o advogado que assina confere fatos, valores, competência e jurisprudência local antes de protocolar.
   Campos entre {{ }} são preenchidos pela tela; o que ficar sem preencher aparece como [PREENCHER: campo]. */
(function (root) {
  const brl = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const num = s => { const v = Number(String(s || '').replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3})/g, '').replace(',', '.')); return isNaN(v) ? 0 : v; };

  const CAMPOS = [
    ['nome', 'Nome do cliente'], ['qualificacao', 'Nacionalidade, estado civil, profissão', 'brasileiro(a), aposentado(a)'], ['cpf', 'CPF'], ['rg', 'RG'],
    ['endereco', 'Endereço completo com CEP'], ['nb', 'Número do benefício (NB)'], ['banco', 'Banco réu (razão social)'], ['cnpj', 'CNPJ do banco'], ['endBanco', 'Endereço do banco'],
    ['contrato', 'Número do contrato'], ['dataContrato', 'Data do contrato'], ['valorContrato', 'Valor do empréstimo (R$)'], ['parcela', 'Valor da parcela (R$)'], ['descontadas', 'Parcelas já descontadas'],
    ['seguro', 'Valor do seguro / pacote cobrado (R$)'], ['danoMoral', 'Dano moral pedido (R$)', '10.000,00'], ['comarca', 'Comarca e UF'], ['advogado', 'Advogado(a) e OAB']];

  const cabecalho = (d, rito) => (rito === 'jec'
    ? `AO JUÍZO DO JUIZADO ESPECIAL CÍVEL DA COMARCA DE {{comarca}}`
    : `AO JUÍZO DE DIREITO DE UMA DAS VARAS CÍVEIS DA COMARCA DE {{comarca}}`)
    + `\n\n\n{{nome}}, {{qualificacao}}, portador(a) do RG nº {{rg}}, inscrito(a) no CPF sob o nº {{cpf}}, titular do benefício previdenciário nº {{nb}}, residente e domiciliado(a) em {{endereco}}, por seu(sua) advogado(a) que esta subscreve (procuração anexa), vem, respeitosamente, propor a presente\n\n`;
  const reu = `em face de {{banco}}, pessoa jurídica de direito privado, inscrita no CNPJ sob o nº {{cnpj}}, com sede em {{endBanco}}, pelos fatos e fundamentos a seguir.\n\n`;
  const preliminares = rito => `I – PRELIMINARMENTE\n\n1. Gratuidade da justiça. A parte autora vive de benefício previdenciário e não tem como arcar com custas e honorários sem prejuízo do próprio sustento, razão pela qual requer a gratuidade (CPC, arts. 98 e 99, § 3º; declaração anexa).\n\n2. Prioridade de tramitação. Sendo pessoa idosa, requer a prioridade prevista no art. 1.048, I, do CPC e no art. 71 da Lei 10.741/2003. [Retirar se o cliente tiver menos de 60 anos.]\n\n`
    + (rito === 'jec' ? `3. Competência do Juizado. A causa é de menor complexidade e seu valor não ultrapassa quarenta salários mínimos (Lei 9.099/1995, art. 3º, I). A prova é documental e está em poder do réu.\n\n` : `3. Audiência de conciliação. A parte autora [tem / não tem] interesse na audiência do art. 334 do CPC.\n\n`);
  const cdc = n => `${n}. Relação de consumo e inversão do ônus da prova. O Código de Defesa do Consumidor se aplica às instituições financeiras (Súmula 297 do STJ), que respondem de forma objetiva pelos danos causados por falha do serviço, inclusive por fraudes praticadas por terceiros no âmbito de operações bancárias (CDC, art. 14; Súmula 479 do STJ). A parte autora é idosa e hipossuficiente, e todos os registros da contratação estão com o réu: impõe-se a inversão do ônus da prova (CDC, art. 6º, VIII).\n\n`;
  const dobro = n => `${n}. Devolução em dobro. O que foi cobrado sem causa deve ser restituído em dobro (CDC, art. 42, parágrafo único). A Corte Especial do STJ fixou que a devolução em dobro independe de prova de má-fé, bastando a conduta contrária à boa-fé objetiva, para as cobranças posteriores a 30/03/2021 (EAREsp 676.608/RS; Tema 929). [Conferir a data de cada desconto: antes de 30/03/2021, parte dos tribunais devolve de forma simples.]\n\n`;
  const moral = n => `${n}. Dano moral. O benefício previdenciário tem natureza alimentar. Descontos indevidos sobre ele reduzem a renda de subsistência de pessoa idosa, obrigam-na a buscar o banco e o Judiciário para reaver o que é seu e ultrapassam o mero aborrecimento. Requer-se indenização de {{danoMoral}}, valor compatível com a extensão do dano e com o caráter pedagógico da condenação. [Em comarcas que exigem prova do abalo, descrever aqui o impacto concreto: percentual da renda comprometido, contas em atraso, tentativas de solução.]\n\n`;
  const fecho = `Dá-se à causa o valor de {{valorCausa}}.\n\nNestes termos, pede deferimento.\n\n{{comarca}}, {{hoje}}.\n\n\n{{advogado}}`;

  const PECAS = {
    'nao-contratado': {
      titulo: 'Empréstimo consignado não reconhecido (inexistência / nulidade)',
      quando: 'Cliente não reconhece o contrato, ou o contrato veio sem selfie e sem registros de segurança.',
      valorCausa: d => 2 * num(d.parcela) * num(d.descontadas) + num(d.danoMoral),
      texto: (d, rito) => cabecalho(d, rito)
        + `AÇÃO DECLARATÓRIA DE INEXISTÊNCIA DE RELAÇÃO JURÍDICA C/C REPETIÇÃO DO INDÉBITO E INDENIZAÇÃO POR DANOS MORAIS, COM PEDIDO DE TUTELA DE URGÊNCIA\n\n` + reu
        + preliminares(rito)
        + `II – DOS FATOS\n\n4. A parte autora recebe o benefício previdenciário nº {{nb}}. Ao conferir o extrato de empréstimos consignados do INSS, constatou a averbação do contrato nº {{contrato}}, atribuído ao réu, com data de {{dataContrato}}, no valor de {{valorContrato}}, em parcelas mensais de {{parcela}}.\n\n5. A parte autora não contratou esse empréstimo. Não assinou contrato, não forneceu biometria nem documentos para essa operação e não autorizou ninguém a fazê-lo em seu nome. [Se o valor foi creditado em conta: informar aqui e oferecer a devolução ou a compensação. Se não foi creditado: afirmar que nada recebeu.]\n\n6. Até a presente data foram descontadas {{descontadas}} parcelas, que somam {{totalDescontado}}, diretamente do benefício.\n\n7. [Descrever a tentativa de solução: reclamação ao banco em __/__/____, protocolo nº ____, sem resposta ou com resposta negativa.]\n\n`
        + `III – DO DIREITO\n\n` + cdc(8)
        + `9. Ônus de provar a contratação. Negada a contratação, não se pode exigir do consumidor a prova de fato negativo. Cabe ao banco exibir o contrato e demonstrar que ele foi firmado pela parte autora. E, impugnada a autenticidade da assinatura, é da instituição financeira o ônus de prová-la (STJ, Tema 1.061; CPC, arts. 6º, 369 e 429, II). Telas de sistema produzidas unilateralmente não bastam.\n\n10. Requisitos da contratação de consignado no INSS. A autorização do desconto deve ser expressa e assinada com reconhecimento biométrico, não se admitindo autorização por telefone (IN PRES/INSS 138/2022, art. 5º, III). Em contrato eletrônico, o banco deve apresentar o arquivo com os elementos que garantam integridade e autoria: biometria facial com prova de vida, data e hora, IP, geolocalização e código de integridade. [Se o contrato já foi obtido: apontar o que falta nele — por exemplo, ausência de selfie, de geolocalização ou de IP.] Sem esses elementos, não há prova de que a parte autora manifestou vontade.\n\n11. Inexistência do negócio e retorno ao estado anterior. Sem manifestação de vontade não há contrato (CC, art. 104). Os descontos devem cessar e o que foi descontado deve ser restituído.\n\n`
        + dobro(12) + moral(13)
        + `IV – DA TUTELA DE URGÊNCIA\n\n14. A probabilidade do direito decorre da negativa de contratação somada à ausência de prova da manifestação de vontade; o perigo de dano, do desconto mensal sobre verba alimentar (CPC, art. 300). Requer-se a suspensão imediata dos descontos do contrato nº {{contrato}} e a abstenção de inscrição do nome da parte autora em cadastros de inadimplentes, sob pena de multa diária. A medida é reversível.\n\n`
        + `V – DOS PEDIDOS\n\nDiante do exposto, requer:\n\na) a gratuidade da justiça e a prioridade de tramitação;\nb) a tutela de urgência para suspender os descontos do contrato nº {{contrato}}, com ofício ao INSS, sob pena de multa diária;\nc) a citação do réu para responder, sob pena de revelia;\nd) a inversão do ônus da prova, com a determinação de que o réu exiba o contrato, o dossiê completo da contratação (selfie, prova de vida, IP, geolocalização, data e hora, trilha de auditoria) e o comprovante de crédito do valor;\ne) a declaração de inexistência da relação jurídica referente ao contrato nº {{contrato}} e a exclusão definitiva da averbação;\nf) a condenação do réu a restituir em dobro os valores descontados, hoje {{totalDescontado}} (em dobro, {{dobroDescontado}}), além dos que vencerem no curso do processo, com correção monetária e juros;\ng) a condenação do réu ao pagamento de indenização por danos morais de {{danoMoral}};\nh) ${rito === 'jec' ? 'a produção de todas as provas admitidas, em especial a documental' : 'a condenação do réu em custas e honorários advocatícios, e a produção de todas as provas admitidas, inclusive perícia grafotécnica ou de biometria, a cargo do réu'}.\n\n`
        + fecho
    },
    'seguro': {
      titulo: 'Seguro prestamista / pacote embutido no consignado (venda casada)',
      quando: 'Contrato com seguro prestamista ou pacote de benefícios cobrado junto com o empréstimo.',
      valorCausa: d => 2 * num(d.seguro) + num(d.danoMoral),
      texto: (d, rito) => cabecalho(d, rito)
        + `AÇÃO DECLARATÓRIA DE NULIDADE DE CLÁUSULA C/C REPETIÇÃO DO INDÉBITO E INDENIZAÇÃO POR DANOS MORAIS\n\n` + reu
        + preliminares(rito)
        + `II – DOS FATOS\n\n4. Em {{dataContrato}}, a parte autora contratou com o réu o empréstimo consignado nº {{contrato}}, no valor de {{valorContrato}}, com desconto em seu benefício previdenciário nº {{nb}}.\n\n5. Ao obter cópia do contrato, verificou que, junto com o empréstimo, foi incluído seguro prestamista [e/ou pacote de benefícios] no valor de {{seguro}}, financiado dentro da própria operação e, portanto, pago com juros durante todo o prazo.\n\n6. A parte autora não pediu esse seguro. Não lhe foi oferecida a opção de contratar o empréstimo sem ele, nem de escolher outra seguradora; não recebeu apólice nem certificado; e a proposta veio com o campo do seguro já preenchido. [Ajustar ao contrato: indicar a página e a cláusula em que o seguro aparece.]\n\n`
        + `III – DO DIREITO\n\n` + cdc(7)
        + `8. Venda casada. É prática abusiva condicionar o fornecimento de um produto à aquisição de outro (CDC, art. 39, I). Em recurso repetitivo, o STJ fixou que, nos contratos bancários em geral, o consumidor não pode ser compelido a contratar seguro com a instituição financeira ou com seguradora por ela indicada (Tema 972). O ônus de demonstrar que houve escolha livre e informada é do banco.\n\n9. Dever de informação. O consumidor tem direito à informação clara sobre o que está contratando e quanto custa (CDC, arts. 6º, III, 46 e 52). Seguro inserido em formulário padronizado, sem destaque, sem proposta de adesão própria e sem entrega da apólice não vincula o consumidor.\n\n10. Regras do consignado do INSS. A norma do INSS veda a vinculação do empréstimo consignado a seguro ou a qualquer outro produto ou serviço (IN PRES/INSS 138/2022). [Conferir o dispositivo e a redação vigentes na data do contrato.] A cobrança, além de abusiva, eleva o custo efetivo da operação acima do informado.\n\n11. Nulidade da cláusula. São nulas as cláusulas que estabeleçam obrigações abusivas ou coloquem o consumidor em desvantagem exagerada (CDC, art. 51, IV). Declarada a nulidade, o valor do seguro e os juros que incidiram sobre ele devem ser restituídos.\n\n`
        + dobro(12) + moral(13)
        + `IV – DOS PEDIDOS\n\nDiante do exposto, requer:\n\na) a gratuidade da justiça e a prioridade de tramitação;\nb) a citação do réu para responder, sob pena de revelia;\nc) a inversão do ônus da prova, com a determinação de que o réu exiba o contrato completo, a proposta de adesão ao seguro assinada em separado, a apólice ou o certificado individual e o comprovante de repasse do prêmio à seguradora;\nd) a declaração de nulidade da contratação do seguro prestamista [e/ou do pacote] vinculado ao contrato nº {{contrato}};\ne) a condenação do réu a restituir em dobro o valor cobrado, de {{seguro}} (em dobro, {{dobroSeguro}}), acrescido dos juros contratuais que incidiram sobre ele, com correção monetária e juros de mora, e a recalcular as parcelas vincendas sem o seguro;\nf) a condenação do réu ao pagamento de indenização por danos morais de {{danoMoral}};\ng) ${rito === 'jec' ? 'a produção de todas as provas admitidas, em especial a documental' : 'a condenação do réu em custas e honorários advocatícios, e a produção de todas as provas admitidas'}.\n\n`
        + fecho
    }
  };

  function gerar(id, dados, rito) {
    const P = PECAS[id]; if (!P) return '';
    const d = Object.assign({}, dados), hoje = new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
    const tot = num(d.parcela) * num(d.descontadas);
    const calc = { hoje, totalDescontado: tot ? brl(tot) : '', dobroDescontado: tot ? brl(2 * tot) : '', dobroSeguro: num(d.seguro) ? brl(2 * num(d.seguro)) : '', valorCausa: P.valorCausa(d) ? brl(P.valorCausa(d)) : '' };
    ['valorContrato', 'parcela', 'seguro', 'danoMoral'].forEach(k => { if (num(d[k])) d[k] = brl(num(d[k])); });
    const rot = Object.fromEntries(CAMPOS.map(c => [c[0], c[1]]));
    return P.texto(d, rito).replace(/\{\{(\w+)\}\}/g, (m, k) => (d[k] && String(d[k]).trim()) || calc[k] || '[PREENCHER: ' + (rot[k] || k) + ']');
  }
  root.XYZPecas = { PECAS, CAMPOS, gerar };
  if (typeof module !== 'undefined') module.exports = root.XYZPecas;
})(typeof window !== 'undefined' ? window : globalThis);
