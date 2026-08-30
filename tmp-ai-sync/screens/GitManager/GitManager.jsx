import React from 'react';
import { IntegrationHub } from '../IntegrationHub/IntegrationHub';

export const GitManager = (props) => (
  <IntegrationHub
    {...props}
    serviceName="git_manager"
    title="Source Repositories"
    subtitle="Git Smart HTTP — clone, push, and pull per project."
    listPath="/v1/repos"
    listKey="repositories"
    createFields={[{ key: 'name', label: 'Repository name', placeholder: 'my-repo' }]}
  />
);
