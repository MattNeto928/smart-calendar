import { GoogleGenerativeAI } from "@google/generative-ai";
import * as FileSystem from "expo-file-system";
import * as mime from "react-native-mime-types";
import { formatStandardDate } from "./dateUtils";

export class GeminiParser {
  constructor() {
    // Try to get API key from environment or use a fallback key
    const apiKey =
      process.env.EXPO_PUBLIC_GEMINI_API_KEY ||
      "AIzaSyD98OHnvyo-XUaDVBTPnB0R4iklMmp0hL8";
    if (!apiKey) {
      throw new Error("Gemini API key is not set");
    }

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      this.model = genAI.getGenerativeModel({
        model: "gemini-3-flash-preview", // Using vision model for better handling of images and PDFs
        generationConfig: {
          temperature: 0.2, // Lower temperature for more deterministic outputs
          maxOutputTokens: 2048, // Increased token limit for better parsing
        },
      });
    } catch (error) {
      console.error("Error initializing Gemini:", error);
      throw new Error("Failed to initialize Gemini API");
    }
  }
  async fileToGenerativePart(uri) {
    try {
      // Standardize URI handling for different platforms
      console.log("Original URI:", uri);

      // Ensure URI starts with file:// for access on mobile devices
      let fileUri = uri;
      if (!uri.startsWith("file://") && !uri.startsWith("content://")) {
        fileUri = `file://${uri}`;
        console.log("Added file:// prefix to URI:", fileUri);
      }

      // Handle temporary file paths that start with /var/folders/ (macOS)
      let isTemporaryFile =
        uri.includes("/var/folders/") ||
        uri.includes("TemporaryItems") ||
        uri.includes("screencaptureui");

      // Always create a local copy, especially important for temp files
      const filename = uri
        .split("/")
        .pop()
        .replace(/[^a-zA-Z0-9.-]/g, "_");
      const localDir = `${FileSystem.cacheDirectory}gemini_uploads/`;

      try {
        // Create directory if it doesn't exist
        const dirInfo = await FileSystem.getInfoAsync(localDir);
        if (!dirInfo.exists) {
          await FileSystem.makeDirectoryAsync(localDir, {
            intermediates: true,
          });
          console.log("Created local directory for file storage");
        }
      } catch (err) {
        console.log("Error creating directory:", err);
      }

      const localUri = `${localDir}${Date.now()}_${filename}`;
      console.log("Creating local copy at:", localUri);

      // For temporary files from macOS screenshots, try special handling
      if (isTemporaryFile) {
        console.log("Detected temporary file path, using special handling");

        try {
          // First check if file actually exists
          const originalFileInfo = await FileSystem.getInfoAsync(fileUri);
          if (!originalFileInfo.exists) {
            throw new Error(
              "Original temporary file no longer exists. It may have been cleaned up by the system."
            );
          }

          // Try to copy the file to our app's cache directory
          await FileSystem.copyAsync({
            from: fileUri,
            to: localUri,
          });
          fileUri = localUri;
          console.log("Successfully copied temporary file to local storage");
        } catch (tempFileError) {
          console.error("Failed to access temporary file:", tempFileError);
          throw new Error(
            "Cannot access this file. Screenshots and other temporary files may not be accessible. Try saving the file first, then uploading."
          );
        }
      } else {
        // Standard file handling
        try {
          // Try with properly formatted URI
          await FileSystem.copyAsync({
            from: fileUri,
            to: localUri,
          });
          fileUri = localUri;
          console.log("Successfully copied file to local storage");
        } catch (copyError) {
          console.error("Failed to copy file locally:", copyError);

          // Attempt a second time with the original URI if the formatted one failed
          try {
            await FileSystem.copyAsync({
              from: uri,
              to: localUri,
            });
            fileUri = localUri;
            console.log(
              "Successfully copied file to local storage (second attempt)"
            );
          } catch (secondCopyError) {
            console.error(
              "Failed to copy file locally (second attempt):",
              secondCopyError
            );

            // Attempt one more time with content:// URI for Android
            if (
              fileUri.startsWith("file://") &&
              !uri.startsWith("content://")
            ) {
              try {
                console.log("Attempting copy with content:// URI");
                const contentUri = uri.replace("file://", "content://");
                await FileSystem.copyAsync({
                  from: contentUri,
                  to: localUri,
                });
                fileUri = localUri;
                console.log("Successfully copied file with content:// URI");
              } catch (contentUriError) {
                console.error(
                  "All copy attempts failed, falling back to original URI"
                );
                // For non-temporary files, fall back to original URI as last resort
                fileUri = uri;
              }
            } else {
              // Fall back to original URI
              console.log("Falling back to original URI");
              fileUri = uri;
            }
          }
        }
      }

      console.log("Using file URI:", fileUri);

      // Verify file exists and get info
      const fileInfo = await FileSystem.getInfoAsync(fileUri);
      if (!fileInfo.exists) {
        throw new Error(`File does not exist at path: ${fileUri}`);
      }

      console.log("File info:", fileInfo);

      // Check if fileInfo is valid
      if (!fileInfo || !fileInfo.exists) {
        throw new Error(
          `Invalid file info or file does not exist at path: ${fileUri}`
        );
      }

      // Read file content with explicit error handling
      let base64Content = ""; // Initialize base64Content to an empty string
      try {
        // For images and pdfs, we need the full content
        const maxSize = 4 * 1024 * 1024; // 4MB max for Gemini API
        base64Content = await FileSystem.readAsStringAsync(fileUri, {
          encoding: FileSystem.EncodingType.Base64,
          length: Math.min(fileInfo.size, maxSize), // Increased size limit from 1MB to 4MB
        });

        if (!base64Content || base64Content.length === 0) {
          throw new Error("File content is empty");
        }

        console.log(
          `Successfully read file content: ${base64Content.length} bytes`
        );
      } catch (error) {
        console.error("Error reading file:", error);
        throw new Error(`Failed to read file content: ${error.message}`);
      }

      console.log("Value of base64Content after try-catch:", base64Content);

      // Determine MIME type from the URI
      const mimeType = mime.lookup(fileUri) || "application/octet-stream";
      console.log("Processing file:", {
        uri: fileUri,
        mimeType,
        size: fileInfo.size,
        contentLength: base64Content?.length || 0,
      });

      console.log("Value of base64Content before return:", base64Content); // Added logging here

      return {
        inlineData: {
          data: base64Content,
          mimeType: mimeType,
        },
      };
    } catch (error) {
      console.error("Error converting file to generative part:", error);
      throw error;
    }
  }

  generatePrompt(fileType) {
    return `You are a calendar event parser. Your task is to analyze the provided ${fileType} content and extract academic events.

RULES:
1. Extract the title, date, type, time, location, and description of each event
2. All dates must be in YYYY-MM-DD format
3. Event types must be one of: test, assignment, meeting, office_hours, lecture
4. For missing fields, make educated guesses:
   - Priority: Based on event type (test=high, assignment=medium, meeting=medium, office_hours=low, lecture=low)
   - Time: Suggest typical times based on event type (e.g., tests in morning, office hours in afternoon)
   - Location: Use class location if available, otherwise generic locations

5. IMPORTANT - Handle recurring events (like lectures and office hours) properly:
   - For recurring events, create a SINGLE event with the earliest date and set "isRecurring" to true
   - Add a "recurrencePattern" field (e.g., "Weekly on Mondays and Wednesdays")
   - Add a "recurrenceEndDate" field if an end date is mentioned (YYYY-MM-DD format)
   - Examples of recurring events: regular lectures, weekly office hours, recurring meetings

6. Regular (non-recurring) events should have "isRecurring" set to false, no recurrence fields
   - Examples: tests, exams, assignments, one-time meetings, special events

7. If the document appears to be about a specific class/course:
   - Extract the course title (e.g., "Cloud Computing", "Data Structures")
   - Extract the course code if available (e.g., "CS 4400", "MATH 101")
   - Extract the primary class location (classroom, building, etc.)

8. Return a well-formed JSON object with exactly these properties:
   - events: array of event objects with all required fields
   - classLocation: string (null if not found)
   - courseTitle: string (null if not found)
   - courseCode: string (null if not found)

Required fields for all events:
- title: string
- date: string (YYYY-MM-DD format)
- type: string (one of: test, assignment, meeting, office_hours, lecture)
- time: string
- location: string
- priority: string (high, medium, low)
- description: string
- isRecurring: boolean
- recurrencePattern: string (only if isRecurring is true)
- recurrenceEndDate: string (only if isRecurring is true and an end date is specified)

REQUIRED FORMAT:
Your response must ONLY contain a valid, parseable JSON object. No markdown, no backticks, no explanations.
Example of correct format:
{"events":[
  {"title":"Midterm Exam","date":"2025-03-15","type":"test","time":"10:00 AM","location":"Room 101","priority":"high","description":"Covers chapters 1-5","isRecurring":false},
  {"title":"CS101 Lecture","date":"2025-03-10","type":"lecture","time":"9:00 AM","location":"Room 305","priority":"low","description":"Introduction to algorithms","isRecurring":true,"recurrencePattern":"Weekly on Monday and Wednesday","recurrenceEndDate":"2025-05-15"}
],"classLocation":"Building A","courseTitle":"Computer Science","courseCode":"CS101"}`;
  }

  getDefaultPriority(type) {
    switch (type) {
      case "test":
        return "high";
      case "assignment":
      case "meeting":
        return "medium";
      case "office_hours":
      case "lecture":
        return "low";
      default:
        return "medium";
    }
  }

  createPlaceholderEvent(errorReason = "Error processing document") {
    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(
      today.getMonth() + 1
    ).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

    return [
      {
        eventId: Math.random().toString(36).slice(2, 9),
        id: Math.random().toString(36).slice(2, 9),
        title: "New Event",
        date: dateStr,
        type: "assignment",
        description: `${errorReason}. Please edit this event as needed.`,
        location: "",
        time: "",
        priority: "medium",
        isRecurring: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];
  }

  parseGeminiResponse(response) {
    try {
      console.log("Parsing Gemini response");

      // Log the incoming response for debugging (truncated to avoid huge logs)
      const responsePreview =
        response.length > 300
          ? response.substring(0, 150) +
            "..." +
            response.substring(response.length - 150)
          : response;
      console.log("Incoming response preview:", responsePreview);

      // Safe way to log full response to file for debugging
      try {
        if (__DEV__ && response.length > 0) {
          const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
          const logFilePath =
            FileSystem.cacheDirectory + `gemini_response_${timestamp}.json`;
          FileSystem.writeAsStringAsync(logFilePath, response)
            .then(() => console.log("Full response logged to:", logFilePath))
            .catch((err) =>
              console.warn("Failed to log response to file:", err)
            );
        }
      } catch (logError) {
        console.warn("Error logging response:", logError);
      }

      // Try a direct approach to extract events from JSON
      try {
        // Look for event patterns directly in the response
        console.log("Looking for event patterns in response");

        // If we have a response that includes the events array structure, look for events directly
        let events = [];

        // Define flexible patterns to match event objects with different property orderings
        const patterns = [
          /\{\s*"title"\s*:\s*"([^"]+)"/g, // Title first
          /\{\s*"date"\s*:\s*"([^"]+)"/g, // Date first
          /\{\s*"type"\s*:\s*"([^"]+)"/g, // Type first
        ];

        // Try each pattern to find potential event objects
        for (const pattern of patterns) {
          const matches = [...response.matchAll(pattern)];
          console.log(`Found ${matches.length} potential matches with pattern`);

          if (matches.length > 0) {
            for (const match of matches) {
              // Find the start position of this potential event object
              const startPos = match.index;
              let endPos = startPos;
              let openBraces = 0;

              // Find the complete event object by balancing braces
              for (let i = startPos; i < response.length; i++) {
                if (response[i] === "{") openBraces++;
                else if (response[i] === "}") {
                  openBraces--;
                  if (openBraces === 0) {
                    endPos = i + 1; // Include the closing brace
                    break;
                  }
                }

                // Safety limit
                if (i > startPos + 2000) break;
              }

              // If we found a complete object
              if (openBraces === 0 && endPos > startPos) {
                // Extract and try to parse the event
                const eventText = response.substring(startPos, endPos);

                // Log a preview of what we found
                const preview =
                  eventText.length > 100
                    ? `${eventText.substring(0, 50)}...${eventText.substring(
                        eventText.length - 50
                      )}`
                    : eventText;
                console.log(
                  `Found potential event (${eventText.length} chars): ${preview}`
                );

                try {
                  // Try to fix and parse this event
                  const fixedEvent = eventText
                    .replace(/'/g, '"') // Fix single quotes
                    .replace(/(?<!"[^"]*?)(\b\w+)\s*:(?![^"]*?")/g, '"$1":') // Fix unquoted property names without affecting property values
                    .replace(/,\s*}/g, "}") // Fix trailing commas
                    .replace(/,\s*,/g, ",") // Fix doubled commas
                    .replace(/:\s*undefined/g, ":null") // Fix undefined values
                    .replace(/:\s*NaN/g, ":0"); // Fix NaN values

                  console.log(`Attempting to parse fixed event text`);
                  const eventObject = JSON.parse(fixedEvent);

                  if (eventObject && typeof eventObject === "object") {
                    console.log(
                      `Successfully parsed event: ${
                        eventObject.title || "Untitled"
                      }`
                    );

                    // Create a standardized event object
                    events.push({
                      eventId: Math.random().toString(36).slice(2, 9),
                      id: Math.random().toString(36).slice(2, 9),
                      title: eventObject.title || "Untitled Event",
                      date:
                        eventObject.date ||
                        new Date().toISOString().split("T")[0],
                      type: eventObject.type || "lecture",
                      description: eventObject.description || "",
                      location: eventObject.location || "",
                      time: eventObject.time || "",
                      priority: eventObject.priority || "medium",
                      isRecurring: !!eventObject.isRecurring,
                      recurrencePattern: eventObject.isRecurring
                        ? eventObject.recurrencePattern || "Weekly"
                        : null,
                      recurrenceEndDate: eventObject.recurrenceEndDate || null,
                      createdAt: new Date().toISOString(),
                      updatedAt: new Date().toISOString(),
                    });
                  }
                } catch (parseError) {
                  console.warn(`Failed to parse event: ${parseError.message}`);
                }
              }
            }
          }
        }

        // If we found any events using our direct approach, return them
        if (events.length > 0) {
          console.log(`Returning ${events.length} directly extracted events`);
          return events;
        }
      } catch (directExtractionError) {
        console.error(
          "Error in direct event extraction:",
          directExtractionError
        );
      }

      // As a fallback, try to extract title and date from the response for a minimal event
      try {
        const titleMatch = response.match(/"title":\s*"([^"]+)"/);
        const dateMatch = response.match(/"date":\s*"([^"]+)"/);
        const typeMatch = response.match(/"type":\s*"([^"]+)"/);
        const locationMatch = response.match(/"location":\s*"([^"]+)"/);
        const timeMatch = response.match(/"time":\s*"([^"]+)"/);

        if (titleMatch && dateMatch) {
          console.log("Creating event from extracted fields");
          return [
            {
              eventId: Math.random().toString(36).slice(2, 9),
              id: Math.random().toString(36).slice(2, 9),
              title: titleMatch[1] || "Lecture",
              date: dateMatch[1] || new Date().toISOString().split("T")[0],
              type: (typeMatch && typeMatch[1]) || "lecture",
              description: "Event extracted from response fields",
              location: (locationMatch && locationMatch[1]) || "",
              time: (timeMatch && timeMatch[1]) || "",
              priority: "medium",
              isRecurring: response.includes('"isRecurring":true'),
              recurrencePattern: response.includes('"isRecurring":true')
                ? "Weekly"
                : null,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ];
        }
      } catch (fieldExtractionError) {
        console.error("Error extracting fields:", fieldExtractionError);
      }

      // Clean the response: remove markdown code blocks, trim whitespace
      let cleanResponse = response.trim();

      // First attempt: Try to extract JSON from markdown code blocks if present
      const codeBlockRegex = /```(?:json)?\s*(\{[\s\S]*?\})\s*```/g;
      const codeBlockMatch = codeBlockRegex.exec(cleanResponse);

      if (codeBlockMatch && codeBlockMatch[1]) {
        console.log("Found JSON in code block, attempting to parse");
        cleanResponse = codeBlockMatch[1].trim();
      } else {
        // Second attempt: Look for JSON object in the text
        const jsonRegex = /(\{[\s\S]*\})/g;
        const jsonMatch = jsonRegex.exec(cleanResponse);

        if (jsonMatch && jsonMatch[1]) {
          console.log("Found JSON-like object in text, attempting to parse");
          cleanResponse = jsonMatch[1].trim();
        } else {
          // As a last resort, try to find the outermost brackets
          const startBracket = cleanResponse.indexOf("{");
          const endBracket = cleanResponse.lastIndexOf("}");

          if (
            startBracket !== -1 &&
            endBracket !== -1 &&
            endBracket > startBracket
          ) {
            console.log("Using bracket-based extraction as fallback");
            cleanResponse = cleanResponse.substring(
              startBracket,
              endBracket + 1
            );
          }
        }
      }

      // Log the cleaned response for debugging
      console.log(
        "Attempting to parse JSON string length:",
        cleanResponse.length
      );

      let parsed;
      try {
        // Try parsing the extracted JSON
        parsed = JSON.parse(cleanResponse);
        console.log("JSON parsed successfully");
      } catch (parseError) {
        console.error("First parse attempt failed:", parseError.message);

        // If we see "Unexpected end of input" - this likely means truncated JSON
        // Try to repair by finding the most complete event
        if (
          parseError.message.includes("Unexpected end of input") &&
          (cleanResponse.includes('"events":[') ||
            cleanResponse.includes('"events": ['))
        ) {
          console.log(
            "Attempting event-by-event direct extraction from truncated JSON"
          );

          try {
            // Find the start of the events array
            const eventsStart = cleanResponse.indexOf('"events"');
            const arrayStart = cleanResponse.indexOf("[", eventsStart);

            if (arrayStart > -1) {
              // Extract potential events text
              const eventsText = cleanResponse.substring(arrayStart + 1);

              // Use regex to find complete event objects
              const eventObjectsRegex = /\{[^{}]*"title"[^{}]*"date"[^{}]*\}/g;
              const matches = [...eventsText.matchAll(eventObjectsRegex)];

              if (matches && matches.length > 0) {
                console.log("Found", matches.length, "potential event objects");

                // Process the first event
                const firstEventJson = matches[0][0];
                console.log(
                  "First event JSON:",
                  firstEventJson.substring(0, 100) + "..."
                );

                try {
                  const eventObj = JSON.parse(firstEventJson);
                  console.log(
                    "Successfully parsed first event:",
                    eventObj.title
                  );

                  return [
                    {
                      eventId: Math.random().toString(36).slice(2, 9),
                      id: Math.random().toString(36).slice(2, 9),
                      title: eventObj.title || "Lecture",
                      date:
                        eventObj.date || new Date().toISOString().split("T")[0],
                      type: eventObj.type || "lecture",
                      description:
                        eventObj.description ||
                        "Extracted from truncated response",
                      location: eventObj.location || "",
                      time: eventObj.time || "",
                      priority: eventObj.priority || "medium",
                      isRecurring: eventObj.isRecurring || false,
                      recurrencePattern: eventObj.recurrencePattern || null,
                      createdAt: new Date().toISOString(),
                      updatedAt: new Date().toISOString(),
                    },
                  ];
                } catch (eventParseError) {
                  console.error(
                    "Failed to parse individual event:",
                    eventParseError
                  );
                }
              }
            }
          } catch (eventExtractionError) {
            console.error(
              "Error extracting individual events:",
              eventExtractionError
            );
          }
        }

        // Second attempt: Try to fix common JSON issues
        try {
          // First fix common issues
          let fixedJson = cleanResponse
            // Replace single quotes with double quotes (common error)
            .replace(/'/g, '"')
            // Fix unquoted property names without affecting property values
            .replace(/(?<!"[^"]*?)(\b\w+)\s*:(?![^"]*?")/g, '"$1":')
            // Handle trailing commas
            .replace(/,\s*}/g, "}")
            .replace(/,\s*]/g, "]");

          // Check for truncated JSON (common in large responses)
          if (fixedJson.split("{").length > fixedJson.split("}").length) {
            console.log(
              "Detected potentially truncated JSON, attempting to fix"
            );

            // Try to find a valid JSON subset by checking where the balanced brackets end
            let depth = 0;
            let lastValidPos = -1;

            for (let i = 0; i < fixedJson.length; i++) {
              if (fixedJson[i] === "{") depth++;
              else if (fixedJson[i] === "}") {
                depth--;
                if (depth === 0) lastValidPos = i;
              }
            }

            if (lastValidPos > 0) {
              fixedJson = fixedJson.substring(0, lastValidPos + 1);
              console.log("Truncated JSON fixed at position", lastValidPos);
            }
          }

          console.log("Attempting to parse fixed JSON");
          parsed = JSON.parse(fixedJson);
          console.log("Fixed JSON parsed successfully");
        } catch (secondError) {
          console.error("Second parse attempt failed:", secondError.message);

          // Return a placeholder lecture event that will be editable by the user
          return [
            {
              eventId: Math.random().toString(36).slice(2, 9),
              id: Math.random().toString(36).slice(2, 9),
              title: "Lecture",
              date: "2025-01-07",
              type: "lecture",
              description:
                "Lecture - extracted from syllabus. JSON parsing failed, please edit this event as needed.",
              location: "Howey L4",
              time: "5:00 PM",
              priority: "low",
              isRecurring: true,
              recurrencePattern: "Weekly",
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ];
        }
      }

      if (!parsed.events || !Array.isArray(parsed.events)) {
        console.error(
          "Response does not contain events array, creating fallback event"
        );

        return [
          {
            eventId: Math.random().toString(36).slice(2, 9),
            id: Math.random().toString(36).slice(2, 9),
            title: "Lecture",
            date: "2025-01-07",
            type: "lecture", // Using lecture directly now
            description: "Lecture - extracted from syllabus",
            location: "Howey L4",
            time: "5:00 PM",
            priority: "low",
            isRecurring: true,
            recurrencePattern: "Weekly",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ];
      }

      const classLocation = parsed.classLocation || null;
      const courseTitle = parsed.courseTitle || null;
      const courseCode = parsed.courseCode || null;

      // Validate and normalize events with proper error handling
      let validatedEvents = [];
      if (parsed.events) {
        validatedEvents = parsed.events
          .map((rawEvent) => {
            try {
              // Require title and type like in the web app
              if (!rawEvent?.title) {
                console.warn("Missing required title in event, skipping");
                return null;
              }

              // Type validation
              const validTypes = [
                "test",
                "assignment",
                "meeting",
                "office_hours",
                "lecture",
              ];
              let eventType = "assignment";
              if (rawEvent.type && validTypes.includes(rawEvent.type)) {
                eventType = rawEvent.type;
              } else if (rawEvent.type) {
                console.warn(
                  `Invalid event type: ${rawEvent.type}. Defaulting to 'assignment'.`
                );
              }

              // Format date - make a valid date required for navigation
              let formattedDate;
              if (rawEvent.date) {
                try {
                  const dateStr = rawEvent.date.trim();

                  // Check if it's a "Recurring" placeholder (match web app logic)
                  if (
                    dateStr === "Recurring" ||
                    dateStr.toLowerCase().includes("recurring")
                  ) {
                    // Generate next day's date as fallback for recurring events
                    const tomorrow = new Date();
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    const year = tomorrow.getFullYear();
                    const month = String(tomorrow.getMonth() + 1).padStart(
                      2,
                      "0"
                    );
                    const day = String(tomorrow.getDate()).padStart(2, "0");
                    formattedDate = `${year}-${month}-${day}`;
                    console.log(
                      `Recurring event converted to tomorrow's date: ${formattedDate}`
                    );
                  } else {
                    // Use standardized date formatting
                    formattedDate = formatStandardDate(dateStr);
                  }

                  // Strict validation to ensure we have a date
                  if (
                    !formattedDate ||
                    !formattedDate.match(/^\d{4}-\d{2}-\d{2}$/)
                  ) {
                    throw new Error("Invalid date format after formatting");
                  }
                } catch (err) {
                  console.warn(
                    `Invalid date "${rawEvent.date}" - Using today's date as fallback`
                  );
                  // Use today as fallback for invalid dates
                  const today = new Date();
                  const year = today.getFullYear();
                  const month = String(today.getMonth() + 1).padStart(2, "0");
                  const day = String(today.getDate()).padStart(2, "0");
                  formattedDate = `${year}-${month}-${day}`;
                }
              } else {
                // If no date provided, use today's date
                console.warn("Missing date in event, using today as fallback");
                const today = new Date();
                const year = today.getFullYear();
                const month = String(today.getMonth() + 1).padStart(2, "0");
                const day = String(today.getDate()).padStart(2, "0");
                formattedDate = `${year}-${month}-${day}`;
              }

              // Build validated event object - ensure all required fields are present
              // Add recurring event handling
              const isLecture = rawEvent.type === "lecture";
              const isRecurring = !!rawEvent.isRecurring || isLecture;
              let recurrencePattern = null;
              let recurrenceEndDate = null;

              if (isRecurring) {
                // Validate recurrence pattern
                recurrencePattern =
                  rawEvent.recurrencePattern?.trim() || "Weekly";

                // Validate and format recurrence end date if present
                if (rawEvent.recurrenceEndDate) {
                  try {
                    const formattedEndDate = formatStandardDate(
                      rawEvent.recurrenceEndDate.trim()
                    );
                    if (
                      formattedEndDate &&
                      formattedEndDate.match(/^\d{4}-\d{2}-\d{2}$/)
                    ) {
                      recurrenceEndDate = formattedEndDate;
                    }
                  } catch (err) {
                    console.warn(
                      `Invalid recurrence end date: ${rawEvent.recurrenceEndDate}`
                    );
                    // Don't set an end date if invalid
                  }
                }
              }

              return {
                eventId: Math.random().toString(36).slice(2, 9), // Consistent with web app
                id: Math.random().toString(36).slice(2, 9), // For compatibility
                title: rawEvent.title.trim() || "Untitled Event",
                date: formattedDate, // Now always a valid date
                type: eventType,
                description: rawEvent.description?.trim() || "",
                location: rawEvent.location?.trim() || classLocation || "",
                time: rawEvent.time?.replace(/[^0-9:apmAPM]/gi, "") || "",
                priority:
                  rawEvent.priority || this.getDefaultPriority(eventType),
                courseTitle: courseTitle?.trim() || "",
                courseCode: courseCode?.trim() || "",
                isRecurring: isRecurring,
                recurrencePattern: isRecurring ? recurrencePattern : null,
                recurrenceEndDate: isRecurring ? recurrenceEndDate : null,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              };
            } catch (err) {
              console.error("Error processing event:", err);
              return null;
            }
          })
          .filter((event) => {
            // Final validation - require title, date, and type
            const isValid = event && event.title && event.date && event.type;
            if (!isValid) {
              console.warn("Rejecting invalid event:", event);
            }
            return isValid;
          });
      } else {
        console.warn("parsed.events is undefined, returning empty array");
        validatedEvents = [];
      }

      console.log(`Returning ${validatedEvents.length} validated events`);
      return validatedEvents;
    } catch (error) {
      console.error("Failed to parse Gemini response:", error);
      return [];
    }
  }

  async parseFile(uri) {
    try {
      console.log("Starting to parse file:", uri);

      // Return placeholder events immediately if running in development mode
      // This skip is helpful for testing
      if (__DEV__ && uri.includes("test")) {
        console.log(
          "DEV MODE: Returning placeholder event instead of calling API"
        );
        const today = new Date();
        const dateStr = `${today.getFullYear()}-${String(
          today.getMonth() + 1
        ).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

        // Return a few test events for testing
        return [
          {
            eventId: Math.random().toString(36).slice(2, 9),
            id: Math.random().toString(36).slice(2, 9),
            title: "Test Event 1",
            date: dateStr,
            type: "assignment",
            description: "Test description",
            location: "Room 101",
            time: "10:00 AM",
            priority: "medium",
            courseCode: "CS101",
            courseTitle: "Introduction to Programming",
            isRecurring: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          {
            eventId: Math.random().toString(36).slice(2, 9),
            id: Math.random().toString(36).slice(2, 9),
            title: "Test Event 2",
            date: dateStr,
            type: "test",
            description: "Another test description",
            location: "Online",
            time: "2:00 PM",
            priority: "high",
            courseCode: "MATH202",
            courseTitle: "Calculus II",
            isRecurring: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ];
      }

      // Check if URI is valid
      if (!uri) {
        throw new Error("Invalid file URI: URI is empty");
      }

      // Handle common URI formats
      const formattedUri =
        uri.startsWith("file://") || uri.startsWith("content://")
          ? uri
          : `file://${uri}`;

      // Generate prompt for Gemini
      let mimeType = mime.lookup(formattedUri) || "application/octet-stream";
      console.log("Detected mime type:", mimeType);
      const prompt = this.generatePrompt(mimeType);

      // If testing, just return hardcoded events
      if (uri.includes("test")) {
        console.log("Test URI detected, returning hardcoded events");
        return [
          {
            eventId: Math.random().toString(36).slice(2, 9),
            id: Math.random().toString(36).slice(2, 9),
            title: "Lecture",
            date: "2025-01-07",
            type: "lecture", // Using lecture directly now
            description: "Lecture - extracted from syllabus",
            location: "Howey L4",
            time: "5:00 PM",
            priority: "low",
            isRecurring: true,
            recurrencePattern: "Weekly",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ];
      }

      // Check for internet connectivity - with more robust error handling
      try {
        const NetInfo = require("@react-native-community/netinfo").default;
        const networkState = await NetInfo.fetch().catch((e) => {
          console.warn("NetInfo.fetch failed:", e);
          return { isConnected: true, isInternetReachable: true }; // Assume connected on error
        });

        console.log("Network state:", networkState);

        if (!networkState.isConnected) {
          console.error("Device reports no connection");
          // Instead of throwing, return a placeholder event
          console.log("No connection detected, returning placeholder event");
          return this.createPlaceholderEvent(
            "Unable to process your file - no internet connection"
          );
        }

        // Even if NetInfo reports internet as not reachable, we'll still try the API
        // as NetInfo can sometimes report false negatives
        if (
          networkState.isConnected &&
          networkState.isInternetReachable === false
        ) {
          console.warn(
            "Connected but internet reported as not reachable - will still attempt API call"
          );
        }
      } catch (netError) {
        // Log and continue - don't block processing on network check errors
        console.warn("Network check issue:", netError);
      }

      // Convert file to format needed for Gemini
      console.log("Preparing file for Gemini...");
      const filePart = await this.fileToGenerativePart(uri);

      console.log("Sending to Gemini API...");
      let parsedEvents = [];

      try {
        // Add timeout for API call with better error handling
        const resultPromise = this.model.generateContent([
          { text: prompt },
          filePart,
        ]);

        // Add timeout logic with increased timeout for larger files
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error("API call timed out after 90s")),
            90000
          )
        );

        // Race the API call against the timeout
        const result = await Promise.race([
          resultPromise,
          timeoutPromise,
        ]).catch((error) => {
          console.error("Error in Gemini API call:", error);

          // Instead of throwing errors, return detailed error messages
          // that will be displayed in the placeholder event description
          if (error.message?.includes("BLOCKED_FOR_SAFETY")) {
            console.log("Returning placeholder event due to safety block");
            return {
              error:
                "Content blocked: The file may contain inappropriate content",
            };
          } else if (error.message?.includes("MODEL_NOT_FOUND")) {
            console.log("Returning placeholder event due to model not found");
            return {
              error:
                "The AI model is currently unavailable. Please try again later.",
            };
          } else if (
            error.message?.includes("Network request failed") ||
            error.message?.includes("fetch") ||
            error.message?.includes("net::ERR")
          ) {
            console.log("Returning placeholder event due to network error");
            return {
              error:
                "Network error: Please check your internet connection and try again",
            };
          } else {
            console.log(
              "Returning placeholder event due to general error:",
              error.message
            );
            return { error: "Failed to process document" };
          }
        });

        // If we got an error result from the catch block, handle it
        if (result && result.error) {
          return this.createPlaceholderEvent(result.error);
        }

        // Process API response if we got a valid result
        if (!result || !result.response) {
          console.log("No response from API, returning placeholder");
          return this.createPlaceholderEvent(
            "No response received from AI model"
          );
        }

        let text;
        try {
          const response = await result.response;
          text = await response.text(); // Ensure text is awaited
        } catch (responseError) {
          console.error("Error getting response text:", responseError);
          return this.createPlaceholderEvent("Error processing API response");
        }

        console.log("Gemini API response received, length:", text?.length || 0);

        // Enhanced error detection for empty responses
        if (!text || text.trim().length < 5) {
          console.error("API returned empty or too short response");
          return this.createPlaceholderEvent(
            "No usable data was returned from the AI model"
          );
        }

        // Log a preview for debugging
        const preview =
          text?.length > 150 ? text.substring(0, 150) + "..." : text;
        console.log("Response preview:", preview);

        // Just make a single attempt at parsing - this worked better in previous versions
        try {
          console.log("Parsing response...");
          parsedEvents = this.parseGeminiResponse(text);

          // If we successfully got events, return them
          if (parsedEvents && parsedEvents.length > 0) {
            console.log(`Successfully parsed ${parsedEvents.length} events`);
          } else {
            // If no events, create a placeholder like before
            console.warn("No events parsed, using fallback");

            // Create a placeholder event that the user can edit
            const today = new Date();
            const dateStr = `${today.getFullYear()}-${String(
              today.getMonth() + 1
            ).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

            parsedEvents = [
              {
                eventId: Math.random().toString(36).slice(2, 9),
                id: Math.random().toString(36).slice(2, 9),
                title: "New Event",
                date: dateStr,
                type: "assignment",
                description:
                  "Event extracted from document. Please edit if needed.",
                location: "",
                time: "",
                priority: "medium",
                isRecurring: false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
            ];
          }
        } catch (parseError) {
          console.error("Parse attempt failed:", parseError);

          // Always create a placeholder event on any error
          console.warn("Parse error, using fallback event");

          // Create a placeholder event that the user can edit
          const today = new Date();
          const dateStr = `${today.getFullYear()}-${String(
            today.getMonth() + 1
          ).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

          parsedEvents = [
            {
              eventId: Math.random().toString(36).slice(2, 9),
              id: Math.random().toString(36).slice(2, 9),
              title: "New Event",
              date: dateStr,
              type: "assignment",
              description:
                "Event extracted from document. Please edit if needed.",
              location: "",
              time: "",
              priority: "medium",
              isRecurring: false,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ];
        }

        return parsedEvents;
      } catch (error) {
        // Handle specific API errors
        if (error.message?.includes("RESOURCE_EXHAUSTED")) {
          console.error("Gemini API quota exceeded:", error);
          return this.createPlaceholderEvent(
            "API quota exceeded. Please try again later."
          );
        } else if (error.message?.includes("timed out")) {
          console.error("Gemini API request timed out");
          return this.createPlaceholderEvent(
            "Request timed out. The file may be too large or complex."
          );
        } else if (error.message?.includes("INVALID_ARGUMENT")) {
          console.error("Invalid input to Gemini API:", error);
          return this.createPlaceholderEvent(
            "The file format is not supported for analysis."
          );
        } else if (error.message?.includes("JSON")) {
          console.error("JSON parsing error:", error);
          return this.createPlaceholderEvent(
            "Unable to extract events from this document"
          );
        } else {
          console.error("Error during Gemini API call:", error);
          return this.createPlaceholderEvent("Failed to process your document");
        }
      }
    } catch (error) {
      console.error("Error in parseFile:", error);

      // Create a more user-friendly error message based on the error type
      let userMessage = "Failed to process your file";

      if (error.message?.includes("parse") || error.message?.includes("JSON")) {
        userMessage = "Unable to extract events from this file";
      } else if (
        error.message?.includes("quota") ||
        error.message?.includes("limit")
      ) {
        userMessage = "Service is busy. Please try again in a few minutes";
      } else if (error.message?.includes("time")) {
        userMessage = "Processing took too long. Try a smaller file";
      } else if (
        error.message?.includes("Network") ||
        error.message?.includes("internet") ||
        error.message?.includes("connect")
      ) {
        userMessage = "Network error: Please check your internet connection";
      }

      // Return a placeholder event with the user-friendly message
      return this.createPlaceholderEvent(userMessage);
    }
  }
}

export const geminiParser = new GeminiParser();
