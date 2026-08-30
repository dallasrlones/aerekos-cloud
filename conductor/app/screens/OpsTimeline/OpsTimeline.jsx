import React, { useCallback, useEffect, useState } from 'react';
import { Text, ScrollView } from 'react-native';
import { Page } from '../../components/ui';
import { Box } from '../../components/Box/Box';
import { useProject } from '../../contexts/ProjectContext';
import api from '../../utils/api';

export const OpsTimeline = ({ navigation }) => {
  const { currentProject } = useProject();
  const [data, setData] = useState({ events: [], broken: 0 });
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const r = await api.get('/api/ops/timeline', {
        params: currentProject?.id ? { project_id: currentProject.id } : {},
      });
      setData(r.data || { events: [] });
      setError(null);
    } catch (e) {
      setError(e.response?.data?.error?.message || e.message);
    }
  }, [currentProject?.id]);

  useEffect(() => { load(); }, [load]);

  return (
    <Page title="What's broken" subtitle={data.broken ? `${data.broken} open` : 'All clear'}>
      <ScrollView>
        {error ? <Text>{error}</Text> : null}
        {(data.events || []).map((ev, i) => (
          <Box key={`${ev.kind}-${i}`} title={ev.title || ev.kind}>
            <Text>{ev.kind} · {ev.severity}</Text>
            <Text>{ev.at}</Text>
          </Box>
        ))}
        {!data.events?.length && !error ? <Text>Nothing broken right now.</Text> : null}
      </ScrollView>
    </Page>
  );
};
