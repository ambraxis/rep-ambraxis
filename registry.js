/* Cadastro local: sem gateway, comandos físicos ou armazenamento de senha APN. */
'use strict';
const REGISTRY_KEY='vftrack.registry.v1';
let registry=[];
let registryError='';
try {
 const saved=JSON.parse(localStorage.getItem(REGISTRY_KEY)||'[]');
 if(!Array.isArray(saved)||saved.some(r=>!r||typeof r.id!=='string'||!INSTALL_MODELS[r.model]||!r.fields||typeof r.fields.imei!=='string'))throw Error('Formato inválido');
 registry=saved.map(r=>({...r,fields:{...r.fields,apnPass:''}}));
} catch(e) {registryError='Não foi possível ler o cadastro local. Os dados existentes não serão sobrescritos.';}
function registryValidate(fields,model,records=registry) {
 if(!INSTALL_MODELS[model])return 'Selecione um modelo válido.';
 if(!fields.customer.trim()||!fields.name.trim())return 'Informe empresa e nome do rastreador.';
 if(!assets.some(a=>a.id===fields.asset))return 'Informe o ID de um ativo existente na frota.';
 if(!/^\d{15}$/.test(fields.imei))return 'Informe um IMEI com exatamente 15 dígitos.';
 if(records.some(r=>r.fields.imei===fields.imei))return 'Este IMEI já está cadastrado neste navegador.';
 if(!fields.server.trim()||/\s|:\/\//.test(fields.server))return 'Informe o servidor sem espaços ou http://.';
 if(!/^\d+$/.test(fields.port)||+fields.port<1||+fields.port>65535)return 'Informe uma porta entre 1 e 65535.';
 if(!['TCP','UDP'].includes(fields.transport))return 'Selecione TCP ou UDP.';
 return '';
}
function registrySave(){
 if(registryError){toast(registryError);return;}
 const fields=Object.fromEntries(Object.entries(ins.fields).map(([k,v])=>[k,String(v).trim()]));
 const error=registryValidate(fields,ins.model);if(error){toast(error);return;}
 fields.apnPass='';
 const record={id:'LOCAL-'+Date.now()+'-'+Math.random().toString(36).slice(2,7),model:ins.model,fields,createdAt:new Date().toISOString()};
 const updated=[...registry,record];
 try{localStorage.setItem(REGISTRY_KEY,JSON.stringify(updated));}catch(e){toast('Não foi possível salvar. Verifique o armazenamento do navegador.');return;}
 registry=updated;ins.reported=true;toast('Rastreador salvo neste navegador. Aguardando integração com gateway.');navigate('registry');
}
function registryPage(){return head('Rastreadores salvos neste navegador','Configurações locais, sem comunicação com equipamentos. A limpeza dos dados do navegador remove estes registros.',linkBtn('Cadastrar rastreador','installation','','primary'))+
 `<div class="notice-banner">${esc(registryError||'Senha APN não é armazenada. Use apenas dados de teste neste protótipo; não há autenticação ou sincronização entre computadores.')}</div>`+
 (registry.length?tb(['Nome / IMEI','Modelo','Empresa','Ativo','Servidor','Situação'],registry.map(r=>row([cell(r.fields.name,'•••••••••••'+r.fields.imei.slice(-4)),esc(INSTALL_MODELS[r.model].name),esc(r.fields.customer),esc(r.fields.asset),esc(r.fields.server+':'+r.fields.port+' / '+r.fields.transport),badge('Não conectado')]))):'<div class="card empty">Nenhum rastreador salvo. Abra o assistente e preencha a identificação e o servidor.</div>');}
groups[0][1].splice(4,0,['registry','Cadastros locais','database']);
menuIndex.registry={title:'Cadastros locais',icon:'database'};pages.registry=registryPage;
const previousInstallationPage=pages.installation;
pages.installation=()=>previousInstallationPage()+`<div class="card padded mt16"><h2>Salvar configuração local</h2><p class="hint">Salva empresa, ativo, identificador e parâmetros neste navegador. Não ativa o rastreador e não guarda a senha APN. O diagnóstico acima continua simulado.</p><div class="btn-row"><button class="btn primary" data-registry-save>Salvar rastreador neste navegador</button>${linkBtn('Ver cadastros locais','registry')}</div></div>`;
const previousDevicesPage=pages.devices;
pages.devices=()=>`<div class="page"><div class="hero-strip"><div><strong>${registry.length} rastreador(es) salvo(s) neste navegador</strong><p>Os dispositivos abaixo são exemplos fictícios do catálogo original.</p></div>${linkBtn('Ver cadastros locais','registry','','primary')}</div></div>`+previousDevicesPage();
document.addEventListener('click',e=>{if(e.target.closest('[data-registry-save]')){e.preventDefault();registrySave();}},true);
parseHash();render();
