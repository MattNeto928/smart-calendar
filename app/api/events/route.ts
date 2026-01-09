import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";
import { saveEvent, getEvents, deleteEvent, deleteAllEvents } from "@/lib/aws";
import { CalendarEvent } from "@/lib/aws";

export async function GET() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    console.log('Fetching events for user:', session.user.id);
    const events = await getEvents(session.user.id);
    console.log('Events fetched successfully:', events);
    return NextResponse.json(events);
  } catch (error) {
    console.error("Failed to fetch events:", {
      error,
      userId: session.user.id,
      sessionData: session
    });
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const event = await request.json();
    const calendarEvent: CalendarEvent = {
      ...event,
      userId: session.user.id,
      eventId: event.id,
      createdAt: new Date().toISOString(), // Use ISO string
      updatedAt: new Date().toISOString(), // Use ISO string
    };

    await saveEvent(calendarEvent);
    return NextResponse.json(calendarEvent);
  } catch (error) {
    console.error("Failed to save event:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('eventId');

    if (eventId) {
      await deleteEvent(session.user.id, eventId);
    } else {
      await deleteAllEvents(session.user.id);
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Failed to delete event(s):", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
