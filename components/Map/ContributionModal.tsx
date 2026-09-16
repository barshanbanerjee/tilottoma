"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface ContributionModalProps {
  points: { lat: number; lng: number }[];
  initialName?: string;
  onClose: () => void;
}

export default function ContributionModal({ points, initialName = '', onClose }: ContributionModalProps) {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState('');
  const [sources, setSources] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || points.length < 2) return;

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/contributions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          description,
          sources,
          points,
        }),
      });

      if (!res.ok) throw new Error('Failed to submit contribution');

      alert('Contribution submitted successfully! An admin will review it soon.');
      onClose();
      router.refresh();
    } catch (error) {
      console.error(error);
      alert('Error submitting contribution. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-9999 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="bg-zinc-50 px-6 py-4 border-b border-zinc-100 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-zinc-900">Add a Street or Place</h2>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 transition-colors"
          >
            ✕
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-zinc-700 mb-1">
              Street/Place Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="name"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              placeholder="e.g. Park Street"
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-zinc-700 mb-1">
              Description
            </label>
            <textarea
              id="description"
              rows={3}
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all resize-none"
              placeholder="Historical background, significance, etc."
            />
          </div>

          <div>
            <label htmlFor="sources" className="block text-sm font-medium text-zinc-700 mb-1">
              Sources
            </label>
            <textarea
              id="sources"
              rows={3}
              value={sources}
              onChange={e => setSources(e.target.value)}
              className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all resize-none"
              placeholder="Links to articles, books, or text citations (one per line recommended)"
            />
          </div>

          <div className="pt-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name}
              className="px-6 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 shadow-sm"
            >
              {isSubmitting ? 'Submitting...' : 'Submit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
