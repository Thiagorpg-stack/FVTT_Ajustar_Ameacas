// Patamares de ND e o que eles pedem da ficha (ataques por rodada e quantidade de poderes).
// Só avisos para a prévia: nada aqui altera a ficha. Sem dependência do Foundry.
import { consultar, maxAtaques, valorND } from './tabelas.js';

const ROTULOS_PAPEL = { solo: 'Solo', lackey: 'Lacaio', lacaio: 'Lacaio', special: 'Especial', especial: 'Especial' };

export function patamarDoND(nd) {
  const v = valorND(nd);
  if (v <= 4) return 'Iniciante';
  if (v <= 10) return 'Veterano';
  if (v <= 16) return 'Campeão';
  return 'Lenda';
}

// Faixa de poderes/habilidades sugerida: vem da coluna Hab da tabela ("2–4").
export function faixaDeHabilidades(tabelas, papel, nd) {
  const texto = consultar(tabelas, papel, nd).Hab;
  const [min, max] = texto.split(/[–-]/).map(n => parseInt(n, 10));
  return { min, max, texto };
}

export function avisosDePatamar({ ndAntes, ndDepois, papel, ataques, poderes, faixa }) {
  const antes = patamarDoND(ndAntes);
  const depois = patamarDoND(ndDepois);
  const mudou = antes !== depois;
  const avisos = [];

  if (mudou) {
    avisos.push(`Patamar: ${antes} → ${depois}.`);
    avisos.push(`Ataques por rodada: até ${maxAtaques(ndDepois)} (a ficha tem ${ataques}).`);
  }

  const rotulo = ROTULOS_PAPEL[papel] ?? papel;
  const sugeridos = `Poderes sugeridos para ${rotulo} no ${depois}: ${faixa.texto}`;
  if (poderes < faixa.min) {
    avisos.push(`${sugeridos} (a ficha tem ${poderes}). Considere adicionar de ${faixa.min - poderes} a ${faixa.max - poderes}.`);
  } else if (poderes > faixa.max) {
    avisos.push(`${sugeridos} (a ficha tem ${poderes}, acima da faixa). Considere simplificar.`);
  } else if (mudou) {
    avisos.push(`${sugeridos} (a ficha tem ${poderes}, dentro da faixa).`);
  }
  return avisos;
}
