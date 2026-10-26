// Build a disposable, separate copy of the installed SPX binary for the pilot.
import { cp, mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repository = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const installation = resolve(process.argv[2] || 'C:/SPX1.4.1');
const target = join(repository, '.local/spx-data-link-test');
const assets = join(target, 'ASSETS');
await mkdir(target, { recursive: true });
await cp(join(installation, 'spx-server.exe'), join(target, 'spx-server.exe'), { force: false });
await cp(join(installation, 'locales'), join(target, 'locales'), { recursive: true });
await mkdir(join(target, 'LOG'), { recursive: true });
await mkdir(join(assets, 'ExtraFunctions'), { recursive: true });
await mkdir(join(assets, 'media/images/hd'), { recursive: true });
await mkdir(join(assets, 'json'), { recursive: true });
const templateFolder = join(assets, 'templates/ycs-link-test/ticker');
await mkdir(templateFolder, { recursive: true });
await cp(join(repository, 'graphics/ticker'), templateFolder, { recursive: true });
const pluginFolder = join(assets, 'plugins/ycsDataLinkTest');
await mkdir(pluginFolder, { recursive: true });
await cp(join(repository, 'integrations/spx-data-link/plugin/init.js'), join(pluginFolder, 'init.js'));

const original = await readFile(join(repository, 'graphics/ticker/YCS-Ticker-1.html'), 'utf8');
const pattern = /window\.SPXGCTemplateDefinition = (\{[\s\S]*?\});/;
const definition = JSON.parse(original.match(pattern)[1]);
definition.description = 'Current round — data link test';
definition.webplayout = definition.playlayer = '1';
definition.DataFields.push({
  field: 'f13', ftype: 'hidden', title: 'Data link settings',
  value: JSON.stringify({ v: 1, mode: 'manual', source: 'test.currentRound', manual: definition.DataFields.find(field => field.field === 'f5').value })
});
await writeFile(join(templateFolder, 'YCS-Ticker-Link-Test.html'), original.replace(pattern, `window.SPXGCTemplateDefinition = ${JSON.stringify(definition, null, 2)};`));

const projectFolder = join(target, 'DATAROOT/YCSLinkTest');
await mkdir(join(projectFolder, 'data'), { recursive: true });
async function createOnce(path, value) {
  try { await access(path); } catch { await writeFile(path, JSON.stringify(value, null, 2)); }
}
definition.relpath = '/ycs-link-test/ticker/YCS-Ticker-Link-Test.html';
definition.onair = 'false';
await createOnce(join(projectFolder, 'profile.json'), { templates: [definition], general: { background: '' }, updated: new Date().toISOString() });
await createOnce(join(projectFolder, 'data/CurrentRound.json'), {
  project: 'YCSLinkTest', rundown: 'CurrentRound', updated: new Date().toISOString(),
  templates: [{ ...definition, itemID: 'ycs-link-current-round' }]
});
await createOnce(join(target, 'config.json'), {
  general: {
    username: '', password: '', hostname: 'YCS-LINK-TEST', greeting: 'Isolated data-link test',
    langfile: 'english.json', loglevel: 'warn', launchBrowser: false, apikey: '',
    logfolder: join(target, 'LOG').replaceAll('\\', '/') + '/',
    dataroot: join(target, 'DATAROOT').replaceAll('\\', '/') + '/',
    templatesource: 'spx-ip-address', port: 5657, disableConfigUI: false,
    disableLocalRenderer: false, disableOpenFolderCommand: true,
    disableSeveralControllersWarning: true, hideRendererCursor: false,
    resolution: 'HD', preview: 'selected', renderer: 'normal', autoplayLocalRenderer: false,
    recents: ['YCSLinkTest/CurrentRound']
  },
  casparcg: { servers: [] }, osc: { enable: false, port: 57122 },
  globalExtras: { customscript: '', CustomControls: [] }
});
console.log(`Test SPX directory: ${target}`);
console.log('Test rundown: http://127.0.0.1:5657/gc/YCSLinkTest/CurrentRound');
