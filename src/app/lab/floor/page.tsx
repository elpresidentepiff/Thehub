import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import plan from '../../../../assets/plan/floor_unit4_l2.svg';
import { hubEnvironment } from '@/commerce/env.ts';
import { floorStates } from './actions.ts';
import { FloorLab } from './FloorLab.tsx';
import { addOnSummaries, catalogue, offerSummaries, registry, timeSlots, upcomingDays } from './lab-data.ts';

export const metadata: Metadata = {
  title: 'Floor lab — The Hub at Lloyds Wharf',
  robots: { index: false, follow: false },
};

/**
 * C1.4: the measured plan as scenery, the registry as the selectable layer, the commerce
 * engine behind it. Development only; production and preview get a 404.
 */
export default async function FloorLabPage() {
  await connection(); // rendered per request: today's date, live mock states
  if (hubEnvironment() !== 'development') notFound();

  const { rules } = catalogue();
  const days = upcomingDays(new Date());
  const first = days.find((d) => d.wholeDayOpen) ?? days[0];
  if (!first) notFound();
  const initialPeriod = { date: first.date, from: rules.opens, until: rules.closes };

  return (
    <FloorLab
      planSrc={(plan as { src: string }).src}
      floor={registry.floor}
      registryStatus={registry.status}
      spaces={registry.spaces}
      units={registry.units}
      offers={offerSummaries()}
      addOns={addOnSummaries()}
      days={days}
      slots={timeSlots()}
      initialPeriod={initialPeriod}
      initialView={await floorStates(initialPeriod)}
    />
  );
}
