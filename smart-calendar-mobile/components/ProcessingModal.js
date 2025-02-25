import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const STAGES = {
  uploading: {
    title: 'Uploading',
    description: 'Uploading your document...',
    icon: 'cloud-upload-outline',
    color: '#3b82f6' // blue
  },
  analyzing: {
    title: 'Analyzing',
    description: 'Analyzing document contents...',
    icon: 'search-outline',
    color: '#8b5cf6' // purple
  },
  parsing: {
    title: 'Parsing',
    description: 'Creating calendar events...',
    icon: 'calendar-outline',
    color: '#10b981' // green
  }
};

export default function ProcessingModal({ stage, progress }) {
  const [smoothProgress, setSmoothProgress] = useState(0);
  const progressAnimation = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const iconPulse = useRef(new Animated.Value(1)).current;
  
  // Start entrance animation when component mounts
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      })
    ]).start();
    
    // Start pulsing animation for icon
    Animated.loop(
      Animated.sequence([
        Animated.timing(iconPulse, {
          toValue: 1.2,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true
        }),
        Animated.timing(iconPulse, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true
        })
      ])
    ).start();
  }, []);

  // Smoothly animate progress changes
  useEffect(() => {
    Animated.timing(progressAnimation, {
      toValue: progress,
      duration: 300,
      useNativeDriver: false,
    }).start();
    
    const listener = progressAnimation.addListener(({ value }) => {
      setSmoothProgress(value);
    });
    
    return () => {
      progressAnimation.removeListener(listener);
    };
  }, [progress]);

  // Get current stage information
  const currentStage = STAGES[stage];
  
  // Determine which stages are complete
  const isUploadingComplete = stage !== 'uploading' || progress >= 33;
  const isAnalyzingComplete = stage === 'parsing' || (stage === 'analyzing' && progress >= 66);

  return (
    <View style={styles.modalOverlay}>
      <Animated.View 
        style={[
          styles.modalContainer,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }]
          }
        ]}
      >
        <Animated.View 
          style={[
            styles.iconContainer,
            { 
              backgroundColor: `${currentStage.color}20`,
              transform: [{ scale: iconPulse }]
            }
          ]}
        >
          <Ionicons name={currentStage.icon} size={40} color={currentStage.color} />
        </Animated.View>
        
        <Text style={styles.title}>{currentStage.title}</Text>
        <Text style={styles.description}>{currentStage.description}</Text>
        
        {/* Progress bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBackground}>
            <Animated.View 
              style={[
                styles.progressFill,
                { 
                  width: `${smoothProgress}%`,
                  backgroundColor: currentStage.color
                }
              ]}
            />
          </View>
          <Text style={styles.progressText}>{Math.round(smoothProgress)}%</Text>
        </View>
        
        {/* Stage indicators */}
        <View style={styles.stageContainer}>
          <View style={styles.stageTimeline}>
            <Animated.View 
              style={[
                styles.stageTimelineFill,
                { width: `${smoothProgress}%` }
              ]}
            />
          </View>
          
          <StageIndicator 
            title="Upload"
            isComplete={isUploadingComplete}
            isActive={stage === 'uploading'}
            color={STAGES.uploading.color}
          />
          
          <StageIndicator 
            title="Analyze"
            isComplete={isAnalyzingComplete}
            isActive={stage === 'analyzing'}
            color={STAGES.analyzing.color}
          />
          
          <StageIndicator 
            title="Parse"
            isComplete={false}
            isActive={stage === 'parsing'}
            color={STAGES.parsing.color}
          />
        </View>
      </Animated.View>
    </View>
  );
}

function StageIndicator({ title, isComplete, isActive, color }) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  
  useEffect(() => {
    if (isActive) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true
          })
        ])
      ).start();
    } else {
      Animated.timing(pulseAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true
      }).start();
    }
  }, [isActive]);
  
  return (
    <View style={styles.stageIndicator}>
      <Animated.View 
        style={[
          styles.stageCircle,
          {
            backgroundColor: isComplete ? color : isActive ? color : '#d1d5db',
            borderColor: isComplete || isActive ? color : '#d1d5db',
            transform: [{ scale: isActive ? pulseAnim : 1 }]
          }
        ]}
      >
        {isComplete && (
          <Ionicons name="checkmark" size={14} color="#ffffff" />
        )}
      </Animated.View>
      <Text style={[
        styles.stageText,
        {
          color: isComplete || isActive ? color : '#6b7280',
          fontWeight: isActive ? '700' : '400'
        }
      ]}>
        {title}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalContainer: {
    width: '85%',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 8,
  },
  description: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 24,
    textAlign: 'center',
  },
  progressContainer: {
    width: '100%',
    marginBottom: 24,
  },
  progressBackground: {
    height: 8,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'right',
  },
  stageContainer: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    position: 'relative',
  },
  stageTimeline: {
    position: 'absolute',
    top: 12,
    left: 24,
    right: 24,
    height: 2,
    backgroundColor: '#e5e7eb',
    zIndex: -1,
  },
  stageTimelineFill: {
    height: '100%',
    backgroundColor: '#3b82f6',
  },
  stageIndicator: {
    alignItems: 'center',
  },
  stageCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    marginBottom: 4,
    backgroundColor: '#ffffff',
  },
  stageText: {
    fontSize: 12,
    color: '#6b7280',
  },
});