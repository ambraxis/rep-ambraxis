const {test}=require('node:test'),assert=require('node:assert/strict');
const {DatabaseSync}=require('node:sqlite');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createApp}=require('../server.cjs');
test('migração preserva ativos da versão anterior e pode ser repetida',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'vft-migration-')),dbPath=path.join(dir,'old.sqlite');
 try{
 let db=new DatabaseSync(dbPath);
 db.exec(`CREATE TABLE tenants(id TEXT PRIMARY KEY,name TEXT NOT NULL);
 CREATE TABLE assets(id TEXT NOT NULL,tenant_id TEXT NOT NULL REFERENCES tenants(id),name TEXT NOT NULL,PRIMARY KEY(tenant_id,id));
 INSERT INTO tenants VALUES('company','Empresa legada');INSERT INTO assets VALUES('OLD','company','Veículo legado');PRAGMA user_version=1;`);db.close();
 for(let i=0;i<2;i++){
 const server=createApp({dbPath});await new Promise(r=>server.listen(0,'127.0.0.1',r));await new Promise(r=>server.close(r));
 db=new DatabaseSync(dbPath);const asset=db.prepare('SELECT * FROM assets').get();assert.equal(asset.name,'Veículo legado');assert.equal(asset.active,1);assert.equal(asset.type,'vehicle');assert.equal(asset.plate,'');assert.equal(db.prepare('PRAGMA user_version').get().user_version,6);db.close();
 }
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
