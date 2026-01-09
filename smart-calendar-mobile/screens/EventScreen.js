import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar, SafeAreaView, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import LinearGradient from 'react-native-linear-gradient';
import { formatDisplayDate } from '../lib/dateUtils';

const getPriorityColor = (priority) => {
  switch (priority?.toLowerCase()) {
    case 'high':
      return '#dc2626';  // Red
    case 'medium':
      return '#eab308';  // Yellow
    case 'low':
      return '#22c55e';  // Green
    default:
      return '#6b7280';  // Gray
  }
};

// Get light version of priority color for background
const getLightPriorityColor = (priority) => {
  switch (priority?.toLowerCase()) {
    case 'high':
      return '#fef2f2';  // Light red
    case 'medium':
      return '#fefce8';  // Light yellow
    case 'low':
      return '#f0fdf4';  // Light green
    default:
      return '#f9fafb';  // Light gray
  }
};

// Match the color scheme used in CalendarTile.js
const getEventTypeColor = (type) => {
  switch (type?.toLowerCase()) {
    case 'test':
    case 'exam':
    case 'quiz':
      return '#e74c3c';  // Red
    case 'assignment':
    case 'homework':
      return '#3b82f6';  // Blue
    case 'meeting':
      return '#22c55e';  // Green
    case 'lecture':
    case 'class':
      return '#3498db';  // Blue
    case 'lab':
    case 'office_hours':
      return '#a855f7';  // Purple
    default:
      return '#6b7280';  // Gray
  }
};

// Match the color scheme used in CalendarTile.js
const getLightEventTypeColor = (type) => {
  switch (type?.toLowerCase()) {
    case 'test':
    case 'exam':
    case 'quiz':
      return '#fef2f2';  // Light red
    case 'assignment':
    case 'homework':
      return '#eff6ff';  // Light blue
    case 'meeting':
      return '#f0fdf4';  // Light green
    case 'lecture':
    case 'class':
      return '#ebf5fd';  // Light blue
    case 'lab':
    case 'office_hours':
      return '#faf5ff';  // Light purple
    default:
      return '#f9fafb';  // Light gray
  }
};

export default function EventScreen({ route, navigation }) {
  // Accept either an event object directly or an eventId
  const { event, eventId } = route.params || {};
  const [loadedEvent, setLoadedEvent] = React.useState(event);
  const { theme } = useTheme();
  
  // Tab bar hiding is now handled by the wrapper component in AppNavigator.js
  
  console.log('EventScreen received params:', { event, eventId }); // Log params
  
  // If we have an eventId but no event, fetch the event data
  React.useEffect(() => {
    async function fetchEventData() {
      if (eventId && !event) {
        console.log('Fetching event data for ID:', eventId);
        try {
          // For now, simulate finding the event - replace with actual API call
          // This is just a placeholder to prevent errors
          const mockEvent = {
            eventId: eventId,
            title: "Event " + eventId,
            date: new Date().toISOString().split('T')[0],
            type: "assignment",
            priority: "medium",
            description: "This is a placeholder for event " + eventId
          };
          
          setLoadedEvent(mockEvent);
        } catch (error) {
          console.error('Error fetching event data:', error);
        }
      }
    }
    
    fetchEventData();
  }, [eventId, event]);

  // Override header options to remove back button (chevron)
  React.useEffect(() => {
    navigation.setOptions({
      headerShown: false, // Hide the default header
    });
  }, [navigation]);

  const handleEdit = () => {
    if (!navigation) {
      console.error('Navigation object is undefined in handleEdit');
      return;
    }
    navigation.navigate('EventForm', { event: loadedEvent || event });
  };

  const handleBack = () => {
    // Always use goBack() to return to the previous screen
    // This properly handles the back stack and won't add new screens
    navigation.goBack();
  };

  // Use either the directly passed event or the loaded event
  const currentEvent = loadedEvent || event;

  // Check if event is undefined - early return if no event
  if (!currentEvent) {
    console.log('No event data available in EventScreen'); // Log if event is undefined
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <StatusBar barStyle="light-content" backgroundColor={theme.primary} />
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>Loading event details...</Text>
        </View>
      </View>
    );
  }

  // Ensure event and event.priority are defined before calling getPriorityColor
  const priority = currentEvent?.priority;
  const eventType = currentEvent?.type || 'event';
  const typeColor = getEventTypeColor(eventType);
  const lightTypeColor = getLightEventTypeColor(eventType);
  const priorityColor = getPriorityColor(priority);
  const lightPriorityColor = getLightPriorityColor(priority);
  
  // Use our standardized formatDisplayDate function from dateUtils
  const formatDate = (dateStr) => {
    const formattedDate = formatDisplayDate(dateStr);
    console.log(`EventScreen Display Date: ${dateStr} → ${formattedDate}`);
    return formattedDate;
  };

  // Render content only if event is defined
  return currentEvent ? (
    <View style={[styles.container, { backgroundColor: theme.primary }]}>
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
      
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Event Details</Text>
          <TouchableOpacity style={styles.editHeaderButton} onPress={handleEdit}>
            <Ionicons name="pencil" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
        
        <View style={styles.bodyContainer}>
          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={true}
          >
            <View style={[styles.eventCard, { borderLeftColor: typeColor, borderLeftWidth: 4 }]}>
              <View style={styles.cardHeader}>
                <View style={styles.titleContainer}>
                  <Text style={styles.title}>{currentEvent.title}</Text>
                  {priority && (
                    <View style={[styles.priorityBadge, { backgroundColor: lightPriorityColor }]}>
                      <Text style={[styles.priorityText, { color: priorityColor }]}>
                        {priority?.charAt(0).toUpperCase() + priority?.slice(1)} Priority
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              <View style={styles.typeContainer}>
                <View style={[styles.typeBadge, { backgroundColor: lightTypeColor }]}>
                  <Text style={[styles.typeText, { color: typeColor }]}>
                    {eventType?.split('_').map(word =>
                      word.charAt(0).toUpperCase() + word.slice(1)
                    ).join(' ')}
                  </Text>
                </View>
              </View>

              {(currentEvent.courseCode || currentEvent.courseTitle) && (
                <View style={styles.courseContainer}>
                  <Ionicons name="book-outline" size={20} color={theme.primary} style={styles.courseIcon} />
                  <Text style={styles.courseInfo}>
                    {currentEvent.courseCode}{currentEvent.courseCode && currentEvent.courseTitle ? ' - ' : ''}{currentEvent.courseTitle}
                  </Text>
                </View>
              )}

              <View style={styles.detailsContainer}>
                <View style={styles.detailRow}>
                  <Ionicons name="calendar-outline" size={20} color={theme.primary} />
                  <Text style={styles.detail}>{formatDate(currentEvent.date)}</Text>
                </View>

                {currentEvent.time && (
                  <View style={styles.detailRow}>
                    <Ionicons name="time-outline" size={20} color={theme.primary} />
                    <Text style={styles.detail}>{currentEvent.time}</Text>
                  </View>
                )}

                {currentEvent.location && (
                  <View style={styles.detailRow}>
                    <Ionicons name="location-outline" size={20} color={theme.primary} />
                    <Text style={styles.detail}>{currentEvent.location}</Text>
                  </View>
                )}
              </View>

              {currentEvent.description && (
                <View style={styles.descriptionContainer}>
                  <View style={styles.descriptionHeader}>
                    <Ionicons name="document-text-outline" size={20} color={theme.primary} />
                    <Text style={[styles.descriptionLabel, { color: theme.text }]}>Description</Text>
                  </View>
                  <Text style={styles.description}>{currentEvent.description}</Text>
                </View>
              )}
              
              <TouchableOpacity 
                style={[styles.editButton, { backgroundColor: theme.primary }]}
                onPress={handleEdit}
              >
                <Ionicons name="pencil-outline" size={18} color="#fff" style={styles.editButtonIcon} />
                <Text style={styles.editButtonText}>Edit Event</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </SafeAreaView>
    </View>
    ) : (
      <View style={[styles.container, { backgroundColor: theme.primary }]}>
        <StatusBar barStyle="light-content" backgroundColor={theme.primary} />
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>Error: Event details not found.</Text>
        </View>
      </View>
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
  editHeaderButton: {
    padding: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  bodyContainer: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  content: {
    flex: 1,
    paddingHorizontal: 15,
    paddingTop: 15,
  },
  scrollContent: {
    paddingBottom: 30,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#ffffff',
    textAlign: 'center',
    marginTop: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    padding: 15,
    borderRadius: 10,
  },
  eventCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginBottom: 15,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  priorityBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 8,
  },
  priorityText: {
    fontSize: 13,
    fontWeight: '600',
  },
  typeContainer: {
    marginBottom: 16,
  },
  typeBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  typeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  courseContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.03)',
    borderRadius: 8,
  },
  courseIcon: {
    marginRight: 8,
  },
  courseInfo: {
    fontSize: 16,
    color: '#444',
    fontWeight: '500',
  },
  detailsContainer: {
    marginBottom: 20,
    backgroundColor: 'rgba(0,0,0,0.02)',
    padding: 12,
    borderRadius: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  detail: {
    fontSize: 15,
    color: '#444',
    marginLeft: 12,
    flex: 1,
  },
  descriptionContainer: {
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 16,
    marginBottom: 20,
  },
  descriptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  descriptionLabel: {
    fontSize: 17,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  description: {
    fontSize: 15,
    color: '#444',
    lineHeight: 22,
    paddingLeft: 28,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 25,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  editButtonIcon: {
    marginRight: 8,
  },
  editButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
