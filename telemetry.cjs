'use strict';
const {randomBytes,randomUUID,createHash}=require('node:crypto');
const {installGeofenceSchema,evaluateGeofences,handleGeofences}=require('./geofences.cjs');
const digest=value=>createHash('sha256').update(value).digest('hex');
function installTelemetrySchema(db){db.exec(`
 CREATE TABLE IF NOT EXISTS gps_tokens(tenant_id TEXT PRIMARY KEY REFERENCES tenants(id),digest TEXT UNIQUE NOT NULL,created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS positions(id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL REFERENCES tenants(id),device_id TEXT NOT NULL REFERENCES devices(id),asset_id TEXT NOT NULL,latitude REAL NOT NULL,longitude REAL NOT NULL,speed REAL,ignition INTEGER,recorded_at TEXT NOT NULL,received_at TEXT NOT NULL,UNIQUE(tenant_id,device_id,recorded_at));
 CREATE INDEX IF NOT EXISTS positions_lookup ON positions(tenant_id,device_id,recorded_at DESC);
 `);installGeofenceSchema(db);}
async function handleTelemetry({req,res,url,db,user,body,reply,fail,audit,transaction,attempts}){
 if(await handleGeofences({req,res,url,db,user,body,reply,fail,audit,transaction}))return true;
 const route=url.pathname;
 if(route==='/api/gps/ingest'){
 if(req.method!=='POST')fail(405,'Use POST para enviar posições.');
 const bearer=/^Bearer ([a-f0-9]{64})$/.exec(req.headers.authorization||'')?.[1];
 const integration=bearer?db.prepare('SELECT tenant_id FROM gps_tokens WHERE digest=?').get(digest(bearer)):null;
 if(!integration)fail(401,'Credencial de integração inválida.');
 const rateKey='gps:'+integration.tenant_id,now=Date.now();let rate=attempts.get(rateKey);
 if(!rate||rate.until<now){rate={count:0,until:now+60000};attempts.set(rateKey,rate);}if(++rate.count>600)fail(429,'Limite de 600 posições por minuto por empresa.');
 const b=await body(req);
 if(!b||typeof b!=='object'||Array.isArray(b))fail(400,'Envie um objeto JSON.');
 const number=(value,min,max)=>typeof value==='number'&&Number.isFinite(value)&&value>=min&&value<=max;
 const time=typeof b.recordedAt==='string'?Date.parse(b.recordedAt):NaN;
 if(typeof b.imei!=='string'||!/^\d{15}$/.test(b.imei)||!number(b.latitude,-90,90)||!number(b.longitude,-180,180)||!Number.isFinite(time)||new Date(time).toISOString()!==b.recordedAt||time>now+300000||(b.speed!==undefined&&!number(b.speed,0,500))||(b.ignition!==undefined&&typeof b.ignition!=='boolean'))fail(400,'Verifique IMEI, coordenadas, horário UTC ISO com milissegundos, velocidade e ignição.');
 const device=db.prepare('SELECT id,fields FROM devices WHERE tenant_id=? AND imei=? AND active=1').get(integration.tenant_id,b.imei);
 if(!device)fail(404,'Rastreador ativo não encontrado na empresa.');
 const asset=JSON.parse(device.fields).asset;
 if(!db.prepare('SELECT id FROM assets WHERE tenant_id=? AND id=? AND active=1').get(integration.tenant_id,asset))fail(409,'O ativo vinculado está inativo.');
 // A credencial pode ter sido revogada enquanto o corpo da requisição era recebido.
 if(!db.prepare('SELECT tenant_id FROM gps_tokens WHERE tenant_id=? AND digest=?').get(integration.tenant_id,digest(bearer)))fail(401,'Credencial revogada.');
 const id=randomUUID(),receivedAt=new Date().toISOString();
 try{transaction(()=>{db.prepare('INSERT INTO positions VALUES(?,?,?,?,?,?,?,?,?,?)').run(id,integration.tenant_id,device.id,asset,b.latitude,b.longitude,b.speed??null,b.ignition===undefined?null:Number(b.ignition),b.recordedAt,receivedAt);evaluateGeofences(db,{id,tenant_id:integration.tenant_id,device_id:device.id,asset_id:asset,latitude:b.latitude,longitude:b.longitude,recorded_at:b.recordedAt});});}catch(e){if(String(e.message).includes('UNIQUE'))fail(409,'Já existe posição deste rastreador no mesmo horário.');throw e;}
 reply(res,201,{id,receivedAt});return true;
 }
 if(!['/api/gps/token','/api/gps/token/revoke','/api/positions'].includes(route))return false;
 if(!user)fail(401,'Entre na sua conta.');
 if(req.method==='POST'&&req.headers['x-csrf-token']!==user.csrf)fail(403,'Sessão inválida. Recarregue a página.');
 if(route.startsWith('/api/gps/token')){
 if(user.role!=='admin')fail(403,'Somente administradores gerenciam a integração GPS.');
 if(route==='/api/gps/token'&&req.method==='GET'){reply(res,200,{configured:!!db.prepare('SELECT tenant_id FROM gps_tokens WHERE tenant_id=?').get(user.tenant_id)});return true;}
 if(req.method!=='POST')fail(405,'Método não permitido.');
 if(route.endsWith('/revoke')){transaction(()=>{db.prepare('DELETE FROM gps_tokens WHERE tenant_id=?').run(user.tenant_id);audit(user,'gps.token_revoked',user.tenant_id);});reply(res,200,{ok:true});return true;}
 const token=randomBytes(32).toString('hex');
 transaction(()=>{db.prepare('INSERT INTO gps_tokens VALUES(?,?,?) ON CONFLICT(tenant_id) DO UPDATE SET digest=excluded.digest,created_at=excluded.created_at').run(user.tenant_id,digest(token),new Date().toISOString());audit(user,'gps.token_rotated',user.tenant_id);});
 reply(res,201,{token});return true;
 }
 if(req.method!=='GET')fail(405,'Use GET para consultar posições.');
 const deviceId=url.searchParams.get('deviceId');
 if(deviceId){
 if(!db.prepare('SELECT id FROM devices WHERE id=? AND tenant_id=?').get(deviceId,user.tenant_id))fail(404,'Rastreador não encontrado.');
 reply(res,200,{positions:db.prepare('SELECT * FROM positions WHERE tenant_id=? AND device_id=? ORDER BY recorded_at DESC LIMIT 100').all(user.tenant_id,deviceId)});
 }else reply(res,200,{positions:db.prepare('SELECT * FROM positions p WHERE p.tenant_id=? AND p.id=(SELECT q.id FROM positions q WHERE q.tenant_id=p.tenant_id AND q.device_id=p.device_id ORDER BY q.recorded_at DESC LIMIT 1) ORDER BY recorded_at DESC').all(user.tenant_id)});
 return true;
}
module.exports={installTelemetrySchema,handleTelemetry};
