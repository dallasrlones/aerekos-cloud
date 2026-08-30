import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../utils/api';
import { useProject } from '../../contexts/ProjectContext';
import { colors, spacing } from '../../styles/theme';

const JobContext = createContext({ jobs: [], refresh: async () => {}, createJob: async () => null });

export const useJobs = () => useContext(JobContext);

export const JobProvider = ({ children }) => {
  const { currentProject } = useProject();
  const [jobs, setJobs] = useState([]);

  const refresh = useCallback(async () => {
    try {
      const params = {};
      if (currentProject?.id) params.project_id = currentProject.id;
      const res = await api.get('/api/jobs', { params: { ...params, limit: 20 } });
      setJobs(res.data?.jobs || []);
    } catch {
      setJobs([]);
    }
  }, [currentProject?.id]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 15000);
    return () => clearInterval(t);
  }, [refresh]);

  const createJob = useCallback(async (body) => {
    const res = await api.post('/api/jobs', {
      project_id: currentProject?.id || '',
      ...body,
    });
    await refresh();
    return res.data?.job;
  }, [currentProject?.id, refresh]);

  const deleteJob = useCallback(async (id) => {
    await api.delete(`/api/jobs/${id}`);
    await refresh();
  }, [refresh]);

  const value = useMemo(() => ({ jobs, refresh, createJob, deleteJob }), [jobs, refresh, createJob, deleteJob]);
  return <JobContext.Provider value={value}>{children}</JobContext.Provider>;
};

export const JobStatus = ({ compact }) => {
  const { jobs } = useJobs();
  const running = jobs.filter((j) => j.status === 'running' || j.status === 'queued');
  if (compact) {
    return (
      <Text style={styles.badge}>{jobs.length}</Text>
    );
  }
  if (!running.length && !jobs.length) return null;
  return (
    <View style={styles.banner}>
      <Ionicons name="pulse-outline" size={14} color={colors.primary} />
      <Text style={styles.bannerText}>
        {running.length ? `${running.length} job(s) running` : `${jobs[0]?.summary || 'Recent jobs'}`}
      </Text>
    </View>
  );
};

export const JobBellList = ({ onClose }) => {
  const { jobs } = useJobs();
  return (
    <View style={styles.panel}>
      <Text style={styles.panelTitle}>Recent jobs</Text>
      {jobs.length === 0 ? (
        <Text style={styles.empty}>No jobs yet</Text>
      ) : jobs.map((j) => (
        <View key={j.id} style={styles.row}>
          <Text style={styles.kind}>{j.status}</Text>
          <Text style={styles.summary} numberOfLines={2}>{j.summary || j.kind}</Text>
        </View>
      ))}
      <TouchableOpacity onPress={onClose}><Text style={styles.close}>Close</Text></TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: { color: colors.textMuted, fontSize: 10, marginLeft: 2 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  bannerText: { color: colors.textSecondary, fontSize: 12 },
  panel: {
    position: 'absolute',
    right: 12,
    top: 56,
    width: 320,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: spacing.md,
    zIndex: 2000,
  },
  panelTitle: { fontWeight: '600', color: colors.textPrimary, marginBottom: 8 },
  empty: { color: colors.textMuted, fontSize: 13 },
  row: { marginBottom: 8 },
  kind: { fontSize: 11, color: colors.primary, textTransform: 'uppercase' },
  summary: { fontSize: 13, color: colors.textPrimary },
  close: { marginTop: 8, color: colors.primary, fontSize: 13 },
});
