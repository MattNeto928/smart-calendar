"use client"

import React, { useState, useEffect } from 'react';
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

  useEffect(() => {
    setEvents(pendingEvents.map(event => ({ ...event, selected: true })));
  }, [pendingEvents]);

  const handleEventChange = (index: number, field: keyof Event, value: string | boolean | undefined | 'test' | 'assignment' | 'meeting' | 'office_hours' | 'low' | 'medium' | 'high') => {
    setEvents(prevEvents => {
      const newEvents = [...prevEvents];
      newEvents[index] = { ...newEvents[index], [field]: value };
      return newEvents;
    });
  };

  const handleConfirm = () => {
    const selectedEvents = events.filter(event => event.selected);
    onConfirm(selectedEvents);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl p-0 max-h-[500px] h-[500px] overflow-y-auto">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle>Confirm Calendar Events</DialogTitle>
        </DialogHeader>
        <div className="max-h-[400px] overflow-y-auto">
          <div className="px-6 grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-4 font-medium text-sm sticky top-0 bg-white py-2 border-b shadow-sm z-20">
            <div className="w-6"></div>
            <div>Title</div>
            <div className="w-24">Type</div>
            <div className="w-24">Priority</div>
            <div className="w-28">Time</div>
            <div className="w-32">Location</div>
          </div>
          {events.map((event, index) => (
            <div key={event.id} className="px-6 grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-4 items-center py-2 hover:bg-gray-50">
              <input
                type="checkbox"
                checked={event.selected}
                onChange={(e) => handleEventChange(index, 'selected', e.target.checked)}
                className="w-4 h-4"
              />
              <div className="flex flex-col gap-1">
                {(event.courseCode || event.courseTitle) && (
                  <div className="text-sm text-gray-600">
                    {[event.courseCode, event.courseTitle].filter(Boolean).join(' - ')}
                  </div>
                )}
                <div className="flex flex-col gap-1">
                  <input
                    type="text"
                    value={event.title}
                    onChange={(e) => handleEventChange(index, 'title', e.target.value)}
                    className="w-full px-2 py-1 border rounded"
                  />
                  {event.description && (
                    <div className="text-xs text-gray-500">{event.description}</div>
                  )}
                </div>
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
        <DialogFooter className="px-6 py-4 border-t">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleConfirm}>Populate Calendar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
