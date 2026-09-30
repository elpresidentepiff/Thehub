import type { UnitState } from './availability.ts';

export interface BookingAction {
  /** Commercial choices are useful only while the selected unit is actually available. */
  showCommerce: boolean;
  /** This remains false in the lab; a future live route must opt in explicitly. */
  canHold: boolean;
  buttonLabel: string;
  explanation: string;
}

export interface BookingRefreshRequest<Period> {
  period: Period;
  unitId: string | null;
  addOns: string[];
}

export interface BookingRefreshResult<View, Quote> {
  view: View;
  quote: Quote | null;
}

export interface LatestRequestCoordinator {
  /** Begin a request and receive a predicate which is true only while it remains the latest. */
  begin: () => () => boolean;
}

/** A component-local last-write-wins guard for async availability and quote refreshes. */
export function createLatestRequestCoordinator(): LatestRequestCoordinator {
  let latest = 0;
  return {
    begin() {
      const request = ++latest;
      return () => request === latest;
    },
  };
}

const BLOCKED_ACTIONS: Record<Exclude<UnitState, 'available'>, Omit<BookingAction, 'showCommerce' | 'canHold'>> = {
  held: {
    buttonLabel: 'Being booked by someone else',
    explanation: 'Another visitor has a temporary hold. Choose another place or check again when their hold expires.',
  },
  unavailable: {
    buttonLabel: 'Already booked',
    explanation: 'This place is booked for the selected time. Choose another place or change the time.',
  },
  closed: {
    buttonLabel: 'Closed for this time',
    explanation: 'Choose a time within the floor’s opening hours.',
  },
  not_bookable: {
    buttonLabel: 'Not available to book',
    explanation: 'This place is shown for orientation, but it is not offered for self-service booking.',
  },
  yours: {
    buttonLabel: 'Already yours',
    explanation: 'This place is already held or booked for you for the selected time. No new hold is needed.',
  },
};

/**
 * One fail-closed decision for the detail panel. Availability controls both the commercial
 * information we reveal and whether the primary action can run; a button alone is not the guard.
 */
export function bookingAction(state: UnitState | undefined, liveBookingEnabled = false): BookingAction {
  if (!state) {
    return {
      showCommerce: false,
      canHold: false,
      buttonLabel: 'Checking availability',
      explanation: 'Checking this place for the selected time before showing booking choices.',
    };
  }

  if (state !== 'available') {
    return { showCommerce: false, canHold: false, ...BLOCKED_ACTIONS[state] };
  }

  return liveBookingEnabled
    ? {
        showCommerce: true,
        canHold: true,
        buttonLabel: 'Hold this place',
        explanation: 'This place is free. Hold it before continuing to payment.',
      }
    : {
        showCommerce: true,
        canHold: false,
        buttonLabel: 'Booking not connected yet',
        explanation: 'This place is free, but live holds stay off until the secure booking backend is connected.',
      };
}

/**
 * Fetch availability before deciding whether to quote. Each invocation is self-contained: it
 * cannot borrow availability from an earlier period, and a missing unit fails closed.
 */
export async function resolveBookingRefresh<Period, View extends { states: Record<string, UnitState> }, Quote>(
  request: BookingRefreshRequest<Period>,
  loaders: {
    states: (period: Period) => Promise<View>;
    quote: (request: BookingRefreshRequest<Period> & { unitId: string }) => Promise<Quote>;
  },
): Promise<BookingRefreshResult<View, Quote>> {
  const view = await loaders.states(request.period);
  if (!request.unitId || view.states[request.unitId] !== 'available') return { view, quote: null };
  const quote = await loaders.quote({ ...request, unitId: request.unitId });
  return { view, quote };
}
