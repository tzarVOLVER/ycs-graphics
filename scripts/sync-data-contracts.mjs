import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createHash } from 'node:crypto';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const hash = (value) => createHash('sha256').update(value).digest('hex');
const banner =
  '// Generated from ycs-graphics/contracts/data-contract.js. Run npm run contracts:sync.\n';

export async function artifacts() {
  const source = (await readFile(path.join(root, 'contracts/data-contract.js'), 'utf8')).replace(
    /\r\n/g,
    '\n'
  );
  const fixtures = (await readFile(path.join(root, 'contracts/fixtures.json'), 'utf8')).replace(
    /\r\n/g,
    '\n'
  );
  const exports = [...source.matchAll(/^export function (\w+)/gm)].map((match) => match[1]);
  if (!exports.length || /^(?:import |export (?!function ))/m.test(source))
    throw new Error('Contract source must contain named function exports only');
  const body = source.replace(/^export /gm, '');
  const commonjs =
    banner + "'use strict';\n" + body + `\nmodule.exports = { ${exports.join(', ')} };\n`;
  const browser =
    banner +
    "(function (root) {\n'use strict';\n" +
    body +
    `\nroot.YCSDataContract = Object.freeze({ ${exports.join(', ')} });\n})(globalThis);\n`;
  return { source, fixtures, esm: banner + source, commonjs, browser };
}

export async function syncContracts({ spxRoot, check = false } = {}) {
  const files = await artifacts();
  const targets = [
    [path.join(root, 'graphics/shared/data-contract.js'), files.esm],
    [
      path.join(root, 'graphics/ticker/src/data-contract.js'),
      "// Shared by the ticker and lower third.\nexport * from '../../shared/data-contract.js';\n"
    ]
  ];
  if (spxRoot) {
    const manifest = {
      version: 1,
      sourceSha256: hash(files.source),
      fixturesSha256: hash(files.fixtures),
      files: {
        'ycs/data-contract.cjs': hash(files.commonjs),
        'ycs/public/data-contract.js': hash(files.browser)
      }
    };
    targets.push(
      [path.join(spxRoot, 'ycs/data-contract.cjs'), files.commonjs],
      [path.join(spxRoot, 'ycs/public/data-contract.js'), files.browser],
      [path.join(spxRoot, 'ycs/contracts/fixtures.json'), files.fixtures],
      [path.join(spxRoot, 'ycs/contracts/manifest.json'), JSON.stringify(manifest, null, 2) + '\n']
    );
  }
  for (const [file, content] of targets) {
    if (check) {
      if ((await readFile(file, 'utf8')).replace(/\r\n/g, '\n') !== content)
        throw new Error('Contract artifact out of date: ' + file);
    } else {
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, content);
    }
  }
  return targets.map(([file]) => file);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const index = process.argv.indexOf('--spx');
  let spxRoot =
    index >= 0 ? path.resolve(process.argv[index + 1]) : path.resolve(root, '../ycs-spx');
  try {
    await access(path.join(spxRoot, 'ycs'));
  } catch {
    if (index >= 0) throw new Error('SPX checkout not found');
    spxRoot = undefined;
  }
  const targets = await syncContracts({ spxRoot, check: process.argv.includes('--check') });
  console.log(
    `${process.argv.includes('--check') ? 'Checked' : 'Generated'} ${targets.length} contract artifacts.`
  );
}
