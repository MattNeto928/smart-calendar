/**
 * Date utilities for consistent date handling across the application
 */

/**
 * Formats a Date object or string into a standardized YYYY-MM-DD format
 * with noon time to avoid timezone-related issues.
 * 
 * @param {Date|string} date - The date to format
 * @returns {string} Formatted date string in YYYY-MM-DD format
 */
export const formatStandardDate = (date) => {
  if (!date) return '';
  
  try {
    // If date is a string, convert to Date object
    let dateObj = date;
    if (typeof date === 'string') {
      // If already in YYYY-MM-DD format, simply return it
      if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        console.log(`Date already in standard format: ${date}`);
        return date;
      }
      
      // Parse the date string
      dateObj = new Date(date);
      if (isNaN(dateObj.getTime())) {
        throw new Error('Invalid date format');
      }
    }
    
    // Get date components from the original date
    const year = dateObj.getFullYear();
    const month = dateObj.getMonth();
    const day = dateObj.getDate();
    
    // Create a new date with noon time to avoid timezone issues
    const localDate = new Date(year, month, day, 12, 0, 0, 0);
    
    // Format the date
    const formattedYear = localDate.getFullYear();
    const formattedMonth = String(localDate.getMonth() + 1).padStart(2, '0');
    const formattedDay = String(localDate.getDate()).padStart(2, '0');
    
    const result = `${formattedYear}-${formattedMonth}-${formattedDay}`;
    console.log(`Date formatted (UTC): ${date} → ${result}`); // Updated log message
    
    return result;
  } catch (error) {
    console.error('Date formatting error:', error);
    return typeof date === 'string' ? date : '';
  }
};

/**
 * Gets the day, month and year components from a date
 * @param {Date|string} date - Date to extract components from
 * @returns {Object} Object with day, month, year properties
 */
export const getDateComponents = (date) => {
  try {
    // If date is a string in YYYY-MM-DD format
    if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      const [year, month, day] = date.split('-').map(num => parseInt(num, 10));
      return { day, month: month - 1, year }; // month - 1 because JS months are 0-indexed
    }
    
    // Otherwise, make a Date object and extract components
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    // Get date components
    return {
      day: dateObj.getDate(),
      month: dateObj.getMonth(),
      year: dateObj.getFullYear()
    };
  } catch (error) {
    console.error('Error getting date components:', error);
    return { day: 1, month: 0, year: 2000 };
  }
};

/**
 * Format date for display in a human-readable format
 * @param {string} dateStr - Date string in YYYY-MM-DD format
 * @returns {string} Human-readable date
 */
export const formatDisplayDate = (dateStr) => {
  try {
    if (!dateStr) return 'No date';
    
    // Parse the YYYY-MM-DD format directly
    const [year, month, day] = dateStr.split('-').map(num => parseInt(num, 10));
    if (isNaN(year) || isNaN(month) || isNaN(day)) {
      throw new Error('Invalid date format');
    }
    
    // Create date with noon time to avoid timezone issues
    const date = new Date(year, month - 1, day, 12, 0, 0);
    
    if (!isNaN(date.getTime())) {
      return date.toLocaleDateString(undefined, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    }
    return dateStr;
  } catch (e) {
    console.warn('Date display format error:', e);
    return dateStr;
  }
};
