import { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import { getDepsForService, resolveMissing } from '../services/serviceDeps';
import { setupService } from '../services/setupService';
import { getServiceMeta } from '../services/serviceCatalog';
import { useToast } from '../components/Toast/ToastProvider';
import { useProject } from '../contexts/ProjectContext';

/**
 * Shared dependency checklist wiring for ServiceGuide (mirrors StorageManager).
 * @param {string} serviceName catalog service id
 * @param {import('@react-navigation/native').NavigationProp<Record<string, object>>} navigation
 * @param {boolean | undefined} statusEnabled re-fetch when service enable toggles
 */
export function useServiceGuideDeps(serviceName, navigation, statusEnabled) {
  const { currentProject } = useProject();
  const { showToast } = useToast();
  const [guideDeps, setGuideDeps] = useState([]);

  useEffect(() => {
    let cancelled = false;
    async function loadDeps() {
      if (!currentProject?.id) {
        setGuideDeps(resolveMissing(getDepsForService(serviceName), []));
        return;
      }
      try {
        const setup = await setupService.getServiceSetup(serviceName, currentProject.id);
        const enabled = new Set(
          (setup.dependencies || [])
            .filter((d) => d.status === 'connected' || d.enabled)
            .map((d) => d.service),
        );
        if (setup.enabled) enabled.add(serviceName);
        const base = getDepsForService(serviceName);
        const merged = base.map((row) => {
          const live = (setup.dependencies || []).find((d) => d.service === row.id);
          return {
            ...row,
            status: live?.status === 'connected' ? 'satisfied' : live?.enabled ? 'ready' : row.status,
            why: live?.reason || row.why,
          };
        });
        if (!cancelled) setGuideDeps(resolveMissing(merged, enabled));
      } catch {
        if (!cancelled) setGuideDeps(resolveMissing(getDepsForService(serviceName), []));
      }
    }
    loadDeps();
    return () => { cancelled = true; };
  }, [currentProject?.id, statusEnabled, serviceName]);

  const openDep = useCallback((dep) => {
    const meta = getServiceMeta(dep?.id);
    if (meta?.route) navigation.navigate(meta.route);
    else navigation.navigate('managerConsole', { serviceName: dep.id });
  }, [navigation]);

  const enableAllDeps = useCallback(async () => {
    if (!currentProject?.id) {
      Alert.alert('Select a project', 'Pick a project to enable dependencies.');
      return;
    }
    try {
      const plan = await setupService.provisionDeps(currentProject.id, serviceName, { dryRun: true });
      showToast(plan.summary || 'Dependency plan ready');
      await setupService.enable(currentProject.id, serviceName, { withDependencies: true });
    } catch (err) {
      Alert.alert('Enable failed', err.response?.data?.error?.message || err.message);
    }
  }, [currentProject?.id, serviceName, showToast]);

  const onSetup = useCallback(() => {
    if (currentProject?.id) enableAllDeps();
    else Alert.alert('Select a project', 'Pick a project to run setup.');
  }, [currentProject?.id, enableAllDeps]);

  return { guideDeps, openDep, enableAllDeps, onSetup };
}
