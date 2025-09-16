import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const imageId = "47890e77-071e-4cee-b98c-e67acfef8c1b";
const key = "23f23d08-1e6e-404d-b8bc-98c5731e90ee/38baf66a-a228-47b9-aae3-6a5c7c526722/1757939845123-klawrc984x.png";

console.log("=== Diagnostic Script ===");
console.log(`Checking image ID: ${imageId}`);
console.log(`Expected file path: ${key}`);
console.log("");

// 1. Check the database record
console.log("1. Checking database record...");
const { data: image, error: imageError } = await supabase
  .from("images")
  .select("id, file_path, folder_id, user_id, original_name, mime_type")
  .eq("id", imageId)
  .single();

if (imageError || !image) {
  console.log("❌ Image not found in database:", imageError?.message);
  Deno.exit(1);
} else {
  console.log("✅ Database record found:");
  console.log(`   file_path: '${image.file_path}'`);
  console.log(`   folder_id: ${image.folder_id}`);
  console.log(`   user_id: ${image.user_id}`);
  console.log(`   original_name: ${image.original_name}`);
  console.log(`   mime_type: ${image.mime_type}`);
  console.log("");
}

// 2. Check if the file exists in either bucket
console.log("2. Checking object existence in buckets...");
for (const bucket of ["uploads", "results"] as const) {
  console.log(`\nTrying bucket: ${bucket}`);
  
  const dl = await supabase.storage.from(bucket).download(image.file_path);
  if (dl.error) {
    console.log(`❌ ${bucket}: ${dl.error.message}`);
  } else if (dl.data) {
    const size = dl.data.size;
    const type = dl.data.type;
    console.log(`✅ ${bucket}: OK - ${size} bytes, content-type=${type}`);
  } else {
    console.log(`❌ ${bucket}: No data returned`);
  }
}

console.log("");
console.log("=== Parent Directory Listing ===");
const parentDir = image.file_path.split('/').slice(0, -1).join('/');
console.log(`Parent directory: ${parentDir}`);

for (const bucket of ["uploads", "results"] as const) {
  console.log(`\nListing ${bucket}/${parentDir}:`);
  const listing = await supabase.storage.from(bucket).list(parentDir, { 
    limit: 50, 
    sortBy: { column: "name", order: "asc" }
  });
  
  if (listing.error) {
    console.log(`❌ Error: ${listing.error.message}`);
  } else if (listing.data) {
    const files = listing.data.map(f => f.name);
    console.log(`✅ Found ${files.length} files:`);
    files.forEach(file => console.log(`   - ${file}`));
  } else {
    console.log("❌ No data returned");
  }
}