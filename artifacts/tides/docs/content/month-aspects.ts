import {scanMoonPerfections,julianDay,moonLongitude,SIGNS,isRetrograde} from '../../../api-server/src/lib/astro';
import {writeFileSync} from 'node:fs';
const events=[];
for(let day=Date.parse('2026-09-11T00:00:00Z');day<Date.parse('2026-10-11T00:00:00Z');day+=86400000){
 for(const e of scanMoonPerfections(day)) {
  const jd=julianDay(new Date(e.timeMs));
  events.push({...e,at:new Date(e.timeMs).toISOString(),moonSign:SIGNS[Math.floor(((moonLongitude(jd)%360)+360)%360/30)],targetRetrograde:isRetrograde(e.planet,jd)});
 }
}
writeFileSync('artifacts/tides/docs/content/month-aspects-2026-09-11.json',JSON.stringify(events,null,2));
console.log(JSON.stringify(events.filter(e=>['2026-09-14','2026-09-17','2026-09-19','2026-09-23','2026-09-24','2026-09-26','2026-09-30','2026-10-07'].includes(e.at.slice(0,10))&&['sextile','trine','conjunction'].includes(e.aspect)&&['Mercury','Venus','Mars','Saturn'].includes(e.planet))));
