// Textos escritos à mão nas fichas: a CD dentro de descrições e as linhas de ataque. Sem dependência do Foundry.

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
// armas: [{ nome, ataque, formula? }]
export function atualizarTextoAtaques(texto, armas) {
  if (!texto) return '';
  let resultado = texto;
  for (const { nome, ataque, formula } of armas) {
    const trecho = new RegExp(`(${padraoDoNome(nome)})(\\s*)[+-]\\d+(\\s*)\\(([^)]*)\\)`, 'i');
    resultado = resultado.replace(trecho, (_, citado, espaco1, espaco2, parenteses) => {
      const sinal = ataque >= 0 ? '+' : '';
      const dano = formula
        ? parenteses.replace(/^(\s*)\d*d\d+(?:[+-]\d+)*/i, (__, inicio) => `${inicio}${formula}`)
        : parenteses;
      return `${citado}${espaco1}${sinal}${ataque}${espaco2}(${dano})`;
    });
  }
  return resultado;
}
