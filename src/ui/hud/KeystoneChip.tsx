import { astrolabeNode, astrolabeText } from '../../content';
import { KeystoneBadge } from '../kit/AstrolabeGlyph';
import { Tip } from '../kit/Tip';
import { starGlyph } from '../screens/astrolabeModel';
import { KeystoneTip } from '../screens/AstrolabeParts';

/**
 * The Astrolabe's keystones in the fight (Phase 4): one badge each, beside the Calling chip,
 * in its constellation's colour inside the keystone's diamond. Pointing at one (or focusing it)
 * says what it does and what it costs you. Nothing without a keystone.
 */
export function KeystoneChip({ keystones }: { keystones: readonly string[] }) {
  if (keystones.length === 0) return null;
  const nodes = keystones.map((id) => astrolabeNode(id));
  return (
    <div
      className="pointer-events-auto flex items-center gap-1 rounded-xl border border-ink-600/70 bg-ink-900/80 p-1 shadow-lg shadow-black/40 backdrop-blur-sm"
      role="group"
      aria-label={`Keystones: ${nodes.map((n) => n.name).join(', ')}`}
      data-testid="keystone-chip"
    >
      {nodes.map((n) => (
        <Tip key={n.id} tip={<KeystoneTip node={n} />} align="start" width="w-80">
          <span
            tabIndex={0}
            className="flex rounded-lg"
            aria-label={`${n.name}: ${astrolabeText(n)}`}
            data-keystone={n.id}
          >
            <KeystoneBadge glyph={starGlyph(n)} constellation={n.constellation} size={28} />
          </span>
        </Tip>
      ))}
    </div>
  );
}
