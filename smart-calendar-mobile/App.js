import React, { useState, useEffect } from 'react';
import { Modal } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Font from 'expo-font';
import AppNavigator from './navigation/AppNavigator';
import AuthScreen from './screens/AuthScreen';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { DynamoDB } from 'aws-sdk';

// Configure AWS
console.log('Initializing DynamoDB client with:', {
  region: process.env.EXPO_PUBLIC_AWS_REGION,
  tableName: process.env.EXPO_PUBLIC_DYNAMODB_TABLE_NAME,
  hasAccessKey: !!process.env.EXPO_PUBLIC_AWS_ACCESS_KEY_ID,
  hasSecretKey: !!process.env.EXPO_PUBLIC_AWS_SECRET_ACCESS_KEY
});

export const dynamoDb = new DynamoDB.DocumentClient({
  region: process.env.EXPO_PUBLIC_AWS_REGION,
  accessKeyId: process.env.EXPO_PUBLIC_AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.EXPO_PUBLIC_AWS_SECRET_ACCESS_KEY,
  dynamoDbCrc32: false
});

console.log('AWS credentials loaded successfully.');
console.log('DynamoDB client initialized successfully.');

function AppContent() {
  const { user } = useAuth();

  return (
    <NavigationContainer>
      {user ? <AppNavigator /> : <AuthScreen />}
    </NavigationContainer>
  );
}

export default function App() {
  const [fontsLoaded, setFontsLoaded] = useState(false);

  useEffect(() => {
    async function loadFonts() {
      await Font.loadAsync({
        'Roboto': require('./assets/fonts/Roboto-Regular.ttf'),
        'Roboto-Bold': require('./assets/fonts/Roboto-Bold.ttf'),
      });
      setFontsLoaded(true);
    }
    loadFonts();
  }, []);

  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <ThemeProvider>
          <AppContent />
        </ThemeProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
