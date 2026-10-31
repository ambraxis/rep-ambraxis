const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createApp}=require('../server.cjs');const {DatabaseSync}=require('node:sqlite');const {backupDatabase}=require('../database-tools.cjs');
test('GPS: autorização, validação, ordenação temporal, histórico, revogação e backup',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ambraxis-gps-')),dbPath=path.join(dir,'db.sqlite');let server,base;
 const start=async()=>{server=createApp({dbPath});await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port;};
 const call=async(route,data,s={},bearer)=>{const r=await fetch(base+'/api/'+route,{method:data?'POST':'GET',headers:{...(data?{'Content-Type':'application/json','X-CSRF-Token':s.csrf||''}:{}),Cookie:s.cookie||'',...(bearer?{Authorization:'Bearer '+bearer}:{})},body:data?JSON.stringify(data):undefined});return {status:r.status,body:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};};
 const session=r=>({csrf:r.body.csrf,cookie:r.cookie});
 try{
 await start();const a=session(await call('register',{company:'A',email:'a@example.test',password:'Password-test-123'})),b=session(await call('register',{company:'B',email:'b@example.test',password:'Password-test-123'}));
 await call('assets',{id:'A1',name:'Veículo'},a);
 const device=await call('devices',{model:'fmc130',fields:{name:'GPS',asset:'A1',imei:'123456789012345',server:'example.test',port:'5027',transport:'TCP'}},a);assert.equal(device.status,201);
 assert.equal((await call('gps/token',{}, {cookie:a.cookie})).status,403);
 const token=(await call('gps/token',{},a)).body.token;assert.match(token,/^[a-f0-9]{64}$/);
 const foreign=(await call('gps/token',{},b)).body.token;
 const position={imei:'123456789012345',latitude:-3.1,longitude:-60.02,speed:32,ignition:true,recordedAt:new Date(Date.now()-1000).toISOString(),tenant_id:'forged'};
 assert.equal((await call('gps/ingest',position)).status,401);
 assert.equal((await call('gps/ingest',position,{},foreign)).status,404);
 for(const extra of [{latitude:91},{longitude:'-60'},{recordedAt:'2026-02-30T00:00:00.000Z'},{recordedAt:new Date(Date.now()+600000).toISOString()},{speed:-1},{ignition:'true'}])assert.equal((await call('gps/ingest',{...position,...extra},{},token)).status,400);
 assert.equal((await call('gps/ingest',position,{},token)).status,201);
 assert.equal((await call('gps/ingest',position,{},token)).status,409);
 const older={...position,recordedAt:new Date(Date.now()-60000).toISOString()};assert.equal((await call('gps/ingest',older,{},token)).status,201);
 const latest=(await call('positions',null,a)).body.positions;assert.equal(latest.length,1);assert.equal(latest[0].recorded_at,position.recordedAt);assert.equal(latest[0].asset_id,'A1');
 assert.equal((await call('positions',null,b)).body.positions.length,0);
 assert.equal((await call('positions?deviceId='+device.body.id,null,b)).status,404);
 assert.equal((await call('positions?deviceId='+device.body.id,null,a)).body.positions.length,2);
 await call('users',{email:'op@example.test',password:'Password-test-123',role:'operator'},a);
 const op=session(await call('login',{email:'op@example.test',password:'Password-test-123'}));assert.equal((await call('positions',null,op)).status,200);assert.equal((await call('gps/token',{},op)).status,403);assert.equal((await call('gps/token',null,op)).status,403);
 const replacement=(await call('gps/token',{},a)).body.token;assert.equal((await call('gps/ingest',older,{},token)).status,401);
 await call('gps/token/revoke',{},a);assert.equal((await call('gps/ingest',older,{},replacement)).status,401);
 const live=(await call('gps/token',{},a)).body.token;
 await new Promise(r=>server.close(r));await start();assert.equal((await call('positions',null,a)).body.positions[0].recorded_at,position.recordedAt);
 assert.equal((await call('gps/ingest',{...position,recordedAt:new Date().toISOString()},{},live)).status,201);
 await new Promise(r=>server.close(r));backupDatabase({dbPath,destination:path.join(dir,'backup.sqlite')});
 const db=new DatabaseSync(path.join(dir,'backup.sqlite'));assert.equal(db.prepare('SELECT COUNT(*) n FROM gps_tokens').get().n,0);assert.equal(db.prepare('SELECT COUNT(*) n FROM positions').get().n,3);db.close();
 }finally{if(server?.listening)await new Promise(r=>server.close(r));fs.rmSync(dir,{recursive:true,force:true});}
});
