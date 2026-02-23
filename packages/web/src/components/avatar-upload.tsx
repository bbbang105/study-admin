'use client';

import { useCallback, useRef, useState } from 'react';
import { Upload, Loader2, X, Dices, RefreshCw } from 'lucide-react';
import { uploadAvatar } from '@/lib/storage';
import { Button } from '@/components/ui/button';

const DICEBEAR_STYLES = ['fun-emoji', 'adventurer', 'bottts', 'thumbs', 'lorelei'] as const;

function generateRandomAvatars(): string[] {
  const avatars: string[] = [];
  for (let i = 0; i < 8; i++) {
    const style = DICEBEAR_STYLES[Math.floor(Math.random() * DICEBEAR_STYLES.length)];
    const seed = Math.random().toString(36).substring(2, 10);
    avatars.push(`https://api.dicebear.com/9.x/${style}/svg?seed=${seed}`);
  }
  return avatars;
}

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
  const [randomAvatars, setRandomAvatars] = useState<string[] | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    setUploading(true);
    setRandomAvatars(null);

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

  const handleRandomGenerate = () => {
    setRandomAvatars(generateRandomAvatars());
  };

  const handleSelectRandom = (url: string) => {
    setPreviewUrl(url);
    onUploadComplete(url);
    setRandomAvatars(null);
  };

  const displayUrl = previewUrl || currentImageUrl;

  return (
    <div className="space-y-3">
      {/* Upload area */}
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

      {/* Random avatar generator */}
      <div className="space-y-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full gap-2 text-xs"
          onClick={handleRandomGenerate}
        >
          {randomAvatars ? (
            <>
              <RefreshCw className="h-3.5 w-3.5" />
              다시 뽑기
            </>
          ) : (
            <>
              <Dices className="h-3.5 w-3.5" />
              랜덤 아바타 뽑기
            </>
          )}
        </Button>

        {randomAvatars && (
          <div className="grid grid-cols-4 gap-2 rounded-lg border border-border bg-muted/30 p-3">
            {randomAvatars.map((url, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSelectRandom(url)}
                className="group relative aspect-square rounded-full overflow-hidden border-2 border-transparent hover:border-primary transition-all hover:scale-105"
              >
                <img
                  src={url}
                  alt={`랜덤 아바타 ${idx + 1}`}
                  className="w-full h-full object-cover bg-background"
                />
              </button>
            ))}
          </div>
        )}
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
