// Mensagem de boas-vindas e de novidades no chat. Sem dependência do Foundry: quem manda a mensagem
// (main.js) só decide, monta e envia.

// Chaves de texto das novidades de cada versão. Versão sem entrada aqui não gera mensagem.
export const NOVIDADES = {
  '0.4.0': ['T20AJND.Novidade040Conjurador', 'T20AJND.Novidade040Circulos', 'T20AJND.Novidade040Boasvindas'],
  '0.5.0': ['T20AJND.Novidade050Patamar'],
  '0.6.0': ['T20AJND.Novidade060ChefeFinal'],
  '0.7.0': ['T20AJND.Novidade070Enxame', 'T20AJND.Novidade070Nome'],
  '0.8.0': ['T20AJND.Novidade080Bando'],
};

const versaoComoNumeros = (versao) => String(versao ?? '').split('.').map(n => parseInt(n, 10) || 0);

function compararVersoes(a, b) {
  const [x, y] = [versaoComoNumeros(a), versaoComoNumeros(b)];
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const diferenca = (x[i] ?? 0) - (y[i] ?? 0);
    if (diferenca) return Math.sign(diferenca);
  }
  return 0;
}

// 'completa' na primeira vez no mundo; 'novidades' quando a versão subiu e tem novidades; senão null.
export function decidirMensagem(versaoVista, versaoAtual) {
  if (!versaoVista) return 'completa';
  if (compararVersoes(versaoAtual, versaoVista) <= 0) return null;
  return NOVIDADES[versaoAtual] ? 'novidades' : null;
}

const escapar = (s) => String(s).replace(/[&<>"']/g, c => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const ITENS_COMPLETA = [
  ['fa-scale-balanced', 'T20AJND.BoasVindasAbrirTitulo', 'T20AJND.BoasVindasAbrir'],
  ['fa-chart-line', 'T20AJND.BoasVindasAjustaTitulo', 'T20AJND.BoasVindasAjusta'],
  ['fa-eye', 'T20AJND.BoasVindasPreviaTitulo', 'T20AJND.BoasVindasPrevia'],
  ['fa-sliders', 'T20AJND.BoasVindasOpcoesTitulo', 'T20AJND.BoasVindasOpcoes'],
  ['fa-user-shield', 'T20AJND.BoasVindasMestreTitulo', 'T20AJND.BoasVindasMestre'],
];

const item = (icone, titulo, texto) =>
  `<li><i class="fas ${icone}"></i> <strong>${escapar(titulo)}</strong> — ${escapar(texto)}</li>`;

// `t` traduz uma chave (game.i18n.localize no Foundry).
export function montarMensagem(tipo, versao, t) {
  const titulo = `<h3><i class="fas fa-scale-balanced"></i> ${escapar(t('T20AJND.BoasVindasTitulo'))}</h3>`;
  if (tipo === 'novidades') {
    const itens = (NOVIDADES[versao] ?? []).map(chave => `<li>${escapar(t(chave))}</li>`).join('');
    return `<div class="t20-ajuste-nd-chat">${titulo}<p><strong>${escapar(t('T20AJND.NovidadesTitulo'))} ${escapar(versao)}</strong></p><ul>${itens}</ul></div>`;
  }
  const itens = ITENS_COMPLETA.map(([icone, chaveTitulo, chaveTexto]) => item(icone, t(chaveTitulo), t(chaveTexto))).join('');
  return `<div class="t20-ajuste-nd-chat">${titulo}<p>${escapar(t('T20AJND.BoasVindasIntro'))}</p><ul>${itens}</ul></div>`;
}
