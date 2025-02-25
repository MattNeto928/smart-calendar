import React from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import { View } from 'react-native';

export const UploadIcon = ({ size = 40, color = '#007bff' }) => (
  <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
    <MaterialIcons name="cloud-upload" size={size} color={color} />
  </View>
);

export const OrganizeIcon = ({ size = 40, color = '#007bff' }) => (
  <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
    <MaterialIcons name="event-note" size={size} color={color} />
  </View>
);

export const CloudIcon = ({ size = 40, color = '#007bff' }) => (
  <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
    <MaterialIcons name="sync" size={size} color={color} />
  </View>
);
