// Cálculo de dano por rodada (auto-balanceamento da calculadora). Sem dependência do Foundry.
import { valorND } from './tabelas.js';

const TIPOS_CURA = ['curatpv', 'curapm'];
const FORMULA_VALIDA = /^[+-]?(?:\d*d\d+|\d+)(?:[+-](?:\d*d\d+|\d+))*$/i;
const TERMO = /([+-]?)(?:(\d*)d(\d+)|(\d+))/gi;

// Média de uma fórmula de dados ("3d8+12", "1d12 +10"). null se não for uma fórmula (vazia, @variável...).
export function mediaFormula(formula) {
  if (typeof formula !== 'string') return null;
  const limpa = formula.replace(/\s+/g, '');
  if (!FORMULA_VALIDA.test(limpa)) return null;

  let soma = 0;
  for (const [, sinal, qtd, faces, fixo] of limpa.matchAll(TERMO)) {
    const s = sinal === '-' ? -1 : 1;
    soma += faces !== undefined
      ? s * (qtd === '' ? 1 : Number(qtd)) * (Number(faces) + 1) / 2
      : s * Number(fixo);
  }
  return soma;
}

// Fórmula só com d6: 1d6 para cada 10 pontos de dano médio e o resto em bônus fixo.
export function gerarFormulaDano(danoMedio) {
  if (danoMedio <= 0) return '0';
  const n = Math.max(1, Math.floor(danoMedio / 10));
  const bonus = Math.round(danoMedio - n * 3.5);
  if (bonus === 0) return `${n}d6`;
  return bonus > 0 ? `${n}d6+${bonus}` : `${n}d6${bonus}`;
}

// Máximo de dados do dano de um poder de ação padrão: ND + 1 (ND 1/4 e 1/2 contam como 0).
export const limiteDados = (nd) => Math.floor(valorND(nd)) + 1;

// Fórmula só com dados, sem bônus, para um poder de ação padrão. `partes` ([{ faces, media }], a média
// original de cada parte de dano) reparte o alvo na proporção das médias; sem partes usa d12. O limite
// vale para o total e corta primeiro a parte que mais contribui (cada parte mantém ao menos 1 dado).
export function formulaSoDados({ alvo, partes = [{ faces: 12, media: 1 }], limite = Infinity }) {
  const soma = partes.reduce((s, p) => s + p.media, 0);
  const dados = partes.map(p => Math.max(1, Math.round(alvo * p.media / soma / ((p.faces + 1) / 2))));
  const total = () => dados.reduce((s, n) => s + n, 0);
  const cortado = total() > limite;
  while (total() > limite) {
    const maior = dados
      .map((n, i) => ({ i, n, peso: n * (partes[i].faces + 1) / 2 }))
      .filter(x => x.n > 1)
      .sort((a, b) => b.peso - a.peso)[0];
    if (!maior) break;
    dados[maior.i]--;
  }
  const formulas = partes.map((p, i) => `${dados[i]}d${p.faces}`);
  return { formulas, formula: formulas.join('+'), cortado };
}

// Rolagens de cura (PV/PM temporários etc.) não são dano e nunca são reescritas.
export const ehCura = (roll) => TIPOS_CURA.includes(roll.parts?.[0]?.[1]) || /^cura/i.test(roll.name ?? '');
const mediaDaParte = (parte) =>
  TIPOS_CURA.includes(parte?.[1]) ? 0 : (mediaFormula(parte?.[0]) ?? 0);

// Acha a rolagem de dano que será reescrita e o dano que a arma já causa por outras partes.
export function analisarDanoArma(rolls) {
  const danos = rolls
    .map((roll, indice) => ({ roll, indice }))
    .filter(({ roll }) => roll.type === 'dano' && !ehCura(roll));
  if (danos.length === 0) return null;

  const [principal, ...outras] = danos;
  const secundarioPrincipal = principal.roll.parts.slice(1).reduce((s, p) => s + mediaDaParte(p), 0);
  const secundarioOutras = outras.reduce(
    (s, { roll }) => s + roll.parts.reduce((t, p) => t + mediaDaParte(p), 0), 0);

  return {
    indiceRoll: principal.indice,
    principal: mediaFormula(principal.roll.parts[0]?.[0]),
    secundario: secundarioPrincipal + secundarioOutras,
  };
}

export function alertaEquilibrio(obtido, sugerido) {
  const diferenca = Math.floor(obtido) - sugerido;
  const margem = Math.max(5, Math.floor(sugerido * 0.10));
  if (Math.abs(diferenca) <= margem) return 'equilibrado';
  return diferenca > margem ? 'alto' : 'baixo';
}

// armas: [{ id, ataques, secundario, principal?, alternativa? }]. Armas "alternativas" são balanceadas
// cada uma contra o dano total; as demais dividem o dano entre si. Poder de ação padrão/completa entra com
// estilo 'dados' (sempre alternativo): recebe `fator` × o dano total, só em dados (`partes`, limite `limiteDados`).
// Com `manterProporcao` (padrão) o dano de cada golpe segue a proporção da ficha original (peso =
// principal + secundário); o dano secundário fica fixo e só o principal é recalculado. Sem o dano
// principal de alguma arma, ou com manterProporcao false, todos os golpes recebem a mesma fórmula.
export function balancearDano({ danoAlvo, armas, manterProporcao = true, limiteDados = Infinity }) {
  const ativas = armas.filter(a => a.ataques > 0);
  if (ativas.length === 0) throw new Error('Nenhuma arma com ataques por rodada maior que zero');

  const alternativa = (a) => a.alternativa || a.estilo === 'dados';
  const compartilhadas = ativas.filter(a => !alternativa(a));
  const grupos = [
    ...(compartilhadas.length ? [compartilhadas] : []),
    ...ativas.filter(alternativa).map(a => [a]),
  ];

  const porArma = {};
  const avisos = [];
  // Poder só de dados (`faces`) que divide a rodada mantém as faces: só muda a quantidade de dados (teto `limiteDados`).
  const formulaDoGolpe = (a, danoPorGolpe) => {
    if (!a.faces) return gerarFormulaDano(danoPorGolpe);
    const { formula, cortado } = formulaSoDados({ alvo: danoPorGolpe, partes: [{ faces: a.faces, media: 1 }], limite: limiteDados });
    if (cortado) avisos.push(`O limite de ${limiteDados} dados deixou o dano do poder em ${mediaFormula(formula)}, abaixo do alvo (${danoPorGolpe}).`);
    return formula;
  };
  const resumoGrupos = grupos.map((grupo) => {
    if (grupo[0].estilo === 'dados') {
      const [a] = grupo;
      const alvo = danoAlvo * (a.fator ?? 1);
      const { formula, formulas, cortado } = formulaSoDados({ alvo, partes: a.partes, limite: limiteDados });
      const obtido = mediaFormula(formula);
      porArma[a.id] = { formula, formulas, danoPorGolpe: obtido };
      if (cortado) avisos.push(`O limite de ${limiteDados} dados deixou o dano do poder em ${obtido}, abaixo do alvo (${alvo}).`);
      return { ids: [a.id], obtido, alerta: alertaEquilibrio(obtido, alvo) };
    }

    const totalAtaques = grupo.reduce((s, a) => s + a.ataques, 0);
    const existente = grupo.reduce((s, a) => s + a.ataques * a.secundario, 0);
    const restante = Math.max(0, danoAlvo - existente);

    if (existente > danoAlvo) {
      avisos.push(`O dano existente (${existente}) passa do alvo (${danoAlvo}); a fórmula ficou 0.`);
    }

    const pesos = grupo.map(a => (a.principal == null ? null : a.principal + a.secundario));
    const proporcional = manterProporcao && grupo.length > 1 && pesos.every(p => p !== null && p > 0);
    if (proporcional) {
      const escala = danoAlvo / grupo.reduce((s, a, i) => s + a.ataques * pesos[i], 0);
      grupo.forEach((a, i) => {
        const danoPorGolpe = Math.max(0, escala * pesos[i] - a.secundario);
        porArma[a.id] = { formula: formulaDoGolpe(a, danoPorGolpe), danoPorGolpe };
      });
    } else {
      const danoPorGolpe = restante / totalAtaques;
      for (const a of grupo) porArma[a.id] = { formula: formulaDoGolpe(a, danoPorGolpe), danoPorGolpe };
    }

    const obtido = grupo.reduce(
      (s, a) => s + a.ataques * ((mediaFormula(porArma[a.id].formula) ?? 0) + a.secundario), 0);
    return { ids: grupo.map(a => a.id), obtido, alerta: alertaEquilibrio(obtido, danoAlvo) };
  });

  return { porArma, grupos: resumoGrupos, avisos };
}
