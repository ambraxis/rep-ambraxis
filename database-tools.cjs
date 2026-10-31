'use strict';
const fs=require('node:fs'),path=require('node:path');
const {randomUUID}=require('node:crypto');
const {DatabaseSync}=require('node:sqlite');
const DEFAULT_DB=path.join(__dirname,'data','vftrack.sqlite');
function acquireDatabaseLock(dbPath){
 if(dbPath===':memory:')return ()=>{};
 fs.mkdirSync(path.dirname(dbPath),{recursive:true,mode:0o700});
 const lock=dbPath+'.lock',identity=randomUUID();let fd;
 try{fd=fs.openSync(lock,'wx',0o600);}catch(e){if(e.code==='EEXIST')throw Error('Banco em uso ou bloqueio residual. Pare o servidor antes da manutenção. Consulte LEIA-ME.md.');throw e;}
 try{fs.writeFileSync(fd,JSON.stringify({pid:process.pid,identity}));}finally{fs.closeSync(fd);}
 return ()=>{if(fs.existsSync(lock)&&JSON.parse(fs.readFileSync(lock,'utf8')).identity===identity)fs.unlinkSync(lock);};
}
function validateDatabase(file){
 if(!fs.existsSync(file)||!fs.statSync(file).isFile())throw Error('Arquivo de banco não encontrado.');
 const db=new DatabaseSync(file,{readOnly:true});
 try{
 if(db.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')throw Error('Banco corrompido.');
 const schema=db.prepare('PRAGMA user_version').get().user_version;
 if(![4,5,6].includes(schema))throw Error('Backup incompatível: esperado esquema AMBRAXIS 4, 5 ou 6.');
 for(const [table,columns] of Object.entries({tenants:['id','name'],users:['id','tenant_id','email','salt','password','role','active'],sessions:['token','user_id','csrf','expires'],assets:['id','tenant_id','name','plate','type','active'],devices:['id','tenant_id','imei','model','fields','created_at','active'],audit:['id','tenant_id','user_id','action','entity_id','created_at','details'],installations:['id','tenant_id','device_id','user_id','asset_id','model','checks','diagnostics','notes','created_at']})){
 const found=db.prepare('PRAGMA table_info('+table+')').all().map(c=>c.name);
 if(columns.some(c=>!found.includes(c)))throw Error('Estrutura incompatível: '+table);
 }
 if(db.prepare('PRAGMA foreign_key_check').all().length)throw Error('Banco contém vínculos inválidos.');
 if(schema>=5){for(const [table,columns] of Object.entries({gps_tokens:['tenant_id','digest','created_at'],positions:['id','tenant_id','device_id','asset_id','latitude','longitude','speed','ignition','recorded_at','received_at']})){const found=db.prepare('PRAGMA table_info('+table+')').all().map(c=>c.name);if(columns.some(c=>!found.includes(c)))throw Error('Estrutura GPS incompatível: '+table);}}
 if(schema>=6){for(const [table,columns] of Object.entries({geofences:['id','tenant_id','asset_id','name','latitude','longitude','radius','active','created_at'],geofence_state:['zone_id','device_id','inside','recorded_at'],geofence_events:['id','tenant_id','zone_id','device_id','position_id','asset_id','kind','recorded_at','created_at','ack_user','ack_at']})){const found=db.prepare('PRAGMA table_info('+table+')').all().map(c=>c.name);if(columns.some(c=>!found.includes(c)))throw Error('Estrutura de geocerca incompatível: '+table);}}
 return {schema};
 }finally{db.close();}
}
function snapshot(source,destination){
 const target=path.resolve(destination),temporary=target+'.tmp-'+randomUUID();
 if(path.resolve(source)===target)throw Error('Origem e destino devem ser diferentes.');
 if(fs.existsSync(target))throw Error('O arquivo de destino já existe.');
 fs.mkdirSync(path.dirname(target),{recursive:true,mode:0o700});
 try{
 fs.closeSync(fs.openSync(temporary,'wx',0o600));
 const db=new DatabaseSync(source,{readOnly:true});try{db.prepare('VACUUM INTO ?').run(temporary);}finally{db.close();}
 validateDatabase(temporary);
 const copy=new DatabaseSync(temporary);try{copy.exec('DELETE FROM sessions;');if(copy.prepare('PRAGMA user_version').get().user_version>=5)copy.exec('DELETE FROM gps_tokens;');}finally{copy.close();}
 validateDatabase(temporary);
 fs.linkSync(temporary,target);return target;
 }finally{if(fs.existsSync(temporary))fs.unlinkSync(temporary);}
}
function backupDatabase({dbPath=DEFAULT_DB,destination}={}){
 if(!destination)throw Error('Informe o arquivo de destino.');
 const release=acquireDatabaseLock(dbPath);try{validateDatabase(dbPath);return snapshot(dbPath,destination);}finally{release();}
}
function restoreDatabase({dbPath=DEFAULT_DB,source,confirm=false}={}){
 if(!confirm)throw Error('Restauração exige --confirm.');
 if(!source)throw Error('Informe o backup de origem.');
 if(path.resolve(source)===path.resolve(dbPath))throw Error('Origem e destino devem ser diferentes.');
 const release=acquireDatabaseLock(dbPath),temporary=dbPath+'.restore-'+randomUUID();
 try{
 validateDatabase(source);snapshot(source,temporary);
 let rollback=null;
 if(fs.existsSync(dbPath)){
 validateDatabase(dbPath);
 rollback=dbPath+'.before-restore-'+randomUUID()+'.sqlite';snapshot(dbPath,rollback);
 // Fecha e consolida o WAL antigo antes da substituição do arquivo principal.
 const current=new DatabaseSync(dbPath);try{current.exec('PRAGMA wal_checkpoint(TRUNCATE);');}finally{current.close();}
 }
 for(const suffix of ['-wal','-shm'])if(fs.existsSync(dbPath+suffix))fs.unlinkSync(dbPath+suffix);
 fs.renameSync(temporary,dbPath);fs.chmodSync(dbPath,0o600);
 return {dbPath,rollback};
 }finally{if(fs.existsSync(temporary))fs.unlinkSync(temporary);release();}
}
if(require.main===module){
 try{
 const [command,file,...flags]=process.argv.slice(2);
 if(flags.some(f=>f!=='--confirm'))throw Error('Opção desconhecida.');
 if(command==='backup')console.log('Backup criado: '+backupDatabase({destination:file}));
 else if(command==='restore'){const result=restoreDatabase({source:file,confirm:flags.includes('--confirm')});console.log('Banco restaurado. Entre novamente. Cópia anterior: '+(result.rollback||'banco novo'));}
 else if(command==='verify'){validateDatabase(file);console.log('Backup válido; esquema AMBRAXIS compatível.');}
 else throw Error('Use: npm run db:backup -- arquivo.sqlite | npm run db:verify -- arquivo.sqlite | npm run db:restore -- arquivo.sqlite --confirm');
 }catch(e){console.error('Manutenção não concluída: '+e.message);process.exitCode=1;}
}
module.exports={acquireDatabaseLock,validateDatabase,backupDatabase,restoreDatabase};
