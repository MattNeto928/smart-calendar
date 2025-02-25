import React, { useState, useEffect, useRef } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator, Animated, Easing, Alert } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import Navbar from '../components/Navbar';
import CalendarTile from '../components/CalendarTile';
import SyncNotification from '../components/SyncNotification';
import ProcessingModal from '../components/ProcessingModal';
import { useAuth } from '../contexts/AuthContext';
import { getEvents, saveEvent } from '../lib/aws';
import { geminiParser } from '../lib/gemini';
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

  const formatDateKey = (date) => {
    return date.toDateString();
  };
  
  // Immediately fetch and sync events when the component mounts
  useEffect(() => {
    console.log('CalendarScreen mounted, checking for user:', !!user);
    
    // Function to perform both fetch and sync
    const initializeCalendar = async () => {
      if (!user) {
        console.log('No user available, skipping sync');
        return;
      }
      
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
    };
  }, [user]); // Re-run when user changes
  
  // Check for notification from EventListScreen when component mounts or updates
  useEffect(() => {
    if (route.params?.notification) {
      // Show the notification passed from EventListScreen
      setSyncNotification(route.params.notification);
      
      // Clear the route params to prevent showing notification again on future navigation
      navigation.setParams({ notification: undefined });
      
      // Refresh events
      fetchEvents();
    }
  }, [route.params]);

  const fetchEvents = async () => {
    if (!user) return;

    try {
      setIsLoadingEvents(true);
      const fetchedEvents = await getEvents(user.id);
      console.log('Fetched events from DynamoDB:', fetchedEvents);
      
      const formattedEvents = {};
      fetchedEvents.forEach(event => {
        console.log('Processing event:', event, 'with date:', event.date);
        const dateKey = event.date;
        if (!formattedEvents[dateKey]) formattedEvents[dateKey] = [];
        formattedEvents[dateKey].push(event);
      });
      console.log('Formatted events by date:', formattedEvents);
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
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(panelAnim, {
            toValue: 0,
            duration: 300,
            easing: Easing.out(Easing.ease),
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
            duration: 300,
            useNativeDriver: true,
          }),
          // Panel slide down
          Animated.timing(panelAnim, {
            toValue: 500,
            duration: 300,
            easing: Easing.in(Easing.ease),
            useNativeDriver: true,
          }),
          // Selection fade out
          Animated.timing(selectionFadeAnim, {
            toValue: 0,
            duration: 300, // Match duration with other animations
            useNativeDriver: true,
          }),
        ]).start(() => {
          setSelectedDay(null);
          setSelectedEvents([]);
          setIsDateFading(false);
          resolve();
        });
      }
    });
  };

  const handleDayClick = async (day) => {
    if (!day) {
      await animatePanel(false);
      return;
    }

    const dateKey = formatDateKey(day);
    const newEvents = events[dateKey] || [];

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
          duration: 300, // Match duration with other animations
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
        duration: 300, // Match duration with other animations
        useNativeDriver: true,
      }).start();
      
      await animatePanel(true);
    }
  };

  const animateMonthChange = (direction) => {
    const isNext = direction === 'next';
    
    // If panel is open, close it first
    if (selectedDay) {
      animatePanel(false);
    }

    // Start fade out
    Animated.timing(monthFadeAnim, {
      toValue: 0,
      duration: 200,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true
    }).start(() => {
      // Update state and immediately start fade in
      setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + (isNext ? 1 : -1)));
      requestAnimationFrame(() => {
        Animated.timing(monthFadeAnim, {
          toValue: 1,
          duration: 200,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true
        }).start();
      });
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
    for (let d = 1; d <= lastDay.getDate(); d++) days.push(new Date(year, month, d));
    return days;
  }

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
              
              const extractedEvents = await geminiParser.parseFile(result.assets[0].uri)
                .catch(error => {
                  console.error('File parsing error:', error);
                  setIsProcessing(false);
                  Alert.alert('Error', 'Failed to parse file');
                  throw error;
                });
              
              // Complete the progress bar
              setProcessingProgress(100);
              await new Promise(resolve => setTimeout(resolve, 500));
              
              // Hide processing modal
              setIsProcessing(false);
              setProcessingStage(null);
              setProcessingProgress(0);

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
                
                // Navigate to event list screen without saving first
                // Let user review and confirm before saving
                navigation.navigate('EventListScreen', { 
                  events: validEvents.map(event => ({
                    ...event,
                    userId: user.id,  // Add userId to each event
                    eventId: event.eventId || event.id || generateId(), // Ensure eventId exists
                    createdAt: event.createdAt || new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                  }))
                });
              } catch (saveError) {
                console.error('Error saving events:', saveError);
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
        <TouchableOpacity onPress={() => animateMonthChange('prev')}>
          <Ionicons
            name="chevron-back"
            size={24}
            color="#007bff"
          />
        </TouchableOpacity>
        <View style={styles.monthContainer}>
          <Animated.Text style={[styles.monthText, { opacity: monthFadeAnim }]}>
            {currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
          </Animated.Text>
        </View>
        <TouchableOpacity onPress={() => animateMonthChange('next')}>
          <Ionicons
            name="chevron-forward"
            size={24}
            color="#007bff"
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
          <ActivityIndicator size="large" color="#007bff" />
        </View>
      ) : (
        <Animated.View style={{ opacity: monthFadeAnim, flex: 1 }}>
          <FlatList
            data={getDaysInMonth()}
            renderItem={({ item }) => {
              if (!item) return <CalendarTile day={null} events={[]} onPress={null} />;
              
              const dateKey = formatDateKey(item);
              const dayEvents = events[dateKey] || [];
              
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
        </Animated.View>
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
              Events on {selectedDay.toLocaleDateString()}
            </Text>
            {selectedEvents.length > 0 ? (
              <FlatList
                data={selectedEvents}
                renderItem={({ item }) => {
                  const colors = getEventColor(item.type, item.priority);
                  return (
                    <TouchableOpacity 
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
                      onPress={() => navigation.navigate('EventScreen', { event: item })}
                    >
                      <View style={styles.eventDetails}>
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
                      </View>
                    </TouchableOpacity>
                  );
                }}
                keyExtractor={(item, index) => index.toString()}
              />
            ) : (
              <View style={styles.noEventsContainer}>
                <Text style={styles.noEventsText}>No events for this day</Text>
                <TouchableOpacity 
                  style={styles.addEventButton}
                  onPress={() => {
                    setSelectedDate(selectedDay);
                    setIsEventTypeModalVisible(true);
                  }}
                >
                  <Ionicons name="add" size={24} color="#2563eb" />
                </TouchableOpacity>
              </View>
            )}
            <TouchableOpacity style={styles.closeButton} onPress={() => handleDayClick(null)}>
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </Animated.View>
        </>
      )}
      
      {isProcessing && processingStage && (
        <ProcessingModal
          stage={processingStage}
          progress={processingProgress}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#f8f9fa',
    position: 'relative'
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
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  monthContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthText: {
    fontSize: 20,
    fontFamily: 'Roboto-Bold',
    color: '#111827',
    textAlign: 'center',
  },
  weekDays: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
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
  calendarGrid: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 8,
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
    maxHeight: '50%',
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#e5e7eb',
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
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    marginTop: 15,
    backgroundColor: '#3b82f6',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Roboto-Bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
});
