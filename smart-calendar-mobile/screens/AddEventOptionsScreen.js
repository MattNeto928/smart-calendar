import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import LinearGradient from 'react-native-linear-gradient';
import { useTheme } from '../contexts/ThemeContext';
import NetInfo from '@react-native-community/netinfo';

export default function AddEventOptionsScreen({ navigation }) {
  const { theme } = useTheme();
  const [isChecking, setIsChecking] = useState(false);
  
  const checkNetworkAndPickDocument = async () => {
    if (isChecking) return; // Prevent multiple calls
    setIsChecking(true);
    
    try {
      // Check internet connectivity first
      const networkState = await NetInfo.fetch();
      
      if (!networkState.isConnected || !networkState.isInternetReachable) {
        Alert.alert(
          "No Internet Connection",
          "Please connect to the internet to analyze documents.",
          [{ text: "OK" }]
        );
        setIsChecking(false);
        return;
      }
      
      // Continue with document picker if connected
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf'],
        copyToCacheDirectory: true
      }).catch(error => {
        console.error('DocumentPicker error:', error);
        throw error;
      });

      // Return if cancelled
      if (result.canceled) {
        console.log('Picker canceled');
        setIsChecking(false);
        return;
      }

      console.log('Document picker result:', result);
      
      if (!result.assets?.[0]?.uri) {
        console.warn('Invalid document picker result:', result);
        Alert.alert('Error', 'Invalid file selection');
        setIsChecking(false);
        return;
      }

      console.log('File selected successfully:', result.assets[0]);
      
      // Navigate to EventListScreen for file processing
      const fileToProcess = result.assets[0];
      navigation.navigate('EventListScreen', { 
        fileToProcess,
        isProcessing: true,
        processingStage: 'uploading'
      });
      
    } catch (error) {
      console.error('Error processing file:', error);
      Alert.alert(
        'Error',
        'Failed to process the file. Please try again or create events manually.'
      );
    } finally {
      setIsChecking(false);
    }
  };
  
  return (
    <View style={[styles.mainContainer, { backgroundColor: theme.primary }]}>
      {/* Extended header background that goes behind the status bar */}
      <View style={styles.headerBackgroundExtended}>
        <LinearGradient
          colors={[theme.primary, theme.primaryDark]}
          start={{x: 0, y: 0}}
          end={{x: 1, y: 0}}
          style={styles.headerGradient}
        />
      </View>
      
      <View style={styles.safeArea}>
        <View style={styles.header}>
          <Text style={styles.title}>Add to Calendar</Text>
          <TouchableOpacity 
            style={styles.closeButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      
      <View style={styles.optionsContainer}>
        <TouchableOpacity 
          style={styles.option}
          onPress={() => navigation.navigate('EventForm')}
        >
          <View style={styles.iconContainer}>
            <Ionicons name="create-outline" size={32} color={theme.primary} />
          </View>
          <View style={styles.optionContent}>
            <Text style={styles.optionTitle}>Create Custom Event</Text>
            <Text style={styles.optionDescription}>
              Manually enter event details like title, date, time, and more
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#ccc" />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.option}
          onPress={checkNetworkAndPickDocument}
        >
          <View style={styles.iconContainer}>
            <Ionicons name="document-outline" size={32} color={theme.primary} />
          </View>
          <View style={styles.optionContent}>
            <Text style={styles.optionTitle}>Upload File</Text>
            <Text style={styles.optionDescription}>
              Upload a document or image containing event information
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#ccc" />
        </TouchableOpacity>
      </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    // backgroundColor set dynamically with theme.primary
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    height: 80,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  closeButton: {
    padding: 8,
  },
  optionsContainer: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f8f9fa',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  iconContainer: {
    width: 60,
    height: 60,
    backgroundColor: '#f0f8ff',
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  optionDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  }
});