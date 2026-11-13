import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ProjectProvider } from './contexts/ProjectContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
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
import { AIManagerStudio } from './screens/AIManager/AIManagerStudio';
import { AgentTaskDetails } from './screens/AIManager/AgentTaskDetails';
import { IcarusShell } from './screens/Icarus/IcarusShell';
import { AiProviderForm } from './screens/AIManager/AiProviderForm';
import { IntelligenceForm } from './screens/AIManager/IntelligenceForm';
import { RagCollectionForm } from './screens/AIManager/RagCollectionForm';
import { AiModelDetails } from './screens/AIManager/AiModelDetails';
import { AiDeploymentDetails } from './screens/AIManager/AiDeploymentDetails';
import { MemoryStoreForm } from './screens/AIManager/MemoryStoreForm';
import { LoraAdapterForm } from './screens/AIManager/LoraAdapterForm';
import { AiBalancerDetails } from './screens/AIManager/AiBalancerDetails';
import { ApiGatewayManager } from './screens/ApiGatewayManager/ApiGatewayManager';
import { ComputeManager } from './screens/ComputeManager/ComputeManager';
import { CicdManager } from './screens/CicdManager/CicdManager';
import { OpsTimeline } from './screens/OpsTimeline/OpsTimeline';
import { getServiceMeta } from './services/serviceCatalog';
import { LaunchContainer } from './screens/ComputeManager/LaunchContainer';
import { ContainerDetails } from './screens/ComputeManager/ContainerDetails';
import { AuthManager } from './screens/AuthManager/AuthManager';
import { ProviderForm } from './screens/AuthManager/ProviderForm';
import { UserForm } from './screens/AuthManager/UserForm';
import { EdgeManager } from './screens/EdgeManager/EdgeManager';
import { QueueManager } from './screens/QueueManager/QueueManager';
import { DownloadManager } from './screens/DownloadManager/DownloadManager';
import { FunctionManager } from './screens/FunctionManager/FunctionManager';
import { WebhookManager } from './screens/WebhookManager/WebhookManager';
import { GitManager } from './screens/GitManager/GitManager';
import { Adonis } from './screens/Adonis/Adonis';
import { RegistryManager } from './screens/RegistryManager/RegistryManager';
import { Header } from './components/Header/Header';
import { ToastProvider } from './components/Toast/ToastProvider';
import { JobProvider, JobStatus } from './components/JobStatus/JobStatus';
import { FleetAlertProvider } from './components/FleetAlert/FleetAlertListener';
import { BottomTabs } from './components/BottomTabs/BottomTabs';
import { useBreakpoint } from './hooks/useBreakpoint';

const { getScreenFromPath, getPathFromScreen } = require('./utils/screenPath');

/** Prefer a catalog screen (e.g. aiManager) over the generic ManagerConsole. */
const resolveNavigation = (screen, params = {}) => {
  if (screen === 'managerConsole' && params.serviceName) {
    const serviceName = String(params.serviceName).replace(/\/$/, '');
    if (serviceName === 'ai_manager') return { screen: 'icarus', params: { section: 'chat' } };
    const meta = getServiceMeta(serviceName);
    if (meta?.route) return { screen: meta.route, params: {} };
  }
  return { screen, params };
};

const applyPathname = (pathname, search = '') => {
  const screenData = getScreenFromPath(pathname, { getServiceMeta, search });
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

const AppContent = () => {
  const { isAuthenticated, loading } = useAuth();
  const { colors, isDark } = useTheme();
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
        // Canonicalize legacy AI Manager bookmarks into /icarus…
        const canonical = getPathFromScreen(screen, params);
        if (canonical && canonical !== window.location.pathname) {
          window.history.replaceState({ screen, params }, '', canonical);
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
      case 'icarus':
        return <IcarusShell key="icarus" navigation={navigation} route={{ params: { section: 'chat', ...screenParams } }} />;
      case 'icarusFleet':
        return <IcarusShell key="icarusFleet" navigation={navigation} route={{ params: { section: 'fleet', tab: 'engines', ...screenParams } }} />;
      case 'icarusModels':
        return <IcarusShell key="icarusModels" navigation={navigation} route={{ params: { section: 'models', tab: 'llm', ...screenParams } }} />;
      case 'icarusApps':
        return <IcarusShell key="icarusApps" navigation={navigation} route={{ params: { section: 'apps', tab: 'intelligence', ...screenParams } }} />;
      case 'icarusSkills':
        return <IcarusShell key="icarusSkills" navigation={navigation} route={{ params: { section: 'skills', ...screenParams } }} />;
      case 'icarusFriends':
        return <IcarusShell key="icarusFriends" navigation={navigation} route={{ params: { section: 'friends', ...screenParams } }} />;
      case 'icarusConnectors':
        return <IcarusShell key="icarusConnectors" navigation={navigation} route={{ params: { section: 'connectors', ...screenParams } }} />;
      case 'icarusCron':
        return <IcarusShell key="icarusCron" navigation={navigation} route={{ params: { section: 'cron', ...screenParams } }} />;
      case 'icarusAdvanced':
        return <IcarusShell key="icarusAdvanced" navigation={navigation} route={{ params: { section: 'advanced', ...screenParams } }} />;
      case 'aiManager':
      case 'aiAgents':
        return <IcarusShell key="icarus-redirect" navigation={navigation} route={{ params: { section: 'chat', ...screenParams } }} />;
      case 'aiAgentTask':
        return <AgentTaskDetails navigation={navigation} route={{ params: screenParams }} />;
      case 'aiEngines':
        return <IcarusShell key="icarusFleet" navigation={navigation} route={{ params: { section: 'fleet', tab: 'engines', ...screenParams } }} />;
      case 'aiEndpoints':
        return <IcarusShell key="icarusFleet" navigation={navigation} route={{ params: { section: 'fleet', tab: 'endpoints', ...screenParams } }} />;
      case 'aiLlm':
        return <IcarusShell key="icarusModels" navigation={navigation} route={{ params: { section: 'models', tab: 'llm', ...screenParams } }} />;
      case 'aiTts':
        return <IcarusShell key="icarusModels" navigation={navigation} route={{ params: { section: 'models', tab: 'tts', ...screenParams } }} />;
      case 'aiStt':
        return <IcarusShell key="icarusModels" navigation={navigation} route={{ params: { section: 'models', tab: 'stt', ...screenParams } }} />;
      case 'aiEmbeddings':
        return <IcarusShell key="icarusModels" navigation={navigation} route={{ params: { section: 'models', tab: 'embeddings', ...screenParams } }} />;
      case 'aiBenchmarks':
        return <IcarusShell key="icarusModels" navigation={navigation} route={{ params: { section: 'models', tab: 'benchmarks', ...screenParams } }} />;
      case 'aiIntelligence':
        return <IcarusShell key="icarusApps" navigation={navigation} route={{ params: { section: 'apps', tab: 'intelligence', ...screenParams } }} />;
      case 'aiRag':
        return <IcarusShell key="icarusApps" navigation={navigation} route={{ params: { section: 'apps', tab: 'rag', ...screenParams } }} />;
      case 'aiMemory':
        return <IcarusShell key="icarusApps" navigation={navigation} route={{ params: { section: 'apps', tab: 'memory', ...screenParams } }} />;
      case 'aiJobs':
        return <IcarusShell key="icarusApps" navigation={navigation} route={{ params: { section: 'apps', tab: 'jobs', ...screenParams } }} />;
      case 'aiFinetunes':
        return <IcarusShell key="icarusApps" navigation={navigation} route={{ params: { section: 'apps', tab: 'finetunes', ...screenParams } }} />;
      case 'aiAccess':
        return <IcarusShell key="icarusApps" navigation={navigation} route={{ params: { section: 'apps', tab: 'appaccess', ...screenParams } }} />;
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
      case 'aiMemoryForm':
        return <MemoryStoreForm navigation={navigation} route={{ params: screenParams }} />;
      case 'aiLoraForm':
        return <LoraAdapterForm navigation={navigation} route={{ params: screenParams }} />;
      case 'aiBalancerDetails':
        return <AiBalancerDetails navigation={navigation} route={{ params: screenParams }} />;
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
        return <GitManager navigation={navigation} route={{ params: screenParams }} />;
      case 'adonis':
        return <Adonis navigation={navigation} route={{ params: screenParams }} />;
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
      case 'userForm':
        return <UserForm navigation={navigation} route={{ params: screenParams }} />;
      case 'dashboard':
      default:
        return <Dashboard navigation={navigation} />;
    }
  };

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {isAuthenticated ? (
        <View style={[styles.appContainer, { backgroundColor: colors.background }]}>
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
    <ThemeProvider>
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
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  appContainer: {
    flex: 1,
  },
  contentContainer: {
    flex: 1,
  },
});