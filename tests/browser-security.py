"""Security regressions against a running demo; uses fake customer data."""
import json
import os
import re
import uuid
from pathlib import Path
from urllib.parse import parse_qs, urlsplit
from playwright.sync_api import expect, sync_playwright

base = os.environ.get('ANADO_TEST_URL', 'http://127.0.0.1:3000').rstrip('/')
report = {'checks': [], 'errors': [], 'cspErrors': []}

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox', '--disable-dev-shm-usage'])
    context = browser.new_context(viewport={'width': 390, 'height': 844}, reduced_motion='reduce')
    page = context.new_page()
    page.on('pageerror', lambda error: report['errors'].append(str(error)))
    page.on('console', lambda message: report['cspErrors'].append(message.text) if message.type == 'error' and 'Content Security Policy' in message.text else None)
    response = page.goto(base, wait_until='networkidle')
    expect(page.locator('.faq-section h2')).to_have_text('Ответы на ваши вопросы')
    expect(page.locator('.faq-list details')).to_have_count(3)
    assert 'Можно ли связать магазин' not in page.locator('.faq-list').inner_text()
    report['checks'].append('FAQ spacing at 390px and removed 1C question')

    csp = response.headers['content-security-policy']
    nonce = re.search(r"'nonce-([^']+)'", csp).group(1)
    assert "'strict-dynamic'" in csp and "'unsafe-eval'" not in csp
    # Next can load additional chunks from a trusted script under strict-dynamic.
    # Server-rendered scripts and every inline script must still carry the nonce.
    initial_scripts=re.findall(r'<script\b[^>]*>',response.text())
    assert initial_scripts and all(('nonce="'+nonce+'"') in tag for tag in initial_scripts)
    assert page.locator('script:not([src])').evaluate_all('(scripts, nonce) => scripts.every(s => s.nonce === nonce)', nonce)
    assert nonce not in context.request.get(base).headers['content-security-policy']
    for header, value in {'referrer-policy': 'no-referrer', 'x-content-type-options': 'nosniff', 'x-frame-options': 'DENY'}.items():
        assert response.headers[header] == value
    assert response.headers['strict-transport-security'].startswith('max-age=')
    assert not report['cspErrors'], report['cspErrors']
    # Inject into parsed HTML: DevTools evaluate runs with different CSP privileges.
    injection_page = context.new_page()
    violations = []
    injection_page.on('console', lambda message: violations.append(message.text) if message.type == 'error' and 'Content Security Policy' in message.text else None)
    def inject_markup(route):
        original = route.fetch()
        body = original.text().replace('</body>', '<script>window.__anadoInjected = true</script></body>')
        route.fulfill(response=original, body=body)
    injection_page.route(base + '/', inject_markup)
    injection_page.goto(base, wait_until='networkidle')
    assert injection_page.evaluate('window.__anadoInjected === undefined')
    assert violations, 'Expected CSP to block the injected script'
    injection_page.close()
    report['checks'].append('Unique nonces, hydration, blocked injected script and security headers')

    page.evaluate("localStorage.setItem('anado-cart-v1', '{\"unexpected\":true}')")
    page.goto(base + '/cart', wait_until='networkidle')
    expect(page.locator('.cart-row')).to_have_count(0)
    items = [{'offerId': '12118', 'productId': 'ee4274ae23a0e67a', 'name': '<img src=x onerror=alert(1)>', 'variant': 'Test', 'image': 'https://evil.invalid/image.png', 'price': 1, 'quantity': 1}]
    page.evaluate('(items) => localStorage.setItem("anado-cart-v1", JSON.stringify(items))', items)
    page.reload(wait_until='networkidle')
    expect(page.locator('.cart-row')).to_have_count(1)
    assert '<img src=x' in page.locator('.cart-row').inner_text()
    assert page.locator('img[src*="evil.invalid"], .cart-row img[src="x"]').count() == 0
    report['checks'].append('Malformed cart recovery, escaped text and rejected remote cart image')

    created_account=context.request.post(base+'/api/auth/register', data={'name':'Security test','email':'security-'+uuid.uuid4().hex+'@example.invalid','password':'Test-security-password-123!','consent':True}, headers={'Origin':base})
    assert created_account.status==200, created_account.text()
    # Use a real catalog item for checkout after testing an intentionally malformed cart.
    page.evaluate("localStorage.removeItem('anado-cart-v1')")
    page.goto(base + '/product/ee4274ae23a0e67a', wait_until='networkidle')
    page.get_by_role('button', name='В корзину', exact=True).click()
    expect(page.get_by_role('status')).to_contain_text('Товар добавлен')
    page.goto(base + '/checkout', wait_until='networkidle')
    expect(page.locator('.demo-notice')).to_be_visible()

    api = context.request
    payload = {'idempotency': uuid.uuid4().hex, 'paymentMethod': 'sbp', 'customer': {'name': 'Security test', 'phone': '+79990000000', 'email': 'security@example.invalid', 'delivery': 'pickup', 'consent': True}, 'items': [{'offerId': '12118', 'quantity': 1}]}
    created = api.post(base + '/api/orders', data=payload, headers={'Origin': base})
    assert created.status == 201, created.text()
    data = created.json()
    order_path = '/api/orders/' + data['order']['id']
    token = parse_qs(urlsplit(data['url']).fragment)['token'][0]
    assert not urlsplit(data['url']).query
    assert api.get(base + order_path).status == 200
    outsider=browser.new_context().request
    assert outsider.get(base + order_path).status == 404
    assert outsider.get(base + order_path + '?token=' + token).status == 404
    assert outsider.get(base + order_path, headers={'Authorization':'Bearer '+token}).status == 404
    authorized = api.get(base + order_path, headers={'Authorization': 'Bearer ' + token})
    assert authorized.status == 200 and authorized.headers['cache-control'] == 'no-store'
    order_requests = []
    page.on('request', lambda request: order_requests.append(urlsplit(request.url)) if '/api/orders/' in request.url else None)
    page.goto(base + data['url'], wait_until='networkidle')
    expect(page.locator('.order-status h1')).to_have_text('Заказ готов к оплате')
    assert order_requests and all(not request.query for request in order_requests)
    page.goto(base + '/order/' + data['order']['id'] + '?token=' + token, wait_until='networkidle')
    expect(page.locator('.order-status h1')).to_have_text('Заказ готов к оплате')
    assert not urlsplit(page.url).query and urlsplit(page.url).fragment
    assert all(not request.query for request in order_requests)
    report['checks'].append('Order privacy, fragment link, owner session required for new orders, no caching and legacy migration')

    assert api.get(base + '/_next/image', params={'url': '/api/health', 'w': '64', 'q': '75'}).status == 400
    assert api.post(base + '/api/orders', data=payload, headers={'Origin': 'https://evil.invalid'}).status == 403
    assert api.post(base + '/api/payments/yookassa/webhook', data={'type': 'notification', 'event': 'payment.succeeded', 'object': {'id': str(uuid.uuid4())}}).json() == {'ok': True, 'ignored': True}
    report['checks'].append('Rejected optimizer API fetch, cross-origin write and unknown webhook')
    assert not report['errors'], report['errors']
    assert not report['cspErrors'], report['cspErrors']
    browser.close()

out = Path('test-results')
out.mkdir(exist_ok=True)
(out / 'browser-security-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
print(json.dumps(report, ensure_ascii=False, indent=2))
