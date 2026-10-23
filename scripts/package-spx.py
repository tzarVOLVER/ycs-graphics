"""Package the three SPX entry points with their shared runtime and assets."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'graphics' / 'ticker'
OUTPUT = ROOT / 'dist' / 'YCS-SPX-Tickers.zip'


def package():
    files = [SOURCE / f'YCS-Ticker-{index}.html' for index in range(1, 4)]
    files += [SOURCE / 'ticker.css', SOURCE / 'adapters' / 'spx.js']
    for folder in ['assets', 'src', 'data']:
        files += sorted(path for path in (SOURCE / folder).rglob('*') if path.is_file())
    if any(not path.is_file() for path in files):
        raise FileNotFoundError('The SPX template files are incomplete')
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with ZipFile(OUTPUT, 'w', compression=ZIP_DEFLATED) as archive:
        for path in files:
            archive.write(path, 'YCS/ticker/' + path.relative_to(SOURCE).as_posix())
        archive.writestr('YCS/ticker/INSTALL.txt',
            'Extract the YCS folder into SPX ASSETS/templates/.\n'
            'Import YCS-Ticker-1.html, YCS-Ticker-2.html and YCS-Ticker-3.html.\n'
            'Use 1920 x 1080 output. Templates start hidden; control with SPX Play/Update/Stop.\n'
            'Default layers: 7, 8 and 9. Route each layer to its intended output.\n'
            'Keep all shared folders beside the HTML files.\n')
    print(OUTPUT)


if __name__ == '__main__':
    package()
