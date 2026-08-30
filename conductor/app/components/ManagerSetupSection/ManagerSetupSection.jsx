import React from 'react';
import { ServiceSetupWizard } from '../ServiceSetupWizard';

/**
 * Embeds the setup wizard on bespoke manager screens (cc-wizard-3).
 */
export const ManagerSetupSection = ({ serviceName, navigation, onEnabled }) => (
  <ServiceSetupWizard
    serviceName={serviceName}
    navigation={navigation}
    onEnabled={onEnabled}
    onNavigateToSecrets={
      navigation ? () => navigation.navigate('createServiceSecret') : undefined
    }
  />
);
