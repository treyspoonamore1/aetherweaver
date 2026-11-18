const root = process.argv[2]!;
const { playRun } = await import(`${root}/tools/harness-core.ts`);
for (let seed = 1; seed <= 30; seed++) {
  let drafts = 0;
  let relics = 0;
  const r = playRun(seed, 'skilled', undefined, {
    movements: 2,
    onPhase: (phase: string, run: { draft?: { options: unknown[] }; relicOffer?: { options: unknown[] } }) => {
      if (phase === 'draft' && run.draft && run.draft.options.length > 1) drafts++;
      if (phase === 'relic' && run.relicOffer && run.relicOffer.options.length > 1) relics++;
    },
  });
  const skipped = playRun(seed, 'skilled', undefined, { movements: 2, draftPrefer: () => null });
  console.log(seed, r.outcome, r.fights, 'drafts', drafts, 'relic offers', relics, 'skipped run motifs', skipped.motifs.length, skipped.fights);
}
