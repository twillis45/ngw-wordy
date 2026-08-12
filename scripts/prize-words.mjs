/**
 * Prize-word shortlists, per pack.
 *
 * The base is what the player is REWARDED with, and for the first 126 boards
 * of this catalogue not one of them was a word from its own theme — measured,
 * not estimated. This lists every theme word that could legally be a base:
 * right length, at most one doubled letter, inside the 24-110 answer band,
 * and able to spell at least 3 other theme words.
 *
 * It RANKS but deliberately does not choose. Density is measurable so it gets
 * optimised; "is this a satisfying thing to be rewarded with" is not, and an
 * earlier version that auto-picked returned PLATES for church and CHARGE for
 * the road trip. A person picks from this list.
 *
 *   node scripts/prize-words.mjs        # six-letter wheel
 *   node scripts/prize-words.mjs 7      # what a seventh tile would offer
 */
import fs from 'node:fs';
const en=fs.readFileSync('data/enable1.txt','utf8').split('\n').map(s=>s.trim()).filter(Boolean);
const pop=new Set(fs.readFileSync('data/popular.txt','utf8').split('\n').map(s=>s.trim()).filter(Boolean));
const V=JSON.parse(fs.readFileSync('data/theme-vocab.json','utf8'));
const cnt=w=>{const m=new Map();for(const c of w)m.set(c,(m.get(c)||0)+1);return m;};
const fits=(w,bm)=>{const wm=cnt(w);for(const[c,n] of wm) if((bm.get(c)||0)<n) return false; return true;};
const N=Number(process.argv[2]||6);
for(const [id,v] of Object.entries(V)){
  if(id.startsWith('_')) continue;
  const voc=[...new Set(Object.entries(v).filter(([k])=>!k.startsWith('_')).flatMap(([,s])=>String(s).split(/\s+/)))];
  const rowVoc=voc.filter(w=>w.length>=3&&w.length<=N&&pop.has(w));
  const cands=[];
  for(const b of voc){
    if(b.length!==N||!pop.has(b)||new Set(b).size<N-1) continue;
    const bm=cnt(b);
    const ans=en.filter(w=>w.length>=3&&w.length<=N&&w!==b&&fits(w,bm));
    const rows=ans.filter(w=>pop.has(w));
    if(ans.length<24||ans.length>110||rows.length<5) continue;
    const on=rowVoc.filter(w=>w!==b&&fits(w,bm));
    if(on.length<3) continue;
    cands.push([b,on.length,ans.length,on.slice(0,6)]);
  }
  cands.sort((a,b)=>b[1]-a[1]);
  if(cands.length) console.log('\n'+id.toUpperCase()+'  ('+cands.length+' viable prize words)');
  for(const [b,d,a,rows] of cands.slice(0,6))
    console.log('   '+b.toUpperCase().padEnd(9)+'density '+String(d).padStart(2)+'  answers '+String(a).padStart(3)+'   '+rows.join(' '));
}
