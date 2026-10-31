const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {DatabaseSync}=require('node:sqlite');
const {createApp}=require('../server.cjs');
const {backupDatabase,restoreDatabase,validateDatabase}=require('../database-tools.cjs');
test('backup validado, restauração, proteção do banco ativo e exclusão de sessões',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'vft-backup-')),dbPath=path.join(dir,'db.sqlite'),destination=path.join(dir,'backup.sqlite');
 try{
 const app=createApp({dbPath});
 assert.throws(()=>backupDatabase({dbPath,destination}),/Banco em uso/);
 assert.throws(()=>createApp({dbPath}),/Banco em uso/);
 app.emit('close');
 let db=new DatabaseSync(dbPath);
 db.exec(`INSERT INTO tenants VALUES('T','Empresa');INSERT INTO users(id,tenant_id,email,salt,password,role) VALUES('U','T','a@example.test','salt','hash','admin');INSERT INTO sessions VALUES('token','U','csrf',9999999999999);INSERT INTO assets(id,tenant_id,name) VALUES('A','T','Veículo original');`);db.close();
 backupDatabase({dbPath,destination});assert.equal(validateDatabase(destination).schema,6);
 db=new DatabaseSync(destination);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM sessions').get().n,0);db.close();
 db=new DatabaseSync(dbPath);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM sessions').get().n,1);db.exec("UPDATE assets SET name='Alterado'");db.close();
 assert.throws(()=>backupDatabase({dbPath,destination}),/já existe/);
 assert.throws(()=>restoreDatabase({dbPath,source:destination}),/--confirm/);
 const corrupt=path.join(dir,'corrupt.sqlite');fs.writeFileSync(corrupt,'invalid');
 assert.throws(()=>restoreDatabase({dbPath,source:corrupt,confirm:true}));
 db=new DatabaseSync(dbPath);assert.equal(db.prepare('SELECT name FROM assets').get().name,'Alterado');db.close();
 const result=restoreDatabase({dbPath,source:destination,confirm:true});assert.ok(fs.existsSync(result.rollback));
 db=new DatabaseSync(dbPath);assert.equal(db.prepare('SELECT name FROM assets').get().name,'Veículo original');assert.equal(db.prepare('SELECT COUNT(*) AS n FROM sessions').get().n,0);db.close();
 db=new DatabaseSync(result.rollback);assert.equal(db.prepare('SELECT name FROM assets').get().name,'Alterado');db.close();
 assert.equal(fs.statSync(destination).mode&0o777,0o600);
 const restored=path.join(dir,'new.sqlite');restoreDatabase({dbPath:restored,source:destination,confirm:true});validateDatabase(restored);
 const incompatible=path.join(dir,'unknown.sqlite');db=new DatabaseSync(incompatible);db.exec('PRAGMA user_version=999');db.close();assert.throws(()=>validateDatabase(incompatible),/incompatível/);
 assert.ok(!fs.existsSync(dbPath+'.lock'));
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
