import { CONTENT } from '/home/user/aw-work/wt-p11solo/src/content';
for (const c of CONTENT.callings)
  console.log(c.id, c.tiers.map((t) => t.options[0]!.id).join(','), '|', c.tiers.map((t) => t.options[1]!.id).join(','));
