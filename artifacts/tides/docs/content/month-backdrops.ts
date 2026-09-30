import {getAspectOrbs,julianDay,moonLongitude,SIGNS} from '../../../api-server/src/lib/astro';
import {writeFileSync} from 'node:fs';
const start=Date.parse('2026-09-11T06:00:00Z'),end=Date.parse('2026-10-11T06:00:00Z');
const sign=(t:number)=>SIGNS[Math.floor(((moonLongitude(julianDay(new Date(t)))%360)+360)%360/30)];
const active=(t:number)=>getAspectOrbs(julianDay(new Date(t))).filter(x=>x.planet1!=='Moon'&&x.planet2!=='Moon'&&x.orb<=3&&['conjunction','sextile','trine'].includes(x.aspect)).map(x=>`${x.planet1} ${x.aspect} ${x.planet2}`);
function scan(fn:(t:number)=>string[]){let open=new Map<string,number>();const spans:any[]=[];for(const k of fn(start))open.set(k,start);for(let t=start+3600000;t<=end;t+=3600000){const before=fn(t-3600000),after=fn(t);for(const k of new Set([...before,...after])){if(before.includes(k)===after.includes(k))continue;let lo=t-3600000,hi=t;while(hi-lo>1000){let mid=(lo+hi)/2;if(fn(mid).includes(k)===before.includes(k))lo=mid;else hi=mid;}if(after.includes(k))open.set(k,hi);else {spans.push({name:k,start:new Date(open.get(k)!).toISOString(),end:new Date(hi).toISOString()});open.delete(k);}}}for(const [k,s] of open)spans.push({name:k,start:new Date(s).toISOString(),end:new Date(end).toISOString()});return spans.sort((a,b)=>a.start.localeCompare(b.start));}
const data={horizon:{start:new Date(start).toISOString(),end:new Date(end).toISOString()},moonSigns:scan(t=>[sign(t)]),planetary:scan(active)};
writeFileSync('artifacts/tides/docs/content/month-backdrops-2026-09-11.json',JSON.stringify(data,null,2));
console.log(JSON.stringify(data));
