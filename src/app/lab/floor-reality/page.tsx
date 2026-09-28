import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import plan from '../../../../assets/plan/floor_unit4_l2.svg';
import registryJson from '../../../../data/inventory/unit4-l2.json';
import { hubEnvironment } from '@/commerce/env.ts';
import { FloorPlan3D } from './FloorPlan3D.tsx';

export const metadata: Metadata = {
  title: '3D floor plan — The Hub at Lloyds Wharf',
  robots: { index: false, follow: false },
};

export default function FloorRealityLabPage() {
  if (hubEnvironment() !== 'development') notFound();

  return <FloorPlan3D planSrc={(plan as { src: string }).src} registry={registryJson} />;
}
