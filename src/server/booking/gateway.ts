import 'server-only';
import { bookingConfig, canReadAvailability, canCreateBookings, type BookingConfig } from '@/commerce/booking-config.ts';
import { BookingGatewayError, type BookingGateway } from '@/commerce/booking-gateway.ts';
import { SupabaseBookingGateway } from './supabase-gateway.ts';

export function availabilityGateway(config: BookingConfig = bookingConfig()): BookingGateway {
  if (!canReadAvailability(config)) throw new BookingGatewayError('disabled', 'Live availability is not enabled yet.');
  return new SupabaseBookingGateway();
}

export function writableBookingGateway(config: BookingConfig = bookingConfig()): BookingGateway {
  if (!canCreateBookings(config)) throw new BookingGatewayError('disabled', 'Online booking is not enabled yet.');
  return new SupabaseBookingGateway();
}
