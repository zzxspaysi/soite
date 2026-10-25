"""Functional storefront checks. Run against a running app; artifacts stay in test-results/."""
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

base = os.environ.get('ANADO_TEST_URL', 'http://127.0.0.1:3000')
out = Path('test-results')
out.mkdir(exist_ok=True)
report = {'checks': [], 'errors': [], 'failedRequests': []}

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox', '--disable-dev-shm-usage'])
    context = browser.new_context(viewport={'width': 1440, 'height': 1050}, reduced_motion='reduce')
    page = context.new_page()
    page.on('pageerror', lambda e: report['errors'].append(str(e)))
    page.on('response', lambda r: report['failedRequests'].append({'url': r.url, 'status': r.status}) if r.status >= 500 or (r.request.resource_type == 'image' and r.status >= 400) else None)

    assert page.goto(base, wait_until='networkidle').status == 200
    expect(page.locator('h1')).to_have_text('Оборудование для автоматизации бизнеса')
    assert page.locator('.category-tile').count() == 19
    expect(page.locator('.brand img')).to_be_visible()
    assert page.locator('.promo-device img').evaluate_all('(images) => images.every(image => image.complete && image.naturalWidth > 0)'), 'News images failed to load'
    page.screenshot(path=str(out / 'home-desktop.png'))
    report['checks'].append('Homepage, logo and all 19 root categories')

    page.get_by_role('banner').get_by_role('button', name='Каталог', exact=True).click()
    expect(page.locator('.mega-menu')).to_be_visible()
    assert page.locator('.mega-roots button').count() == 19
    page.keyboard.press('Escape')
    expect(page.locator('.mega-menu')).to_have_count(0)
    report['checks'].append('Mega menu and Escape dismissal')

    page.get_by_role('button', name='Поиск по каталогу').click()
    page.get_by_role('textbox', name='Поиск товара').fill('АТОЛ 30Ф')
    page.get_by_role('button', name='Найти', exact=True).click()
    page.wait_for_url('**/catalog?q=**')
    expect(page.locator('h1')).to_contain_text('Поиск: АТОЛ 30Ф')
    expect(page.locator('.product-card').first).to_be_visible()
    report['checks'].append('Cyrillic catalog search')

    assert page.goto(base + '/catalog?category=online-kassy', wait_until='networkidle').status == 200
    expect(page.locator('.product-card')).to_have_count(24)
    assert page.locator('.subcategory-chips .chip').count() == 8
    page.screenshot(path=str(out / 'catalog-desktop.png'))
    page.get_by_role('link', name='Следующая страница').click()
    expect(page.locator('.result-note')).to_contain_text('страница 2')
    report['checks'].append('Category hierarchy, 24 cards per page and pagination')

    assert page.goto(base + '/product/ee4274ae23a0e67a', wait_until='networkidle').status == 200
    expect(page.locator('h1')).to_have_text('АТОЛ 30Ф')
    assert page.locator('#variant option').count() == 7
    page.locator('#variant').select_option('13809')
    expect(page.locator('.product-price')).to_contain_text('38')
    expect(page.locator('.product-meta')).to_contain_text('58197')
    page.locator('#variant').select_option('12118')
    page.get_by_role('button', name='В корзину', exact=True).click()
    expect(page.get_by_role('status')).to_contain_text('Товар добавлен')
    page.screenshot(path=str(out / 'product-desktop.png'))
    report['checks'].append('Real variants, SKUs, price changes and add to cart')

    page.goto(base + '/cart', wait_until='networkidle')
    expect(page.locator('.cart-row')).to_have_count(1)
    page.get_by_role('button', name='Увеличить количество АТОЛ 30Ф').click()
    expect(page.locator('.cart-row-price')).to_contain_text('52')
    page.reload(wait_until='networkidle')
    expect(page.locator('.cart-row .quantity span')).to_have_text('2')
    page.get_by_role('link', name='Оформить заказ').click()
    expect(page.locator('.checkout-layout')).to_be_visible()
    page.locator('input[name=name]').fill('Тестовый покупатель')
    page.locator('input[name=phone]').fill('+79990000000')
    page.locator('input[name=email]').fill('smoke@example.invalid')
    page.locator('input[name=payment]').nth(1).check()
    page.locator('input[name=consent]').check()
    expect(page.get_by_role('button', name='Создать тестовый заказ')).to_be_enabled()
    page.screenshot(path=str(out / 'checkout-desktop.png'), full_page=True)
    page.get_by_role('button', name='Создать тестовый заказ').click()
    page.wait_for_url('**/order/**', timeout=15000)
    expect(page.locator('.order-status h1')).to_have_text('Заказ готов к оплате')
    order_url = page.url
    page.get_by_role('button', name='Проверить тестовую оплату').click()
    expect(page.locator('.order-status h1')).to_have_text('Тестовая оплата прошла')
    expect(page.locator('.order-status p')).to_contain_text('Деньги не списаны')
    page.screenshot(path=str(out / 'order-demo-paid.png'))
    page.reload(wait_until='networkidle')
    expect(page.locator('.order-status h1')).to_have_text('Тестовая оплата прошла')
    page.goto(base + '/cart', wait_until='networkidle')
    expect(page.locator('.cart-row')).to_have_count(0)
    report['checks'].append('Persisted cart, server quote, SBP demo order, demo payment and persisted status')

    request = context.request
    assert request.get(base + '/api/integrations/1c/orders').status == 401
    assert request.get(base + '/api/integrations/1c/inventory').status == 401
    assert request.post(base + '/api/orders', data={}, headers={'Origin':'https://other.invalid'}).status == 403
    assert request.get(base + '/api/orders/AN-unknown?token=guessed').status == 404
    assert request.get(base + '/api/health').json() == {'ok':True,'catalogCards':5756}
    report['checks'].append('Integration auth, order privacy, cross-origin rejection and catalog health')

    for path in ['/solutions','/services','/about','/contacts','/delivery','/privacy']:
        assert page.goto(base + path, wait_until='networkidle').status == 200
        expect(page.locator('h1')).to_be_visible()
    report['checks'].append('All six information pages')

    mobile = browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,reduced_motion='reduce')
    mp = mobile.new_page()
    mp.on('pageerror', lambda e: report['errors'].append(str(e)))
    for path, screenshot in [('/','home-mobile.png'),('/catalog?category=online-kassy','catalog-mobile.png'),('/product/ee4274ae23a0e67a','product-mobile.png'),('/contacts','contacts-mobile.png')]:
        assert mp.goto(base + path, wait_until='networkidle').status == 200
        assert mp.evaluate('document.documentElement.scrollWidth <= innerWidth'), path + ' overflows'
        mp.screenshot(path=str(out / screenshot))
    mp.goto(base, wait_until='networkidle')
    mp.get_by_role('banner').get_by_role('button', name='Каталог', exact=True).click()
    expect(mp.locator('.mega-menu')).to_be_visible()
    mp.locator('.mega-roots button').nth(3).click()
    expect(mp.locator('.mega-children h2')).to_contain_text('СКАНЕРЫ')
    mp.locator('.mega-children .text-link').click()
    expect(mp.locator('h1')).to_contain_text('СКАНЕРЫ')
    report['checks'].append('Mobile 390px: no horizontal overflow, menus and four page layouts')
    animated = browser.new_context(viewport={'width':1440,'height':1000},reduced_motion='no-preference')
    ap = animated.new_page()
    ap.on('pageerror', lambda e: report['errors'].append(str(e)))
    ap.goto(base, wait_until='networkidle')
    for index in [0,4,18]:
        tile = ap.locator('.category-tile').nth(index)
        tile.scroll_into_view_if_needed()
        expect(tile).to_have_css('opacity', '1')
    ap.goto(base + '/catalog', wait_until='networkidle')
    ap.get_by_role('link', name='АНАДО — главная', exact=True).click()
    expect(ap.locator('.category-tile')).to_have_count(19)
    ap.locator('.category-tile').first.scroll_into_view_if_needed()
    expect(ap.locator('.category-tile').first).to_have_css('opacity', '1')
    report['checks'].append('Catalog tiles reveal after streaming, hydration and client navigation with animations enabled')
    assert not report['errors'], report['errors']
    assert not report['failedRequests'], report['failedRequests']
    browser.close()

(out / 'browser-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print(json.dumps(report,ensure_ascii=False,indent=2))
