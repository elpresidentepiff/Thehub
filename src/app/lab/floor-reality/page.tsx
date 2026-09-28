import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import plan from '../../../../assets/plan/floor_unit4_l2.svg';
import { hubEnvironment } from '@/commerce/env.ts';
import { FloorRealityLab } from './FloorRealityLab.tsx';

export const metadata: Metadata = {
  title: 'Real floor test — The Hub at Lloyds Wharf',
  robots: { index: false, follow: false },
};

export default function FloorRealityLabPage() {
  if (hubEnvironment() !== 'development') notFound();

  return <FloorRealityLab planSrc={(plan as { src: string }).src} />;
}
