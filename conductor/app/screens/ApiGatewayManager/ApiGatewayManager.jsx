import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, RefreshControl, TextInput } from 'react-native';
import { Box } from '../../components/Box/Box';
import { Button } from '../../components/Button/Button';
import { ServiceStatus } from '../../components/ServiceStatus/ServiceStatus';
import { ServiceToggle } from '../../components/ServiceToggle/ServiceToggle';
import { apiManagerService } from '../../services/apiManagerService';
import { useProject } from '../../contexts/ProjectContext';
import { getApiBaseUrl } from '../../utils/api';
import { colors } from '../../styles/theme';
import { ApiGatewayManagerStyles as S } from './ApiGatewayManager.styles';
import { ResourceCrud } from '../../components/ResourceCrud';
import { stackService } from '../../services/stackService';

const ENGINES = ['sqlite3', 'postgresql', 'mongodb'];

const STARTER = {
  name: 'app',
  engine: 'sqlite3',
  database: 'app-db',
  desired: 1,
  autoscaling: { min: 1, max: 4, metric: 'rps', target: 50 },
  models: {
    User: {
      fields: { name: 'string', email: 'string', owner_id: 'string' },
      settings: { required: ['email'], unique: ['email'], hasMany: ['Post'], timestamps: true },
    },
    Post: {
      fields: { title: 'string', body: 'string' },
      settings: { belongsTo: ['User'], timestamps: true },
    },
  },
};

function patchSchemaJson(raw, patch) {
  const doc = JSON.parse(raw);
  return JSON.stringify({ ...doc, ...patch }, null, 2);
}

export const ApiGatewayManager = ({ navigation }) => {
  const { currentProject } = useProject();
  const projectId = currentProject?.id;
  const apiBase = getApiBaseUrl();

  const [status, setStatus] = useState(null);
  const [routes, setRoutes] = useState([]);
  const [dataApps, setDataApps] = useState([]);
  const [toggling, setToggling] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [schemaJson, setSchemaJson] = useState(JSON.stringify(STARTER, null, 2));
  const [dataTab, setDataTab] = useState('gateway');
  const [lastApply, setLastApply] = useState(null);

  const parsedEngine = (() => {
    try { return JSON.parse(schemaJson).engine || 'sqlite3'; } catch { return 'sqlite3'; }
  })();
  const parsedDesired = (() => {
    try { return String(JSON.parse(schemaJson).desired || 1); } catch { return '1'; }
  })();

  const load = useCallback(async () => {
    try {
      const st = await apiManagerService.getStatus();
      setStatus(st);
      if (projectId && st?.enabled) {
        setRoutes(await apiManagerService.listRoutes(projectId));
        try { setDataApps(await apiManagerService.listDataApis(projectId)); } catch { setDataApps([]); }
      } else {
        setRoutes([]);
        setDataApps([]);
      }
      setError(null);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Failed to load');
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleToggle = async (enabled) => {
    setToggling(true);
    try {
      if (enabled) await apiManagerService.enable();
      else await apiManagerService.disable();
      await load();
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Toggle failed');
    } finally {
      setToggling(false);
    }
  };

  const handleSeed = async () => {
    if (!projectId) return;
    setSeeding(true);
    try {
      await apiManagerService.seedPresets(projectId);
      const seeded = await apiManagerService.listRoutes(projectId);
      await stackService.record(projectId, {
        items: (seeded || []).map((r) => ({
          service: 'api_manager',
          key: 'routes',
          resource: { name: r.name, method: r.method, public_path: r.public_path, target_service: r.target_service, target_path: r.target_path },
        })),
      });
      await load();
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Seed failed');
    } finally {
      setSeeding(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const setEngine = (engine) => {
    try { setSchemaJson(patchSchemaJson(schemaJson, { engine, database: JSON.parse(schemaJson).database || `${JSON.parse(schemaJson).name || 'app'}-db` })); }
    catch { setError('Schema JSON is invalid'); }
  };

  const activeApp = lastApply?.item || dataApps[0];

  return (
    <ScrollView
      style={S.container}
      contentContainerStyle={S.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={S.title}>API Gateway</Text>
      <Text style={S.subtitle}>Pretty invoke URLs → manager proxy with ARN injection</Text>

      {error ? (
        <Box style={S.errorBox}><Text style={S.errorText}>{error}</Text></Box>
      ) : null}

      <ServiceStatus status={status} loading={!status} />
      <ServiceToggle enabled={!!status?.enabled} onToggle={handleToggle} loading={toggling} />

      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
        <Button title="Gateway" variant={dataTab === 'gateway' ? 'primary' : 'secondary'} onPress={() => setDataTab('gateway')} />
        <Button title="Data API" variant={dataTab === 'data' ? 'primary' : 'secondary'} onPress={() => setDataTab('data')} />
      </View>

      {dataTab === 'data' ? (
        <Box title="Data API — models in, hosted CRUD out">
          <Text style={S.hint}>
            Paste models and relationships. Apply provisions the database (sqlite3 in-process, or db_manager for postgres/mongo), hosts nested CRUD, compiles GraphQL, and seeds gateway routes. Hooks stay on function_manager.
          </Text>
          <Text style={S.label}>Database engine</Text>
          <View style={S.chipRow}>
            {ENGINES.map((e) => (
              <Button key={e} title={e} variant={parsedEngine === e ? 'primary' : 'secondary'} onPress={() => setEngine(e)} />
            ))}
          </View>
          <Text style={S.label}>Desired replicas (autoscaling min/max live in the JSON)</Text>
          <TextInput
            value={parsedDesired}
            keyboardType="number-pad"
            onChangeText={(v) => {
              try { setSchemaJson(patchSchemaJson(schemaJson, { desired: parseInt(v, 10) || 1 })); }
              catch { setError('Schema JSON is invalid'); }
            }}
            style={S.input}
          />
          <TextInput
            multiline
            value={schemaJson}
            onChangeText={setSchemaJson}
            style={{ minHeight: 220, borderWidth: 1, borderColor: colors.border, padding: 8, color: colors.textPrimary, fontFamily: 'monospace', marginBottom: 8 }}
          />
          <Button
            title="Apply schema"
            loading={seeding}
            onPress={async () => {
              if (!projectId) return;
              setSeeding(true);
              try {
                const doc = JSON.parse(schemaJson);
                const result = await apiManagerService.applyDataApi(projectId, doc);
                setLastApply(result);
                await stackService.record(projectId, {
                  service: 'api_manager',
                  key: 'data_apis',
                  resource: { name: doc.name, engine: doc.engine, models: doc.models, desired: doc.desired, autoscaling: doc.autoscaling, database: doc.database },
                });
                await load();
              } catch (err) {
                setError(err.response?.data?.error?.message || err.message);
              } finally { setSeeding(false); }
            }}
          />
          {lastApply?.database ? (
            <Text style={S.hint}>
              DB {lastApply.database.name} · {lastApply.database.engine} · {lastApply.database.status}
              {lastApply.database.query_engine ? ` · queries via ${lastApply.database.query_engine}` : ''}
              {lastApply.database.fallback ? ' (fell back to sqlite3)' : ''}
            </Text>
          ) : null}
          {lastApply?.endpoints?.length ? (
            <Text style={S.hint}>{lastApply.endpoints.length} endpoints hosted, including nested hasMany routes.</Text>
          ) : null}
          {activeApp?.name ? (
            <View style={S.chipRow}>
              <Button
                title={`Scale down (${activeApp.desired || 1})`}
                variant="secondary"
                onPress={async () => {
                  try {
                    const next = Math.max(1, Number(activeApp.desired || 1) - 1);
                    const res = await apiManagerService.scaleDataApi(projectId, activeApp.name, next);
                    setLastApply((prev) => ({ ...prev, item: res.item || res }));
                    await load();
                  } catch (err) { setError(err.response?.data?.error?.message || err.message); }
                }}
              />
              <Button
                title="Scale up"
                variant="secondary"
                onPress={async () => {
                  try {
                    const next = Number(activeApp.desired || 1) + 1;
                    const res = await apiManagerService.scaleDataApi(projectId, activeApp.name, next);
                    setLastApply((prev) => ({ ...prev, item: res.item || res }));
                    await load();
                  } catch (err) { setError(err.response?.data?.error?.message || err.message); }
                }}
              />
            </View>
          ) : null}
        </Box>
      ) : null}

      {dataTab === 'gateway' ? (
      <Box title="Project routes">
        {!projectId ? (
          <Text style={S.hint}>Select a project to manage gateway routes.</Text>
        ) : (
          <>
            <Button title="Seed standard presets" onPress={handleSeed} loading={seeding} />
            <Text style={S.hint}>
              Presets are auto-seeded when a project is created. Re-seed to refresh after upgrades.
            </Text>
            {routes.length === 0 ? (
              <Text style={S.hint}>No routes yet — seed presets for this project.</Text>
            ) : (
              routes.map((r) => (
                <View key={r.id} style={S.routeRow}>
                  <Text style={S.routeName}>{r.method} {r.name}</Text>
                  <Text style={S.routePath} selectable>{r.public_path}</Text>
                  <Text style={S.routeTarget}>→ {r.target_service}{r.target_path}</Text>
                  {r.pretty_invoke_url ? (
                    <Text style={S.routeUrl} selectable>
                      Example: {r.pretty_invoke_url.replace('{endpoint_name}', 'my-endpoint').replace('{database_name}', 'my-db').replace('{queue_name}', 'my-queue')}
                    </Text>
                  ) : null}
                </View>
              ))
            )}
            <ResourceCrud serviceName="api_manager" enabled={!!status?.enabled && !!projectId} title="Gateway routes" onChanged={load} />
          </>
        )}
      </Box>
      ) : null}

      <Box title="Token URL">
        <Text style={S.mono} selectable>{apiBase}/api/services/auth_manager/api/v1/auth/token</Text>
      </Box>
    </ScrollView>
  );
};
