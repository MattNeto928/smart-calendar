import { GoogleGenerativeAI } from '@google/generative-ai';
import * as FileSystem from 'expo-file-system';
import * as mime from 'react-native-mime-types';

export class GeminiParser {
  constructor() {
    const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('EXPO_PUBLIC_GEMINI_API_KEY is not set');
    }
    
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      this.model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-thinking-exp-01-21" });
    } catch (error) {
      console.error('Error initializing Gemini:', error);
      throw new Error('Failed to initialize Gemini API');
    }
  }
x
  async fileToGenerativePart(uri) {
    try {
      // Standardize URI handling for different platforms
      console.log('Original URI:', uri);
      
      // Handle temporary file paths that start with /var/folders/ (macOS)
      let isTemporaryFile = uri.includes('/var/folders/') || 
                           uri.includes('TemporaryItems') || 
                           uri.includes('screencaptureui');
      
      // Always create a local copy, especially important for temp files
      const filename = uri.split('/').pop().replace(/[^a-zA-Z0-9.-]/g, '_');
      const localDir = `${FileSystem.cacheDirectory}gemini_uploads/`;
      
      try {
        // Create directory if it doesn't exist
        const dirInfo = await FileSystem.getInfoAsync(localDir);
        if (!dirInfo.exists) {
          await FileSystem.makeDirectoryAsync(localDir, { intermediates: true });
          console.log('Created local directory for file storage');
        }
      } catch (err) {
        console.log('Error creating directory:', err);
      }
      
      const localUri = `${localDir}${Date.now()}_${filename}`;
      console.log('Creating local copy at:', localUri);
      
      let fileUri = uri;
      
      // For temporary files from macOS screenshots, try special handling
      if (isTemporaryFile) {
        console.log('Detected temporary file path, using special handling');
        
        try {
          // First check if file actually exists
          const originalFileInfo = await FileSystem.getInfoAsync(uri);
          if (!originalFileInfo.exists) {
            throw new Error('Original temporary file no longer exists. It may have been cleaned up by the system.');
          }
          
          // Try to copy the file to our app's cache directory
          await FileSystem.copyAsync({
            from: uri,
            to: localUri
          });
          fileUri = localUri;
          console.log('Successfully copied temporary file to local storage');
        } catch (tempFileError) {
          console.error('Failed to access temporary file:', tempFileError);
          throw new Error('Cannot access this file. Screenshots and other temporary files may not be accessible. Try saving the file first, then uploading.');
        }
      } else {
        // Standard file handling
        try {
          await FileSystem.copyAsync({
            from: uri,
            to: localUri
          });
          fileUri = localUri;
          console.log('Successfully copied file to local storage');
        } catch (copyError) {
          console.error('Failed to copy file locally:', copyError);
          
          // For non-temporary files, fall back to original URI
          console.log('Falling back to original URI');
          fileUri = uri;
        }
      }
      
      console.log('Using file URI:', fileUri);

      // Verify file exists and get info
      const fileInfo = await FileSystem.getInfoAsync(fileUri);
      if (!fileInfo.exists) {
        throw new Error(`File does not exist at path: ${fileUri}`);
      }
      
      console.log('File info:', fileInfo);

      // Check if fileInfo is valid
      if (!fileInfo || !fileInfo.exists) {
        throw new Error(`Invalid file info or file does not exist at path: ${fileUri}`);
      }

      // Read file content with explicit error handling
      let base64Content = ''; // Initialize base64Content to an empty string
      try {
        base64Content = await FileSystem.readAsStringAsync(fileUri, {
          encoding: FileSystem.EncodingType.Base64,
          length: Math.min(fileInfo.size, 1024 * 1024) // Read up to 1MB to stay within API limits
        });
        console.log('Value of base64Content after readAsStringAsync:', base64Content); // Log after read
        
        if (!base64Content || base64Content.length === 0) {
          throw new Error('File content is empty');
        }
        
        console.log(`Successfully read file content: ${base64Content.length} bytes`);
      } catch (error) {
        console.error('Error reading file:', error);
        throw new Error(`Failed to read file content: ${error.message}`);
      }

      console.log('Value of base64Content after try-catch:', base64Content);

      // Determine MIME type from the URI
      const mimeType = mime.lookup(fileUri) || 'application/octet-stream';
      console.log('Processing file:', { 
        uri: fileUri, 
        mimeType, 
        size: fileInfo.size,
        contentLength: base64Content?.length || 0
      });

      console.log('Value of base64Content before return:', base64Content); // Added logging here

      return {
        inlineData: {
          data: base64Content,
          mimeType: mimeType
        }
      };
    } catch (error) {
      console.error('Error converting file to generative part:', error);
      throw error;
    }
  }

  generatePrompt(fileType) {
    return `You are a calendar event parser. Your task is to analyze the provided ${fileType} content and extract academic events.

RULES:
1. Extract the title, date, type, time, location, and description of each event
2. All dates must be in YYYY-MM-DD format
3. Event types must be one of: test, assignment, meeting, office_hours
4. For missing fields, make educated guesses:
   - Priority: Based on event type (test=high, assignment=medium, meeting=medium, office_hours=low)
   - Time: Suggest typical times based on event type (e.g., tests in morning, office hours in afternoon)
   - Location: Use class location if available, otherwise generic locations
5. If the document appears to be about a specific class/course:
   - Extract the course title (e.g., "Cloud Computing", "Data Structures")
   - Extract the course code if available (e.g., "CS 4400", "MATH 101")
   - Extract the primary class location (classroom, building, etc.)
6. Return a JSON object with these properties:
   - events: array of event objects (MUST include priority and time even if inferred)
   - classLocation: string (null if not found)
   - courseTitle: string (null if not found)
   - courseCode: string (null if not found)
6. Return ONLY the valid JSON object, nothing else`;
  }

  getDefaultPriority(type) {
    switch (type) {
      case 'test':
        return 'high';
      case 'assignment':
      case 'meeting':
        return 'medium';
      case 'office_hours':
        return 'low';
      default:
        return 'medium';
    }
  }

  parseGeminiResponse(response) {
    try {
      console.log('Parsing Gemini response:', response); // Log the response

      const cleanResponse = response.trim();
      const startBracket = cleanResponse.indexOf('{');
      const endBracket = cleanResponse.lastIndexOf('}');

      if (startBracket === -1 || endBracket === -1) {
        console.error('Invalid JSON structure in response:', cleanResponse);
        return [];
      }

      const jsonStr = cleanResponse.substring(startBracket, endBracket + 1);
      console.log('Extracted JSON string:', jsonStr); // Log the extracted JSON string

      let parsed;
      try {
        parsed = JSON.parse(jsonStr);
        console.log('Parsed JSON:', parsed); // Log the parsed JSON
      } catch (parseError) {
        console.error('Error parsing JSON:', parseError); // Log JSON parsing error
        return []; // Return empty array in case of JSON parsing error
      }

      if (!parsed.events || !Array.isArray(parsed.events)) {
        console.error('Response does not contain events array:', parsed);
        return [];
      }

      const classLocation = parsed.classLocation || null;
      const courseTitle = parsed.courseTitle || null;
      const courseCode = parsed.courseCode || null;

      // Validate and normalize events with proper error handling
      let validatedEvents = [];
      if (parsed.events) { // Check if parsed.events exists before mapping
        validatedEvents = parsed.events
          .map(rawEvent => {
            try {
              // Required fields check - only title is mandatory
              if (!rawEvent?.title) {
                throw new Error(`Missing required title in event: ${JSON.stringify(rawEvent)}`);
              }

              // Type validation - optional, defaults to 'assignment' if missing or invalid
              let eventType = 'assignment';
              const validTypes = new Set(['test', 'assignment', 'meeting', 'office_hours']);
              if (rawEvent.type && validTypes.has(rawEvent.type)) {
                eventType = rawEvent.type;
              } else if (rawEvent.type) {
                console.warn(`Invalid event type: ${rawEvent.type}. Defaulting to 'assignment'.`);
              }

              let isoDate = null; // Date is optional now
              if (rawEvent.date) {
                isoDate = (() => {
                  try {
                    const dateStr = rawEvent.date.trim();
                    const dateObj = new Date(dateStr);

                    if (isNaN(dateObj)) {
                      throw new Error('Invalid date format');
                    }

                    return dateObj.toISOString().split('T')[0];
                  } catch (err) {
                    console.warn(`Invalid date "${rawEvent.date}" - Disregarding date.`);
                    return null; // Date parsing failed, disregard date
                  }
                })();
              }


              // Build validated event object
              return {
                id: Math.random().toString(36).slice(2, 9), // More reliable ID generation
                title: rawEvent.title.trim() || 'Untitled Event',
                date: isoDate, // date can be null
                type: eventType, // Use validated eventType
                description: rawEvent.description?.trim() || '',
                location: [rawEvent.location, classLocation].find(Boolean) || '',
              time: rawEvent.time?.replace(/[^0-9:apmAPM]/gi, '') || '', // Sanitize time
              priority: rawEvent.priority || this.getDefaultPriority(eventType), // Ensure priority is always present
              courseTitle: courseTitle?.trim() || '',
              courseCode: courseCode?.trim() || ''
            };
          } catch (err) {
            console.error('Error processing event:', err);
            return null;
          }
        })
          .filter(event => {
            // Final validation check after normalization - only title is required
            const isValid = event && event.title;

            if (!isValid) {
              console.warn('Rejecting invalid event:', event);
            }
            return isValid;
          });
      } else {
        console.warn('parsed.events is undefined, returning empty validatedEvents array.');
        validatedEvents = []; // Assign empty array if parsed.events is undefined
      }
      return validatedEvents;
    } catch (error) {
      console.error('Failed to parse Gemini response:', error);
      return [];
    }
  }

  async parseFile(uri) {
    try {
      console.log('Starting to parse file:', uri);
      
      // Check if URI is valid
      if (!uri) {
        throw new Error('Invalid file URI: URI is empty');
      }
      
      // Generate prompt for Gemini
      let mimeType = mime.lookup(uri) || 'application/octet-stream';
      console.log('Detected mime type:', mimeType);
      const prompt = this.generatePrompt(mimeType);
      
      // Convert file to format needed for Gemini
      console.log('Preparing file for Gemini...');
      const filePart = await this.fileToGenerativePart(uri);
      
      console.log('Sending to Gemini API...');
      try {
        // Add timeout for API call
        const resultPromise = this.model.generateContent([
          { text: prompt },
          filePart
        ]);
        
        // Add timeout logic
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('API call timed out after 30s')), 30000)
        );
        
        // Race the API call against the timeout
        const result = await Promise.race([resultPromise, timeoutPromise]);
        
        // Process API response
        const response = await result.response;
        const text = await response.text(); // Ensure text is awaited

        console.log('Gemini API response received, parsing...');
        console.log(text);
        let events = this.parseGeminiResponse(text);
        if (!events) { // Check if events is falsy (undefined or null)
          console.log('parseGeminiResponse returned falsy value:', events, ', assigning empty array to events.');
          events = []; // Assign an empty array if events is falsy
        }
        console.log(`Successfully parsed ${events.length} events`);

        return events;
      } catch (error) {
        // Handle specific API errors
        if (error.message?.includes('RESOURCE_EXHAUSTED')) {
          console.error('Gemini API quota exceeded:', error);
          throw new Error('API quota exceeded. Please try again later.');
        } else if (error.message?.includes('timed out')) {
          console.error('Gemini API request timed out');
          throw new Error('Request timed out. The file may be too large or complex.');
        } else if (error.message?.includes('INVALID_ARGUMENT')) {
          console.error('Invalid input to Gemini API:', error);
          throw new Error('The file format is not supported for analysis.');
        } else {
          console.error('Error during Gemini API call:', error);
          throw new Error(`Failed to analyze file: ${error.message}`);
        }
      }
    } catch (error) {
      console.error('Error in parseFile:', error);
      throw error; // Propagate error to caller for better UI handling
    }
  }
}

export const geminiParser = new GeminiParser();
