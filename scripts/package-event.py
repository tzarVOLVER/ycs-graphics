"""Capture the current Windows SPX show as a self-contained event deployment."""
import argparse
import hashlib
import json
from pathlib import Path
import secrets
import shutil
import subprocess
import urllib.request
from datetime import datetime, timezone
from zipfile import ZipFile, ZIP_DEFLATED


def build(spx, destination):
    graphics = Path(__file__).resolve().parents[1]
    config_path = spx / '.local/ycs-dev.json'
    config = json.loads(config_path.read_text(encoding='utf-8-sig'))
    dataroot = (spx / config['general']['dataroot']).resolve()
    datafile = (spx / config['ycs'].get('dataFile', '.local/ycs-data.json')).resolve()
    # Capture mutable show files before copying the application, and verify them
    # again at the end. An edit during export must not silently produce a mix.
    snapshots = {config_path: config_path.read_bytes(), datafile: datafile.read_bytes()}
    for stage in config['ycs']['stages']:
        project = dataroot / stage['project']
        for file in project.rglob('*.json'):
            snapshots[file] = file.read_bytes()
    document = json.loads(snapshots[datafile])
    if any(c['type'].startswith('local-') for c in document['connections'].values()):
        raise RuntimeError('Local file connections require explicitly packaging their external files.')
    if destination.exists():
        raise RuntimeError('Use a new output folder; existing event exports are never overwritten.')
    destination.mkdir(parents=True)
    app = destination / 'spx'
    app.mkdir()
    tracked = subprocess.check_output(['git', '-c', f'safe.directory={spx.as_posix()}',
                                       '-C', str(spx), 'ls-files', '-z']).decode().split('\0')
    for relative in filter(None, tracked):
        source = spx / relative
        if source.is_file():
            target = app / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, target)
    # Dereference the development node_modules junction: no dependency on another checkout.
    for folder in ['node_modules', 'ASSETS']:
        shutil.copytree(spx / folder, app / folder, dirs_exist_ok=True)
    shutil.copytree(graphics / 'graphics', app / 'graphics')
    for source, raw in snapshots.items():
        if source in (config_path, datafile):
            continue
        target = app / '.local/DATAROOT' / source.relative_to(dataroot)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(raw)
    local = app / '.local'
    local.mkdir(exist_ok=True)
    (local / 'ycs-data.json').write_bytes(snapshots[datafile])
    cache = datafile.with_name(datafile.stem + '.sheets-cache.json')
    if cache.exists():
        raw = cache.read_bytes()
        json.loads(raw)
        (local / 'ycs-data.sheets-cache.json').write_bytes(raw)
    config['general'].update(hostname='YCS-ORLANDO', dataroot='./.local/DATAROOT/',
                             logfolder='./.local/LOG/', launchBrowser=False,
                             recents=[s['project'] + '/' + s['rundown'] for s in config['ycs']['stages']])
    config['ycs'].update(graphicsRoot='./graphics/ticker', dataFile='./.local/ycs-data.json',
                         localDataRoot='./.local/data-sources', listenHost='0.0.0.0')
    config['ycs'].pop('localDataLocations', None)
    config['ycs']['apiKey'] = config['ycs'].get('apiKey') or secrets.token_urlsafe(32)
    (local / 'ycs-dev.json').write_text(json.dumps(config, indent=2), encoding='utf-8')
    runtime = destination / 'runtime'
    runtime.mkdir()
    node = subprocess.check_output(['node', '-p', 'process.execPath'], text=True).strip()
    shutil.copy2(node, runtime / 'node.exe')
    version = subprocess.check_output([node, '--version'], text=True).strip()
    license_cache = graphics / '.local' / f'node-{version}-LICENSE.txt'
    if not license_cache.exists():
        license_cache.parent.mkdir(parents=True, exist_ok=True)
        license_cache.write_bytes(urllib.request.urlopen(
            f'https://raw.githubusercontent.com/nodejs/node/{version}/LICENSE', timeout=20).read())
    shutil.copy2(license_cache, runtime / 'LICENSE.txt')
    (destination / 'Start Orlando.cmd').write_text(
        '@echo off\r\npowershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0spx\\ycs\\launch.ps1" '
        '-NodePath "%~dp0runtime\\node.exe"\r\nif errorlevel 1 pause\r\n')
    (destination / 'Stop Orlando.cmd').write_text(
        '@echo off\r\npowershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0spx\\ycs\\stop-runtime.ps1"\r\nif errorlevel 1 pause\r\n')
    (destination / 'READ ME.txt').write_text(
        'YCS ORLANDO - Windows x64 event snapshot\n\n'
        'Extract this whole folder to a writable local folder, then double-click Start Orlando.cmd.\n'
        'Node.js and dependencies are included. Program starts stopped. Stop Orlando.cmd shuts down SPX.\n'
        'Do not run the original SPX server on port 5660 at the same time.\n\n'
        'The current projects, item IDs, field values, slots, source links, mappings and cache are included.\n'
        'Source URLs and existing sample/event text are preserved exactly; review content before air.\n'
        'Allow TCP 5660 on the production LAN. The server listens on all interfaces.\n'
        'Use http://SERVER-IP:5660/output/stage-1/program (stage-2 and stage-3 likewise).\n'
        'Preview uses /preview. Use SERVER-IP rather than localhost on remote PCs.\n'
        'Companion: Generic HTTP Requests, GET copied item URL, Authorization header:\n'
        'Bearer <apiKey from spx/.local/ycs-dev.json under ycs>\n'
        'Treat this folder/ZIP as private: it contains production configuration and an API key.\n'
        'Existing controller login policy is preserved. Internet is required for live Google Sheets.\n'
        'Rehearse all three outputs in vMix before use. Freeze this package after validation.\n', encoding='utf-8')
    if any(source.read_bytes() != raw for source, raw in snapshots.items()):
        raise RuntimeError('Show changed during export. Discard this output and export again while edits are paused.')
    manifest = {
        'createdUTC': datetime.now(timezone.utc).isoformat(),
        'spxCommit': subprocess.check_output(['git', '-c', f'safe.directory={spx.as_posix()}', '-C', str(spx), 'rev-parse', 'HEAD'], text=True).strip(),
        'projects': sorted({s['project'] for s in config['ycs']['stages']}),
        'connections': len(document['connections']), 'mappings': len(document['mappings']),
        'files': {str(p.relative_to(destination)).replace('\\', '/'): hashlib.sha256(p.read_bytes()).hexdigest()
                  for p in destination.rglob('*') if p.is_file()}
    }
    (destination / 'manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
    archive = destination.with_suffix('.zip')
    with ZipFile(archive, 'w', ZIP_DEFLATED, compresslevel=6) as output:
        for file in destination.rglob('*'):
            if file.is_file():
                output.write(file, destination.name + '/' + file.relative_to(destination).as_posix())
    print(json.dumps({'archive': str(archive), 'projects': manifest['projects'],
                      'connections': manifest['connections'], 'mappings': manifest['mappings']}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--spx', type=Path, default=Path(__file__).resolve().parents[2] / 'ycs-spx')
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    build(args.spx.resolve(), args.output.resolve())
