import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import UserAvatar from './UserAvatar';
import UserProfile from './UserProfile';

const formatLastSynced = (date) => {
  const now = new Date();
  const diff = now - date;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);

  if (minutes < 1) return 'just now';
  if (minutes === 1) return '1 minute ago';
  if (minutes < 60) return `${minutes} minutes ago`;
  if (hours === 1) return '1 hour ago';
  if (hours < 24) return `${hours} hours ago`;
  return date.toLocaleDateString();
};

export default function Navbar({ onAddEvent, onSync }) {
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const { lastSynced } = useAuth();

  const handleSync = useCallback(async () => {
    setIsSyncing(true);
    try {
      await onSync();
    } finally {
      setIsSyncing(false);
    }
  }, [onSync]);

  const toggleMenu = () => {
    setIsMenuVisible(!isMenuVisible);
  };

  const closeMenu = () => {
    setIsMenuVisible(false);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.navbar}>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>Smart Calendar</Text>
          {lastSynced && (
            <Text style={styles.lastSynced}>
              Last synced {formatLastSynced(lastSynced)}
            </Text>
          )}
        </View>
        <View style={styles.buttonsContainer}>
          <TouchableOpacity 
            style={[styles.button, isSyncing && styles.buttonDisabled]} 
            onPress={handleSync}
            disabled={isSyncing}
            accessibilityLabel="Sync calendar"
          >
            {isSyncing ? (
              <ActivityIndicator size="small" color="#4b5563" />
            ) : (
              <Ionicons name="sync-circle" size={22} color="#2563eb" />
            )}
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.button} 
            onPress={onAddEvent}
            accessibilityLabel="Add event"
          >
            <Ionicons name="add-circle" size={22} color="#2563eb" />
          </TouchableOpacity>
          <UserAvatar onPress={toggleMenu} />
          {isMenuVisible && <UserProfile onClose={closeMenu} />}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: '#fff',
  },
  navbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontFamily: 'Roboto-Bold',
    color: '#111827',
    letterSpacing: -0.5,
  },
  lastSynced: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  buttonsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  button: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EBF5FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
});
