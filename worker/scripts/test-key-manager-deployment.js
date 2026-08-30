#!/usr/bin/env node

/**
 * Test script to debug key_manager container deployment
 * 
 * Usage:
 *   node scripts/test-key-manager-deployment.js
 * 
 * This script will:
 * 1. Check Docker connection
 * 2. Check if key_manager directory exists
 * 3. Check if Dockerfile exists
 * 4. Try to build the image
 * 5. Try to start the container
 * 6. Check container logs
 */

require('dotenv').config();
const Docker = require('dockerode');
const path = require('path');
const fs = require('fs');
const ServiceManager = require('../docker/ServiceManager');

const docker = new Docker({ socketPath: '/var/run/docker.sock' });
const serviceManager = new ServiceManager();

async function checkDockerConnection() {
  console.log('\n[1] Checking Docker connection...');
  try {
    await docker.ping();
    console.log('✓ Docker daemon is accessible');
    return true;
  } catch (error) {
    console.error('✗ Docker daemon not accessible:', error.message);
    return false;
  }
}

async function checkKeyManagerDirectory() {
  console.log('\n[2] Checking key_manager directory...');
  const keyManagerPath = path.join(__dirname, '..', 'key_manager');
  
  if (!fs.existsSync(keyManagerPath)) {
    console.error(`✗ key_manager directory not found at: ${keyManagerPath}`);
    return false;
  }
  
  console.log(`✓ key_manager directory found: ${keyManagerPath}`);
  
  // Check for required files
  const requiredFiles = ['Dockerfile', 'Dockerfile.dev', 'package.json', 'index.js'];
  for (const file of requiredFiles) {
    const filePath = path.join(keyManagerPath, file);
    if (fs.existsSync(filePath)) {
      console.log(`  ✓ ${file} exists`);
    } else {
      console.warn(`  ⚠ ${file} not found`);
    }
  }
  
  return true;
}

async function checkExistingContainer() {
  console.log('\n[3] Checking for existing key_manager container...');
  try {
    const containerName = 'aerekos-key_manager';
    const container = await serviceManager.findContainerByName(containerName);
    
    if (container) {
      const info = await container.inspect();
      console.log(`  Found container: ${containerName}`);
      console.log(`  Status: ${info.State.Status}`);
      console.log(`  Running: ${info.State.Running}`);
      console.log(`  Image: ${info.Config.Image}`);
      
      if (info.State.Running) {
        console.log('  ✓ Container is running');
      } else {
        console.log('  ⚠ Container exists but is not running');
        console.log(`  Exit code: ${info.State.ExitCode}`);
        
        // Get logs
        try {
          const logs = await container.logs({ stdout: true, stderr: true, tail: 50 });
          console.log('\n  Last 50 lines of logs:');
          console.log(logs.toString());
        } catch (logError) {
          console.error('  Could not fetch logs:', logError.message);
        }
      }
      
      return container;
    } else {
      console.log('  No existing container found');
      return null;
    }
  } catch (error) {
    console.error('  Error checking container:', error.message);
    return null;
  }
}

async function checkImage() {
  console.log('\n[4] Checking for key_manager Docker image...');
  const imageName = 'aerekos-key_manager:latest';
  
  try {
    const image = docker.getImage(imageName);
    await image.inspect();
    console.log(`✓ Image ${imageName} exists`);
    return true;
  } catch (error) {
    if (error.statusCode === 404) {
      console.log(`✗ Image ${imageName} not found`);
      return false;
    }
    console.error(`Error checking image: ${error.message}`);
    return false;
  }
}

async function tryBuildImage() {
  console.log('\n[5] Attempting to build key_manager image...');
  const imageName = 'aerekos-key_manager:latest';
  
  try {
    console.log('  Building image (this may take a while)...');
    await serviceManager.buildServiceImage('key_manager', imageName);
    console.log(`✓ Successfully built image ${imageName}`);
    return true;
  } catch (error) {
    console.error(`✗ Failed to build image: ${error.message}`);
    console.error('  Full error:', error);
    return false;
  }
}

async function tryStartContainer() {
  console.log('\n[6] Attempting to start key_manager container...');
  
  const config = {
    docker_image: 'aerekos-key_manager:latest',
    ports: {
      '3002': '3002'
    },
    environment: [
      `CONDUCTOR_URL=${process.env.CONDUCTOR_URL || 'http://host.docker.internal:3000'}`,
      `SERVICE_NAME=key_manager`,
      `PORT=3002`,
      `NODE_ENV=${process.env.NODE_ENV || 'development'}`,
      `MASTER_KEY=${process.env.MASTER_KEY || 'dev-master-key-change-in-production'}`
    ],
    volumes: [
      // Mount key_manager data directory
      `${path.join(__dirname, '..', 'key_manager', 'data')}:/app/data`
    ]
  };
  
  try {
    const result = await serviceManager.startService('key_manager', config);
    console.log('✓ Container started successfully');
    console.log('  Container ID:', result.id);
    console.log('  Container name:', result.name);
    return result;
  } catch (error) {
    console.error(`✗ Failed to start container: ${error.message}`);
    console.error('  Full error:', error);
    return null;
  }
}

async function checkContainerLogs(containerId) {
  console.log('\n[7] Checking container logs...');
  
  try {
    const container = docker.getContainer(containerId);
    const logs = await container.logs({
      stdout: true,
      stderr: true,
      tail: 100,
      follow: false
    });
    
    console.log('  Container logs:');
    console.log(logs.toString());
  } catch (error) {
    console.error('  Could not fetch logs:', error.message);
  }
}

async function checkContainerHealth(containerId) {
  console.log('\n[8] Checking container health...');
  
  try {
    const container = docker.getContainer(containerId);
    const info = await container.inspect();
    
    console.log('  Container state:', info.State.Status);
    console.log('  Running:', info.State.Running);
    console.log('  Restart count:', info.RestartCount);
    
    if (info.State.Health) {
      console.log('  Health status:', info.State.Health.Status);
    }
    
    if (info.State.Error) {
      console.error('  Error:', info.State.Error);
    }
    
    // Try to hit health endpoint
    try {
      const axios = require('axios');
      const response = await axios.get('http://localhost:3002/health', { timeout: 5000 });
      console.log('  ✓ Health endpoint responded:', response.status);
      console.log('  Health data:', JSON.stringify(response.data, null, 2));
    } catch (healthError) {
      console.warn('  ⚠ Health endpoint not accessible:', healthError.message);
    }
  } catch (error) {
    console.error('  Error checking health:', error.message);
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('Key Manager Deployment Test Script');
  console.log('='.repeat(60));
  
  // Step 1: Check Docker
  const dockerOk = await checkDockerConnection();
  if (!dockerOk) {
    console.error('\n✗ Docker is not accessible. Cannot proceed.');
    process.exit(1);
  }
  
  // Step 2: Check directory
  const dirOk = await checkKeyManagerDirectory();
  if (!dirOk) {
    console.error('\n✗ key_manager directory check failed. Cannot proceed.');
    process.exit(1);
  }
  
  // Step 3: Check existing container
  const existingContainer = await checkExistingContainer();
  
  // Step 4: Check image
  const imageExists = await checkImage();
  
  // Step 5: Build image if needed
  if (!imageExists) {
    const buildOk = await tryBuildImage();
    if (!buildOk) {
      console.error('\n✗ Image build failed. Cannot proceed.');
      process.exit(1);
    }
  }
  
  // Step 6: Start container (or restart if exists)
  let containerResult = null;
  if (existingContainer) {
    const info = await existingContainer.inspect();
    if (!info.State.Running) {
      console.log('\n[6] Starting existing container...');
      try {
        await existingContainer.start();
        containerResult = { id: info.Id, name: 'aerekos-key_manager' };
        console.log('✓ Container started');
      } catch (error) {
        console.error('✗ Failed to start existing container:', error.message);
        // Try to create new one
        containerResult = await tryStartContainer();
      }
    } else {
      console.log('\n[6] Container is already running');
      containerResult = { id: info.Id, name: 'aerekos-key_manager' };
    }
  } else {
    containerResult = await tryStartContainer();
  }
  
  if (containerResult) {
    // Step 7: Check logs
    await checkContainerLogs(containerResult.id);
    
    // Step 8: Check health
    await new Promise(resolve => setTimeout(resolve, 3000)); // Wait a bit for service to start
    await checkContainerHealth(containerResult.id);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('Test complete!');
  console.log('='.repeat(60));
}

main().catch(error => {
  console.error('\n✗ Fatal error:', error);
  process.exit(1);
});
