import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';

interface ExtractedEvent {
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

interface GeminiEvent {
  title: string;
  date: string;
  type: string;
  time?: string;
  location?: string;
  description?: string;
}


interface GeminiEvent {
  title: string;
  date: string;
  type: string;
  time?: string;
  location?: string;
  description?: string;
}


export class GeminiParser {
  private model: GenerativeModel;

  constructor() {
    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('NEXT_PUBLIC_GEMINI_API_KEY is not set');
    }
    
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      this.model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-thinking-exp-01-21" });
    } catch (error) {
      console.error('Error initializing Gemini:', error);
      throw new Error('Failed to initialize Gemini API');
    }
  }

  private async fileToGenerativePart(file: File): Promise<{ inlineData: { data: string; mimeType: string } }> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64Data = reader.result as string;
        const base64Content = base64Data.split(',')[1];
        resolve({
          inlineData: {
            data: base64Content,
            mimeType: file.type
          }
        });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  private generatePrompt(fileContent: string, fileType: string): string {
    return `You are a calendar event parser. Your task is to analyze the provided ${fileType} content and extract academic events.

RULES:
1. Extract the title, date, type, time, location, and description of each event if available. 
2. All dates must be in YYYY-MM-DD format
3. Event types must be one of: test, assignment, meeting, office_hours
4. If the document appears to be about a specific class/course:
   - Extract the course title (e.g., "Cloud Computing", "Data Structures")
   - Extract the course code if available (e.g., "CS 4400", "MATH 101")
   - Extract the primary class location (classroom, building, etc.)
5. Return a JSON object with these properties:
   - events: array of event objects
   - classLocation: string (null if not found)
   - courseTitle: string (null if not found)
   - courseCode: string (null if not found)
6. Return ONLY the valid JSON object, nothing else

RESPONSE FORMAT:
{
  "events": [
    {
      "title": "string (required)",
      "date": "YYYY-MM-DD (required)",
      "type": "test|assignment|meeting|office_hours (required)",
      "time": "HH:MM AM/PM (optional)",
      "location": "string (optional)",
      "description": "string (optional)"
    }
  ],
  "classLocation": "string or null",
  "courseTitle": "string or null",
  "courseCode": "string or null"
}

If no valid events are found, return: { "events": [], "classLocation": null }

EXAMPLE RESPONSE:
{
  "events": [
    {
      "title": "Midterm Exam",
      "date": "2024-03-15",
      "type": "test",
      "time": "10:00 AM",
      "location": "Room 101",
      "description": "Covers chapters 1-5"
    }
  ],
  "classLocation": "Room 101",
  "courseTitle": "Cloud Computing",
  "courseCode": "CS 4400"
}`;
  }

  private getDefaultPriority(type: string): 'low' | 'medium' | 'high' {
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

  private parseGeminiResponse(response: string): ExtractedEvent[] {
    try {
      // Clean up the response to ensure it's valid JSON
      const cleanResponse = response.trim();
      const startBracket = cleanResponse.indexOf('{');
      const endBracket = cleanResponse.lastIndexOf('}');
      
      if (startBracket === -1 || endBracket === -1) {
        console.error('Invalid JSON structure in response:', cleanResponse);
        return [];
      }

      const jsonStr = cleanResponse.substring(startBracket, endBracket + 1);
      console.log('Attempting to parse JSON:', jsonStr);
      
      const parsed = JSON.parse(jsonStr);
      
      if (!parsed.events || !Array.isArray(parsed.events)) {
        console.error('Response does not contain events array:', parsed);
        return [];
      }

      const classLocation = parsed.classLocation || null;
      const courseTitle = parsed.courseTitle || null;
      const courseCode = parsed.courseCode || null;

      return parsed.events.map((event: GeminiEvent) => {
        try {
          if (!event.title || !event.date || !event.type) {
            console.error('Missing required fields in event:', event);
            return null;
          }

          // Validate date format
          const dateObj = new Date(event.date);
          if (isNaN(dateObj.getTime())) {
            console.error('Invalid date format:', event.date);
            return null;
          }

          // Validate event type
          const validTypes = ['test', 'assignment', 'meeting', 'office_hours'];
          if (!validTypes.includes(event.type)) {
            console.error('Invalid event type:', event.type);
            return null;
          }

          // Convert the date to match the format used in the calendar component
          const processedEvent: ExtractedEvent = {
            id: Math.random().toString(36).substring(7),
            title: event.title,
            date: new Date(event.date).toDateString(), // This ensures consistent date format
            type: event.type as ExtractedEvent['type'],
            description: event.description,
            location: event.location || classLocation, // Use class location as fallback
            time: event.time,
            priority: this.getDefaultPriority(event.type),
            courseTitle: courseTitle,
            courseCode: courseCode
          };
          return processedEvent;
        } catch (err) {
          console.error('Error processing event:', err);
          return null;
        }
      }).filter(Boolean) as ExtractedEvent[];
    } catch (error) {
      console.error('Failed to parse Gemini response:', error);
      return [];
    }
  }

  async parseFile(file: File): Promise<ExtractedEvent[]> {
    try {
      // if (!file.type.includes('image')) {
      //   throw new Error('Only image files are supported at this time');
      // }

      try {
        const imagePart = await this.fileToGenerativePart(file);
        const prompt = this.generatePrompt('', file.type);
        
        const result = await this.model.generateContent([
          { text: prompt },
          imagePart
        ]);

        const response = await result.response;
        const text = response.text();
        
        console.log('Raw Gemini response:', text);
        const events = this.parseGeminiResponse(text);
        console.log('Parsed events:', events);
        
        return events;
      } catch (error) {
        console.error('Gemini API error:', error);
        throw error;
      }
    } catch (error) {
      console.error('Error parsing file:', error);
      return []; // Return empty array instead of throwing
    }
  }
}

export const geminiParser = new GeminiParser();
