// Novice with her Solo-follow as built vs off: what the follow itself is worth, and what it costs.
import { NOVICE_SOLO, NOVICE_M4, NOVICE_CONDUCTING } from '/home/user/aw-work/wt-p11solo-review/src/bots/novice';
import { STUDY_FIGHTS, studyFight, type StudyRow } from '/home/user/aw-work/wt-p11solo-review/tools/solo-study';

const seeds = Number(process.argv[2] ?? 10);
function run(label: string): StudyRow[] {
  const rows: StudyRow[] = [];
  for (const f of STUDY_FIGHTS) for (let s = 1; s <= seeds; s++) rows.push(studyFight(label, f, 'novice', 1000 + s));
  return rows;
}
function rep(label: string, rows: StudyRow[]) {
  const by = (k: string | null) => rows.filter((r) => k === null || r.kind === k);
  for (const k of [null, 'boss', 'miniboss', 'skirmish', 'elite']) {
    const g = by(k);
    if (!g.length) continue;
    const win = g.filter((r) => r.outcome === 'victory').length / g.length;
    const cued = g.reduce((a, r) => a + r.cued, 0);
    const plain = g.reduce((a, r) => a + r.plain, 0);
    const downs = g.reduce((a, r) => a + r.downs, 0) / g.length;
    console.log(`${label.padEnd(10)} ${(k ?? 'all').padEnd(9)} n=${g.length} win=${(win * 100).toFixed(0)}% cued=${((cued / (cued + plain)) * 100).toFixed(0)}% downs=${downs.toFixed(2)}`);
  }
}
const built = run('built');
rep('built', built);
(NOVICE_SOLO as any).follow = 0;
(NOVICE_M4 as any).reigniteCue = 0;
(NOVICE_CONDUCTING as any).chain = 0;
(NOVICE_CONDUCTING as any).beat = 0;
const off = run('nofollow');
rep('nofollow', off);
