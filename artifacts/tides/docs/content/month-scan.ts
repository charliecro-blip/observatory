import { searchTiming } from '../../../api-server/src/lib/timingSearch';
import { presentTiming } from '../../../api-server/src/lib/timingPresentation';
import { writeFileSync } from 'node:fs';
const keys=['first-draft','creative-practice','deep-study','train-hard','hard-conversation','negotiate'];
const start=Date.parse('2026-09-11T00:00:00Z'), end=Date.parse('2026-10-11T00:00:00Z');
const scans=[];
for(const activity of keys){
 for(let from=start;from<end;from+=7*86400000){
  const query={activity,start:new Date(from).toISOString(),end:new Date(Math.min(end,from+7*86400000)).toISOString(),timeZone:'UTC'};
  const result=searchTiming(query);scans.push({query,...presentTiming(result)});
 }
}
writeFileSync('artifacts/tides/docs/content/month-scan-2026-09-11.json',JSON.stringify({start:new Date(start).toISOString(),end:new Date(end).toISOString(),scans},null,2));
console.log(JSON.stringify(scans.map(s=>({activity:s.query.activity,start:s.query.start,status:s.result.status,count:s.candidates.length}))));
