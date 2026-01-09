/**
 * iCalendar (.ics) generation utility
 * Generates standard iCalendar format for export to Apple Calendar, Google Calendar, Outlook, etc.
 */

interface CalendarEvent {
  id: string;
  title: string;
  date?: string;
  type?: string;
  description?: string;
  location?: string;
  time?: string;
  priority?: string;
  courseTitle?: string;
  courseCode?: string;
}

/**
 * Escapes special characters for iCalendar format
 * Per RFC 5545: backslash, semicolon, and comma must be escaped
 * Newlines are converted to literal \n
 */
function escapeICS(text: string): string {
  if (!text) return '';
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

/**
 * Formats a date string (YYYY-MM-DD) to iCalendar date format (YYYYMMDD)
 */
function formatICSDate(dateStr: string): string {
  return dateStr.replace(/-/g, '');
}

/**
 * Parses a time string like "3:00 PM" or "15:00" to HHMMSS format
 * Returns null if parsing fails
 */
function parseTimeToICS(timeStr: string): string | null {
  if (!timeStr) return null;
  
  // Try parsing "3:00 PM" format
  const match12h = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (match12h) {
    let hours = parseInt(match12h[1], 10);
    const minutes = match12h[2];
    const period = match12h[3]?.toUpperCase();
    
    if (period === 'PM' && hours !== 12) {
      hours += 12;
    } else if (period === 'AM' && hours === 12) {
      hours = 0;
    }
    
    return `${hours.toString().padStart(2, '0')}${minutes}00`;
  }
  
  return null;
}

/**
 * Generates a unique identifier for an event
 */
function generateUID(eventId: string): string {
  return `${eventId}@student-calendar`;
}

/**
 * Generates the DTSTART/DTEND lines for an event
 */
function generateDateTimeLines(event: CalendarEvent): string[] {
  if (!event.date) {
    // If no date, use today's date as fallback
    const today = new Date();
    const fallbackDate = today.toISOString().split('T')[0].replace(/-/g, '');
    return [
      `DTSTART;VALUE=DATE:${fallbackDate}`,
      `DTEND;VALUE=DATE:${fallbackDate}`
    ];
  }
  
  const dateStr = formatICSDate(event.date);
  const timeStr = event.time ? parseTimeToICS(event.time) : null;
  
  if (timeStr) {
    // Event with specific time (1 hour duration assumed)
    const startDateTime = `${dateStr}T${timeStr}`;
    // Calculate end time (1 hour later)
    const startHour = parseInt(timeStr.substring(0, 2), 10);
    const endHour = (startHour + 1) % 24;
    const endTime = `${endHour.toString().padStart(2, '0')}${timeStr.substring(2)}`;
    const endDateTime = `${dateStr}T${endTime}`;
    
    return [
      `DTSTART:${startDateTime}`,
      `DTEND:${endDateTime}`
    ];
  } else {
    // All-day event
    return [
      `DTSTART;VALUE=DATE:${dateStr}`,
      `DTEND;VALUE=DATE:${dateStr}`
    ];
  }
}

/**
 * Builds the description field combining multiple event properties
 */
function buildDescription(event: CalendarEvent): string {
  const parts: string[] = [];
  
  if (event.courseCode || event.courseTitle) {
    parts.push(`Course: ${[event.courseCode, event.courseTitle].filter(Boolean).join(' - ')}`);
  }
  
  if (event.type) {
    parts.push(`Type: ${event.type.charAt(0).toUpperCase() + event.type.slice(1).replace('_', ' ')}`);
  }
  
  if (event.priority) {
    parts.push(`Priority: ${event.priority.charAt(0).toUpperCase() + event.priority.slice(1)}`);
  }
  
  if (event.description) {
    parts.push('', event.description);
  }
  
  return parts.join('\\n');
}

/**
 * Converts an array of events to iCalendar format
 */
export function generateICS(events: CalendarEvent[]): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Student Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Student Calendar Export'
  ];
  
  const now = new Date();
  const timestamp = now.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  
  for (const event of events) {
    const eventLines: string[] = [
      'BEGIN:VEVENT',
      `UID:${generateUID(event.id)}`,
      `DTSTAMP:${timestamp}`,
      ...generateDateTimeLines(event),
      `SUMMARY:${escapeICS(event.title)}`
    ];
    
    if (event.location) {
      eventLines.push(`LOCATION:${escapeICS(event.location)}`);
    }
    
    const description = buildDescription(event);
    if (description) {
      eventLines.push(`DESCRIPTION:${escapeICS(description)}`);
    }
    
    if (event.type) {
      eventLines.push(`CATEGORIES:${event.type.toUpperCase()}`);
    }
    
    eventLines.push('END:VEVENT');
    lines.push(...eventLines);
  }
  
  lines.push('END:VCALENDAR');
  
  // iCalendar requires CRLF line endings
  return lines.join('\r\n');
}

/**
 * Filters events by date range
 */
export function filterEventsByDateRange(
  events: CalendarEvent[],
  startDate: string,
  endDate: string
): CalendarEvent[] {
  return events.filter(event => {
    if (!event.date) return false;
    return event.date >= startDate && event.date <= endDate;
  });
}
