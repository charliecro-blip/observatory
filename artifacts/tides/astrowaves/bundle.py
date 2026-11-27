import json,sys
d=json.load(open('rules.json'))
acts=[{k:a[k] for k in ['key','label','category','element','planets','hourRulers','aspects','signs','phase','voc','gloss','mvp']} for a in d['acts']]
pis={pl:{s:{'does':v['does'],'misses':v['misses']} for s,v in d['pis'][pl].items()} for pl in d['pis']}
strip=lambda s: '\n'.join(l for l in s.split('\n') if not l.startswith("if (typeof module !== 'undefined')"))
astro=open('node_modules/astronomy-engine/astronomy.browser.min.js').read()
parts=[
 "var Astronomy = (function () { var module = { exports: {} }, exports = module.exports; var define; "+astro+"\n; return module.exports; })();",
 "var RULES = "+json.dumps({'acts':acts,'pis':pis},ensure_ascii=False,separators=(',',':'))+";",
 "var DOC = "+json.dumps(json.load(open('doctrine.json')),ensure_ascii=False,separators=(',',':'))+";",
 strip(open('sky.js').read()), strip(open('rulebook.js').read()), strip(open('engine.js').read()), strip(open('core.js').read()), strip(open('plan.js').read())]
open('starswell-core.js','w').write('\n'.join(parts)+'\n')
print(len('\n'.join(parts)))
