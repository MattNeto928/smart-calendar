"use client"

import React, { useState } from 'react';
import { Calendar as CalendarIcon, LogOut } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { geminiParser } from '@/lib/gemini';
import { EventConfirmationDialog } from './EventConfirmationDialog';
import { EditEventDialog } from './EditEventDialog';
import { SyncStatus, SyncState } from './SyncStatus';
import { useAuth } from '@/lib/auth-context';
import { ClearCalendarDialog } from './ClearCalendarDialog';

interface Event {
  id: string;
  title: string;
  date: string;
  type: 'test' | 'assignment' | 'meeting' | 'office_hours';
  description?: string;
  location?: string;
  time?: string;
  priority?: 'low' | 'medium' | 'high';
  courseTitle?: string;
  courseCode?: string;
  selected?: boolean;
}

interface CalendarDay {
  date: Date | null;
  events: Event[];
}

const StudentCalendar: React.FC = () => {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [events, setEvents] = useState<Event[]>([]);
  const [syncState, setSyncState] = useState<SyncState>('synced');
  const [lastSynced, setLastSynced] = useState<Date>();
  const { user, signOut } = useAuth();
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showEventDialog, setShowEventDialog] = useState(false);
  const [pendingEvents, setPendingEvents] = useState<Event[]>([]);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showClearDialog, setShowClearDialog] = useState(false);

  const monthNames: string[] = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const getDaysInMonth = (date: Date): CalendarDay[] => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    
    const days: CalendarDay[] = [];
    
    // Add empty days for padding
    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push({ date: null, events: [] });
    }
    
    // Add actual days
    for (let i = 1; i <= daysInMonth; i++) {
      const currentDate = new Date(year, month, i);
      days.push({
        date: currentDate,
        events: events.filter(event => event.date === currentDate.toDateString())
      });
    }
    
    return days;
  };

  const navigateMonth = (direction: number): void => {
    const newDate = new Date(currentDate);
    newDate.setMonth(currentDate.getMonth() + direction);
    setCurrentDate(newDate);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const files = event.target.files;
    if (!files) return;

    setIsProcessing(true);
    try {
      const newEvents = await Promise.all(
        Array.from(files).map(async (file) => {
          try {
            const extractedEvents = await geminiParser.parseFile(file);
            return extractedEvents;
          } catch (error) {
            console.error(`Error processing file ${file.name}:`, error);
            return [];
          }
        })
      );
      
      // Flatten the array of arrays and filter out empty results
      const flattenedEvents = newEvents.flat().filter(Boolean);
      
      // Show confirmation dialog with pending events
      setPendingEvents(flattenedEvents);
      setShowEventDialog(true);
    } catch (error) {
      console.error('Error processing files:', error);
    } finally {
      setIsProcessing(false);
      // Reset file input to allow the same file to be uploaded again
      const fileInput = document.getElementById('file-upload') as HTMLInputElement;
      if (fileInput) {
        fileInput.value = '';
      }
    }
  };

  const handleEventConfirmation = async (confirmedEvents: Event[]) => {
    try {
      setSyncState('syncing');
      
      // Sync each event to the cloud
      await Promise.all(confirmedEvents.map(event => syncEvent(event)));
      
      setEvents(prevEvents => [...prevEvents, ...confirmedEvents]);
      setPendingEvents([]);
      
      setSyncState('synced');
      setLastSynced(new Date());
    } catch (error) {
      console.error('Failed to sync confirmed events:', error);
      setSyncState('error');
    }
  };

  const handleDateSelect = (date: Date | null): void => {
    if (!date) return;
    setSelectedDate(date);
  };

  const isToday = (date: Date): boolean => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  // Load events from cloud on component mount
  React.useEffect(() => {
    if (user) {
      loadEvents();
    }
  }, [user]);

  const loadEvents = async () => {
    try {
      setSyncState('syncing');
      const response = await fetch('/api/events');
      if (!response.ok) throw new Error('Failed to fetch events');
      
      const cloudEvents = await response.json();
      setEvents(cloudEvents);
      setSyncState('synced');
      setLastSynced(new Date());
    } catch (error) {
      console.error('Failed to load events:', error);
      setSyncState('error');
    }
  };

  const syncEvent = async (event: Event) => {
    try {
      setSyncState('syncing');
      const response = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event),
      });
      
      if (!response.ok) throw new Error('Failed to sync event');
      
      setSyncState('synced');
      setLastSynced(new Date());
    } catch (error) {
      console.error('Failed to sync event:', error);
      setSyncState('error');
    }
  };

  const deleteCloudEvent = async (eventId?: string) => {
    try {
      setSyncState('syncing');
      const url = eventId 
        ? `/api/events?eventId=${eventId}`
        : '/api/events';
      
      const response = await fetch(url, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete event(s)');
      
      setSyncState('synced');
      setLastSynced(new Date());
    } catch (error) {
      console.error('Failed to delete event(s):', error);
      setSyncState('error');
    }
  };

  const getEventColor = (type: Event['type']): string => {
    const colors = {
      test: 'bg-red-100 text-red-800',
      assignment: 'bg-blue-100 text-blue-800',
      meeting: 'bg-green-100 text-green-800',
      office_hours: 'bg-purple-100 text-purple-800'
    };
    return colors[type];
  };

  const handleEditEvent = (event: Event) => {
    setEditingEvent(event);
    setShowEditDialog(true);
  };

  const handleCreateEvent = () => {
    setEditingEvent(null); // null indicates creating a new event
    setShowEditDialog(true);
  };

  const handleSaveEvent = async (event: Event) => {
    try {
      console.log("Saving event with date:", event.date); // Added console log
      await syncEvent(event);
      setEvents(prevEvents => {
        const updatedEvents = editingEvent
          ? prevEvents.map(e => e.id === editingEvent.id ? event : e)
          : [...prevEvents, event];
        return updatedEvents;
      });
      console.log("Events after save:", events); // Added console log
    } catch (error) {
      console.error('Failed to save event:', error);
    }
  };

  const handleDeleteEvent = async () => {
    if (!editingEvent) return;
    
    try {
      await deleteCloudEvent(editingEvent.id);
      setEvents(prevEvents => prevEvents.filter(e => e.id !== editingEvent.id));
      setShowEditDialog(false);
    } catch (error) {
      console.error('Failed to delete event:', error);
    }
  };

  const handleClearCalendar = async () => {
    try {
      await deleteCloudEvent();
      setEvents([]);
    } catch (error) {
      console.error('Failed to clear calendar:', error);
    }
  };

  const days = getDaysInMonth(currentDate);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <Card className="max-w-4xl mx-auto">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-between mb-4">
            <CardTitle className="text-2xl font-bold flex items-center gap-2">
              <CalendarIcon className="h-6 w-6" />
              Student Calendar
              <SyncStatus state={syncState} lastSynced={lastSynced} />
            </CardTitle>
            <div className="flex items-center gap-4">
              <div className="flex gap-2">
              <input
                type="file"
                onChange={handleFileUpload}
                className="hidden"
                id="file-upload"
                multiple
                accept=".pdf,.png,.jpg,.jpeg"
                disabled={isProcessing}
              />
              <Button
                variant="outline"
                onClick={handleCreateEvent}
                className="flex items-center gap-2"
              >
                <span>+ Create Event</span>
              </Button>
              <label htmlFor="file-upload">
                <Button variant="outline" className="cursor-pointer" asChild disabled={isProcessing}>
                  <span>
                    {isProcessing ? 'Processing...' : 'Upload Documents'}
                  </span>
                </Button>
              </label>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={signOut}
                className="flex items-center gap-2"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </Button>
            </div>
          </div>
          <div className="flex justify-between items-center">
            <Button
              variant="ghost"
              onClick={() => navigateMonth(-1)}
            >
              ←
            </Button>
            <h2 className="text-xl font-semibold">
              {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
            </h2>
            <Button
              variant="ghost"
              onClick={() => navigateMonth(1)}
            >
              →
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div
                key={day}
                className="text-center py-2 text-sm font-semibold text-gray-600"
              >
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days.map((day, index) => (
              <div
                key={index}
                className={`
                  aspect-square p-2 border rounded-lg
                  ${day.date ? 'hover:bg-gray-100 cursor-pointer' : ''}
                  ${day.date && isToday(day.date) ? 'bg-blue-50 border-blue-200' : ''}
                  ${day.date && selectedDate?.toDateString() === day.date.toDateString() ? 'ring-2 ring-blue-400' : ''}
                `}
                onClick={() => handleDateSelect(day.date)}
              >
                {day.date && (
                  <div className="flex flex-col h-full">
                    <span className="text-sm">{day.date.getDate()}</span>
                    <div className="flex-grow">
                      {day.events.slice(0, 2).map((event, i) => (
                        <div
                          key={`${event.id}-${i}`}
                          className={`text-xs rounded p-1 mb-1 truncate ${getEventColor(event.type)} flex items-center gap-1`}
                          title={`${event.title}${event.priority ? ` (${event.priority} priority)` : ''}`}
                        >
                          {event.priority === 'high' && <span className="w-2 h-2 rounded-full bg-red-500" />}
                          {event.priority === 'medium' && <span className="w-2 h-2 rounded-full bg-yellow-500" />}
                          {event.priority === 'low' && <span className="w-2 h-2 rounded-full bg-green-500" />}
                          {event.title}
                        </div>
                      ))}
                      {day.events.length > 2 && (
                        <div className="text-xs text-gray-500">
                          +{day.events.length - 2} more
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Selected Date Events */}
          {selectedDate && (
            <div className="mt-6 border-t pt-4">
              <h3 className="text-lg font-semibold mb-3">
                Events for {selectedDate.toLocaleDateString()}
              </h3>
              <div className="space-y-2">
                {events
                  .filter(event => event.date === selectedDate.toDateString())
                  .map(event => (
                    <div
                      key={event.id}
                      className={`p-3 rounded-lg ${getEventColor(event.type)}`}
                    >
                      <div className="flex items-center gap-2">
                        <div className="font-medium flex-grow">{event.title}</div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditEvent(event);
                          }}
                        >
                          Edit
                        </Button>
                        {event.priority && (
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            event.priority === 'high' ? 'bg-red-100 text-red-800' :
                            event.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-green-100 text-green-800'
                          }`}>
                            {event.priority} priority
                          </span>
                        )}
                      </div>
                      {event.time && (
                        <div className="text-sm mt-1">Time: {event.time}</div>
                      )}
                      {event.location && (
                        <div className="text-sm">Location: {event.location}</div>
                      )}
                      {(event.courseTitle || event.courseCode) && (
                        <div className="text-sm text-gray-600">
                          {[event.courseCode, event.courseTitle].filter(Boolean).join(' - ')}
                        </div>
                      )}
                      {event.description && (
                        <div className="text-sm mt-1">{event.description}</div>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <EventConfirmationDialog
        isOpen={showEventDialog}
        onClose={() => setShowEventDialog(false)}
        pendingEvents={pendingEvents}
        onConfirm={handleEventConfirmation}
      />

      <EditEventDialog
        isOpen={showEditDialog}
        onClose={() => setShowEditDialog(false)}
        event={editingEvent}
        onSave={handleSaveEvent}
        onDelete={editingEvent ? handleDeleteEvent : undefined}
      />

      <div className="fixed bottom-8 right-8">
        <Button
          variant="destructive"
          onClick={() => setShowClearDialog(true)}
          className="shadow-lg"
        >
          Clear Entire Calendar
        </Button>
      </div>

      <ClearCalendarDialog
        isOpen={showClearDialog}
        onClose={() => setShowClearDialog(false)}
        onConfirm={handleClearCalendar}
      />
    </div>
  );
};

export default StudentCalendar;
