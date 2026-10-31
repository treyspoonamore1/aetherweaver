import { useId } from 'react';
import { OWN_RIBBONS, OWN_ROBE, type RobeColors, type ThreadColors } from './loomLook';

/** The figure's motion: a slow float, the ribbons swaying from her hands, motes rising. */
const CSS = `
@keyframes weaver-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
@keyframes weaver-sway-l { 0%, 100% { transform: rotate(0deg); } 50% { transform: rotate(-4deg); } }
@keyframes weaver-sway-r { 0%, 100% { transform: rotate(0deg); } 50% { transform: rotate(4deg); } }
@keyframes weaver-mote { 0% { transform: translateY(0); opacity: 0; } 20% { opacity: 0.9; } 100% { transform: translateY(-46px); opacity: 0; } }
`;

const MOTES = [
  { x: 52, y: 150, d: 0 },
  { x: 108, y: 136, d: 1.4 },
  { x: 70, y: 176, d: 2.6 },
  { x: 96, y: 168, d: 3.7 },
];

/**
 * The Weaver as the Loom draws her (Phase 4g): hooded, haloed, in a long robe with its trim at
 * the hem, the sash and the cuffs, ribbons trailing from her weaving hands (the Thread's origin).
 * Her robe's colours are the robe she wears (`robeColors`), her ribbons the Thread look's
 * (`ribbonColors`); the defaults are her own ivory, gold and white-gold. A dark robe keeps a rim
 * of its trim, so she reads on the dark hall. `still` (reduced motion, screenshots) stops the
 * float, the sway and the motes.
 */
export function WeaverFigure({
  robe = OWN_ROBE,
  ribbons = OWN_RIBBONS,
  height = 200,
  still = false,
  label,
  className = '',
}: {
  robe?: RobeColors;
  ribbons?: ThreadColors;
  /** Height in px; the width follows (160 × 220). */
  height?: number;
  still?: boolean;
  /** Read out ("The Weaver, in Dusk"); without it the figure is decoration. */
  label?: string;
  className?: string;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const id = (name: string) => `${name}-${uid}`;
  const anim = (value: string) => (still ? undefined : value);
  const ribbon = (side: 'l' | 'r') => {
    const s = side === 'l' ? 1 : -1;
    // Mirrored about x = 80.
    const x = (v: number) => (s === 1 ? v : 160 - v);
    const long = `M${x(45)} 120 C${x(34)} 134 ${x(24)} 118 ${x(14)} 133 C${x(6)} 145 ${x(13)} 160 ${x(5)} 174`;
    const short = `M${x(46)} 123 C${x(40)} 142 ${x(28)} 148 ${x(24)} 166`;
    return (
      <g
        style={{
          transformOrigin: `${x(45)}px 120px`,
          animation: anim(
            `weaver-sway-${side} ${6 + (side === 'l' ? 0 : 0.8)}s ease-in-out infinite`,
          ),
        }}
      >
        {[long, short].map((d) => (
          <g key={d}>
            <path d={d} stroke={ribbons.glow} strokeOpacity={0.35} strokeWidth={5} />
            <path d={d} stroke={ribbons.filament} strokeWidth={1.8} />
          </g>
        ))}
      </g>
    );
  };
  return (
    <svg
      viewBox="0 0 160 220"
      height={height}
      width={(height * 160) / 220}
      className={`overflow-visible ${className}`}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <style>{CSS}</style>
      <defs>
        <radialGradient id={id('halo')}>
          <stop offset="0%" stopColor={robe.glow} stopOpacity={0.55} />
          <stop offset="100%" stopColor={robe.glow} stopOpacity={0} />
        </radialGradient>
        <radialGradient id={id('hand')}>
          <stop offset="0%" stopColor={ribbons.filament} stopOpacity={0.9} />
          <stop offset="100%" stopColor={ribbons.glow} stopOpacity={0} />
        </radialGradient>
        <linearGradient id={id('shade')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity={0.1} />
          <stop offset="55%" stopColor="#050814" stopOpacity={0.05} />
          <stop offset="100%" stopColor="#050814" stopOpacity={0.38} />
        </linearGradient>
        <radialGradient id={id('dais')}>
          <stop offset="0%" stopColor={robe.glow} stopOpacity={0.35} />
          <stop offset="100%" stopColor={robe.glow} stopOpacity={0} />
        </radialGradient>
      </defs>
      {/* Where she stands: a pool of her own light. */}
      <ellipse cx={80} cy={204} rx={62} ry={12} fill={`url(#${id('dais')})`} />
      <ellipse cx={80} cy={204} rx={46} ry={6} stroke={robe.glow} strokeOpacity={0.45} />
      <g style={{ animation: anim('weaver-float 5s ease-in-out infinite') }}>
        <circle cx={80} cy={34} r={30} fill={`url(#${id('halo')})`} />
        {ribbon('l')}
        {ribbon('r')}
        {/* The mantle behind her, in the robe's colour, deeper. */}
        <path d="M60 64 C48 92 42 150 30 202 L130 202 C118 150 112 92 100 64 Z" fill={robe.body} />
        <path
          d="M60 64 C48 92 42 150 30 202 L130 202 C118 150 112 92 100 64 Z"
          fill="#050814"
          fillOpacity={0.42}
        />
        {/* The robe. */}
        <path
          d="M62 62 C58 84 52 108 46 132 C40 158 36 180 33 198 Q80 210 127 198 C124 180 120 158 114 132 C108 108 102 84 98 62 Z"
          fill={robe.body}
          stroke={robe.trim}
          strokeOpacity={0.55}
          strokeWidth={1.2}
        />
        <path
          d="M62 62 C58 84 52 108 46 132 C40 158 36 180 33 198 Q80 210 127 198 C124 180 120 158 114 132 C108 108 102 84 98 62 Z"
          fill={`url(#${id('shade')})`}
        />
        {/* Trim: the opening down the front, the hem, the sash and its tails. */}
        <path d="M70 63 L80 80 L90 63 M80 80 V203" stroke={robe.trim} strokeWidth={2} />
        <path d="M35 191 Q80 203 125 191" stroke={robe.trim} strokeWidth={4} />
        <path d="M52 110 Q80 119 108 110" stroke={robe.trim} strokeWidth={4.5} />
        <path d="M84 115 L89 138 M86 115 L81 136" stroke={robe.trim} strokeWidth={2.2} />
        {/* Sleeves, wide at the wrist, their cuffs in the trim. */}
        <path
          d="M64 66 C54 76 46 98 39 119 L52 124 C56 106 60 90 67 79 Z"
          fill={robe.body}
          stroke={robe.trim}
          strokeOpacity={0.55}
          strokeWidth={1}
        />
        <path
          d="M96 66 C106 76 114 98 121 119 L108 124 C104 106 100 90 93 79 Z"
          fill={robe.body}
          stroke={robe.trim}
          strokeOpacity={0.55}
          strokeWidth={1}
        />
        <path d="M39 118 L52 123 M121 118 L108 123" stroke={robe.trim} strokeWidth={3.2} />
        {/* The weaving hands: where the Thread begins. */}
        <circle cx={45} cy={123} r={9} fill={`url(#${id('hand')})`} />
        <circle cx={115} cy={123} r={9} fill={`url(#${id('hand')})`} />
        <circle cx={45} cy={123} r={2.6} fill={ribbons.filament} />
        <circle cx={115} cy={123} r={2.6} fill={ribbons.filament} />
        {/* Hood and the shadow of a face, two glints for eyes. */}
        <path
          d="M80 29 C66 29 59 41 59 54 C59 63 63 69 70 71 L90 71 C97 69 101 63 101 54 C101 41 94 29 80 29 Z"
          fill={robe.body}
          stroke={robe.trim}
          strokeOpacity={0.6}
          strokeWidth={1.2}
        />
        <path
          d="M80 29 C66 29 59 41 59 54 C59 63 63 69 70 71 L90 71 C97 69 101 63 101 54 C101 41 94 29 80 29 Z"
          fill="#050814"
          fillOpacity={0.18}
        />
        <ellipse cx={80} cy={55} rx={10.5} ry={12.5} fill="#070b19" />
        <ellipse cx={80} cy={55} rx={12} ry={14} stroke={robe.trim} strokeWidth={1.6} />
        <ellipse cx={76} cy={53} rx={1.5} ry={0.9} fill={robe.glow} />
        <ellipse cx={84} cy={53} rx={1.5} ry={0.9} fill={robe.glow} />
        {/* The halo: the white-gold crown, in her robe's glow. */}
        <ellipse cx={80} cy={23} rx={18} ry={4.5} stroke={robe.glow} strokeWidth={2.2} />
        {!still &&
          MOTES.map((m) => (
            <circle
              key={m.d}
              cx={m.x}
              cy={m.y}
              r={1.4}
              fill={ribbons.filament}
              style={{ animation: `weaver-mote 4.6s ease-out ${m.d}s infinite`, opacity: 0 }}
            />
          ))}
      </g>
    </svg>
  );
}
