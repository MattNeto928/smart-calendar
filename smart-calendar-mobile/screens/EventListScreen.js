import React, { useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, SafeAreaView, ActivityIndicator, Alert } from 'react-native';
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

import { geminiParser } from '../lib/gemini';
import { useAuth } from '../contexts/AuthContext';
import ProcessingModal from '../components/ProcessingModal';

export default function EventListScreen({ route, navigation }) {
  const { events, fileToProcess } = route.params || {};
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);
  const [isProcessing, setIsProcessing] = useState(fileToProcess ? true : false);
  const [processingStage, setProcessingStage] = useState(null);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [extractedEvents, setExtractedEvents] = useState(events || []);
  const [fileHasBeenProcessed, setFileHasBeenProcessed] = useState(false);
  const { user } = useAuth();
  
  console.log('EventListScreen received events:', events?.length);
  console.log('EventListScreen received file to process:', !!fileToProcess);
  
  // Function to delete an event from the list
  const deleteEvent = (eventId) => {
    setExtractedEvents(current => current.filter(event => 
      (event.id !== eventId) && (event.eventId !== eventId)
    ));
  };
  
  // Process file if provided
  React.useEffect(() => {
    if (fileToProcess && !events && !fileHasBeenProcessed) {
      // Mark that we're processing this file to prevent reprocessing
      processFile(fileToProcess);
      
      // Find the root navigator to lock navigation
      const rootNav = navigation.getParent() ? navigation.getParent() : navigation;
      
      // Save the original listeners
      if (rootNav && rootNav.addListener) {
        // Completely lock navigation by capturing tab press and back events
        const unsubscribeFocus = rootNav.addListener('tabPress', (e) => {
          if (isProcessing) {
            // Prevent tab navigation while processing
            e.preventDefault();
          }
        });
        
        const unsubscribeBack = navigation.addListener('beforeRemove', (e) => {
          if (isProcessing) {
            // Prevent going back while processing
            e.preventDefault();
          }
        });
        
        // Clean up listeners
        return () => {
          unsubscribeFocus();
          unsubscribeBack();
        };
      }
    }
  }, [fileToProcess, navigation, isProcessing, events, fileHasBeenProcessed]);
  
  // Update navigation params when processing state changes
  React.useEffect(() => {
    if (navigation.setParams) {
      navigation.setParams({ isProcessing });
    }
  }, [isProcessing, navigation]);

  // Function to process the file
  const processFile = async (file) => {
    try {
      // Show processing modal with stages
      setIsProcessing(true);
      
      // Update navigation params to disable tab bar
      if (navigation.setParams) {
        navigation.setParams({ isProcessing: true });
      }
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
      
      let parsedEvents;
      try {
        console.log('Starting Gemini parse with URI:', file.uri);
        parsedEvents = await geminiParser.parseFile(file.uri);
        if (!parsedEvents || parsedEvents.length === 0) {
          throw new Error('No events could be extracted from this file. Try a different file or create events manually.');
        }
        
        // Complete the progress bar
        setProcessingProgress(100);
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error('File parsing error:', error);
        setIsProcessing(false);
        // Mark file as processed even in case of error to prevent reprocessing
        setFileHasBeenProcessed(true);
        
        // Show user-friendly error message
        let errorMessage = 'Failed to analyze the file';
        
        if (error.message?.includes('API quota exceeded')) {
          errorMessage = 'API limit reached. Please try again later.';
        } else if (error.message?.includes('timed out')) {
          errorMessage = 'File processing timed out. Try a smaller or simpler file.';
        } else if (error.message?.includes('Content blocked')) {
          errorMessage = 'File content cannot be processed. Please try a different file.';
        } else if (error.message?.includes('API model is currently unavailable')) {
          errorMessage = 'Service temporarily unavailable. Please try again later.';
        } else if (error.message?.includes('Failed to read file')) {
          errorMessage = 'Unable to read the selected file. Try a different file format.';
        } else {
          // Include the actual error message for debugging purposes
          errorMessage = `Failed to analyze: ${error.message}`;
        }
        
        setSaveStatus(errorMessage);
        
        // Update navigation params to re-enable tab bar in case of error
        if (navigation.setParams) {
          navigation.setParams({ isProcessing: false });
        }
        
        // Show error for 5 seconds and then navigate back appropriately
        setTimeout(() => {
          // Check if we can go back safely
          const canGoBack = navigation.canGoBack();
          if (canGoBack) {
            navigation.goBack();
          } else {
            // If we can't go back, navigate to the main screen
            navigation.reset({
              index: 0,
              routes: [{ name: 'Main' }],
            });
          }
        }, 5000);
        
        return; // Don't throw error further, handled here
      }
      
      // Hide processing modal
      setIsProcessing(false);
      setProcessingStage(null);
      setProcessingProgress(0);
      
      // Mark file as processed to prevent reprocessing
      setFileHasBeenProcessed(true);
      
      // Update navigation params to re-enable tab bar
      if (navigation.setParams) {
        navigation.setParams({ isProcessing: false });
      }
      
      // Validate required fields
      const validEvents = parsedEvents.filter(event => 
        event.title && event.date && event.type
      ).map(event => ({
        ...event,
        userId: user.id  // Add user ID to each event
      }));
      
      if (validEvents.length === 0) {
        setSaveStatus('No valid events found in file. Please try another file.');
        return;
      }
      
      // Update state with extracted events
      setExtractedEvents(validEvents);
      setSaveStatus(`${validEvents.length} events found. Review and save.`);
      
    } catch (error) {
      console.error('Error processing file:', error);
      setIsProcessing(false);
      // Mark file as processed even in case of error to prevent reprocessing
      setFileHasBeenProcessed(true);
      setSaveStatus(`Error: ${error.message || 'Failed to process file'}`);
      
      // Update navigation params to re-enable tab bar in case of error
      if (navigation.setParams) {
        navigation.setParams({ isProcessing: false });
      }
    }
  };
  
  // If processing, show only the processing modal
  if (isProcessing) {
    return (
      <SafeAreaView style={[styles.container, styles.processingContainer]}>
        <ProcessingModal
          stage={processingStage || 'uploading'}
          progress={processingProgress}
        />
      </SafeAreaView>
    );
  }
  
  // Show empty screen with loading indicator while waiting for save operation to complete
  if (isSaving && extractedEvents.length === 0) {
    return (
      <SafeAreaView style={[styles.container, styles.processingContainer]}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.processingText}>Saving events...</Text>
      </SafeAreaView>
    );
  }
  
  // Handle case where no events are available
  if (!extractedEvents || extractedEvents.length === 0) {
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
  
  // Confirmation alert before deleting an event
  const confirmDelete = (eventId) => {
    Alert.alert(
      "Delete Event",
      "Are you sure you want to remove this event?",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        { 
          text: "Delete", 
          onPress: () => deleteEvent(eventId),
          style: "destructive"
        }
      ]
    );
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
      const eventsToSave = extractedEvents.map(event => {
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
      
      // Navigate back to Calendar tab properly (using root navigation)
      // Fix navigation by specifying the complete path
      navigation.reset({
        index: 0,
        routes: [{ 
          name: 'Main', 
          params: {
            screen: 'CalendarTab',
            params: {
              screen: 'CalendarMain',
              params: {
                notification: {
                  message: `${extractedEvents.length} events saved successfully`,
                  type: 'success'
                },
                refresh: true,
                timestamp: Date.now() // Add timestamp to ensure refresh trigger works
              }
            }
          }
        }]
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
      
      {saveStatus && !isProcessing && (
        <View style={[styles.statusBar, 
          saveStatus === "Events saved successfully!" || saveStatus?.includes("events found")
            ? styles.successStatus 
            : saveStatus === "Saving events..." 
              ? styles.infoStatus
              : styles.errorStatus
        ]}>
          <Text style={styles.statusText}>{saveStatus}</Text>
        </View>
      )}
      
      <View style={styles.eventCountContainer}>
        <Text style={styles.eventCount}>{extractedEvents.length} events found - tap to view details</Text>
        <Text style={styles.eventHint}>Tap the trash icon to delete an event</Text>
      </View>
      
      <FlatList
        data={extractedEvents}
        keyExtractor={(item, index) => item.id || item.eventId || index.toString()}
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
                <View style={styles.eventActions}>
                  <TouchableOpacity 
                    style={styles.deleteButton}
                    onPress={(e) => {
                      e.stopPropagation();
                      const id = item.id || item.eventId;
                      confirmDelete(id);
                    }}
                  >
                    <Ionicons name="trash-outline" size={20} color="#ff4d4f" />
                  </TouchableOpacity>
                  <View style={[styles.priorityBadge, { backgroundColor: priorityColor }]}>
                    <Text style={styles.priorityText}>
                      {item.priority?.charAt(0).toUpperCase() + item.priority?.slice(1) || 'Normal'}
                    </Text>
                  </View>
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
              
              {item.isRecurring && (
                <View style={styles.recurringContainer}>
                  <Ionicons name="repeat" size={16} color="#666" />
                  <Text style={styles.recurringText}>
                    {item.recurrencePattern || 'Recurring event'}
                    {item.recurrenceEndDate ? ` (until ${item.recurrenceEndDate})` : ''}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        }}
      />
      
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.saveButton, (isSaving || isProcessing) && styles.saveButtonDisabled]}
          onPress={handleSaveEvents}
          disabled={isSaving || isProcessing}
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
  tabBar: {
    position: 'absolute',
    bottom: -15,
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
    paddingBottom: 20,
  },
  processingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  processingText: {
    marginTop: 20,
    fontSize: 16,
    color: '#4b5563',
    fontWeight: '500',
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
  eventCountContainer: {
    margin: 16,
  },
  eventCount: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 4,
  },
  eventHint: {
    fontSize: 14,
    color: '#9ca3af',
    fontStyle: 'italic',
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
  eventActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deleteButton: {
    padding: 6,
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
  recurringContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  recurringText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 6,
    fontStyle: 'italic',
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