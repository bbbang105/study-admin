'use client';

import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { MEMBER_STATUS_CONFIG } from '@/lib/member-config';

// 멤버당 블로그 최대 개수 (서버 MAX_BLOGS_PER_MEMBER와 동일, 서버가 최종 검증)
const MAX_BLOGS = 3;

interface MemberBlog {
  id: string;
  label: string | null;
  blogUrl: string;
  rssConsent: boolean;
}

interface Member {
  id: string;
  discordId: string;
  discordUsername: string;
  name: string;
  part: string;
  blogs: MemberBlog[];
  status: string;
}

interface BlogItem {
  key: string;
  id?: string;
  label: string;
  blogUrl: string;
  rssConsent: boolean;
}

interface MemberFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  member: Member | null;
}

let blogKeySeq = 0;
const newBlogKey = () => `blog-${Date.now()}-${blogKeySeq++}`;
const emptyBlog = (): BlogItem => ({
  key: newBlogKey(),
  label: '',
  blogUrl: '',
  rssConsent: true,
});

/**
 * Member Form Dialog
 * For creating and editing members
 * Requirements: 19.1, 19.2, 19.3, 19.4
 */
export function MemberFormDialog({ open, onClose, onSuccess, member }: MemberFormDialogProps) {
  const [formData, setFormData] = useState({
    name: '',
    part: '',
    discordId: '',
    discordUsername: '',
    status: 'active',
  });
  const [blogs, setBlogs] = useState<BlogItem[]>([emptyBlog()]);
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const isEditing = !!member;

  useEffect(() => {
    if (member) {
      setFormData({
        name: member.name,
        part: member.part,
        discordId: member.discordId,
        discordUsername: member.discordUsername,
        status: member.status,
      });
      setBlogs(
        member.blogs.length > 0
          ? member.blogs.map((b) => ({
              key: newBlogKey(),
              id: b.id,
              label: b.label ?? '',
              blogUrl: b.blogUrl,
              rssConsent: b.rssConsent,
            }))
          : [emptyBlog()]
      );
    } else {
      setFormData({
        name: '',
        part: '',
        discordId: '',
        discordUsername: '',
        status: 'active',
      });
      setBlogs([emptyBlog()]);
    }
    setErrors([]);
  }, [member, open]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const addBlog = () => {
    setBlogs((prev) => (prev.length >= MAX_BLOGS ? prev : [...prev, emptyBlog()]));
  };

  const removeBlog = (key: string) => {
    setBlogs((prev) => (prev.length <= 1 ? prev : prev.filter((b) => b.key !== key)));
  };

  const updateBlog = (key: string, patch: Partial<Omit<BlogItem, 'key'>>) => {
    setBlogs((prev) => prev.map((b) => (b.key === key ? { ...b, ...patch } : b)));
  };

  const validateForm = (): boolean => {
    const newErrors: string[] = [];

    if (!formData.name.trim()) {
      newErrors.push('이름은 필수입니다.');
    }
    if (!formData.part.trim()) {
      newErrors.push('파트는 필수입니다.');
    }
    if (!formData.discordId.trim()) {
      newErrors.push('Discord ID는 필수입니다.');
    }

    if (blogs.length === 0) {
      newErrors.push('블로그를 1개 이상 등록해주세요.');
    }
    if (blogs.length > MAX_BLOGS) {
      newErrors.push(`블로그는 최대 ${MAX_BLOGS}개까지 등록할 수 있습니다.`);
    }
    for (const b of blogs) {
      if (!b.blogUrl.trim()) {
        newErrors.push('블로그 URL은 필수입니다.');
        break;
      }
    }
    for (const b of blogs) {
      if (b.blogUrl.trim()) {
        try {
          new URL(b.blogUrl.trim());
        } catch {
          newErrors.push(`유효하지 않은 블로그 URL 형식입니다: ${b.blogUrl.trim()}`);
        }
      }
    }

    setErrors(newErrors);
    return newErrors.length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setErrors([]);

    try {
      const url = isEditing ? `/api/admin/members/${member.id}` : '/api/admin/members';
      const method = isEditing ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          part: formData.part.trim(),
          discordId: formData.discordId.trim(),
          discordUsername: formData.discordUsername.trim() || formData.discordId.trim(),
          blogs: blogs.map((b) => ({
            id: b.id,
            label: b.label.trim() || null,
            blogUrl: b.blogUrl.trim(),
            rssConsent: b.rssConsent,
          })),
          ...(isEditing && { status: formData.status }),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setErrors([data.message || '오류가 발생했습니다.']);
        return;
      }

      onSuccess();
    } catch (err) {
      setErrors(['서버 오류가 발생했습니다.']);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-background/80 backdrop-blur-xs" onClick={onClose} />

      {/* Dialog */}
      <div className="relative z-50 w-full max-w-md max-h-[90vh] overflow-y-auto rounded-lg border bg-background p-6 shadow-lg">
        <h2 className="text-lg font-semibold mb-4">{isEditing ? '멤버 수정' : '멤버 추가'}</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Error messages */}
          {errors.length > 0 && (
            <div
              role="alert"
              aria-live="assertive"
              id="form-errors"
              className="rounded-md bg-destructive/10 p-3 text-sm text-destructive"
            >
              {errors.map((error, index) => (
                <p key={index}>{error}</p>
              ))}
            </div>
          )}

          {/* Name field */}
          <div className="space-y-2">
            <Label htmlFor="name">
              이름 <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="홍길동"
              aria-invalid={errors.some((e) => e.includes('이름'))}
              aria-describedby={errors.length > 0 ? 'form-errors' : undefined}
            />
          </div>

          {/* Part field */}
          <div className="space-y-2">
            <Label htmlFor="part">
              파트 <span className="text-destructive">*</span>
            </Label>
            <Input
              id="part"
              name="part"
              value={formData.part}
              onChange={handleChange}
              placeholder="frontend, backend, design, pm 등"
              aria-invalid={errors.some((e) => e.includes('파트'))}
              aria-describedby={errors.length > 0 ? 'form-errors' : undefined}
            />
          </div>

          {/* Discord ID field */}
          <div className="space-y-2">
            <Label htmlFor="discordId">
              Discord ID <span className="text-destructive">*</span>
            </Label>
            <Input
              id="discordId"
              name="discordId"
              value={formData.discordId}
              onChange={handleChange}
              placeholder="123456789012345678"
              aria-invalid={errors.some((e) => e.includes('Discord ID'))}
              aria-describedby={errors.length > 0 ? 'form-errors' : undefined}
            />
          </div>

          {/* Discord Username field */}
          <div className="space-y-2">
            <Label htmlFor="discordUsername">Discord 사용자명</Label>
            <Input
              id="discordUsername"
              name="discordUsername"
              value={formData.discordUsername}
              onChange={handleChange}
              placeholder="username#1234"
              aria-describedby={errors.length > 0 ? 'form-errors' : undefined}
            />
          </div>

          {/* Blogs */}
          <div className="space-y-3">
            <Label>
              블로그 <span className="text-destructive">*</span>
              <span className="text-xs text-muted-foreground ml-2">(최대 {MAX_BLOGS}개)</span>
            </Label>
            {blogs.map((blog, idx) => (
              <div key={blog.key} className="space-y-2 rounded-md border p-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground">블로그 {idx + 1}</p>
                  {blogs.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-destructive"
                      onClick={() => removeBlog(blog.key)}
                      aria-label={`블로그 ${idx + 1} 삭제`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
                <Input
                  value={blog.label}
                  onChange={(e) => updateBlog(blog.key, { label: e.target.value })}
                  placeholder="이름 (선택) — 예: 기술 블로그"
                  maxLength={100}
                />
                <Input
                  value={blog.blogUrl}
                  onChange={(e) => updateBlog(blog.key, { blogUrl: e.target.value })}
                  placeholder="https://velog.io/@username"
                  aria-invalid={
                    errors.length > 0 &&
                    (!blog.blogUrl.trim() || errors.some((e) => e.includes(blog.blogUrl.trim())))
                  }
                />
                <div className="flex items-center justify-between rounded-md border px-2.5 py-2">
                  <Label htmlFor={`mfd-rss-${blog.key}`} className="text-xs font-medium">
                    RSS 자동 수집
                  </Label>
                  <Switch
                    id={`mfd-rss-${blog.key}`}
                    checked={blog.rssConsent}
                    onCheckedChange={(checked) => updateBlog(blog.key, { rssConsent: checked })}
                  />
                </div>
              </div>
            ))}
            {blogs.length < MAX_BLOGS && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                onClick={addBlog}
              >
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                블로그 추가 ({blogs.length}/{MAX_BLOGS})
              </Button>
            )}
            <p className="text-xs text-muted-foreground">
              RSS URL은 블로그 주소로부터 자동 감지됩니다.
            </p>
          </div>

          {/* Status field (edit mode only) */}
          {isEditing && (
            <div className="space-y-2">
              <Label htmlFor="status">상태</Label>
              <select
                id="status"
                name="status"
                value={formData.status}
                onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value }))}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {Object.entries(MEMBER_STATUS_CONFIG).map(([value, config]) => (
                  <option key={value} value={value}>
                    {config.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              취소
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? '처리 중...' : isEditing ? '수정' : '추가'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
