import { useState } from 'react';
import { ChevronLeft, ChevronRight, Heart, Link2, Shield, Sparkles, Swords, X, Zap } from 'lucide-react';
import { Keycap } from './ui';

const STEPS = [
  {
    icon: Heart,
    color: 'text-emerald-300',
    title: 'You are the support — your party is the weapon',
    body: 'You deal no direct damage. Kael tanks, Lyra and Vexis carry — and every point of their damage flows through your auras, beams and saves. Watch your Attribution % climb as you stack power.',
    keys: [],
  },
  {
    icon: Swords,
    color: 'text-sky-300',
    title: 'Tether a hero, then weave Heal ⇄ Amp',
    body: 'Left-click a hero (or press 1 / 2 / 3) to latch your Caduceus Beam. Right-click or Q swaps between Mending Stream (heal + overshield) and Damage Amp (+more damage, crit multi). Great weavers swap constantly.',
    keys: ['LMB', '1-3', 'RMB', 'Q'],
  },
  {
    icon: Shield,
    color: 'text-yellow-300',
    title: 'Cleanse the moment ailments land',
    body: 'Bleed, Void Rot and Freeze will delete your party if ignored. Press E at your cursor to throw a Purifying Chime: it cleanses, bursts healing, and grants brief immunity. Time it just before red boss slams.',
    keys: ['E'],
  },
  {
    icon: Link2,
    color: 'text-amber-300',
    title: 'Stack auras like a PoE aurabot',
    body: 'Open the Conduit Matrix (G) to socket auras into linked clusters. Chase Reservation Efficiency, link Enlighten and Arrogance, and push toward 5–6 simultaneous auras to unlock Chorus Harmonics milestones.',
    keys: ['G'],
  },
  {
    icon: Zap,
    color: 'text-teal-300',
    title: 'Bank Resonance, then unleash Cascade',
    body: 'Supporting builds Resonance. A full bar banks an Aether Charge. Press X to spend all charges on Resonant Cascade: cooldowns reset and your whole kit surges. Answer boss Decrees for bonus charges.',
    keys: ['X'],
  },
  {
    icon: Sparkles,
    color: 'text-purple-300',
    title: 'Progress everywhere, all at once',
    body: 'Astrolabe (P) for passives, Relics (I) for gear crafting, Atlas (M) for harder tiers and loot, Ascendancy (V) for your specialization, Legacy (K) for permanent prestige. Everything auto-saves.',
    keys: ['P', 'I', 'M', 'V', 'K'],
  },
];

export function TutorialOverlay({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const s = STEPS[step];
  const Icon = s.icon;

  return (
    <div className="absolute inset-0 z-[60] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-md glass panel-gold rounded-2xl p-6 animate-modal-in relative">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300"
          title="Skip tutorial"
        >
          <X className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-3 mb-3">
          <div className="w-11 h-11 rounded-xl bg-slate-900 border border-amber-500/40 flex items-center justify-center shrink-0">
            <Icon className={`w-5 h-5 ${s.color}`} />
          </div>
          <div>
            <div className="text-[10px] font-mono-num text-slate-400 uppercase tracking-widest">
              Weaver Primer {step + 1} / {STEPS.length}
            </div>
            <h2 className="font-display font-extrabold text-base text-amber-100 leading-tight mt-0.5">{s.title}</h2>
          </div>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed min-h-[72px]">{s.body}</p>
        {s.keys.length > 0 && (
          <div className="flex items-center gap-1.5 mt-3 flex-wrap">
            {s.keys.map((k) => (
              <Keycap key={k}>{k}</Keycap>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between mt-5">
          <button
            onClick={() => setStep((v) => Math.max(0, v - 1))}
            disabled={step === 0}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-xs font-bold text-slate-200 flex items-center gap-1"
          >
            <ChevronLeft className="w-3.5 h-3.5" /> Back
          </button>
          <div className="flex items-center gap-1">
            {STEPS.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                className={`w-2 h-2 rounded-full transition ${i === step ? 'bg-amber-400' : 'bg-slate-700 hover:bg-slate-600'}`}
              />
            ))}
          </div>
          {step < STEPS.length - 1 ? (
            <button
              onClick={() => setStep((v) => v + 1)}
              className="px-4 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-extrabold flex items-center gap-1"
            >
              Next <ChevronRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-yellow-400 hover:brightness-110 text-slate-950 text-xs font-extrabold"
            >
              Enter the Sanctum →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
