import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  TextInput,
  ScrollView, 
  Modal,
  Animated,
  Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SelectList } from 'react-native-dropdown-select-list';

const EventReviewDialog = ({ 
  isVisible, 
  onClose, 
  event, 
  onAccept, 
  onDismiss,
  multipleEvents = false
}) => {
  const [editedEvent, setEditedEvent] = useState(event || {});
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(Dimensions.get('window').height));
  
  React.useEffect(() => {
    if (isVisible) {
      // Reset state when dialog opens with a clean copy of the event
      setEditedEvent(event ? {...event} : {});
      
      // Log the event for debugging
      console.log('Opening review dialog with event:', event);
      
      // Animate in
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
      // Animate out
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
  }, [isVisible, event]);

  const handleChangeText = (field, value) => {
    setEditedEvent(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleAccept = () => {
    console.log('Accepting event review with data:', editedEvent);
    onAccept(editedEvent);
    
    // Force close the modal in case the parent state update hasn't triggered yet
    setTimeout(() => {
      if (isVisible) {
        onDismiss();
      }
    }, 500);
  };

  return (
    <Modal
      transparent
      visible={isVisible}
      onRequestClose={onDismiss}
      animationType="none"
    >
      <Animated.View 
        style={[
          styles.overlay,
          { opacity: fadeAnim }
        ]}
      >
        <TouchableOpacity 
          style={styles.overlayTouchable} 
          onPress={onDismiss} 
          activeOpacity={1}
        />
      </Animated.View>
      
      <Animated.View
        style={[
          styles.modalContainer,
          { transform: [{ translateY: slideAnim }] }
        ]}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Review Event</Text>
          <TouchableOpacity onPress={onDismiss} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#666" />
          </TouchableOpacity>
        </View>
        
        {multipleEvents && (
          <View style={styles.multipleEventsNotice}>
            <Ionicons name="information-circle" size={20} color="#2563eb" />
            <Text style={styles.multipleEventsText}>
              Multiple events were found. Reviewing the first one.
            </Text>
          </View>
        )}

        <ScrollView style={styles.content}>
          <Text style={styles.label}>Title</Text>
          <TextInput
            style={styles.input}
            value={editedEvent.title || ''}
            onChangeText={(text) => handleChangeText('title', text)}
            placeholder="Event Title"
          />
          
          <Text style={styles.label}>Date</Text>
          <View style={styles.dateField}>
            <Text style={styles.dateText}>
              {editedEvent.date 
                ? (typeof editedEvent.date === 'string' && editedEvent.date.includes('Day')) 
                  ? editedEvent.date // Already in toDateString() format
                  : new Date(editedEvent.date).toDateString() 
                : 'No date available'}
            </Text>
          </View>
          
          <Text style={styles.label}>Type</Text>
          <SelectList
            setSelected={(val) => handleChangeText('type', val)}
            data={[
              { key: 'assignment', value: 'Assignment' },
              { key: 'test', value: 'Test' },
              { key: 'meeting', value: 'Meeting' },
              { key: 'office_hours', value: 'Office Hours' },
              { key: 'lecture', value: 'Lecture' }
            ]}
            save="key"
            defaultOption={{ 
              key: editedEvent.type || 'assignment', 
              value: (editedEvent.type || 'assignment')
                .charAt(0).toUpperCase() + 
                (editedEvent.type || 'assignment').slice(1).replace('_', ' ') 
            }}
            search={false}
            boxStyles={styles.selectBox}
            dropdownStyles={styles.dropdown}
          />
          
          <Text style={styles.label}>Priority</Text>
          <SelectList
            setSelected={(val) => handleChangeText('priority', val)}
            data={[
              { key: 'low', value: 'Low' },
              { key: 'medium', value: 'Medium' },
              { key: 'high', value: 'High' }
            ]}
            save="key"
            defaultOption={{ 
              key: editedEvent.priority || 'medium', 
              value: (editedEvent.priority || 'medium').charAt(0).toUpperCase() + 
                    (editedEvent.priority || 'medium').slice(1) 
            }}
            search={false}
            boxStyles={styles.selectBox}
            dropdownStyles={styles.dropdown}
          />
          
          <Text style={styles.label}>Time (optional)</Text>
          <TextInput
            style={styles.input}
            value={editedEvent.time || ''}
            onChangeText={(text) => handleChangeText('time', text)}
            placeholder="Event Time"
          />
          
          <Text style={styles.label}>Location (optional)</Text>
          <TextInput
            style={styles.input}
            value={editedEvent.location || ''}
            onChangeText={(text) => handleChangeText('location', text)}
            placeholder="Event Location"
          />
          
          <Text style={styles.label}>Description (optional)</Text>
          <TextInput
            style={[styles.input, styles.multilineInput]}
            value={editedEvent.description || ''}
            onChangeText={(text) => handleChangeText('description', text)}
            placeholder="Event Description"
            multiline
            numberOfLines={4}
          />
          
          <Text style={styles.label}>Course Code (optional)</Text>
          <TextInput
            style={styles.input}
            value={editedEvent.courseCode || ''}
            onChangeText={(text) => handleChangeText('courseCode', text)}
            placeholder="e.g., CS101"
          />
          
          <Text style={styles.label}>Course Title (optional)</Text>
          <TextInput
            style={styles.input}
            value={editedEvent.courseTitle || ''}
            onChangeText={(text) => handleChangeText('courseTitle', text)}
            placeholder="e.g., Introduction to Computer Science"
          />
        </ScrollView>
        
        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={styles.dismissButton} 
            onPress={() => {
              console.log('Dismissing event review dialog');
              onDismiss();
            }}
          >
            <Text style={styles.dismissButtonText}>Cancel</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.acceptButton}
            onPress={handleAccept}
          >
            <Text style={styles.acceptButtonText}>Accept</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 1,
  },
  overlayTouchable: {
    flex: 1,
  },
  modalContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '90%',
    zIndex: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    padding: 20,
  },
  multipleEventsNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    padding: 12,
    borderRadius: 8,
    marginHorizontal: 20,
    marginTop: 10,
  },
  multipleEventsText: {
    color: '#2563eb',
    marginLeft: 8,
    flex: 1,
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
    marginBottom: 16,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  multilineInput: {
    height: 100,
    textAlignVertical: 'top',
  },
  selectBox: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginBottom: 16,
    backgroundColor: '#fff',
    height: 50,
    alignItems: 'center',
  },
  dropdown: {
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff',
    marginTop: -16,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  dismissButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#f8f8f8',
  },
  dismissButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  acceptButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    backgroundColor: '#2563eb',
  },
  acceptButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  dateField: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    backgroundColor: '#f8f8f8',
  },
  dateText: {
    fontSize: 16,
    color: '#333',
  },
});

export default EventReviewDialog;