import { notFound } from "next/navigation";
import { BookingClient } from "./booking-client";
import { getBookingTypeBySlug, getBusySlots } from "./book-action";

export default async function BookingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const bookingType = await getBookingTypeBySlug(slug);

  if (!bookingType) notFound();

  // שלוף slots תפוסים ל-14 ימים קדימה
  const from = new Date();
  from.setDate(from.getDate() + 1);
  from.setHours(0, 0, 0, 0);

  const to = new Date();
  to.setDate(to.getDate() + 15);
  to.setHours(23, 59, 59, 999);

  const busySlots = await getBusySlots(
    bookingType.tenant_id,
    from.toISOString(),
    to.toISOString(),
  );

  return <BookingClient bookingType={bookingType} busySlots={busySlots} />;
}
