const {chromium}=require('playwright');const fs=require('fs');
(async()=>{const b=await chromium.launch();const svg=fs.readFileSync('web/icon.svg','utf8');
for(const n of [180,192,512]){const p=await b.newPage({viewport:{width:n,height:n}});await p.setContent(`<style>body{margin:0}svg{width:${n}px;height:${n}px;display:block}</style>`+svg);await p.screenshot({path:`../static/waves/icon-${n}.png`});await p.close();}
await b.close();})();
