import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';

export default function HomeScreen({ navigation }) {
  const { user, loading, signIn, signOut, syncEvents } = useAuth();

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Smart Calendar</Text>
      
      {!user ? (
        <TouchableOpacity style={styles.signInButton} onPress={signIn}>
          <Ionicons name="logo-google" size={24} color="white" style={styles.buttonIcon} />
          <Text style={styles.buttonText}>Sign in with Google</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.userContainer}>
          <Text style={styles.welcomeText}>Welcome, {user.name}</Text>
          
          <TouchableOpacity 
            style={styles.actionButton} 
            onPress={() => navigation.navigate('Calendar')}
          >
            <Ionicons name="calendar" size={24} color="white" style={styles.buttonIcon} />
            <Text style={styles.buttonText}>View Calendar</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionButton} 
            onPress={syncEvents}
          >
            <Ionicons name="sync" size={24} color="white" style={styles.buttonIcon} />
            <Text style={styles.buttonText}>Sync Events</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.actionButton, styles.signOutButton]} 
            onPress={signOut}
          >
            <Ionicons name="log-out" size={24} color="white" style={styles.buttonIcon} />
            <Text style={styles.buttonText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 40,
    color: '#333',
  },
  signInButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4285F4',
    padding: 15,
    borderRadius: 8,
    width: '80%',
    justifyContent: 'center',
  },
  userContainer: {
    width: '100%',
    alignItems: 'center',
  },
  welcomeText: {
    fontSize: 20,
    marginBottom: 30,
    color: '#333',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2196F3',
    padding: 15,
    borderRadius: 8,
    width: '80%',
    justifyContent: 'center',
    marginBottom: 15,
  },
  signOutButton: {
    backgroundColor: '#f44336',
    marginTop: 20,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 10,
  },
  buttonIcon: {
    marginRight: 5,
  },
});
