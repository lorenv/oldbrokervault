// Test script to check share endpoint
import fetch from 'node-fetch';

async function testShare() {
  try {
    const response = await fetch('http://localhost:5000/api/share/cim-e229m1');
    console.log('Status:', response.status);
    const data = await response.text();
    console.log('Response:', data);
  } catch (error) {
    console.error('Error:', error);
  }
}

testShare();