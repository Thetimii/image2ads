'use client';

import { useState } from 'react';

interface ImageItem {
  id: string;
  name: string;
  thumb: string;
  file_path: string;
}

interface GenerateJobFormProps {
  userImages: ImageItem[];
  onGenerateAction: (imageIds: string[], prompt: string, model: string) => void;
}

export default function GenerateJobForm({ userImages, onGenerateAction }: GenerateJobFormProps) {
  const [selectedImages, setSelectedImages] = useState<ImageItem[]>([]);
  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState('openai-high-landscape');

  const toggleImageSelection = (image: ImageItem) => {
    setSelectedImages(prev => {
      const exists = prev.find(p => p.id === image.id);
      if (exists) {
        return prev.filter(p => p.id !== image.id);
      } else {
        return [...prev, image];
      }
    });
  };

  const setAsScene = (id: string) => {
    setSelectedImages(prev => {
      const index = prev.findIndex(p => p.id === id);
      if (index < 0) return prev;
      const clone = [...prev];
      const [scene] = clone.splice(index, 1);
      return [scene, ...clone]; // move to front
    });
  };

  const handleGenerate = async () => {
    if (selectedImages.length < 2) {
      alert("Pick a scene and at least one reference");
      return;
    }
    
    const imageIds = selectedImages.map(p => p.id); // first = scene
    onGenerateAction(imageIds, prompt, model);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-medium text-blue-900 mb-2">How it works:</h3>
        <p className="text-blue-800 text-sm">
          The <strong>first image</strong> is used as the <strong>base scene</strong> (background/person). 
          All later images are <strong>references</strong> (products) that guide the edit.
          Select at least 2 images and use "Set as Scene" to reorder.
        </p>
      </div>

      {/* Image Library */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Select Images from Your Library</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {userImages.map((image) => (
            <div
              key={image.id}
              className={`relative cursor-pointer border-2 rounded-lg overflow-hidden transition-all ${
                selectedImages.find(s => s.id === image.id)
                  ? 'border-blue-500 ring-2 ring-blue-200'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => toggleImageSelection(image)}
            >
              <img
                src={image.thumb}
                alt={image.name}
                className="w-full h-24 object-cover"
              />
              <div className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-10 transition-all" />
              {selectedImages.find(s => s.id === image.id) && (
                <div className="absolute top-1 right-1 bg-blue-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">
                  ✓
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Selected Images Management */}
      {selectedImages.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-4">Selected Images ({selectedImages.length})</h3>
          <div className="space-y-3">
            {selectedImages.map((image, idx) => (
              <div key={image.id} className="flex items-center gap-4 p-3 border rounded-lg">
                <img src={image.thumb} className="h-12 w-12 rounded object-cover" />
                <span className="flex-1 font-medium">{image.name}</span>
                
                {idx === 0 ? (
                  <span className="px-3 py-1 text-xs rounded-full bg-blue-100 text-blue-800 font-medium">
                    Scene (Base)
                  </span>
                ) : (
                  <div className="flex gap-2">
                    <span className="px-3 py-1 text-xs rounded-full bg-green-100 text-green-800">
                      Reference {idx}
                    </span>
                    <button
                      onClick={() => setAsScene(image.id)}
                      className="text-sm text-blue-600 hover:text-blue-800 underline"
                    >
                      Set as Scene
                    </button>
                  </div>
                )}
                
                <button
                  onClick={() => toggleImageSelection(image)}
                  className="text-red-500 hover:text-red-700 text-sm"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Generation Settings */}
      <div className="space-y-4">
        <div>
          <label htmlFor="prompt" className="block text-sm font-medium text-gray-700 mb-2">
            Generation Prompt
          </label>
          <textarea
            id="prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe how you want the products integrated into the scene..."
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            rows={3}
          />
        </div>

        <div>
          <label htmlFor="model" className="block text-sm font-medium text-gray-700 mb-2">
            Quality & Aspect Ratio
          </label>
          <select
            id="model"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="openai-high-landscape">High Quality - Landscape (1536x1024)</option>
            <option value="openai-high-portrait">High Quality - Portrait (1024x1536)</option>
            <option value="openai-high-square">High Quality - Square (1024x1024)</option>
            <option value="openai-medium-landscape">Medium Quality - Landscape</option>
            <option value="openai-medium-portrait">Medium Quality - Portrait</option>
            <option value="openai-low-landscape">Low Quality - Landscape (Fast)</option>
          </select>
        </div>
      </div>

      {/* Generate Button */}
      <button
        onClick={handleGenerate}
        disabled={selectedImages.length < 2}
        className={`w-full py-3 px-6 rounded-lg font-medium transition-all ${
          selectedImages.length >= 2
            ? 'bg-blue-600 hover:bg-blue-700 text-white'
            : 'bg-gray-200 text-gray-500 cursor-not-allowed'
        }`}
      >
        {selectedImages.length < 2
          ? 'Select at least 2 images (1 scene + 1 reference)'
          : `Generate with ${selectedImages.length} images (1 credit)`
        }
      </button>
    </div>
  );
}