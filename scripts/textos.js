// Textos escritos à mão nas fichas: a CD dentro de descrições e as linhas de ataque. Sem dependência do Foundry.
import { mediaFormula } from './dano.js';

const escapar = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Trecho de regex que acha o nome de uma arma no texto, aceitando o plural da primeira palavra
// ("Corrente de espinhos" → "correntes de espinhos"; "Garras" também acha "garra").
export function padraoDoNome(nome) {
  const [primeira, ...resto] = nome.trim().split(/\s+/);
  return [`${escapar(primeira.replace(/s$/i, ''))}s?`, ...resto.map(escapar)].join('\\s+');
}

// Troca só o número depois de "CD" ("CD 17" → "CD 26"). Devolve também as CDs antigas encontradas.
export function atualizarCDs(texto, cd) {
  if (!texto) return { texto: '', antigas: [] };
  const antigas = [];
  const novo = texto.replace(/\b(CD\s*)(\d+)\b/g, (_, prefixo, numero) => {
    antigas.push(Number(numero));
    return `${prefixo}${cd}`;
  });
  return { texto: novo, antigas };
}

// Troca o nível em "lança magias como um clérigo de 10º nível" ("um/uma" e a classe ficam como estão).
// Devolve cada trecho achado como { classe, de, para }; só esse padrão é tocado.
export function atualizarNivelConjurador(texto, nivel) {
  if (!texto) return { texto: '', trocas: [] };
  const trocas = [];
  const novo = texto.replace(
    /(magias\s+como\s+(?:um|uma)\s+)([\p{L}-]+)(\s+de\s+)(\d+)(º\s*n[ií]vel)/giu,
    (_, inicio, classe, de, antigo, fim) => {
      trocas.push({ classe, de: Number(antigo), para: nivel });
      return `${inicio}${classe}${de}${nivel}${fim}`;
    });
  return { texto: novo, trocas };
}

// Atualiza o bônus de ataque e a fórmula de dano de cada arma citada no texto
// ("Bordão +11 (1d8+4)" → "Bordão +22 (3d6+21)"). Dano secundário, crítico, quantidades e o resto
// do texto ficam como estão. Arma que não aparece no texto não muda nada.
// armas: [{ nome, ataque, formula?, multiplicador? }]. Com `multiplicador` maior que 1 (Bando), o dano
// extra escrito como "mais 1d6 ..." também ganha o "×N", já que o golpe inteiro é multiplicado.
export function atualizarTextoAtaques(texto, armas) {
  if (!texto) return '';
  let resultado = texto;
  for (const { nome, ataque, formula, multiplicador = 1 } of armas) {
    const trecho = new RegExp(`(${padraoDoNome(nome)})(\\s*)[+-]\\d+(\\s*)\\(([^)]*)\\)`, 'i');
    resultado = resultado.replace(trecho, (_, citado, espaco1, espaco2, parenteses) => {
      const sinal = ataque >= 0 ? '+' : '';
      let dano = formula
        ? parenteses.replace(/^(\s*)\d*d\d+(?:[+-]\d+)*/i, (__, inicio) => `${inicio}${formula}`)
        : parenteses;
      if (formula && multiplicador > 1) {
        dano = dano.replace(/(\bmais\s+)(\d*d\d+(?:[+-]\d+)*)/gi, (__, mais, extra) => `${mais}${extra} ×${multiplicador}`);
      }
      return `${citado}${espaco1}${sinal}${ataque}${espaco2}(${dano})`;
    });
  }
  return resultado;
}

const chaveFormula = (f) => f.replace(/\s+/g, '').toLowerCase();
// "3d8+3" casa também como "3d8 + 3" no texto.
const formulaFlexivel = (f) => (f.match(/\d+|[a-z]+|[+-]/gi) ?? []).map(escapar).join('\\s*');

// Troca no texto de um poder a fórmula de cada parte de dano: "16 (3d8 + 3 Bludgeoning)" (estilo 5e, com
// a média e o tipo) vira "22 (5d8 Bludgeoning)"; "sofrem 16d12 pontos" (estilo T20) só troca a fórmula.
// partes: [{ de, para, multiplicador? }] com as fórmulas antiga e nova. A troca é de uma passada só, então
// uma fórmula nova não é trocada de novo.
// shortcut: partes com a mesma fórmula antiga usam a primeira; separar casando pela ordem no texto, se aparecer.
export function atualizarDanoPoder(texto, partes) {
  if (!texto || !partes.length) return texto ?? '';
  const porChave = new Map();
  for (const p of partes) if (!porChave.has(chaveFormula(p.de))) porChave.set(chaveFormula(p.de), p);
  const alternativas = [...porChave.keys()].sort((a, b) => b.length - a.length).map(formulaFlexivel).join('|');
  const nova = (p) => `${p.para}${p.multiplicador > 1 ? ` ×${p.multiplicador}` : ''}`;

  // As saídas ficam guardadas até o fim para uma troca não ser vista pela seguinte.
  const saidas = [];
  const guardar = (s) => `\u0000${saidas.push(s) - 1}\u0000`;
  const estilo5e = new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*\\(\\s*(${alternativas})(?!\\d)([^)]*)\\)`, 'gi');
  const solta = new RegExp(`(?<![\\w])(${alternativas})(?!\\d)`, 'gi');

  return texto
    .replace(estilo5e, (_, __, formula, resto) => {
      const p = porChave.get(chaveFormula(formula));
      const media = Math.floor(mediaFormula(p.para) * (p.multiplicador ?? 1));
      const tipo = resto.trim();
      return guardar(`${media} (${nova(p)}${tipo ? ` ${tipo}` : ''})`);
    })
    .replace(solta, (formula) => guardar(nova(porChave.get(chaveFormula(formula)))))
    .replace(/\u0000(\d+)\u0000/g, (_, i) => saidas[i]);
}
