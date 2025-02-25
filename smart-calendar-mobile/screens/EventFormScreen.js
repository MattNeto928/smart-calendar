import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  ScrollView, 
  Alert, 
  Animated, 
  Dimensions, 
  Platform,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import SyncNotification from '../components/SyncNotification';
import EventReviewDialog from '../components/EventReviewDialog';
import { SelectList } from 'react-native-dropdown-select-list';
import { createEvent, updateEvent, deleteEvent } from '../lib/aws';
import { geminiParser } from '../lib/gemini';
import * as mime from 'react-native-mime-types';
import * as FileSystem from 'expo-file-system';

// Keep track of active document picker state globally to prevent race conditions
let isDocumentPickerActive = false;

export default function EventFormScreen({ navigation, route }) {
  const { user, syncEvents } = useAuth();
  const [syncNotification, setSyncNotification] = useState(null);
  const editingEvent = route.params?.event;
  const [title, setTitle] = useState(editingEvent?.title || '');
  const defaultDate = editingEvent?.date ? new Date(editingEvent.date) : new Date();
  const [date, setDate] = useState(defaultDate);
  const [tempDate, setTempDate] = useState(date);
  const [tempTime, setTempTime] = useState(new Date());
  const [type, setType] = useState(editingEvent?.type || 'assignment');
  const [description, setDescription] = useState(editingEvent?.description || '');
  const [location, setLocation] = useState(editingEvent?.location || '');
  const [time, setTime] = useState(editingEvent?.time || '');
  const [priority, setPriority] = useState(editingEvent?.priority || 'medium');
  const [courseTitle, setCourseTitle] = useState(editingEvent?.courseTitle || '');
  const [courseCode, setCourseCode] = useState(editingEvent?.courseCode || '');
  const [attachmentFilename, setAttachmentFilename] = useState('');
  const isMounted = React.useRef(true);
  const [isPickerActive, setIsPickerActive] = useState(false);
  const pickerTimeoutRef = React.useRef(null);
  
  // Event review dialog state
  const [reviewDialogVisible, setReviewDialogVisible] = useState(false);
  const [parsedEvent, setParsedEvent] = useState(null);
  const [hasMultipleEvents, setHasMultipleEvents] = useState(false);
  const [isParsing, setIsParsing] = useState(false);

  useEffect(() => {
    isMounted.current = true;
    // Reset document picker state on component mount
    isDocumentPickerActive = false;
    
    return () => {
      isMounted.current = false;
      // Clear any pending timeouts
      if (pickerTimeoutRef.current) {
        clearTimeout(pickerTimeoutRef.current);
      }
      // Reset global picker state
      isDocumentPickerActive = false;
    };
  }, []);

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const fadeAnim = useState(new Animated.Value(0))[0];
  const slideAnim = useState(new Animated.Value(Dimensions.get('window').height))[0];

  useEffect(() => {
    if (showDatePicker || showTimePicker) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        })
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: Dimensions.get('window').height,
          duration: 200,
          useNativeDriver: true,
        })
      ]).start();
    }
  }, [showDatePicker, showTimePicker]);

  const handleDateChange = (event, selectedDate) => {
    if (selectedDate) {
      setTempDate(selectedDate);
    }
  };

  const handleTimeChange = (event, selectedTime) => {
    if (selectedTime) {
      setTempTime(selectedTime);
    }
  };

  const handleConfirmDate = () => {
    setDate(tempDate);
    setShowDatePicker(false);
  };

  const handleConfirmTime = () => {
    const hours = tempTime.getHours();
    const minutes = tempTime.getMinutes();
    const period = hours >= 12 ? 'PM' : 'AM';
    const formattedHours = hours % 12 || 12;
    const formattedMinutes = minutes.toString().padStart(2, '0');
    setTime(`${formattedHours}:${formattedMinutes} ${period}`);
    setShowTimePicker(false);
  };

  const handleSubmit = async () => {
    try {
      console.log('Creating new event with data:', {
        title, date, time, type, description, location, priority, courseCode, courseTitle
      });
      setSyncNotification({ message: editingEvent ? 'Modifying event...' : 'Creating event...', type: 'syncing' });
      
      const eventDetails = {
        userId: user.id,
        title,
        date: date.toISOString().split('T')[0],
        type,
        priority,
        description,
        location,
        courseCode,
        courseTitle,
        time: time || null, // Keep time null if not selected
      };

      if (editingEvent) {
        await updateEvent(editingEvent.eventId, eventDetails);
      } else {
        await createEvent(eventDetails);
      }

      // Sync with cloud
      await syncEvents();
      setSyncNotification({ 
        message: editingEvent ? 'Event successfully modified' : 'Event successfully created', 
        type: 'success',
        action: 'modify'
      });
      
      // Wait for notification to show before navigating back
      setTimeout(() => {
        navigation.goBack();
      }, 1000);
    } catch (error) {
      console.error('Failed to save event:', error);
      Alert.alert(
        'Error',
        editingEvent ? 'Failed to update event.' : 'Failed to create event.',
        [{ text: 'OK' }]
      );
    }
  };

  // Check if we're running in a simulator
  const isSimulator = () => {
    // Most reliable way to detect simulator
    return (
      Platform.OS === 'ios' && 
      !Platform.isPad && 
      !Platform.isTVOS &&
      (process.env.EXPO_PUBLIC_SIMULATOR === 'true' || 
       (__DEV__ && !FileSystem.cacheDirectory?.includes('Containers'))
      )
    );
  };

  const pickDocument = async () => {
    console.log('Document picker requested');
    
    try {
      // Reset states
      isDocumentPickerActive = false;
      setIsPickerActive(false);
      
      if (!isMounted.current) {
        console.log('Component unmounted, aborting');
        return;
      }
      
      // Set active state
      isDocumentPickerActive = true;
      setIsPickerActive(true);
      
      // Show notification
      setSyncNotification({ message: 'Select a document...', type: 'syncing' });
      
      // Try using ImagePicker instead of DocumentPicker as a more reliable option
      console.log('Opening image picker - more reliable on some devices');
      
      try {
        // Request permission first
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        
        if (status !== 'granted') {
          console.log('Permission to access media library denied');
          setSyncNotification({
            message: 'Permission to access media library denied',
            type: 'error'
          });
          return;
        }
        
        // Launch image picker
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.All, // Allow all types including documents
          allowsEditing: false,
          quality: 1,
          allowsMultipleSelection: false
        });
        
        console.log('Image picker result:', result);
        
        if (result.canceled || !result.assets || result.assets.length === 0) {
          console.log('Picking cancelled or no assets selected');
          setSyncNotification(null);
          return;
        }
        
        // Get the selected asset
        const asset = result.assets[0];
        
        // Validate asset
        if (!asset.uri) {
          throw new Error('Selected file has no URI');
        }
        
        // Process the document
        await handleDocumentUpload(asset);
      } catch (error) {
        console.error('Error in image picker:', error);
        
        // Fallback to document picker if image picker fails
        console.log('Falling back to document picker');
        try {
          const result = await DocumentPicker.getDocumentAsync({
            copyToCacheDirectory: true,
            type: '*/*'
          });
          
          console.log('Document picker result:', result);
          
          if (result.canceled || !result.assets || result.assets.length === 0) {
            console.log('Document picking cancelled or no assets selected');
            setSyncNotification(null);
            return;
          }
          
          const asset = result.assets[0];
          if (!asset.uri) {
            throw new Error('Selected file has no URI');
          }
          
          await handleDocumentUpload(asset);
        } catch (docError) {
          console.error('Error in document picker fallback:', docError);
          setSyncNotification({
            message: `Error selecting file: ${docError.message}`,
            type: 'error'
          });
        }
      }
    } finally {
      // Immediately reset the picker states
      isDocumentPickerActive = false;
      if (isMounted.current) {
        setIsPickerActive(false);
      }
    }
  };

  const handleDocumentUpload = async (asset) => {
    if (!asset) {
      console.error('No asset provided to handleDocumentUpload');
      return;
    }

    try {
      console.log('Processing document:', asset);
      setSyncNotification({ message: 'Analyzing file...', type: 'syncing' });
      
      // Set attachment filename for UI feedback
      setAttachmentFilename(asset.name || 'document');
      
      // Show parsing indicator
      setIsParsing(true);
      
      try {
        // Process the file with Gemini
        const events = await geminiParser.parseFile(asset.uri);
        
        console.log('Gemini parser returned events:', events);
        
        if (!events || events.length === 0) {
          setSyncNotification({ 
            message: 'No events found in file. Try a different file or format.', 
            type: 'error' 
          });
          return;
        }

        // Store the first event for review
        const firstEvent = events[0];
        console.log('First event to be reviewed:', firstEvent);
        
        // Update state with the parsed event
        setParsedEvent(firstEvent);
        
        // Check if there are multiple events
        const multipleEvents = events.length > 1;
        setHasMultipleEvents(multipleEvents);
        
        // Show notification that event was found
        setSyncNotification({ 
          message: `Found ${multipleEvents ? 'events' : 'an event'} in ${asset.name}. Please review.`, 
          type: 'success' 
        });
        
        // Turn off parsing indicator
        setIsParsing(false);
        
        // CRITICAL: Ensure dialog is shown after a short delay
        setTimeout(() => {
          console.log('Opening review dialog now...');
          setReviewDialogVisible(true);
        }, 800);
        
      } catch (geminiError) {
        console.error('Gemini processing error:', geminiError);
        
        // Provide specific error message based on the error
        let errorMessage = 'Failed to analyze file';
        if (geminiError.message) {
          if (geminiError.message.includes('quota')) {
            errorMessage = 'API quota exceeded. Please try again later.';
          } else if (geminiError.message.includes('timed out')) {
            errorMessage = 'Analysis timed out. The file may be too large or complex.';
          } else if (geminiError.message.includes('format')) {
            errorMessage = 'Unsupported file format. Try a PDF or image file.';
          } else {
            errorMessage = `Analysis error: ${geminiError.message}`;
          }
        }
        
        setIsParsing(false);
        setSyncNotification({ 
          message: errorMessage, 
          type: 'error' 
        });
      }
    } catch (error) {
      console.error('File handling error:', error);
      setIsParsing(false);
      setSyncNotification({ 
        message: `Error processing file: ${error.message}`, 
        type: 'error' 
      });
    }
  };
  
  // Handle accepting the reviewed event
  const handleAcceptReviewedEvent = (reviewedEvent) => {
    // Update form fields with the reviewed event data
    if (reviewedEvent.title) setTitle(reviewedEvent.title);
    if (reviewedEvent.type) setType(reviewedEvent.type);
    if (reviewedEvent.description) setDescription(reviewedEvent.description);
    if (reviewedEvent.location) setLocation(reviewedEvent.location);
    if (reviewedEvent.time) setTime(reviewedEvent.time);
    if (reviewedEvent.date) setDate(new Date(reviewedEvent.date));
    if (reviewedEvent.courseCode) setCourseCode(reviewedEvent.courseCode);
    if (reviewedEvent.courseTitle) setCourseTitle(reviewedEvent.courseTitle);
    if (reviewedEvent.priority) setPriority(reviewedEvent.priority);
    
    // Close the dialog
    setReviewDialogVisible(false);
    
    // Show a success notification
    setSyncNotification({ 
      message: 'Event details successfully applied to form', 
      type: 'success' 
    });
  };
  
  // Handle dismissing the review dialog
  const handleDismissReview = () => {
    console.log('Dismissing review dialog');
    
    // Make sure to reset all relevant state
    setReviewDialogVisible(false);
    setParsedEvent(null);
    setHasMultipleEvents(false);
    setIsParsing(false);
    
    // Show notification
    setSyncNotification({
      message: 'Event review cancelled', 
      type: 'info'
    });
  };


  return (
    <>
      <EventReviewDialog
        isVisible={reviewDialogVisible}
        event={parsedEvent}
        onAccept={handleAcceptReviewedEvent}
        onDismiss={handleDismissReview}
        multipleEvents={hasMultipleEvents}
      />
      
      <Animated.View
        style={[styles.overlay, {
          opacity: fadeAnim,
          pointerEvents: showDatePicker || showTimePicker ? 'auto' : 'none'
        }]}
      />
      {showDatePicker && (
        <Animated.View
          style={[styles.pickerContainer, {
            transform: [{ translateY: slideAnim }]
          }]}
        >
          <View style={styles.pickerHeader}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setShowDatePicker(false)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.pickerTitle}>Select Date</Text>
            <TouchableOpacity 
              style={styles.confirmButton}
              onPress={handleConfirmDate}
            >
              <Text style={styles.confirmButtonText}>Confirm</Text>
            </TouchableOpacity>
          </View>
          <DateTimePicker
            value={tempDate}
            mode="date"
            display="spinner"
            onChange={handleDateChange}
            style={styles.picker}
          />
        </Animated.View>
      )}

      {showTimePicker && (
        <Animated.View 
          style={[styles.pickerContainer, {
            transform: [{ translateY: slideAnim }]
          }]}
        >
          <View style={styles.pickerHeader}>
            <TouchableOpacity 
              style={styles.cancelButton}
              onPress={() => setShowTimePicker(false)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.pickerTitle}>Select Time</Text>
            <TouchableOpacity
              style={styles.confirmButton}
              onPress={handleConfirmTime}
            >
              <Text style={styles.confirmButtonText}>Confirm</Text>
            </TouchableOpacity>
          </View>
          <DateTimePicker
            value={tempTime}
            mode="time"
            display="spinner"
            onChange={handleTimeChange}
            style={styles.picker}
          />
        </Animated.View>
      )}

      <ScrollView style={styles.container}>
        <Text style={styles.title}>{editingEvent ? 'Edit Event' : 'Add Event'}</Text>
        
        <Text style={styles.label}>Title</Text>
        <TextInput
          placeholder="Event Title"
          value={title}
          onChangeText={setTitle}
          style={styles.input}
        />

        <Text style={styles.label}>Date</Text>
        <TouchableOpacity 
          style={[styles.dateButton, styles.interactiveField]}
          onPress={() => setShowDatePicker(true)}
        >
          <View style={styles.dateButtonContent}>
            <Ionicons name="calendar" size={20} color="#666" />
            <Text style={styles.dateText}>
              {date.toLocaleDateString()}
            </Text>
            <Ionicons name="chevron-down" size={20} color="#666" />
          </View>
        </TouchableOpacity>

        <Text style={styles.label}>Time (optional)</Text>
        <TouchableOpacity 
          style={[styles.dateButton, styles.interactiveField]}
          onPress={() => setShowTimePicker(true)}
        >
          <View style={styles.dateButtonContent}>
            <Ionicons name="time" size={20} color="#666" />
            <Text style={styles.dateText}>
              {time || 'Select Time'}
            </Text>
            <Ionicons name="chevron-down" size={20} color="#666" />
          </View>
        </TouchableOpacity>

        <Text style={styles.label}>Event Type</Text>
        <SelectList
          setSelected={setType}
          data={[
            { key: 'assignment', value: 'Assignment' },
            { key: 'test', value: 'Test' },
            { key: 'meeting', value: 'Meeting' },
            { key: 'office_hours', value: 'Office Hours' }
          ]}
          save="key"
          defaultOption={{ key: type, value: type.charAt(0).toUpperCase() + type.slice(1).replace('_', ' ') }}
          search={false}
          boxStyles={styles.selectBox}
          dropdownStyles={styles.dropdown}
        />

        <Text style={styles.label}>Priority</Text>
        <SelectList
          setSelected={setPriority}
          data={[
            { key: 'low', value: 'Low' },
            { key: 'medium', value: 'Medium' },
            { key: 'high', value: 'High' }
          ]}
          save="key"
          defaultOption={{ key: priority, value: priority.charAt(0).toUpperCase() + priority.slice(1) }}
          search={false}
          boxStyles={styles.selectBox}
          dropdownStyles={styles.dropdown}
        />

        <Text style={styles.label}>Course Code (optional)</Text>
        <TextInput
          placeholder="e.g., CS101"
          value={courseCode}
          onChangeText={setCourseCode}
          style={styles.input}
        />

        <Text style={styles.label}>Course Title (optional)</Text>
        <TextInput
          placeholder="e.g., Introduction to Computer Science"
          value={courseTitle}
          onChangeText={setCourseTitle}
          style={styles.input}
        />

        <Text style={styles.label}>Location (optional)</Text>
        <TextInput
          placeholder="Event Location"
          value={location}
          onChangeText={setLocation}
          style={styles.input}
        />

        <Text style={styles.label}>Description (optional)</Text>
        <TextInput
          placeholder="Event Description"
          value={description}
          onChangeText={setDescription}
          style={[styles.input, styles.textArea]}
          multiline
          numberOfLines={4}
        />

        <TouchableOpacity style={styles.saveButton} onPress={handleSubmit}>
          <Text style={styles.saveButtonText}>Save</Text>
        </TouchableOpacity>

        {editingEvent && (
          <TouchableOpacity 
            style={styles.deleteButton}
            onPress={async () => {
              try {
                setSyncNotification({ message: 'Deleting event...', type: 'syncing' });
                await deleteEvent(user.id, editingEvent.eventId);
                
                // Sync with cloud
                await syncEvents();
                setSyncNotification({ 
                  message: 'Event successfully deleted', 
                  type: 'success',
                  action: 'delete'
                });
                
                // Wait for notification to show before navigating back
                setTimeout(() => {
                  navigation.goBack();
                }, 1000);
              } catch (error) {
                console.error('Failed to delete event:', error);
                Alert.alert(
                  'Error',
                  'Failed to delete event. Please try again.',
                  [{ text: 'OK' }]
                );
              }
            }}
          >
            <Text style={styles.deleteButtonText}>Delete Event</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity 
          style={[
            styles.uploadButton,
            isPickerActive && styles.uploadButtonDisabled
          ]} 
          onPress={pickDocument}
          disabled={isPickerActive}
        >
          <Text style={styles.uploadButtonText}>
            {isPickerActive ? 'Processing...' : 'Upload File'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
      {syncNotification && (
        <SyncNotification
          message={syncNotification.message}
          type={syncNotification.type}
          onDismiss={() => setSyncNotification(null)}
        />
      )}
      
      {/* Overlay while parsing */}
      {isParsing && (
        <View style={styles.parsingOverlay}>
          <View style={styles.parsingCard}>
            <Text style={styles.parsingTitle}>Analyzing Document</Text>
            <Text style={styles.parsingText}>
              Please wait while we extract event information from your document...
            </Text>
            <ActivityIndicator size="large" color="#2563eb" style={{marginVertical: 20}} />
          </View>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  parsingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    zIndex: 1000,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  parsingCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    width: '90%',
    maxWidth: 350,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  parsingTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
    textAlign: 'center',
  },
  parsingText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 22,
  },
  loadingIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    height: 40,
  },
  loadingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#2563eb',
    margin: 5,
    opacity: 0.3,
  },
  dot1: {
    opacity: 1,
    transform: [{scale: 1}],
    animationName: 'bounce',
    animationDuration: '1s',
    animationIterationCount: 'infinite',
    animationDelay: '0s',
  },
  dot2: {
    opacity: 0.8,
    transform: [{scale: 0.9}],
    animationName: 'bounce',
    animationDuration: '1s',
    animationIterationCount: 'infinite',
    animationDelay: '0.2s',
  },
  dot3: {
    opacity: 0.6,
    transform: [{scale: 0.8}],
    animationName: 'bounce',
    animationDuration: '1s',
    animationIterationCount: 'infinite',
    animationDelay: '0.4s',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 999,
  },
  container: { 
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
    color: '#666',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  dateButton: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    backgroundColor: '#fff',
  },
  dateButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateText: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    marginHorizontal: 10,
  },
  interactiveField: {
    backgroundColor: '#f8f8f8',
  },
  selectBox: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginBottom: 20,
    backgroundColor: '#fff',
    height: 50,
    alignItems: 'center',
  },
  dropdown: {
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff',
    marginTop: -20,
  },
  saveButton: {
    backgroundColor: '#007bff',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  deleteButton: {
    backgroundColor: '#dc3545',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  pickerContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#ddd',
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  cancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  confirmButton: {
    backgroundColor: '#007bff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  picker: {
    backgroundColor: '#fff',
  },
  uploadButton: {
    backgroundColor: 'green',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
  },
  uploadButtonDisabled: {
    backgroundColor: '#90EE90', // Light green
    opacity: 0.7,
  },
  uploadButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
