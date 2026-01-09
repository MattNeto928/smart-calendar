import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Alert, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import LinearGradient from 'react-native-linear-gradient';

export default function DayEventsScreen({ route, navigation }) {
  const { date, dateLabel, events: initialEvents } = route.params;
  const [events, setEvents] = useState(initialEvents || []);
  const { user } = useAuth();
  const { theme } = useTheme();
  
  // Sort events by time
  useEffect(() => {
    if (events && events.length > 0) {
      const sortedEvents = [...events].sort((a, b) => {
        // If both have times, sort by time
        if (a.time && b.time) {
          return a.time.localeCompare(b.time);
        }
        // If only one has time, the one with time comes first
        if (a.time) return -1;
        if (b.time) return 1;
        // Otherwise sort by title
        return a.title.localeCompare(b.title);
      });
      setEvents(sortedEvents);
    }
  }, [initialEvents]);

  const handleEditEvent = (event) => {
    navigation.navigate('EventForm', {
      event,
      editing: true,
      fromDayEvents: true,
      onUpdate: (updatedEvent) => {
        // Update the event in the local state when it's edited
        const updatedEvents = events.map(e => 
          e.eventId === updatedEvent.eventId ? updatedEvent : e
        );
        setEvents(updatedEvents);
      }
    });
  };

  const handleDeleteEvent = (eventId) => {
    Alert.alert(
      "Delete Event",
      "Are you sure you want to delete this event?",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        { 
          text: "Delete", 
          style: "destructive",
          onPress: () => {
            // Remove the event from local state
            const updatedEvents = events.filter(e => e.eventId !== eventId);
            setEvents(updatedEvents);
            
            // Navigate back if no events left
            if (updatedEvents.length === 0) {
              navigation.goBack();
            }
          }
        }
      ]
    );
  };

  const renderEventItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.eventItem}
      onPress={() => handleEditEvent(item)}
    >
      <View style={styles.eventContent}>
        <View style={styles.eventHeader}>
          <Text style={styles.eventTitle}>{item.title}</Text>
          {item.type && (
            <Text style={styles.eventType}>{item.type}</Text>
          )}
        </View>
        
        <View style={styles.eventDetails}>
          <View style={styles.eventInfo}>
            {item.time && (
              <View style={styles.infoItem}>
                <Ionicons name="time-outline" size={14} color="#666" style={styles.infoIcon} />
                <Text style={styles.infoText}>{item.time}</Text>
              </View>
            )}
            {item.location && (
              <View style={styles.infoItem}>
                <Ionicons name="location-outline" size={14} color="#666" style={styles.infoIcon} />
                <Text style={styles.infoText}>{item.location}</Text>
              </View>
            )}
            {item.courseCode && (
              <View style={styles.infoItem}>
                <Ionicons name="book-outline" size={14} color="#666" style={styles.infoIcon} />
                <Text style={styles.infoText}>{item.courseCode}</Text>
              </View>
            )}
          </View>
          
          {item.description && (
            <Text 
              style={styles.eventDescription}
              numberOfLines={2}
            >
              {item.description}
            </Text>
          )}
        </View>
      </View>
      
      <TouchableOpacity 
        style={styles.deleteButton}
        onPress={() => handleDeleteEvent(item.eventId)}
      >
        <Ionicons name="trash-outline" size={18} color="#ff6b6b" />
      </TouchableOpacity>
    </TouchableOpacity>
  );

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

  return (
    <View style={[styles.mainContainer, { backgroundColor: theme.primary }]}>
      <StatusBar barStyle="light-content" backgroundColor={theme.primary} />
      
      {/* Extended header background that goes behind the status bar */}
      <View style={styles.headerBackgroundExtended}>
        <LinearGradient
          colors={[theme.primary, theme.primaryDark]}
          start={{x: 0, y: 0}}
          end={{x: 1, y: 0}}
          style={styles.headerGradient}
        />
      </View>
      
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="chevron-back" size={22} color="#fff" />
            </TouchableOpacity>
            <View style={styles.headerTitle}>
              <Text style={styles.title}>{dateLabel}</Text>
              <Text style={styles.subtitle}>{events.length} {events.length === 1 ? 'event' : 'events'}</Text>
            </View>
            <TouchableOpacity 
              style={styles.addButton}
              onPress={() => navigation.navigate('EventForm', { 
                date,
                fromDayEvents: true,
                onUpdate: (newEvent) => {
                  // Add the new event to local state
                  setEvents([...events, newEvent]);
                }
              })}
            >
              <View style={styles.addButtonCircle}>
                <Ionicons name="add" size={22} color="#fff" />
              </View>
            </TouchableOpacity>
          </View>
        </View>
      
      <View style={styles.container}>
        {events.length > 0 ? (
          <FlatList
            data={events}
            renderItem={({ item }) => {
              const typeColor = getEventTypeColor(item.type);
              const lightTypeColor = getLightColor(typeColor);
              
              return (
                <TouchableOpacity 
                  style={[styles.eventItem, { borderLeftColor: typeColor, backgroundColor: '#fff' }]}
                  onPress={() => handleEditEvent(item)}
                  activeOpacity={0.8}
                >
                  <View style={styles.eventContent}>
                    <View style={styles.eventHeader}>
                      <Text style={styles.eventTitle}>{item.title}</Text>
                      {item.type && (
                        <View style={[styles.eventTypeBadge, { backgroundColor: lightTypeColor }]}>
                          <Text style={[styles.eventType, { color: typeColor }]}>{item.type}</Text>
                        </View>
                      )}
                    </View>
                    
                    <View style={styles.eventDetails}>
                      <View style={styles.eventInfo}>
                        {item.time && (
                          <View style={styles.infoItem}>
                            <Ionicons name="time-outline" size={14} color="#666" style={styles.infoIcon} />
                            <Text style={styles.infoText}>{item.time}</Text>
                          </View>
                        )}
                        {item.location && (
                          <View style={styles.infoItem}>
                            <Ionicons name="location-outline" size={14} color="#666" style={styles.infoIcon} />
                            <Text style={styles.infoText}>{item.location}</Text>
                          </View>
                        )}
                        {item.courseCode && (
                          <View style={styles.infoItem}>
                            <Ionicons name="book-outline" size={14} color="#666" style={styles.infoIcon} />
                            <Text style={styles.infoText}>{item.courseCode}{item.courseTitle ? ` - ${item.courseTitle}` : ''}</Text>
                          </View>
                        )}
                      </View>
                      
                      {item.description && (
                        <View style={styles.descriptionContainer}>
                          <Text style={styles.descriptionLabel}>Description</Text>
                          <Text style={styles.eventDescription}>
                            {item.description}
                          </Text>
                        </View>
                      )}
                      
                      <View style={styles.metadataContainer}>
                        {item.priority && (
                          <View style={[styles.priorityBadge, { 
                            backgroundColor: item.priority.toLowerCase() === 'high' 
                              ? '#fde9e7' 
                              : item.priority.toLowerCase() === 'medium' 
                                ? '#fef5e7' 
                                : '#e9f8f2'
                          }]}>
                            <Text style={[styles.priorityText, { 
                              color: item.priority.toLowerCase() === 'high' 
                                ? '#e74c3c' 
                                : item.priority.toLowerCase() === 'medium' 
                                  ? '#f39c12' 
                                  : '#2ecc71'
                            }]}>
                              {item.priority}
                            </Text>
                          </View>
                        )}
                        {item.createdAt && (
                          <Text style={styles.metadataText}>
                            Added {new Date(item.createdAt).toLocaleDateString()}
                          </Text>
                        )}
                      </View>
                    </View>
                  </View>
                  
                  <View style={styles.actionButtons}>
                    <TouchableOpacity 
                      style={styles.editButton}
                      onPress={() => handleEditEvent(item)}
                    >
                      <Ionicons name="pencil-outline" size={18} color={theme.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={styles.deleteButton}
                      onPress={() => handleDeleteEvent(item.eventId)}
                    >
                      <Ionicons name="trash-outline" size={18} color="#ff6b6b" />
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              );
            }}
            keyExtractor={(item) => item.eventId}
            contentContainerStyle={styles.eventsList}
          />
        ) : (
          <View style={styles.emptyState}>
            <View style={styles.emptyStateContent}>
              <Ionicons name="calendar-outline" size={70} color="#ccc" style={styles.emptyIcon} />
              <Text style={styles.emptyText}>No events for this day</Text>
              <TouchableOpacity 
                style={[styles.addEventButton, { backgroundColor: theme.primary }]}
                onPress={() => navigation.navigate('EventForm', { 
                  date,
                  fromDayEvents: true,
                  onUpdate: (newEvent) => {
                    setEvents([newEvent]);
                  }
                })}
              >
                <Text style={styles.addEventText}>Add Event</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
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
    height: '100%', // Extends to entire screen height
    zIndex: 1,
  },
  headerGradient: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    zIndex: 2,
  },
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  header: {
    height: 80,
    position: 'relative',
    zIndex: 2,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 15,
    height: '100%',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  headerTitle: {
    flex: 1,
    marginLeft: 10,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: 0.2,
  },
  subtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
    letterSpacing: 0.1,
  },
  addButton: {
    marginLeft: 10,
  },
  addButtonCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  eventsList: {
    padding: 15,
  },
  eventItem: {
    backgroundColor: '#fff',
    borderRadius: 10,
    marginBottom: 15,
    padding: 16,
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
    borderLeftWidth: 5,
  },
  eventContent: {
    flex: 1,
  },
  eventHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  eventTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  eventTypeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: 'hidden',
    marginLeft: 8,
  },
  eventType: {
    fontSize: 12,
    fontWeight: '600',
  },
  eventDetails: {
    marginTop: 5,
  },
  eventInfo: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 10,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 15,
    marginBottom: 8,
  },
  infoIcon: {
    marginRight: 6,
  },
  infoText: {
    fontSize: 13,
    color: '#666',
  },
  descriptionContainer: {
    marginTop: 10,
    padding: 10,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
  },
  descriptionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#555',
    marginBottom: 5,
  },
  eventDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  metadataContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    justifyContent: 'space-between',
  },
  priorityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  priorityText: {
    fontSize: 12,
    fontWeight: '600',
  },
  metadataText: {
    fontSize: 11,
    color: '#999',
    fontStyle: 'italic',
  },
  actionButtons: {
    flexDirection: 'column',
    justifyContent: 'space-between',
    paddingLeft: 10,
  },
  editButton: {
    padding: 8,
    marginBottom: 10,
  },
  deleteButton: {
    padding: 8,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyStateContent: {
    width: '80%',
    backgroundColor: '#fff',
    padding: 30,
    borderRadius: 15,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 5,
  },
  emptyIcon: {
    marginBottom: 20,
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    marginBottom: 25,
    textAlign: 'center',
  },
  addEventButton: {
    paddingHorizontal: 25,
    paddingVertical: 12,
    borderRadius: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  addEventText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  }
});