// Test script to debug image-to-image generation
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxbmFvb2ljZnhxdG5idXdzb3B1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc3NTg1OTEsImV4cCI6MjA3MzMzNDU5MX0.bbJa_YDQ8UBG_btL4G0lGKVUehQip1j-T-A86qN5TXA'

async function testImageGeneration() {
  console.log('Testing image-to-image endpoint...')
  
  try {
    // First, let's just test if the endpoint is reachable
    const testResponse = await fetch('https://cqnaooicfxqtnbuwsopu.supabase.co/functions/v1/generate-image-image', {
      method: 'OPTIONS',
      headers: {
        'Origin': 'http://localhost:3000'
      }
    })
    
    console.log('OPTIONS request status:', testResponse.status)
    console.log('OPTIONS headers:', Object.fromEntries(testResponse.headers.entries()))
    
    // Now test a POST with a dummy jobId to see what error we get
    const postResponse = await fetch('https://cqnaooicfxqtnbuwsopu.supabase.co/functions/v1/generate-image-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Origin': 'http://localhost:3000'
      },
      body: JSON.stringify({ jobId: 'test-job-id' })
    })
    
    console.log('POST request status:', postResponse.status)
    console.log('POST headers:', Object.fromEntries(postResponse.headers.entries()))
    
    const responseText = await postResponse.text()
    console.log('Response body:', responseText)
    
    try {
      const responseJson = JSON.parse(responseText)
      console.log('Parsed response:', responseJson)
    } catch (e) {
      console.log('Could not parse as JSON')
    }
    
  } catch (error) {
    console.error('Test failed:', error)
  }
}

testImageGeneration()