// Rulebook data for the Compass daily prototype. Mirrors the Daily Orientation Rulebook doc (draft, Oct 31 2026).
var RB = {
  clusters: {
    drive: { label: 'Drive', gloss: 'effort, structure, beginnings', modes: ['Put your energy behind one clear effort.', 'Pick the hardest useful thing and give it your best hour.'] },
    care: { label: 'Care', gloss: 'body, home, rest', modes: ['Make looking after yourself the real work today.', 'Let your body and your home set the pace.'] },
    exchange: { label: 'Exchange', gloss: 'people, voice, making', modes: ['Let other people into what you’re doing.', 'Share what you’re making while it’s still in progress.'] },
    depth: { label: 'Depth', gloss: 'inquiry, return, letting go', modes: ['Go below the surface of one thing.', 'Give your attention to what’s unfinished or unexamined.'] }
  },
  motifs: {
    activate: { cluster: 'drive', label: 'Activate', modes: ['Start before you feel ready.', 'Get your body moving, even for five minutes.', 'Do the first physical step of whatever you’ve been putting off.', 'Let momentum carry you into the next thing.'] },
    sustain: { cluster: 'drive', label: 'Sustain', modes: ['Pace yourself for the long version.', 'Keep going at a speed you could hold all day.', 'Stay with one effort longer than feels necessary.', 'Choose steady over impressive today.'] },
    commit: { cluster: 'drive', label: 'Commit', modes: ['Choose one thing and stand by it.', 'Make the decision you’ve been circling.', 'Say yes to one thing out loud so it becomes real.', 'Begin, and let the beginning count.'] },
    order: { cluster: 'drive', label: 'Order', modes: ['Put one thing where it belongs.', 'Clear a surface and notice how your head follows.', 'Write the list before you start the day’s work.', 'Account for something you’ve been avoiding looking at.'] },
    nourish: { cluster: 'care', label: 'Nourish', modes: ['Feed yourself properly today.', 'Eat something warm, and sit down for it.', 'Let a meal be the main event for once.', 'Take in something that restores you, whether food, music or sunlight.'] },
    tend: { cluster: 'care', label: 'Tend', modes: ['Look after what’s already yours.', 'Care for the space you live in.', 'Check in on someone who would be glad to hear from you.', 'Treat your body like someone you love.'] },
    soften: { cluster: 'care', label: 'Soften', modes: ['Do less, and do it gently.', 'Let your shoulders drop and go a little slower.', 'Meet whatever comes up with a softer first response.', 'Leave room in the day for nothing in particular.'] },
    withdraw: { cluster: 'care', label: 'Withdraw', modes: ['Step back from the noise for a while.', 'Take an hour that belongs to no one else.', 'Rest before you’ve earned it.', 'Turn down one invitation without explaining.'] },
    connect: { cluster: 'exchange', label: 'Connect', modes: ['Reach out first.', 'Reply to the message you’ve been sitting on.', 'Spend time with someone without an agenda.', 'Ask someone a real question and listen to the whole answer.'] },
    express: { cluster: 'exchange', label: 'Express', modes: ['Say the thing out loud.', 'Let people see what you’ve been working on.', 'Speak up early in the conversation rather than at the end.', 'Put a feeling into words before it hardens.'] },
    play: { cluster: 'exchange', label: 'Play', modes: ['Take something less seriously.', 'Do one thing today purely because it’s fun.', 'Let a plan go sideways and enjoy where it goes.', 'Laugh at the thing that’s been bothering you.'] },
    make: { cluster: 'exchange', label: 'Make', modes: ['Make something small with no plan for it.', 'Use your hands for something other than a screen.', 'Finish a small piece rather than start a big one.', 'Arrange, cook, draw or build something just to see it exist.'] },
    explore: { cluster: 'depth', label: 'Explore', modes: ['Follow your curiosity somewhere unfamiliar.', 'Take a different route than usual.', 'Read about something you know nothing about.', 'Say yes to the slightly strange option.'] },
    investigate: { cluster: 'depth', label: 'Investigate', modes: ['Ask one more question than usual.', 'Look underneath the obvious explanation.', 'Read the thing properly instead of skimming it.', 'Write down what you actually know and what you’re guessing.'] },
    revise: { cluster: 'depth', label: 'Revise', modes: ['Return to something unfinished.', 'Fix the small thing that’s been bugging you.', 'Read your own work back with fresh eyes.', 'Go back to a conversation that didn’t land right.'] },
    release: { cluster: 'depth', label: 'Release', modes: ['Let one thing go.', 'Clear out what you’re keeping out of habit.', 'Forgive the version of today that didn’t happen.', 'Write it down and then close the notebook.'] }
  },
  planets: {
    Sun: { base: ['express', 'commit', 'activate'], verb: 'spotlights', adds: ['express', 'commit'], signReading: true },
    Moon: { base: ['nourish', 'tend', 'connect'], verb: 'brings feeling and the body', adds: ['nourish', 'tend'], signReading: true },
    Mercury: { base: ['investigate', 'explore', 'order'], verb: 'articulates', adds: ['investigate', 'express'], signReading: true },
    Venus: { base: ['make', 'connect', 'soften', 'play'], verb: 'sweetens', adds: ['soften', 'connect', 'make'], signReading: true },
    Mars: { base: ['activate', 'sustain', 'revise'], verb: 'quickens', adds: ['activate'], signReading: true },
    Jupiter: { base: ['explore', 'connect', 'play'], verb: 'widens', adds: ['explore', 'connect'], signReading: true },
    Saturn: { base: ['order', 'sustain', 'withdraw', 'commit'], verb: 'slows and concentrates', adds: ['sustain', 'order'], signReading: true },
    Uranus: { base: ['explore', 'release'], verb: 'jolts', adds: ['explore', 'release'], signReading: false, outer: true },
    Neptune: { base: ['soften', 'make', 'withdraw'], verb: 'blurs and dreams', adds: ['make', 'withdraw'], signReading: false, outer: true },
    Pluto: { base: ['investigate', 'release'], verb: 'deepens', adds: ['investigate', 'release'], signReading: false, outer: true }
  },
  element: { fire: ['activate', 'express'], earth: ['order', 'tend'], air: ['connect', 'explore'], water: ['nourish', 'soften'] },
  modality: { cardinal: 'commit', fixed: 'sustain', mutable: 'revise' },
  holdBack: ['soften', 'play'],
  guardPlanets: ['Mars', 'Saturn', 'Jupiter', 'Uranus', 'Mercury', 'Neptune', 'Pluto'],
  personal: ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars'],
  guards: {
    Mars: { topic: 'tempers and haste', line: 'Tempers run shorter, so give a sharp reply an extra minute before you send it.' },
    Saturn: { topic: 'heavy conclusions', line: 'Things feel heavier than they are, so wait until tomorrow to decide what this means.' },
    Jupiter: { topic: 'the easy yes', line: 'Watch for the easy yes, the promise that feels light now and heavy next week.' },
    Uranus: { topic: 'sudden urges', line: 'If you feel the urge to quit, buy or blurt something, give it an hour first.' },
    Mercury: { topic: 'hasty words', line: 'Words come quickly, so read a message twice before you send it.' },
    Neptune: { topic: 'blurred lines', line: 'Lines blur easily, so check the details before you agree to anything.' },
    Pluto: { topic: 'pushing too hard', line: 'Feelings run deep and can turn into control, so notice when you’re pushing for one particular outcome.' }
  },
  attends: {
    Sun: 'Notice where you want to be seen and where you’d rather stay out of view.',
    Moon: 'Notice what your body is asking for underneath the plans.',
    Mercury: 'Notice which thought keeps coming back.',
    Venus: 'Notice what you’re drawn to, and what you’re smoothing over.',
    Mars: 'Notice where you feel friction, because it points at what you care about.',
    Jupiter: 'Notice where you’re tempted to take on more than you need.',
    Saturn: 'Notice which obligation is quietly running the day.',
    Uranus: 'Notice what feels suddenly urgent, and whether it still does in an hour.',
    Neptune: 'Notice the images, dreams and moods that drift in today.',
    Pluto: 'Notice what you’re holding onto tightly.'
  },
  // Activity key -> motifs, safety class, tier, extra small versions. Labels, hours, signs and phases come from Compass's table.
  acts: {
    'train-hard': { motifs: ['activate', 'sustain'], safety: 'context', small: ['move for ten minutes at any intensity'] },
    'endurance': { motifs: ['sustain', 'activate'], safety: 'context', small: ['go half the distance, slowly'] },
    'gentle-movement': { motifs: ['soften', 'activate'], safety: 'ordinary', small: ['stretch once, standing where you are', 'walk around the block'] },
    'deep-rest': { motifs: ['withdraw', 'soften'], safety: 'ordinary', small: ['lie down for ten minutes without your phone'] },
    'deep-study': { motifs: ['investigate', 'sustain'], safety: 'ordinary', small: ['read one page properly rather than five badly'] },
    'first-draft': { motifs: ['express', 'make'], safety: 'ordinary', small: ['write three sentences and stop'] },
    'edit-revise': { motifs: ['revise', 'order'], safety: 'ordinary', small: ['fix one paragraph'] },
    'learn-skill': { motifs: ['explore', 'investigate'], safety: 'ordinary', small: ['do the smallest drill once'] },
    'strategize': { motifs: ['order', 'commit'], safety: 'ordinary', small: ['write down the question you’re actually trying to answer'] },
    'investigate': { motifs: ['investigate', 'explore'], safety: 'ordinary', small: ['note what you already know and what’s missing'] },
    'deep-work': { motifs: ['sustain', 'order'], safety: 'ordinary', small: ['twenty minutes on the hardest part, then stop'] },
    'creative-practice': { motifs: ['make', 'play'], safety: 'ordinary', small: ['make something for ten minutes with no goal', 'sketch what’s in front of you'] },
    'finish-polish': { motifs: ['revise', 'commit'], safety: 'ordinary', small: ['close one loose end'] },
    'organize': { motifs: ['order', 'release'], safety: 'ordinary', small: ['clear one surface'] },
    'repair': { motifs: ['revise', 'activate'], safety: 'ordinary', small: ['diagnose it, even if you don’t fix it today'] },
    'admin-errands': { motifs: ['order'], safety: 'ordinary', small: ['do the one errand that’s blocking something else'] },
    'romantic-time': { motifs: ['connect', 'play'], safety: 'ordinary', small: ['put both phones away for one meal together'] },
    'deepen-bond': { motifs: ['connect', 'tend'], safety: 'ordinary', small: ['ask one real question'] },
    'repair-bond': { motifs: ['revise', 'connect', 'tend'], safety: 'ordinary', small: ['send one honest line'] },
    'host': { motifs: ['connect', 'play', 'nourish'], safety: 'ordinary', tier: 'plan', small: ['invite one person over'] },
    'network': { motifs: ['connect', 'explore'], safety: 'ordinary', small: ['reply to the message you’ve been leaving'] },
    'call-family': { motifs: ['connect', 'tend'], safety: 'ordinary', small: ['send a message saying you’ll call'] },
    'cook': { motifs: ['nourish', 'tend', 'make'], safety: 'ordinary', small: ['make one thing you can build on tomorrow'] },
    'beautify': { motifs: ['make', 'tend'], safety: 'ordinary', small: ['put one thing back where it belongs'] },
    'garden': { motifs: ['tend', 'nourish'], safety: 'ordinary', small: ['water what’s already planted'] },
    'deep-clean': { motifs: ['release', 'order', 'activate'], safety: 'ordinary', small: ['one room, or one drawer'] },
    'budget': { motifs: ['order'], safety: 'ordinary', small: ['record what you spent, without deciding anything'] },
    'meditate': { motifs: ['withdraw', 'soften'], safety: 'ordinary', small: ['three breaths, counted'] },
    'journal': { motifs: ['investigate', 'release'], safety: 'ordinary', small: ['one line about today'] },
    'divination': { motifs: ['investigate', 'withdraw'], safety: 'ordinary', small: ['pull one card or cast one hexagram'] },
    'release': { motifs: ['release', 'withdraw'], safety: 'ordinary', small: ['write down one thing you’re done carrying'] },
    'retreat': { motifs: ['withdraw'], safety: 'ordinary', tier: 'plan', small: ['take one hour off the grid instead of the day'] }
  },
  focuses: {
    day: { name: 'Whole day', glyph: 'Sun', motifs: null, kinds: ['mode', 'do', 'attend', 'guard'], allowContext: false, desc: 'The shape of the day, its best openings, and any real caution.' },
    move: { name: 'Move', glyph: 'Mars', motifs: ['activate', 'sustain', 'soften'], kinds: ['mode', 'do', 'guard'], allowContext: true, desc: 'Getting active, from a hard session to a walk.' },
    rest: { name: 'Nourish & rest', glyph: 'Moon', motifs: ['nourish', 'tend', 'soften', 'withdraw'], kinds: ['mode', 'do'], allowContext: false, desc: 'Food, company, rest and slowing down.' },
    still: { name: 'Stillness', glyph: 'Neptune', motifs: ['withdraw', 'make', 'release', 'soften', 'investigate'], kinds: ['mode', 'do', 'attend'], allowContext: false, desc: 'Meditation, reflection and making things.' },
    edges: { name: 'Watch your edges', glyph: 'Uranus', motifs: [], kinds: ['guard', 'attend'], allowContext: false, desc: 'Only speaks when a planet is pressing on you.' }
  },
  numbers: {
    moonOrb: 6, strongOrb: 2, presentOrb: 4, skyOrb: 2, skyStrongOrb: 1, angleLive: 20,
    strength: { strong: 1, present: 0.6, faint: 0.3 }, signAdd: 0.5, backgroundTie: 0.15
  }
};

// ---- Inherited doctrine (Compass repo, Oct 2026) ----------------------------------------
// Moon contacts, from Auspice seed rules v1 (moonConditionRules, planetaryFamilies) and dayarc.ts.
RB.contacts = {
  Sun: { adds: ['express', 'commit'] },
  Mercury: { adds: ['investigate', 'express', 'order'] },
  Venus: { adds: ['connect', 'make', 'soften', 'tend'], benefic: true },
  Mars: { adds: ['activate', 'revise', 'order'], holdAny: ['soften'], holdHard: ['connect'] },
  Jupiter: { adds: ['explore', 'express', 'connect'], benefic: true },
  Saturn: { adds: ['order', 'sustain', 'revise', 'commit'], holdAny: ['play', 'make'], holdHard: ['connect', 'express'], dampener: 'quiet' },
  Uranus: { adds: ['explore', 'release'] },
  Neptune: { adds: ['make', 'withdraw', 'soften'], holdHard: ['commit', 'order'], dampener: 'fog' },
  Pluto: { adds: ['investigate', 'release'] }
};
RB.beginnings = ['commit', 'activate', 'explore', 'express'];
RB.states = {
  void: { label: 'Void Moon', motifs: ['revise', 'order', 'withdraw', 'release', 'soften'] },
  quiet: { label: 'Quiet stretch', motifs: ['order', 'sustain', 'revise', 'commit', 'withdraw', 'release'] },
  fog: { label: 'Soft-focus stretch', motifs: ['withdraw', 'make', 'soften', 'release'], line: 'Edges blur for a few hours, which suits rest and making things more than deciding.' }
};
RB.phaseMotifs = { new: ['withdraw', 'commit'], waxing: ['activate', 'make'], full: ['express', 'connect'], waning: ['release', 'revise'] };
RB.slow = ['Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];
RB.angleTestimony = ['Sun', 'Moon', 'Venus', 'Jupiter', 'Mars', 'Saturn'];
RB.graced = {
  Venus: 'The Moon is gathering Venus, a warm window for connection, beauty and the gentle ask.',
  Jupiter: 'The Moon is gathering Jupiter, an open window for the reach, the teaching and the bigger ask.'
};

if (typeof module !== 'undefined') module.exports = RB;

// Weather-first copy layer (Nov 2 2026). Each card leads with how the hour feels; activities follow as examples.
RB.weather = {
  motifs: {
    activate: ['There’s heat in this hour, and it wants somewhere to go.', 'The body runs a little ahead of the mind for a while.', 'A restless, forward-leaning stretch of the day.'],
    sustain: ['A long, even stride of an hour.', 'Steady and unglamorous, good at staying with things.', 'The kind of stamina that doesn’t announce itself.'],
    commit: ['The air firms up, as if a door wants closing behind you.', 'Decisions feel lighter to carry right now.', 'A clear-edged hour that likes a yes or a no.'],
    order: ['There’s a quiet pleasure in cleared surfaces right now.', 'The mind sorts things into piles without being asked.', 'Tidy and sober, and a little satisfying.'],
    nourish: ['Warm kitchens and second helpings.', 'Appetite comes forward, for food and for comfort.', 'The body asks to be fed before it asks for anything else.'],
    tend: ['There’s an urge to water things, people included.', 'Homeward, and attentive to what’s already yours.', 'Small kinds of care feel bigger than they are.'],
    soften: ['Shoulders drop an inch.', 'A slow, unhurried stretch with soft edges.', 'Gentleness costs less than usual.'],
    withdraw: ['The lamp-lit corner calls, phone face down.', 'Company feels louder than it is.', 'A turning-inward hour.'],
    connect: ['The hour leans toward people.', 'Warm toward whoever is nearest.', 'Conversations open easily and run long.'],
    express: ['Something wants to be said out loud.', 'Bright and a little theatrical, happy to be seen.', 'Words arrive before you reach for them.'],
    play: ['Lightness, and a little mischief.', 'Seriousness slides right off this hour.', 'Loose and sideways, and good at fun.'],
    make: ['Restless hands.', 'Ideas want a shape you can hold.', 'A crafty, absorbed hour.'],
    explore: ['The road you haven’t taken is calling.', 'Curious and wide-angled.', 'Unfamiliar things look friendlier than usual.'],
    investigate: ['A question won’t leave you alone.', 'Attention sinks below the surface easily.', 'Sharp-eyed and a little suspicious, in a useful way.'],
    revise: ['Old work looks newly interesting.', 'A good hour for second looks.', 'The past sits closer than usual, and is easier to mend.'],
    release: ['An exhale you’ve been holding.', 'Things loosen their grip.', 'Clearing out feels like relief.']
  },
  clusters: {
    drive: ['Energy runs forward and wants a job.', 'A purposeful, get-on-with-it stretch.'],
    care: ['The hour turns homeward and bodily.', 'Slow, warm and close to home.'],
    exchange: ['The hour leans toward other people.', 'Sociable and talkative, with things to share.'],
    depth: ['Attention goes below the surface.', 'A thoughtful, backward-glancing stretch.']
  },
  nouns: {
    'train-hard': 'a hard session', 'endurance': 'the long run or ride', 'gentle-movement': 'a walk or a slow stretch', 'deep-rest': 'a proper lie-down',
    'deep-study': 'reading something properly', 'first-draft': 'a first draft', 'edit-revise': 'the edit', 'learn-skill': 'practicing something new',
    'strategize': 'the plan', 'investigate': 'digging into a question', 'deep-work': 'the hard part of the work', 'creative-practice': 'making something for its own sake',
    'finish-polish': 'finishing touches', 'organize': 'clearing a surface', 'repair': 'fixing the broken thing', 'admin-errands': 'the errands',
    'romantic-time': 'time with your person', 'deepen-bond': 'a real conversation', 'repair-bond': 'mending things with someone', 'host': 'having people over',
    'network': 'the message you’ve been sitting on', 'call-family': 'a call home', 'cook': 'something warm on the stove', 'beautify': 'making a room nicer',
    'garden': 'hands in the soil', 'deep-clean': 'a deep clean', 'budget': 'the accounts', 'meditate': 'sitting quietly',
    'journal': 'a page in the journal', 'divination': 'a card or a hexagram', 'release': 'letting something go', 'retreat': 'time off the grid'
  },
  guards: {
    Mars: 'Tempers run short and quick for a while.',
    Saturn: 'Everything weighs more than it should for a while.',
    Jupiter: 'Yes comes too easily right now.',
    Uranus: 'Sudden urges flicker through, to quit, to buy, to blurt.',
    Mercury: 'Words come fast and land sharper than you meant them.',
    Neptune: 'Lines blur, and details slip past.',
    Pluto: 'Feelings run deep and want to hold on hard.'
  },
  attends: {
    Sun: 'The wish to be seen sits close to the surface.',
    Moon: 'The body has its own opinions underneath the plans.',
    Mercury: 'One thought keeps circling back.',
    Venus: 'Attraction and smoothing-over run side by side.',
    Mars: 'Friction shows up wherever you care most.',
    Jupiter: 'More looks easy; it may not be.',
    Saturn: 'An obligation is quietly setting the pace.',
    Uranus: 'Things feel suddenly urgent, and may not in an hour.',
    Neptune: 'Images and moods drift in easily.',
    Pluto: 'Something is being held tightly.'
  },
  voids: {
    Aries: { w: 'The urge to start is sharp, and nothing started now takes hold.', s: 'a hard workout, a fast walk, clearing something out of the way' },
    Taurus: { w: 'Slow and settled, a rest rather than a drift.', s: 'a proper meal, a comfortable chair, the familiar thing done slowly' },
    Gemini: { w: 'Chatty and circling, with nothing quite landing.', s: 'the easy messages, notes, the inbox' },
    Cancer: { w: 'Soft and inward, like a house after the guests leave.', s: 'a pot of soup, a long call home, the people you don’t have to perform for' },
    Leo: { w: 'Warm and showy, playing to a room that isn’t quite watching.', s: 'making the thing, rehearsing, play for its own sake' },
    Virgo: { w: 'Clean and quiet, with the volume turned down on anything new.', s: 'editing, admin, the careful second pass' },
    Libra: { w: 'Pleasant and social, with nothing quite settling.', s: 'brunch, a repair, anything that doesn’t need a signature' },
    Scorpio: { w: 'Feeling turns inward and finds nothing to push against.', s: 'research, a journal page, looking without acting' },
    Sagittarius: { w: 'Aimless in the pleasant way, wide and wandering.', s: 'reading something wide, a wander, plans you don’t book yet' },
    Capricorn: { w: 'Effort slips, and work costs more than it gives back.', s: 'the maintenance already on the list' },
    Aquarius: { w: 'Cool and far-off, full of ideas with nobody to bring them to.', s: 'thinking, sketching, reading alone' },
    Pisces: { w: 'Dissolving and dreamy, the kind of emptiness this sign likes best.', s: 'rest, music, making things with no outcome, sleep' }
  },
  quiet: { w: 'Everything weighs a half-step more for a few hours, and holds steadier for it.', s: 'the receipts, the boring drawer, the one paragraph you can finish' },
  fog: { w: 'Hazy and dreamlike, hard to pin down and easy to drift in.', s: 'music, sketching, a nap; decisions keep better for later' }
};

// Weather lines colored by the Moon's element (Nov 2 2026). Picked alongside the plain motif lines above,
// so the same motif reads differently in a fire, earth, air or water Moon.
RB.weather.signElement = { Aries: 'fire', Leo: 'fire', Sagittarius: 'fire', Taurus: 'earth', Virgo: 'earth', Capricorn: 'earth',
  Gemini: 'air', Libra: 'air', Aquarius: 'air', Cancer: 'water', Scorpio: 'water', Pisces: 'water' };
RB.weather.byElement = {
  activate: {
    fire: ['The hour runs hot and impatient, ready before you are.', 'A bright, restless push, like the first warm day of spring.'],
    earth: ['Energy shows up in the hands and feet more than the head.', 'A steady heat, the kind that wants a job it can finish.'],
    air: ['Ideas move faster than usual and pull the body along with them.', 'Quick and a little scattered, with energy for three things at once.'],
    water: ['Feeling stirs first, and then it gets you moving.', 'A tidal kind of energy that builds slowly and then carries you.']
  },
  sustain: {
    fire: ['Warmth that lasts, more like coals than a flame.', 'Enthusiasm settles into something you can keep going on.'],
    earth: ['Slow and sure-footed, good at the long middle of things.', 'The hour has staying power and no interest in shortcuts.'],
    air: ['Attention holds longer than usual, even on the dull parts.', 'A patient, even hour for conversations that take a while.'],
    water: ['A quiet endurance that comes from caring about the thing.', 'Feelings stay steady enough to carry you through.']
  },
  commit: {
    fire: ['Decisions come quickly and feel right in the body.', 'There is nerve in the air for saying yes out loud.'],
    earth: ['A sleeves-rolled-up readiness to choose and get on with it.', 'The hour likes plans you can write down and keep.'],
    air: ['Clarity arrives the moment you start talking it through.', 'Options narrow on their own as soon as you name them.'],
    water: ['The heart has already decided, and the rest of you is catching up.', 'Loyalties feel clear, and promises come easily.']
  },
  order: {
    fire: ['Brisk and decisive about what stays and what goes.', 'Tidying feels almost like a sport.'],
    earth: ['Drawers, ledgers and lists look strangely appealing.', 'Everything wants a place, and finding it feels good.'],
    air: ['The mind files and labels things without being asked.', 'A good hour for sorting loose thoughts into sentences.'],
    water: ['Putting the house in order feels like looking after someone.', 'A little tidying settles a restless heart.']
  },
  nourish: {
    fire: ['Appetite runs big and generous, for food and company both.', 'A feast-day feeling, warm and a little extravagant.'],
    earth: ['Bread, soup and slow-cooking weather.', 'The body asks for something solid and grounding.'],
    air: ['Food tastes better with good talk around the table.', 'Appetite comes with curiosity, for the new recipe or the other café.'],
    water: ['Comfort food, and the people who make it.', 'Hunger is half for food and half for being looked after.']
  },
  tend: {
    fire: ['Care comes out as cheerleading.', 'A warm, protective streak shows up.'],
    earth: ['Plants, pets and small repairs call for attention.', 'Practical kindness feels like the natural thing to do.'],
    air: ['Checking in costs a single message and lands well.', 'Care travels easily through words right now.'],
    water: ['A strong pull to look after the people and things that are yours.', 'Tenderness sits close to the surface.']
  },
  soften: {
    fire: ['The heat drops to a pleasant glow.', 'Even the competitive parts of you want to coast for a while.'],
    earth: ['Heavy limbs, a slow pulse, and nowhere you have to be.', 'The body wants a warm bath more than a plan.'],
    air: ['Conversation turns gentle and unhurried.', 'A light, drifting hour that forgives a lot.'],
    water: ['Edges melt and moods go soft.', 'An easy hour to be kind, to yourself included.']
  },
  withdraw: {
    fire: ['Even bright people want the curtains drawn for a bit.', 'The spark turns inward and wants privacy to recharge.'],
    earth: ['A homebody hour, best spent within reach of a blanket.', 'Quiet routines feel better than company.'],
    air: ['Too many voices start to sound like static.', 'The mind wants a closed door and an open notebook.'],
    water: ['The shell feels like exactly the right place to be.', 'Feelings want room to settle before they are shared.']
  },
  connect: {
    fire: ['Warm, open and quick to laugh with people.', 'Company recharges you this hour.'],
    earth: ['Loyal, easy company, the kind that needs no entertaining.', 'Time with people is best spent doing something side by side.'],
    air: ['Talk flows, and everyone seems to have something to say.', 'Curious about other people, and good at asking them things.'],
    water: ['Closeness comes easily, and so does honesty.', 'A pull toward the people who feel like home.']
  },
  express: {
    fire: ['Bold and a little theatrical, happy to be seen.', 'Something wants to be said with feeling.'],
    earth: ['Plain words land well right now.', 'The finished thing can speak for itself.'],
    air: ['Words arrive easily and in the right order.', 'A chatty, articulate hour.'],
    water: ['Feelings find words if you give them a minute.', 'What you say now comes out warm and unguarded.']
  },
  play: {
    fire: ['Mischief and dares, the playground kind.', 'Fun is the main event right now.'],
    earth: ['Pleasure is simple and physical: good food, sunlight, a walk with no point.', 'An easygoing hour that enjoys itself.'],
    air: ['Jokes, games and wordplay come easily.', 'Light and witty, and a bit silly.'],
    water: ['Playful in a tender way, all inside jokes and old stories.', 'Imagination wanders off and comes back with something sweet.']
  },
  make: {
    fire: ['Inspiration strikes fast and wants to be acted on.', 'Bold strokes and big gestures appeal.'],
    earth: ['Craft weather: clay, wood, dough and thread.', 'The hands know what to do before the mind does.'],
    air: ['Ideas want sketching while they are still loose.', 'A tinkering, putting-things-together hour.'],
    water: ['Making something is a way of feeling it.', 'Imagination runs deep and wants a vessel.']
  },
  explore: {
    fire: ['Wanderlust, and a taste for the unplanned.', 'Bold curiosity, the kind that buys the ticket.'],
    earth: ['Curiosity wants something you can touch, like a new street or a new market.', 'Practical adventure, close to home.'],
    air: ['The mind roams across books, maps and tangents.', 'Every question opens onto another one.'],
    water: ['Curiosity turns toward memory, dreams and other people’s stories.', 'Drawn toward water, distance and the unknown.']
  },
  investigate: {
    fire: ['A question has you by the collar.', 'Impatient to get to the bottom of something.'],
    earth: ['Methodical attention, good for the details everyone else skips.', 'Facts feel more satisfying than theories.'],
    air: ['Sharp and analytical, and full of follow-up questions.', 'The mind enjoys a puzzle right now.'],
    water: ['Intuition picks up on what isn’t being said.', 'Attention goes deep and stays there.']
  },
  revise: {
    fire: ['Old projects suddenly look worth fighting for again.', 'Restless about whatever is unfinished.'],
    earth: ['A good hour to fix, mend and patch.', 'Second drafts and second coats of paint.'],
    air: ['Old conversations replay with new understanding.', 'Words look different on a second read.'],
    water: ['Old feelings come back to be looked at kindly.', 'Memory sits near the surface and is easier to mend.']
  },
  release: {
    fire: ['A burn-the-old-drafts kind of hour.', 'Letting go feels bold.'],
    earth: ['Clearing out the closet feels like relief.', 'Fewer things in the way, and more room in the day.'],
    air: ['Old thoughts drift off easily if you let them.', 'A good hour to unsubscribe from what you no longer read.'],
    water: ['A good cry, a long bath, a long exhale.', 'Feelings loosen and wash through.']
  }
};

// What helps on an edge, in Starswell's voice (the inherited Compass lines stay in doctrine.json).
RB.weather.helps = {
  Sun: 'putting the wish to be seen into making one thing worth seeing',
  Moon: 'feeling it on purpose for ten minutes, so it doesn’t leak into everything',
  Mercury: 'writing the loop down, which usually stops it circling',
  Venus: 'having the pleasant thing first and saying the true thing after',
  Mars: 'spending the edge on something physical with an end, before it finds a person',
  Jupiter: 'saying yes to the size, then checking the one detail you’d rather skip',
  Saturn: 'doing the smallest real piece, since the weight lifts once you’re moving',
  Uranus: 'changing one real thing on purpose, so the restlessness has somewhere to land',
  Neptune: 'making something or resting, and saving decisions for later',
  Pluto: 'naming what you’re trying to control, and loosening one hand'
};
RB.weather.voids.Taurus.w = 'Slow and settled, the restful kind of nothing.';
RB.weather.attends.Jupiter = 'Taking on more looks easier than it will turn out to be.';
RB.weather.quiet.w = 'Everything feels a half-step heavier for a few hours.';
