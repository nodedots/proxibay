const NAVY = '#151b31', CORAL = '#ff5858', PAPER = '#f2f2f2'

// All marks on 64x64 grid.
// line = main stroke/fill color, node = accent color (coral).
const MARKS = {
  // A1: Stack & Bill — Three rounded stack bars; top bar projects forward into a crisp duckbill profile with a coral monitoring eye
  a1: (line, node) => `
    <line x1="16" y1="47" x2="48" y2="47" stroke="${line}" stroke-width="6" stroke-linecap="round"/>
    <line x1="16" y1="34" x2="42" y2="34" stroke="${line}" stroke-width="6" stroke-linecap="round"/>
    <path d="M16 21H34C41 21 47 23 52 23C46 29 39 29 33 29H16" stroke="${line}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <circle cx="27" cy="21" r="4.5" fill="${node}"/>`,

  // A2: Geometric Bill Contour — Minimalist architectural bill arc facing right with coral telemetry node
  a2: (line, node) => `
    <path d="M18 48V26C18 16 26 14 36 14C45 14 51 18 54 23C45 28 35 28 28 28V48" stroke="${line}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <line x1="28" y1="38" x2="44" y2="38" stroke="${line}" stroke-width="6" stroke-linecap="round"/>
    <circle cx="34" cy="21" r="4.5" fill="${node}"/>`,

  // A3: The Bill Wedge (Single Icon like Cline) — Bold modern wedge & head monoline, sleek tech aesthetic
  a3: (line, node) => `
    <path d="M18 46H28V32L49 25L32 18H24C19 18 18 22 18 26Z" fill="${line}"/>
    <line x1="18" y1="46" x2="46" y2="46" stroke="${line}" stroke-width="5.5" stroke-linecap="round"/>
    <circle cx="27" cy="25" r="4" fill="${node}"/>`,

  // B1: The Calm Duck Silhouette — Floating profile duck silhouette on a stack waterline with coral eye
  b1: (line, node) => `
    <path d="M15 44C15 44 14 36 21 34C24 33 25 30 25 25C25 18 29 14 35 14C41 14 43 18 43 21C47 21 52 22 53 24C52 27 47 27 43 27C43 32 46 36 50 37C46 41 40 44 32 44Z" fill="${line}"/>
    <line x1="14" y1="50" x2="50" y2="50" stroke="${line}" stroke-width="5" stroke-linecap="round"/>
    <circle cx="34" cy="20" r="3.5" fill="${node}"/>`,

  // B2: The Sentinel Duck (Head & Bill Profile) — Ultra-clear, punchy modern duck head silhouette
  b2: (line, node) => `
    <path d="M18 50V33C18 21 26 14 36 14C43 14 48 18 49 22C52 22 56 23 57 25C56 29 50 29 46 29C44 36 43 43 43 50Z" fill="${line}"/>
    <circle cx="35" cy="22" r="4" fill="${node}"/>`,

  // B3: Stack Duck Silhouette (Segmented Duck Body) — Duck form built from horizontal stack slices
  b3: (line, node) => `
    <rect x="16" y="44" width="34" height="6" rx="3" fill="${line}"/>
    <path d="M18 36H46C44 32 40 30 36 30H22C19 30 18 33 18 36Z" fill="${line}"/>
    <path d="M26 28H40C43 28 47 25 52 24C47 21 43 21 40 21C40 17 36 14 31 14C27 14 24 17 24 21V28H26Z" fill="${line}"/>
    <circle cx="32" cy="19" r="3.5" fill="${node}"/>`,
}

const svg = (inner, size) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 64 64">${inner}</svg>`
const tile = (inner, size, round) =>
  svg(`<rect width="64" height="64" rx="${round}" fill="${NAVY}"/>${inner}`, size)

// colorways: [line, node] per background theme; tiles always navy + paper mark
const WAYS = {
  navy:  { light: [NAVY, NAVY],  dark: [PAPER, PAPER], tileNode: PAPER },
  coral: { light: [NAVY, CORAL], dark: [PAPER, CORAL], tileNode: CORAL },
}

function panel(theme, wayKey, markKey) {
  const way = WAYS[wayKey]
  const [line, node] = way[theme]
  const bare = s => svg(MARKS[markKey](line, node), s)
  const onTile = s => tile(MARKS[markKey](PAPER, way.tileNode), s, 14)
  const avatar = s => tile(MARKS[markKey](PAPER, way.tileNode), s, 32)
  const stripCls = theme === 'dark' ? 'favicon-strip dark' : 'favicon-strip'
  const navCls = theme === 'dark' ? 'navbar-mock dark' : 'navbar-mock light'
  const wayName = wayKey === 'coral' ? 'Navy + Coral accent' : 'Pure Navy'
  return `
  <div class="panel ${theme}">
    <h3>${theme} — ${wayName}</h3>
    <div class="row">
      <div class="slot">${onTile(96)}<small>tile 96</small></div>
      <div class="slot">${avatar(48)}<small>avatar 48</small></div>
      <div class="slot">${bare(32)}<small>bare 32 nav</small></div>
      <div class="slot">${bare(20)}<small>bare 20</small></div>
    </div>
    <div class="row">
      <div class="slot"><span class="${stripCls}">${bare(16)}<span>Stackduck — tab</span></span><small>favicon 16 true size</small></div>
      <div class="slot"><span class="zoom">${bare(64)}</span><small>16px zoomed ×4</small></div>
      <div class="slot">${onTile(16)}<small>tile 16</small></div>
    </div>
    <div class="row">
      <div class="${navCls}">${bare(28)}<span class="word">Stackduck</span></div>
    </div>
  </div>`
}

const CONCEPTS = [
  // DIRECTION A
  ['a1', 'Direction A · Option 1 — "Stack & Bill"', 'Abstract / Geometric: Three rounded stack layers where the top layer extends forward into a distinct geometric duckbill contour, with a coral monitoring eye node. Reads immediately as "Stack" + "Duck", highly legible down to 16px.'],
  ['a2', 'Direction A · Option 2 — "The Geometric Bill & Contour"', 'Abstract / Geometric: Architectural duckbill profile curve in bold monoline geometry, paired with a horizontal stack spine and an observant coral status dot.'],
  ['a3', 'Direction A · Option 3 — "The Minimalist Bill Wedge"', 'Abstract / Geometric: Cline-style bold geometric bill wedge and crown, resting on a base stack bar. Crisp, angular, and clean.'],
  // DIRECTION B
  ['b1', 'Direction B · Option 1 — "The Calm Duck Silhouette"', 'Literal / Simple Silhouette: A minimalist solid duck silhouette floating on a horizontal stack waterline, with a crisp forward bill and coral telemetry eye. Balanced, instantly recognizable as a duck at 16px.'],
  ['b2', 'Direction B · Option 2 — "The Sentinel Duck (Head Profile)"', 'Literal / Simple Silhouette: Focused duck head and neck profile in solid geometric silhouette. Maximum silhouette punch and contrast on small screens.'],
  ['b3', 'Direction B · Option 3 — "Segmented Stack Duck"', 'Literal / Simple Silhouette: A duck silhouette sliced into horizontal stack segments (head/bill, chest, floating base). Blends literal duck anatomy with modular tech stack metaphor.'],
]

document.getElementById('app').innerHTML = CONCEPTS.map(([key, name, why]) => `
  <div class="concept">
    <h2>${name}</h2>
    <p class="why">${why}</p>
    <div class="grid">
      <div>
        <div class="colhead">Light</div>
        <div class="colhead" style="margin-top:262px">Dark</div>
      </div>
      <div>${panel('light', 'navy', key)}${panel('dark', 'navy', key)}</div>
      <div>${panel('light', 'coral', key)}${panel('dark', 'coral', key)}</div>
    </div>
  </div>`).join('')
