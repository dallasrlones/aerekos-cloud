import React, { useCallback, useState } from 'react';
import { View, Text, TextInput } from 'react-native';
import { Box } from '../Box/Box';
import { Button } from '../Button/Button';
import { Chart } from '../Chart/Chart';
import api from '../../utils/api';
import { useProject } from '../../contexts/ProjectContext';
import { colors } from '../../styles/theme';
import { ManagerConsoleStyles as S } from '../../screens/ManagerConsole/ManagerConsole.styles';

const SPECS = {
  logs_manager: {
    title: 'Log search',
    hint: 'Filter by message, level, or source. This is not a CRUD dump.',
    fields: [
      { key: 'q', label: 'Query', placeholder: 'error timeout' },
      { key: 'level', label: 'Level', placeholder: 'error' },
      { key: 'source', label: 'Source', placeholder: 'ai_manager' },
    ],
    path: '/api/v1/logs',
    method: 'get',
    listKey: 'logs',
  },
  metrics_manager: {
    title: 'Metric series',
    hint: 'Filter series by metric name, then chart the latest samples.',
    fields: [{ key: 'metric_name', label: 'Metric', placeholder: 'cpu' }],
    path: '/api/v1/series',
    method: 'get',
    listKey: 'items',
    chart: true,
  },
  trace_manager: {
    title: 'Trace query',
    hint: 'Look up spans by trace id or name.',
    fields: [
      { key: 'q', label: 'Trace id', placeholder: 'trace-…' },
      { key: 'name', label: 'Span name', placeholder: 'http.request' },
    ],
    path: '/api/v1/query',
    method: 'get',
    listKey: 'spans',
  },
  audit_manager: {
    title: 'Audit events',
    hint: 'Search recorded control-plane events.',
    fields: [{ key: 'q', label: 'Query', placeholder: 'login' }],
    path: '/api/v1/events',
    method: 'get',
    listKey: 'items',
  },
  analytics_manager: {
    title: 'Analytics',
    hint: 'Filter events / funnels for this project.',
    fields: [{ key: 'q', label: 'Query', placeholder: 'page_view' }],
    path: '/api/v1/events',
    method: 'get',
    listKey: 'items',
  },
  billing_manager: {
    title: 'Usage',
    hint: 'Filter cost / usage meters.',
    fields: [{ key: 'q', label: 'Query', placeholder: 'compute_seconds' }],
    path: '/api/v1/meters',
    method: 'get',
    listKey: 'items',
  },
  query_manager: {
    title: 'SQL',
    hint: 'Run a project-scoped query. ATTACH/VACUUM are refused.',
    fields: [{ key: 'sql', label: 'SQL', placeholder: 'SELECT 1', multiline: true }],
    path: '/api/v1/sql',
    method: 'post',
    listKey: 'rows',
    body: true,
  },
  status_manager: {
    title: 'Status page',
    hint: 'Public incident / component snapshot for this project.',
    fields: [],
    path: '/api/v1/public',
    method: 'get',
    listKey: 'components',
  },
};

function extractRows(data, listKey) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (listKey && Array.isArray(data[listKey])) return data[listKey];
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.rows)) return data.rows;
  return [];
}

export const ObservabilityPanel = ({ serviceName }) => {
  const spec = SPECS[serviceName];
  const { currentProject } = useProject();
  const [values, setValues] = useState({});
  const [rows, setRows] = useState([]);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const run = useCallback(async () => {
    if (!spec) return;
    setBusy(true);
    setError(null);
    try {
      const params = { project_id: currentProject?.id, ...values };
      const url = `/api/services/${serviceName}${spec.path}`;
      const res = spec.method === 'post'
        ? await api.post(url, params)
        : await api.get(url, { params });
      setRows(extractRows(res.data, spec.listKey));
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Query failed');
      setRows([]);
    } finally {
      setBusy(false);
    }
  }, [spec, serviceName, currentProject?.id, values]);

  if (!spec) return null;

  const chartData = spec.chart
    ? rows.slice(0, 40).map((r, i) => ({
      timestamp: Date.now() - (rows.length - i) * 1000,
      value: Number(r.value || r.sample || r.v || 0),
    }))
    : [];

  return (
    <Box title={spec.title}>
      <Text style={S.hintText}>{spec.hint}</Text>
      {spec.fields.map((f) => (
        <TextInput
          key={f.key}
          value={values[f.key] || ''}
          onChangeText={(t) => setValues((prev) => ({ ...prev, [f.key]: t }))}
          placeholder={f.placeholder}
          placeholderTextColor={colors.textMuted}
          multiline={!!f.multiline}
          autoCapitalize="none"
          style={{
            borderWidth: 1,
            borderColor: colors.divider,
            borderRadius: 8,
            padding: 10,
            color: colors.textPrimary,
            marginBottom: 8,
            minHeight: f.multiline ? 80 : undefined,
          }}
        />
      ))}
      <Button title={busy ? 'Running…' : 'Search'} onPress={run} disabled={busy} />
      {error ? <Text style={S.errorText}>{error}</Text> : null}
      {chartData.length > 1 ? <Chart title="" data={chartData} dataKey="value" height={160} /> : null}
      {rows.length === 0 && !error && !busy ? (
        <Text style={S.hintText}>No rows. Search or ingest data first.</Text>
      ) : null}
      <View style={{ marginTop: 12 }}>
        {rows.slice(0, 30).map((row, i) => (
          <Text key={row.id || i} style={S.codeLine} numberOfLines={3}>
            {typeof row === 'string' ? row : JSON.stringify(row)}
          </Text>
        ))}
      </View>
    </Box>
  );
};

export default ObservabilityPanel;
