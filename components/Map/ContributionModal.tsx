"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Sparkles, UserCheck, X, AlertCircle, CheckCircle2 } from 'lucide-react';

interface ContributionModalProps {
  points: { lat: number; lng: number }[];
  initialName?: string;
  onClose: () => void;
}

export default function ContributionModal({ points, initialName = '', onClose }: ContributionModalProps) {
  const { user } = useAuth();
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageCaption, setImageCaption] = useState('');
  const [blogUrl, setBlogUrl] = useState('');
  const [blogTitle, setBlogTitle] = useState('');
  const [sources, setSources] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || points.length < 2) return;

    setIsSubmitting(true);
    setError('');

    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    const images = imageUrl.trim()
      ? [{ url: imageUrl.trim(), caption: imageCaption.trim() || undefined }]
      : [];

    const blogLinks = blogUrl.trim()
      ? [{ url: blogUrl.trim(), title: blogTitle.trim() || 'Reference Article' }]
      : [];

    try {
      const res = await fetch('/api/contributions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          sources: sources.trim(),
          points,
          tags,
          images,
          blogLinks,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit contribution');
      }

      setIsSuccess(true);
      router.refresh();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error submitting contribution. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-9999 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden border border-zinc-200 dark:border-zinc-800">
        <div className="bg-zinc-50 dark:bg-zinc-800/60 px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
          <div>
            <h2 className="text-base font-serif font-bold text-zinc-900 dark:text-zinc-100">
              Submit Street Contribution
            </h2>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              Your research will be archived and credited upon review
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {isSuccess ? (
          <div className="p-8 text-center space-y-4">
            <CheckCircle2 className="w-14 h-14 text-emerald-600 mx-auto" />
            <h3 className="text-lg font-serif font-bold text-zinc-900 dark:text-zinc-100">
              Contribution Received!
            </h3>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-sm mx-auto">
              Thank you, <strong>{user?.name}</strong>! Your street geometry, tags, and historical notes have been logged into the review queue.
            </p>
            <button
              onClick={onClose}
              className="mt-4 px-6 py-2.5 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-semibold rounded-xl hover:opacity-90 transition-opacity"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
            {error && (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-xs font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Contributor Attribution Badge */}
            {user && (
              <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200">
                  <UserCheck className="w-4 h-4 text-amber-700 dark:text-amber-400" />
                  <span>
                    Contributing as <strong>{user.name}</strong> ({user.role})
                  </span>
                </div>
                <span className="text-[10px] font-mono uppercase bg-amber-200/60 dark:bg-amber-900 text-amber-900 dark:text-amber-300 px-2 py-0.5 rounded-full">
                  Verified
                </span>
              </div>
            )}

            <div>
              <label htmlFor="name" className="block text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1">
                Street / Road Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                placeholder="e.g. Park Street / Mother Teresa Sarani"
              />
            </div>

            <div>
              <label htmlFor="description" className="block text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1">
                Historical Monograph / Description
              </label>
              <textarea
                id="description"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                placeholder="Origins, colonial origins, notable buildings, cultural importance..."
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1">
                Tags (comma-separated)
              </label>
              <input
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                placeholder="e.g. Colonial, Jazz Age, Cemetery, Food Street"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1">
                  Historical Image URL
                </label>
                <input
                  type="url"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder="https://..."
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1">
                  Image Caption
                </label>
                <input
                  type="text"
                  value={imageCaption}
                  onChange={(e) => setImageCaption(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder="Circa 1910 view"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1">
                  Blog / Essay Link
                </label>
                <input
                  type="url"
                  value={blogUrl}
                  onChange={(e) => setBlogUrl(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder="https://..."
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1">
                  Article Title
                </label>
                <input
                  type="text"
                  value={blogTitle}
                  onChange={(e) => setBlogTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder="e.g. The Ghosts of Park Street"
                />
              </div>
            </div>

            <div>
              <label htmlFor="sources" className="block text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1">
                Gazette Citations & Sources
              </label>
              <textarea
                id="sources"
                rows={2}
                value={sources}
                onChange={(e) => setSources(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                placeholder="e.g. Calcutta Municipal Gazette 1935, Radharaman Mitra..."
              />
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !name}
                className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors disabled:opacity-50 shadow-sm cursor-pointer"
              >
                {isSubmitting ? 'Submitting...' : 'Submit for Review'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
