import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";
import { getEvents } from "@/lib/aws";
import { generateICS, filterEventsByDateRange } from "@/lib/icalendar";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('start');
    const endDate = searchParams.get('end');

    if (!startDate || !endDate) {
      return new NextResponse("Missing start or end date parameters", { status: 400 });
    }

    // Fetch all events for the user
    const events = await getEvents(session.user.id);
    
    // Map to expected format, using eventId as id if id is missing
    const mappedEvents = events.map(event => ({
      ...event,
      id: event.id || event.eventId,
    }));
    
    // Filter events by date range
    const filteredEvents = filterEventsByDateRange(mappedEvents, startDate, endDate);
    
    // Generate iCalendar content
    const icsContent = generateICS(filteredEvents);

    // Return as downloadable .ics file
    return new NextResponse(icsContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="student-calendar-${startDate}-to-${endDate}.ics"`,
      },
    });
  } catch (error) {
    console.error("Failed to export events:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
