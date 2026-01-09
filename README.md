# EasyCal

AI-powered calendar management for students, making academic scheduling effortless.

![EasyCal Logo](assets/easy_cals_icon.png)

## About

EasyCal is an intelligent calendar application designed specifically for students to streamline the management of academic schedules. By leveraging AI technology, EasyCal automatically extracts important dates, deadlines, and events from course syllabi and documents, eliminating the tedious task of manual calendar entry.

## Key Features

- **AI-Powered Document Parsing**: Upload syllabi, assignment sheets, or any course document to automatically extract events with dates, titles, locations, and descriptions.
- **Smart Event Categorization**: Events are automatically categorized as tests, assignments, meetings, or office hours with appropriate color-coding.
- **Cross-Platform Sync**: Seamlessly access your calendar from web browsers or mobile devices with real-time synchronization.
- **Google Authentication**: Secure and convenient sign-in using your Google account.
- **Interactive Calendar Interface**: Intuitive monthly calendar view with filtering capabilities for different event types.
- **Document-to-Calendar Workflow**: Upload documents → AI extracts events → Review and confirm → Events appear in calendar.
- **Manual Event Creation**: Add and edit events manually with a user-friendly interface.
- **Theme Customization**: Personalize the app appearance to match your preferences.

## Technology Stack

### Frontend
- **Web**: Next.js, React, Tailwind CSS, Shadcn/UI
- **Mobile**: React Native with gesture-based navigation

### Backend & Infrastructure
- **Authentication**: NextAuth.js with Google OAuth
- **Data Storage**: AWS DynamoDB for cloud storage and synchronization
- **AI Integration**: Google Gemini AI for intelligent document parsing

## Platform Availability

- **Web Application**: Access from any modern web browser
- **Mobile Application**: Native apps for iOS and Android devices

## Getting Started

### Web Application

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

### Mobile Application

Navigate to the mobile app directory:

```bash
cd smart-calendar-mobile
npm install
npx react-native run-ios   # For iOS
# or
npx react-native run-android   # For Android
```

## How It Works

1. **Sign In**: Authenticate with your Google account
2. **Upload Documents**: Submit course syllabi or documents containing academic dates
3. **AI Processing**: Our system uses Google's Gemini AI to extract events, dates, and details
4. **Review & Confirm**: Verify the extracted events before adding them to your calendar
5. **Manage Calendar**: View, filter, edit, and organize your academic schedule
6. **Cross-Device Access**: Access your up-to-date calendar from any device

## Use Cases

- **Course Management**: Keep track of all deadlines and exams for multiple courses
- **Syllabus Parsing**: Quickly extract all important dates from course syllabi
- **Schedule Organization**: Color-coded events for visual organization of academic responsibilities
- **Priority Management**: Focus on what matters with automatic event prioritization

## Future Development Plans

- Integration with learning management systems (Canvas, Blackboard, etc.)
- Enhanced recurring event patterns 
- Collaborative calendars for study groups
- Smart reminders based on event priority

## Learn More

To learn more about the technologies used:

- [Next.js Documentation](https://nextjs.org/docs)
- [React Native Documentation](https://reactnative.dev/docs/getting-started)
- [Google Gemini AI](https://ai.google.dev/docs/gemini_api_overview)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

[MIT](https://choosealicense.com/licenses/mit/)
