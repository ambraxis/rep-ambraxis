const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createApp}=require('../server.cjs');const {distanceMeters}=require('../geofences.cjs');
test('geocercas: distância, transições, atraso, persistência, acesso e reconhecimento',async()=>{
 assert.equal(distanceMeters(0,0,0,0),0);assert.ok(Math.abs(distanceMeters(0,0,0,1)-111195)<2);assert.ok(distanceMeters(0,179.9,0,-179.9)<23000);
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ambraxis-zones-')),dbPath=path.join(dir,'db.sqlite');let server,base;
 const start=async()=>{server=createApp({dbPath});await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port;};
 const call=async(route,data,s={},bearer)=>{const r=await fetch(base+'/api/'+route,{method:data?'POST':'GET',headers:{...(data?{'Content-Type':'application/json','X-CSRF-Token':s.csrf||''}:{}),Cookie:s.cookie||'',...(bearer?{Authorization:'Bearer '+bearer}:{})},body:data?JSON.stringify(data):undefined});return {status:r.status,body:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};};
 const session=r=>({csrf:r.body.csrf,cookie:r.cookie});
 try{
 await start();const password='Password-test-123',a=session(await call('register',{company:'A',email:'a@example.test',password})),b=session(await call('register',{company:'B',email:'b@example.test',password}));
 await call('assets',{id:'A1',name:'Veículo'},a);const fields={name:'GPS',asset:'A1',imei:'123456789012345',server:'example.test',port:'5027',transport:'TCP'};
 const device=(await call('devices',{model:'fmc130',fields},a)).body;
 const spec={name:'Base <A>',asset:'A1',latitude:0,longitude:0,radius:1000};
 assert.equal((await call('geofences',spec,{cookie:a.cookie})).status,403);
 assert.equal((await call('geofences',{...spec,radius:0},a)).status,400);assert.equal((await call('geofences',{...spec,latitude:91},a)).status,400);assert.equal((await call('geofences',spec,b)).status,400);
 const zone=await call('geofences',spec,a);assert.equal(zone.status,201);
 const token=(await call('gps/token',{},a)).body.token,t0=Date.now()-120000;
 const send=async(n,outside)=>{const r=await call('gps/ingest',{imei:fields.imei,latitude:0,longitude:outside?.02:0,recordedAt:new Date(t0+n*1000).toISOString()},{},token);assert.equal(r.status,201);};
 const events=async s=>(await call('geofence-events',null,s||a)).body.events;
 await send(0,false);assert.equal((await events()).length,0);
 await send(1,true);await send(2,true);assert.equal((await events()).length,1);assert.equal((await events())[0].kind,'exit');
 await send(.5,false);assert.equal((await events()).length,1);
 await send(3,false);assert.equal((await events())[0].kind,'entry');
 await new Promise(r=>server.close(r));await start();await send(4,true);assert.equal((await events()).length,3);
 await call('users',{email:'op@example.test',password,role:'operator'},a);const op=session(await call('login',{email:'op@example.test',password}));
 assert.equal((await call('geofences',spec,op)).status,403);assert.equal((await call('geofences/status',{id:zone.body.id,active:0},op)).status,403);
 assert.equal((await call('geofences',null,b)).body.geofences.length,0);assert.equal((await events(b)).length,0);
 const event=(await events())[0];assert.equal((await call('geofence-events/ack',{id:event.id},b)).status,404);
 assert.equal((await call('geofence-events/ack',{id:event.id},{cookie:op.cookie})).status,403);
 assert.equal((await call('geofence-events/ack',{id:event.id},op)).status,200);assert.equal((await call('geofence-events/ack',{id:event.id},op)).status,200);assert.ok((await events())[0].ack_at);
 assert.equal((await call('audit',null,a)).body.events.filter(e=>e.action==='geofence.event_acknowledged').length,1);
 assert.equal((await call('geofences/status',{id:zone.body.id,active:0},b)).status,404);
 await call('geofences/status',{id:zone.body.id,active:0},a);await send(5,false);assert.equal((await events()).length,3);
 await call('geofences/status',{id:zone.body.id,active:1},a);await send(6,false);assert.equal((await events()).length,3);await send(7,true);assert.equal((await events()).length,4);
 await call('assets',{id:'A2',name:'Outro ativo'},a);await call('geofences',{...spec,asset:'A2'},a);
 await call('devices/update',{id:device.id,model:'fmc130',fields:{...fields,asset:'A2'}},a);
 await send(8,true);assert.equal((await events()).length,4);await send(9,false);assert.equal((await events()).length,5);assert.equal((await events())[0].asset_id,'A2');
 }finally{if(server?.listening)await new Promise(r=>server.close(r));fs.rmSync(dir,{recursive:true,force:true});}
});
