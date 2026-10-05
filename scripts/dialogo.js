// Diálogo "Ajustar ND": escolhe ND-alvo, papel e ataques por arma e mostra a prévia antes → depois.
import { lerArmas, ordenarResistencias } from './calculo.js';
import { mediaFormula } from './dano.js';
import { aplicarAjuste, criarMedidor, simular, ID_MODULO } from './aplicar.js';
import { aumentoPadrao, lerMarcador, restaurarDados } from './templates.js';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const NDS = ['1/4', '1/2', ...Array.from({ length: 20 }, (_, i) => String(i + 1)), 'S', 'S+'];
const PAPEIS = [['solo', 'Solo'], ['lackey', 'Lacaio'], ['special', 'Especial']];
const TESTES = { fort: 'Fortitude', refl: 'Reflexos', vont: 'Vontade' };
const PERICIAS_ATAQUE = { luta: 'Luta', pont: 'Pontaria' };
const ESCALAS_BANDO = ['10-20', '20-40', '50-70', '80-100'];
const SELOS = { equilibrado: 'Equilibrado', alto: 'Alto', baixo: 'Baixo' };

export class DialogoAjusteND extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    classes: ['t20-ajuste-nd'],
    position: { width: 680, height: 'auto' },
    window: { resizable: true, icon: 'fas fa-scale-balanced' },
    actions: { aplicar: DialogoAjusteND.#aplicar, cancelar: DialogoAjusteND.#cancelar },
  };

  static PARTS = { corpo: { template: `modules/${ID_MODULO}/templates/dialogo.hbs` } };

  constructor(actor, options = {}) {
    super({ id: `${ID_MODULO}-${actor.id}`, ...options });
    this.actor = actor;
    this.resultado = null;

    // Ficha como era antes dos templates (ataques do Enxame e fórmulas do Bando de volta ao original).
    const dados = restaurarDados(actor.toObject());
    const marcador = lerMarcador(dados);
    const armas = lerArmas(dados.items, dados.system.detalhes.ataquescac ?? '');
    // Com Bando, a ficha mostra o ND do bando; o ND de destino do diálogo é o da criatura individual.
    const nd = String(marcador?.ativos?.includes('bando') ? marcador.bando?.ndIndividual : dados.system.attributes.nd).trim();
    const papel = dados.system.detalhes.role;
    this.estado = {
      nd: NDS.includes(nd) ? nd : '1',
      papel: PAPEIS.some(([chave]) => chave === papel) ? papel : 'solo',
      copiar: true,
      atualizarCDs: true,
      atualizarTextoAtaques: true,
      atualizarNivelConjurador: true,
      manterProporcao: true,
      chefeFinal: lerMarcador(dados)?.ativos?.includes('chefeFinal') ?? false,
      enxame: lerMarcador(dados)?.ativos?.includes('enxame') ?? false,
      bando: marcador?.ativos?.includes('bando') ?? false,
      bandoEscala: marcador?.bando?.escala ?? '10-20',
      bandoAumento: marcador?.bando?.aumentoND ?? aumentoPadrao('10-20'),
      ataques: Object.fromEntries(armas.map(a => [a.id, a.ataques])),
      alternativas: {},
      ordem: ordenarResistencias(criarMedidor(actor)().pericias),
      ordemInvalida: false,
    };
  }

  get title() {
    return `${game.i18n.localize('T20AJND.Titulo')}: ${this.actor.name}`;
  }

  async _prepareContext() {
    const e = this.estado;
    const contexto = {
      nds: NDS.map(v => ({ valor: v, selecionado: v === e.nd })),
      papeis: PAPEIS.map(([valor, rotulo]) => ({ valor, rotulo, selecionado: valor === e.papel })),
      copiar: e.copiar,
      atualizarCDs: e.atualizarCDs,
      atualizarTextoAtaques: e.atualizarTextoAtaques,
      atualizarNivelConjurador: e.atualizarNivelConjurador,
      manterProporcao: e.manterProporcao,
      chefeFinal: e.chefeFinal,
      enxame: e.enxame,
      bando: e.bando,
      bandoAumento: e.bandoAumento,
      escalas: ESCALAS_BANDO.map(valor => ({ valor, selecionado: valor === e.bandoEscala })),
      erro: null, linhas: [], armas: [], avisos: [], revisar: [], sugestoes: [], patamar: [], notasTemplates: [], selo: null, ordem: [],
    };
    contexto.ordem = ['Forte', 'Média', 'Fraca'].map((rotulo, i) => ({
      indice: i, rotulo,
      opcoes: Object.entries(TESTES).map(([valor, nome]) => ({ valor, nome, selecionado: valor === e.ordem[i] })),
    }));

    if (e.ordemInvalida) {
      contexto.erro = 'Cada teste de resistência deve aparecer uma única vez em Forte, Média e Fraca.';
      this.resultado = null;
      return contexto;
    }

    try {
      this.resultado = await simular(this.actor, {
        nd: e.nd, papel: e.papel, ataquesPorArma: e.ataques,
        alternativas: e.alternativas, ordemResistencias: e.ordem,
        atualizarCDs: e.atualizarCDs, atualizarTextoAtaques: e.atualizarTextoAtaques,
        atualizarNivelConjurador: e.atualizarNivelConjurador, manterProporcao: e.manterProporcao,
        templates: {
          chefeFinal: e.chefeFinal,
          enxame: e.enxame,
          bando: e.bando ? { escala: e.bandoEscala, aumentoND: e.bandoAumento } : null,
        },
      });
    } catch (erro) {
      console.error(`${ID_MODULO} |`, erro);
      this.resultado = null;
      contexto.erro = erro.message;
      return contexto;
    }
    return Object.assign(contexto, this.#montarPrevia(this.resultado));
  }

  #montarPrevia(r) {
    const dados = restaurarDados(this.actor.toObject());
    const sys = dados.system;
    const linha = (rotulo, antes, depois) => ({ rotulo, antes, depois, mudou: antes !== depois });

    const armas = lerArmas(dados.items, sys.detalhes.ataquescac ?? '');
    const usadas = [...new Set(armas.map(a => a.pericia))];
    const linhas = [
      linha('PV', sys.attributes.pv.max, r.update['system.attributes.pv.max']),
      linha('CD', sys.attributes.cd, r.update['system.attributes.cd']),
      linha('Defesa (total na ficha)', r.antes.defesa, r.depois.defesa),
      ...usadas.map(k => linha(`Ataque (${PERICIAS_ATAQUE[k] ?? k})`, r.antes.pericias[k], r.depois.pericias[k])),
      ...Object.entries(TESTES).map(([k, nome]) => linha(nome, r.antes.pericias[k], r.depois.pericias[k])),
      ...r.templates.linhas.map(({ rotulo, antes, depois }) => linha(rotulo, antes, depois)),
    ];

    const linhasArmas = armas.map((arma) => {
      const item = dados.items.find(i => i._id === arma.id);
      const ataques = this.estado.enxame ? 0 : (this.estado.ataques[arma.id] ?? arma.ataques);
      const antes = item.system.rolls[arma.indiceRollDano].parts[0][0];
      const novo = r.itemUpdates.find(u => u._id === arma.id)['system.rolls'][arma.indiceRollDano].parts[0][0];
      const depois = ataques > 0 ? novo : null;
      return {
        id: arma.id, nome: arma.nome, ataques,
        alternativa: !!this.estado.alternativas[arma.id],
        antes, depois,
        mediaDepois: depois ? this.#mediaDoGolpe(r, arma.id, depois) : null,
      };
    });

    const grupos = r.plano.dano?.grupos ?? [];
    const ativas = linhasArmas.filter(a => a.ataques > 0);
    const somaCompartilhadas = ativas.filter(a => !a.alternativa).reduce((s, a) => s + a.ataques, 0);
    const maiorAlternativa = Math.max(0, ...ativas.filter(a => a.alternativa).map(a => a.ataques));
    const rodada = grupos.length ? {
      obtido: Number((Math.max(...grupos.map(g => g.obtido)) * r.templates.multDano).toFixed(1)),
      alvo: r.plano.linha.Dano,
      ataques: somaCompartilhadas + maiorAlternativa,
    } : null;
    const pior = grupos.find(g => g.alerta !== 'equilibrado') ?? grupos[0];
    return {
      linhas, armas: linhasArmas, avisos: r.avisos, revisar: r.plano.revisar, sugestoes: r.sugestoes, patamar: r.patamar, notasTemplates: r.templates.notas,
      textos: this.#montarTextos(r.textos),
      danoAlvo: r.plano.linha.Dano,
      rodada,
      selo: pior ? { alerta: pior.alerta, texto: SELOS[pior.alerta] } : null,
    };
  }

  // Média do golpe já com o multiplicador do bando (a fórmula escrita na ficha é "(fórmula) * N").
  #mediaDoGolpe(r, idArma, escrita) {
    const simples = r.plano.dano?.porArma[idArma]?.formula;
    const media = mediaFormula(simples ?? escrita);
    return media === null ? null : media * r.templates.multDano;
  }

  #montarTextos(textos) {
    const cds = textos.cds.map(({ nome, antigas, para }) =>
      `${nome}: CD ${[...new Set(antigas)].join(' e ')} → ${para}`);
    const ataques = textos.ataques.map(({ campo, antes, depois }) => ({
      rotulo: campo === 'ataquescac' ? 'Corpo a Corpo' : 'À Distância', antes, depois,
    }));
    const conjurador = textos.conjurador.map(({ nome, classe, de, para }) =>
      `${nome}: ${classe} de ${de}º → ${para}º nível`);
    return { cds, conjurador, ataques, temAlgo: cds.length > 0 || conjurador.length > 0 || ataques.length > 0 };
  }

  _onRender() {
    const el = this.element;
    el.querySelectorAll('input, select').forEach(campo =>
      campo.addEventListener('change', () => this.#aoMudar()));
  }

  async #aoMudar() {
    const el = this.element;
    const e = this.estado;
    e.nd = el.querySelector('[name=nd]').value;
    e.papel = el.querySelector('[name=papel]').value;
    e.copiar = el.querySelector('[name=copiar]').checked;
    e.atualizarCDs = el.querySelector('[name=atualizarCDs]').checked;
    e.atualizarTextoAtaques = el.querySelector('[name=atualizarTextoAtaques]').checked;
    e.atualizarNivelConjurador = el.querySelector('[name=atualizarNivelConjurador]').checked;
    e.manterProporcao = el.querySelector('[name=manterProporcao]').checked;
    e.chefeFinal = el.querySelector('[name=chefeFinal]').checked;
    e.enxame = el.querySelector('[name=enxame]').checked;
    e.bando = el.querySelector('[name=bando]').checked;
    const escala = el.querySelector('[name=bandoEscala]').value;
    if (escala !== e.bandoEscala) {
      e.bandoEscala = escala;
      e.bandoAumento = aumentoPadrao(escala);
    } else {
      e.bandoAumento = Math.max(0, parseInt(el.querySelector('[name=bandoAumento]').value, 10) || 0);
    }
    el.querySelectorAll('[data-ataques]').forEach((c) => {
      e.ataques[c.dataset.ataques] = Math.max(0, parseInt(c.value, 10) || 0);
    });
    el.querySelectorAll('[data-alternativa]').forEach((c) => {
      e.alternativas[c.dataset.alternativa] = c.checked;
    });
    e.ordem = [0, 1, 2].map(i => el.querySelector(`[name=ordem-${i}]`).value);
    e.ordemInvalida = new Set(e.ordem).size !== 3;
    await this.render();
  }

  static async #aplicar() {
    if (!this.resultado) return;
    const novo = await aplicarAjuste(this.actor, this.resultado, { copiar: this.estado.copiar });
    ui.notifications.info(game.i18n.format('T20AJND.Aplicado', { nome: novo.name }));
    await this.close();
  }

  static async #cancelar() {
    await this.close();
  }
}

export function abrirAjusteND(actor) {
  return new DialogoAjusteND(actor).render({ force: true });
}
