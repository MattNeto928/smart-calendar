import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formats a date as YYYY-MM-DD string (ISO format)
 * Uses local noon time to avoid timezone issues and prevent date shifting
 * 
 * @param date - Date object or date string to format
 * @returns Formatted date string in YYYY-MM-DD format
 */
export function formatStandardDate(date: Date | string): string {
  if (!date) return '';
  
  try {
    // If date is a string, convert to Date object
    let dateObj = typeof date === 'string' ? new Date(date) : date;
    
    if (isNaN(dateObj.getTime())) {
      throw new Error('Invalid date format');
    }
    
    // Direct date to same day in local timezone to prevent shifts
    const year = dateObj.getFullYear();
    const month = dateObj.getMonth();
    const day = dateObj.getDate();
    
    // Create a new local date with the same year/month/day components at noon
    // This ensures the date doesn't shift due to timezone conversions
    const localDate = new Date(year, month, day, 12, 0, 0, 0);
    
    // Format to YYYY-MM-DD
    const formattedYear = localDate.getFullYear();
    const formattedMonth = String(localDate.getMonth() + 1).padStart(2, '0');
    const formattedDay = String(localDate.getDate()).padStart(2, '0');
    
    return `${formattedYear}-${formattedMonth}-${formattedDay}`;
  } catch (error) {
    console.error('Date formatting error:', error);
    return '';
  }
}
