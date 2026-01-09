import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Modal, Pressable, Animated } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';

export default function UserProfile({ onClose }) {
  const { user, signOut } = useAuth();
  const { theme } = useTheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, []);

  const handleClose = () => {
    // Stop any running animation and start fade out
    fadeAnim.stopAnimation();
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      // Close the profile menu
      onClose();
    });
  };

  const handleSignOut = () => {
    handleClose();
    signOut();
  };

  return (
    <>
      <Modal
        transparent={true}
        animationType="none"
        visible={true}
        onRequestClose={onClose}
      >
        <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]} >
          <Pressable style={styles.pressable} onPress={handleClose}>
            <Pressable style={styles.container}>
              <View style={styles.header}>
                {user?.picture ? (
                  <Image 
                    source={{ uri: user.picture }} 
                    style={styles.avatar}
                  />
                ) : (
                  <View style={[styles.avatar, styles.avatarFallback]}>
                    <Ionicons name="person-circle" size={28} color="#6b7280" />
                  </View>
                )}
                <View style={styles.userInfo}>
                  <Text style={styles.name}>{user?.name}</Text>
                  <Text style={styles.email}>{user?.email}</Text>
                </View>
              </View>
              <View style={styles.divider} />

              {/* Sign Out Button */}
              <TouchableOpacity style={styles.menuButton} onPress={handleSignOut}>
                <Ionicons name="log-out" size={20} color="#dc2626" style={styles.menuIcon} />
                <Text style={styles.signOutButtonText}>Sign out</Text>
              </TouchableOpacity>
            </Pressable>
          </Pressable>
        </Animated.View>
      </Modal>

      
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'flex-start',
  },
  pressable: {
    flex: 1,
    width: '100%',
  },
  container: {
    marginTop: 60,
    marginHorizontal: 20,
    alignSelf: 'flex-end',
    width: 280,
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  avatarFallback: {
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userInfo: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontFamily: 'Roboto-Bold',
    color: '#1f2937',
    marginBottom: 2,
  },
  email: {
    fontSize: 14,
    color: '#6b7280',
    fontFamily: 'Roboto',
  },
  divider: {
    height: 1,
    backgroundColor: '#f3f4f6',
    marginHorizontal: 16,
  },
  menuButton: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  menuIcon: {
    marginRight: 4,
  },
  menuButtonText: {
    fontFamily: 'Roboto-Bold',
    fontSize: 14,
  },
  signOutButtonText: {
    color: '#dc2626',
    fontFamily: 'Roboto-Bold',
    fontSize: 14,
  },
});
