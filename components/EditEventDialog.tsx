"use client"

import React from 'react';
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
}

interface EditEventDialogProps {
  isOpen: boolean;
  onClose: () => void;
  event: Event | null; // null when creating a new event
  onSave: (event: Event) => void;
  onDelete?: () => void; // optional, only for editing existing events
}

export function EditEventDialog({
  isOpen,
  onClose,
  event,
  onSave,
  onDelete,
}: EditEventDialogProps) {
  const [editedEvent, setEditedEvent] = React.useState<Event>(() => {
    const defaultDate = event && event.date ? event.date : '';
    return {
      id: Math.random().toString(36).substring(7),
      title: '',
      date: defaultDate,
      type: 'assignment',
      priority: 'medium',
    };
  });

  React.useEffect(() => {
    if (event) {
      setEditedEvent({ ...event });
    }
  }, [event]);

  const handleChange = (field: keyof Event, value: string | undefined | 'test' | 'assignment' | 'meeting' | 'office_hours' | 'low' | 'medium' | 'high') => {
    setEditedEvent(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleDateChange = (dateStr: string) => {
    // Create date with local timezone
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    if (!isNaN(date.getTime())) {
      const formattedDate = date.toDateString();
      handleChange('date', formattedDate);
    }
  };

  const handleSave = () => {
    onSave(editedEvent);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[500px] h-[500px] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{event ? 'Edit Event' : 'Create Event'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="grid gap-2">
            <label className="text-sm font-medium">Title</label>
            <input
              type="text"
              value={editedEvent.title}
              onChange={(e) => handleChange('title', e.target.value)}
              className="w-full px-3 py-2 border rounded-md"
              required
            />
          </div>
          
          <div className="grid gap-2">
            <label className="text-sm font-medium">Date</label>
            <input
              type="date"
              value={editedEvent.date ? new Date(editedEvent.date).toISOString().split('T')[0] : ''}
              onChange={(e) => handleDateChange(e.target.value)}
              className="w-full px-3 py-2 border rounded-md"
              required
            />
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium">Type</label>
            <select
              value={editedEvent.type}
              onChange={(e) => handleChange('type', e.target.value)}
              className="w-full px-3 py-2 border rounded-md"
            >
              <option value="test">Test</option>
              <option value="assignment">Assignment</option>
              <option value="meeting">Meeting</option>
              <option value="office_hours">Office Hours</option>
            </select>
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium">Priority</label>
            <select
              value={editedEvent.priority}
              onChange={(e) => handleChange('priority', e.target.value)}
              className="w-full px-3 py-2 border rounded-md"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium">Time (optional)</label>
            <input
              type="text"
              value={editedEvent.time || ''}
              onChange={(e) => handleChange('time', e.target.value)}
              placeholder="e.g., 3:00 PM"
              className="w-full px-3 py-2 border rounded-md"
            />
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium">Location (optional)</label>
            <input
              type="text"
              value={editedEvent.location || ''}
              onChange={(e) => handleChange('location', e.target.value)}
              placeholder="e.g., Room 101"
              className="w-full px-3 py-2 border rounded-md"
            />
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium">Description (optional)</label>
            <textarea
              value={editedEvent.description || ''}
              onChange={(e) => handleChange('description', e.target.value)}
              className="w-full px-3 py-2 border rounded-md"
              rows={3}
            />
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium">Course Code (optional)</label>
            <input
              type="text"
              value={editedEvent.courseCode || ''}
              onChange={(e) => handleChange('courseCode', e.target.value)}
              placeholder="e.g., CS 4400"
              className="w-full px-3 py-2 border rounded-md"
            />
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium">Course Title (optional)</label>
            <input
              type="text"
              value={editedEvent.courseTitle || ''}
              onChange={(e) => handleChange('courseTitle', e.target.value)}
              placeholder="e.g., Cloud Computing"
              className="w-full px-3 py-2 border rounded-md"
            />
          </div>
        </div>
        <DialogFooter className="flex justify-between">
          <div>
            {onDelete && (
              <Button
                variant="destructive"
                onClick={onDelete}
                type="button"
              >
                Delete Event
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={onClose}
              type="button"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              type="submit"
              disabled={!editedEvent.title || !editedEvent.date}
            >
              Save
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
