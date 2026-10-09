#!/usr/bin/env node

/**
 * Test script to verify server resilience and error handling
 * Run this with: node test-resilience.js
 */

import axios from 'axios';
import { spawn } from 'child_process';
import path from 'path';

const SERVER_URL = 'http://localhost:3000';
const TEST_ENDPOINTS = [
  '/health',
  '/api/test',
  '/',
  '/nonexistent' // Should return 404
];

console.log('🧪 Starting server resilience tests...\n');

/**
 * Test if server responds to basic requests
 */
async function testBasicConnectivity() {
  console.log('📡 Testing basic server connectivity...');
  
  for (const endpoint of TEST_ENDPOINTS) {
    try {
      const response = await axios.get(`${SERVER_URL}${endpoint}`, {
        timeout: 5000,
        validateStatus: () => true // Accept any status code
      });
      
      console.log(`✅ ${endpoint}: ${response.status} - ${response.statusText}`);
      
      if (endpoint === '/health') {
        console.log(`   Database: ${response.data.database?.status || 'Unknown'}`);
        console.log(`   Server Status: ${response.data.status}`);
      }
    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        console.log(`❌ ${endpoint}: Server not running`);
      } else {
        console.log(`❌ ${endpoint}: ${error.message}`);
      }
    }
  }
  console.log('');
}

/**
 * Test server startup resilience
 */
async function testServerStartup() {
  console.log('🚀 Testing server startup resilience...');
  
  return new Promise((resolve) => {
    const serverProcess = spawn('node', ['index.js'], {
      cwd: process.cwd(),
      stdio: 'pipe'
    });
    
    let output = '';
    let hasError = false;
    
    serverProcess.stdout.on('data', (data) => {
      output += data.toString();
      console.log(`   stdout: ${data.toString().trim()}`);
      
      if (data.toString().includes('Server running')) {
        console.log('✅ Server started successfully');
        serverProcess.kill();
        resolve(true);
      }
    });
    
    serverProcess.stderr.on('data', (data) => {
      output += data.toString();
      console.log(`   stderr: ${data.toString().trim()}`);
      
      if (data.toString().includes('MongoDB connection failed')) {
        console.log('⚠️ Server handling database connection failure gracefully');
      }
    });
    
    serverProcess.on('error', (error) => {
      console.log(`❌ Server startup error: ${error.message}`);
      hasError = true;
      resolve(false);
    });
    
    serverProcess.on('exit', (code) => {
      if (code !== null && code !== 0 && !hasError) {
        console.log(`❌ Server exited with code: ${code}`);
        resolve(false);
      } else if (!hasError) {
        console.log('✅ Server startup test completed');
        resolve(true);
      }
    });
    
    // Kill server after 15 seconds if it doesn't start
    setTimeout(() => {
      if (!serverProcess.killed) {
        console.log('⏰ Test timeout - killing server process');
        serverProcess.kill();
        resolve(false);
      }
    }, 15000);
  });
}

/**
 * Run all tests
 */
async function runTests() {
  try {
    console.log('📋 Server Resilience Test Suite');
    console.log('================================\n');
    
    // Test 1: Basic connectivity (assumes server is running)
    await testBasicConnectivity();
    
    // Test 2: Server startup resilience
    const startupSuccess = await testServerStartup();
    
    console.log('\n📊 Test Summary:');
    console.log('================');
    console.log(`Server Startup: ${startupSuccess ? '✅ PASS' : '❌ FAIL'}`);
    console.log('\n💡 Tips:');
    console.log('- Test with internet disconnected to verify graceful degradation');
    console.log('- Check /health endpoint for detailed system status');
    console.log('- Monitor server logs for error handling messages');
    
  } catch (error) {
    console.error('❌ Test suite error:', error.message);
  }
}

// Handle command line arguments
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Usage: node test-resilience.js [options]

Options:
  --help, -h     Show this help message
  --connectivity Test only basic connectivity
  --startup      Test only server startup

Examples:
  node test-resilience.js                    # Run all tests
  node test-resilience.js --connectivity     # Test only connectivity
  node test-resilience.js --startup          # Test only startup
`);
  process.exit(0);
}

if (args.includes('--connectivity')) {
  testBasicConnectivity();
} else if (args.includes('--startup')) {
  testServerStartup();
} else {
  runTests();
}
