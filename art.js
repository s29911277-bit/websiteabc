/* BorrowBox · item illustrations
   Small inline SVGs so the prototype needs no image files.
   A listing with an uploaded photo uses the photo instead. */

const C = { lime: '#d4f36a', orange: '#ec7851', white: '#ffffff', butter: '#f4e4a8', sky: '#9ecbd0' };
let artCount = 0;

const ART = {
  books: () => `
    <rect x="40" y="76" width="86" height="22" rx="3" fill="${C.white}"/><path d="M50 76v22M56 76v22"/>
    <rect x="34" y="52" width="84" height="24" rx="3" fill="${C.lime}"/><path d="M44 52v24M50 52v24"/>
    <rect x="46" y="28" width="70" height="24" rx="3" fill="${C.orange}"/><path d="M56 28v24M62 28v24"/>`,

  calculator: () => {
    const keys = [];
    for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) {
      keys.push(`<circle cx="${66 + c * 14}" cy="${58 + r * 13}" r="3.5" fill="${r === 3 && c === 2 ? C.orange : 'currentColor'}" stroke="none"/>`);
    }
    return `<rect x="52" y="12" width="56" height="98" rx="8" fill="${C.white}"/>
            <rect x="60" y="21" width="40" height="20" rx="3" fill="${C.lime}"/>${keys.join('')}`;
  },

  charger: () => `
    <rect x="44" y="34" width="50" height="44" rx="6" fill="${C.white}"/><path d="M58 34V20M80 34V20"/>
    <path d="M94 56h10c18 0 12 36 30 36h8" /><rect x="142" y="85" width="12" height="14" rx="2" fill="${C.lime}"/>`,

  flask: () => `
    <path d="M52 78H108L116 92A8 8 0 0 1 109 104H51A8 8 0 0 1 44 92Z" fill="${C.lime}" stroke="none"/>
    <path d="M72 16V44L44 92A8 8 0 0 0 51 104H109A8 8 0 0 0 116 92L88 44V16"/><path d="M66 16H94"/>
    <circle cx="74" cy="88" r="3"/><circle cx="88" cy="94" r="2.5"/><circle cx="82" cy="82" r="2"/>`,

  drafter: () => `
    <path d="M42 98V28L106 98Z" fill="${C.lime}"/><path d="M56 90V58L82 90Z" fill="${C.white}"/>
    <rect x="30" y="98" width="100" height="14" rx="2" fill="${C.butter}"/>
    <path d="M44 98v6M56 98v8M68 98v6M80 98v8M92 98v6M104 98v8M116 98v6" stroke-width="2"/>`,

  racket: () => {
    const id = 'rk' + (++artCount);
    const strings = [];
    for (let x = 62; x <= 98; x += 6) strings.push(`<path d="M${x} 6V80"/>`);
    for (let y = 14; y <= 74; y += 7) strings.push(`<path d="M50 ${y}H110"/>`);
    return `<g transform="rotate(35 80 60)">
        <ellipse cx="80" cy="42" rx="24" ry="32" fill="${C.white}"/>
        <clipPath id="${id}"><ellipse cx="80" cy="42" rx="24" ry="32"/></clipPath>
        <g clip-path="url(#${id})" stroke-width="1.4" opacity=".5">${strings.join('')}</g>
        <ellipse cx="80" cy="42" rx="24" ry="32"/>
        <path d="M72 72L78 84M88 72L82 84"/>
        <rect x="76" y="82" width="8" height="34" rx="3" fill="${C.orange}"/>
      </g>
      <path d="M126 66H148L143 92H131Z" fill="${C.white}"/><path d="M132 66l2 26M137 66v26M142 66l-2 26" stroke-width="1.6"/>
      <circle cx="137" cy="98" r="6" fill="${C.orange}"/>`;
  },

  umbrella: () => `
    <path d="M24 66C24 38 50 18 80 18S136 38 136 66q-14-10-28 0q-14-10-28 0q-14-10-28 0q-14-10-28 0Z" fill="${C.orange}"/>
    <path d="M80 18v48M80 18L50 64M80 18l30 46" stroke-width="2"/>
    <path d="M80 66v32a8 8 0 0 1-16 0" stroke-width="4"/><path d="M80 18V11"/>`,

  palette: () => `
    <path d="M80 22C44 22 24 44 28 72c4 26 30 32 46 28 10-3 6-14 14-16 10-2 22 4 34-6 14-12 12-56-42-60z" fill="${C.white}"/>
    <circle cx="56" cy="50" r="6" fill="${C.lime}"/><circle cx="80" cy="40" r="6" fill="${C.orange}"/>
    <circle cx="104" cy="50" r="6" fill="${C.butter}"/><circle cx="50" cy="74" r="6" fill="${C.sky}"/>
    <path d="M114 104l28-56" stroke-width="4"/><path d="M142 48l5-10" stroke-width="5" stroke="${C.orange}"/>`,

  powerbank: () => `
    <rect x="50" y="12" width="60" height="98" rx="10" fill="${C.white}"/>
    <rect x="60" y="24" width="40" height="11" rx="3" fill="${C.lime}"/><rect x="60" y="40" width="40" height="11" rx="3" fill="${C.lime}"/>
    <rect x="60" y="56" width="40" height="11" rx="3" fill="${C.lime}"/><rect x="60" y="72" width="40" height="11" rx="3" fill="${C.white}"/>
    <rect x="70" y="94" width="20" height="6" rx="2" fill="currentColor" stroke="none"/>`,

  box: () => `
    <path d="M80 18l44 20v44l-44 20-44-20V38Z" fill="${C.white}"/>
    <path d="M80 18l44 20-44 20-44-20Z" fill="${C.lime}"/><path d="M36 38l44 20 44-20M80 58v44"/>`,

  coat: () => `
    <path d="M60 16L26 32L34 62L48 56V108H112V56L126 62L134 32L100 16L80 38Z" fill="${C.white}"/>
    <path d="M80 38V108"/><rect x="54" y="78" width="16" height="14" rx="2"/><rect x="90" y="78" width="16" height="14" rx="2"/>
    <circle cx="74" cy="56" r="1.8" fill="currentColor"/><circle cx="74" cy="68" r="1.8" fill="currentColor"/>`
};

function artSvg(name) {
  const draw = ART[name] || ART.box;
  return `<svg viewBox="0 0 160 120" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${draw()}</svg>`;
}
