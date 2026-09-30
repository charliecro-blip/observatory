import {describe,it,expect} from 'vitest';
import {buildFieldFromPlacement} from '../engine/field';
import {renderStudio,STYLE_NAMES,DEFAULT_STUDIO} from '../engine/studio';
describe('style studio',()=>{
 const f=buildFieldFromPlacement('Venus','Taurus');
 for(const style of STYLE_NAMES)it(`${style} is deterministic and preserves source data`,()=>{const before=JSON.stringify(f);const s={...DEFAULT_STUDIO,style};expect(renderStudio(f,s)).toEqual(renderStudio(f,s));expect(JSON.stringify(f)).toBe(before);expect(renderStudio(f,s)).not.toMatch(/NaN|Infinity/);});
 it('escapes an exported title',()=>{const svg=renderStudio(f,{...DEFAULT_STUDIO,showTitle:true,title:'<script>alert(1)</script>'});expect(svg).toContain('&lt;script&gt;');expect(svg).not.toContain('<script>');});
 it('keeps cosmetic controls separate from the field',()=>{const before=JSON.stringify(f);expect(renderStudio(f,DEFAULT_STUDIO)).not.toEqual(renderStudio(f,{...DEFAULT_STUDIO,variation:2}));expect(JSON.stringify(f)).toBe(before);});
});

describe('dry-wash veil exercises',()=>{
 const f=buildFieldFromPlacement('Venus','Taurus');
 for(const veilExercise of ['curved','straight','light'] as const)it(`${veilExercise} preserves the source and has no blur`,()=>{
  const before=JSON.stringify(f);const svg=renderStudio(f,{...DEFAULT_STUDIO,style:'Veil',veilExercise});
  expect(svg).not.toContain('feGaussianBlur');expect(svg).not.toContain('radialGradient');expect(svg).toContain('data-wash=');expect(svg).toContain('#faf7ef');expect(JSON.stringify(f)).toBe(before);
 });
 it('produces distinct exercises',()=>expect(new Set(['curved','straight','light'].map(veilExercise=>renderStudio(f,{...DEFAULT_STUDIO,veilExercise:veilExercise as 'curved'|'straight'|'light'}))).size).toBe(3));
});
