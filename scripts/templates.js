// Templates de ameaça (Chefe Final, Enxame e Bando). Sem dependência do Foundry.
//
// O módulo guarda no ator um marcador com o estado ORIGINAL (PM, RD, texto de resistências; para o Enxame
// também as armas inteiras, a linha de ataque e o ic.custom; para o Bando o tamanho e as rolagens) e marca
// com uma flag os itens que cria. Assim o ajuste é repetível: antes de aplicar de novo, tudo volta ao estado base, e
// desmarcar um template devolve a ficha como estava.
import { valorND } from './tabelas.js';
import { patamarDoND } from './patamares.js';
import { mediaFormula } from './dano.js';

export const FLAG = 'tormenta20-ajuste-nd';

const RD_CHEFE_FINAL = { Veterano: 5, 'Campeão': 10, Lenda: 20 };
const TEXTO_RD = /(redu[cç][aã]o de dano|\bRD)(\s*)(\d+)/i;

const DESCRICAO_MAIOR_QUE_A_MORTE = 'Enquanto tiver pelo menos metade de seus PV, a criatura é imune a habilidades de "morte instantânea". '
  + 'Isso inclui efeitos que reduzem seus PV a 0 ou menos instantaneamente (como Assassino Fantasmagórico), '
  + 'que aprisionam ou destroem sua alma ou corpo e similares. A criatura ainda pode ser reduzida a 0 PV por dano normal.';

const DESCRICAO_ENXAME = 'No final de seu turno, o enxame causa dano automaticamente a qualquer criatura que ocupe o mesmo espaço que ele.';
const PODERES_ENXAME = [
  ['Movimentação Tática', 'O enxame pode passar pelo espaço de outras criaturas e pode terminar seu movimento no mesmo espaço que elas.'],
  ['Resistência a Armas', 'O enxame sofre apenas metade do dano de ataques tradicionais feitos com armas (corte, impacto e perfuração).'],
  ['Vulnerabilidade a Área', 'O enxame sofre +50% de dano de qualquer efeito de área (magias, explosivos alquímicos, habilidades em cone/linha/esfera).'],
  ['Interações Mágicas', 'Enxames são imunes a magias e efeitos que afetam apenas um único alvo.'],
];
const IMUNIDADES_ENXAME = [
  'imunidade a acertos críticos',
  'imunidade a dano de precisão (como Ataque Furtivo)',
  'imunidade a flanqueamento',
  'imunidade a manobras de combate (Agarrar, Derrubar, Desarmar, Quebrar, Empurrar)',
];
// Nenhuma dessas imunidades é uma condição fixa do sistema (tracos.ic.value); vão no texto livre ic.custom.
const ROTULOS_IC_ENXAME = ['Acertos críticos', 'Dano de precisão', 'Flanqueamento', 'Manobras de combate'];

const PODERES_BANDO = [
  ['Dano Esmagador', 'Se um ataque do bando exceder a Defesa do inimigo por 10 ou mais, ele causa o dobro do dano.'],
  ['Dano Inescapável', 'Se um ataque do bando errar, ele ainda assim causa metade do dano.'],
  ['Ataques Adicionais contra o Bando', 'Um personagem com o poder Trespassar que acerte a criatura pode usá-lo para fazer um ataque adicional contra ela. Contudo, isso é limitado a apenas uma vez por turno.'],
];
const TERMOS_BANDO = [
  'imunidade a manobras de combate',
  'imunidade a efeitos que afetam apenas uma criatura e não causam dano',
  'vulnerabilidade a dano de área',
];
const ROTULOS_IC_BANDO = ['Manobras de combate', 'Efeitos de alvo único sem dano'];

const ORDEM_ND = ['1/4', '1/2', ...Array.from({ length: 20 }, (_, i) => String(i + 1)), 'S', 'S+'];
const ORDEM_PATAMARES = ['Iniciante', 'Veterano', 'Campeão', 'Lenda'];
const ORDEM_TAMANHOS = ['min', 'peq', 'med', 'gra', 'eno', 'col'];
const NOMES_TAMANHO = { min: 'Minúsculo', peq: 'Pequeno', med: 'Médio', gra: 'Grande', eno: 'Enorme', col: 'Colossal' };
// Escala do bando (indivíduos): quanto o ND e o tamanho sobem. O ND pode ser editado pelo mestre.
const ESCALAS_BANDO = {
  '10-20': { aumento: 2, tamanho: 1 },
  '20-40': { aumento: 2, tamanho: 2 },
  '50-70': { aumento: 4, tamanho: 3 },
  '80-100': { aumento: 6, tamanho: 4 },
};
const MULTIPLICADOR_POR_PATAMAR = { 1: 2, 2: 4, 3: 6 };

export const aumentoPadrao = (escala) => ESCALAS_BANDO[escala]?.aumento ?? 2;

// O bando é tratado como uma criatura de ND maior: o ND efetivo sobe `aumentoND`, o tamanho sobe pela escala
// (até Colossal) e o dano dos golpes é multiplicado conforme os patamares que o ND subiu.
export function resolverBando({ nd, tamanho, bando }) {
  const posicao = ORDEM_ND.findIndex(n => valorND(n) === valorND(nd));
  const ndEfetivo = ORDEM_ND[Math.min(Math.max(posicao, 0) + (Number(bando.aumentoND) || 0), ORDEM_ND.length - 1)];
  const sobeTamanho = ESCALAS_BANDO[bando.escala]?.tamanho ?? 1;
  const novoTamanho = ORDEM_TAMANHOS[Math.min(Math.max(ORDEM_TAMANHOS.indexOf(tamanho), 0) + sobeTamanho, ORDEM_TAMANHOS.length - 1)];
  const diferenca = ORDEM_PATAMARES.indexOf(patamarDoND(ndEfetivo)) - ORDEM_PATAMARES.indexOf(patamarDoND(nd));
  return { ndEfetivo, tamanho: novoTamanho, mult: MULTIPLICADOR_POR_PATAMAR[diferenca] ?? 1 };
}

const CARACTERES_ID = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
export const idAleatorio = () =>
  Array.from({ length: 16 }, () => CARACTERES_ID[Math.floor(Math.random() * CARACTERES_ID.length)]).join('');

const ROTULOS_TEMPLATE = { bando: 'Bando', enxame: 'Enxame', chefeFinal: 'Chefe Final' };

// Nome da cópia: "Nome (ND 10)" ou, com template, só as tags do template: "Nome (Chefe Final)".
// Troca o sufixo de um ajuste anterior ("(ND ...)" ou "(Chefe Final)") em vez de empilhar.
export function nomeDaCopia(nome, nd, ativos = []) {
  const rotulos = Object.values(ROTULOS_TEMPLATE).join('|');
  const sufixoAnterior = new RegExp(`\\s*\\((?:ND [^)]*|(?:${rotulos})(?:, (?:${rotulos}))*)\\)\\s*$`);
  const base = nome.replace(sufixoAnterior, '');
  const tags = Object.keys(ROTULOS_TEMPLATE).filter(chave => ativos.includes(chave)).map(chave => ROTULOS_TEMPLATE[chave]);
  return `${base} (${tags.length ? tags.join(', ') : 'ND ' + nd})`;
}

export const lerMarcador = (dados) => dados.flags?.[FLAG]?.templates ?? null;
export const ehItemDeTemplate = (item) => Boolean(item.flags?.[FLAG]?.origem);

// O sistema recalcula `value` a partir de `base`, mas fichas importadas trazem o RD só em `value`.
const rdAtual = (rd) => (rd.base > 0 ? rd.base : Number(rd.value) || 0);

// Média alvo -> fórmula NdX+B (mesma regra do app: N = dano/10 dados de d6, o resto em bônus fixo).
function formulaParaMedia(media) {
  const n = Math.max(1, Math.floor(media / 10));
  const b = Math.round(media - n * 3.5);
  return b === 0 ? `${n}d6` : b > 0 ? `${n}d6+${b}` : `${n}d6${b}`;
}

function criarPoder({ id, nome, descricao, origem, rolls = [] }) {
  return {
    _id: id,
    name: nome,
    type: 'poder',
    img: 'icons/svg/book.svg',
    system: {
      description: { value: `<p>${descricao}</p>`, unidentified: '' },
      source: '',
      ativacao: { execucao: 'passive', custo: 0, qtd: '', condicao: '', special: '' },
      duracao: { value: 0, units: 'inst', special: '' },
      range: { value: null, units: '' },
      efeito: '', alcance: 'none', area: '',
      resistencia: { pericia: '', atributo: '', bonus: 0, txt: '' },
      rolls,
      tipo: 'geral', subtipo: '',
      origin: '', tags: [], chatFlavor: '', chatGif: '', rolltags: [], automationtags: [],
    },
    effects: [], folder: null, sort: 0,
    flags: { [FLAG]: { origem } },
    ownership: { default: 0 },
  };
}

// Troca o número da RD escrita no texto ("redução de dano 10") ou acrescenta a frase quando não existe.
function textoComRD(texto, rd) {
  const achada = TEXTO_RD.exec(texto);
  if (achada) return Number(achada[3]) >= rd ? texto : texto.replace(TEXTO_RD, `$1$2${rd}`);
  return texto ? `${texto}, redução de dano ${rd}` : `redução de dano ${rd}`;
}

// Acrescenta ao texto os termos que ainda não estão nele (sem diferenciar maiúsculas).
function textoComTermos(texto, termos) {
  const faltando = termos.filter(t => !texto.toLowerCase().includes(t.toLowerCase()));
  if (!faltando.length) return texto;
  return texto ? `${texto}, ${faltando.join(', ')}` : faltando.join(', ');
}

function mesclarRotulos(existente, novos) {
  const atuais = existente.split(/[;,]/).map(s => s.trim()).filter(Boolean);
  const todos = [...atuais];
  for (const n of novos) {
    if (!todos.some(a => a.toLowerCase() === n.toLowerCase())) todos.push(n);
  }
  return todos.join(', ');
}

// Aplica a um item uma mudança no formato de itemUpdates ({ _id, 'system.rolls': ... }).
export function aplicarMudancas(item, mudanca) {
  for (const [caminho, valor] of Object.entries(mudanca)) {
    if (caminho === '_id') continue;
    const chaves = caminho.split('.');
    const ultima = chaves.pop();
    chaves.reduce((o, k) => (o[k] ??= {}), item)[ultima] = structuredClone(valor);
  }
  return item;
}

// Cópia da ficha com o que o Enxame alterou devolvido ao estado original (ataques das armas e linha de
// ataque), para o resto do cálculo trabalhar sobre a ficha como ela era antes do template.
export function restaurarDados(dados) {
  const marcador = lerMarcador(dados);
  const enxame = marcador?.ativos?.includes('enxame');
  const bando = marcador?.ativos?.includes('bando');
  if (!(enxame || bando) || !marcador.base) return dados;
  const copia = structuredClone(dados);
  // Marcador da v0.7.0: as armas ficavam na ficha com 0 ataques, e os ataques originais iam no marcador.
  for (const item of copia.items) {
    if (enxame && marcador.base.ataques && item._id in marcador.base.ataques) item.system.ataques = marcador.base.ataques[item._id];
    if (bando && marcador.base.rolls && item._id in marcador.base.rolls) item.system.rolls = structuredClone(marcador.base.rolls[item._id]);
  }
  // O Enxame remove as armas da ficha; para o cálculo elas voltam como eram.
  if (enxame && marcador.base.armas) {
    for (const arma of marcador.base.armas) {
      if (!copia.items.some(i => i._id === arma._id)) copia.items.push(structuredClone(arma));
    }
  }
  if (enxame && marcador.base.ataquescac !== undefined) copia.system.detalhes.ataquescac = marcador.base.ataquescac;
  return copia;
}

// Calcula o que os templates marcados mudam na ficha. Sempre parte do estado base: o do marcador, se
// a ficha já passou por aqui, ou o atual. Devolve valores absolutos (nunca "soma ao que já está").
// `nd` é o ND efetivo (o do bando, quando há Bando); `bando` é o resultado de resolverBando mais a configuração.
export function aplicarTemplates({ dados, nd, ativos = {}, bando = null, danoND, gerarId = idAleatorio }) {
  const marcador = lerMarcador(dados);
  const chefe = Boolean(ativos.chefeFinal);
  const enxame = Boolean(ativos.enxame);
  const vazio = { update: {}, itensCriar: [], armasParaRecriar: [], itensRemover: [], linhas: [], notas: [] };
  if (!chefe && !enxame && !bando && !marcador) return vazio;

  const sys = dados.system;
  const rdDados = sys.tracos.resistencias.dano;
  const restaurados = restaurarDados(dados);
  const atuais = {
    pmMax: sys.attributes.pm.max,
    pmValue: sys.attributes.pm.value,
    rdBase: rdAtual(rdDados),
    resistenciasTexto: sys.detalhes.resistencias ?? '',
    armas: restaurados.items.filter(i => i.type === 'arma' && !ehItemDeTemplate(i)).map(i => structuredClone(i)),
    ataquescac: sys.detalhes.ataquescac ?? '',
    icCustom: sys.tracos.ic?.custom ?? '',
    tamanho: sys.tracos.tamanho,
    rolls: Object.fromEntries(restaurados.items.filter(i => i.type === 'arma').map(i => [i._id, structuredClone(i.system.rolls)])),
  };
  const base = { ...atuais, ...marcador?.base };

  const update = {};
  const linhas = [];
  const notas = [];
  const itensCriar = [];

  // PM: só quem já tem PM ganha PM.
  if (base.pmMax > 0) {
    const pmMax = chefe ? base.pmMax + 2 * Math.max(1, Math.floor(valorND(nd))) : base.pmMax;
    update['system.attributes.pm.max'] = pmMax;
    update['system.attributes.pm.value'] = chefe ? pmMax : base.pmValue;
    if (chefe) linhas.push({ rotulo: 'PM', antes: sys.attributes.pm.max, depois: pmMax });
  }

  // RD: o patamar dá um mínimo; RD maior que ele continua.
  const bonusRD = chefe ? (RD_CHEFE_FINAL[patamarDoND(nd)] ?? 0) : 0;
  const rd = Math.max(base.rdBase, bonusRD);
  if (bonusRD > 0 || marcador) update['system.tracos.resistencias.dano.base'] = rd;

  // Texto de resistências: o original, mais as imunidades do Enxame, mais a RD do Chefe Final.
  let texto = base.resistenciasTexto;
  if (enxame) texto = textoComTermos(texto, IMUNIDADES_ENXAME);
  if (bando) texto = textoComTermos(texto, TERMOS_BANDO);
  if (bonusRD > 0) texto = textoComRD(texto, rd);
  if (marcador || texto !== (sys.detalhes.resistencias ?? '')) update['system.detalhes.resistencias'] = texto;
  if (chefe && rd !== rdAtual(rdDados)) linhas.push({ rotulo: 'RD', antes: rdAtual(rdDados), depois: rd });

  const rotulosIC = [...(enxame ? ROTULOS_IC_ENXAME : []), ...(bando ? ROTULOS_IC_BANDO : [])];
  const tinhaIC = marcador?.ativos?.some(a => a === 'enxame' || a === 'bando');
  if (rotulosIC.length) update['system.tracos.ic.custom'] = mesclarRotulos(base.icCustom, rotulosIC);
  else if (tinhaIC && marcador.base?.icCustom !== undefined) update['system.tracos.ic.custom'] = marcador.base.icCustom;

  if (bando) {
    linhas.push({ rotulo: 'ND do bando', antes: bando.ndIndividual, depois: bando.ndEfetivo });
    if (bando.tamanho !== base.tamanho) {
      linhas.push({ rotulo: 'Tamanho', antes: NOMES_TAMANHO[base.tamanho] ?? base.tamanho, depois: NOMES_TAMANHO[bando.tamanho] ?? bando.tamanho });
    }
    linhas.push({ rotulo: 'Dano do bando', antes: '×1', depois: `×${bando.mult}` });
    notas.push(`Bando: PV, ataque, defesa, CD e resistências do ND ${bando.ndEfetivo} (o ND ${bando.ndIndividual} com +${bando.aumentoND}); dano dos golpes ×${bando.mult}.`);
    for (const [nome, descricao] of PODERES_BANDO) {
      itensCriar.push(criarPoder({ id: gerarId(), nome, descricao, origem: 'bando' }));
    }
  }

  if (enxame) {
    const formula = formulaParaMedia(danoND);
    // As armas saem da ficha (o bloco de estatísticas lista toda arma, mesmo com 0 ataques); sem armas, o
    // bloco de Corpo a Corpo some, e o poder Enxame já descreve o ataque.
    update['system.detalhes.ataquescac'] = '';
    itensCriar.push(criarPoder({
      id: gerarId(), nome: 'Enxame', descricao: DESCRICAO_ENXAME, origem: 'enxame',
      rolls: [{ name: 'Dano', key: 'dano0', type: 'dano', parts: [[formula, 'dano', '']], versatil: '', adaptavel: '' }],
    }));
    for (const [nome, descricao] of PODERES_ENXAME) {
      itensCriar.push(criarPoder({ id: gerarId(), nome, descricao, origem: 'enxame' }));
    }
    notas.push(`Enxame: dano automático de ${formula} (média ${mediaFormula(formula)}). As armas são removidas da ficha e voltam se você desmarcar o Enxame.`);
  }

  if (chefe) {
    const xp = valorND(nd) < 1 ? 2 : valorND(nd) + 2;
    const regra = valorND(nd) < 1 ? 'ND menor que 1 conta como 2' : `ND ${nd} + 2`;
    notas.push(`Chefe Final: XP de ND ${xp} ao ser derrotado (${regra}).`);
    itensCriar.push(criarPoder({
      id: gerarId(), nome: 'Maior que a Morte', descricao: DESCRICAO_MAIOR_QUE_A_MORTE, origem: 'chefeFinal',
    }));
  }

  // O marcador guarda só o que os templates marcados alteram; o do Enxame inclui ataques e textos.
  const guardada = { pmMax: base.pmMax, pmValue: base.pmValue, rdBase: base.rdBase, resistenciasTexto: base.resistenciasTexto };
  if (enxame) Object.assign(guardada, { armas: base.armas, ataquescac: base.ataquescac });
  if (bando) Object.assign(guardada, { tamanho: base.tamanho, rolls: base.rolls });
  if (enxame || bando) guardada.icCustom = base.icCustom;
  const ativosMarcados = ['bando', 'enxame', 'chefeFinal'].filter(chave => (chave === 'bando' ? bando : ativos[chave]));
  const novoMarcador = ativosMarcados.length ? { ativos: ativosMarcados, base: guardada } : { ativos: [], base: null };
  if (bando) novoMarcador.bando = { escala: bando.escala, aumentoND: bando.aumentoND, ndIndividual: bando.ndIndividual };
  update[`flags.${FLAG}.templates`] = novoMarcador;

  // Sem o Enxame, as armas que ele tirou da ficha voltam (o cálculo ainda põe o dano novo nelas).
  const armasParaRecriar = !enxame && marcador?.ativos?.includes('enxame')
    ? (marcador.base?.armas ?? []).filter(a => !dados.items.some(i => i._id === a._id)).map(a => structuredClone(a))
    : [];
  const armasQueSaem = enxame ? dados.items.filter(i => i.type === 'arma' && !ehItemDeTemplate(i)).map(i => i._id) : [];

  return {
    update,
    itensCriar,
    armasParaRecriar,
    itensRemover: [...dados.items.filter(ehItemDeTemplate).map(i => i._id), ...armasQueSaem],
    linhas,
    notas,
  };
}
