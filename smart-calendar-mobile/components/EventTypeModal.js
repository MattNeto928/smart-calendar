import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function EventTypeModal({ visible, onClose, onSelectType }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(500)).current;

  useEffect(() => {
    if (visible) {
      // Reset animations
      slideAnim.setValue(500);
      fadeAnim.setValue(0);
      
      // Animate backdrop and slide separately
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();

      Animated.spring(slideAnim, {
        toValue: 0,
        damping: 20,
        stiffness: 90,
        mass: 0.5,
        useNativeDriver: true,
      }).start();
    } else {
      // Animate out
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();

      Animated.spring(slideAnim, {
        toValue: 500,
        damping: 20,
        stiffness: 90,
        mass: 0.5,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  const handleClose = () => {
    // Animate backdrop and slide out
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();

    Animated.spring(slideAnim, {
      toValue: 500,
      damping: 20,
      stiffness: 90,
      mass: 0.5,
      useNativeDriver: true,
    }).start(() => {
      onClose();
    });
  };
  return (
    <Modal
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <Animated.View 
          style={[
            styles.backdrop,
            {
              opacity: fadeAnim,
            }
          ]}
        />
        <TouchableOpacity
          activeOpacity={1}
          onPress={handleClose}
          style={styles.backdropTouchable}
        />
        <Animated.View 
          style={[
            styles.modalView,
            {
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          <Text style={styles.modalTitle}>Add Event</Text>
          
          <TouchableOpacity
            style={styles.option}
            onPress={() => onSelectType('custom')}
          >
            <View style={styles.optionContent}>
              <Ionicons name="calendar" size={24} color="#2563eb" />
              <View style={styles.optionText}>
                <Text style={styles.optionTitle}>Custom Event</Text>
                <Text style={styles.optionDescription}>Create a new event manually</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward-outline" size={24} color="#2563eb" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.option}
            onPress={() => onSelectType('file')}
          >
            <View style={styles.optionContent}>
              <Ionicons name="cloud-upload" size={24} color="#2563eb" />
              <View style={styles.optionText}>
                <Text style={styles.optionTitle}>Upload File</Text>
                <Text style={styles.optionDescription}>Extract events from a file</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward-outline" size={24} color="#2563eb" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.closeButton}
            onPress={handleClose}
          >
            <Text style={styles.closeButtonText}>Cancel</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdropTouchable: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalView: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: 'Roboto-Bold',
    color: '#111827',
    marginBottom: 20,
    textAlign: 'center',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    marginBottom: 12,
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  optionText: {
    marginLeft: 12,
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontFamily: 'Roboto-Bold',
    color: '#111827',
  },
  optionDescription: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  closeButton: {
    marginTop: 8,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    fontFamily: 'Roboto-Bold',
    color: '#6b7280',
  },
});
