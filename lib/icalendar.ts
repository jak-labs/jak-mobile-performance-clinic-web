/**
 * Generate iCalendar (.ics) file content for calendar invites
 */

export interface CalendarEvent {
  summary: string;
  description: string;
  startDate: Date;
  endDate: Date;
  location?: string;
  organizer?: {
    name: string;
    email: string;
  };
  attendee?: {
    name: string;
    email: string;
  };
  url?: string;
}

/**
 * Generate iCalendar (.ics) file content
 */
export function generateICS(event: CalendarEvent): string {
  const formatDate = (date: Date): string => {
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  };

  const escapeText = (text: string): string => {
    return text
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\n/g, '\\n');
  };

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//JAK Labs//Calendar Invite//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${Date.now()}-${Math.random().toString(36).substring(7)}@jak-labs.com`,
    `DTSTAMP:${formatDate(new Date())}`,
    `DTSTART:${formatDate(event.startDate)}`,
    `DTEND:${formatDate(event.endDate)}`,
    `SUMMARY:${escapeText(event.summary)}`,
    `DESCRIPTION:${escapeText(event.description)}`,
  ];

  if (event.location) {
    lines.push(`LOCATION:${escapeText(event.location)}`);
  }

  if (event.organizer) {
    lines.push(`ORGANIZER;CN="${escapeText(event.organizer.name)}":MAILTO:${event.organizer.email}`);
  }

  if (event.attendee) {
    lines.push(`ATTENDEE;CN="${escapeText(event.attendee.name)}";RSVP=TRUE:MAILTO:${event.attendee.email}`);
  }

  if (event.url) {
    lines.push(`URL:${event.url}`);
  }

  lines.push('STATUS:CONFIRMED');
  lines.push('SEQUENCE:0');
  lines.push('END:VEVENT');
  lines.push('END:VCALENDAR');

  return lines.join('\r\n');
}

