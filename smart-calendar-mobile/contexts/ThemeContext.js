import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Define theme palette options
export const themes = {
  blue: {
    primary: '#3498db',
    primaryDark: '#2980b9',
    primaryLight: '#ebf5fd',
    accent: '#3498db',
    text: '#333',
    textSecondary: '#666',
    textLight: '#888',
    background: '#f8f9fa',
    card: '#fff',
    border: '#eee',
    divider: '#f0f0f0',
    error: '#dc2626',
  },
  pink: {
    primary: '#e84393',
    primaryDark: '#c2185b',
    primaryLight: '#fce4ec',
    accent: '#e84393',
    text: '#333',
    textSecondary: '#666',
    textLight: '#888',
    background: '#f8f9fa',
    card: '#fff',
    border: '#eee',
    divider: '#f0f0f0',
    error: '#dc2626',
  },
  green: {
    primary: '#2ecc71',
    primaryDark: '#27ae60',
    primaryLight: '#e8f8f5',
    accent: '#2ecc71',
    text: '#333',
    textSecondary: '#666',
    textLight: '#888',
    background: '#f8f9fa',
    card: '#fff',
    border: '#eee',
    divider: '#f0f0f0',
    error: '#dc2626',
  },
  purple: {
    primary: '#9b59b6',
    primaryDark: '#8e44ad',
    primaryLight: '#f4ecf7',
    accent: '#9b59b6',
    text: '#333',
    textSecondary: '#666',
    textLight: '#888',
    background: '#f8f9fa',
    card: '#fff',
    border: '#eee',
    divider: '#f0f0f0',
    error: '#dc2626',
  },
  orange: {
    primary: '#f39c12',
    primaryDark: '#d35400',
    primaryLight: '#fef5e7',
    accent: '#f39c12',
    text: '#333',
    textSecondary: '#666',
    textLight: '#888',
    background: '#f8f9fa',
    card: '#fff',
    border: '#eee',
    divider: '#f0f0f0',
    error: '#dc2626',
  },
  slate: {
    primary: '#2c3e50',
    primaryDark: '#1a2530',
    primaryLight: '#ebedef',
    accent: '#3498db',
    text: '#333',
    textSecondary: '#666',
    textLight: '#888',
    background: '#f8f9fa',
    card: '#fff',
    border: '#eee',
    divider: '#f0f0f0',
    error: '#dc2626',
  }
};

const ThemeContext = createContext({});

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider = ({ children }) => {
  const [currentTheme, setCurrentTheme] = useState(themes.blue);
  const [themeName, setThemeName] = useState('blue');

  useEffect(() => {
    // Load saved theme on startup
    const loadTheme = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem('themeName');
        if (savedTheme) {
          setThemeName(savedTheme);
          setCurrentTheme(themes[savedTheme]);
        }
      } catch (error) {
        console.error('Error loading theme:', error);
      }
    };

    loadTheme();
  }, []);

  const changeTheme = async (name) => {
    try {
      if (themes[name]) {
        setThemeName(name);
        setCurrentTheme(themes[name]);
        await AsyncStorage.setItem('themeName', name);
      }
    } catch (error) {
      console.error('Error saving theme:', error);
    }
  };

  return (
    <ThemeContext.Provider value={{
      theme: currentTheme,
      themeName,
      changeTheme,
      availableThemes: Object.keys(themes)
    }}>
      {children}
    </ThemeContext.Provider>
  );
};