import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Box } from '../../components/Box/Box';
import { Button } from '../../components/Button/Button';
import { dbManagerService } from '../../services/dbManagerService';
import { DatabaseDetailsStyles } from './DatabaseDetails.styles';
import { colors } from '../../styles/theme';
import { stackService } from '../../services/stackService';
import { useProject } from '../../contexts/ProjectContext';

export const DatabaseDetails = ({ navigation, route }) => {
  const { databaseName } = route.params || {};
  const { currentProject } = useProject();
  const [database, setDatabase] = useState(null);
  const [connectionInfo, setConnectionInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (databaseName) {
      loadDatabase();
    }
  }, [databaseName]);

  const loadDatabase = async () => {
    try {
      setLoading(true);
      setError(null);
      const db = await dbManagerService.getDatabase(databaseName);
      setDatabase(db);
      
      // Load connection info
      try {
        const conn = await dbManagerService.getConnectionString(databaseName);
        setConnectionInfo(conn);
      } catch (err) {
        console.warn('Could not load connection info:', err);
      }
    } catch (err) {
      console.error('Error loading database:', err);
      setError(err.message || 'Failed to load database');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDatabase();
    setRefreshing(false);
  };

  const handleAction = async (action) => {
    if (!database) return;
    
    setActionLoading(true);
    try {
      let result;
      switch (action) {
        case 'start':
          result = await dbManagerService.startDatabase(databaseName);
          break;
        case 'stop':
          result = await dbManagerService.stopDatabase(databaseName);
          break;
        case 'restart':
          result = await dbManagerService.restartDatabase(databaseName);
          break;
        case 'backup':
          result = await dbManagerService.createBackup(databaseName);
          Alert.alert('Backup started', `A backup of "${databaseName}" was requested.`);
          setActionLoading(false);
          return;
        case 'delete':
          Alert.alert(
            'Delete Database',
            `Are you sure you want to delete "${databaseName}"? This will delete the container and all data.`,
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                  try {
                    await dbManagerService.deleteDatabase(databaseName);
                    await stackService.unrecord(currentProject?.id, { service: 'db_manager', name: databaseName });
                    Alert.alert('Success', 'Database deleted successfully');
                    navigation.goBack();
                  } catch (err) {
                    Alert.alert('Error', err.message || 'Failed to delete database');
                  }
                }
              }
            ]
          );
          setActionLoading(false);
          return;
        default:
          return;
      }
      
      if (result) {
        await loadDatabase();
        Alert.alert('Success', `Database ${action}ed successfully`);
      }
    } catch (err) {
      Alert.alert('Error', err.message || `Failed to ${action} database`);
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'running': return '#4CAF50';
      case 'stopped': return '#FF9800';
      case 'creating': return '#2196F3';
      case 'failed': return '#F44336';
      default: return colors.textMuted;
    }
  };

  if (loading) {
    return (
      <View style={[DatabaseDetailsStyles.container, DatabaseDetailsStyles.loadingContainer]}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={DatabaseDetailsStyles.loadingText}>Loading database...</Text>
      </View>
    );
  }

  if (error || !database) {
    return (
      <ScrollView style={DatabaseDetailsStyles.container} contentContainerStyle={DatabaseDetailsStyles.content}>
        <View style={DatabaseDetailsStyles.errorBox}>
          <Text style={DatabaseDetailsStyles.errorText}>{error || 'Database not found'}</Text>
          <Button title="Go Back" onPress={() => navigation.goBack()} style={{ marginTop: 16 }} />
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={DatabaseDetailsStyles.container}
      contentContainerStyle={DatabaseDetailsStyles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <Text style={DatabaseDetailsStyles.title}>{database.name}</Text>

      {/* Status Badge */}
      <View style={[
        DatabaseDetailsStyles.statusBadge,
        { backgroundColor: getStatusColor(database.status) + '20' }
      ]}>
        <View style={[
          DatabaseDetailsStyles.statusDot,
          { backgroundColor: getStatusColor(database.status) }
        ]} />
        <Text style={[
          DatabaseDetailsStyles.statusText,
          { color: getStatusColor(database.status) }
        ]}>
          {database.status}
        </Text>
      </View>

      {/* Actions */}
      <Box title="Actions">
        <View style={DatabaseDetailsStyles.actionsContainer}>
          {database.status !== 'running' && (
            <Button
              title="Start"
              onPress={() => handleAction('start')}
              loading={actionLoading}
              style={DatabaseDetailsStyles.actionButton}
            />
          )}
          {database.status === 'running' && (
            <>
              <Button
                title="Stop"
                onPress={() => handleAction('stop')}
                loading={actionLoading}
                variant="secondary"
                style={DatabaseDetailsStyles.actionButton}
              />
              <Button
                title="Restart"
                onPress={() => handleAction('restart')}
                loading={actionLoading}
                variant="secondary"
                style={DatabaseDetailsStyles.actionButton}
              />
              <Button
                title="Backup"
                onPress={() => handleAction('backup')}
                loading={actionLoading}
                variant="secondary"
                style={DatabaseDetailsStyles.actionButton}
              />
            </>
          )}
          <Button
            title="Delete"
            onPress={() => handleAction('delete')}
            loading={actionLoading}
            variant="danger"
            style={DatabaseDetailsStyles.actionButton}
          />
        </View>
      </Box>

      {/* Database Info */}
      <Box title="Database Information">
        <View style={DatabaseDetailsStyles.infoRow}>
          <Text style={DatabaseDetailsStyles.infoLabel}>Type:</Text>
          <Text style={DatabaseDetailsStyles.infoValue}>{database.type}</Text>
        </View>
        <View style={DatabaseDetailsStyles.infoRow}>
          <Text style={DatabaseDetailsStyles.infoLabel}>Status:</Text>
          <Text style={[DatabaseDetailsStyles.infoValue, { color: getStatusColor(database.status) }]}>
            {database.status}
          </Text>
        </View>
        <View style={DatabaseDetailsStyles.infoRow}>
          <Text style={DatabaseDetailsStyles.infoLabel}>Port:</Text>
          <Text style={DatabaseDetailsStyles.infoValue}>{database.port || 'N/A'}</Text>
        </View>
        <View style={DatabaseDetailsStyles.infoRow}>
          <Text style={DatabaseDetailsStyles.infoLabel}>Host:</Text>
          <Text style={DatabaseDetailsStyles.infoValue}>{database.host || 'N/A'}</Text>
        </View>
        <View style={DatabaseDetailsStyles.infoRow}>
          <Text style={DatabaseDetailsStyles.infoLabel}>Container:</Text>
          <Text style={DatabaseDetailsStyles.infoValue}>{database.container_name || 'N/A'}</Text>
        </View>
        <View style={DatabaseDetailsStyles.infoRow}>
          <Text style={DatabaseDetailsStyles.infoLabel}>Username:</Text>
          <Text style={DatabaseDetailsStyles.infoValue}>{database.username || 'N/A'}</Text>
        </View>
        {database.created_at && (
          <View style={DatabaseDetailsStyles.infoRow}>
            <Text style={DatabaseDetailsStyles.infoLabel}>Created:</Text>
            <Text style={DatabaseDetailsStyles.infoValue}>
              {new Date(database.created_at).toLocaleString()}
            </Text>
          </View>
        )}
      </Box>

      {/* Connection Info */}
      {connectionInfo && (
        <Box title="Connection Information">
          <View style={DatabaseDetailsStyles.infoRow}>
            <Text style={DatabaseDetailsStyles.infoLabel}>Connection String:</Text>
            <Text style={[DatabaseDetailsStyles.infoValue, DatabaseDetailsStyles.connectionString]}>
              {connectionInfo.connection_string}
            </Text>
          </View>
          <View style={DatabaseDetailsStyles.infoRow}>
            <Text style={DatabaseDetailsStyles.infoLabel}>Password:</Text>
            <Text style={DatabaseDetailsStyles.infoValue}>{connectionInfo.password || 'N/A'}</Text>
          </View>
        </Box>
      )}

      {/* Resource Limits */}
      {database.resource_limits && (
        <Box title="Resource Limits">
          {(() => {
            try {
              const limits = typeof database.resource_limits === 'string'
                ? JSON.parse(database.resource_limits)
                : database.resource_limits;
              return (
                <>
                  {limits.cpu_cores && (
                    <View style={DatabaseDetailsStyles.infoRow}>
                      <Text style={DatabaseDetailsStyles.infoLabel}>CPU Cores:</Text>
                      <Text style={DatabaseDetailsStyles.infoValue}>{limits.cpu_cores}</Text>
                    </View>
                  )}
                  {limits.ram_gb && (
                    <View style={DatabaseDetailsStyles.infoRow}>
                      <Text style={DatabaseDetailsStyles.infoLabel}>RAM:</Text>
                      <Text style={DatabaseDetailsStyles.infoValue}>{limits.ram_gb} GB</Text>
                    </View>
                  )}
                  {limits.disk_gb && (
                    <View style={DatabaseDetailsStyles.infoRow}>
                      <Text style={DatabaseDetailsStyles.infoLabel}>Disk:</Text>
                      <Text style={DatabaseDetailsStyles.infoValue}>{limits.disk_gb} GB</Text>
                    </View>
                  )}
                </>
              );
            } catch (e) {
              return null;
            }
          })()}
        </Box>
      )}
    </ScrollView>
  );
};

