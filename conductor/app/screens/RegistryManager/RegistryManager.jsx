import React from 'react';
import { IntegrationHub } from '../IntegrationHub/IntegrationHub';

export const RegistryManager = (props) => (
  <IntegrationHub
    {...props}
    serviceName="registry_manager"
    title="Container Registry"
    subtitle="Private registry metadata — harvest and pull from the fleet."
    listPath="/v1/registries"
    listKey="registries"
    createFields={[
      { key: 'name', label: 'Name', placeholder: 'homelab' },
      { key: 'url', label: 'URL', placeholder: 'https://registry.example.com' },
    ]}
  />
);
