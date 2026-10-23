"""Prepare a small-file-count GitHub upload for the Render demo (standard library only)."""
from pathlib import Path
import hashlib
import shutil
import tarfile
import tempfile
import zipfile

root = Path(__file__).resolve().parents[1]
bundle = Path(tempfile.mkdtemp(prefix='anado-render-upload-'))
payload = bundle.parent / (bundle.name + '.tar.gz')
included = ['app', 'components', 'lib', 'scripts', 'public', 'catalog/images',
            'data/anado-categories.json', 'data/catalog-demo.sqlite.gz',
            'next.config.ts', 'tsconfig.json', 'next-env.d.ts']
if not (root / 'data/catalog-demo.sqlite.gz').is_file():
    raise SystemExit('Run npm run export:demo first.')
with tarfile.open(payload, 'w:gz', compresslevel=6, dereference=False) as archive:
    for name in included:
        archive.add(root / name, arcname=name)
hashes = []
with payload.open('rb') as source:
    index = 0
    while chunk := source.read(16 * 1024 * 1024):
        name = f'payload-{index:03d}.part'
        (bundle / name).write_bytes(chunk)
        hashes.append(f'{hashlib.sha256(chunk).hexdigest()}  {name}')
        index += 1
(bundle / 'SHA256SUMS').write_text('\n'.join(hashes) + '\n')
for name in ['package.json', 'package-lock.json', 'render.yaml']:
    shutil.copy2(root / name, bundle / name)
dockerfile = (root / 'Dockerfile').read_text()
start = dockerfile.index('COPY app ./app')
end = dockerfile.index('RUN node scripts/prepare-demo.mjs')
dockerfile = dockerfile[:start] + '''COPY payload-*.part SHA256SUMS /tmp/anado-payload/
RUN cd /tmp/anado-payload && sha256sum --check SHA256SUMS && cat payload-*.part | tar -xz -C /app
''' + dockerfile[end:]
(bundle / 'Dockerfile').write_text(dockerfile)
(bundle / 'README.txt').write_text('''ANADO — пакет демонстрации для Render

1. Распакуйте ZIP на компьютере. Не распаковывайте файлы payload-*.part.
2. В своём GitHub-репозитории выберите Add file → Upload files.
   Загрузите ВСЕ файлы из этой папки в корень репозитория и сохраните коммит.
   Загружать сам ZIP в GitHub не нужно. Каждая часть меньше 25 МБ.
3. Войдите на https://render.com/ через GitHub.
4. New → Blueprint → выберите этот репозиторий и ветку с загруженными файлами.
5. Проверьте тариф Free и подтвердите создание сервиса. Если Free не предлагается,
   не выбирайте платный тариф автоматически.
6. Дождитесь успешной сборки. Render покажет публичный HTTPS-адрес сайта.
   Он открывается на компьютере и телефоне, в том числе через мобильный интернет.

Заказы и оплата демонстрационные: реальные деньги не списываются.
При перезапуске бесплатного сервиса тестовые заказы могут исчезнуть.
Каталог восстанавливается автоматически. После простоя сервис может засыпать.
Пароли, платёжные ключи и данные настоящих покупателей в пакет не включены.

Этот пакет ещё не размещён в интернете. Вход в GitHub/Render и создание сервиса
выполняет владелец аккаунта. Доступность бесплатного тарифа и проверки аккаунта
определяет хостинг. Текущие условия: https://render.com/docs/free
''', encoding='utf-8-sig')
output = root.parent / 'anado-render-demo.zip'
with zipfile.ZipFile(output, 'w', compression=zipfile.ZIP_STORED) as archive:
    for file in sorted(bundle.iterdir()):
        archive.write(file, arcname='anado-render-demo/' + file.name)
with zipfile.ZipFile(output) as archive:
    assert archive.testzip() is None
print(f'Upload folder: {bundle}')
print(f'Archive: {output}; {output.stat().st_size:,} bytes; {len(list(bundle.iterdir()))} files')
