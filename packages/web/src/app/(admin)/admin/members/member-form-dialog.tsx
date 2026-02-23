'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Member {
  id: string;
  discordId: string;
  discordUsername: string;
  name: string;
  part: string;
  blogUrl: string;
  rssUrl: string | null;
  status: string;
}

interface MemberFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  member: Member | null;
}

/**
 * Member Form Dialog
 * For creating and editing members
 * Requirements: 19.1, 19.2, 19.3, 19.4
 */
export function MemberFormDialog({
  open,
  onClose,
  onSuccess,
  member,
}: MemberFormDialogProps) {
  const [formData, setFormData] = useState({
    name: '',
    part: '',
    discordId: '',
    discordUsername: '',
    blogUrl: '',
    rssUrl: '',
  });
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
        blogUrl: member.blogUrl,
        rssUrl: member.rssUrl || '',
      });
    } else {
      setFormData({
        name: '',
        part: '',
        discordId: '',
        discordUsername: '',
        blogUrl: '',
        rssUrl: '',
      });
    }
    setErrors([]);
  }, [member, open]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const validateForm = (): boolean => {
    const newErrors: string[] = [];

    // Required fields validation (Requirement: 19.2)
    if (!formData.name.trim()) {
      newErrors.push('이름은 필수입니다.');
    }
    if (!formData.part.trim()) {
      newErrors.push('파트는 필수입니다.');
    }
    if (!formData.discordId.trim()) {
      newErrors.push('Discord ID는 필수입니다.');
    }
    if (!formData.blogUrl.trim()) {
      newErrors.push('블로그 URL은 필수입니다.');
    }

    // URL format validation
    if (formData.blogUrl.trim()) {
      try {
        new URL(formData.blogUrl.trim());
      } catch {
        newErrors.push('유효하지 않은 블로그 URL 형식입니다.');
      }
    }

    if (formData.rssUrl.trim()) {
      try {
        new URL(formData.rssUrl.trim());
      } catch {
        newErrors.push('유효하지 않은 RSS URL 형식입니다.');
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
          blogUrl: formData.blogUrl.trim(),
          rssUrl: formData.rssUrl.trim() || null,
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
      <div
        className="fixed inset-0 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative z-50 w-full max-w-md rounded-lg border bg-background p-6 shadow-lg">
        <h2 className="text-lg font-semibold mb-4">
          {isEditing ? '멤버 수정' : '멤버 추가'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Error messages */}
          {errors.length > 0 && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
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
            />
          </div>

          {/* Blog URL field */}
          <div className="space-y-2">
            <Label htmlFor="blogUrl">
              블로그 URL <span className="text-destructive">*</span>
            </Label>
            <Input
              id="blogUrl"
              name="blogUrl"
              value={formData.blogUrl}
              onChange={handleChange}
              placeholder="https://velog.io/@username"
            />
          </div>

          {/* RSS URL field */}
          <div className="space-y-2">
            <Label htmlFor="rssUrl">RSS URL</Label>
            <Input
              id="rssUrl"
              name="rssUrl"
              value={formData.rssUrl}
              onChange={handleChange}
              placeholder="https://v2.velog.io/rss/@username"
            />
            <p className="text-xs text-muted-foreground">
              비워두면 자동으로 감지합니다.
            </p>
          </div>

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
