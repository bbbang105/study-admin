'use client';

import { useCallback, useRef, useState } from 'react';
import { Upload, Loader2, X } from 'lucide-react';
import { uploadAvatar } from '@/lib/storage';

interface AvatarUploadProps {
  currentImageUrl: string;
  onUploadComplete: (url: string) => void;
  userId: string;
}

export function AvatarUpload({ currentImageUrl, onUploadComplete, userId }: AvatarUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    setUploading(true);

    // Local preview
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);

    try {
      const url = await uploadAvatar(file, userId);
      onUploadComplete(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : '업로드에 실패했습니다.');
      setPreviewUrl(null);
    } finally {
      setUploading(false);
    }
  }, [userId, onUploadComplete]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    // Reset so the same file can be re-selected
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => setDragOver(false);

  const displayUrl = previewUrl || currentImageUrl;

  return (
    <div className="space-y-3">
      <div
        className={`relative flex flex-col items-center gap-3 rounded-lg border-2 border-dashed p-6 transition-colors cursor-pointer ${
          dragOver
            ? 'border-primary bg-primary/5'
            : 'border-border hover:border-primary/50'
        }`}
        onClick={() => inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        {displayUrl ? (
          <div className="relative">
            <img
              src={displayUrl}
              alt="프로필 미리보기"
              className="w-24 h-24 rounded-full object-cover border"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
            {uploading && (
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50">
                <Loader2 className="h-6 w-6 animate-spin text-white" />
              </div>
            )}
          </div>
        ) : (
          <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center">
            <Upload className="h-8 w-8 text-muted-foreground" />
          </div>
        )}

        <div className="text-center">
          <p className="text-sm font-medium">
            {uploading ? '업로드 중...' : '클릭 또는 드래그하여 이미지 업로드'}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            JPG, PNG, WebP / 최대 2MB
          </p>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleChange}
          className="hidden"
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <X className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
