import fs from 'node:fs';

const t = JSON.parse(fs.readFileSync('data/themes.json', 'utf8'));
const themeById = new Map(t.themes.map((x) => [x.id, x]));
const byTheme = new Map();
for (const p of t.puzzles) {
  if (!byTheme.has(p.theme)) byTheme.set(p.theme, []);
  byTheme.get(p.theme).push(p);
}

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const order = t.themes
  .slice()
  .sort((a, b) =>
    a.name.replace(/^(the|a|an)\s+/i, '').localeCompare(b.name.replace(/^(the|a|an)\s+/i, ''))
  );

const totalBoards = t.puzzles.length;
const totalClues = t.puzzles.reduce((n, p) => n + Object.keys(p.clues).length, 0);

let sections = '';
for (const th of order) {
  const boards = byTheme.get(th.id) ?? [];
  const clues = boards.reduce((n, p) => n + Object.keys(p.clues).length, 0);
  let rows = '';
  for (const p of boards) {
    const words = Object.keys(p.clues);
    const base = p.base;
    const ordered = [base, ...words.filter((w) => w !== base)];
    rows += `<article class="board" data-board>
      <header class="board-h">
        <h3>${esc(base.toUpperCase())}</h3>
        ${p.scene ? `<p class="scene">${esc(p.scene)}</p>` : '<p class="scene none">no board name</p>'}
      </header>
      <table>
        <tbody>
          ${ordered
            .map(
              (w) => `<tr${w === base ? ' class="is-base"' : ''}>
            <th scope="row">${esc(w)}<span class="len">${w.length}</span></th>
            <td>${esc(p.clues[w])}</td>
          </tr>`
            )
            .join('')}
        </tbody>
      </table>
    </article>`;
  }
  sections += `<section class="theme" data-theme>
    <div class="theme-h">
      <p class="cat">${th.category ? esc(th.category) : '&nbsp;'}</p>
      <h2>${esc(th.name)}</h2>
      <p class="blurb">${esc(th.blurb)}</p>
      <p class="count">${boards.length} boards · ${clues} clues</p>
    </div>
    <div class="boards">${rows}</div>
  </section>`;
}

const html = `<title>Wordy — the catalogue</title>
<style>
  /* Studio Matte, borrowed from the game: carbon ground, steel identity,
     one accent. This page is a reference table, so the type does the work and
     the chrome stays out of the way. */
  :root{
    --bg:#070809; --panel:#121518; --surface:#171b1f; --hair:#232830;
    --edge:#ccd6e4; --steel:#4e6877; --steel-muted:#6f8794;
    --ink:#eef0f4; --ink2:#a9bccd; --ink3:#7d8894; --amber:#e8934a;
  }
  @media (prefers-color-scheme: light){
    :root:not([data-theme=dark]){
      --bg:#eef3f8; --panel:#fff; --surface:#e9eff5; --hair:#c2d3e2;
      --edge:#24333f; --steel:#3f5b6a; --steel-muted:#3f5b6a;
      --ink:#0d0f12; --ink2:#33485a; --ink3:#55636f; --amber:#a85712;
    }
  }
  :root[data-theme=light]{
    --bg:#eef3f8; --panel:#fff; --surface:#e9eff5; --hair:#c2d3e2;
    --edge:#24333f; --steel:#3f5b6a; --steel-muted:#3f5b6a;
    --ink:#0d0f12; --ink2:#33485a; --ink3:#55636f; --amber:#a85712;
  }
  :root[data-theme=dark]{
    --bg:#070809; --panel:#121518; --surface:#171b1f; --hair:#232830;
    --edge:#ccd6e4; --steel:#4e6877; --steel-muted:#6f8794;
    --ink:#eef0f4; --ink2:#a9bccd; --ink3:#7d8894; --amber:#e8934a;
  }
  *{box-sizing:border-box}
  .page{
    --sans:ui-sans-serif,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
    --mono:ui-monospace,SFMono-Regular,'SF Mono',Menlo,Consolas,monospace;
    background:var(--bg);color:var(--ink);font-family:var(--sans);
    line-height:1.5;margin:0;padding:clamp(20px,4vw,48px) clamp(14px,4vw,36px) 96px;
    -webkit-font-smoothing:antialiased;
  }
  .wrap{max-width:1180px;margin:0 auto}
  h1{font-size:clamp(26px,4vw,40px);letter-spacing:-.025em;margin:0;font-weight:650;text-wrap:balance}
  .lede{color:var(--ink2);margin:10px 0 0;max-width:64ch}
  .kicker{font-family:var(--mono);font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--ink3);margin:0 0 8px}

  .tools{position:sticky;top:0;z-index:5;background:var(--bg);padding:18px 0 12px;margin-top:28px;border-bottom:1px solid var(--hair)}
  .tools input{
    width:100%;max-width:520px;background:var(--surface);color:var(--ink);
    border:1px solid var(--hair);border-radius:999px;padding:11px 16px;font:inherit;font-size:15px;
  }
  .tools input:focus{outline:2px solid var(--steel-muted);outline-offset:2px}
  .hits{font-family:var(--mono);font-size:12px;color:var(--ink3);margin:8px 0 0}

  .theme{margin-top:44px}
  .theme-h{border-left:3px solid var(--steel);padding-left:14px;margin-bottom:16px}
  .cat{font-family:var(--mono);font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--amber);margin:0}
  .theme-h h2{font-size:23px;letter-spacing:-.012em;margin:2px 0 0;font-weight:640}
  .blurb{color:var(--ink2);margin:6px 0 0;max-width:70ch;font-size:14.5px}
  .count{font-family:var(--mono);font-size:11.5px;color:var(--ink3);margin:6px 0 0}

  .boards{display:grid;gap:12px}
  @media(min-width:900px){.boards{grid-template-columns:1fr 1fr}}
  .board{background:var(--panel);border:1px solid var(--hair);border-radius:14px;overflow:hidden}
  .board-h{padding:12px 14px 10px;border-bottom:1px solid var(--hair);background:var(--surface)}
  .board-h h3{margin:0;font-family:var(--mono);font-size:14px;letter-spacing:.08em;font-weight:600}
  .scene{margin:3px 0 0;font-size:13px;font-style:italic;color:var(--ink3)}
  .scene.none{color:var(--amber);font-style:normal}

  table{width:100%;border-collapse:collapse}
  th,td{text-align:left;padding:7px 14px;vertical-align:top;border-bottom:1px solid var(--hair)}
  tbody tr:last-child th,tbody tr:last-child td{border-bottom:none}
  th{font-family:var(--mono);font-size:12.5px;font-weight:600;color:var(--ink2);white-space:nowrap;width:1%}
  .len{color:var(--ink3);font-size:10.5px;margin-left:6px}
  td{font-size:13.5px;color:var(--ink2)}
  tr.is-base th{color:var(--edge)}
  tr.is-base td{color:var(--ink)}
  [hidden]{display:none !important}
</style>

<div class="page"><div class="wrap">
  <p class="kicker">Wordy · the authored catalogue</p>
  <h1>Every theme, board, word and clue</h1>
  <p class="lede">
    ${totalBoards} boards across ${order.length} themes, ${totalClues} hand-written clues.
    The <strong>bold row</strong> is the board's base — the six-letter word the wheel is
    drawn from. The italic line under each board name is its <em>scene</em>: what that
    board is about, which the player sees under the theme name.
  </p>

  <div class="tools">
    <input id="q" type="search" placeholder="Filter by word, clue, theme or scene…" aria-label="Filter the catalogue">
    <p class="hits" id="hits"></p>
  </div>

  ${sections}
</div></div>

<script>
  const q = document.getElementById('q');
  const hits = document.getElementById('hits');
  const boards = [...document.querySelectorAll('[data-board]')];
  const themes = [...document.querySelectorAll('[data-theme]')];
  const hay = new Map(boards.map(b => [b, b.textContent.toLowerCase()]));
  const themeHay = new Map(themes.map(t => [t, t.querySelector('.theme-h').textContent.toLowerCase()]));

  function run(){
    const term = q.value.trim().toLowerCase();
    let shown = 0;
    for (const t of themes){
      const themeMatch = !term || themeHay.get(t).includes(term);
      let any = false;
      for (const b of t.querySelectorAll('[data-board]')){
        const match = !term || themeMatch || hay.get(b).includes(term);
        b.hidden = !match;
        if (match){ any = true; shown++; }
      }
      t.hidden = !any;
    }
    hits.textContent = term ? shown + ' of ${totalBoards} boards' : '${totalBoards} boards · ${totalClues} clues';
  }
  q.addEventListener('input', run);
  run();
</script>`;

fs.writeFileSync('docs/catalogue.html', html);
console.log(
  `wrote docs/catalogue.html — ${order.length} themes, ${totalBoards} boards, ${totalClues} clues, ${(
    Buffer.byteLength(html) / 1024
  ).toFixed(0)}KB`
);
