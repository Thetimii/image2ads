// Script to make storage buckets public
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = 'https://cqnaooicfxqtnbuwsopu.supabase.co'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxbmFvb2ljZnhxdG5idXdzb3B1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Nzc1ODU5MSwiZXhwIjoyMDczMzM0NTkxfQ.f3SL0MmIpdjg3VJn_JawDE2GO1_thGVEpE-z8R-v3TM'

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function makePublicBuckets() {
  console.log('Making buckets public...')
  
  // Update uploads bucket to be public
  const { data: uploadsUpdate, error: uploadsError } = await supabase.storage.updateBucket('uploads', {
    public: true
  })
  
  if (uploadsError) {
    console.error('Error updating uploads bucket:', uploadsError)
  } else {
    console.log('✅ Made uploads bucket public')
  }
  
  // Update results bucket to be public
  const { data: resultsUpdate, error: resultsError } = await supabase.storage.updateBucket('results', {
    public: true
  })
  
  if (resultsError) {
    console.error('Error updating results bucket:', resultsError)
  } else {
    console.log('✅ Made results bucket public')
  }
  
  // Verify the changes
  const { data: buckets, error: listError } = await supabase.storage.listBuckets()
  if (!listError) {
    console.log('\nUpdated bucket status:')
    buckets?.forEach(bucket => {
      console.log(`- ${bucket.name}: ${bucket.public ? 'PUBLIC ✅' : 'PRIVATE ❌'}`)
    })
  }
}

makePublicBuckets()