import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Login } from './screens/Login/Login';
import { Dashboard } from './screens/Dashboard/Dashboard';
import { Settings } from './screens/Settings/Settings';
import { Menu } from './screens/Menu/Menu';
import { Devices } from './screens/Devices/Devices';
import { DeviceDetails } from './screens/DeviceDetails/DeviceDetails';
import { Header } from './components/Header/Header';
import { colors } from './styles/theme';

// Helper to get screen name from path
const getScreenFromPath = (pathname) => {
  if (pathname === '/' || pathname === '') return 'dashboard';
  const parts = pathname.replace(/^\//, '').split('/');
  const firstPart = parts[0];
  
  if (firstPart === 'devices' && parts.length > 1) {
    return { screen: 'deviceDetails', params: { deviceId: parts[1] } };
  }
  
  if (['dashboard', 'settings', 'menu', 'devices'].includes(firstPart)) {
    return firstPart;
  }
  return 'dashboard';
};

// Helper to get path from screen name
const getPathFromScreen = (screen, params = {}) => {
  if (screen === 'dashboard') return '/';
  if (screen === 'deviceDetails' && params.deviceId) {
    return `/devices/${params.deviceId}`;
  }
  return `/${screen}`;
};

const AppContent = () => {
  const { isAuthenticated, loading } = useAuth();
  const [currentScreen, setCurrentScreen] = useState('dashboard');
  const [previousScreen, setPreviousScreen] = useState('dashboard');
  const [screenParams, setScreenParams] = useState({});

  // Initialize screen from URL on mount and when auth changes (web only)
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      // Don't redirect while loading auth state (prevents redirect on refresh)
      if (loading) return;
      
      if (isAuthenticated) {
        const pathname = window.location.pathname;
        const screenData = getScreenFromPath(pathname);
        if (typeof screenData === 'object' && screenData.screen) {
          setCurrentScreen(screenData.screen);
          setScreenParams(screenData.params || {});
          setPreviousScreen('devices'); // Default back to devices for device details
        } else {
          setCurrentScreen(screenData);
          setScreenParams({});
          setPreviousScreen(screenData);
        }
      } else if (!loading) {
        // When logged out, ensure URL is /login
        if (window.location.pathname !== '/login') {
          window.history.replaceState({}, '', '/login');
        }
      }
    }
  }, [isAuthenticated, loading]);

  // Handle browser back/forward navigation (web only)
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const handlePopState = () => {
        const pathname = window.location.pathname;
        const screen = getScreenFromPath(pathname);
        setCurrentScreen(screen);
      };

      window.addEventListener('popstate', handlePopState);
      return () => window.removeEventListener('popstate', handlePopState);
    }
  }, []);

  const navigation = {
    navigate: (screen, params = {}) => {
      if (screen !== 'menu') {
        setPreviousScreen(currentScreen);
      }
      setCurrentScreen(screen);
      setScreenParams(params);
      
      // Update URL for web
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const path = getPathFromScreen(screen, params);
        window.history.pushState({ screen, params }, '', path);
      }
    },
    goBack: () => {
      setCurrentScreen(previousScreen);
      setScreenParams({});
      
      // Update URL for web
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const path = getPathFromScreen(previousScreen);
        window.history.pushState({ screen: previousScreen }, '', path);
      }
    },
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.textPrimary} />
      </View>
    );
  }

  const renderScreen = () => {
    if (!isAuthenticated) {
      return <Login />;
    }

    switch (currentScreen) {
      case 'settings':
        return <Settings navigation={navigation} />;
      case 'menu':
        return <Menu navigation={navigation} />;
      case 'devices':
        return <Devices navigation={navigation} />;
      case 'deviceDetails':
        return <DeviceDetails navigation={navigation} route={{ params: screenParams }} />;
      case 'dashboard':
      default:
        return <Dashboard navigation={navigation} />;
    }
  };

  return (
    <>
      <StatusBar style="dark" />
      {isAuthenticated ? (
        <View style={styles.appContainer}>
          <Header navigation={navigation} currentScreen={currentScreen} />
          <View style={styles.contentContainer}>
            {renderScreen()}
          </View>
        </View>
      ) : (
        renderScreen()
      )}
    </>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  appContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contentContainer: {
    flex: 1,
  },
});