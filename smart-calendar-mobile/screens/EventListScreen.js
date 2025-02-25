import React, { useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, SafeAreaView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { saveEvent } from '../lib/aws';
import SyncNotification from '../components/SyncNotification';

const getEventTypeColor = (type) => {
  switch (type) {
    case 'test':
      return '#dc2626';  // Red
    case 'assignment':
      return '#2563eb';  // Blue
    case 'meeting':
      return '#7c3aed';  // Purple
    case 'office_hours':
      return '#059669';  // Green
    default:
      return '#6b7280';  // Gray
  }
};

const getPriorityColor = (priority) => {
  switch (priority) {
    case 'high':
      return '#ef4444';  // Red
    case 'medium':
      return '#f59e0b';  // Orange
    case 'low':
      return '#10b981';  // Green
    default:
      return '#6b7280';  // Gray
  }
};

export default function EventListScreen({ route, navigation }) {
  const { events } = route.params || {};
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);
  
  console.log('EventListScreen received events:', events?.length);
  
  // Handle case where no events were passed
  if (!events || events.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#007bff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Events</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No events to display</Text>
          <TouchableOpacity
            style={styles.button}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.buttonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const viewEventDetails = (event) => {
    navigation.navigate('EventScreen', { event });
  };
  
  const handleSaveEvents = async () => {
    if (isSaving) return;
    
    setIsSaving(true);
    setSaveStatus("Saving events...");
    
    // Just update the status text - notification will be shown on Calendar screen after redirect
    
    try {
      // Generate a random ID
      const generateId = () => {
        return Math.random().toString(36).substring(2, 9);
      };
      
      // Make sure all events have userId and eventId
      const eventsToSave = events.map(event => {
        if (!event.userId) {
          console.error('Event missing userId:', event);
          throw new Error('Event missing userId');
        }
        
        // Ensure each event has an eventId
        const enrichedEvent = {
          ...event,
          eventId: event.eventId || event.id || generateId(),
          // Add timestamps if missing
          createdAt: event.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        
        return enrichedEvent;
      });
      
      // Log for debugging
      console.log('Saving events with structure:', JSON.stringify(eventsToSave[0]));
      
      // Save all events to database
      await Promise.all(eventsToSave.map(event => saveEvent(event)));
      
      setSaveStatus("Events saved successfully!");
      
      // Navigate back to Calendar immediately and pass notification data
      navigation.navigate('Calendar', {
        notification: {
          message: `${events.length} events saved successfully`,
          type: 'success'
        }
      });
    } catch (error) {
      console.error('Error saving events:', error);
      setSaveStatus(`Error: ${error.message || 'Failed to save events'}`);
      
      // Just show error in the status bar - don't navigate away
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#007bff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Parsed Events</Text>
        <View style={{ width: 24 }} />
      </View>
      
      {saveStatus && (
        <View style={[styles.statusBar, 
          saveStatus === "Events saved successfully!" 
            ? styles.successStatus 
            : saveStatus === "Saving events..." 
              ? styles.infoStatus
              : styles.errorStatus
        ]}>
          <Text style={styles.statusText}>{saveStatus}</Text>
        </View>
      )}
      
      <Text style={styles.eventCount}>{events.length} events found - tap to view details</Text>
      
      <FlatList
        data={events}
        keyExtractor={(item, index) => item.id || index.toString()}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const typeColor = getEventTypeColor(item.type);
          const priorityColor = getPriorityColor(item.priority);
          
          return (
            <TouchableOpacity
              style={[styles.eventItem, { borderLeftColor: typeColor, borderLeftWidth: 4 }]}
              onPress={() => viewEventDetails(item)}
            >
              <View style={styles.eventHeader}>
                <Text style={styles.eventTitle}>{item.title}</Text>
                <View style={[styles.priorityBadge, { backgroundColor: priorityColor }]}>
                  <Text style={styles.priorityText}>
                    {item.priority?.charAt(0).toUpperCase() + item.priority?.slice(1) || 'Normal'}
                  </Text>
                </View>
              </View>
              
              <View style={styles.eventTypeContainer}>
                <View style={[styles.typeBadge, { backgroundColor: typeColor }]}>
                  <Text style={styles.typeText}>
                    {item.type?.split('_').map(word =>
                      word.charAt(0).toUpperCase() + word.slice(1)
                    ).join(' ') || 'Other'}
                  </Text>
                </View>
              </View>
              
              <View style={styles.eventDetails}>
                <View style={styles.detailRow}>
                  <Ionicons name="calendar" size={16} color="#666" />
                  <Text style={styles.detailText}>{item.date}</Text>
                </View>
                
                {item.time && (
                  <View style={styles.detailRow}>
                    <Ionicons name="time" size={16} color="#666" />
                    <Text style={styles.detailText}>{item.time}</Text>
                  </View>
                )}
                
                {item.location && (
                  <View style={styles.detailRow}>
                    <Ionicons name="location" size={16} color="#666" />
                    <Text style={styles.detailText}>{item.location}</Text>
                  </View>
                )}
              </View>
              
              {(item.courseCode || item.courseTitle) && (
                <Text style={styles.courseInfo}>
                  {item.courseCode}{item.courseCode && item.courseTitle ? ' - ' : ''}{item.courseTitle}
                </Text>
              )}
            </TouchableOpacity>
          );
        }}
      />
      
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
          onPress={handleSaveEvents}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="save" size={20} color="#fff" style={styles.buttonIcon} />
              <Text style={styles.saveButtonText}>Save All Events</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
      
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  statusBar: {
    padding: 12,
    marginBottom: 8,
  },
  successStatus: {
    backgroundColor: '#dcfce7',
  },
  errorStatus: {
    backgroundColor: '#fee2e2',
  },
  infoStatus: {
    backgroundColor: '#dbeafe',
  },
  statusText: {
    textAlign: 'center',
    fontWeight: '500',
  },
  eventCount: {
    fontSize: 16,
    color: '#6b7280',
    margin: 16,
  },
  listContent: {
    padding: 16,
    paddingBottom: 80, // Extra padding at bottom for button
  },
  eventItem: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  eventTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    flex: 1,
    marginRight: 8,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  priorityText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  eventTypeContainer: {
    marginBottom: 12,
  },
  typeBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  typeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  eventDetails: {
    marginBottom: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  detailText: {
    fontSize: 14,
    color: '#4b5563',
    marginLeft: 6,
  },
  courseInfo: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#3b82f6',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    width: 120,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  buttonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  saveButton: {
    backgroundColor: '#3b82f6',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  saveButtonDisabled: {
    backgroundColor: '#93c5fd',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  buttonIcon: {
    marginRight: 8,
  },
});