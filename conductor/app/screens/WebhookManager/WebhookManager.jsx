import React from 'react';
import { IntegrationHub } from '../IntegrationHub/IntegrationHub';

export const WebhookManager = (props) => (
  <IntegrationHub
    {...props}
    serviceName="webhook_manager"
    title="Webhooks"
    subtitle="Outbound HTTP webhooks with delivery logs."
    listPath="/v1/webhooks"
    listKey="webhooks"
    createFields={[
      { key: 'name', label: 'Name', placeholder: 'my-hook' },
      { key: 'url', label: 'Target URL', placeholder: 'https://example.com/hook' },
    ]}
  />
);
