import { STYLE_NAMES,DEFAULT_STUDIO,styleNotes,renderStudio,type StudioSettings,type StudioStyle } from '../engine/studio';
import { buildFieldFromPair,buildFieldFromPlacement,type ChromaticField } from '../engine/field';
import { CANONICAL_PAIRS } from '../engine/canon';
import { buildPairModel } from '../engine/pair';
import { PLANETS,SIGNS,ASPECTS,type Planet,type Sign,type AspectName } from '../engine/types';
import { ASPECT_PROFILES } from '../engine/config/aspects';
import natalA from '../field-review/natal-a-new-york.json';
import natalB from '../field-review/natal-b-mumbai.json';
import natalC from '../field-review/natal-c-london.json';
const wording=(s:string)=>s.replace(/\bconjunction\b/gi,'conjunct').replace(/\bopposition\b|\bopposite\b/gi,'opposing');
const $=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
const select=(id:string,values:string[])=>values.forEach(v=>{const o=document.createElement('option');o.value=v;o.textContent=wording(v);$<HTMLSelectElement>(id).append(o);});
const readings=CANONICAL_PAIRS.map(c=>{const m=buildPairModel(c.scenario);return {title:wording(c.title),field:buildFieldFromPair({model:m,aspect:c.scenario.aspect,strength:m.aspectStrength,planets:[c.scenario.a.planet,c.scenario.b.planet],signs:[c.scenario.a.sign,c.scenario.b.sign],seedKey:c.slug})};});
readings.push(...[{title:'Natal · New York, 1990',field:natalA},{title:'Natal · Mumbai, 1969',field:natalB},{title:'Natal · London, 2001',field:natalC}].map(r=>({...r,field:r.field as ChromaticField})));
let current=readings[2],settings:StudioSettings={...DEFAULT_STUDIO},compare=false;
const status=(s:string)=>$('status').textContent=s;
try { const saved=JSON.parse(localStorage.getItem('chromatic-studio-style')??'null');if(saved&&STYLE_NAMES.includes(saved.style)){settings={...settings,style:saved.style};for(const k of ['layering','definition','surface'] as const)if(Number.isFinite(saved[k]))settings[k]=Math.max(0,Math.min(1,saved[k]));if(['curved','straight','light'].includes(saved.veilExercise))settings.veilExercise=saved.veilExercise;if(saved.ground==='light'||saved.ground==='dark')settings.ground=saved.ground;} }catch{}
const imageUrl=(svg:string)=>URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));
let urls:string[]=[];
function render(){
 urls.forEach(URL.revokeObjectURL);urls=[];
 for(const name of ['layering','definition','surface'] as const){$<HTMLInputElement>(name).value=String(settings[name]);$(name+'v').textContent=Math.round(settings[name]*100)+'%';}
 $<HTMLSelectElement>('ground').value=settings.ground;
 $('veil-options').hidden=settings.style!=='Veil';
 $<HTMLSelectElement>('veilExercise').value=settings.veilExercise??'curved';
 $<HTMLSelectElement>('ground').disabled=settings.style==='Veil';
 $<HTMLInputElement>('layering').disabled=!['Veil','Glass','Woven'].includes(settings.style);
 $<HTMLInputElement>('definition').disabled=!['Veil','Woven'].includes(settings.style);
 $<HTMLButtonElement>('variation').disabled=!['Veil','Glass'].includes(settings.style);
 $('single').hidden=compare;$('grid').hidden=!compare;
 $('styles').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.textContent===settings.style)));
 const create=(style:StudioStyle)=>{const url=imageUrl(renderStudio(current.field,{...settings,style}));urls.push(url);return url;};
 if(compare){$('grid').replaceChildren();for(const style of STYLE_NAMES){const b=document.createElement('button');b.type='button';const im=new Image();im.src=create(style);im.alt=`${current.title}, ${style}`;const text=document.createElement('span');text.textContent=style;b.append(im,text);b.onclick=()=>{settings.style=style;compare=false;render();};$('grid').append(b);}}
 else {$<HTMLImageElement>('art').src=create(settings.style);$<HTMLImageElement>('art').alt=`${current.title}, ${settings.style}`;}
 $('caption').textContent=current.title;$('note').textContent=styleNotes[settings.style];$('palette').replaceChildren();
 for(const t of current.field.tokens){const b=document.createElement('button');b.style.cssText=`background:${t.hex};flex:${t.weight};border:0;min-width:18px;padding:0;border-radius:0`;b.title=`${t.hex} · ${t.role} · ${(t.weight*100).toFixed(1)}%`;b.setAttribute('aria-label',`Copy ${t.hex}`);b.onclick=async()=>{try{await navigator.clipboard.writeText(t.hex);status(`Copied ${t.hex}`);}catch{status(t.hex);}};$('palette').append(b);}
 $('compare').textContent=compare?'Return to single view':'Compare six styles';
}
select('reading',readings.map(r=>r.title));$<HTMLSelectElement>('reading').value=current.title;
$('reading').onchange=()=>{current=readings.find(r=>r.title===$<HTMLSelectElement>('reading').value)!;render();};
for(const id of ['pa','pb'])select(id,[...PLANETS]);for(const id of ['sa','sb'])select(id,[...SIGNS]);select('aspect',[...ASPECTS]);
$<HTMLSelectElement>('pa').value='Venus';$<HTMLSelectElement>('sa').value='Taurus';$<HTMLSelectElement>('pb').value='Uranus';$<HTMLSelectElement>('sb').value='Scorpio';$<HTMLSelectElement>('aspect').value='opposition';
$('scope').onchange=()=>$('partner').hidden=$<HTMLSelectElement>('scope').value==='single';
$('aspect').onchange=()=>{const max=ASPECT_PROFILES[$<HTMLSelectElement>('aspect').value as AspectName].maxOrb;$<HTMLInputElement>('orb').max=String(max);$<HTMLInputElement>('orb').value=String(Math.min(max,Number($<HTMLInputElement>('orb').value)));$('orbv').textContent=$<HTMLInputElement>('orb').value+'°';};
$('orb').oninput=()=>$('orbv').textContent=$<HTMLInputElement>('orb').value+'°';
$('build').onclick=()=>{const a={planet:$<HTMLSelectElement>('pa').value as Planet,sign:$<HTMLSelectElement>('sa').value as Sign,weight:1};const b={planet:$<HTMLSelectElement>('pb').value as Planet,sign:$<HTMLSelectElement>('sb').value as Sign,weight:1};const aspect=$<HTMLSelectElement>('aspect').value as AspectName;
 if($<HTMLSelectElement>('scope').value==='single')current={title:`${a.planet} in ${a.sign}`,field:buildFieldFromPlacement(a.planet,a.sign)};
 else{const m=buildPairModel({a,b,aspect,orb:Number($<HTMLInputElement>('orb').value),variationSeed:0});current={title:`${a.planet} ${wording(aspect)} ${b.planet}`,field:buildFieldFromPair({model:m,aspect,strength:m.aspectStrength,planets:[a.planet,b.planet],signs:[a.sign,b.sign],seedKey:''})};}
 $<HTMLSelectElement>('reading').selectedIndex=-1;render();};
for(const style of STYLE_NAMES){const b=document.createElement('button');b.textContent=style;b.type='button';b.onclick=()=>{settings.style=style;render();};$('styles').append(b);}
for(const key of ['layering','definition','surface'] as const)$<HTMLInputElement>(key).oninput=()=>{settings[key]=Number($<HTMLInputElement>(key).value);render();};
$('veilExercise').onchange=()=>{settings.veilExercise=$<HTMLSelectElement>('veilExercise').value as 'curved'|'straight'|'light';render();};
$('ground').onchange=()=>{settings.ground=$<HTMLSelectElement>('ground').value as 'light'|'dark';render();};
$('title').oninput=()=>{settings.title=$<HTMLInputElement>('title').value;render();};$('showTitle').onchange=()=>{settings.showTitle=$<HTMLInputElement>('showTitle').checked;render();};
$('variation').onclick=()=>{settings.variation++;render();};$('compare').onclick=()=>{compare=!compare;render();};
$('reset').onclick=()=>{settings={...DEFAULT_STUDIO,style:settings.style};$<HTMLInputElement>('title').value='';$<HTMLInputElement>('showTitle').checked=false;render();};
$('save').onclick=()=>{try{const {style,layering,definition,surface,ground,veilExercise}=settings;localStorage.setItem('chromatic-studio-style',JSON.stringify({style,layering,definition,surface,ground,veilExercise}));status('Style saved in this browser.');}catch{status('This browser could not save the style.');}};
function download(blob:Blob,ext:string){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`chromatic-${settings.style.toLowerCase().replace(/ /g,'-')}.${ext}`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('svg').onclick=()=>download(new Blob([renderStudio(current.field,settings)],{type:'image/svg+xml'}),'svg');
$('png').onclick=async()=>{const button=$<HTMLButtonElement>('png');button.disabled=true;let url='';try{url=imageUrl(renderStudio(current.field,settings));const im=new Image();im.src=url;await im.decode();const c=document.createElement('canvas');c.width=1080;c.height=1350;c.getContext('2d')!.drawImage(im,0,0);const blob=await new Promise<Blob|null>(resolve=>c.toBlob(resolve,'image/png'));if(!blob)throw Error();download(blob,'png');status('Downloaded 1080 × 1350 PNG.');}catch{status('PNG export failed. Please try SVG.');}finally{if(url)URL.revokeObjectURL(url);button.disabled=false;}};
render();
