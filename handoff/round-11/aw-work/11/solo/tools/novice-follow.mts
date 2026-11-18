// The Novice under a Calling with her Solo-follow chance changed: npx tsx novice-follow.mts <calling> <follow> <seeds>
const root = '/home/user/aw-work/wt-p11solo';
const { studyFight, STUDY_FIGHTS, studyReport } = await import(`${root}/tools/solo-study.ts`);
const { NOVICE_SOLO } = await import(`${root}/src/bots/novice.ts`);
const calling = process.argv[2] === '-' ? undefined : process.argv[2];
const follow = Number(process.argv[3]);
const seeds = Number(process.argv[4] ?? 20);
(NOVICE_SOLO as { follow: number }).follow = follow;
if (process.argv[5]) (NOVICE_SOLO as { patience: number }).patience = Number(process.argv[5]);
const rows = [];
for (const fight of STUDY_FIGHTS)
  for (let i = 0; i < seeds; i++)
    rows.push(studyFight(`${calling ?? 'none'} follow=${follow} patience=${NOVICE_SOLO.patience}`, fight, 'novice', 1000 + i * 7919, calling ? { calling: { id: calling } } : {}));
for (const line of studyReport(rows, 'kind')) console.log(line.slice(0, 150));
