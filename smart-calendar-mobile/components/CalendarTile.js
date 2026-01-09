import React, { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Easing } from 'react-native';

const getEventColor = (type, priority) => {
  const baseColors = {
    test: {
      bg: '#fef2f2',
      text: '#991b1b',
      accent: '#ef4444'
    },
    assignment: {
      bg: '#eff6ff',
      text: '#1e40af',
      accent: '#3b82f6'
    },
    meeting: {
      bg: '#f0fdf4',
      text: '#166534',
      accent: '#22c55e'
    },
    office_hours: {
      bg: '#faf5ff',
      text: '#6b21a8',
      accent: '#a855f7'
    }
  };

  const priorityColors = {
    high: '#dc2626',
    medium: '#eab308',
    low: '#22c55e'
  };

  return {
    ...(baseColors[type] || baseColors.assignment),
    priority: priority ? priorityColors[priority] : null
  };
};

export default function CalendarTile({ day, events, onPress, isSelected, selectionOpacity, currentMonth }) {
  // Check if the provided day is today
  // We use toDateString() comparison which ignores time components
  const isToday = day && new Date().toDateString() === day.toDateString();
  const fadeAnim = useRef(new Animated.Value(1)).current;
  
  // Debug logging for calendar tiles with events
  useEffect(() => {
    if (day && events && events.length > 0) {
      const dateStr = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
      console.log(`CalendarTile: ${dateStr} has ${events.length} events`);
    }
  }, [day, events]);

  useEffect(() => {
    if (currentMonth) {
      fadeAnim.setValue(0);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
        delay: 50
      }).start();
    }
  }, [currentMonth?.getMonth()]);

  return (
    <Animated.View 
      style={[
        { opacity: fadeAnim }, 
        styles.tileWrapper
      ]}
    >
      <View style={styles.tileContainer}>
        <TouchableOpacity
          style={[
            styles.tile,
            isToday && !isSelected && styles.todayTile,
            isToday && !isSelected && { borderColor: '#3498db', borderWidth: 2 },
            !day && styles.emptyTile
          ]}
          onPress={onPress}
          activeOpacity={0.8}
        >
          {/* Selection overlay rendered inside the tile */}
          {isSelected && (
            <Animated.View 
              style={[
                styles.selectionOverlay,
                isToday && styles.todaySelectionOverlay,
                { opacity: selectionOpacity }
              ]} 
            />
          )}
          
          <View style={styles.content}>
            {day && (
              <>
                <Text style={[
                  styles.dayText, 
                  isToday && !isSelected && styles.todayText,
                  isToday && isSelected && styles.selectedTodayText
                ]}>
                  {day.getDate()}
                </Text>
                <View style={styles.eventsContainer}>
                  {events.length > 0 ? (
                    events.length <= 2 ? (
                      // Display up to 2 events with titles
                      events.slice(0, 2).map((event, index) => {
                        const colors = getEventColor(event.type, event.priority);
                        return (
                          <View 
                            key={index}
                            style={[
                              styles.eventItem,
                              {
                                backgroundColor: colors.bg,
                                borderLeftWidth: 2,
                                borderLeftColor: colors.accent
                              },
                              event.priority && {
                                borderRightWidth: 2,
                                borderRightColor: colors.priority
                              }
                            ]}
                          >
                            <Text 
                              style={[
                                styles.eventText,
                                { color: colors.text }
                              ]}
                              numberOfLines={1}
                              ellipsizeMode="tail"
                            >
                              {event.title}
                            </Text>
                          </View>
                        );
                      })
                    ) : (
                      // When more than 2 events, show one event and a counter
                      <>
                        <View 
                          style={[
                            styles.eventItem,
                            {
                              backgroundColor: getEventColor(events[0].type, events[0].priority).bg,
                              borderLeftWidth: 2,
                              borderLeftColor: getEventColor(events[0].type, events[0].priority).accent
                            },
                            events[0].priority && {
                              borderRightWidth: 2,
                              borderRightColor: getEventColor(events[0].type, events[0].priority).priority
                            }
                          ]}
                        >
                          <Text 
                            style={[
                              styles.eventText,
                              { color: getEventColor(events[0].type, events[0].priority).text }
                            ]}
                            numberOfLines={1}
                            ellipsizeMode="tail"
                          >
                            {events[0].title}
                          </Text>
                        </View>
                        <View style={styles.eventCountContainer}>
                          <Text style={styles.eventCountText}>+{events.length - 1} more</Text>
                        </View>
                      </>
                    )
                  ) : null}
                </View>
              </>
            )}
          </View>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  tileWrapper: {
    width: '14.28%',
    aspectRatio: 0.85,
    marginBottom: 4,
  },
  tileContainer: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  tile: {
    width: '100%',
    height: '100%',
    borderWidth: 1,
    borderColor: '#f3f4f6',
    backgroundColor: '#fff',
    borderRadius: 10,
    margin: 0,
    padding: 0,
    overflow: 'hidden',
    position: 'relative',
  },
  selectionOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(52, 152, 219, 0.15)',
    borderWidth: 2,
    borderColor: '#3498db',
    borderRadius: 9,
    zIndex: 0,
  },
  todaySelectionOverlay: {
    backgroundColor: 'rgba(52, 152, 219, 0.25)',
    borderWidth: 3,
    borderColor: '#2563eb',
    shadowColor: '#3498db',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
  },
  content: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    padding: 4,
    justifyContent: 'flex-start',
    zIndex: 1,
    backgroundColor: 'transparent',
  },
  emptyTile: {
    backgroundColor: '#f9fafb',
    borderColor: '#f3f4f6',
  },
  todayTile: {
    backgroundColor: '#fff',
    // When not selected, we want a border
    // Border styling is handled by the selection overlay when selected
  },
  dayText: {
    fontSize: 12,
    fontFamily: 'Roboto-Bold',
    color: '#374151',
    marginBottom: 2,
    textAlign: 'center',
  },
  todayText: {
    color: '#3498db',
    fontWeight: 'bold',
  },
  // Explicit style to ensure text remains consistent when selected
  selectedTodayText: {
    color: '#3498db',
    fontWeight: 'bold',
  },
  eventsContainer: {
    marginTop: 2,
    gap: 2,
    height: '80%',
    overflow: 'hidden',
  },
  eventItem: {
    borderRadius: 3,
    paddingHorizontal: 2,
    paddingVertical: 1,
    minHeight: 14,
    maxHeight: 15,
    justifyContent: 'center',
  },
  eventText: {
    fontSize: 8,
    fontFamily: 'Roboto',
    textAlign: 'left',
    marginLeft: 2,
  },
  eventCountContainer: {
    minHeight: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 3,
    marginTop: 2,
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.2)',
    paddingVertical: 1,
  },
  eventCountText: {
    fontSize: 8,
    color: '#3b82f6',
    fontFamily: 'Roboto-Bold',
    textAlign: 'center',
  },
});