'use strict';
const {randomUUID}=require('node:crypto');
function installGeofenceSchema(db){db.exec(`
 CREATE TABLE IF NOT EXISTS geofences(id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL REFERENCES tenants(id),asset_id TEXT NOT NULL,name TEXT NOT NULL,latitude REAL NOT NULL,longitude REAL NOT NULL,radius REAL NOT NULL,active INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL,FOREIGN KEY(tenant_id,asset_id) REFERENCES assets(tenant_id,id));
 CREATE TABLE IF NOT EXISTS geofence_state(zone_id TEXT NOT NULL REFERENCES geofences(id),device_id TEXT NOT NULL REFERENCES devices(id),inside INTEGER NOT NULL,recorded_at TEXT NOT NULL,PRIMARY KEY(zone_id,device_id));
 CREATE TABLE IF NOT EXISTS geofence_events(id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL REFERENCES tenants(id),zone_id TEXT NOT NULL REFERENCES geofences(id),device_id TEXT NOT NULL REFERENCES devices(id),position_id TEXT NOT NULL REFERENCES positions(id),asset_id TEXT NOT NULL,kind TEXT NOT NULL,recorded_at TEXT NOT NULL,created_at TEXT NOT NULL,ack_user TEXT REFERENCES users(id),ack_at TEXT);
 CREATE INDEX IF NOT EXISTS geofence_events_lookup ON geofence_events(tenant_id,created_at DESC);
 PRAGMA user_version=6;`);}
function distanceMeters(a,b,c,d){const rad=v=>v*Math.PI/180,deltaLat=rad(c-a),deltaLon=rad(d-b),h=Math.sin(deltaLat/2)**2+Math.cos(rad(a))*Math.cos(rad(c))*Math.sin(deltaLon/2)**2;return 6371000*2*Math.asin(Math.sqrt(Math.max(0,Math.min(1,h))));}
// Executado na mesma transação que persiste a posição.
function evaluateGeofences(db,p){
 if(db.prepare('SELECT id FROM positions WHERE tenant_id=? AND device_id=? AND recorded_at>? LIMIT 1').get(p.tenant_id,p.device_id,p.recorded_at))return;
 for(const zone of db.prepare('SELECT * FROM geofences WHERE tenant_id=? AND asset_id=? AND active=1').all(p.tenant_id,p.asset_id)){
 const inside=Number(distanceMeters(zone.latitude,zone.longitude,p.latitude,p.longitude)<=zone.radius);
 const previous=db.prepare('SELECT * FROM geofence_state WHERE zone_id=? AND device_id=?').get(zone.id,p.device_id);
 if(previous&&previous.recorded_at>=p.recorded_at)continue;
 if(previous&&previous.inside!==inside)db.prepare('INSERT INTO geofence_events VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(randomUUID(),p.tenant_id,zone.id,p.device_id,p.id,p.asset_id,inside?'entry':'exit',p.recorded_at,new Date().toISOString(),null,null);
 db.prepare('INSERT INTO geofence_state VALUES(?,?,?,?) ON CONFLICT(zone_id,device_id) DO UPDATE SET inside=excluded.inside,recorded_at=excluded.recorded_at').run(zone.id,p.device_id,inside,p.recorded_at);
 }
}
async function handleGeofences({req,res,url,db,user,body,reply,fail,audit,transaction}){
 const route=url.pathname;
 if(!['/api/geofences','/api/geofences/status','/api/geofence-events','/api/geofence-events/ack'].includes(route))return false;
 if(!user)fail(401,'Entre na sua conta.');
 if(req.method==='POST'&&req.headers['x-csrf-token']!==user.csrf)fail(403,'Sessão inválida.');
 if(route==='/api/geofences'&&req.method==='GET'){reply(res,200,{geofences:db.prepare('SELECT * FROM geofences WHERE tenant_id=? ORDER BY created_at DESC').all(user.tenant_id)});return true;}
 if(route==='/api/geofence-events'&&req.method==='GET'){reply(res,200,{events:db.prepare('SELECT e.*,g.name AS zone_name FROM geofence_events e JOIN geofences g ON g.id=e.zone_id WHERE e.tenant_id=? ORDER BY e.rowid DESC LIMIT 100').all(user.tenant_id)});return true;}
 if(req.method!=='POST')fail(405,'Método não permitido.');
 if(route!=='/api/geofence-events/ack'&&user.role!=='admin')fail(403,'Somente administradores gerenciam geocercas.');
 const b=await body(req);if(!b||typeof b!=='object'||Array.isArray(b))fail(400,'Envie um objeto JSON.');
 if(route==='/api/geofence-events/ack'){
 transaction(()=>{const event=db.prepare('SELECT id,ack_at FROM geofence_events WHERE id=? AND tenant_id=?').get(typeof b.id==='string'?b.id:'',user.tenant_id);if(!event)fail(404,'Evento não encontrado.');if(!event.ack_at){db.prepare('UPDATE geofence_events SET ack_user=?,ack_at=? WHERE id=? AND tenant_id=?').run(user.id,new Date().toISOString(),event.id,user.tenant_id);audit(user,'geofence.event_acknowledged',event.id);}});
 reply(res,200,{ok:true});return true;
 }
 if(route==='/api/geofences/status'){
 if(![0,1].includes(b.active))fail(400,'Situação inválida.');
 transaction(()=>{const zone=db.prepare('SELECT id FROM geofences WHERE tenant_id=? AND id=?').get(user.tenant_id,typeof b.id==='string'?b.id:'');if(!zone)fail(404,'Geocerca não encontrada.');db.prepare('UPDATE geofences SET active=? WHERE id=?').run(b.active,zone.id);db.prepare('DELETE FROM geofence_state WHERE zone_id=?').run(zone.id);audit(user,'geofence.status_changed',zone.id,{active:b.active});});
 reply(res,200,{ok:true});return true;
 }
 const numeric=(n,min,max)=>typeof n==='number'&&Number.isFinite(n)&&n>=min&&n<=max;
 if(typeof b.name!=='string'||!b.name.trim()||b.name.length>200||!numeric(b.latitude,-90,90)||!numeric(b.longitude,-180,180)||!numeric(b.radius,50,100000)||typeof b.asset!=='string')fail(400,'Informe nome, ativo, coordenadas válidas e raio de 50 a 100000 metros.');
 if(!db.prepare('SELECT id FROM assets WHERE tenant_id=? AND id=? AND active=1').get(user.tenant_id,b.asset))fail(400,'Selecione um ativo ativo da empresa.');
 const id=randomUUID();transaction(()=>{db.prepare('INSERT INTO geofences VALUES(?,?,?,?,?,?,?,?,?)').run(id,user.tenant_id,b.asset,b.name.trim(),b.latitude,b.longitude,b.radius,1,new Date().toISOString());audit(user,'geofence.created',id,{asset:b.asset});});reply(res,201,{id});return true;
}
module.exports={installGeofenceSchema,evaluateGeofences,handleGeofences,distanceMeters};
