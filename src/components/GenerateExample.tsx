// Example usage of the GenerateJobForm component
// This would go in your dashboard or generation page

'use client';

import { useState } from 'react';
import GenerateJobForm from '@/components/GenerateJobForm';

interface ImageItem {
  id: string;
  name: string;
  thumb: string;
  file_path: string;
}

export default function GenerateExample() {
  const [isGenerating, setIsGenerating] = useState(false);

  // Example user images - you would fetch these from your Supabase database
  const userImages: ImageItem[] = [
    {
      id: 'img-1',
      name: 'Living Room Scene',
      thumb: '/api/images/img-1/thumb',
      file_path: 'user123/folder456/living-room.jpg'
    },
    {
      id: 'img-2', 
      name: 'Product Chair',
      thumb: '/api/images/img-2/thumb',
      file_path: 'user123/folder456/chair.png'
    },
    {
      id: 'img-3',
      name: 'Product Lamp', 
      thumb: '/api/images/img-3/thumb',
      file_path: 'user123/folder456/lamp.jpg'
    }
  ];

  const handleGenerateAction = async (imageIds: string[], prompt: string, model: string) => {
    setIsGenerating(true);
    
    try {
      // Call your generation API
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_ids: imageIds,  // [sceneId, ...referenceIds] - first = scene
          prompt,
          model,
        }),
      });

      if (!response.ok) {
        throw new Error('Generation failed');
      }

      const result = await response.json();
      console.log('Generation started:', result);
      
      // Redirect to job status page or show success message
      // router.push(`/dashboard/jobs/${result.jobId}`);
      
    } catch (error) {
      console.error('Generation error:', error);
      alert('Failed to start generation');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Generate AI Images</h1>
        <p className="text-gray-600">
          Select a scene image and product references to create stunning compositions
        </p>
      </div>

      {isGenerating ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Starting generation...</p>
        </div>
      ) : (
        <GenerateJobForm 
          userImages={userImages}
          onGenerateAction={handleGenerateAction}
        />
      )}
    </div>
  );
}

// Backend API route example (/api/generate/route.ts)
/*
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { image_ids, prompt, model } = await request.json();
    
    // Validate inputs
    if (!image_ids || !Array.isArray(image_ids) || image_ids.length < 2) {
      return NextResponse.json(
        { error: 'At least 2 images required (1 scene + 1 reference)' },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Create job record
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .insert({
        user_id: 'current-user-id', // get from auth
        image_ids,                   // ordered: [scene, ...references]
        prompt: prompt || 'Insert the product references into the scene naturally',
        model: model || 'openai-high-landscape',
        status: 'pending'
      })
      .select()
      .single();

    if (jobError) {
      throw new Error(`Failed to create job: ${jobError.message}`);
    }

    // Trigger edge function
    const { data, error } = await supabase.functions.invoke('run-job', {
      body: { jobId: job.id }
    });

    if (error) {
      throw new Error(`Failed to start processing: ${error.message}`);
    }

    return NextResponse.json({ 
      success: true, 
      jobId: job.id,
      message: 'Generation started successfully'
    });

  } catch (error) {
    console.error('Generate API error:', error);
    return NextResponse.json(
      { error: (error as Error).message || 'Generation failed' },
      { status: 500 }
    );
  }
}
*/