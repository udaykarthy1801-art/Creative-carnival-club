const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateRegistration, registrationIdValid, registrationView, visitorTypes, purposes } = require('../server/lib/validation');
const { hashPassword, verifyPassword } = require('../server/lib/security');
const { filters, positiveInteger, csvCell } = require('../server/lib/adminQuery');
const valid = { fullName:'Test Visitor',mobile:'9876543210',email:'test@example.com',visitorType:'College Student',college:'Test College',purpose:'Project Exhibition',reference:'Teacher',message:'' };

test('normalizes trimmed fields and email without changing names or punctuation',()=>{
  const result=validateRegistration({...valid,fullName:"  O'Connor தமிழன்  ",email:' TEST@EXAMPLE.COM '});
  assert.deepEqual(result.errors,{});assert.equal(result.data.fullName,"O'Connor தமிழன்");assert.equal(result.data.email,'test@example.com');
});
test('rejects invalid mobile, email, blank fields, bad types, and overlong text',()=>{
  for(const [key,value] of [['mobile','123'],['mobile','123456789a'],['email','not-an-email'],['fullName','  '],['college',''],['reference',''],['message','x'.repeat(2001)],['visitorType','admin'],['purpose','invalid'],['reference',{}],['fullName','Bob\nSmith']]) assert.ok(validateRegistration({...valid,[key]:value}).errors[key],key);
  assert.ok(validateRegistration([]).errors.form);
});
test('accepts every original option and an omitted optional message',()=>{
  for(const visitorType of visitorTypes)for(const purpose of purposes)assert.deepEqual(validateRegistration({...valid,visitorType,purpose,message:undefined}).errors,{});
});
test('lookup IDs are restricted; database secrets are omitted from views',()=>{
  assert.ok(registrationIdValid('CCMD-2026-000001'));assert.ok(!registrationIdValid("' OR 1=1"));
  const view=registrationView({id:1,registration_id:'CCMD-2026-000001',lookup_token_hash:'secret'});
  assert.ok(!('id' in view));assert.ok(!('lookup_token_hash' in view));
});
test('admin query filters escape wildcard searches and reject injected sorting',()=>{
  const result=filters({q:'a%_!',sort:'oldest'});assert.equal(result.order,'ASC');assert.equal(result.values[0],'%a!%!_!!%');
  assert.throws(()=>filters({sort:'DESC; DROP TABLE registrations'}));assert.throws(()=>filters({visitorType:['College Student']}));
  assert.throws(()=>positiveInteger('0',1,100));assert.throws(()=>positiveInteger('1e2',1,100));assert.equal(positiveInteger('25',1,100),25);
});
test('CSV escapes quotes and neutralizes spreadsheet formulas',()=>{
  assert.equal(csvCell('a"b'),'"a""b"');
  for(const value of ['=1+1','+123','-3','@SUM(A1)','  =HYPERLINK("x")','\tformula']) assert.ok(csvCell(value).startsWith('"\''));
});
test('administrator password is salted and verified using scrypt',async()=>{
  const password='unit-test-password-123';const hash=await hashPassword(password);
  assert.ok(await verifyPassword(password,hash));assert.ok(!await verifyPassword('wrong',hash));assert.notEqual(hash,await hashPassword(password));
});
