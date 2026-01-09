"use client"

import React, { useState } from 'react';
import { Calendar as CalendarIcon, Cloud, RefreshCw, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { geminiParser } from '@/lib/gemini';
import { EventConfirmationDialog } from './EventConfirmationDialog';
import { EditEventDialog } from './EditEventDialog';
import { SyncState } from './SyncStatus';
import { useAuth } from '@/lib/auth-context';
import { ClearCalendarDialog } from './ClearCalendarDialog';
import { UserProfile } from './UserProfile';
import { SyncNotification } from './SyncNotification';
import { ProcessingModal } from './ProcessingModal';
import { ExportCalendarDialog } from './ExportCalendarDialog';

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
  canvasId?: string;
  canvasUrl?: string;
  canvasType?: string;
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
  const [syncNotification, setSyncNotification] = useState<{
    message: string;
    type: 'success' | 'error';
    action?: 'delete' | 'modify';
  } | null>(null);
  const { user, signOut } = useAuth();
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isDateFading, setIsDateFading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStage, setProcessingStage] = useState<'uploading' | 'analyzing' | 'parsing' | null>(null);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [showEventDialog, setShowEventDialog] = useState(false);
  const [pendingEvents, setPendingEvents] = useState<Event[]>([]);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);

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
        events: events.filter(event => event.date === currentDate.toISOString().split('T')[0])
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
    setProcessingStage('uploading');
    setProcessingProgress(0);
    
    try {
      // Process files one at a time instead of in parallel to avoid potential issues
      const allEvents = [];
      const totalFiles = Array.from(files).length;
      
      for (let i = 0; i < totalFiles; i++) {
        const file = Array.from(files)[i];
        // Update uploading progress
        setProcessingProgress((i / totalFiles) * 33); // First third for uploading
        
        try {
          console.log(`Processing file: ${file.name}`);
          
          // Move to analyzing stage after first file is uploaded
          if (i === 0) {
            setProcessingStage('analyzing');
          }
          
          // Simulate analysis progress
          setProcessingProgress(33 + ((i / totalFiles) * 33)); // Second third for analyzing
          
          try {
            // Move to parsing stage
            setProcessingStage('parsing');
            const extractedEvents = await geminiParser.parseFile(file);
            
            // Update parsing progress
            setProcessingProgress(66 + ((i + 1) / totalFiles) * 34); // Final third for parsing
            
            if (extractedEvents && Array.isArray(extractedEvents)) {
              console.log(`Successfully extracted ${extractedEvents.length} events from ${file.name}`);
              allEvents.push(...extractedEvents);
            } else {
              console.error(`File ${file.name} returned no valid events`);
            }
          } catch (parserError: unknown) {
            // Specifically catch and handle the "length of undefined" error
            if (parserError instanceof TypeError && 
                parserError.message && 
                parserError.message.includes('Cannot read property \'length\' of undefined')) {
              console.error(`Caught "length of undefined" error in ${file.name}, skipping file`);
            } else {
              console.error(`Error processing file ${file.name}:`, parserError);
            }
          }
        } catch (fileError) {
          console.error(`Unhandled error processing file ${file.name}:`, fileError);
        }
      }
      
      // Ensure we reach 100% at the end
      setProcessingProgress(100);
      
      // Small delay to show 100% complete before hiding
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Filter out empty results and null values
      const validEvents = allEvents.filter(event => event && typeof event === 'object');
      console.log(`Found ${validEvents.length} valid events in all files`);
      
      if (validEvents.length > 0) {
        // Show confirmation dialog with pending events
        setPendingEvents(validEvents);
        setShowEventDialog(true);
      } else {
        // Inform user that no events were found
        setSyncNotification({
          message: 'No valid events found in the uploaded files',
          type: 'error'
        });
      }
    } catch (error) {
      console.error('Error processing files:', error);
      setSyncNotification({
        message: 'Failed to process uploaded files',
        type: 'error'
      });
    } finally {
      setIsProcessing(false);
      setProcessingStage(null);
      setProcessingProgress(0);
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
      setSyncNotification({
        message: `Successfully synced ${confirmedEvents.length} events`,
        type: 'success',
        action: 'modify'
      });
    } catch (error) {
      console.error('Failed to sync confirmed events:', error);
      setSyncState('error');
      setSyncNotification({
        message: 'Failed to sync events',
        type: 'error'
      });
    }
  };

  const handleDateSelect = (date: Date | null): void => {
    if (!date) return;
    setSelectedDate(date);
  };

  const isToday = (date: Date): boolean => {
    const today = new Date();
    return date.toISOString().split('T')[0] === today.toISOString().split('T')[0];
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

  const getEventColor = (type: Event['type'], priority?: Event['priority'], isCanvas?: boolean): string => {
    const baseColors = {
      test: 'bg-red-100 text-red-800 border-red-200',
      assignment: 'bg-blue-100 text-blue-800 border-blue-200',
      meeting: 'bg-green-100 text-green-800 border-green-200',
      office_hours: 'bg-purple-100 text-purple-800 border-purple-200'
    };

    const priorityColors = {
      high: 'ring-2 ring-red-400',
      medium: 'ring-2 ring-yellow-400',
      low: 'ring-2 ring-green-400'
    };

    const canvasStyle = isCanvas ? 'border-l-4 border-l-[#E41A2D]' : '';

    return `${baseColors[type]} ${priority ? priorityColors[priority] : ''} ${canvasStyle}`;
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
      await syncEvent(event);
      setEvents(prevEvents => {
        const updatedEvents = editingEvent
          ? prevEvents.map(e => e.id === editingEvent.id ? event : e)
          : [...prevEvents, event];
        return updatedEvents;
      });
      setShowEditDialog(false);
      setSyncNotification({
        message: editingEvent ? 'Event successfully modified' : 'Event successfully created',
        type: 'success',
        action: 'modify'
      });
    } catch (error) {
      console.error('Failed to save event:', error);
      setSyncNotification({
        message: 'Failed to save event',
        type: 'error'
      });
    }
  };

  const handleDeleteEvent = async () => {
    if (!editingEvent) return;
    
    try {
      await deleteCloudEvent(editingEvent.id);
      setEvents(prevEvents => prevEvents.filter(e => e.id !== editingEvent.id));
      setShowEditDialog(false);
      setSyncNotification({
        message: 'Event successfully deleted',
        type: 'success',
        action: 'delete'
      });
    } catch (error) {
      console.error('Failed to delete event:', error);
      setSyncNotification({
        message: 'Failed to delete event',
        type: 'error'
      });
    }
  };

  const handleClearCalendar = async () => {
    try {
      await deleteCloudEvent();
      setEvents([]);
      setSyncNotification({
        message: 'Calendar successfully cleared',
        type: 'success',
        action: 'delete'
      });
    } catch (error) {
      console.error('Failed to clear calendar:', error);
      setSyncNotification({
        message: 'Failed to clear calendar',
        type: 'error'
      });
    }
  };

  const days = getDaysInMonth(currentDate);

  const handleOutsideClick = (e: React.MouseEvent) => {
    // Don't trigger if clicking inside the footer section or on a date cell
    if (
      e.target instanceof Element && 
      (e.target.closest('.calendar-footer') || 
       e.target.closest('.calendar-day'))
    ) {
      return;
    }
    
    if (selectedDate) {
      setIsDateFading(true);
      setTimeout(() => {
        setSelectedDate(null);
        setIsDateFading(false);
      }, 200);
    }
  };

  return (
    <div 
      className="min-h-screen bg-gray-50 p-4 sm:p-8"
      onClick={handleOutsideClick}
    >
      <Card className="max-w-5xl mx-auto">
        <CardHeader className="space-y-1">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-4">
            <CardTitle className="text-xl sm:text-2xl font-bold flex items-center gap-2 whitespace-nowrap">
              <CalendarIcon className="h-5 w-5 sm:h-6 sm:w-6" />
              Student Calendar
              <div className="flex items-center gap-2 text-sm font-normal">
                {syncState === 'syncing' ? (
                  <RefreshCw className="h-4 w-4 text-blue-600 animate-spin" />
                ) : (
                  <Cloud className="h-4 w-4 text-green-600" />
                )}
                <span className="text-gray-600">
                  {lastSynced && `Last synced ${new Date(lastSynced).toLocaleTimeString()}`}
                </span>
              </div>
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
                <Button
                  variant="outline"
                  onClick={() => setShowExportDialog(true)}
                  className="flex items-center gap-2"
                  disabled={events.length === 0}
                >
                  <Download className="h-4 w-4" />
                  <span>Export</span>
                </Button>
                <label htmlFor="file-upload">
                  <Button 
                    variant="outline" 
                    className="cursor-pointer" 
                    asChild 
                    disabled={isProcessing}
                  >
                    <span>
                      {isProcessing ? 'Processing...' : 'Upload Documents'}
                    </span>
                  </Button>
                </label>
              </div>
              <UserProfile user={user} onSignOut={signOut} />
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
          <div className="grid grid-cols-7 gap-2">
            {days.map((day, index) => (
              <div
                key={index}
                className={`
                  calendar-day aspect-square p-2 border rounded-lg bg-white
                  ${day.date ? 'hover:bg-gray-50 cursor-pointer transition-colors' : 'bg-gray-50'}
                  ${day.date && isToday(day.date) ? 'bg-blue-50 border-blue-200' : ''}
                  ${day.date && selectedDate?.toISOString().split('T')[0] === day.date.toISOString().split('T')[0] 
                    ? `ring-2 ${isDateFading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300 ring-blue-400` 
                    : ''}
                `}
                onClick={() => handleDateSelect(day.date)}
              >
                {day.date && (
                  <div className="flex flex-col h-full">
                    <span className={`text-sm font-medium mb-1 ${isToday(day.date) ? 'text-blue-600' : ''}`}>
                      {day.date.getDate()}
                    </span>
                    <div className="flex-grow space-y-1">
                      {day.events.slice(0, 2).map((event, i) => (
                        <div
                          key={`${event.id}-${i}`}
                          className={`
                            text-xs rounded p-1.5 truncate border
                            ${getEventColor(event.type, event.priority, !!event.canvasId)}
                            transition-all duration-200
                            hover:scale-[1.02]
                          `}
                          title={`${event.title}${event.priority ? ` (${event.priority} priority)` : ''}${event.canvasId ? ' (Canvas)' : ''}`}
                        >
                          {event.canvasId && (
                            <span className="mr-1 inline-block w-2 h-2 bg-[#E41A2D] rounded-full" />
                          )}
                          {event.title}
                        </div>
                      ))}
                      {day.events.length > 2 && (
                        <div className="text-xs font-medium text-gray-500 mt-1">
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
            <div className="calendar-footer mt-6 border-t pt-4">
              <h3 className="text-lg font-semibold mb-3">
                Events for {selectedDate.toLocaleDateString()}
              </h3>
              <div className="space-y-2">
                {events
                  .filter(event => event.date === selectedDate.toISOString().split('T')[0])
                  .map(event => (
                    <div
                      key={event.id}
                      className={`p-3 rounded-lg ${getEventColor(event.type, event.priority, !!event.canvasId)}`}
                    >
                      <div className="flex items-center gap-2">
                        <div className="font-medium flex-grow">
                          {event.canvasId && (
                            <span className="mr-2 inline-block px-1.5 py-0.5 text-xs rounded bg-[#E41A2D] text-white">Canvas</span>
                          )}
                          {event.title}
                        </div>
                        
                        {event.canvasUrl ? (
                          <a 
                            href={event.canvasUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-[#E41A2D] hover:underline px-2 py-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            Open in Canvas
                          </a>
                        ) : (
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
                        )}
                        
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
                      {event.canvasType && (
                        <div className="text-xs mt-1 text-gray-500">
                          Type: {event.canvasType.charAt(0).toUpperCase() + event.canvasType.slice(1)}
                        </div>
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

      <div className="fixed bottom-8 right-8 space-y-4">
        <Button
          variant="destructive"
          onClick={() => setShowClearDialog(true)}
          className="shadow-lg"
        >
          Clear Entire Calendar
        </Button>
      </div>

      {syncNotification && (
        <SyncNotification
          message={syncNotification.message}
          type={syncNotification.type}
          action={syncNotification.action}
          onCloseStart={() => {
            setIsDateFading(true); // Start the fade out animation immediately
            setTimeout(() => {
              setSelectedDate(null); // Remove the date selection after fade animation
              setIsDateFading(false); // Reset the fade state
            }, 200); // Match the notification's exit animation duration
          }}
          onClose={() => setSyncNotification(null)}
        />
      )}

      <ClearCalendarDialog
        isOpen={showClearDialog}
        onClose={() => setShowClearDialog(false)}
        onConfirm={handleClearCalendar}
      />

      <ExportCalendarDialog
        isOpen={showExportDialog}
        onClose={() => setShowExportDialog(false)}
        events={events}
      />

      {isProcessing && processingStage && (
        <ProcessingModal 
          stage={processingStage}
          progress={processingProgress}
        />
      )}
    </div>
  );
};

export default StudentCalendar;
