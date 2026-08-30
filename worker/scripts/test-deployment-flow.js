#!/usr/bin/env node

/**
 * Test script to simulate the full deployment flow
 * Tests conductor -> worker -> container deployment
 * 
 * Usage:
 *   node scripts/test-deployment-flow.js
 */

require('dotenv').config();
const DeploymentHandler = require('../services/DeploymentHandler');
const ConductorService = require('../api/services/ConductorService');

async function testDeploymentFlow() {
  console.log('='.repeat(60));
  console.log('Testing Key Manager Deployment Flow');
  console.log('='.repeat(60));
  
  const conductorUrl = process.env.CONDUCTOR_URL || 'http://localhost:3000';
  const conductorService = new ConductorService(conductorUrl);
  const deploymentHandler = new DeploymentHandler(conductorService);
  
  // Simulate deployment instruction from conductor
  const instruction = {
    action: 'deploy',
    service: 'key_manager',
    config: {
      docker_image: 'aerekos-key_manager:latest',
      ports: {
        '3002': '3002'
      },
      environment: [
        `CONDUCTOR_URL=${conductorUrl}`,
        'SERVICE_NAME=key_manager',
        'PORT=3002',
        `NODE_ENV=${process.env.NODE_ENV || 'development'}`,
        `MASTER_KEY=${process.env.MASTER_KEY || 'dev-master-key-change-in-production'}`
      ],
      volumes: [
        // Mount data directory
        `${require('path').join(__dirname, '..', 'key_manager', 'data')}:/app/data`
      ]
    }
  };
  
  console.log('\n[1] Simulating deployment instruction from conductor...');
  console.log('Instruction:', JSON.stringify(instruction, null, 2));
  
  try {
    console.log('\n[2] Processing deployment instruction...');
    const result = await deploymentHandler.handleDeploymentInstruction(instruction);
    
    console.log('\n✓ Deployment successful!');
    console.log('Result:', JSON.stringify(result, null, 2));
    
    // Wait a bit and check container status
    console.log('\n[3] Waiting 5 seconds for container to start...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    const ServiceManager = require('../docker/ServiceManager');
    const serviceManager = new ServiceManager();
    const status = await serviceManager.getServiceStatus('key_manager');
    
    console.log('\n[4] Container status:');
    console.log(JSON.stringify(status, null, 2));
    
  } catch (error) {
    console.error('\n✗ Deployment failed:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

testDeploymentFlow().catch(error => {
  console.error('\n✗ Fatal error:', error);
  process.exit(1);
});
