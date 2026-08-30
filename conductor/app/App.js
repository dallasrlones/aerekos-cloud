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
import { IntelligenceForm } from './screens/AIManager/IntelligenceForm';
import { RagCollectionForm } from './screens/AIManager/RagCollectionForm';
import { AiModelDetails } from './screens/AIManager/AiModelDetails';
import { AiDeploymentDetails } from './screens/AIManager/AiDeploymentDetails';
import { ApiGatewayManager } from './screens/ApiGatewayManager/ApiGatewayManager';
import { ComputeManager } from './screens/ComputeManager/ComputeManager';
import { CicdManager } from './screens/CicdManager/CicdManager';
import { OpsTimeline } from './screens/OpsTimeline/OpsTimeline';
import { getServiceMeta } from './services/serviceCatalog';
import { LaunchContainer } from './screens/ComputeManager/LaunchContainer';
import { ContainerDetails } from './screens/ComputeManager/ContainerDetails';
import { AuthManager } from './screens/AuthManager/AuthManager';
import { ProviderForm } from './screens/AuthManager/ProviderForm';
import { EdgeManager } from './screens/EdgeManager/EdgeManager';
import { QueueManager } from './screens/QueueManager/QueueManager';
import { DownloadManager } from './screens/DownloadManager/DownloadManager';
import { FunctionManager } from './screens/FunctionManager/FunctionManager';
import { WebhookManager } from './screens/WebhookManager/WebhookManager';
import { GitManager } from './screens/GitManager/GitManager';
import { RegistryManager } from './screens/RegistryManager/RegistryManager';
import { Header } from './components/Header/Header';
import { ToastProvider } from './components/Toast/ToastProvider';
import { JobProvider, JobStatus } from './components/JobStatus/JobStatus';
import { FleetAlertProvider } from './components/FleetAlert/FleetAlertListener';
import { BottomTabs } from './components/BottomTabs/BottomTabs';
import { useBreakpoint } from './hooks/useBreakpoint';
import { colors } from './styles/theme';

/** Prefer a catalog screen (e.g. aiManager) over the generic ManagerConsole. */
const resolveNavigation = (screen, params = {}) => {
  if (screen === 'managerConsole' && params.serviceName) {
    const serviceName = String(params.serviceName).replace(/\/$/, '');
    if (serviceName === 'ai_manager') return { screen: 'aiManager', params: {} };
    const meta = getServiceMeta(serviceName);
    if (meta?.route) return { screen: meta.route, params: {} };
  }
  return { screen, params };
};

const applyPathname = (pathname, search = '') => {
  const screenData = getScreenFromPath(pathname);
  let screen;
  let params;
  if (typeof screenData === 'object' && screenData.screen) {
    screen = screenData.screen;
    params = { ...(screenData.params || {}) };
  } else {
    screen = screenData;
    params = {};
  }
  if (search && screen === 'aiProviderForm' && !params.providerId) {
    const q = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
    const cap = q.get('capability');
    const prov = q.get('provider');
    if (cap) params.capability = cap;
    if (prov) params.provider = prov;
  }
  return { screen, params };
};

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
    if (parts[1] === 'run' || parts[1] === 'launch') {
      return 'launchContainer';
    }
    if ((parts[1] === 'tasks' || parts[1] === 'containers') && parts.length > 2) {
      return { screen: 'containerDetails', params: { containerId: parts[2], taskId: parts[2] } };
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
    if (parts[1] === 'intelligence' && parts[2] === 'new') {
      return 'aiIntelligenceForm';
    }
    if (parts[1] === 'intelligence' && parts.length > 2) {
      return { screen: 'aiIntelligenceForm', params: { intelligenceId: parts[2] } };
    }
    if (parts[1] === 'rag' && parts[2] === 'new') {
      return 'aiRagForm';
    }
    if (parts[1] === 'rag' && parts.length > 2) {
      return { screen: 'aiRagForm', params: { ragId: parts[2] } };
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

  if (firstPart === 'edge-manager') return 'edgeManager';
  if (firstPart === 'queue-manager') return 'queueManager';
  if (firstPart === 'webhook-manager') return 'webhookManager';
  if (firstPart === 'git-manager') return 'gitManager';
  if (firstPart === 'cicd-manager') return 'cicdManager';
  if (firstPart === 'ops' || firstPart === 'whats-broken') return 'opsTimeline';
  if (firstPart === 'registry-manager') return 'registryManager';

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
  if (screen === 'launchContainer' || screen === 'runTask') return '/compute-manager/launch';
  if ((screen === 'containerDetails' || screen === 'taskDetails') && (params.containerId || params.taskId)) {
    return `/compute-manager/containers/${params.containerId || params.taskId}`;
  }
  if (screen === 'authManager') return '/auth-manager';
  if (screen === 'aiManager') return '/services/ai_manager';
  if (screen === 'aiDeploymentDetails') return '/ai-manager/deployments';
  if (screen === 'aiModelDetails' && params.modelName) {
    return `/ai-manager/models/${encodeURIComponent(params.modelName)}`;
  }
  if (screen === 'apiGatewayManager') return '/api-gateway-manager';
  if (screen === 'edgeManager') return '/edge-manager';
  if (screen === 'queueManager') return '/queue-manager';
  if (screen === 'downloadManager') return '/services/download_manager';
  if (screen === 'functionManager') return '/services/function_manager';
  if (screen === 'webhookManager') return '/webhook-manager';
  if (screen === 'gitManager') return '/git-manager';
  if (screen === 'cicdManager') return '/cicd-manager';
  if (screen === 'opsTimeline') return '/ops';
  if (screen === 'registryManager') return '/registry-manager';
  if (screen === 'aiProviderForm' && params.providerId) {
    return `/ai-manager/providers/${params.providerId}`;
  }
  if (screen === 'aiProviderForm') {
    const q = new URLSearchParams();
    if (params.capability) q.set('capability', params.capability);
    if (params.provider) q.set('provider', params.provider);
    const qs = q.toString();
    return `/ai-manager/providers/new${qs ? `?${qs}` : ''}`;
  }
  if (screen === 'aiIntelligenceForm' && params.intelligenceId) {
    return `/ai-manager/intelligence/${params.intelligenceId}`;
  }
  if (screen === 'aiIntelligenceForm') return '/ai-manager/intelligence/new';
  if (screen === 'aiRagForm' && params.ragId) {
    return `/ai-manager/rag/${params.ragId}`;
  }
  if (screen === 'aiRagForm') return '/ai-manager/rag/new';
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
  const { compact } = useBreakpoint();
  const [currentScreen, setCurrentScreen] = useState('dashboard');
  const [previousScreen, setPreviousScreen] = useState('dashboard');
  const [screenParams, setScreenParams] = useState({});
  const [searchOpen, setSearchOpen] = useState(false);

  // Initialize screen from URL on mount and when auth changes (web only)
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      // Don't redirect while loading auth state (prevents redirect on refresh)
      if (loading) return;
      
      if (isAuthenticated) {
        if (window.location.pathname === '/login') {
          window.history.replaceState({}, '', '/');
        }
        const { screen, params } = applyPathname(window.location.pathname, window.location.search);
        setCurrentScreen(screen);
        setScreenParams(params);
        setPreviousScreen('dashboard');
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
        const { screen, params } = applyPathname(window.location.pathname, window.location.search);
        setCurrentScreen(screen);
        setScreenParams(params);
      };

      window.addEventListener('popstate', handlePopState);
      return () => window.removeEventListener('popstate', handlePopState);
    }
  }, []);

  const navigation = {
    navigate: (screen, params = {}) => {
      const resolved = resolveNavigation(screen, params);
      if (resolved.screen !== 'menu') {
        setPreviousScreen(currentScreen);
      }
      setCurrentScreen(resolved.screen);
      setScreenParams(resolved.params);

      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const path = getPathFromScreen(resolved.screen, resolved.params);
        window.history.pushState({ screen: resolved.screen, params: resolved.params }, '', path);
        // URL is source of truth so /services/ai_manager always opens the full console,
        // not a leftover generic ManagerConsole from in-app navigation.
        const fromUrl = applyPathname(window.location.pathname, window.location.search);
        setCurrentScreen(fromUrl.screen);
        setScreenParams(fromUrl.params);
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
      case 'aiIntelligenceForm':
        return <IntelligenceForm navigation={navigation} route={{ params: screenParams }} />;
      case 'aiRagForm':
        return <RagCollectionForm navigation={navigation} route={{ params: screenParams }} />;
      case 'aiModelDetails':
        return <AiModelDetails navigation={navigation} route={{ params: screenParams }} />;
      case 'aiDeploymentDetails':
        return <AiDeploymentDetails navigation={navigation} />;
      case 'apiGatewayManager':
        return <ApiGatewayManager navigation={navigation} />;
      case 'edgeManager':
        return <EdgeManager navigation={navigation} />;
      case 'queueManager':
        return <QueueManager navigation={navigation} />;
      case 'downloadManager':
        return <DownloadManager navigation={navigation} />;
      case 'functionManager':
        return <FunctionManager navigation={navigation} />;
      case 'webhookManager':
        return <WebhookManager navigation={navigation} />;
      case 'gitManager':
        return <GitManager navigation={navigation} />;
      case 'cicdManager':
        return <CicdManager navigation={navigation} />;
      case 'opsTimeline':
        return <OpsTimeline navigation={navigation} />;
      case 'registryManager':
        return <RegistryManager navigation={navigation} />;
      case 'computeManager':
        return <ComputeManager navigation={navigation} />;
      case 'launchContainer':
      case 'runTask':
        return <LaunchContainer navigation={navigation} />;
      case 'containerDetails':
      case 'taskDetails':
        return <ContainerDetails navigation={navigation} route={{ params: screenParams }} />;
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
          {currentScreen !== 'deviceDetails' ? (
            <Header
              navigation={navigation}
              currentScreen={currentScreen}
              searchOpen={searchOpen}
              setSearchOpen={setSearchOpen}
            />
          ) : null}
          {!compact && currentScreen !== 'deviceDetails' ? <JobStatus /> : null}
          <View style={styles.contentContainer}>
            {renderScreen()}
          </View>
          {compact && currentScreen !== 'deviceDetails' ? (
            <BottomTabs
              currentScreen={currentScreen}
              navigation={navigation}
              onSearch={() => setSearchOpen(true)}
            />
          ) : null}
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
        <ToastProvider>
          <JobProvider>
            <FleetAlertProvider>
              <AppContent />
            </FleetAlertProvider>
          </JobProvider>
        </ToastProvider>
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