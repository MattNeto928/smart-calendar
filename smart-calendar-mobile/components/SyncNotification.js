import React, { useEffect } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function SyncNotification({ message, type = 'success', onDismiss, action }) {
  const translateY = new Animated.Value(-100);
  const opacity = new Animated.Value(1);

  const dismiss = () => {
    // Start both animations immediately
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -100,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      })
    ]).start(() => onDismiss?.());
  };

  useEffect(() => {
    // Slide in
    Animated.spring(translateY, {
      toValue: 0,
      useNativeDriver: true,
      tension: 80,
      friction: 10,
    }).start();

    // Auto dismiss after 3 seconds
    const timer = setTimeout(dismiss, 3000);
    return () => clearTimeout(timer);
  }, []);

  const getIconName = () => {
    switch (type) {
      case 'success':
        return action === 'delete' ? 'trash' : 
               action === 'modify' ? 'create' : 
               'checkmark-circle-sharp';
      case 'error':
        return 'alert-circle-sharp';
      case 'syncing':
        return 'sync-circle';
      case 'warning':
        return 'warning-outline';
      default:
        return 'information-circle-sharp';
    }
  };

  const getIconColor = () => {
    switch (type) {
      case 'success':
        return '#22c55e';
      case 'error':
        return '#ef4444';
      case 'syncing':
        return '#3b82f6';
      case 'warning':
        return '#f59e0b';
      default:
        return '#6b7280';
    }
  };

  return (
    <Animated.View
      style={[
        styles.container,
        { 
          transform: [{ translateY }],
          opacity 
        }
      ]}
    >
      <View style={[styles.content, type === 'syncing' && styles.syncing]}>
        <Ionicons
          name={getIconName()}
          size={24}
          color={getIconColor()}
          style={[
            styles.icon,
            type === 'syncing' && styles.spinningIcon
          ]}
        />
        <Text style={styles.message}>{message}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    zIndex: 1000,
    paddingHorizontal: 16,
    transform: [{ translateY: -25 }], // Half the height of the content to center it
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.15,
    shadowRadius: 3.84,
    elevation: 5,
    maxWidth: 300,
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  icon: {
    marginRight: 12,
  },
  message: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
    fontFamily: 'Roboto',
  },
  spinningIcon: {
    transform: [{ rotate: '0deg' }],
    animationName: 'spin',
    animationDuration: '1s',
    animationIterationCount: 'infinite',
    animationTimingFunction: 'linear',
  },
  icon: {
    marginRight: 12,
    transform: [{ scale: 1.2 }],
  },
});
