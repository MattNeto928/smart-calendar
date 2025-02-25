rimport React from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, Pressable, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';

export default function UserMenu({ signOut, onClose }) {
  const { user } = useAuth();

  const handleSignOut = () => {
    onClose();
    signOut();
  };

  return (
    <Modal
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
      hardwareAccelerated={true}
      statusBarTranslucent={true}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.menuContainer}>
          <View style={styles.header}>
            <View style={styles.userInfo}>
              {user?.picture ? (
                <Image
                  source={{ uri: user.picture }}
                  style={styles.avatar}
                />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Ionicons name="person" size={20} color="#666" />
                </View>
              )}
              <View>
                <Text style={styles.userName}>{user?.name}</Text>
                <Text style={styles.userEmail}>{user?.email}</Text>
              </View>
            </View>
          </View>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={handleSignOut}
          >
            <Ionicons name="log-out-outline" size={20} color="#ef4444" />
            <Text style={[styles.menuItemText, { color: '#ef4444' }]}>
              Sign Out
            </Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'flex-start',
    zIndex: 9999,
    elevation: 9999,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  menuContainer: {
    backgroundColor: '#fff',
    marginTop: 60,
    marginHorizontal: 16,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 9999,
    zIndex: 10000,
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    backgroundColor: '#f9fafb',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userName: {
    fontSize: 16,
    fontFamily: 'Roboto-Bold',
    color: '#111827',
    marginBottom: 2,
  },
  userEmail: {
    fontSize: 14,
    color: '#6b7280',
    fontFamily: 'Roboto',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
    backgroundColor: '#fff',
  },
  menuItemText: {
    fontSize: 16,
    fontFamily: 'Roboto-Bold',
  },
});
