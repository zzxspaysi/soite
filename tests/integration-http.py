"""Isolated local live-mode API contract test; no network calls to 1C or payments."""
import os, tempfile, subprocess, time, json, urllib.request, urllib.error, secrets
with tempfile.TemporaryDirectory(prefix='anado-http-') as directory:
 env={**os.environ,'ANADO_DB':directory+'/db.sqlite','PAYMENT_MODE':'live','LIVE_PAYMENTS_ENABLED':'0','ONE_C_TOKEN':secrets.token_hex(32),'SITE_URL':'https://127.0.0.1:3005','PORT':'3005'}
 for key in ['YOOKASSA_AUTHORIZATION','YOOKASSA_SHOP_ID','YOOKASSA_SECRET_KEY','RENDER_EXTERNAL_URL']:env.pop(key,None)
 server=subprocess.Popen(['node','scripts/start-store.mjs'],env=env,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 base='http://127.0.0.1:3005'
 def request(path,data=None,extra=None):
  headers={'Content-Type':'application/json',**(extra or {})}
  r=urllib.request.Request(base+path,data=json.dumps(data).encode() if data is not None else None,headers=headers)
  try:
   with urllib.request.urlopen(r,timeout=10) as response:return response.status,response.read().decode(),response.headers
  except urllib.error.HTTPError as e:return e.code,e.read().decode(),e.headers
 try:
  for _ in range(100):
   try:
    if request('/api/health')[0]==200:break
   except OSError:pass
   time.sleep(.1)
  else:raise AssertionError('server did not start')
  auth={'Authorization':'Bearer '+env['ONE_C_TOKEN']}
  browser={'Origin':'https://127.0.0.1:3005','X-Forwarded-Proto':'https'}
  code,_,headers=request('/api/auth/register',{'email':'test@example.invalid','name':'Тестовый покупатель','password':'Test-only-password-123!','consent':True},browser);assert code==200
  assert 'Secure' in headers['Set-Cookie'];browser['Cookie']=headers['Set-Cookie'].split(';')[0]
  assert request('/api/integrations/1c/orders')[0]==401
  assert request('/api/integrations/1c/invoices',{})[0]==401
  code,body,_=request('/api/integrations/1c/inventory',{'batchId':'http-1','offers':[{'id':'12118','name':'Тестовая комплектация','productName':'Тестовая касса','priceKopecks':100000,'stock':10,'vatCode':1,'paymentSubject':'commodity'}]},auth);assert code==200,body
  code,body,_=request('/api/orders',{'customer':{'name':'Тестовый покупатель','email':'test@example.invalid','phone':'+79990000000','consent':True},'items':[{'offerId':'12118','quantity':2}],'paymentMethod':'invoice','idempotency':'local-contract-test-001'},browser);assert code==201,body
  order=json.loads(body)['order'];assert order['mode']=='live' and order['total']==200000
  assert len(json.loads(request('/api/integrations/1c/orders',extra=auth)[1])['orders'])==1
  invoice={'orderId':order['id'],'documentId':'invoice-guid','number':'26-TEST-1','issuedAt':'2026-10-25','taxes':[{'label':'Без НДС','amountKopecks':0}],'totalKopecks':order['total']}
  assert request('/api/integrations/1c/invoices',{**invoice,'totalKopecks':100},auth)[0]==409
  assert request('/api/integrations/1c/invoices',invoice,auth)[0]==200
  assert json.loads(request('/api/integrations/1c/invoices',invoice,auth)[1])['duplicate']
  code,body,_=request('/account/invoice/'+order['id'],extra=browser);assert code==200 and '26-TEST-1' in body and 'ОБРАЗЕЦ — НЕ ДЛЯ ОПЛАТЫ' not in body
  ack={'orderId':order['id'],'documentId':'order-guid'}
  assert request('/api/integrations/1c/orders',ack,auth)[0]==200
  assert request('/api/integrations/1c/orders',ack,auth)[0]==200
  assert request('/api/integrations/1c/orders',{**ack,'documentId':'other-guid'},auth)[0]==409
  assert not json.loads(request('/api/integrations/1c/orders',extra=auth)[1])['orders']
  server.terminate();server.wait(timeout=10)
  server=subprocess.Popen(['node','scripts/start-store.mjs'],env=env,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
  for _ in range(100):
   try:
    if request('/api/health')[0]==200:break
   except OSError:pass
   time.sleep(.1)
  assert request('/api/orders/'+order['id'],extra=browser)[0]==200
  assert '26-TEST-1' in request('/account/invoice/'+order['id'],extra=browser)[1]
  print('PASS: live startup, secure cookie, authenticated inventory update, order export, invoice validation/idempotency, GUID acknowledgment, persistence across restart; no external financial calls')
 finally:
  server.terminate();server.wait(timeout=10)
