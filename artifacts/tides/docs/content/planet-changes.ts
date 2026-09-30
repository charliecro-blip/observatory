import {getPlanetPositions,julianDay} from '../../../api-server/src/lib/astro';
import {writeFileSync} from 'node:fs';
const start=Date.parse('2026-09-09T06:00:00Z'),end=Date.parse('2026-10-11T06:00:00Z');
const at=(t:number)=>getPlanetPositions(julianDay(new Date(t))).filter(x=>x.planet!=='Moon');
const out:any[]=[];for(let t=start+3600000;t<=end;t+=3600000){const a=at(t-3600000),b=at(t);for(let i=0;i<a.length;i++)for(const key of ['sign','retrograde'] as const){if(a[i][key]===b[i][key])continue;let lo=t-3600000,hi=t;while(hi-lo>1000){const mid=(hi+lo)/2;if(at(mid)[i][key]===a[i][key])lo=mid;else hi=mid;}out.push({planet:a[i].planet,kind:key,from:a[i][key],to:b[i][key],at:new Date(hi).toISOString()});}}
writeFileSync('artifacts/tides/docs/content/planet-changes-2026-09-11.json',JSON.stringify(out,null,2));console.log(JSON.stringify(out));
