import React from 'react';
import { Text } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { Page, Card, ListRow } from '../../components/ui';

export const Menu = ({ navigation }) => {
  const { user, logout } = useAuth();

  return (
    <Page title="More" subtitle={user ? `${user.username || 'User'}${user.email ? ` · ${user.email}` : ''}` : ''}>
      {user ? (
        <Card>
          <Text>{user.username || 'User'}</Text>
          <Text>{user.email || ''}</Text>
        </Card>
      ) : null}
      <ListRow icon="home-outline" title="Home" onPress={() => navigation?.navigate('dashboard')} />
      <ListRow icon="folder-outline" title="Projects" onPress={() => navigation?.navigate('projects')} />
      <ListRow icon="add-outline" title="New project" onPress={() => navigation?.navigate('projectForm', { mode: 'create' })} />
      <ListRow icon="server-outline" title="Devices" onPress={() => navigation?.navigate('devices')} />
      <ListRow icon="settings-outline" title="Settings" onPress={() => navigation?.navigate('settings')} />
      <ListRow icon="log-out-outline" title="Sign out" onPress={() => logout()} />
    </Page>
  );
};
