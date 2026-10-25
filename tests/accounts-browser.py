"""Local-only account, authorization, invoice and responsive UI checks."""
import os, uuid, json, subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
base=os.environ.get('ANADO_TEST_URL','http://127.0.0.1:3004')
assert base.startswith('http://127.0.0.1:'), 'Run only against an isolated local demo'
out=Path('test-results');out.mkdir(exist_ok=True)
checks=[]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 owner=browser.new_context(viewport={'width':1440,'height':1000})
 other=browser.new_context()
 anonymous=browser.new_context()
 headers={'Origin':base}
 email='account-'+uuid.uuid4().hex+'@example.invalid'
 credentials={'name':'Тестовый пользователь','email':email,'password':'Test-browser-password-123!','consent':True}
 assert owner.request.post(base+'/api/auth/register',data=credentials,headers=headers).status==200
 assert other.request.post(base+'/api/auth/register',data={**credentials,'email':'second-'+email},headers=headers).status==200
 cookie=next(c for c in owner.cookies() if c['name']=='anado_session');assert cookie['httpOnly'] and cookie['sameSite']=='Lax'
 data={'items':[{'offerId':'12118','quantity':2}],'customer':{'name':'Тестовый покупатель','email':email,'phone':'+79990000000','buyerType':'business','company':'ООО Тест','inn':'5402500210','kpp':'540601001','legalAddress':'Новосибирск, Тестовая улица, 1','consent':True},'paymentMethod':'bank_card','idempotency':uuid.uuid4().hex}
 assert anonymous.request.post(base+'/api/orders',data=data,headers=headers).status==401
 result=owner.request.post(base+'/api/orders',data=data,headers=headers);assert result.status==201,result.text()
 order=result.json()['order']['id'];token=result.json()['url'].split('#token=')[1]
 assert owner.request.get(base+'/api/orders/'+order).status==200
 for context in [anonymous,other]:
  assert context.request.get(base+'/api/orders/'+order,headers={'Authorization':'Bearer '+token}).status==404
  assert context.request.post(base+'/api/orders/'+order+'/demo',headers={**headers,'Authorization':'Bearer '+token}).status==404
 blocked=other.new_page();blocked.goto(base+'/account/invoice/'+order);expect(blocked.locator('.invoice-sheet')).to_have_count(0);expect(blocked.locator('h1')).to_contain_text('Страница');blocked.close()
 assert other.request.post(base+'/api/admin/import',data={'batchId':'test','offers':[]},headers=headers).status==403
 assert owner.request.post(base+'/api/orders/'+order+'/demo',headers=headers).status==200
 checks.append('Owner-only order read, demo payment, invoice; anonymous checkout and customer admin imports blocked')
 page=owner.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(base+'/account');expect(page.get_by_role('link',name=order,exact=True)).to_be_visible()
 page.goto(base+'/order/'+order);expect(page.locator('.order-status h1')).to_have_text('Тестовая оплата прошла')
 page.goto(base+'/account/invoice/'+order);expect(page.locator('.invoice-sheet')).to_contain_text('ООО Тест');expect(page.locator('.invoice-sheet')).to_contain_text('ОБРАЗЕЦ — НЕ ДЛЯ ОПЛАТЫ')
 page.pdf(path=str(out/'invoice-example.pdf'),prefer_css_page_size=True)
 page.screenshot(path=str(out/'invoice-desktop.png'),full_page=True)
 checks.append('History, reopening without bearer token and printable invoice populated from order')
 subprocess.run(['node','scripts/promote-admin.mjs',email],check=True,capture_output=True)
 page.goto(base+'/admin');expect(page.locator('h1')).to_have_text('Управление магазином')
 assert owner.request.post(base+'/api/admin/import',data={'batchId':uuid.uuid4().hex,'offers':[]},headers=headers).status==200
 assert owner.request.post(base+'/api/admin/import',data={'batchId':uuid.uuid4().hex,'offers':[{'id':'missing','priceKopecks':100,'stock':1}]},headers=headers).status==400
 checks.append('Promoted admin access and validated catalog import')
 for width in [320,390,768,1440]:
  page.set_viewport_size({'width':width,'height':900})
  for path in ['/register','/account','/admin','/account/invoice/'+order]:
   page.goto(base+path,wait_until='networkidle')
   assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'),(width,path)
  page.goto(base+'/register');page.screenshot(path=str(out/f'register-{width}.png'))
 checks.append('No page overflow at 320/390/768/1440 px')
 page.set_viewport_size({'width':1440,'height':1000});page.goto(base)
 page.locator('.brand-strip').scroll_into_view_if_needed()
 page.locator('.brand-track').evaluate("e=>{e.style.animation='none';e.style.transform='translateX(-1400px)'}")
 page.locator('.brand-strip').screenshot(path=str(out/'brands-tsc.png'))
 assert owner.request.post(base+'/api/auth/logout',headers=headers).status==200
 assert owner.request.get(base+'/api/orders/'+order).status==404
 assert owner.request.post(base+'/api/auth/login',data=credentials,headers=headers).status==200
 assert owner.request.get(base+'/api/orders/'+order).status==200
 assert not errors,errors
 checks.append('Logout revokes access; password login restores own history; no browser errors')
 browser.close()
print(json.dumps({'checks':checks},ensure_ascii=False,indent=2))
