"use client"

import React, { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

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
  isRecurring?: boolean;
  recurrence?: {
    frequency: 'weekly' | 'biweekly' | 'daily';
    days: string[];
    endDate?: string;
  };
}

interface EventConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  pendingEvents: Event[];
  onConfirm: (events: Event[]) => void;
}

export function EventConfirmationDialog({
  isOpen,
  onClose,
  pendingEvents,
  onConfirm,
}: EventConfirmationDialogProps) {
  const [events, setEvents] = useState<Event[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setEvents(pendingEvents.map(event => {
      let recurrence = event.recurrence;
      
      // If marked recurring but missing details, try to infer default
      if (event.isRecurring && !recurrence) {
        // Infer day from the event date
        const dateObj = new Date(event.date);
        // Adjust for timezone offset if needed, but assuming YYYY-MM-DD input is local date
        const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
        
        recurrence = {
          frequency: 'weekly',
          days: [dayName],
          endDate: '' // User can fill this in
        };
      }
      // Also protect against empty days array
      else if (event.isRecurring && recurrence && recurrence.days.length === 0) {
         const dateObj = new Date(event.date);
         const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
         recurrence = { ...recurrence, days: [dayName] };
      }

      return { 
        ...event, 
        selected: true,
        recurrence
      };
    }));
  }, [pendingEvents]);

  const handleEventChange = (index: number, field: keyof Event, value: string | boolean | undefined | 'test' | 'assignment' | 'meeting' | 'office_hours' | 'low' | 'medium' | 'high') => {
    setError(null);
    setEvents(prevEvents => {
      const newEvents = [...prevEvents];
      // dynamic field assignment
      newEvents[index] = { ...newEvents[index], [field]: value };
      return newEvents;
    });
  };

  const handleRecurrenceChange = (index: number, field: 'days' | 'endDate' | 'frequency', value: string | string[]) => {
    setError(null);
    setEvents(prevEvents => {
      const newEvents = [...prevEvents];
      const event = newEvents[index];
      if (event.recurrence) {
        newEvents[index] = {
          ...event,
          recurrence: {
            ...event.recurrence,
            [field]: value
          }
        };
      }
      return newEvents;
    });
  };

  const handleToggleRecurring = (index: number, isRecurring: boolean) => {
    setError(null);
    setEvents(prevEvents => {
      const newEvents = [...prevEvents];
      const event = newEvents[index];
      
      let recurrence = event.recurrence;
      if (isRecurring && !recurrence) {
         const dateObj = new Date(event.date);
         const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
         recurrence = { frequency: 'weekly', days: [dayName], endDate: '' };
      }
      
      newEvents[index] = { ...event, isRecurring, recurrence };
      return newEvents;
    });
  };

  const handleConfirm = () => {
    const selectedEvents = events.filter(event => event.selected);
    
    // Validate recurring events have end dates
    const invalidEvent = selectedEvents.find(e => e.isRecurring && (!e.recurrence?.endDate));
    if (invalidEvent) {
      setError(`Please set an end date for the recurring event: "${invalidEvent.title}"`);
      return;
    }

    onConfirm(selectedEvents);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl w-[95vw] p-0 max-h-[85vh] h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle className="text-xl">Confirm Calendar Events</DialogTitle>
          <p className="text-sm text-gray-500">Review and verify the extracted events. Recurring events will be expanded automatically.</p>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto min-h-0">
          <div className="px-6 grid grid-cols-[24px_1fr_120px_100px_120px_60px_140px] gap-4 font-medium text-sm sticky top-0 bg-white py-3 border-b shadow-sm z-20 items-center">
            <div className="w-6"></div>
            <div className="min-w-[200px]">Title & Description</div>
            <div>Type</div>
            <div>Priority</div>
            <div>Time</div>
            <div className="text-center">Repeat?</div>
            <div>Location</div>
          </div>
          {events.map((event, index) => (
            <div key={event.id} className="px-6 grid grid-cols-[24px_1fr_120px_100px_120px_60px_140px] gap-4 items-start py-4 border-b hover:bg-gray-50/50 transition-colors">
              <input
                type="checkbox"
                checked={event.selected}
                onChange={(e) => handleEventChange(index, 'selected', e.target.checked)}
                className="w-4 h-4 mt-2.5 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <div className="flex flex-col gap-3 min-w-[200px]">
                {(event.courseCode || event.courseTitle) && (
                  <div className="text-xs font-semibold text-blue-600 uppercase tracking-wide">
                    {[event.courseCode, event.courseTitle].filter(Boolean).join(' - ')}
                  </div>
                )}
                <div className="flex flex-col gap-2">
                  <input
                    type="text"
                    value={event.title}
                    onChange={(e) => handleEventChange(index, 'title', e.target.value)}
                    className="w-full px-3 py-1.5 border border-gray-200 rounded font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-transparent hover:bg-white"
                    placeholder="Event Title"
                  />
                  {event.description && (
                    <div className="text-sm text-gray-500 leading-snug px-1">{event.description}</div>
                  )}
                </div>
                {event.isRecurring && event.recurrence && (
                  <div className="mt-1 p-3 bg-blue-50/80 border border-blue-100 rounded-md text-sm flex flex-col gap-2 sm:flex-row sm:items-center text-blue-800">
                    <div className="flex items-center gap-2">
                        <RefreshCw className="w-3.5 h-3.5 text-blue-600" />
                        <span className="font-medium">
                        Repeats {event.recurrence.frequency} on {event.recurrence.days.join(', ')}
                        </span>
                    </div>
                    <div className="flex items-center gap-2 ml-auto">
                      <span className="text-blue-600 text-xs uppercase font-semibold">Until</span>
                      <input 
                        type="date" 
                        className="border border-blue-200 rounded px-2 py-1 text-xs bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        value={event.recurrence.endDate || ''}
                        onChange={(e) => handleRecurrenceChange(index, 'endDate', e.target.value)}
                        placeholder="End of semester"
                      />
                    </div>
                  </div>
                )}
              </div>
              <select
                value={event.type}
                onChange={(e) => handleEventChange(index, 'type', e.target.value)}
                className="px-2 py-1 border rounded"
              >
                <option value="test">Test</option>
                <option value="assignment">Assignment</option>
                <option value="meeting">Meeting</option>
                <option value="office_hours">Office Hours</option>
              </select>
              <select
                value={event.priority || 'medium'}
                onChange={(e) => handleEventChange(index, 'priority', e.target.value)}
                className="px-2 py-1 border rounded"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
              <input
                type="text"
                value={event.time || ''}
                onChange={(e) => handleEventChange(index, 'time', e.target.value)}
                placeholder="HH:MM AM/PM"
                className="px-2 py-1 border rounded"
              />
              <div className="flex justify-center">
                <input 
                    type="checkbox"
                    checked={event.isRecurring || false}
                    onChange={(e) => handleToggleRecurring(index, e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </div>
              <input
                type="text"
                value={event.location || ''}
                onChange={(e) => handleEventChange(index, 'location', e.target.value)}
                placeholder="Location"
                className="px-2 py-1 border rounded"
              />
            </div>
          ))}
        </div>
        <DialogFooter className="px-6 py-4 border-t flex-col !items-end gap-2">
          {error && <p className="text-sm text-red-600 font-medium">{error}</p>}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleConfirm}>Populate Calendar</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
