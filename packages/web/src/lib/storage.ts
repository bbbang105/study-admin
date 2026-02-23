import { createClient } from '@/lib/supabase/client';

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export async function uploadAvatar(file: File, userId: string): Promise<string> {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error('파일 크기는 2MB 이하만 가능합니다.');
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error('JPG, PNG, WebP 형식만 업로드 가능합니다.');
  }

  const ext = file.name.split('.').pop() || 'jpg';
  const filePath = `${userId}/${Date.now()}.${ext}`;

  const supabase = createClient();
  const { error } = await supabase.storage
    .from('avatars')
    .upload(filePath, file, {
      contentType: file.type,
      upsert: true,
    });

  if (error) {
    console.error('Supabase Storage error:', error.message);
    throw new Error(`이미지 업로드에 실패했습니다: ${error.message}`);
  }

  const { data: urlData } = supabase.storage
    .from('avatars')
    .getPublicUrl(filePath);

  return urlData.publicUrl;
}
