import {vocSpansBetween,scanLunarEvents} from '../../../api-server/src/lib/dayarc';
import {julianDay,moonLongitude,sunLongitude,SIGNS} from '../../../api-server/src/lib/astro';
import {writeFileSync} from 'node:fs';
const start=Date.parse('2026-09-10T06:00:00Z'),end=Date.parse('2026-10-11T06:00:00Z');
const elong=(t:number)=>((moonLongitude(julianDay(new Date(t)))-sunLongitude(julianDay(new Date(t))))%360+360)%360;
const phases=[];
for(let t=start+3600000;t<=end;t+=3600000){let a=elong(t-3600000),b=elong(t);if(b<a)b+=360;for(const angle of [0,90,180,270,360])if(a<angle&&b>=angle){let lo=t-3600000,hi=t;while(hi-lo>1000){let mid=(lo+hi)/2,e=elong(mid);if(e<a)e+=360;if(e>=angle)hi=mid;else lo=mid;}const jd=julianDay(new Date(hi));phases.push({phase:['New Moon','First Quarter','Full Moon','Last Quarter'][(angle%360)/90],at:new Date(hi).toISOString(),sign:SIGNS[Math.floor(((moonLongitude(jd)%360)+360)%360/30)]});}}
const all=scanLunarEvents(new Date(start-4*86400000),new Date(end+3*86400000));
const classicalVoc=all.ingresses.flatMap((ing,i)=>{const prior=all.ingresses[i-1];if(!prior)return [];const ps=all.perfections.filter(p=>p.t>prior.t&&p.t<ing.t&&['Sun','Mercury','Venus','Mars','Jupiter','Saturn'].includes(p.planet));const begin=ps.at(-1)?.t??prior.t;return ing.t.getTime()>Date.parse('2026-09-11T06:00:00Z')&&begin.getTime()<end?[{start:begin.toISOString(),end:ing.t.toISOString()}]:[];});
const result={phases,classicalVoc,voc:vocSpansBetween(Date.parse('2026-09-11T06:00:00Z'),end)};
writeFileSync('artifacts/tides/docs/content/lunar-cycle-2026-09-11.json',JSON.stringify(result,null,2));
console.log(JSON.stringify(result));
