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
| Dano | Fórmula `Nd6+B` por arma, dividindo o dano por rodada da tabela entre os ataques (dano secundário e armas alternativas são tratados). |

Não alteram: PM, atributos, efeitos ativos, magias e poderes (poderes e magias com dano aparecem na lista "Revisar").

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

As regras de cálculo ficam em `scripts/dano.js`, `scripts/calculo.js` e `scripts/ajuste.js`, sem dependência do Foundry. `scripts/aplicar.js`, `scripts/dialogo.js` e `scripts/main.js` fazem a ponte com o Foundry.

Os testes usam fichas reais exportadas do Foundry em `tests/fixtures/`. Elas não fazem parte do repositório (texto do compendium com direitos autorais). Para rodar os testes, exporte as ameaças (Goblin Salteador, Recruta Supremacista, Anão Veterano, Aparição, Troll, Glop de Sangue, Golem de Ferro, Sacerdote da Tormenta, Hidra, Vampiro e Dragão Venerável) como JSON e coloque nessa pasta.
