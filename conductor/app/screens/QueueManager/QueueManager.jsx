import React from 'react';
import { IntegrationHub } from '../IntegrationHub/IntegrationHub';

export const QueueManager = (props) => (
  <IntegrationHub
    {...props}
    serviceName="queue_manager"
    title="Message Queues"
    subtitle="Durable queues for async workloads — SQS-style."
    listPath="/v1/queues"
    listKey="queues"
    createFields={[
      { key: 'name', label: 'Queue name', placeholder: 'my-queue' },
      { key: 'engine', label: 'Engine (standard|fifo|rabbitmq|redis_stream)', placeholder: 'standard' },
    ]}
  />
);
