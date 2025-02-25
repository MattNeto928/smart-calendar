import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const getPriorityColor = (priority) => {
  switch (priority) {
    case 'high':
      return '#ef4444';  // Red
    case 'medium':
      return '#f59e0b';  // Orange
    case 'low':
      return '#10b981';  // Green
    default:
      return '#6b7280';  // Gray
  }
};

const getEventTypeColor = (type) => {
  switch (type) {
    case 'test':
      return '#dc2626';  // Red
    case 'assignment':
      return '#2563eb';  // Blue
    case 'meeting':
      return '#7c3aed';  // Purple
    case 'office_hours':
      return '#059669';  // Green
    default:
      return '#6b7280';  // Gray
  }
};

export default function EventScreen({ route, navigation }) {
  const { event } = route.params;

  console.log('EventScreen received event prop:', event); // Log event prop

  const handleEdit = () => {
    if (!navigation) {
      console.error('Navigation object is undefined in handleEdit');
      return;
    }
    navigation.navigate('EventForm', { event });
  };

  // Check if event is undefined - early return if no event
  if (!event) {
    console.log('Event prop is undefined in EventScreen'); // Log if event is undefined
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Error: Event details not found.</Text>
      </View>
    );
  }

  // Ensure event and event.priority are defined before calling getPriorityColor
  const priority = event?.priority;
  const typeColor = getEventTypeColor(event?.type);
  const priorityColor = getPriorityColor(priority);

  // Render content only if event is defined
  return event ? (
    <View style={styles.container}>
      <View style={[styles.eventCard, { borderLeftColor: typeColor, borderLeftWidth: 4 }]}>
        <View style={styles.header}>
          <View style={styles.titleContainer}>
            <Text style={styles.title}>{event.title}</Text>
            <View style={[styles.priorityBadge, { backgroundColor: priorityColor }]}>
              <Text style={styles.priorityText}>
                {priority?.charAt(0).toUpperCase() + priority?.slice(1)}
              </Text>
            </View>
          </View>
          <TouchableOpacity onPress={handleEdit} style={styles.editButton}>
            <Ionicons name="pencil" size={24} color="#007bff" />
          </TouchableOpacity>
        </View>

        <View style={styles.typeContainer}>
          <View style={[styles.typeBadge, { backgroundColor: typeColor }]}>
            <Text style={styles.typeText}>
              {event.type?.split('_').map(word =>
                word.charAt(0).toUpperCase() + word.slice(1)
              ).join(' ')}
            </Text>
          </View>
        </View>

        {(event.courseCode || event.courseTitle) && (
          <Text style={styles.courseInfo}>
            {event.courseCode}{event.courseCode && event.courseTitle ? ' - ' : ''}{event.courseTitle}
          </Text>
        )}

        <View style={styles.detailsContainer}>
          <View style={styles.detailRow}>
            <Ionicons name="calendar" size={20} color="#666" />
            <Text style={styles.detail}>{event.date}</Text>
          </View>

          {event.time && (
            <View style={styles.detailRow}>
              <Ionicons name="time" size={20} color="#666" />
              <Text style={styles.detail}>{event.time}</Text>
            </View>
          )}

          {event.location && (
            <View style={styles.detailRow}>
              <Ionicons name="location" size={20} color="#666" />
              <Text style={styles.detail}>{event.location}</Text>
            </View>
          )}
        </View>

        {event.description && (
          <View style={styles.descriptionContainer}>
            <Text style={styles.descriptionLabel}>Description</Text>
            <Text style={styles.description}>{event.description}</Text>
          </View>
        )}
      </View>
    </View>
     ) : (
      <View style={styles.container}>
        <Text style={styles.errorText}>Error: Event details not found.</Text>
      </View>
    );
  }

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f8f8f8',
  },
  errorText: {
    fontSize: 18,
    color: 'red',
    textAlign: 'center',
    marginTop: 20,
  },
  eventCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  titleContainer: {
    flex: 1,
    marginRight: 16,
  },
  title: {
    fontSize: 24,
    fontFamily: 'Roboto-Bold',
    color: '#333',
    marginBottom: 8,
  },
  editButton: {
    padding: 8,
  },
  priorityBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
  },
  priorityText: {
    color: '#fff',
    fontSize: 14,
    fontFamily: 'Roboto-Bold',
  },
  typeContainer: {
    marginBottom: 16,
  },
  typeBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  typeText: {
    color: '#fff',
    fontSize: 14,
    fontFamily: 'Roboto-Bold',
  },
  courseInfo: {
    fontSize: 18,
    color: '#666',
    marginBottom: 16,
    fontFamily: 'Roboto',
  },
  detailsContainer: {
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  detail: {
    fontSize: 16,
    color: '#444',
    marginLeft: 8,
    fontFamily: 'Roboto',
  },
  descriptionContainer: {
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 16,
  },
  descriptionLabel: {
    fontSize: 16,
    fontFamily: 'Roboto-Bold',
    color: '#666',
    marginBottom: 8,
  },
  description: {
    fontSize: 16,
    color: '#444',
    fontFamily: 'Roboto',
    lineHeight: 24,
  },
});
