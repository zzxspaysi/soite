"""Check default news autoplay across system motion settings.
Run against a built, running app with ANADO_TEST_URL=http://127.0.0.1:3004.
"""
import json
import os
import re
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

base = os.environ.get('ANADO_TEST_URL', 'http://127.0.0.1:3000')
out = Path('test-results')
out.mkdir(exist_ok=True)
report = {}

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox', '--disable-dev-shm-usage'])
    for preference in ['no-preference', 'reduce']:
        context = browser.new_context(viewport={'width':1440, 'height':1000}, reduced_motion=preference)
        page = context.new_page()
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(base, wait_until='networkidle')
        expect(page.get_by_role('button', name='Приостановить смену слайдов', exact=True)).to_be_visible()
        expect(page.get_by_role('button', name='Включить плавные переходы', exact=True)).to_have_count(0)
        page.evaluate('''() => {
            window.slideStarts = [];
            new MutationObserver(() => {
                if (document.querySelector('.promo-track').classList.contains('is-moving')) window.slideStarts.push(performance.now());
            }).observe(document.querySelector('.promo-track'), {attributes:true, attributeFilter:['class']});
        }''')
        # No click or saved preference is required before the first automatic slide.
        expect(page.locator('.promo-counter')).to_have_text(re.compile('^02'), timeout=7500)
        page.wait_for_timeout(100)
        start = page.locator('.promo-track').evaluate('(e) => ({x:new DOMMatrix(getComputedStyle(e).transform).m41, duration:getComputedStyle(e).transitionDuration})')
        page.wait_for_timeout(200)
        later = page.locator('.promo-track').evaluate('(e) => new DOMMatrix(getComputedStyle(e).transform).m41')
        assert start['duration'] == '1.15s' and abs(later - start['x']) > 20, (start, later)
        expect(page.locator('.promo-counter')).to_have_text(re.compile('^03'), timeout=7500)
        starts = page.evaluate('window.slideStarts')
        interval = round(starts[1] - starts[0])
        assert 6400 < interval < 7000, starts
        if preference == 'reduce':
            page.wait_for_timeout(1250)
            page.get_by_role('button', name='Приостановить смену слайдов', exact=True).click()
            paused = page.locator('.promo-counter').inner_text()
            page.wait_for_timeout(7000)
            assert page.locator('.promo-counter').inner_text() == paused
            page.get_by_role('button', name='Продолжить смену слайдов', exact=True).click()
            expect(page.locator('.promo-counter')).to_have_text(re.compile('^01'), timeout=7500)
        report[preference] = {'autoplay_ms':interval, 'transition':start['duration'], 'moving_pixels':round(abs(later-start['x'])), 'errors':errors}
        assert not errors, errors
        context.close()

    # Saved settings from older releases and blocked storage cannot turn news off.
    for blocked in [False, True]:
        context = browser.new_context(viewport={'width':390, 'height':844}, is_mobile=True, has_touch=True, reduced_motion='reduce')
        if blocked:
            context.add_init_script("Object.defineProperty(window, 'localStorage', {get() {throw new DOMException('Storage disabled', 'SecurityError')}})")
        else:
            context.add_init_script("localStorage.setItem('anado-news-motion', 'off')")
        page = context.new_page()
        page.goto(base, wait_until='networkidle')
        expect(page.locator('.promo-counter')).to_have_text(re.compile('^02'), timeout=7500)
        assert page.locator('.promo-track').evaluate('(e) => getComputedStyle(e).transitionDuration') == '1.15s'
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        report['blocked_storage' if blocked else 'old_saved_preference'] = 'autoplay starts without interaction on mobile'
        context.close()

    context = browser.new_context(viewport={'width':1440, 'height':1000}, reduced_motion='reduce')
    page = context.new_page()
    page.goto(base + '/diagnostics', wait_until='networkidle')
    field = page.get_by_role('textbox', name='Результат проверки')
    expect(field).to_have_value(re.compile('Эффекты новостей: включены автоматически'))
    expect(field).to_have_value(re.compile('Длительность перехода новостей: 1.15s'))
    report['diagnostics'] = 'reports default autoplay and smooth transition with reduced motion'
    browser.close()

(out / 'news-default-autoplay-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
print(json.dumps(report, ensure_ascii=False, indent=2))
