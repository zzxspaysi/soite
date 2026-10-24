"""Offline security checks for the catalog importer; no external requests."""
import asyncio
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace

import httpx
from lxml import html

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'tools'))
from export_anado_catalog import Exporter, safe_external_url, safe_html
from build_catalog_view import catalog_image_path


class ExportSecurity(unittest.TestCase):
    def test_html_removes_active_content_and_unsafe_links(self):
        source = html.fragment_fromstring('''<p onclick="alert(1)">Описание</p>
            <script>alert(1)</script><iframe src="https://evil.invalid"></iframe>
            <svg><a href="javascript:alert(1)">SVG</a></svg>
            <a href="javascript:alert(1)">Документ</a><a href="/manual.pdf">PDF</a>
            <img src="data:text/html,evil" onerror="alert(1)">''', create_parent='div')
        cleaned = html.fromstring(safe_html(source))
        self.assertFalse(cleaned.xpath('.//script|.//iframe|.//svg|.//*[@onclick]|.//*[@onerror]'))
        self.assertFalse(cleaned.xpath('.//a[starts-with(@href,"javascript:")]|.//img[@src]'))
        self.assertEqual(cleaned.xpath('.//a[@href]/@href'), ['https://anado.ru/manual.pdf'])
        self.assertIn('Описание', cleaned.text_content())

    def test_urls_reject_unsafe_schemes_and_credentials(self):
        for value in ['javascript:alert(1)', 'data:text/html,evil', 'https://user:pass@anado.ru/a.pdf', 'https://anado.ru/\nmanual.pdf', 'https://[broken']:
            self.assertIsNone(safe_external_url(value), value)
        self.assertEqual(safe_external_url('/manual.pdf'), 'https://anado.ru/manual.pdf')
        for value in ['https://evil.invalid/photo.jpg', 'images/../../private.png', '../private.png', 'data:image/svg+xml,evil']:
            self.assertIsNone(catalog_image_path(value))
        self.assertEqual(catalog_image_path('images/' + 'a' * 24 + '.jpg'), 'images/' + 'a' * 24 + '.jpg')

    def test_fetch_restricts_redirects_and_external_origins(self):
        async def check():
            with tempfile.TemporaryDirectory(prefix='anado-export-security-') as directory:
                args = SimpleNamespace(cache=Path(directory) / 'cache', output=Path(directory) / 'output', concurrency=1, rate=100000)
                exporter = Exporter(args)
                requests = []

                def response(request):
                    requests.append(str(request.url))
                    if request.url.path == '/valid':
                        return httpx.Response(302, headers={'Location': '/manual.pdf'})
                    if request.url.path == '/redirect':
                        return httpx.Response(302, headers={'Location': 'https://127.0.0.1/private'})
                    return httpx.Response(200, content=b'public document')

                async with httpx.AsyncClient(transport=httpx.MockTransport(response)) as client:
                    exporter.client = client
                    with self.assertRaises(ValueError):
                        await exporter.get('http://127.0.0.1/private')
                    self.assertEqual(requests, [])
                    with self.assertRaisesRegex(ValueError, 'outside ANADO'):
                        await exporter.get('https://anado.ru/redirect')
                    self.assertEqual(len(requests), 1)
                    content, final_url = await exporter.get('https://anado.ru/valid')
                    self.assertEqual(content, b'public document')
                    self.assertEqual(final_url, 'https://anado.ru/manual.pdf')
                    self.assertEqual(exporter.cache.stat().st_mode & 0o777, 0o700)
        asyncio.run(check())


if __name__ == '__main__':
    unittest.main()
