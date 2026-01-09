import React, { useState, useEffect, useRef } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator, Animated, Easing, Alert, ScrollView } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import LinearGradient from 'react-native-linear-gradient';
import Navbar from '../components/Navbar';
import CalendarTile from '../components/CalendarTile';
import SyncNotification from '../components/SyncNotification';
import ProcessingModal from '../components/ProcessingModal';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { getEvents, saveEvent, deleteEvent } from '../lib/aws';
import { geminiParser } from '../lib/gemini';
import { formatStandardDate } from '../lib/dateUtils';
import EventTypeModal from '../components/EventTypeModal';

const getEventColor = (type, priority) => {
  const baseColors = {
    test: {
      bg: '#fee2e2',
      text: '#991b1b',
      border: '#fecaca'
    },
    assignment: {
      bg: '#dbeafe',
      text: '#1e40af',
      border: '#bfdbfe'
    },
    meeting: {
      bg: '#dcfce7',
      text: '#166534',
      border: '#bbf7d0'
    },
    office_hours: {
      bg: '#f3e8ff',
      text: '#6b21a8',
      border: '#e9d5ff'
    }
  };

  const priorityColors = {
    high: '#dc2626',
    medium: '#eab308',
    low: '#22c55e'
  };

  return {
    ...(baseColors[type] || baseColors.assignment),
    priority: priority ? priorityColors[priority] : null
  };
};

export default function CalendarScreen({ navigation, route }) {
  const [isEventTypeModalVisible, setIsEventTypeModalVisible] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const { user, syncEvents } = useAuth();
  const { theme } = useTheme();
  const styles = React.useMemo(() => makeStyles(theme), [theme]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const monthFadeAnim = useRef(new Animated.Value(1)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const panelAnim = useRef(new Animated.Value(500)).current;
  const selectionFadeAnim = useRef(new Animated.Value(1)).current;
  const [selectedDay, setSelectedDay] = useState(null);
  const [selectedEvents, setSelectedEvents] = useState([]);
  const [events, setEvents] = useState({});
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [syncNotification, setSyncNotification] = useState(null);
  const [isDateFading, setIsDateFading] = useState(false);
  const [prevSelectedDay, setPrevSelectedDay] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStage, setProcessingStage] = useState(null);
  const [processingProgress, setProcessingProgress] = useState(0);
  
  // Event type filters
  const [eventTypeFilters, setEventTypeFilters] = useState({
    test: true,
    assignment: true,
    meeting: true,
    office_hours: true,
    lecture: true
  });

  // Direct mapping of calendar dates to database format using our standardized function
  const formatDateKey = (date) => {
    if (!date) return '';
    
    // Use our standardized date formatting function
    const result = formatStandardDate(date);
    
    // Debug logging for understanding date conversions in calendar context
    console.log(`Calendar Date Conversion: ${date.toLocaleString()} → ${result}`);
    
    return result;
  };
  
  // Immediately fetch and sync events when the component mounts or becomes focused
  useEffect(() => {
    console.log('CalendarScreen mounted, checking for user:', !!user);
    
    // Function to reset the UI state when coming to this screen
    const resetCalendarState = () => {
      console.log('Resetting calendar UI state');
      // Close any open event panel
      if (selectedDay) {
        setSelectedDay(null);
        setSelectedEvents([]);
      }
      
      // Reset any animations
      if (monthFadeAnim._value !== 1) {
        monthFadeAnim.setValue(1);
      }
      if (backdropAnim._value !== 0) {
        backdropAnim.setValue(0);
      }
      if (panelAnim._value !== 500) {
        panelAnim.setValue(500);
      }
      if (selectionFadeAnim._value !== 1) {
        selectionFadeAnim.setValue(1);
      }
    };
    
    // Add focus listener to reset state when screen becomes focused
    const unsubscribeFocus = navigation.addListener('focus', () => {
      console.log('CalendarScreen focused - resetting state');
      resetCalendarState();
    });
    
    // Function to perform both fetch and sync
    const initializeCalendar = async () => {
      if (!user) {
        console.log('No user available, skipping sync');
        return;
      }
      
      // Reset UI state on initialization too
      resetCalendarState();
      
      console.log('Starting calendar initialization for user:', user.email);
      
      // Show sync notification immediately
      setSyncNotification({
        message: 'Loading your calendar...',
        type: 'syncing'
      });
      
      try {
        // First load local events
        console.log('Fetching local events');
        await fetchEvents();
        
        // Then perform a full sync
        console.log('Starting full sync');
        await handleSync();
        
        console.log('Calendar initialization complete');
      } catch (error) {
        console.error('Calendar initialization failed:', error);
        setSyncNotification({
          message: 'Failed to load calendar',
          type: 'error'
        });
      }
    };
    
    // Immediately initialize
    initializeCalendar();
    
    // Return cleanup function
    return () => {
      console.log('CalendarScreen unmounting');
      unsubscribeFocus();
    };
  }, [user, navigation]); // Re-run when user or navigation changes
  
  // Check for notification and refresh triggers when component mounts or updates
  useEffect(() => {
    if (route.params?.notification || route.params?.refresh) {
      console.log('Calendar refresh triggered:', route.params);
      
      // Show any notification that was passed
      if (route.params?.notification) {
        setSyncNotification(route.params.notification);
      }
      
      // Always refresh events when requested
      fetchEvents();
      
      // Clear the route params to prevent showing notification again on future navigation
      navigation.setParams({ 
        notification: undefined,
        refresh: undefined,
        timestamp: undefined
      });
    }
  }, [route.params]);
  
  // Reset animations when component unmounts to prevent memory leaks
  useEffect(() => {
    return () => {
      monthFadeAnim.setValue(1);
      backdropAnim.setValue(0);
      panelAnim.setValue(500);
      selectionFadeAnim.setValue(1);
    };
  }, []);

  const fetchEvents = async () => {
    if (!user) return;

    try {
      setIsLoadingEvents(true);
      const fetchedEvents = await getEvents(user.id);
      console.log('Fetched events from DynamoDB:', fetchedEvents.length);
      
      const formattedEvents = {};
      fetchedEvents.forEach(event => {
        if (!event.date) {
          console.log('Event missing date, skipping:', event.title);
          return;
        }
        
        // Ensure date format is consistent (YYYY-MM-DD)
        // This validates the date format and ensures it's in our standard format
        const dateKey = event.date;
        
        // Validate date format (should be YYYY-MM-DD)
        const isValidDateFormat = /^\d{4}-\d{2}-\d{2}$/.test(dateKey);
        if (!isValidDateFormat) {
          console.warn(`Event has invalid date format: ${event.title}, date: ${dateKey}`);
          return;
        }
        
        // Add event to the appropriate date in our formatted events object
        if (!formattedEvents[dateKey]) formattedEvents[dateKey] = [];
        formattedEvents[dateKey].push(event);
        
        console.log(`Event "${event.title}" added to calendar on date: ${dateKey}`);
      });
      
      console.log('Total dates with events:', Object.keys(formattedEvents).length);
      setEvents(formattedEvents);
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setIsLoadingEvents(false);
    }
  };

  const handleSync = async () => {
    if (!user) return;

    const maxRetries = 3;
    let retryCount = 0;

    while (retryCount < maxRetries) {
      try {
        setSyncNotification({
          message: 'Syncing events...',
          type: 'syncing'
        });

        const result = await syncEvents();
        console.log('Sync payload size:', JSON.stringify(result).length);
        
        await fetchEvents();
        
        setSyncNotification({
          message: `Synced ${result.syncedCount} events`,
          type: 'success'
        });
        
        break; // Exit on success
      } catch (error) {
        console.error(`Sync attempt ${retryCount + 1} failed:`, error);
        if (error.code === 'CRC32CheckFailed' && retryCount < maxRetries - 1) {
          const delay = Math.pow(2, retryCount) * 1000;
          console.log(`Retrying in ${delay / 1000} seconds...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          retryCount++;
        } else {
          setSyncNotification({
            message: 'Failed to sync events',
            type: 'error'
          });
          break;
        }
      }
    }
  };

  const animatePanel = (show) => {
    return new Promise((resolve) => {
      if (show) {
        // Reset animations
        backdropAnim.setValue(0);
        panelAnim.setValue(500);

        // Start animations
        Animated.parallel([
          Animated.timing(backdropAnim, {
            toValue: 1,
            duration: 250,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.spring(panelAnim, {
            toValue: 0,
            tension: 65,
            friction: 10,
            useNativeDriver: true,
          }),
        ]).start(resolve);
      } else {
        // Run all animations in parallel
        setIsDateFading(true);
        Animated.parallel([
          // Backdrop fade out
          Animated.timing(backdropAnim, {
            toValue: 0,
            duration: 200,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          }),
          // Panel slide down with spring physics
          Animated.timing(panelAnim, {
            toValue: 500,
            duration: 250,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          }),
          // Selection fade out
          Animated.timing(selectionFadeAnim, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start(() => {
          // Only after the animation completes, update state
          setTimeout(() => {
            setSelectedDay(null);
            setSelectedEvents([]);
            setIsDateFading(false);
            resolve();
          }, 50); // Small delay to ensure animation completes first
        });
      }
    });
  };

  const handleDayClick = async (day) => {
    // Prevent multiple rapid clicks
    if (isDateFading) return;
    
    if (!day) {
      await animatePanel(false);
      return;
    }

    const dateKey = formatDateKey(day);
    // Apply event type filters
    const newEvents = (events[dateKey] || []).filter(
      event => eventTypeFilters[event.type] || false
    );

    // If a fade out animation is in progress, stop it
    if (isDateFading) {
      selectionFadeAnim.stopAnimation();
      setIsDateFading(false);
    }

    if (selectedDay) {
      if (selectedDay.toDateString() === day.toDateString()) {
        // Clicking the same day - close
        await animatePanel(false);
      } else {
        // Different day - update and animate
        // First close the current panel
        await animatePanel(false);
        
        // Then update selection and show new panel
        setPrevSelectedDay(day);
        setSelectedDay(day);
        setSelectedEvents(newEvents);
        
        // Fade in new selection
        selectionFadeAnim.setValue(0);
        Animated.timing(selectionFadeAnim, {
          toValue: 1,
          duration: 200,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start();
        
        await animatePanel(true);
      }
    } else {
      // No day selected - open
      setPrevSelectedDay(day);
      setSelectedDay(day);
      setSelectedEvents(newEvents);
      
      // Fade in selection
      selectionFadeAnim.setValue(0);
      Animated.timing(selectionFadeAnim, {
        toValue: 1,
        duration: 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
      
      await animatePanel(true);
    }
  };

  const animateMonthChange = (direction) => {
    const isNext = direction === 'next';
    
    // Prevent rapid month changes
    if (monthFadeAnim._value < 0.5) return;
    
    // If panel is open, close it first
    if (selectedDay) {
      animatePanel(false);
    }

    // Start fade out
    Animated.timing(monthFadeAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true
    }).start(() => {
      // Update state and immediately start fade in
      setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + (isNext ? 1 : -1)));
      
      // Fade in new month with slight delay
      setTimeout(() => {
        Animated.timing(monthFadeAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true
        }).start();
      }, 50);
    });
  };

  function getDaysInMonth() {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const days = [];
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const startDay = firstDay.getDay();
    for (let i = 0; i < startDay; i++) days.push(null);
    for (let d = 1; d <= lastDay.getDate(); d++) {
      // Create date with noon UTC time to avoid timezone issues
      const date = new Date(Date.UTC(year, month, d, 12, 0, 0));
      days.push(date);
    }
    return days;
  }

  // Setup horizontal swipe gesture for month navigation
  const [showSwipeHelper, setShowSwipeHelper] = useState(true);
  
  // Hide swipe helper after first use
  useEffect(() => {
    if (showSwipeHelper) {
      const timer = setTimeout(() => {
        setShowSwipeHelper(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [showSwipeHelper]);
  
  // Effect to update selected events when filters change
  useEffect(() => {
    if (selectedDay) {
      const dateKey = formatDateKey(selectedDay);
      // Apply the updated filters to the events
      const filteredEvents = (events[dateKey] || []).filter(
        event => eventTypeFilters[event.type] || false
      );
      setSelectedEvents(filteredEvents);
    }
  }, [eventTypeFilters, selectedDay, events]);
  
  // Make a worklet version of animateMonthChange for gesture handler
  const handleMonthChange = Gesture.Pan()
    .activeOffsetX([-20, 20]) // Start recognizing after 20px movement
    .onEnd((e) => {
      const direction = e.translationX > 100 ? 'prev' : e.translationX < -100 ? 'next' : null;
      
      if (direction) {
        runOnJS(animateMonthChange)(direction);
        runOnJS(setShowSwipeHelper)(false);
      }
    });

  return (
    <View style={styles.container}>
      <EventTypeModal
        visible={isEventTypeModalVisible}
        onClose={() => setIsEventTypeModalVisible(false)}
        onSelectType={async (type) => {
          setIsEventTypeModalVisible(false);
          
          // Ensure modal closes completely before opening picker
          await new Promise(resolve => setTimeout(resolve, 300));
          
          // Reset any previous picker state
          setIsEventTypeModalVisible(false);
          
          if (type === 'custom') {
            navigation.navigate('EventForm', { 
              defaultDate: selectedDate || selectedDay || new Date() 
            });
          } else {
            try {
              // Add temporary debug logging
              console.log('Opening document picker...');
              
              const result = await DocumentPicker.getDocumentAsync({
                type: ['image/*', 'application/pdf'],
                copyToCacheDirectory: true
              }).catch(error => {
                console.error('DocumentPicker error:', error);
                throw error;
              });

              // Reset picker state if canceled
              if (result.canceled) {
                console.log('Picker canceled');
                return;
              }

              console.log('Document picker result:', result);
              
              if (!result.assets?.[0]?.uri) {
                console.warn('Invalid document picker result:', result);
                Alert.alert('Error', 'Invalid file selection');
                return;
              }

              // Show processing modal with stages
              setIsProcessing(true);
              setProcessingStage('uploading');
              setProcessingProgress(0);
              
              // Simulate upload progress
              const uploadTimer = setInterval(() => {
                setProcessingProgress(prev => {
                  if (prev < 30) return prev + 5;
                  clearInterval(uploadTimer);
                  return 33;
                });
              }, 200);
              
              // Wait for "upload" to complete
              await new Promise(resolve => setTimeout(resolve, 1500));
              
              // Move to analyzing stage
              setProcessingStage('analyzing');
              
              // Simulate analysis progress
              const analyzeTimer = setInterval(() => {
                setProcessingProgress(prev => {
                  if (prev < 62) return prev + 5;
                  clearInterval(analyzeTimer);
                  return 66;
                });
              }, 200);
              
              // Wait for "analysis" to complete
              await new Promise(resolve => setTimeout(resolve, 1500));
              
              // Move to parsing stage
              setProcessingStage('parsing');
              setProcessingProgress(70);
              
              let extractedEvents;
              try {
                // Add additional error handling here
                extractedEvents = await geminiParser.parseFile(result.assets[0].uri);
                
                // Complete the progress bar only on success
                setProcessingProgress(100);
                await new Promise(resolve => setTimeout(resolve, 500));
                
                // Hide processing modal
                setIsProcessing(false);
                setProcessingStage(null);
                setProcessingProgress(0);
              } catch (error) {
                console.error('File parsing error:', error);
                // Ensure processing modal is hidden
                setIsProcessing(false);
                setProcessingStage(null);
                setProcessingProgress(0);
                
                // Show appropriate error message
                const errorMessage = error.message.includes('internet') || 
                                    error.message.includes('Network') || 
                                    error.message.includes('connect') ?
                  'Please check your internet connection and try again.' : 
                  'Failed to parse file. Please try again or create events manually.';
                
                Alert.alert('Error', errorMessage);
                return; // Exit early
              }
              
              // Continue only if we have valid extracted events

              // Validate required fields
              const validEvents = extractedEvents.filter(event => 
                event.title && event.date && event.type
              );
              
              if (validEvents.length === 0) {
                Alert.alert(
                  'Invalid Events',
                  'No valid events found. Ensure events have title, date, and type.'
                );
                return;
              }

              // Show saving notification
              setSyncNotification({
                message: `Saving ${validEvents.length} events...`,
                type: 'syncing'
              });

              try {
                await Promise.all(validEvents.map(event => {
                  // Ensure required fields
                  if (!event.date || !event.type || !event.title) {
                    throw new Error('Event missing required fields');
                  }

                  console.log('Saving event:', event);
                  
                  return saveEvent({
                  userId: user.id,
                  eventId: event.id,
                  title: event.title,
                  date: event.date,
                  type: event.type,
                  description: event.description,
                  location: event.location,
                  time: event.time,
                  priority: event.priority,
                  courseTitle: event.courseTitle,
                  courseCode: event.courseCode,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString()
                })}));

                setSyncNotification({
                  message: `${validEvents.length} events added successfully`,
                  type: 'success'
                });

                // Generate a random ID for each event if not present
                const generateId = () => {
                  return Math.random().toString(36).substring(2, 9);
                };
                
                // Ensure all events have required fields before navigation
                const eventsForReview = validEvents.map(event => {
                  // Make sure each event has the required fields
                  const eventWithRequiredFields = {
                    ...event,
                    userId: user.id,
                    eventId: event.eventId || event.id || generateId(),
                    // Ensure these fields are always present
                    title: event.title || 'Untitled Event',
                    date: event.date || formatDateKey(new Date()),
                    type: event.type || 'assignment',
                    description: event.description || '',
                    time: event.time || '',
                    priority: event.priority || 'medium',
                    location: event.location || '',
                    createdAt: event.createdAt || new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                  };
                  
                  // Verify the date is in the correct format
                  if (!eventWithRequiredFields.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
                    console.warn(`Invalid date format for event: ${eventWithRequiredFields.title}, using today's date`);
                    eventWithRequiredFields.date = formatDateKey(new Date());
                  }
                  
                  return eventWithRequiredFields;
                });

                // Log events for debugging
                console.log(`Navigating to EventListScreen with ${eventsForReview.length} events:`, 
                  eventsForReview.map(e => `${e.title} (${e.date})`));
                
                // Navigate to event list screen for user review before saving
                navigation.navigate('EventListScreen', { events: eventsForReview });
              } catch (saveError) {
                console.error('Error saving events:', saveError.message, saveError.stack);
                Alert.alert(
                  'Error',
                  'Failed to save the extracted events. Please try again.'
                );
              }
            } catch (error) {
              console.error('Error processing file:', error);
              Alert.alert(
                'Error',
                'Failed to process the file. Please try again or create events manually.'
              );
            }
          }
        }}
      />
      
      <Navbar 
        onAddEvent={() => {
          setSelectedDate(new Date());
          setIsEventTypeModalVisible(true);
        }}
        onSync={handleSync}
      />
      
      {syncNotification && (
        <SyncNotification
          message={syncNotification.message}
          type={syncNotification.type}
          onDismiss={() => setSyncNotification(null)}
        />
      )}

      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => animateMonthChange('prev')}
          style={styles.navButton}
        >
          <Ionicons
            name="chevron-back"
            size={24}
            color="#ffffff"
          />
        </TouchableOpacity>
        <View style={styles.monthContainer}>
          <Animated.Text 
            style={[
              styles.monthText, 
              { opacity: monthFadeAnim }
            ]}
          >
            {currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
          </Animated.Text>
        </View>
        <TouchableOpacity 
          onPress={() => animateMonthChange('next')}
          style={styles.navButton}
        >
          <Ionicons
            name="chevron-forward"
            size={24}
            color="#ffffff"
          />
        </TouchableOpacity>
      </View>

      <View style={styles.weekDays}>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <Text key={day} style={styles.weekDayText}>{day}</Text>
        ))}
      </View>

      {isLoadingEvents ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={0x000000} />
        </View>
      ) : (
        <GestureDetector gesture={handleMonthChange}>
          <Animated.View 
            style={{ 
              opacity: monthFadeAnim
            }}
          >
            <View style={styles.calendarContainer}>
              <FlatList
                scrollEnabled={false}
                data={getDaysInMonth()}
                renderItem={({ item }) => {
                  if (!item) return <CalendarTile day={null} events={[]} onPress={null} />;
                  
                  const dateKey = formatDateKey(item);
                  // Filter events by type based on user-selected filters
                  const dayEvents = (events[dateKey] || []).filter(
                    event => eventTypeFilters[event.type] || false
                  );
                  
                  // Debug logging for Feb 22 or 23
                  if (dateKey === '2024-02-22' || dateKey === '2024-02-23') {
                    console.log(`Calendar Debug - Date: ${dateKey}, Events:`, dayEvents.length, 
                                `Item date: ${item.getFullYear()}-${String(item.getMonth() + 1).padStart(2, '0')}-${String(item.getDate()).padStart(2, '0')}`);
                  }
                  
                  return (
                    <CalendarTile
                      day={item}
                      events={dayEvents}
                      onPress={() => handleDayClick(item)}
                      isSelected={
                        (selectedDay && selectedDay.toDateString() === item.toDateString()) ||
                        (isDateFading && prevSelectedDay?.toDateString() === item.toDateString())
                      }
                      selectionOpacity={selectionFadeAnim}
                      currentMonth={currentMonth}
                    />
                  );
                }}
                keyExtractor={(item, index) => index.toString()}
                numColumns={7}
                style={styles.calendarGrid}
              />
              {/* Extra padding view at bottom to ensure tiles aren't cut off */}
              <View style={styles.calendarBottomPadding} />
            </View>
            
            {/* Event Type Filters - Positioned beneath the calendar */}
            <View style={styles.filtersContainer}>
              {/* Left fade gradient */}
              <LinearGradient
                colors={[theme.primaryLight || '#eaf5ff', 'rgba(234, 245, 255, 0)']}
                start={{x: 0, y: 0}}
                end={{x: 0.15, y: 0}}
                style={styles.fadeGradientLeft}
              />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersScrollContent}>
                {Object.keys(eventTypeFilters).map((type) => {
                  const typeColor = getEventColor(type).text;
                  return (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.filterButton,
                        eventTypeFilters[type] ? { backgroundColor: typeColor, borderColor: typeColor } : { borderColor: typeColor }
                      ]}
                      onPress={() => {
                        setEventTypeFilters(prev => ({
                          ...prev,
                          [type]: !prev[type]
                        }));
                      }}
                    >
                      <Text
                        style={[
                          styles.filterText,
                          eventTypeFilters[type] ? { color: '#fff' } : { color: typeColor }
                        ]}
                      >
                        {type === 'office_hours' ? 'Office Hrs' : 
                         type.charAt(0).toUpperCase() + type.slice(1)}
                      </Text>
                      {eventTypeFilters[type] && (
                        <Ionicons name="checkmark" size={12} color="#fff" style={styles.filterIcon} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              {/* Right fade gradient */}
              <LinearGradient
                colors={['rgba(234, 245, 255, 0)', theme.primaryLight || '#eaf5ff']}
                start={{x: 0.85, y: 0}}
                end={{x: 1, y: 0}}
                style={styles.fadeGradientRight}
              />
            </View>
          </Animated.View>
        </GestureDetector>
      )}

      {selectedDay && (
        <>
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => handleDayClick(null)}
            style={{ position: 'absolute', width: '100%', height: '100%' }}
          >
            <Animated.View 
              style={[
                styles.backdrop,
                {
                  opacity: backdropAnim,
                }
              ]}
            />
          </TouchableOpacity>
          <Animated.View 
            style={[
              styles.eventPanel,
              {
                transform: [{ translateY: panelAnim }]
              }
            ]}
          >
            <Text style={styles.eventPanelTitle}>
              Events on {new Date(selectedDay.getFullYear(), selectedDay.getMonth(), selectedDay.getDate(), 12).toLocaleDateString()}
            </Text>
            {selectedEvents.length > 0 ? (
              <FlatList
                data={selectedEvents}
                renderItem={({ item }) => {
                  const colors = getEventColor(item.type, item.priority);
                  return (
                    <View 
                      style={[
                        styles.eventItem,
                        {
                          backgroundColor: colors.bg,
                          borderColor: colors.border,
                        },
                        item.priority && {
                          borderLeftWidth: 3,
                          borderLeftColor: colors.priority
                        }
                      ]}
                    >
                      <TouchableOpacity 
                        style={styles.eventDetails}
                        onPress={() => {
                          // Navigate to the EventScreen at the root level
                          navigation.navigate('Main', {
                            screen: 'EventScreen',
                            params: { event: item }
                          });
                        }}
                      >
                        <Text style={[styles.eventText, { color: colors.text }]}>{item.title}</Text>
                        {item.time && (
                          <Text style={[styles.eventTime, { color: colors.text }]}>{item.time}</Text>
                        )}
                        {(item.courseTitle || item.courseCode) && (
                          <Text style={[styles.courseText, { color: colors.text }]}>
                            {[item.courseCode, item.courseTitle].filter(Boolean).join(' - ')}
                          </Text>
                        )}
                        {item.location && (
                          <Text style={[styles.locationText, { color: colors.text }]}>
                            {item.location}
                          </Text>
                        )}
                      </TouchableOpacity>
                      
                      <View style={styles.eventActions}>
                        <TouchableOpacity 
                          style={styles.eventActionButton}
                          onPress={() => {
                            navigation.navigate('EventForm', { event: item });
                          }}
                        >
                          <Ionicons name="pencil-outline" size={18} color={colors.text} />
                        </TouchableOpacity>
                        
                        <TouchableOpacity 
                          style={styles.eventActionButton}
                          onPress={() => {
                            Alert.alert(
                              "Delete Event",
                              `Are you sure you want to delete "${item.title}"?`,
                              [
                                { text: "Cancel", style: "cancel" },
                                { 
                                  text: "Delete", 
                                  style: "destructive",
                                  onPress: async () => {
                                    try {
                                      await deleteEvent(user.id, item.eventId);
                                      
                                      // Remove from local state
                                      const updatedEvents = selectedEvents.filter(
                                        event => event.eventId !== item.eventId
                                      );
                                      
                                      // Update both selectedEvents and the main events object
                                      setSelectedEvents(updatedEvents);
                                      
                                      const dateCopy = {...events};
                                      if (dateCopy[item.date]) {
                                        dateCopy[item.date] = dateCopy[item.date].filter(
                                          e => e.eventId !== item.eventId
                                        );
                                      }
                                      setEvents(dateCopy);
                                      
                                      // Show confirmation
                                      setSyncNotification({
                                        message: "Event deleted successfully",
                                        type: "success"
                                      });
                                      
                                      // Close panel if no events left
                                      if (updatedEvents.length === 0) {
                                        handleDayClick(null);
                                      }
                                    } catch (error) {
                                      console.error("Error deleting event:", error);
                                      setSyncNotification({
                                        message: "Failed to delete event",
                                        type: "error"
                                      });
                                    }
                                  }
                                }
                              ]
                            );
                          }}
                        >
                          <Ionicons name="trash-outline" size={18} color="#ff3b30" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                }}
                keyExtractor={(item, index) => index.toString()}
              />
            ) : (
              <View style={styles.noEventsContainer}>
                <Text style={styles.noEventsText}>No events for this day</Text>
                <View style={styles.addEventButton}>
                  <Ionicons name="arrow-down" size={24} color="#2563eb" />
                </View>
              </View>
            )}
            <TouchableOpacity style={styles.closeButton} onPress={() => handleDayClick(null)}>
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </Animated.View>
        </>
      )}
      
      {isProcessing && (
        <ProcessingModal
          stage={processingStage || 'uploading'}
          progress={processingProgress}
        />
      )}
      
      {showSwipeHelper && (
        <View style={styles.swipeIndicator}>
          <Ionicons name="arrow-back" size={14} color="#555" />
          <Text style={styles.swipeIndicatorText}>Swipe to change months</Text>
          <Ionicons name="arrow-forward" size={14} color="#555" />
        </View>
      )}
    </View>
  );
}

const makeStyles = (theme) => StyleSheet.create({
  // Event type filter styles
  filtersContainer: {
    backgroundColor: theme.primaryLight || '#eaf5ff',
    paddingVertical: 10,
    paddingHorizontal: 0,
    marginTop: 5,
    marginBottom: 10,
    borderRadius: 16,
    marginHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 0.5,
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  fadeGradientLeft: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 30,
    zIndex: 1,
  },
  fadeGradientRight: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 30,
    zIndex: 1,
  },
  filtersScrollContent: {
    paddingHorizontal: 40,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginHorizontal: 5,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  filterText: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'Roboto',
    letterSpacing: 0.2,
  },
  filterIcon: {
    marginLeft: 5,
    fontSize: 12,
  },
  container: { 
    flex: 1, 
    backgroundColor: theme.primary,
    position: 'relative',
    overflow: 'hidden',
    paddingBottom: 20, // Add extra space at the bottom
  },
  swipeIndicator: {
    position: 'absolute',
    bottom: 5,
    alignSelf: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
  },
  swipeIndicatorText: {
    color: '#555',
    fontSize: 12,
    fontFamily: 'Roboto',
    marginHorizontal: 5,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: 'transparent',
    marginBottom: 5,
  },
  monthContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthText: {
    fontSize: 20,
    fontFamily: 'Roboto-Bold',
    color: '#ffffff',
    textAlign: 'center',
  },
  weekDays: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    marginHorizontal: 10, // Add side margins for better appearance
  },
  weekDayText: {
    width: '14.28%',
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    fontFamily: 'Roboto',
    textTransform: 'uppercase',
  },
  calendarContainer: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    marginHorizontal: 10,
    marginBottom: 15,
    paddingBottom: 0, // Significantly increased padding to prevent bottom row from being cut off
    overflow: 'hidden', // Keep the rounded corners by hiding overflow
    position: 'relative', // For proper stacking context
  },
  calendarGrid: {
    backgroundColor: '#fff',
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 0, // Remove bottom padding, we'll use a separate view for this
  },
  calendarBottomPadding: {
    height: 5, // Reduced padding to accommodate filter bar
    width: '100%',
    backgroundColor: '#fff',
  },
  navButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  eventPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    padding: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '55%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 100,
  },
  eventPanelTitle: {
    fontSize: 18,
    fontFamily: 'Roboto-Bold',
    color: '#111827',
    marginBottom: 15,
  },
  eventItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 6,
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  eventDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 12,
  },
  eventDetails: {
    flex: 1,
    marginRight: 8,
  },
  eventActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    width: 80,
  },
  eventActionButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 18,
    marginLeft: 4,
  },
  eventText: {
    fontSize: 16,
    fontFamily: 'Roboto-Bold',
    color: '#111827',
    marginBottom: 2,
  },
  eventTime: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
    fontFamily: 'Roboto',
  },
  courseText: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
    fontFamily: 'Roboto',
  },
  locationText: {
    fontSize: 12,
    marginTop: 2,
    fontFamily: 'Roboto',
  },
  noEventsContainer: {
    alignItems: 'center',
    padding: 30,
  },
  noEventsText: {
    fontSize: 16,
    fontFamily: 'Roboto',
    color: '#6b7280',
    marginBottom: 15,
  },
  addEventButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    marginTop: 15,
    backgroundColor: theme.primary,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Roboto-Bold',
    letterSpacing: 0.5,
  },
  loadingContainer: {
    height: 300, // Fixed height to match typical calendar size
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderBottomEndRadius: 20,
    marginHorizontal: 10,
    marginBottom: 15,
  },
});
