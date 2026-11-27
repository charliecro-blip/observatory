lines=open('widget-shell.js').read().split('\n')
start=next(i for i,l in enumerate(lines) if l.startswith('/*CORE*/'))
end=next(i for i,l in enumerate(lines) if l.startswith('const R = getReading();'))
head='''// Astrowaves for Scriptable. Pick one or two things you want to make room for; Astrowaves finds
// the good windows in your sky and nudges you before each one. Computed on the phone.
// Settings: change these and save. What you want help with is set in the app (tap "Change").
const SETTINGS = {
  city: 'Austin', lat: 30.2672, lon: -97.7431, tz: 'America/Chicago',
  wake: 6.5, sleep: 22.5,   // waking hours, as decimal hours; windows stay inside these
  lead: 10,                 // minutes of notice before a window
  goals: [{ want: 'meditate', times: 4, per: 'week', precision: 'moment' }],  // used until you choose in the app
  focus: 'day', notify: false, web: 'https://compass.day/today'
};
'''
body='\n'.join(lines[start:end])
out=head+body+'\n'+open('plan-main.js').read()
open('plan-shell.js','w').write(out)
open('StarswellPlan.js','w').write(out.replace('/*CORE*/',open('starswell-core.js').read()))
print(len(out))
