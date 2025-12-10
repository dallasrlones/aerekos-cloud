import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Login } from './screens/Login/Login';
import { Dashboard } from './screens/Dashboard/Dashboard';
import { Settings } from './screens/Settings/Settings';
import { Menu } from './screens/Menu/Menu';
import { Header } from './components/Header/Header';
import { colors } from './styles/theme';

// Helper to get screen name from path
const getScreenFromPath = (pathname) => {
  if (pathname === '/' || pathname === '') return 'dashboard';
  const path = pathname.replace(/^\//, '').split('/')[0];
  if (['dashboard', 'settings', 'menu'].includes(path)) {
    return path;
  }
  return 'dashboard';
};

// Helper to get path from screen name
const getPathFromScreen = (screen) => {
  if (screen === 'dashboard') return '/';
  return `/${screen}`;
};

const AppContent = () => {
  const { isAuthenticated, loading } = useAuth();
  const [currentScreen, setCurrentScreen] = useState('dashboard');
  const [previousScreen, setPreviousScreen] = useState('dashboard');

  // Initialize screen from URL on mount and when auth changes (web only)
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (isAuthenticated) {
        const pathname = window.location.pathname;
        const screen = getScreenFromPath(pathname);
        setCurrentScreen(screen);
        setPreviousScreen(screen);
      } else {
        // When logged out, ensure URL is /login
        if (window.location.pathname !== '/login') {
          window.history.replaceState({}, '', '/login');
        }
      }
    }
  }, [isAuthenticated]);

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
    navigate: (screen) => {
      if (screen !== 'menu') {
        setPreviousScreen(currentScreen);
      }
      setCurrentScreen(screen);
      
      // Update URL for web
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const path = getPathFromScreen(screen);
        window.history.pushState({ screen }, '', path);
      }
    },
    goBack: () => {
      setCurrentScreen(previousScreen);
      
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
