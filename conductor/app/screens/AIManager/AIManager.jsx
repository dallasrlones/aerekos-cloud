import React from 'react';
import { ScrollView } from 'react-native';
import { ServiceGuide } from '../../components/ServiceGuide/ServiceGuide';
import { useServiceGuideDeps } from '../../hooks/useServiceGuideDeps';
import { Button } from '../../components/Button/Button';

/**
 * Legacy tile hub — ServiceGuide + hand-off into /icarus.
 * Kept so any lingering import/navigate('aiManager') still works.
 */
export function AIManager({ navigation }) {
  const { guideDeps, openDep, enableAllDeps, onSetup } = useServiceGuideDeps('ai_manager', navigation);

  const openIcarus = () => {
    navigation?.replace?.('icarus', { section: 'chat' })
      || navigation?.navigate?.('icarus', { section: 'chat' });
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <ServiceGuide
        title="Icarus (AI manager) guide"
        analogue="Amazon Bedrock + SageMaker"
        blurb="Fleet LLM/TTS/STT, RAG, agents, and benchmarks — all project-scoped behind ai_manager APIs and the Icarus console."
        whenToUse={[
          'Chat, tools, and planning in the header Icarus overlay',
          'Hosted models with key_manager + secrets_manager',
          'Corpus verify and RAG collections',
        ]}
        prerequisites={[
          'Select a project',
          'Enable auth_manager, key_manager, and secrets_manager',
        ]}
        examples={[
          {
            label: 'Seed local fleet',
            code: `POST /api/services/ai_manager/api/v1/providers/seed-local`,
          },
          {
            label: 'LLM chat',
            code: `POST .../llm/chat\n{ "messages": [{ "role": "user", "content": "hello" }] }`,
          },
        ]}
        deps={guideDeps}
        onSetupDep={openDep}
        onEnableAllDeps={enableAllDeps}
        onSetup={onSetup}
      />
      <Button title="Open Icarus console" onPress={openIcarus} />
    </ScrollView>
  );
}

export default AIManager;
