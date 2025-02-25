import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image } from 'react-native';
// Use Expo's LinearGradient instead of react-native-linear-gradient
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../contexts/AuthContext';
import { GoogleIcon } from '../components/GoogleIcon';
import { UploadIcon, OrganizeIcon, CloudIcon } from '../components/FeatureIcons';

export default function AuthScreen() {
  const { signIn } = useAuth();
  const currentYear = new Date().getFullYear();

  const FeatureCard = ({ title, description, Icon }) => (
    <View style={styles.featureCard}>
      <Icon size={40} color="#007bff" />
      <Text style={styles.featureTitle}>{title}</Text>
      <Text style={styles.featureDescription}>{description}</Text>
    </View>
  );

  return (
    <LinearGradient
      colors={['#f8f9fa', '#ffffff']}
      style={styles.container}
    >
      <ScrollView>
        {/* Header */}
        <View style={styles.header}>
          <Image 
            source={require('../assets/easy_cals_icon.png')} 
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.brandName}>EasyCals</Text>
        </View>

      {/* Hero Section */}
      <View style={styles.heroSection}>
        <Text style={styles.mainTitle}>
          Your Academic Life, <Text style={styles.highlight}>Organized</Text>
        </Text>
        <Text style={styles.subtitle}>
          Transform your syllabi and course documents into a beautifully organized calendar with AI-powered parsing.
        </Text>
        <TouchableOpacity style={styles.mainButton} onPress={signIn}>
          <Text style={styles.mainButtonText}>Get Started Free</Text>
        </TouchableOpacity>
      </View>

        {/* Features Section */}
        <View style={styles.featuresSection}>
          <FeatureCard
            title="Easy Document Upload"
            description="Simply upload your syllabus or course documents. Our AI will automatically extract all important dates and events."
            Icon={UploadIcon}
          />
          <FeatureCard
            title="Smart Organization"
            description="Events are automatically categorized and color-coded for easy reference."
            Icon={OrganizeIcon}
          />
          <FeatureCard
            title="Cloud Sync"
            description="Your calendar automatically syncs across devices. Never miss an important deadline."
            Icon={CloudIcon}
          />
        </View>

        {/* CTA Section */}
        <View style={styles.ctaSection}>
          <Text style={styles.ctaTitle}>Ready to Get Organized?</Text>
          <TouchableOpacity style={styles.signInButton} onPress={signIn}>
            <View style={styles.signInButtonContent}>
              <GoogleIcon size={24} />
              <Text style={styles.signInButtonText}>Sign in with Google</Text>
            </View>
          </TouchableOpacity>
          <Text style={styles.freeText}>Free for students. No credit card required.</Text>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.copyright}>© {currentYear} EasyCal. All rights reserved.</Text>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  logo: {
    width: 30,
    height: 30,
  },
  brandName: {
    fontSize: 24,
    fontFamily: 'Roboto-Bold',
    marginLeft: 10,
    color: '#333',
  },
  heroSection: {
    padding: 20,
    paddingTop: 40,
    alignItems: 'center',
  },
  mainTitle: {
    fontSize: 36,
    fontFamily: 'Roboto-Bold',
    textAlign: 'center',
    color: '#333',
    marginBottom: 15,
  },
  highlight: {
    color: '#007bff',
  },
  subtitle: {
    fontSize: 18,
    textAlign: 'center',
    color: '#666',
    marginBottom: 30,
    lineHeight: 24,
  },
  mainButton: {
    backgroundColor: '#007bff',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 25,
    width: '100%',
  },
  mainButtonText: {
    color: '#fff',
    fontSize: 20,
    fontFamily: 'Roboto-Bold',
    textAlign: 'center',
  },
  featuresSection: {
    padding: 20,
    backgroundColor: '#f8f9fa',
  },
  featureCard: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 20,
    marginBottom: 15,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  featureIcon: {
    width: 40,
    height: 40,
    marginBottom: 10,
  },
  featureTitle: {
    fontSize: 20,
    fontFamily: 'Roboto-Bold',
    color: '#333',
    marginBottom: 8,
  },
  featureDescription: {
    fontSize: 16,
    color: '#666',
    lineHeight: 22,
  },
  ctaSection: {
    padding: 20,
    alignItems: 'center',
  },
  ctaTitle: {
    fontSize: 24,
    fontFamily: 'Roboto-Bold',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  signInButton: {
    backgroundColor: '#007bff',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 25,
    width: '100%',
    marginBottom: 10,
  },
  signInButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  signInButtonText: {
    color: '#fff',
    fontSize: 18,
    fontFamily: 'Roboto-Bold',
  },
  freeText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  footer: {
    padding: 20,
    backgroundColor: '#f8f9fa',
    alignItems: 'center',
  },
  copyright: {
    fontSize: 14,
    color: '#666',
  },
});
