// Aesthetic interpretations of an unchanged field. Preferences never mutate
// the chart or palette. Only Field, Rings and Bar claim exact base areas.
import { fieldRegions, type ChromaticField } from './field';
import { makeRng } from './seed';
export const STYLE_NAMES = ['Field','Veil','Woven','Glass','Rings','Weight bar'] as const;
export type StudioStyle = typeof STYLE_NAMES[number];
export type VeilExercise = 'curved'|'straight'|'light';
export interface StudioSettings { veilExercise?: VeilExercise; style: StudioStyle; layering: number; definition: number; surface: number; variation: number; title: string; showTitle: boolean; ground: 'light'|'dark' }
export const DEFAULT_STUDIO: StudioSettings = { veilExercise:'curved',style:'Veil',layering:0.55,definition:0.65,surface:0.25,variation:0,title:'',showTitle:false,ground:'light' };
export const styleNotes: Record<StudioStyle,string> = {
 Field:'Disjoint territories preserve allocated area; the aspect organizes their boundaries.',
 Veil:'Thin washes on a light ground build color through repeated overlaps. Wash edges remain visible; weight controls pigment accumulation, not final pixel area.',
 Woven:'Two sets of threads interlace. Allocated weights control thread selection; crossings mix the palette optically.',
 Glass:'Translucent panes retain clear edges. Weight controls pane area before overlap; the final visible areas differ.',
 Rings:'A solid center and surrounding rings preserve allocated area within the disc. Ring order follows weight.',
 'Weight bar':'A full-bleed stack preserves allocated area. This is the clearest comparison of the underlying proportions.',
};
const esc=(s:string)=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const n=(v:number)=>v.toFixed(3);
const bounded=(v:number)=>Number.isFinite(v)?Math.max(0,Math.min(1,v)):0;
export function renderStudio(field:ChromaticField, input:StudioSettings):string {
 const s={...input,layering:bounded(input.layering),definition:bounded(input.definition),surface:bounded(input.surface)};
 const rng=makeRng((field.seed ^ (Math.trunc(s.variation)*2654435761))>>>0);
 const W=1080,H=1350,uid=`st${(field.seed>>>0).toString(36)}${Math.trunc(s.variation)}`;
 const ground=s.ground==='light'?'#f5f1e7':'#101316';
 let defs=`<clipPath id="${uid}-clip"><rect width="1080" height="1350"/></clipPath>`;
 let body=`<rect width="1080" height="1350" fill="${ground}"/>`;
 const tokens=field.tokens;
 const rect=(x:number,y:number,w:number,h:number,color:string,attrs='')=>`<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="${color}" ${attrs}/>`;
 const path=(d:string,color:string,attrs='')=>`<path d="${d}" fill="${color}" ${attrs}/>`;
 const points=fieldRegions(field);
 if(s.style==='Field') {
  body+=points.map(r=>path(r.points.map((p,i)=>`${i?'L':'M'}${n(p[0]*W)},${n(p[1]*H)}`).join(' ')+'Z',r.token.hex)).join('');
 } else if(s.style==='Weight bar') {
  let y=0;for(const t of tokens){const h=t.weight*H;body+=rect(0,y,W,h,t.hex);y+=h;}
 } else if(s.style==='Rings') {
  let area=1;const R=490;
  // Paint largest cumulative discs first, then cover their inner region.
  for(let i=tokens.length-1;i>=0;i--){body+=`<circle cx="540" cy="675" r="${n(R*Math.sqrt(area))}" fill="${tokens[i].hex}"/>`;area-=tokens[i].weight;}
 } else if(s.style==='Woven') {
  const count=Math.round(30+s.definition*100),cw=W/count,ch=H/count;
  const pick=(u:number)=>{let a=0;return tokens.find(t=>(a+=t.weight)>u)??tokens[tokens.length-1];};
  for(let i=0;i<count;i++) body+=rect(i*cw,0,cw,H,pick((i+.5)/count).hex);
  const angle=field.relationship.aspect==='quincunx'?7:0;
  let weave='';
  for(let j=0;j<count;j++)for(let i=0;i<count;i++) {
   if((i+j)%2===0) weave+=rect(i*cw,j*ch,cw,ch,pick((j+.5)/count).hex,`opacity="${n(.55+s.layering*.45)}"`);
  }
  body+=`<g transform="rotate(${angle} 540 675)">${weave}</g>`;
 } else if(s.style==='Veil') {
  // Dry-wash exercises: broad overlapping sheets with legible contours.
  // No blur, glow, radial alpha falloff or palette-premixed intermediaries.
  // Multiply approximates glazing on paper; it is not spectral pigment math.
  const exercise=s.veilExercise??'curved';
  const rounds=Math.round(7+s.layering*17);
  const aspect=field.relationship.aspect;
  // Veiling depends on reflected light. This style always retains its paper;
  // the dark ground preference remains available to other styles.
  body=rect(0,0,W,H,'#faf7ef');
  const margin=52;
  defs+=`<clipPath id="${uid}-paper">${rect(margin,margin,W-margin*2,H-margin*2,'white')}</clipPath>`;
  let washes='';
  const seeds=tokens.map((t,i)=>({phase:rng()*Math.PI*2,side:aspect==='opposition'?i%2:aspect==='square'?i%4:(i+(field.seed%4))%4}));
  // Layering increases the dry passes as well as optical depth, but each
  // planet's total relative pigment budget remains its token contribution.
  for(let pass=0;pass<rounds;pass++)for(let index=0;index<tokens.length;index++) {
    const t=tokens[index], {phase,side}=seeds[index];
    const progress=pass/Math.max(1,rounds-1);
    const alpha=1-Math.exp(-(1.1+s.layering*1.7)*t.weight/rounds);
        const angular=aspect==='square'||exercise==='straight';
    const jitter=(rng()-.5)*(8+(1-s.definition)*20);
    const drift=Math.sin(phase+progress*1.4)*.06;
    let d='';
    if(exercise==='light') {
      const cx=540+Math.cos(phase)*35,cy=650+Math.sin(phase)*45;
      const rx=390-progress*245,ry=490-progress*330;
      // Even-odd glazing around untouched paper; successive smaller apertures
      // create an accumulated field without filling the central light.
      const pts=Array.from({length:48},(_,k)=>{
        const a=k/48*Math.PI*2;
        const swell=1+.045*Math.sin(a*3+phase)+.025*Math.cos(a*5-phase);
        return [cx+Math.cos(a)*rx*swell,cy+Math.sin(a)*ry*swell];
      });
      d=`M52,52H1028V1298H52Z `+pts.map((p,k)=>`${k?'L':'M'}${n(p[0])},${n(p[1])}`).join(' ')+'Z';
    } else {
      // A wash enters from one edge and ends at a broad dry contour. Stepped
      // coverage makes each pass legible instead of jittering one oval.
      const reach=(.84-progress*.43+drift)*W+jitter;
      const end=side%2===0?reach:W-reach;
      const bend=(angular?0:155+140*field.surface.complexity)*(1-progress*.45);
      const slant=Math.sin(phase)*75+field.surface.tilt*4;
      if(side===0 || side===1) {
        const edge=side===0?-80:1160;
        d=`M${edge},-60 L${n(end-slant)},-60 `;
        d+=angular?`L${n(end+slant)},1410 `:`C${n(end+bend)},370 ${n(end-bend)},960 ${n(end+slant)},1410 `;
        d+=`L${edge},1410Z`;
      } else {
        const level=(.84-progress*.43+drift)*H+jitter;
        const endY=side===2?level:H-level,edge=side===2?-60:1410;
        d=`M-80,${edge} L-80,${n(endY-slant)} `;
        d+=angular?`L1160,${n(endY+slant)} `:`C270,${n(endY+bend)} 830,${n(endY-bend)} 1160,${n(endY+slant)} `;
        d+=`L1160,${edge}Z`;
      }
    }
    washes+=path(d,t.hex,`fill-rule="evenodd" opacity="${n(alpha)}" style="mix-blend-mode:multiply" data-wash="${pass}"`);
  }
  body+=`<g clip-path="url(#${uid}-paper)" style="isolation:isolate">${washes}</g>`;
 } else {
  // Both translucent styles use the same aspect-aware anchors and seed.
  const aspect=field.relationship.aspect;
  const layers=1;
  const softness=0;
  if(softness>0)defs+=`<filter id="${uid}-edge" x="-15%" y="-15%" width="130%" height="130%"><feGaussianBlur stdDeviation="${n(softness)}"/></filter>`;
  let sheets='';
  tokens.forEach((t,index)=>{
   const fraction=index/Math.max(1,tokens.length-1);
   let cx=540,cy=675;
   if(aspect==='opposition'){cx=index%2?780:300;cy=300+fraction*680;}
   else if(aspect==='square'){cx=index%2?760:330;cy=index%2?440:850;}
   else if(aspect==='trine'){cx=240+fraction*600;cy=240+fraction*850;}
   else if(aspect==='sextile'){cx=index===0?400:770;cy=index===0?650:220+fraction*800;}
   else if(aspect==='quincunx'){cx=240+fraction*680;cy=index%2?370:900;}
   // Optical density is proportional to allocated contribution. Layer count
   // changes stratification without multiplying the total pigment budget.
   const alpha=1-Math.exp(-(1.5+s.layering*3.5)*t.weight/layers);
   for(let l=0;l<layers;l++){
    const jitter=0;
    const x=cx+(rng()-.5)*jitter,y=cy+(rng()-.5)*jitter;
    const scale=Math.sqrt(t.weight)*1.3+.5;
    const rx=(300+100*rng())*scale,ry=(380+90*rng())*scale;
    const tilt=field.surface.tilt+(rng()-.5)*(aspect==='quincunx'?34:12);
    let d:string;
    if(s.style==='Glass')d=`M${n(x-rx)},${n(y-ry)} L${n(x+rx)},${n(y-ry)} L${n(x+rx)},${n(y+ry)} L${n(x-rx)},${n(y+ry)}Z`;
    else d=`M${n(x-rx)},${n(y)} C${n(x-rx*.9)},${n(y-ry)} ${n(x+rx*.45)},${n(y-ry*.95)} ${n(x+rx)},${n(y-ry*.25)} C${n(x+rx*1.12)},${n(y+ry*.8)} ${n(x-rx*.15)},${n(y+ry)} ${n(x-rx)},${n(y)}Z`;
    sheets+=path(d,t.hex,`opacity="${n(alpha)}" transform="rotate(${n(tilt)} ${n(x)} ${n(y)})" ${softness>0?`filter="url(#${uid}-edge)"`:''}`);
   }
  });
  body+=sheets;
 }
 if(s.surface>0){
  defs+=`<filter id="${uid}-grain"><feTurbulence type="fractalNoise" baseFrequency=".75" numOctaves="2" seed="${field.seed%997}"/><feColorMatrix type="saturate" values="0"/></filter>`;
  body+=rect(0,0,W,H,ground,`filter="url(#${uid}-grain)" opacity="${n(s.surface*field.surface.grain*.065)}" style="mix-blend-mode:multiply"`);
 }
 if(s.showTitle&&s.title){body+=rect(48,1205,984,96,ground,`opacity=".9"`);body+=`<text x="76" y="1264" font-family="Arial,sans-serif" font-size="${n(Math.min(35,870/Math.max(1,s.title.length)*1.5))}" fill="${s.ground==='light'?'#151515':'#f5f1e7'}">${esc(s.title)}</text>`;}
 return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350"><defs>${defs}</defs><g clip-path="url(#${uid}-clip)">${body}</g></svg>`;
}
