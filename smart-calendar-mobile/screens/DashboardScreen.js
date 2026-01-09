import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, FlatList, Dimensions, Animated, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import UserAvatar from '../components/UserAvatar';
import UserProfile from '../components/UserProfile';
import ThemeCustomizer from '../components/ThemeCustomizer';
import { Ionicons } from '@expo/vector-icons';
import { getEvents } from '../lib/aws';
import * as DocumentPicker from 'expo-document-picker';
import LinearGradient from 'react-native-linear-gradient';

// Function to get style based on event type
const getEventTypeStyles = (type) => {
  const eventTypeStyles = {
    test: {
      color: '#991b1b',
      backgroundColor: '#fef2f2',
    },
    assignment: {
      color: '#1e40af',
      backgroundColor: '#eff6ff',
    },
    meeting: {
      color: '#166534',
      backgroundColor: '#f0fdf4',
    },
    office_hours: {
      color: '#6b21a8',
      backgroundColor: '#faf5ff',
    },
    // Default fallback
    default: {
      color: '#3498db',
      backgroundColor: '#ebf5fd',
    }
  };

  return eventTypeStyles[type] || eventTypeStyles.default;
};

export default function DashboardScreen({ navigation }) {
  const { user, syncEvents, lastSynced } = useAuth();
  const { theme } = useTheme();
  const [showProfile, setShowProfile] = useState(false);
  const [showThemeCustomizer, setShowThemeCustomizer] = useState(false);
  const [stats, setStats] = useState({
    todayEvents: 0,
    upcomingEvents: 0,
    totalEvents: 0,
  });
  const [recentEvents, setRecentEvents] = useState([]);
  const [allEvents, setAllEvents] = useState([]);
  const [groupedEvents, setGroupedEvents] = useState([]);
  const [snapOffsets, setSnapOffsets] = useState([]);
  const [getItemLayoutFunc, setGetItemLayoutFunc] = useState(() => (data, index) => ({
    length: 0,
    offset: 0,
    index,
  }));
  const [currentViewingIndex, setCurrentViewingIndex] = useState(0);
  const [showJumpToToday, setShowJumpToToday] = useState(false);
  const [todayIndex, setTodayIndex] = useState(0);
  const carouselRef = useRef(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const { width } = Dimensions.get('window');

  // Get current date - setting hours to noon to avoid timezone issues
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  const formattedDate = today.toLocaleDateString(undefined, dateOptions);

  // Function to organize events by date with appropriate labels
  const organizeEventsForCarousel = (events) => {
    if (!events) return [];

    // Format today's date in YYYY-MM-DD format, setting hours to noon to avoid timezone issues
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    // Calculate tomorrow's date
    const tomorrowDate = new Date(today);
    tomorrowDate.setDate(today.getDate() + 1);
    const tomorrowStr = `${tomorrowDate.getFullYear()}-${String(tomorrowDate.getMonth() + 1).padStart(2, '0')}-${String(tomorrowDate.getDate()).padStart(2, '0')}`;

    // Calculate yesterday's date
    const yesterdayDate = new Date(today);
    yesterdayDate.setDate(today.getDate() - 1);
    const yesterdayStr = `${yesterdayDate.getFullYear()}-${String(yesterdayDate.getMonth() + 1).padStart(2, '0')}-${String(yesterdayDate.getDate()).padStart(2, '0')}`;

    // Group events by date
    const eventsByDate = {};

    // Always include today, even if there are no events
    eventsByDate[todayStr] = [];

    // Only add yesterday and tomorrow if they have events (will be added by the loop below)

    events.forEach((event) => {
      if (!event.date) return;

      if (!eventsByDate[event.date]) {
        eventsByDate[event.date] = [];
      }
      eventsByDate[event.date].push(event);
    });

    // Create array of dates with special labels
    const grouped = Object.keys(eventsByDate)
      .sort() // Sort chronologically
      .map((date) => {
        let dateLabel = '';
        let isSunday = false;
        let isMonthStart = false;
        let isYearStart = false;

        const eventDate = new Date(date);

        // Check if it's a Sunday
        isSunday = eventDate.getDay() === 0;

        // Check if it's the start of a month (1st day)
        isMonthStart = eventDate.getDate() === 1;

        // Check if it's the start of a year (Jan 1)
        isYearStart = eventDate.getDate() === 1 && eventDate.getMonth() === 0;

        // Assign special labels
        if (date === todayStr) {
          dateLabel = 'Today';
        } else if (date === yesterdayStr) {
          dateLabel = 'Yesterday';
        } else if (date === tomorrowStr) {
          dateLabel = 'Tomorrow';
        } else {
          dateLabel = new Date(date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
        }

        return {
          date,
          dateLabel,
          events: eventsByDate[date],
          isSunday,
          isMonthStart,
          isYearStart,
        };
      })
      // Only include days with events or today's date
      .filter(item => item.events.length > 0 || item.dateLabel === 'Today');

    return grouped;
  };

  // Function to fetch and calculate stats
  const fetchEventStats = async () => {
    if (!user) return;

    try {
      const events = await getEvents(user.id);

      // Format today's date in YYYY-MM-DD format
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const todayEvents = events.filter((event) => event.date === todayStr).length;

      // Count events that are after today
      const upcomingEvents = events.filter((event) => {
        return event.date && event.date > todayStr;
      }).length;

      // Get events from the last 3 days
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(today.getDate() - 3);
      const threeDaysAgoStr = threeDaysAgo.toISOString().split('T')[0];

      const recent = events
        .filter((event) => event.date && event.date >= threeDaysAgoStr && event.date <= todayStr)
        .sort((a, b) => {
          // Sort by date (newest first)
          if (a.date !== b.date) return b.date.localeCompare(a.date);
          // If same date, sort by time
          return (b.time || '').localeCompare(a.time || '');
        });

      setRecentEvents(recent);
      setAllEvents(events);

      // Organize events for carousel view
      const grouped = organizeEventsForCarousel(events);
      setGroupedEvents(grouped);

      // Find index of today to initially center the carousel
      const todayIdx = grouped.findIndex((group) => group.dateLabel === 'Today');
      if (todayIdx !== -1) {
        setTodayIndex(todayIdx);
        setCurrentViewingIndex(todayIdx);
      }

      setStats({
        todayEvents,
        upcomingEvents,
        totalEvents: events.length,
      });
    } catch (error) {
      console.error('Error fetching event stats:', error);
    }
  };

  // Fetch stats on mount and when lastSynced changes
  useEffect(() => {
    if (user) {
      fetchEventStats();
    }
  }, [user, lastSynced]);
  
  // Add focus listener to reset UI state when screen comes into focus
  useEffect(() => {
    // Reset only profile state on focus, allow theme customizer to persist
    const unsubscribeFocus = navigation.addListener('focus', () => {
      console.log('Dashboard screen focused - resetting UI state');
      // Ensure profile menu is closed
      setShowProfile(false);
      // Do not reset theme customizer state to allow it to stay open when switching tabs
    });
    
    // Cleanup listener on unmount
    return () => {
      unsubscribeFocus();
    };
  }, [navigation]);

  // Compute snap offsets and item layouts when groupedEvents or width changes
  useEffect(() => {
    if (groupedEvents.length > 0) {
      const itemWidth = width * 0.7;
      const padding = (width - itemWidth) / 2;

      const getSpacerWidth = (item) => {
        if (item.isYearStart) return 25;
        if (item.isMonthStart) return 20;
        if (item.isSunday) return 15;
        return 5;
      };

      const itemLengths = groupedEvents.map((item) => itemWidth + getSpacerWidth(item));
      let cumulative = 0;
      const offsets = itemLengths.map((length) => {
        const offset = cumulative;
        cumulative += length;
        return offset;
      });
      const snapOffsets = offsets.map((offset) => padding + offset - 30);

      setSnapOffsets(snapOffsets);
      setGetItemLayoutFunc(() => (data, index) => ({
        length: itemLengths[index],
        offset: offsets[index],
        index,
      }));

      if (carouselRef.current && todayIndex >= 0 && snapOffsets.length > todayIndex) {
        setTimeout(() => {
          carouselRef.current.scrollToOffset({
            offset: snapOffsets[todayIndex],
            animated: false,
          });
        }, 500);
      }
    }
  }, [groupedEvents, width, todayIndex]);

  return (
    <View style={[styles.mainContainer, { backgroundColor: theme.primary }]}>
      <StatusBar barStyle="light-content" backgroundColor={theme.primary} />

      {/* Extended header background that goes behind the status bar */}
      <View style={styles.headerBackgroundExtended}>
        <LinearGradient
          colors={[theme.primary, theme.primaryDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.headerGradient}
        />
      </View>

      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <View>
              <Text style={styles.title}>Dashboard</Text>
              <Text style={styles.dateText}>{formattedDate}</Text>
              {user && <Text style={styles.welcome}>Welcome, {user.name || 'User'}!</Text>}
            </View>
            <View style={styles.headerActions}>
              <TouchableOpacity 
                style={styles.themeButton}
                onPress={() => setShowThemeCustomizer(true)}
                accessibilityLabel="Customize theme"
              >
                <Ionicons name="color-palette" size={22} color="#ffffff" />
              </TouchableOpacity>
              <UserAvatar onPress={() => setShowProfile(true)} />
            </View>
          </View>
        </View>

        {showProfile && (
          <UserProfile
            onClose={() => {
              // Close profile menu
              setShowProfile(false);
            }}
          />
        )}

        {showThemeCustomizer && <ThemeCustomizer onClose={() => setShowThemeCustomizer(false)} />}

        <View style={styles.bodyContainer}>
          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={true}
            automaticallyAdjustContentInsets={true}
            bounces={true}
            overScrollMode="always"
          >
            <View style={styles.carouselCard}>
              <View style={styles.carouselHeader}>
                <Text style={styles.cardTitle}>Quick Look</Text>
                <View style={styles.carouselActions}>
                  <Animated.View style={{ opacity: fadeAnim, position: 'absolute', right: 105 }}>
                    <TouchableOpacity
                      style={[styles.jumpTodayButton, { backgroundColor: theme.primaryLight }]}
                      onPress={() => {
                        if (carouselRef.current && todayIndex >= 0 && snapOffsets.length > todayIndex) {
                          carouselRef.current.scrollToOffset({
                            offset: snapOffsets[todayIndex],
                            animated: true,
                          });
                          setCurrentViewingIndex(todayIndex);
                          setShowJumpToToday(false);
                          Animated.timing(fadeAnim, {
                            toValue: 0,
                            duration: 300,
                            useNativeDriver: true,
                          }).start();
                        }
                      }}
                    >
                      <Ionicons name="today-outline" size={14} color={theme.primary} style={styles.jumpTodayIcon} />
                      <Text style={[styles.jumpTodayText, { color: theme.primary }]}>Today</Text>
                    </TouchableOpacity>
                  </Animated.View>
                  <TouchableOpacity onPress={() => navigation.navigate('AllEvents')} style={styles.viewAllButton}>
                    <Text style={[styles.viewAllText, { color: theme.primary }]}>View all events</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.carouselContainer}>
                {/* Left gradient fade */}
                <LinearGradient
                  colors={['#ffffff', 'rgba(255, 255, 255, 0.2)', 'rgba(255, 255, 255, 0)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.gradientLeft}
                />

                {/* Right gradient fade */}
                <LinearGradient
                  colors={['rgba(255, 255, 255, 0)', 'rgba(255, 255, 255, 0.2)', '#ffffff']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.gradientRight}
                />

                {groupedEvents.length > 0 ? (
                  <FlatList
                    ref={carouselRef}
                    data={groupedEvents}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    decelerationRate={0.9}
                    snapToOffsets={snapOffsets}
                    snapToAlignment="center"
                    disableIntervalMomentum={true}
                    scrollEventThrottle={16}
                    contentContainerStyle={{
                      paddingHorizontal: (width - width * 0.7) / 2,
                    }}
                    keyExtractor={(item) => item.date}
                    onViewableItemsChanged={({ viewableItems }) => {
                      if (viewableItems && viewableItems.length > 0) {
                        const newIndex = viewableItems[0].index;
                        setCurrentViewingIndex(newIndex);
                        const notAtToday = newIndex !== todayIndex;
                        setShowJumpToToday(notAtToday);
                        Animated.timing(fadeAnim, {
                          toValue: notAtToday ? 1 : 0,
                          duration: 300,
                          useNativeDriver: true,
                        }).start();
                      }
                    }}
                    viewabilityConfig={{
                      itemVisiblePercentThreshold: 50,
                      minimumViewTime: 100,
                    }}
                    getItemLayout={getItemLayoutFunc}
                    renderItem={({ item, index }) => {
                      let spacerWidth = 5;
                      if (item.isYearStart) {
                        spacerWidth = 25;
                      } else if (item.isMonthStart) {
                        spacerWidth = 20;
                      } else if (item.isSunday) {
                        spacerWidth = 15;
                      }

                      return (
                        <View style={{ width: width * 0.7, marginRight: spacerWidth }}>
                          <TouchableOpacity
                            style={styles.carouselItem}
                            onPress={() =>
                              navigation.navigate('DayEvents', {
                                date: item.date,
                                events: item.events,
                                dateLabel: item.dateLabel,
                              })
                            }
                          >
                            <Text style={styles.dateLabel}>{item.dateLabel}</Text>
                            <View style={styles.eventsContainer}>
                              <View style={styles.eventsWrapper}>
                                {item.events.length > 0 ? (
                                  <>
                                    {item.events.slice(0, 2).map((event) => (
                                      <View key={event.eventId} style={styles.eventItem}>
                                        <View style={styles.eventHeader}>
                                          <Text style={styles.eventTitle} numberOfLines={1}>
                                            {event.title}
                                          </Text>
                                          {event.type && (
                                            <Text
                                              style={[
                                                styles.eventType,
                                                getEventTypeStyles(event.type),
                                              ]}
                                            >
                                              {event.type}
                                            </Text>
                                          )}
                                        </View>
                                        <View style={styles.eventDetails}>
                                          {event.time && <Text style={styles.eventTime}>{event.time}</Text>}
                                          {event.courseCode && (
                                            <Text style={styles.eventCourse}>{event.courseCode}</Text>
                                          )}
                                        </View>
                                      </View>
                                    ))}
                                    {item.events.length > 2 && (
                                      <View style={styles.moreEventsIndicator}>
                                        <Text style={[styles.moreEventsText, { color: theme.primary }]}>+{item.events.length - 2} more</Text>
                                      </View>
                                    )}
                                  </>
                                ) : (
                                  <View style={styles.noEventsContainer}>
                                    <Ionicons name="calendar-outline" size={24} color="#ccc" />
                                    <Text style={styles.noEventsText}>No events scheduled</Text>
                                    <Text style={styles.noEventsSubText}>Tap to add an event</Text>
                                  </View>
                                )}
                              </View>
                            </View>
                          </TouchableOpacity>
                        </View>
                      );
                    }}
                  />
                ) : (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyStateText}>No events found.</Text>
                  </View>
                )}
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Quick Stats</Text>
              <View style={styles.statsContainer}>
                <View style={styles.stat}>
                  <Text style={[styles.statNumber, { color: theme.primary }]}>{stats.todayEvents}</Text>
                  <Text style={styles.statLabel}>Today's Events</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={[styles.statNumber, { color: theme.primary }]}>{stats.upcomingEvents}</Text>
                  <Text style={styles.statLabel}>Upcoming</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={[styles.statNumber, { color: theme.primary }]}>{stats.totalEvents}</Text>
                  <Text style={styles.statLabel}>Total Events</Text>
                </View>
              </View>
              {lastSynced && (
                <Text style={styles.lastSyncText}>
                  Last synced:{' '}
                  {lastSynced.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}{' '}
                  {lastSynced.toLocaleDateString([], { month: 'short', day: 'numeric' })}
                </Text>
              )}
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Quick Actions</Text>
              <View style={styles.actionList}>
                <TouchableOpacity
                  style={styles.action}
                  onPress={async () => {
                    await syncEvents();
                    await fetchEventStats();
                  }}
                >
                  <Ionicons name="sync-outline" size={20} color={theme.primary} style={styles.actionIcon} />
                  <Text style={[styles.actionText, { color: theme.primary }]}>Sync Calendar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.action}
                  onPress={async () => {
                    try {
                      // First check network connectivity
                      try {
                        const NetInfo = require('@react-native-community/netinfo').default;
                        const networkState = await NetInfo.fetch();
                        
                        if (!networkState.isConnected) {
                          throw new Error('Network error: Please connect to the internet and try again');
                        }
                      } catch (netError) {
                        // Only throw network errors if they're explicit checks
                        if (netError.message && netError.message.includes('Network error:')) {
                          throw netError;
                        }
                        // Otherwise log and continue
                        console.warn('Network check issue:', netError);
                      }
                    
                      const result = await DocumentPicker.getDocumentAsync({
                        type: ['image/*', 'application/pdf'],
                        copyToCacheDirectory: true,
                      }).catch((error) => {
                        console.error('DocumentPicker error:', error);
                        throw error;
                      });

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
                      
                      console.log('File selected successfully from dashboard:', result.assets[0]);
                      
                      // Ensure properly structured navigation to EventListScreen
                      // Using a direct navigation rather than nested navigation
                      const fileToProcess = result.assets[0];
                      navigation.navigate('EventListScreen', { 
                        fileToProcess,
                        isProcessing: true
                      });
                    } catch (error) {
                      console.error('Error processing file:', error);
                      
                      // Show appropriate error message
                      const errorMessage = error.message?.includes('internet') || 
                                          error.message?.includes('Network') || 
                                          error.message?.includes('connect') ?
                        'Please check your internet connection and try again.' : 
                        'Failed to process the file. Please try again or create events manually.';
                      
                      Alert.alert('Error', errorMessage);
                    }
                  }}
                >
                  <Ionicons name="document-outline" size={20} color={theme.primary} style={styles.actionIcon} />
                  <Text style={[styles.actionText, { color: theme.primary }]}>Upload Document</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.action} onPress={() => navigation.navigate('Calendar')}>
                  <Ionicons name="calendar-outline" size={20} color={theme.primary} style={styles.actionIcon} />
                  <Text style={[styles.actionText, { color: theme.primary }]}>View Calendar</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Recent Activity</Text>
              {recentEvents.length > 0 ? (
                <View style={styles.recentActivityList}>
                  {recentEvents.map((event, index) => (
                    <View
                      key={event.eventId}
                      style={[styles.recentEvent, index < recentEvents.length - 1 && styles.recentEventBorder]}
                    >
                      <View style={styles.recentEventHeader}>
                        <Text style={styles.recentEventTitle}>{event.title}</Text>
                        <Text style={[styles.recentEventType, getEventTypeStyles(event.type)]}>{event.type || 'Event'}</Text>
                      </View>
                      <View style={styles.recentEventDetails}>
                        <Text style={styles.recentEventDate}>
                          {new Date(event.date).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                          {event.time && ` • ${event.time}`}
                        </Text>
                        {event.courseCode && (
                          <Text style={styles.recentEventCourse}>{event.courseCode}</Text>
                        )}
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateText}>No recent activity to show.</Text>
                </View>
              )}
            </View>
          </ScrollView>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
  },
  headerBackgroundExtended: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '100%',
    zIndex: 1,
  },
  headerGradient: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    zIndex: 2,
  },
  header: {
    height: 100,
    zIndex: 2,
  },
  headerContent: {
    flex: 1,
    padding: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  themeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 2,
  },
  dateText: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 4,
    letterSpacing: 0.2,
  },
  welcome: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.9)',
    letterSpacing: 0.1,
  },
  bodyContainer: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  content: {
    flex: 1,
    paddingHorizontal: 15,
    paddingTop: 15,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  carouselCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    paddingTop: 15,
    paddingBottom: 20,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    height: 275,
  },
  carouselContainer: {
    position: 'relative',
    flex: 1,
  },
  gradientLeft: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 45,
    zIndex: 1,
  },
  gradientRight: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 45,
    zIndex: 1,
  },
  carouselHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  carouselActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  jumpTodayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 16,
    marginRight: 8,
  },
  jumpTodayIcon: {
    marginRight: 4,
  },
  jumpTodayText: {
    fontSize: 12,
    fontWeight: '600',
  },
  viewAllButton: {
    padding: 5,
    marginLeft: 'auto',
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: '500',
  },
  carouselItem: {
    width: '100%',
    height: 180,
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 14,
    paddingTop: 14,
    paddingBottom: 14,
    marginTop: 5,
    marginBottom: 5,
    borderWidth: 1,
    borderColor: '#eee',
  },
  dateLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 6,
  },
  eventsContainer: {
    flex: 1,
    justifyContent: 'flex-start',
    marginTop: 8,
    paddingBottom: 8,
  },
  eventItem: {
    paddingVertical: 6,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    width: '100%',
    alignSelf: 'center',
    marginBottom: 4,
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  eventTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  eventType: {
    fontSize: 11,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    overflow: 'hidden',
    marginLeft: 5,
  },
  eventDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  eventTime: {
    fontSize: 11,
    color: '#666',
  },
  eventCourse: {
    fontSize: 11,
    fontWeight: '500',
    color: '#666',
  },
  eventsWrapper: {
    position: 'relative',
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 0,
    paddingBottom: 5,
  },
  noEventsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 10,
  },
  noEventsText: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '500',
    color: '#888',
  },
  noEventsSubText: {
    marginTop: 2,
    fontSize: 12,
    color: '#aaa',
    fontStyle: 'italic',
  },
  moreEventsIndicator: {
    alignItems: 'center',
    width: '100%',
    position: 'absolute',
    bottom: -3,
  },
  moreEventsText: {
    fontSize: 13,
    fontWeight: '600',
    backgroundColor: 'rgba(240, 240, 240, 0.8)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 10,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  stat: {
    alignItems: 'center',
    flex: 1,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  lastSyncText: {
    fontSize: 12,
    color: '#888',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  recentActivityList: {
    marginTop: 5,
  },
  recentEvent: {
    paddingVertical: 12,
  },
  recentEventBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  recentEventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  recentEventTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  recentEventType: {
    fontSize: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    overflow: 'hidden',
    marginLeft: 8,
  },
  recentEventDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recentEventDate: {
    fontSize: 12,
    color: '#666',
  },
  recentEventCourse: {
    fontSize: 12,
    fontWeight: '500',
    color: '#666',
  },
  emptyState: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateText: {
    color: '#999',
    fontSize: 14,
  },
  actionList: {
    marginTop: 5,
  },
  action: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionIcon: {
    marginRight: 10,
  },
  actionText: {
    fontSize: 16,
  },
});