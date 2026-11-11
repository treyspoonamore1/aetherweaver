import { useState } from 'react';
import { useRun } from '../../app/runStore';
import type { RunState, ShopItem } from '../../meta/types';
import { ScreenFrame, ScreenHeader } from '../kit/Backdrop';
import { Button } from '../kit/Button';
import { Icon } from '../kit/Icon';
import { playUi, useMood } from '../kit/sound';
import { MotifCard, harmonyHave } from './DraftScreen';
import { relicInfo, shopItemName, shopItemStatus, type ShopItemStatus } from './interlude';
import { Purse, RelicCard, RunStrip } from './RelicCard';
import { PartyHealth, SectionTitle } from './shared';
import { t } from '../text';

export interface MerchantViewProps {
  run: RunState;
  onBuy(index: number): void;
  onLeave(): void;
}

/** What a card's footer says: the price and Buy, the shortfall, or that it's sold. */
function BuyLine({
  item,
  status,
  verb = t('screens.merchantScreen.buy'),
}: {
  item: ShopItem;
  status: ShopItemStatus;
  verb?: string;
}) {
  if (item.sold)
    return (
      <span className="flex items-center justify-center gap-1.5 rounded-lg border border-heal/50 bg-heal/10 py-2 text-sm font-semibold text-heal">
        <Icon name="check" size={15} /> {t('screens.merchantScreen.soldYoursNow')}
      </span>
    );
  return (
    <span
      className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm font-semibold ${status.available ? 'bg-gold-400 text-ink-950 opacity-90 group-hover:opacity-100' : 'border border-ink-500 bg-ink-900/70 text-muted'}`}
    >
      <span className="flex items-center gap-1">
        <Icon name="aether" size={15} />
        <span className="font-mono">{item.price}</span>
      </span>
      <span>{status.available ? verb : status.problem}</span>
    </span>
  );
}

/** A merchant: three relics, two motifs and healing, each once, for Aether. */
export function MerchantView({ run, onBuy, onLeave }: MerchantViewProps) {
  useMood('map');
  const [said, setSaid] = useState<string | null>(null);
  const shop = run.shop;
  if (!shop) return null;
  const buy = (i: number) => {
    const item = shop.items[i]!;
    const status = shopItemStatus(run, item);
    if (!status.available) {
      playUi(item.sold ? 'error' : 'cantAfford');
      setSaid(`${shopItemName(item)}: ${status.problem}.`);
      return;
    }
    playUi('buy');
    setSaid(
      t('screens.merchantScreen.boughtForAether', {
        shopItemName: shopItemName(item),
        price: item.price,
      }),
    );
    onBuy(i);
  };
  const items = shop.items.map((item, index) => ({ item, index }));
  const relics = items.filter((x) => x.item.kind === 'relic');
  const motifs = items.filter((x) => x.item.kind === 'motif');
  const heal = items.find((x) => x.item.kind === 'heal');
  const full = run.party.every((h) => h.hpPct >= 0.999);
  return (
    <ScreenFrame tone="gold">
      <div className="mx-auto max-w-6xl px-6 pb-28 pt-8">
        <ScreenHeader
          eyebrow={t('screens.merchantScreen.aMerchantEachItem')}
          title={t('screens.merchantScreen.theMerchant')}
          right={<Purse aether={run.aether} size="lg" />}
        >
          <p className="mt-2 max-w-2xl text-sm text-muted">
            {t('screens.merchantScreen.aPackMuleOf')}
          </p>
        </ScreenHeader>
        <RunStrip
          className="mt-4 w-fit"
          calling={run.calling}
          map={run.map}
          aether={run.aether}
          purse={false}
          relics={run.relics}
          carried={run.carried}
          boons={run.boons}
        />

        <section className="mt-6" aria-label={t('screens.merchantScreen.relicsForSale')}>
          <SectionTitle>{t('screens.merchantScreen.relics')}</SectionTitle>
          <ul className="grid gap-5 md:grid-cols-3">
            {relics.map(({ item, index }) => {
              const info = relicInfo(item.id);
              const status = shopItemStatus(run, item);
              return (
                <li key={index}>
                  <RelicCard
                    info={info}
                    onClick={() => buy(index)}
                    disabled={!status.available}
                    dim={item.sold}
                    label={t('screens.merchantScreen.relicAether', {
                      name: info.name,
                      rarityLabel: info.rarityLabel,
                      price: item.price,
                      value: status.problem ? `: ${status.problem}` : '',
                      rule: info.rule,
                      value2: info.curse
                        ? t('screens.merchantScreen.curse', { curse: info.curse })
                        : '',
                    })}
                    footer={<BuyLine item={item} status={status} />}
                  />
                </li>
              );
            })}
          </ul>
        </section>

        <section className="mt-8" aria-label={t('screens.merchantScreen.motifsAndHealingFor')}>
          <SectionTitle>{t('screens.merchantScreen.motifsAndHealing')}</SectionTitle>
          <ul className="grid gap-5 md:grid-cols-3">
            {motifs.map(({ item, index }) => {
              const status = shopItemStatus(run, item);
              return (
                <li key={index}>
                  <MotifCard
                    option={{ motifId: item.id, level: item.level, upgrade: item.upgrade }}
                    onPick={() => buy(index)}
                    party={run.party.map((h) => h.heroId)}
                    have={harmonyHave(run)}
                    disabled={!status.available}
                    dim={item.sold}
                    label={t('screens.merchantScreen.aether', {
                      shopItemName: shopItemName(item),
                      value: item.upgrade
                        ? t('screens.merchantScreen.upgradeToLevel', { level: item.level })
                        : t('screens.merchantScreen.newMotif'),
                      price: item.price,
                      value2: status.problem ? `: ${status.problem}` : '',
                    })}
                    action={
                      <span className="mt-4 block">
                        <BuyLine
                          item={item}
                          status={status}
                          verb={
                            item.upgrade
                              ? t('screens.merchantScreen.strengthen')
                              : t('screens.merchantScreen.weaveIn')
                          }
                        />
                      </span>
                    }
                  />
                </li>
              );
            })}
            {heal && (
              <li>
                <HealCard
                  run={run}
                  item={heal.item}
                  status={shopItemStatus(run, heal.item)}
                  full={full}
                  onBuy={() => buy(heal.index)}
                />
              </li>
            )}
          </ul>
        </section>
      </div>
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex items-center justify-end gap-4 bg-gradient-to-t from-ink-950 via-ink-950/80 to-transparent px-6 pb-5 pt-10">
        <p className="text-sm text-muted" role="status" aria-live="polite">
          {said}
        </p>
        <Button
          variant="primary"
          size="lg"
          className="pointer-events-auto"
          onClick={onLeave}
          sound="confirm"
        >
          {t('screens.merchantScreen.leaveTheMerchant')} <Icon name="arrow" size={18} />
        </Button>
      </div>
    </ScreenFrame>
  );
}

function HealCard({
  run,
  item,
  status,
  full,
  onBuy,
}: {
  run: RunState;
  item: ShopItem;
  status: ShopItemStatus;
  full: boolean;
  onBuy(): void;
}) {
  const pctText = `${Math.round(item.heal * 100)}%`;
  return (
    <button
      type="button"
      onClick={onBuy}
      aria-disabled={!status.available || undefined}
      aria-label={t('screens.merchantScreen.healingEveryHeroHeals', {
        pctText,
        price: item.price,
        value: status.problem ? `: ${status.problem}` : '',
      })}
      className={`group flex h-full w-full flex-col rounded-2xl border-2 border-heal/70 bg-ink-800/90 p-5 text-left shadow-xl shadow-black/40 transition-all ${status.available ? 'hover:-translate-y-1.5 hover:bg-ink-700/90' : 'cursor-not-allowed'} ${item.sold ? 'opacity-55 saturate-50' : ''}`}
    >
      <span className="flex items-center gap-1.5 text-sm font-semibold text-heal">
        <Icon name="heart" size={18} /> {t('screens.merchantScreen.healing')}
        <span className="text-xs font-normal text-muted">
          {t('screens.merchantScreen.forTheWholeParty')}
        </span>
      </span>
      <h2 className="mt-3 font-display text-2xl font-bold leading-tight text-text">
        {t('screens.merchantScreen.aDraughtOfLight')}
      </h2>
      <p className="mt-3 text-base leading-relaxed text-text">
        {t('screens.merchantScreen.everyHeroHealsOf', { pctText })}
      </p>
      <div className="mt-3 flex flex-col gap-2.5">
        {run.party.map((h) => (
          <PartyHealth key={h.heroId} hero={h} preview={item.sold ? undefined : item.heal} />
        ))}
      </div>
      {full && !item.sold && (
        <p className="mt-2 text-xs text-muted">{t('screens.merchantScreen.everyoneIsAtFull')}</p>
      )}
      <span className="mt-auto block pt-4">
        <BuyLine item={item} status={status} verb={t('screens.merchantScreen.drink')} />
      </span>
    </button>
  );
}

export function MerchantScreen() {
  const run = useRun((s) => s.run);
  const buy = useRun((s) => s.buy);
  const leave = useRun((s) => s.leaveShop);
  if (!run) return null;
  return <MerchantView run={run} onBuy={buy} onLeave={leave} />;
}
