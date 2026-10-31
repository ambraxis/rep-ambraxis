const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=__dirname,read=n=>fs.readFileSync(path.join(root,n),'utf8');
let html=read('index.html').replace('<link rel="stylesheet" href="styles.css">','<style>'+read('styles.css')+'</style>');
for(const name of ['app.js','installation.js','registry.js','documentation.js','backend.js'])html=html.replace(`<script src="${name}"></script>`,'<script>'+read(name).replace(/<\/script/gi,'<\\/script')+'</script>');
fs.writeFileSync(path.join(root,'AMBRAXIS.html'),html);
fs.writeFileSync(path.join(root,'VF_TRACK_CONTINUACAO.html'),html);
const ctx=vm.createContext({pages:{settings:()=>''},document:{addEventListener:()=>{}},renderPage:()=>{}});
vm.runInContext(read('documentation.js')+'\nglobalThis.doc=SYSTEM_DOCUMENTATION',ctx);
fs.writeFileSync(path.join(root,'DOCUMENTACAO.md'),'# Documentação do AMBRAXIS\n\nVersão '+ctx.doc.version+' — '+ctx.doc.updated+'\n\n'+ctx.doc.sections.map(s=>'## '+s.title+'\n\nEstado: '+s.status+'\n\n'+s.text+'\n\n'+s.items.map(t=>'- '+t).join('\n')).join('\n\n')+'\n');
