const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createApp}=require('../server.cjs');
test('troca de senha exige autenticação, revoga todas as sessões e persiste',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'vft-password-')),dbPath=path.join(dir,'db.sqlite');let server,base;
 const start=async()=>{server=createApp({dbPath});await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port;};
 const call=async(route,data,s={})=>{const r=await fetch(base+'/api/'+route,{method:data?'POST':'GET',headers:{...(data?{'Content-Type':'application/json','X-CSRF-Token':s.csrf||''}:{}),Cookie:s.cookie||''},body:data?JSON.stringify(data):undefined});return {status:r.status,body:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};};
 const session=r=>({cookie:r.cookie,csrf:r.body.csrf});
 try{
 await start();const password='Original-pass-123',newPassword='Updated-pass-456';
 const a=session(await call('register',{company:'A',email:'a@example.test',password}));
 const a2=session(await call('login',{email:'a@example.test',password}));
 const b=session(await call('register',{company:'B',email:'b@example.test',password}));
 const payload={currentPassword:password,newPassword,confirmPassword:newPassword,email:'b@example.test'};
 assert.equal((await call('password',payload)).status,401);
 assert.equal((await call('password',payload,{cookie:a.cookie})).status,403);
 assert.equal((await call('password',{...payload,currentPassword:'Wrong-pass-123'},a)).status,400);
 assert.equal((await call('password',{...payload,confirmPassword:'mismatch'},a)).status,400);
 assert.equal((await call('password',{...payload,newPassword:password,confirmPassword:password},a)).status,400);
 assert.equal((await call('password',{...payload,newPassword:'short',confirmPassword:'short'},a)).status,400);
 assert.equal((await call('me',null,a)).status,200);
 assert.equal((await call('password',payload,a)).status,200);
 assert.equal((await call('me',null,a)).status,401);assert.equal((await call('me',null,a2)).status,401);
 assert.equal((await call('me',null,b)).status,200);
 assert.equal((await call('login',{email:'a@example.test',password})).status,401);
 await new Promise(r=>server.close(r));await start();
 const changed=await call('login',{email:'a@example.test',password:newPassword});assert.equal(changed.status,200);
 const events=(await call('audit',null,session(changed))).body.events;
 assert.ok(events.some(e=>e.action==='user.password_changed'));
 assert.ok(!JSON.stringify(events).includes(password));assert.ok(!JSON.stringify(events).includes(newPassword));
 const created=await call('users',{email:'op@example.test',password,role:'operator'},session(changed));assert.equal(created.status,201);
 const op=session(await call('login',{email:'op@example.test',password}));
 assert.equal((await call('password',payload,op)).status,200);
 const opNew=await call('login',{email:'op@example.test',password:newPassword});assert.equal(opNew.body.user.role,'operator');
 }finally{if(server?.listening)await new Promise(r=>server.close(r));fs.rmSync(dir,{recursive:true,force:true});}
});
