import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { CommonActions } from '@react-navigation/native';
import CalendarScreen from '../screens/CalendarScreen';
import EventFormScreen from '../screens/EventFormScreen';
import EventScreen from '../screens/EventScreen';
import EventListScreen from '../screens/EventListScreen';
import DashboardScreen from '../screens/DashboardScreen';
import AddEventOptionsScreen from '../screens/AddEventOptionsScreen';
import DayEventsScreen from '../screens/DayEventsScreen';
import AllEventsScreen from '../screens/AllEventsScreen';
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useIsFocused } from '@react-navigation/native';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

// Custom tab bar button for the middle "Add" button
function AddButton({ onPress, showBorder = false, style = {} }) {
  const { theme } = useTheme();
  
  return (
    <TouchableOpacity
      style={[
        styles.addButton, 
        { backgroundColor: theme.primary },
        showBorder && styles.addButtonWithBorder,
        style
      ]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={styles.addButtonInner}>
        <Ionicons name="add" size={28} color="white" />
      </View>
    </TouchableOpacity>
  );
}

// Stack navigator for calendar-related screens
// Custom hook to detect when a detail screen is focused
// This approach avoids issues with navigation state tracking
function useIsDetailScreenFocused(navigation) {
  const [isDetailScreen, setIsDetailScreen] = useState(false);
  
  // Listen to navigation state changes
  useEffect(() => {
    // This function will run whenever the navigation state changes
    const unsubscribe = navigation.addListener('state', (e) => {
      // Get current route info from the state
      const routes = e.data.state.routes;
      const currentIndex = e.data.state.index;
      const currentRoute = routes[currentIndex];
      
      // Check if we're on a detail screen
      const isOnDetailScreen = 
        currentRoute?.name === 'EventScreen' || 
        currentRoute?.name === 'EventListScreen';
        
      setIsDetailScreen(isOnDetailScreen);
    });
    
    // Clean up the listener on unmount
    return unsubscribe;
  }, [navigation]);
  
  return isDetailScreen;
}

// Wrap EventScreen with a higher-order component to hide the tab bar
const EventScreenWithHiddenTabBar = ({ navigation, route }) => {
  // Hide the tab bar when this screen mounts
  React.useEffect(() => {
    const parent = navigation.getParent();
    if (parent) {
      // Hide the tab bar
      parent.setOptions({
        tabBarStyle: { display: 'none' }
      });
      
      // Restore the tab bar when screen unmounts
      return () => {
        parent.setOptions({
          tabBarStyle: styles.tabBar
        });
      };
    }
  }, [navigation]);
  
  // Render the actual EventScreen
  return <EventScreen navigation={navigation} route={route} />;
};

// Similar wrapper for the EventListScreen
const EventListScreenWithHiddenTabBar = ({ navigation, route }) => {
  React.useEffect(() => {
    const parent = navigation.getParent();
    if (parent) {
      parent.setOptions({
        tabBarStyle: { display: 'none' }
      });
      
      return () => {
        parent.setOptions({
          tabBarStyle: styles.tabBar
        });
      };
    }
  }, [navigation]);
  
  return <EventListScreen navigation={navigation} route={route} />;
};

function CalendarStack({ navigation, route }) {
  // We no longer need the complex reset logic here
  // because we're handling it directly with CommonActions in the tab press
  
  return (
    <Stack.Navigator>
      <Stack.Screen 
        name="CalendarMain" 
        component={CalendarScreen} 
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="EventScreen" 
        component={EventScreenWithHiddenTabBar} 
        options={{ 
          title: 'Event Details',
          headerShown: true
        }}
      />
      <Stack.Screen 
        name="EventListScreen" 
        component={EventListScreenWithHiddenTabBar} 
        options={{
          title: 'Parsed Events', 
          headerShown: true
        }}
      />
    </Stack.Navigator>
  );
}

// Main tab navigator
function MainTabs() {
  const { theme } = useTheme();
  // We don't need this state anymore since we're using route params
  
  
  return (
    <>
      <Tab.Navigator
        screenOptions={({ route, navigation }) => {
          // Need to check if we're on a detail screen within Calendar stack
          const state = navigation.getState();
          
          // Find the Calendar stack
          const calendarTab = state.routes.find(r => r.name === 'Calendar');
          
          // If we're in the Calendar tab and its state exists, check what screen we're on
          let hideTabBar = false;
          if (calendarTab && calendarTab.state && calendarTab.state.index > 0) {
            // If we're not on the main calendar screen (index > 0), we're in a detail screen
            hideTabBar = true;
          }
          
          // Check for any screen that is processing a document
          // First check root routes
          let isAnyScreenProcessing = false;
          const rootState = navigation.getState();
          
          // Check root-level routes
          for (const r of rootState.routes) {
            if (r.params?.isProcessing) {
              isAnyScreenProcessing = true;
              break;
            }
            
            // Also check nested routes
            if (r.state && r.state.routes) {
              for (const nestedRoute of r.state.routes) {
                if (nestedRoute.params?.isProcessing) {
                  isAnyScreenProcessing = true;
                  break;
                }
              }
            }
          }
          
          if (isAnyScreenProcessing) {
            hideTabBar = true;
          }
          
          let tabBarStyle = styles.tabBar;
          
          // Only hide the tab bar for screens that should hide it
          if (hideTabBar) {
            tabBarStyle = { display: 'none' };
          }
          
          return {
            tabBarShowLabel: true,
            tabBarStyle: tabBarStyle,
            tabBarActiveTintColor: theme.primary,
            tabBarInactiveTintColor: '#95a5a6',
            headerShown: false,
            tabBarHideOnKeyboard: true,
          };
        }}
      >
      <Tab.Screen 
        name="Dashboard" 
        component={DashboardScreen}
        options={({ navigation }) => {
          // Check for processing state in navigation
          const state = navigation.getState();
          const isProcessing = state.routes.some(r => r.params?.isProcessing) ||
                              (state.routes.some(r => r.state?.routes?.some(nr => nr.params?.isProcessing)));
          
          return {
            tabBarIcon: ({ color }) => (
              <Ionicons name="home-outline" size={24} color={color} />
            ),
            tabBarButton: ({ children, onPress }) => (
              <TouchableOpacity 
                onPress={isProcessing ? () => {} : onPress}
                style={{ opacity: isProcessing ? 0.5 : 1, flex: 1, alignItems: 'center' }}
              >
                {children}
              </TouchableOpacity>
            )
          };
        }}
      />
      <Tab.Screen 
        name="Add" 
        component={EventFormScreen}
        options={({ navigation, route }) => {
          // Check for processing state in navigation
          const state = navigation.getState();
          const isProcessing = state.routes.some(r => r.params?.isProcessing) ||
                              (state.routes.some(r => r.state?.routes?.some(nr => nr.params?.isProcessing)));
          
          return {
            tabBarButton: () => {
              // Get the currently active tab index
              const activeIndex = navigation.getState().index;
              // Show border when on Dashboard (index 0) or Calendar (index 2)
              const showBorder = activeIndex === 0 || activeIndex === 2;
              return (
                <AddButton 
                  onPress={isProcessing ? () => {} : () => navigation.navigate('AddEventOptions')}
                  showBorder={showBorder}
                  style={{ opacity: isProcessing ? 0.5 : 1 }}
                />
              );
            },
            tabBarStyle: { display: 'none' }
          };
        }}
      />
      <Tab.Screen 
        name="CalendarTab" 
        options={({ navigation }) => {
          // Check for processing state in navigation
          const state = navigation.getState();
          const isProcessing = state.routes.some(r => r.params?.isProcessing) ||
                              (state.routes.some(r => r.state?.routes?.some(nr => nr.params?.isProcessing)));
          
          return {
            tabBarIcon: ({ color }) => (
              <Ionicons name="calendar-outline" size={24} color={color} />
            ),
            title: "Calendar",
            tabBarButton: ({ children, onPress }) => (
              <TouchableOpacity 
                onPress={isProcessing ? () => {} : onPress}
                style={{ opacity: isProcessing ? 0.5 : 1, flex: 1, alignItems: 'center' }}
              >
                {children}
              </TouchableOpacity>
            )
          };
        }}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            // Check if processing is happening
            const state = navigation.getState();
            const isProcessing = state.routes.some(r => r.params?.isProcessing) ||
                               (state.routes.some(r => r.state?.routes?.some(nr => nr.params?.isProcessing)));
            
            if (isProcessing) {
              // Prevent navigation during processing
              e.preventDefault();
              return;
            }
            
            // Prevent default navigation
            e.preventDefault();
            
            // This properly navigates to the nested CalendarMain screen
            navigation.navigate('CalendarTab', {
              screen: 'CalendarMain'
            });
          }
        })}
      >
        {() => (
          <Stack.Navigator>
            <Stack.Screen 
              name="CalendarMain" 
              component={CalendarScreen} 
              options={{ headerShown: false }}
            />
          </Stack.Navigator>
        )}
      </Tab.Screen>
    </Tab.Navigator>
    </>
  );
}

// Create a wrapped version of MainTabs that includes the tab bar divider
// It will only be visible on the primary screens, not detail or modal screens
function MainTabsWithDivider(props) {
  const [showDivider, setShowDivider] = useState(true);
  
  // Track navigation state changes
  useEffect(() => {
    const navigation = props.navigation;
    
    const trackDetailScreens = () => {
      try {
        // Get the navigation state
        const state = navigation.getState();
        if (!state) return;
        
        // Check if we're on a main screen or any other screen
        if (state.index > 0) {
          // We're on a modal or detail screen, hide divider
          setShowDivider(false);
        } else {
          // Find if we're on a detail screen within tabs
          const routes = state.routes;
          if (routes && routes[0] && routes[0].state) {
            const tabState = routes[0].state;
            
            // Check if Calendar tab is selected and showing a detail screen
            const calendarTabIndex = tabState.routes.findIndex(r => r.name === 'Calendar');
            if (calendarTabIndex !== -1 && calendarTabIndex === tabState.index) {
              const calendarRoute = tabState.routes[calendarTabIndex];
              if (calendarRoute.state && calendarRoute.state.index > 0) {
                // We're on a detail screen within the Calendar stack
                setShowDivider(false);
                return;
              }
            }
          }
          
          // If we reach here, we're on a main screen
          setShowDivider(true);
        }
      } catch (error) {
        console.error('Error tracking navigation state:', error);
      }
    };
    
    // Initial check
    trackDetailScreens();
    
    // Subscribe to state changes
    const unsubscribe = navigation.addListener('state', trackDetailScreens);
    
    // Cleanup
    return () => unsubscribe();
  }, [props.navigation]);
  
  return (
    <>
      <MainTabs {...props} />
      {showDivider && (
        <View style={[styles.tabBarDivider, { pointerEvents: 'none' }]} />
      )}
    </>
  );
}

// Main app navigator
export default function AppNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Main" component={MainTabsWithDivider} />
      <Stack.Screen 
        name="AddEventOptions" 
        component={AddEventOptionsScreen} 
        options={{ 
          presentation: 'modal'
        }}
      />
      <Stack.Screen 
        name="EventForm" 
        component={EventFormScreen} 
        options={{ 
          headerShown: false, // Hide the native header
          presentation: 'modal'
        }}
      />
      <Stack.Screen 
        name="EventScreen" 
        component={EventScreen} 
        options={{ 
          headerShown: false
        }}
      />
      <Stack.Screen 
        name="EventListScreen" 
        component={EventListScreenWithHiddenTabBar} 
        options={{ 
          headerShown: false
        }}
      />
      <Stack.Screen 
        name="DayEvents" 
        component={DayEventsScreen} 
        options={{ 
          headerShown: false
        }}
      />
      <Stack.Screen 
        name="AllEvents" 
        component={AllEventsScreen} 
        options={{ 
          headerShown: false
        }}
      />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    bottom: -15, // Extend below screen
    left: 0,
    right: 0,
    elevation: 5,
    backgroundColor: 'white',
    height: 90,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.27,
    shadowRadius: 4.65,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingBottom: 20, // Extra padding at bottom to account for devices with home indicators
  },
  tabBarDivider: {
    position: 'absolute',
    bottom: 13, // Start precisely at the bottom edge of the plus circle
    height: 22, // Fixed height - not too long
    width: 1,
    backgroundColor: '#e0e0e0',
    left: '50%',
    zIndex: 0, // Lower than the add button
  },
  addButton: {
    position: 'absolute',
    top: -32, // Raised from the tab bar
    left: '50%', // Center horizontally
    marginLeft: -32, // Offset by half the width
    height: 64,
    width: 64,
    borderRadius: 32,
    // backgroundColor set dynamically with theme.primary
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.23,
    shadowRadius: 2.62,
    elevation: 8,
    zIndex: 10,
  },
  addButtonWithBorder: {
    borderWidth: 2, // Thinner border
    borderColor: 'white',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  addButtonInner: {
    width: '100%',
    height: '100%',
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  }
});
