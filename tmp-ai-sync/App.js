import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ProjectProvider } from './contexts/ProjectContext';
import { Login } from './screens/Login/Login';
import { Dashboard } from './screens/Dashboard/Dashboard';
import { Settings } from './screens/Settings/Settings';
import { Menu } from './screens/Menu/Menu';
import { Devices } from './screens/Devices/Devices';
import { DeviceDetails } from './screens/DeviceDetails/DeviceDetails';
import { KeyManager } from './screens/KeyManager/KeyManager';
import { KeysList } from './screens/KeyManager/KeysList';
import { KeyDetails } from './screens/KeyManager/KeyDetails';
import { CreateKey } from './screens/KeyManager/CreateKey';
import { ServiceSecretsList } from './screens/KeyManager/ServiceSecretsList';
import { CreateServiceSecret } from './screens/KeyManager/CreateServiceSecret';
import { ServiceSecretDetails } from './screens/KeyManager/ServiceSecretDetails';
import { StorageManager } from './screens/StorageManager/StorageManager';
import { ProjectsList } from './screens/StorageManager/ProjectsList';
import { BucketsList } from './screens/StorageManager/BucketsList';
import { BucketDetails } from './screens/StorageManager/BucketDetails';
import { BucketConfig } from './screens/StorageManager/BucketConfig';
import { FileDetails } from './screens/StorageManager/FileDetails';
import { Projects } from './screens/Projects/Projects';
import { ProjectDetails } from './screens/ProjectDetails/ProjectDetails';
import { ProjectForm } from './screens/ProjectForm/ProjectForm';
import { DatabaseManager } from './screens/DatabaseManager/DatabaseManager';
import { DatabasesList } from './screens/DatabaseManager/DatabasesList';
import { DatabaseDetails } from './screens/DatabaseManager/DatabaseDetails';
import { CreateDatabase } from './screens/DatabaseManager/CreateDatabase';
import { ManagerConsole } from './screens/ManagerConsole/ManagerConsole';
import { AIManager } from './screens/AIManager/AIManager';
import { AiProviderForm } from './screens/AIManager/AiProviderForm';
import { AiModelDetails } from './screens/AIManager/AiModelDetails';
import { AiDeploymentDetails } from './screens/AIManager/AiDeploymentDetails';
import { ApiGatewayManager } from './screens/ApiGatewayManager/ApiGatewayManager';
import { ComputeManager } from './screens/ComputeManager/ComputeManager';
import { getServiceMeta } from './services/serviceCatalog';
import { RunTask } from './screens/ComputeManager/RunTask';
import { TaskDetails } from './screens/ComputeManager/TaskDetails';
import { AuthManager } from './screens/AuthManager/AuthManager';
import { ProviderForm } from './screens/AuthManager/ProviderForm';
import { Header } from './components/Header/Header';
import { colors } from './styles/theme';

// Helper to get screen name from path
const getScreenFromPath = (pathname) => {
  // Dashboard (home) shows current project details
  if (pathname === '/' || pathname === '') return 'dashboard';
  const parts = pathname.replace(/^\//, '').split('/');
  const firstPart = parts[0];
  
  if (firstPart === 'devices' && parts.length > 1) {
    return { screen: 'deviceDetails', params: { deviceId: parts[1] } };
  }
  
  // Generic per-manager consoles. The bare catalog now lives on the Console
  // Home (dashboard), so /services with no manager name redirects there.
  if (firstPart === 'services') {
    if (parts.length > 1 && parts[1]) {
      const serviceName = parts[1].replace(/\/$/, '');
      // Explicit bespoke consoles (catalog route is the source of truth; keep fallbacks)
      if (serviceName === 'ai_manager') {
        return { screen: 'aiManager', params: {} };
      }
      const meta = getServiceMeta(serviceName);
      if (meta?.route) {
        return { screen: meta.route, params: {} };
      }
      return { screen: 'managerConsole', params: { serviceName } };
    }
    return 'dashboard';
  }

  // Container Hosting (compute_manager)
  if (firstPart === 'compute-manager') {
    if (parts[1] === 'run') {
      return 'runTask';
    }
    if (parts[1] === 'tasks' && parts.length > 2) {
      return { screen: 'taskDetails', params: { taskId: parts[2] } };
    }
    return 'computeManager';
  }

  // Authentication (auth_manager)
  if (firstPart === 'auth-manager') {
    if (parts[1] === 'providers' && parts[2] === 'new') {
      return 'providerForm';
    }
    if (parts[1] === 'providers' && parts.length > 2) {
      return { screen: 'providerForm', params: { providerId: parts[2] } };
    }
    return 'authManager';
  }

  if (firstPart === 'ai-manager') {
    if (parts[1] === 'models' && parts.length > 2) {
      return { screen: 'aiModelDetails', params: { modelName: decodeURIComponent(parts.slice(2).join('/')) } };
    }
    if (parts[1] === 'deployment' || parts[1] === 'deployments') {
      return 'aiDeploymentDetails';
    }
    if (parts[1] === 'providers' && parts[2] === 'new') {
      return 'aiProviderForm';
    }
    if (parts[1] === 'providers' && parts.length > 2) {
      return { screen: 'aiProviderForm', params: { providerId: parts[2] } };
    }
    return 'aiManager';
  }

  if (firstPart === 'api-gateway-manager') {
    return 'apiGatewayManager';
  }

  if (firstPart === 'key-manager' && parts.length > 1) {
    if (parts[1] === 'secrets' && parts[2] === 'create') {
      return 'createServiceSecret';
    }
    if (parts[1] === 'secrets' && parts.length > 2) {
      return { screen: 'serviceSecretDetails', params: { secretId: parts[2] } };
    }
    if (parts[1] === 'secrets') {
      return 'serviceSecretsList';
    }
    if (parts[1] === 'keys' && parts.length > 2) {
      return { screen: 'keyDetails', params: { keyName: parts[2] } };
    }
    if (parts[1] === 'keys') {
      return 'keysList';
    }
    if (parts[1] === 'create') {
      return 'createKey';
    }
    return 'keyManager';
  }
  
  if (firstPart === 'db-manager' && parts.length > 1) {
    if (parts[1] === 'databases' && parts.length > 2) {
      return { screen: 'databaseDetails', params: { databaseName: parts[2] } };
    }
    if (parts[1] === 'databases') {
      return 'databasesList';
    }
    if (parts[1] === 'create') {
      return 'createDatabase';
    }
    return 'databaseManager';
  }
  
  if (firstPart === 'storage-manager' && parts.length > 1) {
    if (parts[1] === 'projects') {
      return 'projectsList';
    }
    if (parts[1] === 'buckets' && parts.length > 3 && parts[3] === 'config') {
      // /storage-manager/buckets/{bucketName}/config
      const projectId = typeof window !== 'undefined' && window.location?.search
        ? new URLSearchParams(window.location.search).get('projectId')
        : null;
      return { screen: 'bucketConfig', params: { bucketName: parts[2], projectId } };
    }
    if (parts[1] === 'buckets' && parts.length > 3 && parts[2] === 'files') {
      // /storage-manager/buckets/{bucketName}/files/{key}
      return { screen: 'fileDetails', params: { bucketName: parts[2], key: decodeURIComponent(parts.slice(3).join('/')) } };
    }
    if (parts[1] === 'buckets' && parts.length > 2) {
      // /storage-manager/buckets/{bucketName}
      const projectId = typeof window !== 'undefined' && window.location?.search
        ? new URLSearchParams(window.location.search).get('projectId')
        : null;
      return { screen: 'bucketDetails', params: { bucketName: parts[2], projectId } };
    }
    if (parts[1] === 'buckets') {
      // Extract projectId from query params if available
      const projectId = typeof window !== 'undefined' && window.location?.search
        ? new URLSearchParams(window.location.search).get('projectId')
        : null;
      return { screen: 'bucketsList', params: projectId ? { projectId } : {} };
    }
    return 'storageManager';
  }
  
  if (firstPart === 'projects' && parts.length > 1) {
    if (parts[1] === 'new' || parts[1] === 'create') {
      return { screen: 'projectForm', params: { mode: 'create' } };
    }
    if (parts[1] === 'edit' && parts.length > 2) {
      return { screen: 'projectForm', params: { mode: 'edit', projectId: parts[2] } };
    }
    return { screen: 'projectDetails', params: { projectId: parts[1] } };
  }
  
  if (firstPart === 'compute-manager') {
    return 'computeManager';
  }

  if (firstPart === 'auth-manager') {
    return 'authManager';
  }

  if (['dashboard', 'settings', 'menu', 'devices', 'key-manager', 'storage-manager', 'db-manager', 'projects'].includes(firstPart)) {
    return firstPart;
  }
  return 'dashboard';
};

// Helper to get path from screen name
const getPathFromScreen = (screen, params = {}) => {
  if (screen === 'dashboard') return '/';
  if (screen === 'servicesConsole') return '/';
  if (screen === 'managerConsole' && params.serviceName) {
    return `/services/${params.serviceName}`;
  }
  if (screen === 'computeManager') return '/compute-manager';
  if (screen === 'runTask') return '/compute-manager/run';
  if (screen === 'taskDetails' && params.taskId) {
    return `/compute-manager/tasks/${params.taskId}`;
  }
  if (screen === 'authManager') return '/auth-manager';
  if (screen === 'aiManager') return '/services/ai_manager';
  if (screen === 'aiDeploymentDetails') return '/ai-manager/deployments';
  if (screen === 'aiModelDetails' && params.modelName) {
    return `/ai-manager/models/${encodeURIComponent(params.modelName)}`;
  }
  if (screen === 'apiGatewayManager') return '/api-gateway-manager';
  if (screen === 'aiProviderForm' && params.providerId) {
    return `/ai-manager/providers/${params.providerId}`;
  }
  if (screen === 'aiProviderForm') return '/ai-manager/providers/new';
  if (screen === 'providerForm' && params.providerId) {
    return `/auth-manager/providers/${params.providerId}`;
  }
  if (screen === 'providerForm') return '/auth-manager/providers/new';
  if (screen === 'deviceDetails' && params.deviceId) {
    return `/devices/${params.deviceId}`;
  }
  if (screen === 'keyDetails' && params.keyName) {
    return `/key-manager/keys/${params.keyName}`;
  }
  if (screen === 'keysList') {
    return '/key-manager/keys';
  }
  if (screen === 'createKey') {
    return '/key-manager/create';
  }
  if (screen === 'serviceSecretsList') {
    return '/key-manager/secrets';
  }
  if (screen === 'createServiceSecret') {
    return '/key-manager/secrets/create';
  }
  if (screen === 'serviceSecretDetails' && params.secretId) {
    return `/key-manager/secrets/${params.secretId}`;
  }
  if (screen === 'keyManager') {
    return '/key-manager';
  }
  if (screen === 'databaseManager') {
    return '/db-manager';
  }
  if (screen === 'databasesList') {
    return '/db-manager/databases';
  }
  if (screen === 'databaseDetails' && params.databaseName) {
    return `/db-manager/databases/${params.databaseName}`;
  }
  if (screen === 'createDatabase') {
    return '/db-manager/create';
  }
  if (screen === 'storageManager') {
    return '/storage-manager';
  }
  if (screen === 'projectsList') {
    return '/storage-manager/projects';
  }
  if (screen === 'bucketDetails' && params.bucketName) {
    const projectId = params.projectId ? `?projectId=${params.projectId}` : '';
    return `/storage-manager/buckets/${params.bucketName}${projectId}`;
  }
  if (screen === 'bucketConfig' && params.bucketName) {
    const projectId = params.projectId ? `?projectId=${params.projectId}` : '';
    return `/storage-manager/buckets/${params.bucketName}/config${projectId}`;
  }
  if (screen === 'fileDetails' && params.bucketName && params.key) {
    const projectId = params.projectId ? `?projectId=${params.projectId}` : '';
    return `/storage-manager/buckets/${params.bucketName}/files/${encodeURIComponent(params.key)}${projectId}`;
  }
  if (screen === 'bucketsList' && params.projectId) {
    return `/storage-manager/buckets?projectId=${params.projectId}`;
  }
  if (screen === 'bucketsList') {
    return '/storage-manager/buckets';
  }
  if (screen === 'projectForm') {
    if (params.mode === 'create') {
      return '/projects/new';
    }
    if (params.mode === 'edit' && params.projectId) {
      return `/projects/edit/${params.projectId}`;
    }
  }
  if (screen === 'projectDetails' && params.projectId) {
    return `/projects/${params.projectId}`;
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
        const screenData = getScreenFromPath(pathname);
        if (typeof screenData === 'object' && screenData.screen) {
          setCurrentScreen(screenData.screen);
          setScreenParams(screenData.params || {});
        } else {
          setCurrentScreen(screenData);
          setScreenParams({});
        }
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
      case 'keyManager':
        return <KeyManager navigation={navigation} />;
      case 'keysList':
        return <KeysList navigation={navigation} />;
      case 'keyDetails':
        return <KeyDetails navigation={navigation} route={{ params: screenParams }} />;
      case 'createKey':
        return <CreateKey navigation={navigation} />;
      case 'serviceSecretsList':
        return <ServiceSecretsList navigation={navigation} />;
      case 'createServiceSecret':
        return <CreateServiceSecret navigation={navigation} />;
      case 'serviceSecretDetails':
        return <ServiceSecretDetails navigation={navigation} route={{ params: screenParams }} />;
      case 'storageManager':
        return <StorageManager navigation={navigation} />;
      case 'projectsList':
        return <ProjectsList navigation={navigation} />;
      case 'bucketsList':
        return <BucketsList navigation={navigation} route={{ params: screenParams }} />;
          case 'bucketDetails':
            return <BucketDetails navigation={navigation} route={{ params: screenParams }} />;
          case 'bucketConfig':
            return <BucketConfig navigation={navigation} route={{ params: screenParams }} />;
          case 'fileDetails':
            return <FileDetails navigation={navigation} route={{ params: screenParams }} />;
      case 'projects':
        return <Projects navigation={navigation} />;
      case 'projectDetails':
        return <ProjectDetails navigation={navigation} route={{ params: screenParams }} />;
      case 'projectForm':
        return <ProjectForm navigation={navigation} route={{ params: screenParams }} />;
      case 'databaseManager':
        return <DatabaseManager navigation={navigation} />;
      case 'databasesList':
        return <DatabasesList navigation={navigation} />;
      case 'databaseDetails':
        return <DatabaseDetails navigation={navigation} route={{ params: screenParams }} />;
      case 'createDatabase':
        return <CreateDatabase navigation={navigation} />;
      case 'servicesConsole':
        // Catalog merged into Console Home; keep the case so any lingering
        // navigate('servicesConsole') / old deep links land on the home.
        return <Dashboard navigation={navigation} />;
      case 'managerConsole':
        return <ManagerConsole navigation={navigation} route={{ params: screenParams }} />;
      case 'aiManager':
        return <AIManager navigation={navigation} />;
      case 'aiProviderForm':
        return <AiProviderForm navigation={navigation} route={{ params: screenParams }} />;
      case 'aiModelDetails':
        return <AiModelDetails navigation={navigation} route={{ params: screenParams }} />;
      case 'aiDeploymentDetails':
        return <AiDeploymentDetails navigation={navigation} />;
      case 'apiGatewayManager':
        return <ApiGatewayManager navigation={navigation} />;
      case 'computeManager':
        return <ComputeManager navigation={navigation} />;
      case 'runTask':
        return <RunTask navigation={navigation} />;
      case 'taskDetails':
        return <TaskDetails navigation={navigation} route={{ params: screenParams }} />;
      case 'authManager':
        return <AuthManager navigation={navigation} />;
      case 'providerForm':
        return <ProviderForm navigation={navigation} route={{ params: screenParams }} />;
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
      <ProjectProvider>
        <AppContent />
      </ProjectProvider>
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