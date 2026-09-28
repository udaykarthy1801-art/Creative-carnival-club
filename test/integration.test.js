const {test}=require('node:test');
const assert=require('node:assert/strict');
const {once}=require('node:events');
const {randomBytes}=require('node:crypto');
const path=require('node:path');
require('dotenv').config({path:path.resolve(__dirname,'../.env'),quiet:true});

test('real Express → MySQL registration and admin integration', {skip: !process.env.TEST_DATABASE_NAME}, async t=>{
  assert.equal(process.env.TEST_DATABASE_NAME,'creative_carnival_test','Use the dedicated test database only.');
  process.env.DB_NAME=process.env.TEST_DATABASE_NAME;
  process.env.NODE_ENV='test';process.env.COOKIE_SECURE='false';
  process.env.ADMIN_USERNAME='test-admin';
  const password=randomBytes(20).toString('hex');
  process.env.ADMIN_PASSWORD_HASH=await require('../server/lib/security').hashPassword(password);
  const pool=require('../server/config/db');
  const server=require('../server/createApp')().listen(0,'127.0.0.1');await once(server,'listening');
  const base=`http://127.0.0.1:${server.address().port}`;
  const marker=randomBytes(5).toString('hex');
  const body={fullName:"QA O'Connor <script>alert(1)</script>",mobile:'9876543210',email:`qa-${marker}@example.test`,visitorType:'College Student',college:'QA College',purpose:'Project Exhibition',reference:'QA teacher',message:'=1+1'};
  const call=(route,options={})=>fetch(base+route,{...options,headers:{...(options.body?{'Content-Type':'application/json'}:{}),...options.headers}});
  const submit=data=>call('/api/registrations',{method:'POST',body:JSON.stringify(data)});
  let saved, cookie, csrf, internalId;
  t.after(async()=>{
    await pool.execute("DELETE FROM registrations WHERE email LIKE ?",[`%${marker}%`]);
    if(cookie){await call('/api/admin/session',{method:'DELETE',headers:{Cookie:cookie,'X-CSRF-Token':csrf}}).catch(()=>{});}
    await new Promise(resolve=>server.close(resolve));await pool.end();
  });
  await t.test('health, security headers, assets, and private files',async()=>{
    const health=await call('/api/health');assert.equal(health.status,200);assert.equal((await health.json()).database,'connected');
    const home=await call('/');assert.equal(home.status,200);assert.match(home.headers.get('content-security-policy'),/script-src 'self'/);
    assert.ok(!(await home.text()).includes('onclick='));
    for(const file of ['/css/style.css','/js/app.js','/assets/creative-carnival.jpg','/assets/favicon.svg','/admin.html'])assert.equal((await call(file)).status,200);
    for(const file of ['/.env','/server/config/db.js','/api/admin/registrations','/api/admin/registrations/export.csv'])assert.ok([401,404].includes((await call(file)).status));
  });
  await t.test('valid registration commits and is directly readable from MySQL',async()=>{
    const response=await submit(body);assert.equal(response.status,201);saved=await response.json();
    assert.ok(saved.success);assert.match(saved.registrationId,/^CCMD-2026-\d{6,10}$/);assert.equal(saved.visitor.name,body.fullName);
    const [rows]=await pool.execute('SELECT * FROM registrations WHERE registration_id = ?',[saved.registrationId]);assert.equal(rows.length,1);internalId=rows[0].id;
    assert.equal(rows[0].message,body.message);assert.equal(rows[0].full_name,body.fullName);assert.notEqual(rows[0].lookup_token_hash,saved.lookupToken);
  });
  await t.test('server rejects invalid and duplicate submissions',async()=>{
    for(const changes of [{mobile:'123'},{email:'invalid'},{fullName:' '},{reference:''},{college:''},{visitorType:'admin'},{purpose:'bad'}])assert.equal((await submit({...body,...changes})).status,400);
    assert.equal((await submit(body)).status,409);
    assert.equal((await submit({...body,email:body.email.toUpperCase()})).status,409);
  });
  await t.test('parallel duplicates commit exactly one row; shared contacts are allowed',async()=>{
    const concurrent={...body,email:`race-${marker}@example.test`};
    const responses=await Promise.all([submit(concurrent),submit(concurrent)]);assert.deepEqual(responses.map(r=>r.status).sort(),[201,409]);
    const [[{total}]]=await pool.execute('SELECT COUNT(*) AS total FROM registrations WHERE email = ?',[concurrent.email]);assert.equal(total,1);
    assert.equal((await submit({...body,mobile:'9876543211'})).status,201);
  });
  await t.test('private lookup works; guessed IDs do not disclose data',async()=>{
    assert.equal((await call(`/api/registrations/${saved.registrationId}`)).status,401);
    assert.equal((await call(`/api/registrations/${saved.registrationId}`,{headers:{Authorization:`Bearer ${randomBytes(32).toString('base64url')}`}})).status,404);
    const result=await (await call(`/api/registrations/${saved.registrationId}`,{headers:{Authorization:`Bearer ${saved.lookupToken}`}})).json();
    assert.equal(result.registration.name,body.fullName);assert.ok(!('lookup_token_hash' in result.registration));
    assert.equal((await call('/api/registrations/CCMD-2026-9999999999',{headers:{Authorization:`Bearer ${saved.lookupToken}`}})).status,404);
  });
  await t.test('JSON limits, malformed bodies, and untrusted origins are rejected',async()=>{
    assert.equal((await call('/api/registrations',{method:'POST',body:'{'})).status,400);
    assert.equal((await call('/api/registrations',{method:'POST',body:JSON.stringify({...body,message:'x'.repeat(17000)})})).status,413);
    assert.equal((await call('/api/registrations',{method:'POST',headers:{'Content-Type':'text/plain'},body:'test'})).status,415);
    assert.equal((await call('/api/registrations',{method:'POST',headers:{Origin:'https://untrusted.example'},body:JSON.stringify(body)})).status,403);
  });
  await t.test('admin login, session cookies, search, pagination, and filtered export',async()=>{
    assert.equal((await call('/api/admin/login',{method:'POST',body:JSON.stringify({username:'test-admin',password:'wrong'})})).status,401);
    const login=await call('/api/admin/login',{method:'POST',body:JSON.stringify({username:'test-admin',password})});assert.equal(login.status,200);
    const setCookie=login.headers.get('set-cookie');assert.match(setCookie,/HttpOnly/i);assert.match(setCookie,/SameSite=Strict/i);cookie=setCookie.split(';')[0];csrf=(await login.json()).csrfToken;
    const list=await (await call(`/api/admin/registrations?q=${saved.registrationId}&visitorType=College%20Student&purpose=Project%20Exhibition&limit=1&sort=oldest`,{headers:{Cookie:cookie}})).json();assert.equal(list.total,1);assert.equal(list.registrations[0].id,internalId);
    const escaped=await (await call('/api/admin/registrations?q=%25',{headers:{Cookie:cookie}})).json();assert.equal(escaped.total,0);
    const csv=await call(`/api/admin/registrations/export.csv?q=${saved.registrationId}`,{headers:{Cookie:cookie}});assert.equal(csv.status,200);const csvText=await csv.text();assert.match(csvText,/"'=1\+1"/);assert.ok(!csvText.includes('lookup_token_hash'));
    const detail=await (await call(`/api/admin/registrations/${internalId}`,{headers:{Cookie:cookie}})).json();assert.equal(detail.registration.name,body.fullName);
  });
  await t.test('deletion requires CSRF and logout invalidates the session',async()=>{
    assert.equal((await call(`/api/admin/registrations/${internalId}`,{method:'DELETE',headers:{Cookie:cookie}})).status,403);
    assert.equal((await call(`/api/admin/registrations/${internalId}`,{method:'DELETE',headers:{Cookie:cookie,'X-CSRF-Token':csrf}})).status,200);
    assert.equal((await call(`/api/admin/registrations/${internalId}`,{headers:{Cookie:cookie}})).status,404);
    assert.equal((await call('/api/admin/session',{method:'DELETE',headers:{Cookie:cookie,'X-CSRF-Token':csrf}})).status,200);
    assert.equal((await call('/api/admin/registrations',{headers:{Cookie:cookie}})).status,401);
    cookie=null;
  });
  await t.test('registration endpoint is rate limited',async()=>{
    let last;
    for(let index=0;index<65;index++){last=await submit({});if(last.status===429)break;}
    assert.equal(last.status,429);assert.ok(last.headers.get('retry-after'));
  });
});
