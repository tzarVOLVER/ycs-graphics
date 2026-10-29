"""Package SPX graphics with their relative dependencies."""
import argparse
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'graphics' / 'ticker'


def package(graphic='ticker'):
    if graphic == 'lower-third':
        output = ROOT / 'dist' / 'YCS-SPX-Lower-Third.zip'
        files = sorted(path for path in (ROOT / 'graphics/lower-third').iterdir()
                       if path.suffix in ['.html', '.css', '.js'])
        files += [SOURCE / 'assets' / font for font in ['ApotekComp-Regular.otf', 'Anybody-Bold.otf']]
    else:
        output = ROOT / 'dist' / 'YCS-SPX-Tickers.zip'
        files = [SOURCE / 'ticker.html'] + [SOURCE / f'YCS-Ticker-{index}.html' for index in range(1, 4)]
        files += [SOURCE / 'ticker.css', SOURCE / 'adapters' / 'spx.js']
        for folder in ['assets', 'src', 'data']:
            files += sorted(path for path in (SOURCE / folder).rglob('*') if path.is_file())
    files += sorted((ROOT / 'graphics/shared').glob('*.js'))
    if any(not path.is_file() for path in files):
        raise FileNotFoundError('The SPX template files are incomplete')
    output.parent.mkdir(parents=True, exist_ok=True)
    with ZipFile(output, 'w', compression=ZIP_DEFLATED) as archive:
        for path in files:
            archive.write(path, 'YCS/' + path.relative_to(ROOT / 'graphics').as_posix())
        if graphic == 'lower-third':
            archive.writestr('YCS/lower-third/INSTALL.txt',
                'Extract the entire YCS folder into SPX ASSETS/templates/.\n'
                'Import YCS/lower-third/lower-third.html once and reuse in each rundown.\n'
                'Keep YCS/shared and YCS/ticker/assets beside YCS/lower-third.\n'
                'Use 1920 x 1080 output. The template starts hidden.\n'
                'Choose a layout, edit names/titles and Show checkboxes, then Play/Update.\n'
                'The YCS fork honors ycsPreviewOnEdit=false for draft-only edits.\n'
                'Stock SPX decides its own automatic preview behavior.\n')
        else:
            archive.writestr('YCS/ticker/INSTALL.txt',
            'Extract the YCS folder into SPX ASSETS/templates/.\n'
            'Import ticker.html once; reuse it in each stage rundown with its own data.\n'
            'Use 1920 x 1080 output. Templates start hidden; control with SPX Play/Update/Stop.\n'
            'The YCS fork routes independent stage outputs; ticker uses the ticker slot.\n'
            'Stock SPX installations still need their own layer/output routing.\n'
            'YCS-Ticker-1/2/3.html are retained only for compatibility with older imports.\n'
            'Keep all shared folders beside the HTML files, including YCS/shared.\n')
    print(output)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--graphic', choices=['ticker', 'lower-third'], default='ticker')
    package(parser.parse_args().graphic)
