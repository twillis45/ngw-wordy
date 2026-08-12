/**
 * Can a theme carry a pack at all?
 *
 * Answers the question that should be asked BEFORE a clue is written, and was
 * not asked for Laundry Day or Caribbean — both of which were authored, shipped
 * and then found to be unfixable by any rewrite, base swap or cut.
 *
 * The gate is DENSITY: at least 12 bases able to spell 3+ of the theme's
 * words. An on-theme prize word is a strong preference and NOT a gate, because
 * using it as one rejects rnb90s, which sits at 0.80 and is the best pack in
 * the catalogue.
 *
 *   node scripts/viability.mjs
 */
import fs from 'node:fs';
const en=fs.readFileSync('data/enable1.txt','utf8').split('\n').map(s=>s.trim()).filter(Boolean);
const pop=new Set(fs.readFileSync('data/popular.txt','utf8').split('\n').map(s=>s.trim()).filter(Boolean));
const V=JSON.parse(fs.readFileSync('data/theme-vocab.json','utf8'));
const cnt=w=>{const m=new Map();for(const c of w)m.set(c,(m.get(c)||0)+1);return m;};
const fits=(w,bm)=>{const wm=cnt(w);for(const [c,n] of wm) if((bm.get(c)||0)<n) return false; return true;};
const okBase=b=>b.length===6&&pop.has(b)&&new Set(b).size>=5;
console.log('pack           on-theme PRIZE words   best density   bases w/ density>=3   VIABLE?');
for(const [id,v] of Object.entries(V)){
  if(id.startsWith('_')) continue;
  const voc=[...new Set(Object.entries(v).filter(([k])=>!k.startsWith('_')).flatMap(([,s])=>String(s).split(/\s+/)))]
    .filter(w=>w.length>=3&&w.length<=6&&pop.has(w));
  const vocSet=new Set(voc);
  let prize=0,best=0,dense=0,bestPair=null;
  for(const b of en){
    if(!okBase(b)) continue;
    const bm=cnt(b);
    let n=0; for(const w of voc){ if(w!==b&&fits(w,bm)) n++; }
    if(n>=3) dense++;
    if(n>best) best=n;
    if(vocSet.has(b)&&n>=3){ prize++; if(!bestPair||n>bestPair[1]) bestPair=[b,n]; }
  }
  /*
   * DENSITY IS THE GATE. The prize word is reported beside it and does not
   * vote.
   *
   * This read `dense>=12 && prize>=1`, which contradicts the header six lines
   * up — "an on-theme prize word is a strong preference and NOT a gate,
   * because using it as one rejects rnb90s, which sits at 0.80 and is the best
   * pack in the catalogue." It did exactly that: rnb90s, hbcu, sitcom,
   * steppers, beautysupply and garden all shipped, all clear the density
   * floor by a wide margin, and all printed "no". A gate that fails six live
   * packs is not measuring viability, and reading it would have blocked work
   * that should go ahead.
   */
  const viable = dense>=12;
  console.log(id.padEnd(14), String(prize).padStart(4), String(best).padStart(16), String(dense).padStart(18), '  ', viable?'YES':'no', bestPair?(' <- '+bestPair[0].toUpperCase()+'('+bestPair[1]+')'):'');
}
