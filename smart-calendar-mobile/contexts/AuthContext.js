import React, { createContext, useState, useContext, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DynamoDB } from 'aws-sdk';
import { dynamoDb } from '../App';

const verifyTableExists = async () => {
  try {
    const params = {
      TableName: process.env.EXPO_PUBLIC_DYNAMODB_TABLE_NAME,
      KeyConditionExpression: "userId = :userId",
      ExpressionAttributeValues: {
        ":userId": "test",
      },
      Limit: 1
    };

    await dynamoDb.query(params).promise();
    return true;
  } catch (error) {
    console.error("DynamoDB table not found. Please create the table with the correct schema.");
    return false;
  }
};

WebBrowser.maybeCompleteAuthSession();

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastSynced, setLastSynced] = useState(null);

  const [request, response, promptAsync] = Google.useAuthRequest({
    androidClientId: process.env.EXPO_PUBLIC_ANDROID_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_IOS_CLIENT_ID,
    expoClientId: process.env.EXPO_PUBLIC_WEB_CLIENT_ID,
    scopes: ['profile', 'email'],
  });

  useEffect(() => {
    checkUser();
  }, []);

  useEffect(() => {
    const handleResponse = async () => {
      if (response?.type === 'success') {
        try {
          console.log('Google OAuth response received, processing...');
          const { authentication } = response;
          console.log('Authentication object:', authentication);
          const result = await handleSignInResponse(authentication);
          console.log('Sign-in and sync process completed successfully:', result);
        } catch (error) {
          console.error('Error processing OAuth response:', {
            message: error.message,
            stack: error.stack,
            code: error.code
          });
          // Show error to user (implementation would depend on your UI framework)
        }
      } else if (response?.type === 'error') {
        console.error('Google OAuth error:', response.error);
        // Show error to user
      }
    };

    handleResponse();
  }, [response]);

  const checkUser = async () => {
    try {
      console.log('Checking for existing user session');
      const userJson = await AsyncStorage.getItem('user');
      if (userJson) {
        const userData = JSON.parse(userJson);
        console.log('Found existing user session:', userData.email);
        
        // Set user state immediately
        setUser(userData);
        
        // Refresh token if needed (implementation depends on your auth flow)
        const accessToken = await SecureStore.getItemAsync('accessToken');
        if (!accessToken) {
          console.warn('No access token found for returning user');
        }
      } else {
        console.log('No existing user session found');
      }
    } catch (error) {
      console.error('Error checking user:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSignInResponse = async (authentication) => {
    console.log('Handling Google OAuth sign-in response...');
    try {
      console.log('Fetching user info from Google...');
      const userInfoResponse = await fetch('https://www.googleapis.com/userinfo/v2/me', {
        headers: { Authorization: `Bearer ${authentication.accessToken}` },
      });
      
      if (!userInfoResponse.ok) {
        throw new Error(`Google User Info API error: ${userInfoResponse.status} ${userInfoResponse.statusText}`);
      }

      const userInfo = await userInfoResponse.json();
      console.log('Successfully fetched user info:', userInfo);

      const userData = {
        id: userInfo.email,
        email: userInfo.email,
        name: userInfo.name,
        picture: userInfo.picture,
        accessToken: authentication.accessToken,
      };

      console.log('Checking for clear cache flag...');
      const clearCache = await AsyncStorage.getItem('clearCache');
      if (clearCache === 'true') {
        console.log('Clearing cache...');
        await AsyncStorage.clear();
        await SecureStore.deleteItemAsync('accessToken');
        console.log('Cache cleared successfully');
      }

      console.log('Storing user credentials...');
      await SecureStore.setItemAsync('accessToken', authentication.accessToken);
      await AsyncStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);
      console.log('User credentials stored successfully');

      console.log('Starting event sync process...');
      const syncResult = await syncEvents(userData);
      console.log('Event sync completed:', syncResult);
      
      console.log('Removing clear cache flag...');
      await AsyncStorage.removeItem('clearCache');
      console.log('Clear cache flag removed successfully');

      return {
        user: userData,
        syncResult
      };
    } catch (error) {
      console.error('Error during sign-in process:', {
        message: error.message,
        stack: error.stack,
        code: error.code
      });
      
      // Clean up on error
      try {
        await SecureStore.deleteItemAsync('accessToken');
        await AsyncStorage.removeItem('user');
        setUser(null);
      } catch (cleanupError) {
        console.error('Error during cleanup:', cleanupError);
      }
      
      throw error;
    }
  };

  const syncEvents = async (userData) => {
    console.log('Starting event sync process (AWS only)...');
    const maxRetries = 3;
    let retryCount = 0;

    while (retryCount < maxRetries) {
      try {
        if (!(await verifyTableExists())) {
          throw new Error("DynamoDB table not found or misconfigured.");
        }

        // This function now only refreshes events from DynamoDB
        const params = {
          TableName: process.env.EXPO_PUBLIC_DYNAMODB_TABLE_NAME,
          KeyConditionExpression: 'userId = :userId',
          ExpressionAttributeValues: {
            ':userId': userData.id
          }
        };

        const result = await dynamoDb.query(params).promise();
        console.log(`Fetched ${result.Items?.length || 0} events from DynamoDB`);

        // Data validation and sanitization
        const validatedItems = result.Items?.map(item => {
          const sanitizedTitle = String(item.title).substring(0, 255); // Truncate title to 255 characters
          const sanitizedDescription = String(item.description || '').substring(0, 1024); // Truncate description to 1024 characters
          const sanitizedCourseCode = String(item.courseCode || '').substring(0, 255);
          const sanitizedCourseTitle = String(item.courseTitle || '').substring(0, 255);
          const sanitizedDate = String(item.date || '').substring(0, 255);
          const sanitizedId = String(item.id || '').substring(0, 255);
          const sanitizedLocation = String(item.location || '').substring(0, 255);
          const sanitizedPriority = String(item.priority || '').substring(0, 255);
          const sanitizedSelected = String(item.selected || '').substring(0, 255);
          const sanitizedTime = String(item.time || '').substring(0, 255);
          const sanitizedType = String(item.type || '').substring(0, 255);
          const sanitizedCreatedAt = String(item.createdAt || '').substring(0, 255);
          const sanitizedUpdatedAt = String(item.updatedAt || '').substring(0, 255);

          return {
            userId: String(item.userId),
            eventId: String(item.eventId),
            courseCode: sanitizedCourseCode,
            courseTitle: sanitizedCourseTitle,
            createdAt: sanitizedCreatedAt,
            date: sanitizedDate,
            description: sanitizedDescription,
            id: sanitizedId,
            location: sanitizedLocation,
            priority: sanitizedPriority,
            selected: sanitizedSelected,
            time: sanitizedTime,
            title: sanitizedTitle,
            type: sanitizedType,
            updatedAt: sanitizedUpdatedAt
          };
        }) || [];

        setLastSynced(new Date());
        return {
          totalEvents: validatedItems.length || 0,
          syncedCount: validatedItems.length || 0,
          skippedCount: 0,
          errorCount: 0,
          timestamp: new Date()
        };
      } catch (error) {
        console.error(`Error during event sync (AWS only), retry ${retryCount + 1}:`, error);
        if (error.code === 'CRC32CheckFailed' && retryCount < maxRetries) {
          retryCount++;
          console.log(`Retrying event sync after 1 second...`);
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
        } else {
          throw error;
        }
      }
    }

    throw new Error(`Event sync failed after ${maxRetries} retries.`);
  };

  const signOut = async () => {
    console.log('Starting sign out process...');
    try {
      console.log('Deleting access token from SecureStore...');
      await SecureStore.deleteItemAsync('accessToken');
      console.log('Access token deleted successfully');
      
      console.log('Removing user from AsyncStorage...');
      await AsyncStorage.removeItem('user');
      console.log('User removed from AsyncStorage');
      
      console.log('Clearing user state...');
      setUser(null);
      console.log('Setting clear cache flag...');
      await AsyncStorage.setItem('clearCache', 'true');
      console.log('Clear cache flag set successfully');
      console.log('Sign out completed successfully');
    } catch (error) {
      console.error('Error during sign out:', {
        message: error.message,
        stack: error.stack,
        code: error.code
      });
      throw error; // Re-throw to allow components to handle the error
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      lastSynced,
      signIn: () => promptAsync(),
      signOut,
      syncEvents: () => syncEvents(user),
    }}>
      {children}
    </AuthContext.Provider>
  );
};
