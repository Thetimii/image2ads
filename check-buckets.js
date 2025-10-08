// Script to check and create storage buckets
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = 'https://cqnaooicfxqtnbuwsopu.supabase.co'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxbmFvb2ljZnhxdG5idXdzb3B1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Nzc1ODU5MSwiZXhwIjoyMDczMzM0NTkxfQ.f3SL0MmIpdjg3VJn_JawDE2GO1_thGVEpE-z8R-v3TM'

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkAndCreateBuckets() {
  console.log('Checking existing buckets...')
  
  // List existing buckets
  const { data: buckets, error: listError } = await supabase.storage.listBuckets()
  
  if (listError) {
    console.error('Error listing buckets:', listError)
    return
  }
  
  console.log('Existing buckets:', buckets?.map(b => b.name) || [])
  
  // Check if uploads bucket exists
  const uploadsExists = buckets?.some(bucket => bucket.name === 'uploads')
  const resultsExists = buckets?.some(bucket => bucket.name === 'results')
  
  if (!uploadsExists) {
    console.log('Creating uploads bucket...')
    const { data: uploadBucket, error: uploadError } = await supabase.storage.createBucket('uploads', {
      public: true,
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
      fileSizeLimit: 10485760 // 10MB
    })
    
    if (uploadError) {
      console.error('Error creating uploads bucket:', uploadError)
    } else {
      console.log('✅ Created uploads bucket successfully')
    }
  } else {
    console.log('✅ uploads bucket already exists')
  }
  
  if (!resultsExists) {
    console.log('Creating results bucket...')
    const { data: resultBucket, error: resultError } = await supabase.storage.createBucket('results', {
      public: true,
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm'],
      fileSizeLimit: 52428800 // 50MB
    })
    
    if (resultError) {
      console.error('Error creating results bucket:', resultError)
    } else {
      console.log('✅ Created results bucket successfully')
    }
  } else {
    console.log('✅ results bucket already exists')
  }
}

checkAndCreateBuckets()