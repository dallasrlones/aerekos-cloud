import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Box } from '../../components/Box/Box';
import { Button } from '../../components/Button/Button';
import { dbManagerService } from '../../services/dbManagerService';
import { DatabaseManagerStyles } from './DatabaseManager.styles';
import { colors } from '../../styles/theme';

export const DatabaseManager = ({ navigation }) => {
  const [databases, setDatabases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({
    total: 0,
    running: 0,
    stopped: 0,
    creating: 0,
    failed: 0
  });

  useEffect(() => {
    loadDatabases();
  }, []);

  const loadDatabases = async () => {
    try {
      setError(null);
      const response = await dbManagerService.getDatabases();
      const databasesList = response.databases || [];
      setDatabases(databasesList);
      
      // Calculate stats
      const stats = {
        total: databasesList.length,
        running: databasesList.filter(db => db.status === 'running').length,
        stopped: databasesList.filter(db => db.status === 'stopped').length,
        creating: databasesList.filter(db => db.status === 'creating').length,
        failed: databasesList.filter(db => db.status === 'failed').length
      };
      setStats(stats);
    } catch (err) {
      console.error('Error loading databases:', err);
      setError(err.message || 'Failed to load databases');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDatabases();
    setRefreshing(false);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'running':
        return colors.success || '#4CAF50';
      case 'stopped':
        return colors.warning || '#FF9800';
      case 'creating':
        return colors.info || '#2196F3';
      case 'failed':
        return colors.error || '#F44336';
      default:
        return colors.textMuted;
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'running':
        return 'checkmark-circle';
      case 'stopped':
        return 'stop-circle';
      case 'creating':
        return 'hourglass';
      case 'failed':
        return 'close-circle';
      default:
        return 'help-circle';
    }
  };

  if (loading) {
    return (
      <View style={[DatabaseManagerStyles.container, DatabaseManagerStyles.loadingContainer]}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={DatabaseManagerStyles.loadingText}>Loading databases...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={DatabaseManagerStyles.container}
      contentContainerStyle={DatabaseManagerStyles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <Text style={DatabaseManagerStyles.title}>Database Manager</Text>

      {error && (
        <Box style={DatabaseManagerStyles.errorBox}>
          <Text style={DatabaseManagerStyles.errorText}>{error}</Text>
        </Box>
      )}

      {/* Statistics */}
      <Box title="Statistics">
        <View style={DatabaseManagerStyles.statsContainer}>
          <View style={DatabaseManagerStyles.statItem}>
            <Text style={DatabaseManagerStyles.statValue}>{stats.total}</Text>
            <Text style={DatabaseManagerStyles.statLabel}>Total</Text>
          </View>
          <View style={DatabaseManagerStyles.statItem}>
            <Text style={[DatabaseManagerStyles.statValue, { color: getStatusColor('running') }]}>
              {stats.running}
            </Text>
            <Text style={DatabaseManagerStyles.statLabel}>Running</Text>
          </View>
          <View style={DatabaseManagerStyles.statItem}>
            <Text style={[DatabaseManagerStyles.statValue, { color: getStatusColor('stopped') }]}>
              {stats.stopped}
            </Text>
            <Text style={DatabaseManagerStyles.statLabel}>Stopped</Text>
          </View>
          <View style={DatabaseManagerStyles.statItem}>
            <Text style={[DatabaseManagerStyles.statValue, { color: getStatusColor('creating') }]}>
              {stats.creating}
            </Text>
            <Text style={DatabaseManagerStyles.statLabel}>Creating</Text>
          </View>
          <View style={DatabaseManagerStyles.statItem}>
            <Text style={[DatabaseManagerStyles.statValue, { color: getStatusColor('failed') }]}>
              {stats.failed}
            </Text>
            <Text style={DatabaseManagerStyles.statLabel}>Failed</Text>
          </View>
        </View>
      </Box>

      {/* Quick Actions */}
      <Box title="Quick Actions">
        <Button
          title="Create Database"
          onPress={() => navigation.navigate('createDatabase')}
          style={DatabaseManagerStyles.actionButton}
        />
        <Button
          title="View All Databases"
          onPress={() => navigation.navigate('databasesList')}
          variant="secondary"
          style={DatabaseManagerStyles.actionButton}
        />
      </Box>

      {/* Recent Databases */}
      <Box title={`Recent Databases (${databases.length})`}>
        {databases.length > 0 ? (
          databases.slice(0, 5).map((database) => (
            <TouchableOpacity
              key={database.id || database.name}
              style={DatabaseManagerStyles.listItem}
              onPress={() => navigation.navigate('databaseDetails', { databaseName: database.name })}
              activeOpacity={0.7}
            >
              <View style={DatabaseManagerStyles.listItemContent}>
                <View style={DatabaseManagerStyles.listItemHeader}>
                  <Text style={DatabaseManagerStyles.listItemTitle}>{database.name}</Text>
                  <View style={[
                    DatabaseManagerStyles.statusBadge,
                    { backgroundColor: getStatusColor(database.status) + '20' }
                  ]}>
                    <Ionicons
                      name={getStatusIcon(database.status)}
                      size={14}
                      color={getStatusColor(database.status)}
                    />
                    <Text style={[
                      DatabaseManagerStyles.statusText,
                      { color: getStatusColor(database.status) }
                    ]}>
                      {database.status}
                    </Text>
                  </View>
                </View>
                <Text style={DatabaseManagerStyles.listItemSubtitle}>
                  {database.type} • Port: {database.port || 'N/A'} • {database.container_name || 'N/A'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          ))
        ) : (
          <View style={DatabaseManagerStyles.emptyState}>
            <Ionicons name="server-outline" size={48} color={colors.textMuted} />
            <Text style={DatabaseManagerStyles.emptyText}>No databases found</Text>
            <Text style={DatabaseManagerStyles.emptySubtext}>
              Create your first database to get started
            </Text>
            <Button
              title="Create Database"
              onPress={() => navigation.navigate('createDatabase')}
              style={DatabaseManagerStyles.emptyButton}
            />
          </View>
        )}
      </Box>
    </ScrollView>
  );
};

