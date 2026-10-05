# Tormenta20: Ajustar ND

Módulo para Foundry VTT (sistema não oficial [Tormenta20](https://gitlab.com/vizael/Tormenta20)) que ajusta uma ameaça para um **ND** e **papel** (Solo, Lacaio ou Especial) da tabela de parâmetros de ameaças.

Na ficha de uma ameaça (ou no menu de contexto do diretório de atores), o mestre clica em **Ajustar ND**, escolhe o ND-alvo e o papel, confere a prévia antes → depois e aplica.

## O que o módulo ajusta

| Estatística | Como |
|---|---|
| PV, CD | Valor da tabela. |
| Ataque | O total de Luta/Pontaria (as perícias das armas) vira o ataque da tabela; termos numéricos nas rolagens de ataque viram `0`. |
| Resistências | Mantém a ordem atual (o teste mais alto recebe a resistência Forte); o mestre pode trocar na prévia. |
| Defesa | O total mostrado na ficha vira o da tabela, ajustando só `defesa.base` (a ficha soma DES, armadura e escudo). |
| Dano | Fórmula `Nd6+B` por arma, dividindo o dano por rodada da tabela entre os golpes. Por padrão mantém a **proporção** entre as armas da ficha original (a que causava mais dano continua causando mais); o dano secundário (como "1d6 de ácido") fica fixo e só o principal é recalculado. Desligando a opção, todas as armas recebem a mesma fórmula. Armas alternativas (uma OU outra) são balanceadas cada uma contra o dano total. |

Textos escritos à mão (podem ser desligados no diálogo):

| Texto | Como |
|---|---|
| CD nas descrições | Em poderes, magias e armas, troca só o número depois de "CD" (ex.: "CD 17" vira "CD 26"). O resto do texto não muda. |
| Nível de conjurador | "Lança magias como um clérigo de 10º nível" passa a usar o ND de destino como nível (a classe e o um/uma ficam como estão). |
| Linhas de ataque (Corpo a Corpo / À Distância) | Troca o bônus de ataque e a fórmula de dano de cada arma citada (ex.: "Bordão +11 (1d8+4)" vira "Bordão +22 (3d6+21)"). Dano secundário, crítico, quantidades e o resto do texto ficam como estão. Só mexe em campos que já têm texto. |

Não alteram: atributos, efeitos ativos e o conteúdo de poderes e magias (poderes e magias com dano aparecem na lista "Para revisar"). O PM só muda com o template Chefe Final.

## Avisos na prévia (nada é alterado na ficha)

- **Patamar de ND:** ao mudar de Iniciante, Veterano, Campeão ou Lenda, mostra o limite de ataques por rodada e a faixa de poderes sugerida para o papel (Solo e Lacaio: 1–2, 2–4, 3–6, 4–8; Especial: 2–3, 4–6, 6–9, 8–12). Sem mudança de patamar, só avisa se a ficha estiver fora da faixa. Os poderes criados pelos templates não entram na conta.
- **Círculos de magia:** com o novo nível de conjurador, avisa o círculo liberado (ou acima do permitido) e quantos a ficha já tem. Tabelas por classe: arcanista, clérigo, druida e "conjurador" liberam o 4º círculo no 13º nível; bardo no 14º; paladino e guardião no 16º.

## Templates

Marque na prévia; os três podem ser combinados. Cada template marcado grava um marcador no ator com o estado original, e os itens que cria levam uma flag do módulo. Reaplicar não duplica nada, e desmarcar devolve a ficha ao que era. Com template, o nome da cópia leva só a tag ("Nome (Chefe Final)").

| Template | O que faz |
|---|---|
| Chefe Final | PV ×2; PM + 2×ND (só quem já tem PM); RD mínima por patamar (Veterano 5, Campeão 10, Lenda 20, gravada em `tracos.resistencias.dano.base` e no texto de resistências); poder **Maior que a Morte**. XP de ND + 2 (nota na prévia). |
| Bando | O grupo é tratado como uma criatura de **ND maior**: o ND efetivo sobe pelo aumento da escala de indivíduos (10-20 e 20-40: +2; 50-70: +4; 80-100: +6; editável) e PV, ataque, defesa, CD e resistências vêm da linha desse ND (a ficha mostra o ND do bando; o ND de destino do diálogo é o da criatura individual). O tamanho sobe 1, 2, 3 ou 4 categorias conforme a escala (até Colossal). O dano dos golpes é multiplicado (×2, ×4 ou ×6, conforme os patamares que o ND subiu) e escrito como `(fórmula) * N`; cada golpe é balanceado contra o dano da tabela dividido pelo multiplicador. Cria os poderes Dano Esmagador, Dano Inescapável e Ataques Adicionais contra o Bando e acrescenta as imunidades (texto e `tracos.ic.custom`). |
| Enxame | Remove as armas da ficha (a aba Estatísticas lista toda arma, mesmo com 0 ataques; o módulo guarda as armas inteiras e as recria, com o dano recalculado, ao desmarcar); cria o poder **Enxame** (dano automático com a média do dano do ND) e os poderes Movimentação Tática, Resistência a Armas, Vulnerabilidade a Área e Interações Mágicas; esvazia a linha de Corpo a Corpo (o poder Enxame já descreve o ataque); acrescenta as imunidades ao texto de resistências e a `tracos.ic.custom`. |

## Mensagem no chat

Na primeira vez que o módulo roda num mundo, o Mestre recebe (por sussurro) uma mensagem com o resumo da ferramenta. Quando a versão sobe e há novidades, recebe só as novidades daquela versão.

A prévia é calculada num clone da ficha; o **Aplicar** grava uma vez. Por padrão o módulo cria uma cópia e deixa o original intacto.

## Compatibilidade

Foundry VTT v13 (testado com 13.351) e sistema Tormenta20 1.5.x.

## Instalação manual

Copie esta pasta para `Data/modules/tormenta20-ajuste-nd` e ative o módulo no mundo.

## Desenvolvimento

```bash
npm test                # testes em Node, sem o Foundry
npm run gerar-tables    # regenera data/tables.json a partir do data.js da calculadora de parâmetros
```

As regras de cálculo ficam em `scripts/dano.js`, `scripts/calculo.js`, `scripts/ajuste.js`, `scripts/textos.js`, `scripts/circulos.js`, `scripts/patamares.js`, `scripts/templates.js` e `scripts/boas-vindas.js`, sem dependência do Foundry. `scripts/aplicar.js`, `scripts/dialogo.js` e `scripts/main.js` fazem a ponte com o Foundry.

Os testes usam fichas reais exportadas do Foundry em `tests/fixtures/`. Elas não fazem parte do repositório (texto do compendium com direitos autorais). Para rodar os testes, exporte as ameaças (Goblin Salteador, Recruta Supremacista, Anão Veterano, Aparição, Troll, Glop de Sangue, Golem de Ferro, Sacerdote da Tormenta, Hidra, Vampiro e Dragão Venerável) como JSON e coloque nessa pasta.
