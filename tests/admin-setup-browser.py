"""Isolated local first-admin setup, tested through the demo entrypoint."""
import os, tempfile, subprocess, time, secrets, json
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

base='http://127.0.0.1:3006'
email='owner@example.invalid'
password='Local-test-owner-password-123!'
checks=[]
with tempfile.TemporaryDirectory(prefix='anado-admin-ui-') as directory:
    token=secrets.token_hex(32)
    env={**os.environ,'ANADO_DB':directory+'/db.sqlite','PAYMENT_MODE':'demo','PORT':'3006','ADMIN_SETUP_EMAIL':email,'ADMIN_SETUP_TOKEN':token}
    for key in ['RENDER_EXTERNAL_URL','YOOKASSA_AUTHORIZATION','YOOKASSA_SECRET_KEY','YOOKASSA_SHOP_ID']:
        env.pop(key,None)
    server=subprocess.Popen(['node','scripts/start-store.mjs'],env=env,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    def wait_ready(request):
        for _ in range(100):
            try:
                if request.get(base+'/api/health').ok:return
            except Exception:pass
            time.sleep(.1)
        raise AssertionError('Local test server did not start')
    try:
        with sync_playwright() as p:
            browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
            owner=browser.new_context(viewport={'width':390,'height':844})
            wait_ready(owner.request)
            outsider=browser.new_context()
            headers={'Origin':base}
            assert outsider.request.post(base+'/api/admin/setup',data={'token':token,'password':password},headers=headers).status==401
            credentials={'name':'Другой покупатель','email':'other@example.invalid','password':password,'consent':True}
            assert outsider.request.post(base+'/api/auth/register',data=credentials,headers=headers).status==200
            assert outsider.request.post(base+'/api/admin/setup',data={'token':token,'password':password},headers=headers).status==403
            page=owner.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
            response=page.goto(base+'/admin/setup',wait_until='networkidle')
            assert token not in response.text()
            page.get_by_role('link',name='Войти',exact=True).click()
            page.wait_for_url('**/login?next=admin-setup')
            page.get_by_role('link',name='Создать аккаунт').click()
            page.wait_for_url('**/register?next=admin-setup')
            page.locator('input[name=name]').fill('Владелец магазина')
            page.locator('input[name=email]').fill(email)
            page.locator('input[name=password]').fill(password)
            page.locator('input[name=consent]').check()
            page.get_by_role('button',name='Зарегистрироваться',exact=True).click()
            page.wait_for_url('**/admin/setup')
            expect(page.get_by_text(email,exact=True)).to_be_visible()
            for width in [320,390,1440]:
                page.set_viewport_size({'width':width,'height':900})
                assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),width
            page.set_viewport_size({'width':390,'height':844})
            Path('test-results').mkdir(exist_ok=True)
            page.screenshot(path='test-results/admin-setup-mobile.png',full_page=True)
            assert token not in page.content()
            old_session=next(c['value'] for c in owner.cookies() if c['name']=='anado_session')
            assert owner.request.post(base+'/api/admin/setup',data={'token':'invalid','password':password},headers=headers).status==403
            assert owner.request.post(base+'/api/admin/setup',data={'token':token,'password':'wrong'},headers=headers).status==401
            checks.append('Login/registration return to setup, wrong user/key/password and anonymous claim rejected; token absent from HTML; 320/390/1440 px layouts')
            page.locator('input[name=password]').fill(password)
            page.locator('input[name=token]').fill(token)
            page.get_by_role('button',name='Назначить администратором',exact=True).click()
            page.wait_for_url('**/admin')
            expect(page.locator('h1')).to_have_text('Управление магазином')
            new_session=next(c['value'] for c in owner.cookies() if c['name']=='anado_session')
            assert new_session!=old_session
            assert owner.request.post(base+'/api/admin/import',data={'batchId':'setup-test','offers':[]},headers={**headers,'Cookie':'anado_session='+old_session}).status==401
            assert owner.request.post(base+'/api/admin/import',data={'batchId':'setup-test','offers':[]},headers=headers).status==200
            closed=outsider.new_page();closed.goto(base+'/admin/setup')
            expect(closed.get_by_text('Администратор уже назначен.',exact=False)).to_be_visible()
            assert closed.locator('input[name=token]').count()==0
            assert owner.request.post(base+'/api/admin/setup',data={'token':token,'password':password},headers={**headers,'X-Forwarded-For':'127.0.0.2'}).status==409
            checks.append('Admin access granted, session rotated and previous sessions revoked; completed page and API reject repeat setup')
            # Same persistent database, changed key, fresh process: completion must survive.
            server.terminate();server.wait(timeout=10)
            env['ADMIN_SETUP_TOKEN']=secrets.token_hex(32)
            server=subprocess.Popen(['node','scripts/start-store.mjs'],env=env,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
            wait_ready(owner.request)
            page.goto(base+'/admin/setup');page.wait_for_url('**/admin')
            closed.goto(base+'/admin/setup');expect(closed.get_by_text('Администратор уже назначен.',exact=False)).to_be_visible()
            checks.append('Same database retains completion and admin access after restart and key rotation')
            # A fresh deployment with no setup configuration must remain closed.
            server.terminate();server.wait(timeout=10)
            env['ANADO_DB']=directory+'/disabled.sqlite'
            env.pop('ADMIN_SETUP_EMAIL');env.pop('ADMIN_SETUP_TOKEN')
            server=subprocess.Popen(['node','scripts/start-store.mjs'],env=env,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
            wait_ready(owner.request)
            page.goto(base+'/admin/setup');expect(page.get_by_text('ADMIN_SETUP_EMAIL',exact=True)).to_be_visible()
            assert page.locator('input[name=token]').count()==0
            assert not errors,errors
            browser.close()
            checks.append('Fresh unconfigured deployment only shows configuration instructions; no browser errors')
    finally:
        server.terminate();server.wait(timeout=10)
print(json.dumps({'checks':checks},ensure_ascii=False,indent=2))
