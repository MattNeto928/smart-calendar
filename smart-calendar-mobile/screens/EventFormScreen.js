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
  ActivityIndicator,
  StatusBar,
  SafeAreaView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import SyncNotification from '../components/SyncNotification';
import EventReviewDialog from '../components/EventReviewDialog';
import { SelectList } from 'react-native-dropdown-select-list';
import { saveEvent, updateEvent, deleteEvent } from '../lib/aws';
import { geminiParser } from '../lib/gemini';
import { formatStandardDate } from '../lib/dateUtils';
import * as mime from 'react-native-mime-types';
import * as FileSystem from 'expo-file-system';
import LinearGradient from 'react-native-linear-gradient';

// Keep track of active document picker state globally to prevent race conditions
let isDocumentPickerActive = false;
let documentPickerAttempted = false; // Track if we've already tried to open the picker

export default function EventFormScreen({ navigation, route }) {
  const { user, syncEvents } = useAuth();
  const { theme } = useTheme();
  const [syncNotification, setSyncNotification] = useState(null);
  const editingEvent = route.params?.event;
  const uploadMode = route.params?.uploadMode;
  const fromDashboard = route.params?.fromDashboard;
  const [title, setTitle] = useState(editingEvent?.title || '');
  // Parse date properly to avoid timezone issues
  const defaultDate = editingEvent?.date 
    ? (() => {
        const [year, month, day] = editingEvent.date.split('-').map(num => parseInt(num, 10));
        return new Date(year, month-1, day, 12, 0, 0, 0); // noon local time prevents timezone shifts
      })() 
    : (() => {
        const now = new Date();
        now.setHours(12, 0, 0, 0); // Set to noon to avoid timezone issues
        return now;
      })();
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
  const [isRecurring, setIsRecurring] = useState(editingEvent?.isRecurring || false);
  const [recurrencePattern, setRecurrencePattern] = useState(editingEvent?.recurrencePattern || '');
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
    console.log('EventFormScreen mounted, uploadMode:', uploadMode, 'fromDashboard:', fromDashboard);
    console.log('Preselected file:', route.params?.preselectedFile);
    isMounted.current = true;
    
    // Reset document picker state on component mount
    isDocumentPickerActive = false;
    documentPickerAttempted = false;
    
    // Check if we have a preselected file
    const preselectedFile = route.params?.preselectedFile;
    
    if (preselectedFile) {
      console.log('Preselected file detected, processing directly');
      
      // Process the file directly
      const timer = setTimeout(() => {
        if (isMounted.current) {
          // Clear the route params to prevent re-processing AFTER we've accessed the file
          if (navigation && navigation.setParams) {
            navigation.setParams({ 
              preselectedFile: undefined,
              uploadMode: undefined,
              fromDashboard: undefined
            });
          }
          handleDocumentUpload(preselectedFile);
        }
      }, 100);
      
      pickerTimeoutRef.current = timer;
      
    } 
    // If no preselected file but uploadMode is true, open document picker
    else if (uploadMode && !documentPickerAttempted) {
      console.log('Upload mode detected, preparing document picker');
      documentPickerAttempted = true;
      
      // First, clear the route params to prevent re-triggering
      if (navigation && navigation.setParams) {
        navigation.setParams({ 
          uploadMode: undefined,
          fromDashboard: undefined
        });
      }
      
      // Open document picker immediately but use a minimal timeout
      // to ensure the component is mounted and ready
      const timer = setTimeout(() => {
        if (isMounted.current) {
          console.log('Now opening document picker from upload mode');
          
          // If we came from dashboard, go back if user cancels
          pickDocument(fromDashboard);
        }
      }, 100);
      
      pickerTimeoutRef.current = timer;
    }
    
    return () => {
      console.log('EventFormScreen unmounting');
      isMounted.current = false;
      // Clear any pending timeouts
      if (pickerTimeoutRef.current) {
        clearTimeout(pickerTimeoutRef.current);
      }
      // Reset global picker state
      isDocumentPickerActive = false;
      documentPickerAttempted = false;
    };
  }, [uploadMode, fromDashboard, navigation, route.params]);

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
      // Keep hours at noon to avoid timezone issues
      const newTempDate = new Date(selectedDate);
      newTempDate.setHours(12, 0, 0, 0);
      setTempDate(newTempDate);
    }
  };

  const handleTimeChange = (event, selectedTime) => {
    if (selectedTime) {
      setTempTime(selectedTime);
    }
  };

  const handleConfirmDate = () => {
    // Ensure we set the date with noon time to avoid timezone issues
    const finalDate = new Date(tempDate);
    finalDate.setHours(12, 0, 0, 0);
    setDate(finalDate);
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
      
      // Use our standardized date formatting function to ensure consistency
      const formattedDate = formatStandardDate(date);
      
      // Debug logging
      console.log(`Event Form Date: ${date.toLocaleString()} → ${formattedDate}`);
      
      const eventDetails = {
        userId: user.id,
        title,
        date: formattedDate,
        type,
        priority,
        description,
        location,
        courseCode,
        courseTitle,
        time: time || null, // Keep time null if not selected
        isRecurring,
        recurrencePattern: isRecurring ? recurrencePattern || "Weekly" : null, // Set default pattern if missing
      };

      if (editingEvent) {
        await updateEvent(editingEvent.eventId, eventDetails);
      } else {
        // Generate a unique eventId for new events
        const eventId = `event_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        await saveEvent({
          ...eventDetails,
          eventId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }

      // Sync with cloud
      await syncEvents();
      
      // Create notification message to pass back to the calendar screen
      const notification = { 
        message: editingEvent ? 'Event successfully modified' : 'Event successfully created', 
        type: 'success',
        action: 'modify'
      };
      
      setSyncNotification(notification);
      
      // Wait for notification to show before navigating back
      setTimeout(() => {
        // Pass notification to CalendarTab's CalendarMain screen
        navigation.navigate('Main', {
          screen: 'CalendarTab',
          params: {
            screen: 'CalendarMain',
            params: {
              notification,
              refresh: true,
              timestamp: Date.now()
            }
          }
        });
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

  const pickDocument = async (goBackOnCancel = false) => {
    console.log('Document picker requested, goBackOnCancel:', goBackOnCancel);
    
    try {
      // Prevent multiple opens or reopening after unmount
      if (isDocumentPickerActive || !isMounted.current) {
        console.log('Document picker already active or component unmounted, aborting');
        return;
      }
      
      // Set active state to prevent duplicate calls
      isDocumentPickerActive = true;
      setIsPickerActive(true);
      
      // Hide form UI if in uploadMode
      if (uploadMode) {
        // We'll use state to hide the form UI entirely
        // This prevents any UI from showing behind the document picker
        console.log('Upload mode active - hiding form UI');
      }
      
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
          
          // If we came from dashboard and user cancelled, go back
          if (goBackOnCancel) {
            console.log('Going back after cancel - came from dashboard');
            setTimeout(() => navigation.goBack(), 100);
          }
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
            
            // If we came from dashboard and user cancelled, go back
            if (goBackOnCancel) {
              console.log('Going back after cancel - came from document picker');
              setTimeout(() => navigation.goBack(), 100);
            }
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
    } catch (error) {
      console.error('Unexpected document picker error:', error);
      setSyncNotification({
        message: 'Error opening document picker',
        type: 'error'
      });
      
      // If there was an error and we came from dashboard, go back
      if (goBackOnCancel) {
        console.log('Going back after error - came from dashboard');
        setTimeout(() => navigation.goBack(), 500);
      }
    } finally {
      // Reset the picker states
      setTimeout(() => {
        isDocumentPickerActive = false;
        if (isMounted.current) {
          setIsPickerActive(false);
        }
      }, 500); // Small delay to prevent race conditions
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
    if (reviewedEvent.date) {
      // Parse date with noon time to avoid timezone issues
      const [year, month, day] = reviewedEvent.date.split('-').map(num => parseInt(num, 10));
      setDate(new Date(year, month-1, day, 12, 0, 0, 0));
    }
    if (reviewedEvent.courseCode) setCourseCode(reviewedEvent.courseCode);
    if (reviewedEvent.courseTitle) setCourseTitle(reviewedEvent.courseTitle);
    if (reviewedEvent.priority) setPriority(reviewedEvent.priority);
    
    // Close the dialog
    setReviewDialogVisible(false);
    
    // Show the form UI if it was previously hidden in upload mode
    if (uploadMode) {
      // Wait a bit to ensure dialog is fully closed
      setTimeout(() => {
        // We stay on this screen with populated fields, but now visible
        const formScrollView = document.querySelector('.form-scrollview');
        if (formScrollView) formScrollView.style.opacity = 1;
      }, 300);
    }
    
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
    
    // If we're in upload mode and the user cancels, go back to previous screen
    if (fromDashboard) {
      // Wait a bit to ensure dialog is fully closed
      setTimeout(() => {
        navigation.goBack();
      }, 300);
    }
    
    // Show notification
    setSyncNotification({
      message: 'Event review cancelled', 
      type: 'info'
    });
  };


  return (
    <View style={{ flex: 1, backgroundColor: theme.primary }}>
      <StatusBar barStyle="light-content" backgroundColor={theme.primary} />
      
      {/* Extended header background */}
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
          <Text style={styles.headerTitle}>{editingEvent ? 'Edit Event' : 'Add Event'}</Text>
          <View style={styles.rightPlaceholder} />
        </View>
        
        <View style={styles.bodyContainer}>
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

          <ScrollView 
            style={[
              styles.scrollContent, 
              (uploadMode || isPickerActive) && { display: 'none' } // Completely hide form when picking
            ]}
            className="event-form"
            contentContainerStyle={styles.contentContainer}
          >
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
          onPress={() => {
            // Ensure we're using the correct date with noon time to avoid timezone issues
            const newTempDate = new Date(date);
            newTempDate.setHours(12, 0, 0, 0);
            setTempDate(newTempDate);
            setShowDatePicker(true);
          }}
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
            { key: 'office_hours', value: 'Office Hours' },
            { key: 'lecture', value: 'Lecture' }
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
        
        <Text style={styles.label}>Recurring Event</Text>
        <View style={styles.switchContainer}>
          <Text style={styles.switchLabel}>Is this a recurring event?</Text>
          <TouchableOpacity 
            style={[
              styles.toggleButton, 
              isRecurring ? styles.toggleButtonActive : styles.toggleButtonInactive
            ]}
            onPress={() => setIsRecurring(!isRecurring)}
          >
            <View style={[
              styles.toggleHandle, 
              isRecurring ? styles.toggleHandleActive : styles.toggleHandleInactive
            ]} />
          </TouchableOpacity>
        </View>
        
        {isRecurring && (
          <>
            <Text style={styles.label}>Recurrence Pattern (optional)</Text>
            <TextInput
              placeholder="e.g., Weekly on Mondays and Wednesdays"
              value={recurrencePattern}
              onChangeText={setRecurrencePattern}
              style={styles.input}
            />
          </>
        )}

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
                
                // Create notification to pass back to Calendar screen
                const notification = { 
                  message: 'Event successfully deleted', 
                  type: 'success',
                  action: 'delete'
                };
                
                setSyncNotification(notification);
                
                // Wait for notification to show before navigating back
                setTimeout(() => {
                  // Pass notification to CalendarTab's CalendarMain screen
                  navigation.navigate('Main', {
                    screen: 'CalendarTab',
                    params: {
                      screen: 'CalendarMain',
                      params: {
                        notification,
                        refresh: true,
                        timestamp: Date.now()
                      }
                    }
                  });
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
                <ActivityIndicator size="large" color={theme.primary} style={{marginVertical: 20}} />
              </View>
            </View>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  // Header styles
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
  bodyContainer: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  scrollContent: {
    flex: 1,
    paddingHorizontal: 15,
    paddingTop: 15,
  },
  contentContainer: {
    paddingBottom: 30,
  },
  
  // Original styles
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
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  switchLabel: {
    fontSize: 16,
    color: '#444',
  },
  toggleButton: {
    width: 50,
    height: 28,
    borderRadius: 14,
    padding: 2,
  },
  toggleButtonActive: {
    backgroundColor: '#007bff',
  },
  toggleButtonInactive: {
    backgroundColor: '#ccc',
  },
  toggleHandle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'white',
  },
  toggleHandleActive: {
    transform: [{ translateX: 22 }],
  },
  toggleHandleInactive: {
    transform: [{ translateX: 0 }],
  },
});
