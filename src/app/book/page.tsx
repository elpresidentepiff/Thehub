import type { Metadata } from 'next';
import Link from 'next/link';
import plan from '../../../assets/plan/floor_unit4_l2.svg';
import registryJson from '../../../data/inventory/unit4-l2.json';
import { parseRegistry } from '@/commerce/inventory.ts';
import { FloorPicker } from '@/features/booking-floor/FloorPicker.tsx';
import { publicUnitProjection } from '@/features/booking-floor/public-unit.ts';
import './book.css';

export const metadata: Metadata = {
  title: 'Choose your space',
  description: 'Explore desks, meeting rooms and private offices at The Hub at Lloyds Wharf.',
};

const registry = parseRegistry(registryJson);

export default function BookPage() {
  return (
    <main className="book-page" id="main">
      <header className="book-header">
        <Link href="/" className="book-brand">The Hub at Lloyds Wharf</Link>
        <nav aria-label="Main navigation">
          <a href="#floor">Choose a space</a>
          <a href="#visit">Visit</a>
          <a href="#questions">FAQs</a>
          <Link href="/contact">Contact</Link>
        </nav>
      </header>

      <section className="book-hero" aria-labelledby="book-title">
        <p>Work · meet · create · connect · belong</p>
        <h1 id="book-title">Choose your space.</h1>
        <span>Explore the floor now. Live availability, pricing and secure payment are being connected.</span>
      </section>

      <section className="book-floor" id="floor" aria-labelledby="floor-title">
        <div className="book-heading">
          <p>Unit 4 · Second floor</p>
          <h2 id="floor-title">Pick a desk or room.</h2>
          <span>Select a place to inspect it. Nothing will be charged while the booking connection is being completed.</span>
        </div>
        <FloorPicker
          floor={registry.floor}
          planSrc={(plan as { src: string }).src}
          spaces={registry.spaces}
          units={registry.units.filter((unit) => !unit.retired).map(publicUnitProjection)}
        />
      </section>

      <div className="book-information">
        <section aria-labelledby="how-title">
          <p>How booking works</p>
          <h2 id="how-title">A short route from arrival to your place.</h2>
          <ol className="book-steps">
            <li><b>1</b><span><strong>Choose</strong>Pick a desk, room or office on the plan.</span></li>
            <li><b>2</b><span><strong>Check</strong>Choose your date and time when live availability opens.</span></li>
            <li><b>3</b><span><strong>Book</strong>Review the price and complete secure payment.</span></li>
          </ol>
        </section>

        <section className="book-split" aria-labelledby="space-title">
          <div>
            <p>The space</p>
            <h2 id="space-title">A clear view of the whole floor.</h2>
          </div>
          <p>The plan shows the nineteen desk positions, meeting rooms and private offices. Select any marked place for its name and capacity. Final live availability will always come from the booking system before payment.</p>
        </section>

        <section className="book-split" id="visit" aria-labelledby="visit-title">
          <div>
            <p>Visit us</p>
            <h2 id="visit-title">The Hub at Lloyds Wharf</h2>
          </div>
          <address>2 Mill Street<br />Shad Thames<br />London SE1 2BD</address>
        </section>

        <section className="book-split" aria-labelledby="access-title">
          <div>
            <p>Accessibility and contact</p>
            <h2 id="access-title">Plan your visit with us.</h2>
          </div>
          <div>
            <p>If you have an access requirement or would like help choosing a suitable space, contact the team before your visit.</p>
            <Link className="book-text-link" href="/contact">Contact The Hub <span aria-hidden="true">→</span></Link>
          </div>
        </section>

        <section id="questions" aria-labelledby="faq-title">
          <p>Frequently asked questions</p>
          <h2 id="faq-title">Before you book.</h2>
          <div className="book-faqs">
            <details><summary>Can I book online now?</summary><p>Not yet. The floor is open to explore while live availability, pricing and secure payment are connected.</p></details>
            <details><summary>What can I choose on the plan?</summary><p>You can inspect individual desks, meeting rooms and private offices. Each selectable place has a stable reference and capacity.</p></details>
            <details><summary>Will the plan prevent double bookings?</summary><p>Yes. When booking opens, the server will check live availability and temporarily hold your selection before payment.</p></details>
            <details><summary>Where can I ask a question?</summary><p>Use the contact page and tell us what kind of space or visit you are planning.</p></details>
          </div>
        </section>
      </div>

      <footer className="book-footer">
        <Link href="/">The Hub at Lloyds Wharf</Link>
        <div>
          <Link href="/contact">Contact</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/privacy">Privacy</Link>
        </div>
      </footer>
    </main>
  );
}
