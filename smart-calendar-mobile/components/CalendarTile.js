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
  const isToday = day && new Date().toDateString() === day.toDateString();
  const fadeAnim = useRef(new Animated.Value(1)).current;

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
    <Animated.View style={[{ opacity: fadeAnim }, styles.tileWrapper]}>
      <TouchableOpacity
        style={[
          styles.tile,
          isToday && styles.todayTile,
          !day && styles.emptyTile,
          isSelected && styles.selectedTile
        ]}
        onPress={onPress}
        activeOpacity={0.8}
      >
        {isSelected && (
          <Animated.View 
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor: '#e0f2fe',
                opacity: selectionOpacity,
                borderRadius: 8,
                borderWidth: 2,
                borderColor: '#3b82f6',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                pointerEvents: 'none'
              }
            ]} 
          />
        )}
        <View style={styles.content}>
          {day && (
            <>
              <Text style={[styles.dayText, isToday && styles.todayText]}>
                {day.getDate()}
              </Text>
              <View style={styles.eventsContainer}>
                {events.slice(0, 2).map((event, index) => {
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
                      >
                        {event.title}
                      </Text>
                    </View>
                  );
                })}
                {events.length > 2 && (
                  <View style={styles.moreContainer}>
                    <Text style={styles.moreText}>+{events.length - 2}</Text>
                  </View>
                )}
              </View>
            </>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  tileWrapper: {
    width: '14.28%',
    aspectRatio: 0.75, // Make tiles even taller
  },
  tile: {
    height: '100%',
    borderWidth: 1,
    borderColor: '#f3f4f6',
    backgroundColor: '#fff',
    borderRadius: 8,
    margin: 1,
  },
  content: {
    height: '100%',
    padding: 4,
    justifyContent: 'flex-start',
  },
  emptyTile: {
    backgroundColor: '#f9fafb',
    borderColor: '#f3f4f6',
  },
  todayTile: {
    backgroundColor: '#fff',
    borderColor: '#3b82f6',
    borderWidth: 2,
  },
  selectedTile: {
    overflow: 'hidden',
  },
  dayText: {
    fontSize: 13,
    fontFamily: 'Roboto-Bold',
    color: '#374151',
    marginBottom: 2,
    textAlign: 'center',
  },
  todayText: {
    color: '#3b82f6',
  },
  eventsContainer: {
    marginTop: 1,
    gap: 1,
  },
  eventItem: {
    borderRadius: 4,
    paddingHorizontal: 3,
    paddingVertical: 1,
    minHeight: 16,
    justifyContent: 'center',
  },
  eventText: {
    fontSize: 10,
    fontFamily: 'Roboto',
    textAlign: 'center',
  },
  moreContainer: {
    minHeight: 14,
    justifyContent: 'center',
    paddingTop: 1,
  },
  moreText: {
    fontSize: 10,
    color: '#6b7280',
    fontFamily: 'Roboto',
    textAlign: 'center',
  },
});
