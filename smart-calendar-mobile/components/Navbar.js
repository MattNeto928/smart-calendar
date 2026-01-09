import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, StatusBar, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import UserAvatar from './UserAvatar';
import UserProfile from './UserProfile';
import ThemeCustomizer from './ThemeCustomizer';
import LinearGradient from 'react-native-linear-gradient';

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
  const [showThemeCustomizer, setShowThemeCustomizer] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const { lastSynced } = useAuth();
  const { theme } = useTheme();

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
  
  const openThemeCustomizer = () => {
    console.log('Opening theme customizer');
    setShowThemeCustomizer(true);
  };

  return (
    <>
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
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Ionicons name="sync-circle" size={22} color="#ffffff" />
                )}
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.button} 
                onPress={onAddEvent}
                accessibilityLabel="Add event"
              >
                <Ionicons name="add-circle" size={22} color="#ffffff" />
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.button}
                onPress={openThemeCustomizer}
                accessibilityLabel="Customize theme"
              >
                <Ionicons name="color-palette" size={22} color="#ffffff" />
              </TouchableOpacity>
              <UserAvatar onPress={toggleMenu} />
            </View>
          </View>
        </SafeAreaView>
      </View>
      
      {/* Modals rendered outside the main container */}
      {isMenuVisible && (
        <UserProfile onClose={closeMenu} />
      )}
      
      {/* The theme customizer component includes its own Modal */}
      {showThemeCustomizer && (
        <ThemeCustomizer onClose={() => setShowThemeCustomizer(false)} />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
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
    zIndex: 2,
    backgroundColor: 'transparent',
  },
  navbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: 'transparent',
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontFamily: 'Roboto-Bold',
    color: '#ffffff',
    letterSpacing: -0.5,
  },
  lastSynced: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
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
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
});
