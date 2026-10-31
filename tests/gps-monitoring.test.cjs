const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
function context(fetch){let interval;const ctx=vm.createContext({fetch,location:{protocol:'file:'},st:{page:'gps'},setInterval:fn=>{interval=fn;},document:{hidden:false,addEventListener:()=>{}},pages:{installation:()=>''},groups:[[],[],[],[null,[]]],menuIndex:{},ins:{fields:{}},parseHash:()=>{},render:()=>{},renderPage:()=>{}});vm.runInContext(fs.readFileSync(path.join(__dirname,'../backend.js'),'utf8'),ctx);vm.runInContext("backend.user={role:'operator'};backend.csrf='session';",ctx);return {ctx,interval};}
test('consulta GPS atualiza histórico sem sobrescrever sessão encerrada e sinaliza falha',async()=>{
 let resolveResponse,calls=0;
 const {ctx,interval}=context(async()=>{calls++;return new Promise(r=>resolveResponse=r);});
 vm.runInContext("backend.gpsAuto=true;document.hidden=true",ctx);interval();assert.equal(calls,0);
 vm.runInContext("document.hidden=false;st.page='account'",ctx);interval();assert.equal(calls,0);
 vm.runInContext("st.page='gps'",ctx);
 const pending=vm.runInContext('gpsRefreshPositions()',ctx);assert.equal(calls,1);
 await vm.runInContext('gpsRefreshPositions()',ctx);assert.equal(calls,1);
 vm.runInContext("backend.user=null;backend.csrf='';backend.positions=[]",ctx);
 resolveResponse({ok:true,json:async()=>({positions:[{id:'old-session'}]})});await pending;
 assert.equal(vm.runInContext('backend.positions.length',ctx),0);
 let requested=[];
 const success=context(async url=>{requested.push(url);return {ok:true,json:async()=>({positions:[{id:url}]})};});
 vm.runInContext("backend.historyDeviceId='D1'",success.ctx);
 await vm.runInContext('gpsRefreshPositions()',success.ctx);
 assert.equal(requested.length,2);assert.equal(vm.runInContext('backend.positionHistory.length',success.ctx),1);assert.ok(vm.runInContext('backend.gpsUpdatedAt',success.ctx));
 const failure=context(async()=>{throw Error('Sem rede');});
 await vm.runInContext('gpsRefreshPositions()',failure.ctx);
 assert.match(vm.runInContext('backend.error',failure.ctx),/Sem rede/);assert.equal(vm.runInContext('backend.gpsUpdatedAt',failure.ctx),null);
});
