// Gera data/tables.json a partir do TABELAS_ND do data.js da calculadora.
// Uso: npm run gerar-tables [caminho/para/data.js]
import { writeFileSync } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const padrao = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../../../t20parametrosdeameacas/data.js');
const origem = resolve(process.argv[2] ?? padrao);

const { TABELAS_ND } = await import(pathToFileURL(origem).href);
const saida = fileURLToPath(new URL('../data/tables.json', import.meta.url));

writeFileSync(saida, JSON.stringify(TABELAS_ND, null, 2) + '\n');
console.log(`tables.json gerado de ${origem}`);
