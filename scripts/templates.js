// Templates de ameaça (por ora, Chefe Final). Sem dependência do Foundry.
//
// O módulo guarda no ator um marcador com o estado ORIGINAL (PM, RD e texto de resistências) e marca
// com uma flag os itens que cria. Assim o ajuste é repetível: antes de aplicar de novo, tudo volta ao
// estado base, e desmarcar o template devolve a ficha como estava.
import { valorND } from './tabelas.js';
import { patamarDoND } from './patamares.js';

export const FLAG = 'tormenta20-ajuste-nd';

const RD_CHEFE_FINAL = { Veterano: 5, 'Campeão': 10, Lenda: 20 };
const TEXTO_RD = /(redu[cç][aã]o de dano|\bRD)(\s*)(\d+)/i;

const DESCRICAO_MAIOR_QUE_A_MORTE = 'Enquanto tiver pelo menos metade de seus PV, a criatura é imune a habilidades de "morte instantânea". '
  + 'Isso inclui efeitos que reduzem seus PV a 0 ou menos instantaneamente (como Assassino Fantasmagórico), '
  + 'que aprisionam ou destroem sua alma ou corpo e similares. A criatura ainda pode ser reduzida a 0 PV por dano normal.';

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

function poderMaiorQueAMorte(id) {
  return {
    _id: id,
    name: 'Maior que a Morte',
    type: 'poder',
    img: 'icons/svg/book.svg',
    system: {
      description: { value: `<p>${DESCRICAO_MAIOR_QUE_A_MORTE}</p>`, unidentified: '' },
      source: '',
      ativacao: { execucao: 'passive', custo: 0, qtd: '', condicao: '', special: '' },
      duracao: { value: 0, units: 'inst', special: '' },
      range: { value: null, units: '' },
      efeito: '', alcance: 'none', area: '',
      resistencia: { pericia: '', atributo: '', bonus: 0, txt: '' },
      rolls: [],
      tipo: 'geral', subtipo: '',
      origin: '', tags: [], chatFlavor: '', chatGif: '', rolltags: [], automationtags: [],
    },
    effects: [], folder: null, sort: 0,
    flags: { [FLAG]: { origem: 'chefeFinal' } },
    ownership: { default: 0 },
  };
}

// Troca o número da RD escrita no texto ("redução de dano 10") ou acrescenta a frase quando não existe.
function textoComRD(texto, rd) {
  const achada = TEXTO_RD.exec(texto);
  if (achada) return Number(achada[3]) >= rd ? texto : texto.replace(TEXTO_RD, `$1$2${rd}`);
  return texto ? `${texto}, redução de dano ${rd}` : `redução de dano ${rd}`;
}

// Calcula o que os templates marcados mudam na ficha. Sempre parte do estado base: o do marcador, se
// a ficha já passou por aqui, ou o atual. Devolve valores absolutos (nunca "soma ao que já está").
export function aplicarTemplates({ dados, nd, ativos = {}, gerarId = idAleatorio }) {
  const marcador = lerMarcador(dados);
  const chefe = Boolean(ativos.chefeFinal);
  const vazio = { update: {}, itensCriar: [], itensRemover: [], linhas: [], notas: [] };
  if (!chefe && !marcador) return vazio;

  const sys = dados.system;
  const rdDados = sys.tracos.resistencias.dano;
  const base = marcador?.base ?? {
    pmMax: sys.attributes.pm.max,
    pmValue: sys.attributes.pm.value,
    rdBase: rdAtual(rdDados),
    resistenciasTexto: sys.detalhes.resistencias ?? '',
  };

  const update = {};
  const linhas = [];
  const notas = [];

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
  const texto = bonusRD > 0 ? textoComRD(base.resistenciasTexto, rd) : base.resistenciasTexto;
  if (marcador || texto !== (sys.detalhes.resistencias ?? '')) update['system.detalhes.resistencias'] = texto;
  if (chefe && rd !== rdAtual(rdDados)) linhas.push({ rotulo: 'RD', antes: rdAtual(rdDados), depois: rd });

  if (chefe) {
    const xp = valorND(nd) < 1 ? 2 : valorND(nd) + 2;
    const regra = valorND(nd) < 1 ? 'ND menor que 1 conta como 2' : `ND ${nd} + 2`;
    notas.push(`Chefe Final: XP de ND ${xp} ao ser derrotado (${regra}).`);
  }

  update[`flags.${FLAG}.templates`] = chefe ? { ativos: ['chefeFinal'], base } : { ativos: [], base: null };

  return {
    update,
    itensCriar: chefe ? [poderMaiorQueAMorte(gerarId())] : [],
    itensRemover: dados.items.filter(ehItemDeTemplate).map(i => i._id),
    linhas,
    notas,
  };
}
