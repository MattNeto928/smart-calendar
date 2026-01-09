import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  StatusBar,
  SafeAreaView,
  Animated,
  ActivityIndicator
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { getEvents } from '../lib/aws';
import LinearGradient from 'react-native-linear-gradient';

export default function AllEventsScreen({ navigation }) {
  const { user, lastSynced } = useAuth();
  const { theme } = useTheme();
  const [events, setEvents] = useState([]);
  const [groupedEvents, setGroupedEvents] = useState([]);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const loadingAnim = useRef(new Animated.Value(1)).current;
  const flatListRef = useRef(null);
  const [todayHeaderIndex, setTodayHeaderIndex] = useState(-1);
  const [initialScrollDone, setInitialScrollDone] = useState(false);
  const [allGroupedEvents, setAllGroupedEvents] = useState([]);
  const [visibleRangeStart, setVisibleRangeStart] = useState(0);
  const [visibleRangeEnd, setVisibleRangeEnd] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const ITEMS_PER_BATCH = 20; // Increased batch size for better scrolling
  const lastScrollDirection = useRef('none'); // Track scroll direction

  // Fade-in animation on mount
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, []);
  
  // Animation for loading indicators
  useEffect(() => {
    if (isLoading) {
      // Create a pulsing effect for the loading indicator
      Animated.loop(
        Animated.sequence([
          Animated.timing(loadingAnim, { 
            toValue: 0.7, 
            duration: 800, 
            useNativeDriver: true 
          }),
          Animated.timing(loadingAnim, { 
            toValue: 1, 
            duration: 800, 
            useNativeDriver: true 
          })
        ])
      ).start();
    } else {
      // Stop animation when loading stops
      loadingAnim.setValue(1);
      Animated.timing(loadingAnim).stop();
    }
  }, [isLoading]);

  // Fetch and organize events when user or lastSynced changes
  useEffect(() => {
    const fetchEvents = async () => {
      if (!user) return;
      setIsLoading(true);
      setError(null);

      try {
        // Create a unique event ID for tracking if none exists
        const ensureEventIds = (events) => {
          return events.map(event => {
            if (!event.eventId) {
              // Generate a stable ID based on event properties
              const timestamp = new Date().getTime();
              const randomPart = Math.random().toString(36).substring(2, 8);
              event.eventId = `event_${timestamp}_${randomPart}`;
            }
            return event;
          });
        };

        const allEvents = await getEvents(user.id);
        const eventsWithIds = ensureEventIds(allEvents);
        setEvents(eventsWithIds);
        
        // Organize and deduplicate events
        const organized = organizeEventsByDate(eventsWithIds);
        setAllGroupedEvents(organized);

        console.log(`Total organized events: ${organized.length}`);

        const today = new Date().toISOString().split('T')[0];
        const todayIdx = organized.findIndex(item => item.type === 'header' && item.date === today);

        if (todayIdx !== -1) {
          let startIdx = todayIdx;
          let eventCount = 0;

          // Adjust to include the header of the earliest date group
          while (startIdx > 0 && organized[startIdx].type !== 'header') {
            startIdx--;
          }

          // Find the end of "Today" section
          let endTodayIdx = todayIdx + 1;
          while (endTodayIdx < organized.length && organized[endTodayIdx].type !== 'header') {
            endTodayIdx++;
          }
          
          // Include up to ITEMS_PER_BATCH events after "Today" section
          let endIdx = endTodayIdx;
          eventCount = 0;
          while (eventCount < ITEMS_PER_BATCH && endIdx < organized.length) {
            if (organized[endIdx].type === 'event') {
              eventCount++;
            }
            endIdx++;
          }
          
          // Include up to the next spacer or end
          while (endIdx < organized.length && organized[endIdx].type !== 'spacer') {
            endIdx++;
          }

          // Set the visible range
          setVisibleRangeStart(startIdx);
          setVisibleRangeEnd(endIdx - 1);
          
          // Verify no duplicates in initial display
          const initialEvents = organized.slice(startIdx, endIdx);
          const seenIds = new Set();
          const uniqueInitialEvents = initialEvents.filter(item => {
            if (item.type !== 'event') return true;
            if (seenIds.has(item.id)) return false;
            seenIds.add(item.id);
            return true;
          });
          
          setGroupedEvents(uniqueInitialEvents);

          // Calculate local today index in groupedEvents
          const localTodayIdx = todayIdx - startIdx;
          setTodayHeaderIndex(localTodayIdx);
        } else {
          // If no "Today", load the first ITEMS_PER_BATCH*2 items
          const endIndex = Math.min(ITEMS_PER_BATCH*2, organized.length);
          setVisibleRangeStart(0);
          setVisibleRangeEnd(endIndex - 1);
          setGroupedEvents(organized.slice(0, endIndex));
        }
      } catch (error) {
        console.error('Error fetching events:', error);
        setError('Failed to load events. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchEvents();
  }, [user, lastSynced]);

  // Load more events when scrolling up
  // This function ONLY loads events from the past (earlier dates)
  const loadMoreBefore = () => {
    // Guard clauses to prevent incorrect loading
    if (visibleRangeStart <= 0 || isLoading) return;
    
    // Set direction flag for debugging
    console.log("Loading PAST events (earlier dates)");
    console.log(`Current range: ${visibleRangeStart} to ${visibleRangeEnd} of ${allGroupedEvents.length}`);
    
    setIsLoading(true);

    // Create smooth loading experience with animation
    let newStart = Math.max(0, visibleRangeStart - 5); // Start farther back to get more content at once
    
    // Track the IDs we already have to prevent duplicates
    const existingIds = new Set();
    for (let i = visibleRangeStart; i <= visibleRangeEnd; i++) {
      existingIds.add(allGroupedEvents[i].id);
    }
    
    let eventCount = 0;
    
    // Keep going back until we find enough NEW events or hit the beginning
    while (eventCount < ITEMS_PER_BATCH && newStart > 0) {
      newStart--;
      // Only count events we haven't seen yet
      if (allGroupedEvents[newStart].type === 'event' && 
          !existingIds.has(allGroupedEvents[newStart].id)) {
        eventCount++;
        existingIds.add(allGroupedEvents[newStart].id);
      }
    }
    
    // Make sure we're starting at a header for clean presentation
    let safetyCounter = 0; // Prevent infinite loops
    while (newStart > 0 && allGroupedEvents[newStart].type !== 'header' && safetyCounter < 10) {
      newStart--;
      safetyCounter++;
    }

    // Simulate network call with delay that's not too short or too long
    setTimeout(() => {
      // Get current scroll position before adding new items
      const previousOffset = flatListRef.current?.scrollOffset || 0;
      // Use a more accurate estimate based on current visible items
      const itemEstimateHeight = Math.max(40, groupedEvents.length > 0 ? 
        (flatListRef.current?._listRef?._scrollMetrics?.contentLength || 0) / groupedEvents.length : 50);
      const addedItemsHeight = (visibleRangeStart - newStart) * itemEstimateHeight;
      
      // Get the new data slice
      const newDataSlice = allGroupedEvents.slice(newStart, visibleRangeEnd + 1);
      
      // Check for duplicates
      const seenIds = new Set();
      const uniqueEvents = newDataSlice.filter(item => {
        // Always keep headers and spacers
        if (item.type !== 'event') return true;
        
        // Skip duplicate events
        if (seenIds.has(item.id)) {
          console.log(`Skipping duplicate: ${item.id}`);
          return false;
        }
        
        // Keep this event and remember its ID
        seenIds.add(item.id);
        return true;
      });
      
      console.log(`Loaded ${newDataSlice.length} items, ${uniqueEvents.length} after deduplication`);
      
      // Update state with deduplicated data
      setVisibleRangeStart(newStart);
      setGroupedEvents(uniqueEvents);
      
      // Ensure smooth scroll adjustment
      setTimeout(() => {
        flatListRef.current?.scrollToOffset({
          offset: previousOffset + addedItemsHeight,
          animated: false,
        });
        
        // Fade out loading indicator after content is positioned
        setTimeout(() => {
          setIsLoading(false);
        }, 300);
      }, 50);
    }, 1200); // Slightly longer delay for better UX with animation
  };

  // Load more events when scrolling down
  // This function ONLY loads events from the future (later dates)
  const loadMoreAfter = () => {
    // Guard clauses to prevent incorrect loading
    if (visibleRangeEnd >= allGroupedEvents.length - 1 || isLoading) return;
    
    // Set direction flag for debugging
    console.log("Loading FUTURE events (later dates)");
    console.log(`Current range: ${visibleRangeStart} to ${visibleRangeEnd} of ${allGroupedEvents.length}`);
    
    setIsLoading(true);

    // Create smooth loading experience with animation - start farther ahead
    // Make sure not to exceed the array bounds
    let newEnd = Math.min(visibleRangeEnd + 5, allGroupedEvents.length - 1);
    
    // Track the IDs we already have to prevent duplicates
    const existingIds = new Set();
    for (let i = visibleRangeStart; i <= visibleRangeEnd; i++) {
      existingIds.add(allGroupedEvents[i].id);
    }
    
    let eventCount = 0;
    
    // Keep going forward until we find enough NEW events or hit the end
    while (eventCount < ITEMS_PER_BATCH && newEnd < allGroupedEvents.length - 1) {
      newEnd++;
      // Only count events we haven't seen yet
      if (allGroupedEvents[newEnd].type === 'event' && 
          !existingIds.has(allGroupedEvents[newEnd].id)) {
        eventCount++;
        existingIds.add(allGroupedEvents[newEnd].id);
      }
    }
    
    // Try to end at a logical break point (header or spacer)
    let nextHeaderFound = false;
    let safetyCounter = 0; // Prevent infinite loops
    
    while (newEnd < allGroupedEvents.length - 1 && !nextHeaderFound && safetyCounter < 10) {
      safetyCounter++;
      if (allGroupedEvents[newEnd + 1].type === 'header') {
        // Include the header
        newEnd++;
        nextHeaderFound = true;
      } else if (allGroupedEvents[newEnd + 1].type === 'spacer') {
        // Include the spacer
        newEnd++;
      } else {
        newEnd++;
      }
    }

    // Simulate network call with delay for smooth animation
    setTimeout(() => {
      // Get the new data slice
      const newDataSlice = allGroupedEvents.slice(visibleRangeStart, newEnd + 1);
      
      // Check for duplicates
      const seenIds = new Set();
      const uniqueEvents = newDataSlice.filter(item => {
        // Always keep headers and spacers
        if (item.type !== 'event') return true;
        
        // Skip duplicate events
        if (seenIds.has(item.id)) {
          console.log(`Skipping duplicate: ${item.id}`);
          return false;
        }
        
        // Keep this event and remember its ID
        seenIds.add(item.id);
        return true;
      });
      
      console.log(`Loaded ${newDataSlice.length} items, ${uniqueEvents.length} after deduplication`);
      
      // Update state with deduplicated data
      setVisibleRangeEnd(newEnd);
      setGroupedEvents(uniqueEvents);
      
      // Fade out loading indicator after content is updated
      setTimeout(() => {
        setIsLoading(false);
      }, 300);
    }, 1200); // Slightly longer delay for better UX with animation
  };

  // Organize events by date in strict chronological order with unique IDs
  const organizeEventsByDate = (events) => {
    if (!events) return [];

    // Create a deep copy to avoid modifying original data
    const sortedEvents = [...events].sort((a, b) => {
      // Ensure strict chronological sorting by date
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      // Then sort by time if both have times
      if (a.time && b.time) return a.time.localeCompare(b.time);
      // If only one has time, prioritize events with time first
      if (a.time && !b.time) return -1;
      if (!a.time && b.time) return 1;
      // If neither has time, sort by title
      return (a.title || '').localeCompare(b.title || '');
    });

    // Map to track events by ID to prevent duplicates
    const processedEventIds = new Set();
    
    // Use an ordered Map to maintain date order
    const dateOrder = [];
    const eventsByDate = {};
    
    // Process events in sorted order
    sortedEvents.forEach(event => {
      if (!event.date) return;
      
      // Skip if no eventId or we've already seen this event
      if (!event.eventId || processedEventIds.has(event.eventId)) return;
      
      // Mark this event as processed
      processedEventIds.add(event.eventId);
      
      // Track date order if this is a new date
      if (!eventsByDate[event.date]) {
        eventsByDate[event.date] = [];
        dateOrder.push(event.date);
      }
      
      // Add to events by date
      eventsByDate[event.date].push(event);
    });

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    // Ensure "Today" is included even if no events
    if (!eventsByDate[todayStr]) {
      eventsByDate[todayStr] = [];
    }

    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const result = [];

    // Use the tracked date order to ensure chronological sequencing
    // This ensures consistent ordering in the final result
    dateOrder.forEach((date, index) => {
      const dateLabel = date === todayStr ? 'Today' :
                       date === yesterdayStr ? 'Yesterday' :
                       date === tomorrowStr ? 'Tomorrow' :
                       new Date(date).toLocaleDateString(undefined, { 
                         weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
                       });

      result.push({
        id: `header-${date}`,
        type: 'header',
        date,
        dateLabel
      });

      if (eventsByDate[date].length > 0) {
        // Sort events within the day by time
        const sortedDayEvents = [...eventsByDate[date]].sort((a, b) => {
          if (a.time && b.time) return a.time.localeCompare(b.time);
          if (a.time) return -1;
          if (b.time) return 1;
          return 0;
        });
        
        sortedDayEvents.forEach(event => {
          result.push({
            ...event,
            id: event.eventId || `${date}-${Math.random().toString(36).substring(2, 9)}`,
            type: 'event'
          });
        });
      } else if (date === todayStr) {
        result.push({
          id: `no-events-${date}`,
          type: 'no-events',
          message: 'There are no events today'
        });
      }

      if (index < dateOrder.length - 1) {
        result.push({
          id: `spacer-${date}`,
          type: 'spacer'
        });
      }
    });

    return result;
  };

  // Get event type color
  const getEventTypeColor = (type) => {
    switch(type?.toLowerCase()) {
      case 'exam':
      case 'test':
      case 'quiz':
        return '#e74c3c'; // Red
      case 'assignment':
      case 'homework':
        return '#3b82f6'; // Blue
      case 'lecture':
      case 'class':
        return '#3498db'; // Blue
      case 'lab':
        return '#a855f7'; // Purple
      case 'meeting':
        return '#22c55e'; // Green
      case 'office_hours':
        return '#a855f7'; // Purple
      case 'deadline':
        return '#e74c3c'; // Red
      default:
        return theme.primary; // Default to theme primary
    }
  };
  
  // Get a light version of the color for backgrounds
  const getLightColor = (color) => {
    switch(color) {
      case '#e74c3c': return '#fef2f2'; // Light red
      case '#3b82f6': return '#eff6ff'; // Light blue
      case '#3498db': return '#ebf5fd'; // Light blue
      case '#a855f7': return '#faf5ff'; // Light purple
      case '#22c55e': return '#f0fdf4'; // Light green
      default: return theme.primaryLight; // Default to theme light
    }
  };

  // Render individual items in the FlatList
  const renderItem = ({ item }) => {
    if (item.type === 'header') {
      const isToday = item.dateLabel === 'Today';
      return (
        <View style={[styles.dateHeader, isToday && { marginTop: 3 }]}>
          <LinearGradient
            colors={[isToday ? theme.primary : theme.primaryLight, isToday ? `${theme.primaryLight}99` : 'rgba(255, 255, 255, 0)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.headerGradient}
          >
            <View style={styles.dateHeaderContent}>
              <Text style={[styles.dateHeaderText, { color: isToday ? '#fff' : theme.primary }]}>
                {item.dateLabel}
              </Text>
            </View>
            <View style={[styles.headerLine, { backgroundColor: isToday ? '#fff' : theme.primary }]} />
          </LinearGradient>
        </View>
      );
    } else if (item.type === 'spacer') {
      return <View style={styles.spacer} />;
    } else if (item.type === 'no-events') {
      return (
        <View style={styles.noEventsContainer}>
          <Text style={styles.noEventsText}>{item.message}</Text>
        </View>
      );
    } else {
      const isHighPriority = item.priority === 'High';
      const typeColor = getEventTypeColor(item.type);
      const lightTypeColor = getLightColor(typeColor);
      const cardStyle = isHighPriority ? { borderLeftWidth: 4, borderLeftColor: typeColor } : {};

      return (
        <TouchableOpacity
          style={[styles.eventItem, cardStyle]}
          onPress={() => {
            // Get the complete event object
            const eventObject = {
              eventId: item.eventId,
              title: item.title,
              date: item.date,
              time: item.time,
              location: item.location,
              description: item.description,
              type: item.type,
              priority: item.priority,
              courseCode: item.courseCode
            };
            
            // Navigate directly to an instance of EventScreen that's not inside the Calendar tab
            navigation.navigate('EventScreen', { 
              eventId: item.eventId, 
              event: eventObject,
              fromAllEvents: true
            });
          }}
        >
          <View style={styles.eventContent}>
            <View style={styles.eventHeader}>
              <Text style={styles.eventTitle} numberOfLines={1}>{item.title}</Text>
              {item.type && (
                <View style={[styles.eventTypeBadge, { backgroundColor: lightTypeColor }]}>
                  <Text style={[styles.eventType, { color: typeColor }]}>{item.type}</Text>
                </View>
              )}
            </View>
            <View style={styles.eventDetails}>
              <View style={styles.eventDetailRow}>
                {item.time && (
                  <View style={styles.detailItem}>
                    <Ionicons name="time-outline" size={16} color={theme.primary} style={styles.detailIcon} />
                    <Text style={styles.detailText}>{item.time}</Text>
                  </View>
                )}
                {item.location && (
                  <View style={styles.detailItem}>
                    <Ionicons name="location-outline" size={16} color={theme.primary} style={styles.detailIcon} />
                    <Text style={styles.detailText} numberOfLines={1}>{item.location}</Text>
                  </View>
                )}
              </View>
              <View style={styles.eventDetailRow}>
                {item.courseCode && (
                  <View style={styles.detailItem}>
                    <Ionicons name="book-outline" size={16} color={theme.primary} style={styles.detailIcon} />
                    <Text style={styles.detailText}>{item.courseCode}</Text>
                  </View>
                )}
                {item.priority && (
                  <View style={styles.detailItem}>
                    <Ionicons 
                      name="flag-outline" 
                      size={16} 
                      color={isHighPriority ? '#e74c3c' : theme.primary} 
                      style={styles.detailIcon} 
                    />
                    <Text style={[styles.detailText, isHighPriority && { color: '#e74c3c', fontWeight: '600' }]}>
                      Priority: {item.priority}
                    </Text>
                  </View>
                )}
              </View>
              {item.description && (
                <Text style={styles.eventDescription} numberOfLines={2}>{item.description}</Text>
              )}
            </View>
          </View>
        </TouchableOpacity>
      );
    }
  };

  // Retry fetching events on error
  const retryFetch = () => {
    setError(null);
    setIsLoading(true);
    setEvents([]);
    setGroupedEvents([]);
    setAllGroupedEvents([]);
    setVisibleRangeStart(0);
    setVisibleRangeEnd(0);
    setInitialScrollDone(false);
  };

  return (
    <Animated.View style={[styles.container, { backgroundColor: theme.primary, opacity: fadeAnim }]}>
      <StatusBar barStyle="light-content" backgroundColor={theme.primary} />
      <View style={styles.headerBackgroundExtended}>
        <LinearGradient
          colors={[theme.primary, theme.primaryDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.headerGradient}
        />
      </View>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>All Events</Text>
          <View style={styles.rightPlaceholder} />
        </View>
        <View style={styles.content}>
          {error ? (
            <View style={styles.errorState}>
              <Ionicons name="warning-outline" size={60} color="#e74c3c" />
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity style={styles.retryButton} onPress={retryFetch}>
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : groupedEvents.length > 0 ? (
            <>
              <FlatList
                ref={flatListRef}
                data={groupedEvents}
                renderItem={renderItem}
                keyExtractor={item => item.id}
                showsVerticalScrollIndicator={true}
                contentContainerStyle={styles.listContainer}
                removeClippedSubviews={true}
                maxToRenderPerBatch={10}
                windowSize={5}
                initialNumToRender={12}
                onEndReachedThreshold={0.3}
                onEndReached={() => {
                  // We're now handling this in onScroll for better control
                }}
                onMomentumScrollEnd={(event) => {
                  // We'll handle scroll detection in onScroll instead to better detect direction
                }}
                onScroll={(event) => {
                  // Track scroll direction and handle both up/down scroll loading
                  const offsetY = event.nativeEvent.contentOffset.y;
                  const velocity = event.nativeEvent.velocity?.y || 0;
                  
                  // Update scroll direction tracking with more aggressive thresholds
                  if (velocity < -0.5) {
                    lastScrollDirection.current = 'up';
                    console.log("Scrolling UP detected");
                  } else if (velocity > 0.5) {
                    lastScrollDirection.current = 'down';
                    console.log("Scrolling DOWN detected");
                  }
                  
                  // When at or very near the top, load previous events 
                  if (offsetY < 5 && visibleRangeStart > 0 && !isLoading) {
                    console.log("At TOP, loading previous events");
                    loadMoreBefore();
                  }
                  
                  // When approaching the top with upward momentum, also load previous events
                  if (offsetY < 50 && velocity < -2 && visibleRangeStart > 0 && !isLoading) {
                    console.log("Approaching TOP with UPWARD momentum, loading previous events");
                    loadMoreBefore();
                  }
                  
                  // When near the bottom, load more events
                  const contentHeight = event.nativeEvent.contentSize.height;
                  const layoutHeight = event.nativeEvent.layoutMeasurement.height;
                  const distanceFromBottom = contentHeight - layoutHeight - offsetY;
                  
                  if (distanceFromBottom < 200 && visibleRangeEnd < allGroupedEvents.length - 1 && !isLoading) {
                    console.log("Near BOTTOM, loading more events");
                    loadMoreAfter();
                  }
                }}
                onLayout={() => {
                  if (!initialScrollDone && groupedEvents.length > 0 && todayHeaderIndex >= 0) {
                    flatListRef.current.scrollToIndex({
                      index: todayHeaderIndex,
                      animated: false,
                      viewPosition: 0,
                    });
                    setInitialScrollDone(true);
                  }
                }}
                ListHeaderComponent={
                  visibleRangeStart > 0 ? (
                    <View style={[styles.loadingIndicator, isLoading && styles.activeLoadingIndicator]}>
                      {isLoading ? (
                        <Animated.View style={{ 
                          flexDirection: 'row',
                          alignItems: 'center',
                          opacity: loadingAnim
                        }}>
                          <ActivityIndicator size="small" color={theme.primary} />
                          <Text style={[styles.loadingText, { color: theme.primary }]}>
                            Fetching past events...
                          </Text>
                        </Animated.View>
                      ) : (
                        <TouchableOpacity
                          onPress={loadMoreBefore}
                          activeOpacity={0.7}
                          style={{ padding: 10, width: '100%', alignItems: 'center', flexDirection: 'row', justifyContent: 'center' }}
                        >
                          <Ionicons name="arrow-up" size={16} color="#555" style={{ marginRight: 6, opacity: 0.7 }} />
                          <Text style={[styles.loadingText, { opacity: 0.7 }]} numberOfLines={1}>
                            Tap to load earlier events
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  ) : null
                }
                ListFooterComponent={
                  visibleRangeEnd < allGroupedEvents.length - 1 ? (
                    <View style={[styles.loadingIndicator, isLoading && styles.activeLoadingIndicator]}>
                      {isLoading ? (
                        <Animated.View style={{ 
                          flexDirection: 'row',
                          alignItems: 'center',
                          opacity: loadingAnim
                        }}>
                          <ActivityIndicator size="small" color={theme.primary} />
                          <Text style={[styles.loadingText, { color: theme.primary }]}>
                            Fetching more events...
                          </Text>
                        </Animated.View>
                      ) : (
                        <TouchableOpacity
                          onPress={loadMoreAfter}
                          activeOpacity={0.7}
                          style={{ padding: 10, width: '100%', alignItems: 'center', flexDirection: 'row', justifyContent: 'center' }}
                        >
                          <Ionicons name="arrow-down" size={16} color="#555" style={{ marginRight: 6, opacity: 0.7 }} />
                          <Text style={[styles.loadingText, { opacity: 0.7 }]} numberOfLines={1}>
                            Tap to load more events
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  ) : null
                }
                onScrollToIndexFailed={(info) => {
                  setTimeout(() => {
                    flatListRef.current?.scrollToOffset({
                      offset: info.averageItemLength * info.index,
                      animated: true,
                    });
                  }, 100);
                }}
              />
              {todayHeaderIndex >= 0 && (
                <TouchableOpacity
                  style={[styles.floatingButton, { backgroundColor: theme.primary }]}
                  onPress={() => {
                    // Find today's date string
                    const today = new Date().toISOString().split('T')[0];
                    
                    // Look for today's header in the currently loaded events
                    const todayIndex = groupedEvents.findIndex(
                      item => item.type === 'header' && item.date === today
                    );
                    
                    if (todayIndex >= 0) {
                      // Today is in the current view, scroll to it
                      console.log(`Found Today at index ${todayIndex}, scrolling...`);
                      flatListRef.current.scrollToIndex({
                        index: todayIndex,
                        animated: true,
                        viewPosition: 0.3, // Position slightly below the top
                      });
                    } else {
                      // Today not found in current view, try to find it in all events
                      const todayInAllEventsIndex = allGroupedEvents.findIndex(
                        item => item.type === 'header' && item.date === today
                      );
                      
                      if (todayInAllEventsIndex >= 0) {
                        // Adjust visible range to include Today
                        const newStart = Math.max(0, todayInAllEventsIndex - 5);
                        const newEnd = Math.min(allGroupedEvents.length - 1, todayInAllEventsIndex + 15);
                        
                        console.log(`Today found in allEvents at ${todayInAllEventsIndex}, adjusting range...`);
                        
                        // Load the range that includes Today
                        setVisibleRangeStart(newStart);
                        setVisibleRangeEnd(newEnd);
                        setGroupedEvents(allGroupedEvents.slice(newStart, newEnd + 1));
                        
                        // After the state updates and re-render, scroll to Today
                        setTimeout(() => {
                          // Find the new position of Today in the adjusted view
                          const newTodayIndex = groupedEvents.findIndex(
                            item => item.type === 'header' && item.date === today
                          );
                          
                          if (newTodayIndex >= 0) {
                            flatListRef.current.scrollToIndex({
                              index: newTodayIndex,
                              animated: true,
                              viewPosition: 0.3,
                            });
                          }
                        }, 100);
                      }
                    }
                  }}
                >
                  <Ionicons name="calendar" size={24} color="#fff" />
                </TouchableOpacity>
              )}
            </>
          ) : isLoading ? (
            <View style={styles.loadingState}>
              <ActivityIndicator size="large" color={theme.primary} />
              <Text style={styles.loadingText}>Loading events...</Text>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="calendar-outline" size={60} color="#ccc" />
              <Text style={styles.emptyStateText}>No events found</Text>
              <Text style={styles.emptyStateSubtext}>Add events to see them displayed here</Text>
              <TouchableOpacity 
                style={[styles.addButton, { backgroundColor: theme.primary }]}
                onPress={() => navigation.navigate('AddEventOptions')}
              >
                <Text style={styles.addButtonText}>Add Event</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </SafeAreaView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerBackgroundExtended: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 140,
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
    height: 70,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  backButton: {
    padding: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: 0.3,
  },
  rightPlaceholder: {
    width: 40,
  },
  content: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  listContainer: {
    paddingBottom: 20,
  },
  dateHeader: {
    paddingHorizontal: 15,
    paddingTop: 15,
    paddingBottom: 8,
    height: 80,
  },
  headerGradient: {
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 10,
    justifyContent: 'space-between',
  },
  dateHeaderContent: {
    height: 28,
    justifyContent: 'center', // Vertically centers the text
    marginBottom: 5,
  },
  dateHeaderText: {
    fontSize: 18,
    fontWeight: 'bold',
    bottom: 7,
  },
  headerLine: {
    height: 3,
    width: 40,
    borderRadius: 1.5,
  },
  spacer: {
    height: 10,
  },
  noEventsContainer: {
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8f9fa',
  },
  noEventsText: {
    fontSize: 16,
    color: '#666',
    fontStyle: 'italic',
  },
  eventItem: {
    backgroundColor: '#fff',
    marginHorizontal: 15,
    marginVertical: 8,
    borderRadius: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
  eventContent: {
    padding: 16,
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  eventTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#2c3e50',
    flex: 1,
  },
  eventTypeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 10,
  },
  eventType: {
    fontSize: 12,
    fontWeight: '600',
  },
  eventDetails: {
    marginTop: 8,
  },
  eventDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    marginBottom: 6,
  },
  detailIcon: {
    marginRight: 6,
  },
  detailText: {
    fontSize: 14,
    color: '#34495e',
    letterSpacing: 0.2,
  },
  eventDescription: {
    fontSize: 14,
    color: '#5d6d7e',
    marginTop: 8,
    lineHeight: 21,
    letterSpacing: 0.2,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#555',
    marginTop: 15,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#888',
    marginTop: 5,
    textAlign: 'center',
    marginBottom: 20,
  },
  addButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 30,
    marginTop: 10,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  floatingButton: {
    position: 'absolute',
    bottom: 25,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.9)',
  },
  loadingIndicator: {
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    backgroundColor: 'rgba(250, 250, 252, 0.98)',
    borderRadius: 12,
    marginHorizontal: 15,
    marginVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    minHeight: 50, // Use minHeight instead of fixed height to accommodate text
  },
  activeLoadingIndicator: {
    backgroundColor: 'rgba(248, 248, 255, 0.98)',
    borderWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
    minHeight: 70, // Use minHeight instead of fixed height
    paddingVertical: 16, // Add more vertical padding when active
  },
  loadingText: {
    fontSize: 14,
    color: '#555',
    fontWeight: '500',
    marginLeft: 6,
    letterSpacing: 0.2,
    fontFamily: 'System',
    flexShrink: 1, // Allow text to shrink if needed
  },
  loadingState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#e74c3c',
    marginTop: 15,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#e74c3c',
    borderRadius: 25,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});