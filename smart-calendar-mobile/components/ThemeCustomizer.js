import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Modal, Pressable } from 'react-native';
import { useTheme, themes } from '../contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';

export default function ThemeCustomizer({ onClose }) {
  const { theme, themeName, changeTheme, availableThemes } = useTheme();
  const [selectedTheme, setSelectedTheme] = useState(themeName);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, []);

  const handleClose = () => {
    fadeAnim.stopAnimation();
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(onClose);
  };

  const applyChanges = () => {
    changeTheme(selectedTheme);
    handleClose();
  };

  return (
    <Modal
      transparent={true}
      animationType="none"
      visible={true}
      onRequestClose={handleClose}
    >
      <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
        <Pressable style={styles.pressable} onPress={handleClose}>
          <Pressable style={styles.container} onPress={e => e.stopPropagation()}>
            <View style={styles.header}>
              <Text style={styles.title}>Customize Theme</Text>
              <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.divider} />
            
            <Text style={styles.sectionTitle}>Color Palettes</Text>
            <View style={styles.themeGrid}>
              {availableThemes.map(name => (
                <TouchableOpacity 
                  key={name}
                  style={[
                    styles.themeOption,
                    { borderColor: selectedTheme === name ? themes[name].primary : '#e0e0e0' }
                  ]}
                  onPress={() => setSelectedTheme(name)}
                >
                  <View style={[styles.themeColorPreview, { backgroundColor: themes[name].primary }]} />
                  <Text style={styles.themeLabel}>
                    {name.charAt(0).toUpperCase() + name.slice(1)}
                    {selectedTheme === name && (
                      <Ionicons name="checkmark-circle" size={16} color={themes[name].primary} style={styles.checkIcon} />
                    )}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            
            <View style={styles.buttonContainer}>
              <TouchableOpacity 
                style={[styles.button, { backgroundColor: theme.primaryLight, opacity: selectedTheme === themeName ? 0.5 : 1 }]}
                onPress={handleClose}
                disabled={selectedTheme === themeName}
              >
                <Text style={[styles.buttonText, { color: theme.primary }]}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.button, { backgroundColor: theme.primary, opacity: selectedTheme === themeName ? 0.5 : 1 }]}
                onPress={applyChanges}
                disabled={selectedTheme === themeName}
              >
                <Text style={[styles.buttonText, { color: '#fff' }]}>Apply Changes</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pressable: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: '85%',
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
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 4,
  },
  divider: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#555',
    marginTop: 16,
    marginBottom: 12,
    marginHorizontal: 16,
  },
  themeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  themeOption: {
    width: '31%',
    borderWidth: 2,
    borderRadius: 8,
    padding: 8,
    marginBottom: 12,
    alignItems: 'center',
  },
  themeColorPreview: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginBottom: 8,
  },
  themeLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkIcon: {
    marginLeft: 4,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    flex: 1,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  buttonText: {
    fontWeight: '600',
    fontSize: 14,
  },
});