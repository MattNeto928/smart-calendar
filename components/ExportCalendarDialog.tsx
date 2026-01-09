"use client"

import React, { useState, useEffect, useMemo } from 'react';
import { Download } from 'lucide-react';
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
  type?: string;
}

interface ExportCalendarDialogProps {
  isOpen: boolean;
  onClose: () => void;
  events: Event[];
}

function getMonthBounds(date: Date): { start: string; end: string } {
  const year = date.getFullYear();
  const month = date.getMonth();
  
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  
  const formatDate = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  
  return {
    start: formatDate(firstDay),
    end: formatDate(lastDay)
  };
}

export function ExportCalendarDialog({
  isOpen,
  onClose,
  events,
}: ExportCalendarDialogProps) {
  const [isExporting, setIsExporting] = useState(false);
  
  // Default to current month
  const defaultBounds = useMemo(() => getMonthBounds(new Date()), []);
  const [startDate, setStartDate] = useState(defaultBounds.start);
  const [endDate, setEndDate] = useState(defaultBounds.end);

  // Reset dates when dialog opens
  useEffect(() => {
    if (isOpen) {
      const bounds = getMonthBounds(new Date());
      setStartDate(bounds.start);
      setEndDate(bounds.end);
    }
  }, [isOpen]);

  // Count events in selected range
  const eventCount = useMemo(() => {
    return events.filter(event => {
      return event.date >= startDate && event.date <= endDate;
    }).length;
  }, [events, startDate, endDate]);

  const handleExport = async () => {
    setIsExporting(true);
    
    try {
      const response = await fetch(`/api/events/export?start=${startDate}&end=${endDate}`);
      
      if (!response.ok) {
        throw new Error('Failed to export calendar');
      }
      
      // Get the blob and create download link
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `student-calendar-${startDate}-to-${endDate}.ics`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      onClose();
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Export Calendar
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <p className="text-sm text-gray-600">
            Export your events as an iCalendar file (.ics) that can be imported into Apple Calendar, Google Calendar, Outlook, and other calendar apps.
          </p>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>
            
            <div className="grid gap-2">
              <label className="text-sm font-medium">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>
          </div>
          
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <span className="text-2xl font-bold text-blue-600">{eventCount}</span>
            <span className="text-sm text-gray-600 ml-2">
              {eventCount === 1 ? 'event' : 'events'} in selected range
            </span>
          </div>
          
          {eventCount === 0 && (
            <p className="text-sm text-amber-600 text-center">
              No events found in this date range. Try adjusting the dates.
            </p>
          )}
        </div>
        
        <DialogFooter className="flex gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isExporting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleExport}
            disabled={eventCount === 0 || isExporting}
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            {isExporting ? 'Exporting...' : 'Export'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
