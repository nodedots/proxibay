const NAVY = '#151b31', CORAL = '#ff5858', PAPER = '#f2f2f2'

// Mark bodies on a 64x64 grid. line = main color, node = accent slot.
const MARKS = {
  // A — Pulse Node: a dot with a heartbeat line running through it
  a: (line, node) => `
    <path d="M8 32H15" stroke="${line}" stroke-width="6" stroke-linecap="round" fill="none"/>
    <path d="M34 32H42L47 19L53 45L57 32H59" stroke="${line}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <circle cx="24.5" cy="32" r="8.5" fill="${node}"/>`,
  // B — Orbit: center dot, partial ring, satellite node parked in the gap
  b: (line, node) => `
    <path d="M49.4 28.3 A18 18 0 1 1 33.6 15.1" stroke="${line}" stroke-width="6.5" stroke-linecap="round" fill="none"/>
    <circle cx="32" cy="33" r="8.5" fill="${line}"/>
    <circle cx="43.6" cy="19.2" r="5" fill="${node}"/>`,
  // C — Node P: abstracted P; node rides the bowl apex, terminus node at stem base
  c: (line, node) => `
    <path d="M20 50V14" stroke="${line}" stroke-width="9" stroke-linecap="round" fill="none"/>
    <path d="M20 14A12.5 12.5 0 0 1 20 39" stroke="${line}" stroke-width="9" stroke-linecap="round" fill="none"/>
    <circle cx="20" cy="50" r="6" fill="${line}"/>
    <circle cx="32.5" cy="26.5" r="6.5" fill="${node}"/>`,
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
      <div class="slot">${avatar(48)}<small>avatar 48 circle</small></div>
      <div class="slot">${bare(32)}<small>bare 32 nav</small></div>
      <div class="slot">${bare(20)}<small>bare 20</small></div>
    </div>
    <div class="row">
      <div class="slot"><span class="${stripCls}">${bare(16)}<span>proxibay — tab</span></span><small>favicon 16 true size</small></div>
      <div class="slot"><span class="zoom">${bare(64)}</span><small>16px zoomed ×4</small></div>
      <div class="slot">${onTile(16)}<small>tile 16</small></div>
    </div>
    <div class="row">
      <div class="${navCls}">${bare(28)}<span class="word">Proxibay</span></div>
    </div>
  </div>`
}

const CONCEPTS = [
  ['a', 'A — Pulse Node', 'A dot (the project, its "home") with a heartbeat line running through it — straight from the hero copy. The dot is the natural coral-accent slot: the one thing with a pulse.'],
  ['b', 'B — Orbit', 'One dot being watched: a partial ring circles a center node, with a satellite parked in the ring gap. Reads as monitoring/observation; the satellite is the accent slot.'],
  ['c', 'C — Node P', 'An abstracted "P": stem + bowl, a node riding the bowl apex (accent slot) and a terminus node at the stem base. Brand letter plus connection metaphor.'],
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
