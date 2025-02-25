# EasyCal Mobile App Developer Guide

## Build Commands
- `npm start` - Start Expo development server
- `npm run ios` - Run on iOS simulator/device
- `npm run android` - Run on Android simulator/device
- `npm run web` - Run in web browser
- `npm run export-ios` - Build iOS bundle for production

## Code Style Guidelines
- **Imports**: Group React imports first, followed by third-party libraries, then local imports
- **Naming**: Use PascalCase for components, camelCase for variables/functions
- **Components**: Create functional components with React hooks
- **TypeScript**: Use TypeScript (.ts/.tsx) for new files, with proper interface definitions
- **Error Handling**: Use try/catch blocks with proper logging via console.error()
- **State Management**: Use React Context for global state (AuthContext)
- **Styling**: Use StyleSheet.create() for component styles
- **AWS Interactions**: Use the aws.ts utility functions for all DynamoDB/S3 operations
- **Environment Variables**: Access via process.env.EXPO_PUBLIC_*

## Git Workflow
- Create feature branches from main
- Use descriptive commit messages
- Test on multiple platforms before submitting PRs