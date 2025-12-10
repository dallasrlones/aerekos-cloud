import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, RefreshControl } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import apiClient from '../../utils/api';
import { DashboardStyles } from './Dashboard.styles';

export const Dashboard = ({ navigation }) => {
  const { user } = useAuth();
  const [healthStatus, setHealthStatus] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    checkHealth();
  }, []);

  const checkHealth = async () => {
    try {
      const response = await apiClient.get('/health');
      setHealthStatus({
        status: response.data.status,
        database: response.data.database,
        timestamp: response.data.timestamp,
      });
    } catch (error) {
      setHealthStatus({
        status: 'unhealthy',
        error: error.message,
      });
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await checkHealth();
    setRefreshing(false);
  };

  return (
    <ScrollView
      style={DashboardStyles.container}
      contentContainerStyle={DashboardStyles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Welcome Section */}
      <View style={DashboardStyles.welcomeSection}>
        <Text style={DashboardStyles.welcomeText}>Welcome,</Text>
        <Text style={DashboardStyles.usernameText}>{user?.username || 'User'}</Text>
      </View>

      {/* Health Status Card */}
      <View style={DashboardStyles.card}>
        <Text style={DashboardStyles.cardTitle}>System Health</Text>
        {healthStatus ? (
          <View style={DashboardStyles.healthStatus}>
            <View style={DashboardStyles.statusRow}>
              <Text style={DashboardStyles.statusLabel}>Status:</Text>
              <Text
                style={[
                  DashboardStyles.statusValue,
                  healthStatus.status === 'healthy'
                    ? DashboardStyles.statusHealthy
                    : DashboardStyles.statusUnhealthy,
                ]}
              >
                {healthStatus.status?.toUpperCase() || 'UNKNOWN'}
              </Text>
            </View>
            {healthStatus.database && (
              <View style={DashboardStyles.statusRow}>
                <Text style={DashboardStyles.statusLabel}>Database:</Text>
                <Text style={DashboardStyles.statusValue}>
                  {healthStatus.database}
                </Text>
              </View>
            )}
          </View>
        ) : (
          <Text style={DashboardStyles.loadingText}>Checking health...</Text>
        )}
      </View>

      {/* Workers Section */}
      <View style={DashboardStyles.card}>
        <Text style={DashboardStyles.cardTitle}>Workers</Text>
        <View style={DashboardStyles.emptyState}>
          <Text style={DashboardStyles.emptyStateText}>No workers registered</Text>
          <Text style={DashboardStyles.emptyStateSubtext}>
            Workers will appear here once they register with the conductor
          </Text>
        </View>
      </View>

      {/* Services Section */}
      <View style={DashboardStyles.card}>
        <Text style={DashboardStyles.cardTitle}>Services</Text>
        <View style={DashboardStyles.emptyState}>
          <Text style={DashboardStyles.emptyStateText}>No services deployed</Text>
          <Text style={DashboardStyles.emptyStateSubtext}>
            Deploy services from the conductor dashboard
          </Text>
        </View>
      </View>
    </ScrollView>
  );
};
