/** Local specimen, served by Vite at /style-review.html; outside the application entry. */
import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import Action from './components/Action';
import LunationArc from './components/LunationArc';
import { applyPalette, PALETTES, type PaletteKey } from './lib/themes';
import './index.css';
import './pages/FindTime.css';

function Specimen() {
  const [palette, setPalette] = useState<PaletteKey>('tide');
  const [width, setWidth] = useState(768);
  useEffect(() => applyPalette(palette), [palette]);
  return <main className="timing-shell" style={{padding:24}}>
    <h1 style={{font:'400 32px/1.2 var(--font-display)'}}>Compass style reference</h1>
    <p>Review shared controls, reading text, and lunar context before changing a page.</p>
    <div style={{display:'flex',gap:8,flexWrap:'wrap',margin:'24px 0'}}>
      {PALETTES.map(p => <Action key={p.key} aria-pressed={palette === p.key} onClick={() => setPalette(p.key)}>{p.name}</Action>)}
      {[390,768,1440].map(w => <Action key={w} onClick={() => setWidth(w)} aria-pressed={width===w}>{w}px</Action>)}
    </div>
    <section style={{width:'100%', maxWidth:width, border:'1px solid var(--color-border)',padding:24,borderRadius:8}}>
      <h2 style={{font:'400 24px/1.2 var(--font-display)'}}>Current reading</h2>
      <p style={{font:'400 16px/1.6 var(--font-serif)',color:'var(--text-1)',maxWidth:'65ch'}}>The current reading favors a slower pace, with an emphasis on gentle movement and recovery.</p>
      <div style={{display:'flex',gap:8,flexWrap:'wrap',margin:'24px 0'}}>
        <Action variant="primary">Find a time</Action><Action>Save choice</Action><Action variant="text">Current reading</Action><Action disabled>Loading…</Action><Action variant="icon" aria-label="Next day">›</Action>
      </div>
      <div className="compass-segments">{['Day','Week','Month'].map(v => <Action key={v} aria-pressed={v==='Week'}>{v}</Action>)}</div>
      <p><label htmlFor="request">Your request</label></p>
      <input id="request" placeholder="Write tomorrow" style={{width:'100%',fontSize:16}} />
      <p style={{fontSize:13,color:'var(--text-3)'}}>Times shown in America/Chicago.</p>
      <div style={{display:'grid',gap:16}}>{[0,.25,.5,.75,.98].map(position => <LunationArc key={position} compact cycle={{position,waxing:position<.5}} />)}</div>
    </section>
  </main>;
}
createRoot(document.getElementById('root')!).render(<Specimen />);
