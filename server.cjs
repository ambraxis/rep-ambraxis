'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {DatabaseSync}=require('node:sqlite');
const {randomBytes,randomUUID,scrypt:rawScrypt,timingSafeEqual,createHash}=require('node:crypto');
const {promisify}=require('node:util');const scrypt=promisify(rawScrypt);
const {acquireDatabaseLock}=require('./database-tools.cjs');
const {installTelemetrySchema,handleTelemetry}=require('./telemetry.cjs');
const hash=s=>createHash('sha256').update(s).digest('hex');
function createApp({dbPath=path.join(__dirname,'data','vftrack.sqlite'),secureCookie=false}={}){
 const releaseDatabaseLock=acquireDatabaseLock(dbPath);
 let db;try{
 if(dbPath!==':memory:'){fs.mkdirSync(path.dirname(dbPath),{recursive:true,mode:0o700});}
 db=new DatabaseSync(dbPath);if(dbPath!==':memory:')fs.chmodSync(dbPath,0o600);
 db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;
 CREATE TABLE IF NOT EXISTS tenants(id TEXT PRIMARY KEY,name TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL REFERENCES tenants(id),email TEXT UNIQUE NOT NULL,salt TEXT NOT NULL,password TEXT NOT NULL,role TEXT NOT NULL DEFAULT 'admin');
 CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),csrf TEXT NOT NULL,expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS assets(id TEXT NOT NULL,tenant_id TEXT NOT NULL REFERENCES tenants(id),name TEXT NOT NULL,PRIMARY KEY(tenant_id,id));
 CREATE TABLE IF NOT EXISTS devices(id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL REFERENCES tenants(id),imei TEXT NOT NULL,model TEXT NOT NULL,fields TEXT NOT NULL,created_at TEXT NOT NULL,UNIQUE(tenant_id,imei));
 CREATE TABLE IF NOT EXISTS audit(id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL REFERENCES tenants(id),user_id TEXT NOT NULL,action TEXT NOT NULL,entity_id TEXT NOT NULL,created_at TEXT NOT NULL);
`);
 // Migração aditiva preserva os bancos criados nas versões anteriores.
 transactionMigration();
 function transactionMigration(){
 db.exec('BEGIN IMMEDIATE');try{
 for(const [table,column,definition] of [['users','active','INTEGER NOT NULL DEFAULT 1'],['assets','plate',"TEXT NOT NULL DEFAULT ''"],['assets','type',"TEXT NOT NULL DEFAULT 'vehicle'"],['assets','active','INTEGER NOT NULL DEFAULT 1'],['devices','active','INTEGER NOT NULL DEFAULT 1'],['audit','details',"TEXT NOT NULL DEFAULT '{}'" ]]){
 if(!db.prepare('PRAGMA table_info('+table+')').all().some(c=>c.name===column))db.exec('ALTER TABLE '+table+' ADD COLUMN '+column+' '+definition);
 }
 db.exec(`CREATE TABLE IF NOT EXISTS installations(id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL REFERENCES tenants(id),device_id TEXT NOT NULL REFERENCES devices(id),user_id TEXT NOT NULL,asset_id TEXT NOT NULL,model TEXT NOT NULL,checks TEXT NOT NULL,diagnostics TEXT NOT NULL,notes TEXT NOT NULL,created_at TEXT NOT NULL);`);installTelemetrySchema(db);db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}
 }
 const attempts=new Map();
 function audit(user,action,id,details={}){db.prepare('INSERT INTO audit(id,tenant_id,user_id,action,entity_id,created_at,details) VALUES(?,?,?,?,?,?,?)').run(randomUUID(),user.tenant_id,user.id,action,id,new Date().toISOString(),JSON.stringify(details));}
 function transaction(fn){db.exec('BEGIN IMMEDIATE');try{const value=fn();db.exec('COMMIT');return value;}catch(e){db.exec('ROLLBACK');throw e;}}
 function reply(res,status,data){res.writeHead(status,{'Content-Type':'application/json;charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));}
 function fail(status,message){throw Object.assign(new Error(message),{status});}
 async function body(req){let bytes=0,chunks=[];for await(const chunk of req){bytes+=chunk.length;if(bytes>32768)fail(413,'Dados excedem o limite.');chunks.push(chunk);}try{return JSON.parse(Buffer.concat(chunks).toString()||'{}');}catch{fail(400,'JSON inválido.');}}
 const text=(v,max=200)=>typeof v==='string'?v.trim().slice(0,max):'';
 async function handler(req,res){try{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname.startsWith('/api/')){
 if(!['GET','POST'].includes(req.method))return reply(res,405,{error:'Método não permitido.'});
 if(req.method==='POST'){
 if(req.headers['content-type']?.split(';')[0]!=='application/json')fail(415,'Envie JSON.');
 if(req.headers.origin&&req.headers.origin!==`${secureCookie?'https':'http'}://${req.headers.host}`)fail(403,'Origem não permitida.');
 }
 const token=/\bvft_session=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie||'')?.[1];
 const user=token?db.prepare('SELECT u.id,u.tenant_id,u.email,u.role,t.name AS company,s.csrf FROM sessions s JOIN users u ON u.id=s.user_id JOIN tenants t ON t.id=u.tenant_id WHERE u.active=1 AND s.token=? AND s.expires>?').get(hash(token),Date.now()):null;
 if(await handleTelemetry({req,res,url,db,user,body,reply,fail,audit,transaction,attempts}))return;
 if(url.pathname==='/api/health'&&req.method==='GET')return reply(res,200,{status:'ok',mode:'development',gateway:false});
 if(['/api/register','/api/login'].includes(url.pathname)&&req.method==='POST'){
 const ip=req.socket.remoteAddress;const now=Date.now();let rate=attempts.get(ip);if(!rate||rate.until<now){rate={count:0,until:now+900000};attempts.set(ip,rate);}if(++rate.count>20)fail(429,'Muitas tentativas. Aguarde 15 minutos.');
 const b=await body(req),email=text(b.email).toLowerCase(),password=b.password;
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||typeof password!=='string'||password.length<12||password.length>128)fail(400,'Informe e-mail e senha entre 12 e 128 caracteres.');
 let account;
 if(url.pathname==='/api/register'){
 const company=text(b.company);if(!company)fail(400,'Informe a empresa.');
 const salt=randomBytes(16).toString('hex'),derived=(await scrypt(password,salt,64)).toString('hex');
 account={id:randomUUID(),tenant_id:randomUUID(),email,role:'admin',company};
 try{transaction(()=>{db.prepare('INSERT INTO tenants VALUES(?,?)').run(account.tenant_id,company);db.prepare('INSERT INTO users(id,tenant_id,email,salt,password) VALUES(?,?,?,?,?)').run(account.id,account.tenant_id,email,salt,derived);audit(account,'company.created',account.tenant_id);});}catch(e){if(e.code?.startsWith('ERR_SQLITE')&&String(e.message).includes('UNIQUE'))fail(409,'Não foi possível cadastrar este e-mail.');throw e;}
 }else{
 account=db.prepare('SELECT u.*,t.name AS company FROM users u JOIN tenants t ON t.id=u.tenant_id WHERE email=?').get(email);
 const derived=await scrypt(password,account?.salt||'dummy-salt',64);
 if(!account||account.active===0||!timingSafeEqual(derived,Buffer.from(account.password,'hex')))fail(401,'E-mail ou senha inválidos.');
 if(!db.prepare('SELECT id FROM users WHERE id=? AND password=? AND active=1').get(account.id,account.password))fail(401,'E-mail ou senha inválidos.');
 }
 const session=randomBytes(32).toString('hex'),csrf=randomBytes(24).toString('hex');
 db.prepare('DELETE FROM sessions WHERE expires<=?').run(Date.now());
 db.prepare('INSERT INTO sessions VALUES(?,?,?,?)').run(hash(session),account.id,csrf,Date.now()+8*3600000);audit(account,'session.started',account.id);
 res.setHeader('Set-Cookie',`vft_session=${session}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${secureCookie?'; Secure':''}`);
 return reply(res,200,{user:{email:account.email,company:account.company,role:account.role},csrf});
 }
 if(!user)fail(401,'Entre na sua conta.');
 if(req.method==='POST'&&req.headers['x-csrf-token']!==user.csrf)fail(403,'Sessão inválida. Recarregue a página.');
 // Permissões aplicadas também a chamadas diretas à API.
 if(req.method==='POST'&&['/api/assets','/api/assets/update','/api/devices','/api/devices/update'].includes(url.pathname)&&user.role!=='admin')fail(403,'Somente administradores podem alterar cadastros.');
 if(url.pathname==='/api/users'||url.pathname==='/api/users/status'){
 if(user.role!=='admin')fail(403,'Somente administradores podem gerenciar usuários.');
 if(req.method==='GET'&&url.pathname==='/api/users')return reply(res,200,{users:db.prepare('SELECT id,email,role,active FROM users WHERE tenant_id=? ORDER BY email').all(user.tenant_id)});
 if(req.method!=='POST')fail(405,'Método não permitido.');
 const b=await body(req);
 if(url.pathname.endsWith('/status')){
 if(![0,1].includes(b.active))fail(400,'Situação inválida.');
 transaction(()=>{const target=db.prepare('SELECT id,role FROM users WHERE tenant_id=? AND id=?').get(user.tenant_id,text(b.id));if(!target)fail(404,'Usuário não encontrado.');if(target.role!=='operator')fail(400,'Somente operadores podem ser ativados ou inativados nesta etapa.');db.prepare('UPDATE users SET active=? WHERE id=? AND tenant_id=?').run(b.active,target.id,user.tenant_id);db.prepare('DELETE FROM sessions WHERE user_id=?').run(target.id);audit(user,'user.status_changed',target.id,{active:b.active});});
 return reply(res,200,{ok:true});
 }
 const email=text(b.email).toLowerCase(),password=b.password;
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||typeof password!=='string'||password.length<12||password.length>128||b.role!=='operator')fail(400,'Informe e-mail, senha de 12 a 128 caracteres e perfil operador.');
 const id=randomUUID(),salt=randomBytes(16).toString('hex'),derived=(await scrypt(password,salt,64)).toString('hex');
 // Revalida a autorização após a derivação assíncrona da senha.
 if(!db.prepare("SELECT id FROM users WHERE id=? AND tenant_id=? AND role='admin' AND active=1").get(user.id,user.tenant_id))fail(403,'Administrador indisponível.');
 try{transaction(()=>{db.prepare('INSERT INTO users(id,tenant_id,email,salt,password,role,active) VALUES(?,?,?,?,?,?,1)').run(id,user.tenant_id,email,salt,derived,'operator');audit(user,'user.created',id,{role:'operator'});});}catch(e){if(String(e.message).includes('UNIQUE'))fail(409,'Não foi possível cadastrar este e-mail.');throw e;}
 return reply(res,201,{id,email,role:'operator',active:1});
 }
 if(url.pathname==='/api/password'&&req.method==='POST'){
 const key='password:'+user.id,now=Date.now();let rate=attempts.get(key);if(!rate||rate.until<now){rate={count:0,until:now+900000};attempts.set(key,rate);}if(++rate.count>10)fail(429,'Muitas tentativas de alteração. Aguarde 15 minutos.');
 const b=await body(req);
 if(typeof b.currentPassword!=='string'||b.currentPassword.length<12||b.currentPassword.length>128||typeof b.newPassword!=='string'||b.newPassword.length<12||b.newPassword.length>128||b.confirmPassword!==b.newPassword)fail(400,'Informe a senha atual, nova senha de 12 a 128 caracteres e confirmação igual.');
 if(b.currentPassword===b.newPassword)fail(400,'A nova senha deve ser diferente da atual.');
 const account=db.prepare('SELECT salt,password FROM users WHERE id=? AND tenant_id=? AND active=1').get(user.id,user.tenant_id);
 if(!account)fail(401,'Entre novamente na sua conta.');
 const current=await scrypt(b.currentPassword,account.salt,64);
 if(!timingSafeEqual(current,Buffer.from(account.password,'hex')))fail(400,'Senha atual incorreta.');
 const salt=randomBytes(16).toString('hex'),password=(await scrypt(b.newPassword,salt,64)).toString('hex');
 transaction(()=>{
 // Comparação evita sobrescrever uma troca concorrente ou aceitar sessão revogada durante o cálculo.
 if(!db.prepare('SELECT s.token FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.user_id=? AND s.expires>? AND u.active=1').get(hash(token),user.id,Date.now()))fail(401,'Entre novamente na sua conta.');
 const changed=db.prepare('UPDATE users SET salt=?,password=? WHERE id=? AND tenant_id=? AND password=? AND active=1').run(salt,password,user.id,user.tenant_id,account.password);
 if(!changed.changes)fail(409,'A conta foi alterada. Entre novamente antes de tentar.');
 db.prepare('DELETE FROM sessions WHERE user_id=?').run(user.id);audit(user,'user.password_changed',user.id);
 });
 res.setHeader('Set-Cookie',`vft_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secureCookie?'; Secure':''}`);
 return reply(res,200,{ok:true,requiresLogin:true});
 }
 if(url.pathname==='/api/me'&&req.method==='GET')return reply(res,200,{user:{email:user.email,company:user.company,role:user.role},csrf:user.csrf});
 if(url.pathname==='/api/logout'&&req.method==='POST'){db.prepare('DELETE FROM sessions WHERE token=?').run(hash(token));audit(user,'session.ended',user.id);res.setHeader('Set-Cookie','vft_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');return reply(res,200,{ok:true});}
 if(['/api/assets','/api/assets/update'].includes(url.pathname)){
 if(req.method==='GET')return reply(res,200,{assets:db.prepare('SELECT id,name,plate,type,active FROM assets WHERE tenant_id=? ORDER BY name').all(user.tenant_id)});
 const b=await body(req),id=text(b.id,80),name=text(b.name),plate=text(b.plate,20).toUpperCase(),type=b.type===undefined?'vehicle':text(b.type),active=b.active===undefined?1:b.active;
 if(!/^[A-Za-z0-9_-]{1,80}$/.test(id)||!name||!['vehicle','container','equipment'].includes(type)||![0,1].includes(active)|| (plate&&!/^[A-Z]{3}-?(?:[0-9]{4}|[0-9][A-Z][0-9]{2})$/.test(plate)))fail(400,'Verifique ID, nome, tipo, placa brasileira e situação do ativo.');
 const updating=url.pathname.endsWith('/update');
 try{transaction(()=>{
 const previous=db.prepare('SELECT id,name,plate,type,active FROM assets WHERE tenant_id=? AND id=?').get(user.tenant_id,id);
 if(updating){
 if(!previous)fail(404,'Ativo não encontrado.');
 if(!active&&db.prepare(`SELECT id FROM devices WHERE tenant_id=? AND active=1 AND json_extract(fields,'$.asset')=?`).get(user.tenant_id,id))fail(409,'Inative ou transfira os rastreadores ativos antes de inativar o ativo.');
 db.prepare('UPDATE assets SET name=?,plate=?,type=?,active=? WHERE tenant_id=? AND id=?').run(name,plate,type,active,user.tenant_id,id);
 if(previous.active!==active)db.prepare('DELETE FROM geofence_state WHERE zone_id IN (SELECT id FROM geofences WHERE tenant_id=? AND asset_id=?)').run(user.tenant_id,id);
 }else db.prepare('INSERT INTO assets(id,tenant_id,name,plate,type,active) VALUES(?,?,?,?,?,?)').run(id,user.tenant_id,name,plate,type,active);
 audit(user,updating?'asset.updated':'asset.created',id,{before:previous||null,after:{id,name,plate,type,active}});
 });}catch(e){if(String(e.message).includes('UNIQUE'))fail(409,'Ativo já cadastrado.');throw e;}
 return reply(res,updating?200:201,{id,name,plate,type,active});
 }
 if(['/api/devices','/api/devices/update'].includes(url.pathname)){
 if(req.method==='GET')return reply(res,200,{devices:db.prepare('SELECT * FROM devices WHERE tenant_id=? ORDER BY created_at DESC').all(user.tenant_id).map(r=>({id:r.id,model:r.model,fields:JSON.parse(r.fields),createdAt:r.created_at,active:r.active}))});
 const b=await body(req),f=b.fields||{},model=text(b.model,30),fields={};
 for(const k of ['name','asset','imei','server','port','transport','apn','apnUser','serial','iccid','chip','firmware','installer','notes'])fields[k]=text(f[k],k==='notes'?2000:200);
 fields.customer=user.company;
 if(!['fmc130','fmb920','generic'].includes(model)||!fields.name||!/^\d{15}$/.test(fields.imei)||!fields.server||/\s|:\/\//.test(fields.server)||!/^\d+$/.test(fields.port)||+fields.port<1||+fields.port>65535||!['TCP','UDP'].includes(fields.transport))fail(400,'Verifique modelo, nome, IMEI, servidor, porta e transporte.');
 if(!db.prepare('SELECT id FROM assets WHERE tenant_id=? AND id=?').get(user.tenant_id,fields.asset))fail(400,'Cadastre um ativo da sua empresa antes de vinculá-lo.');
 const updating=url.pathname.endsWith('/update'),id=updating?text(b.id):randomUUID(),createdAt=new Date().toISOString(),active=b.active===undefined?1:b.active;
 if(![0,1].includes(active))fail(400,'Situação inválida.');
 const previous=updating?db.prepare('SELECT * FROM devices WHERE tenant_id=? AND id=?').get(user.tenant_id,id):null;
 if(updating&&!previous)fail(404,'Rastreador não encontrado.');
 if(active&&!db.prepare('SELECT id FROM assets WHERE tenant_id=? AND id=? AND active=1').get(user.tenant_id,fields.asset))fail(400,'Selecione um ativo ativo da empresa.');
 try{transaction(()=>{if(updating)db.prepare('UPDATE devices SET imei=?,model=?,fields=?,active=? WHERE tenant_id=? AND id=?').run(fields.imei,model,JSON.stringify(fields),active,user.tenant_id,id);
 else db.prepare('INSERT INTO devices(id,tenant_id,imei,model,fields,created_at,active) VALUES(?,?,?,?,?,?,?)').run(id,user.tenant_id,fields.imei,model,JSON.stringify(fields),createdAt,active);
 if(previous&&(JSON.parse(previous.fields).asset!==fields.asset||previous.active!==active))db.prepare('DELETE FROM geofence_state WHERE device_id=?').run(id);
 audit(user,updating?'device.updated':'device.created',id,{previousAsset:previous?JSON.parse(previous.fields).asset:null,asset:fields.asset,previousActive:previous?.active??null,active});});}catch(e){if(String(e.message).includes('UNIQUE'))fail(409,'IMEI já cadastrado nesta empresa.');throw e;}
 return reply(res,updating?200:201,{id,model,fields,active,createdAt:previous?.created_at||createdAt});
 }
 if(url.pathname==='/api/installations'){
 if(req.method==='GET')return reply(res,200,{installations:db.prepare('SELECT id,device_id,asset_id,model,checks,diagnostics,notes,created_at FROM installations WHERE tenant_id=? ORDER BY rowid DESC').all(user.tenant_id).map(r=>({...r,checks:JSON.parse(r.checks),diagnostics:JSON.parse(r.diagnostics)}))});
 const b=await body(req);
 const device=db.prepare('SELECT id,model,fields FROM devices WHERE tenant_id=? AND id=?').get(user.tenant_id,text(b.deviceId));
 if(!device)fail(404,'Rastreador não encontrado na empresa.');
 const fields=JSON.parse(device.fields);
 if(b.asset!==fields.asset||b.model!==device.model)fail(409,'Salve o cadastro do rastreador antes de registrar o checklist.');
 const checkKeys=['manual','voltage','off','sim','simoff','polarity','mount','consent','pins','tech','insulation','data','roaming','pin','finishManual','finishNetwork','finishReport'];
 const diagKeys=['chip','power','tcp','id','gnss','sensors'];
 if(!b.checks||typeof b.checks!=='object'||Array.isArray(b.checks)||!b.diagnostics||typeof b.diagnostics!=='object'||Array.isArray(b.diagnostics))fail(400,'Informe checklist e diagnóstico válidos.');
 if(Object.entries(b.checks).some(([k,v])=>!checkKeys.includes(k)||typeof v!=='boolean')||Object.keys(b.diagnostics).some(k=>!diagKeys.includes(k))||diagKeys.some(k=>!['Pendente','Aprovado','Falhou','Não aplicável'].includes(b.diagnostics[k])))fail(400,'Checklist ou diagnóstico inválido.');
 if(typeof b.notes!=='string'||b.notes.length>2000)fail(400,'Observações limitadas a 2000 caracteres.');
 const checks=Object.fromEntries(checkKeys.map(k=>[k,b.checks[k]===true])),id=randomUUID(),createdAt=new Date().toISOString();
 transaction(()=>{db.prepare('INSERT INTO installations VALUES(?,?,?,?,?,?,?,?,?,?)').run(id,user.tenant_id,device.id,user.id,fields.asset,device.model,JSON.stringify(checks),JSON.stringify(b.diagnostics),b.notes.trim(),createdAt);audit(user,'installation.recorded',id,{deviceId:device.id,asset:fields.asset});});
 return reply(res,201,{id,createdAt});
 }
 if(url.pathname==='/api/audit'&&req.method==='GET')return reply(res,200,{events:db.prepare('SELECT action,entity_id,created_at,details FROM audit WHERE tenant_id=? ORDER BY rowid DESC LIMIT 100').all(user.tenant_id)});
 return reply(res,404,{error:'Recurso não encontrado.'});
 }
 // Lista explícita impede exposição de banco, código do servidor e arquivos internos.
 const allowed=['index.html','app.js','installation.js','registry.js','documentation.js','backend.js','styles.css'];
 const file=url.pathname==='/'?'index.html':url.pathname.slice(1);if(req.method!=='GET'||!allowed.includes(file)){res.writeHead(404);return res.end('Não encontrado');}
 res.writeHead(200,{'Content-Type':file.endsWith('.css')?'text/css':file.endsWith('.js')?'text/javascript':'text/html;charset=utf-8','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','X-Frame-Options':'DENY','Cache-Control':'no-cache'});res.end(fs.readFileSync(path.join(__dirname,file)));
 }catch(e){reply(res,e.status||500,{error:e.status?e.message:'Não foi possível concluir a operação.'});}}
 const server=http.createServer(handler);server.requestTimeout=15000;server.headersTimeout=10000;
 let databaseClosed=false;const closeDatabase=()=>{if(databaseClosed)return;databaseClosed=true;try{db.close();}finally{releaseDatabaseLock();}};server.on('close',closeDatabase);server.on('error',closeDatabase);return server;
 }catch(e){try{db?.close();}finally{releaseDatabaseLock();}throw e;}
}
if(require.main===module){const port=Number(process.env.PORT||3030),host=process.env.HOST||'127.0.0.1';const app=createApp({secureCookie:process.env.COOKIE_SECURE==='1'});app.listen(port,host,()=>console.log(`AMBRAXIS disponível em http://${host}:${port}`));for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>app.close(()=>process.exit(0)));}
module.exports={createApp};
