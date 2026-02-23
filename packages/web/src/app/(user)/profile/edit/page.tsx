'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save, Image, FileText, Heart, Target } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

const INTEREST_OPTIONS = [
  'Frontend',
  'Backend',
  'DevOps',
  'Mobile',
  'AI/ML',
  'Data',
  'Security',
  'Cloud',
  'Design',
  'PM',
  'Startup',
  'Career',
];

interface ProfileData {
  member: {
    name: string;
    profileImageUrl: string | null;
    bio: string | null;
    interests: string[] | null;
    resolution: string | null;
    onboardingCompleted: boolean;
  } | null;
}

export default function ProfileEditPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Form state
  const [profileImageUrl, setProfileImageUrl] = useState('');
  const [bio, setBio] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [customInterest, setCustomInterest] = useState('');
  const [resolution, setResolution] = useState('');

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await fetch('/api/profile');
        if (!response.ok) {
          router.push('/profile');
          return;
        }
        const data: ProfileData = await response.json();
        
        if (!data.member) {
          router.push('/profile');
          return;
        }

        // Pre-fill existing data
        if (data.member.profileImageUrl) setProfileImageUrl(data.member.profileImageUrl);
        if (data.member.bio) setBio(data.member.bio);
        if (data.member.interests) setInterests(data.member.interests);
        if (data.member.resolution) setResolution(data.member.resolution);
      } catch (err) {
        console.error(err);
        router.push('/profile');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [router]);

  const toggleInterest = (interest: string) => {
    setInterests((prev) =>
      prev.includes(interest)
        ? prev.filter((i) => i !== interest)
        : [...prev, interest]
    );
  };

  const addCustomInterest = () => {
    if (customInterest.trim() && !interests.includes(customInterest.trim())) {
      setInterests((prev) => [...prev, customInterest.trim()]);
      setCustomInterest('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch('/api/profile/edit', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileImageUrl: profileImageUrl || null,
          bio: bio || null,
          interests: interests.length > 0 ? interests : null,
          resolution: resolution || null,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.message || '저장에 실패했습니다.');
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        router.push('/profile');
      }, 1000);
    } catch (err) {
      setError('서버 오류가 발생했습니다.');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">프로필 수정</h1>
          <p className="text-muted-foreground">
            프로필 정보를 수정하세요.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Profile Image */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Image className="h-5 w-5" />
              <CardTitle>프로필 이미지</CardTitle>
            </div>
            <CardDescription>
              프로필에 표시될 이미지 URL을 입력하세요.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="profileImageUrl">이미지 URL</Label>
              <Input
                id="profileImageUrl"
                placeholder="https://example.com/image.jpg"
                value={profileImageUrl}
                onChange={(e) => setProfileImageUrl(e.target.value)}
              />
            </div>
            {profileImageUrl && (
              <div className="flex justify-center">
                <img
                  src={profileImageUrl}
                  alt="Preview"
                  className="w-24 h-24 rounded-full object-cover border"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bio */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              <CardTitle>한줄 소개</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <Label htmlFor="bio">한줄 소개</Label>
            <Input
              id="bio"
              placeholder="예: 프론트엔드 개발자, 새로운 기술에 관심이 많습니다."
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={200}
            />
            <p className="text-xs text-muted-foreground text-right">
              {bio.length}/200
            </p>
          </CardContent>
        </Card>

        {/* Interests */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Heart className="h-5 w-5" />
              <CardTitle>관심 분야</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {INTEREST_OPTIONS.map((interest) => (
                <Badge
                  key={interest}
                  variant={interests.includes(interest) ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => toggleInterest(interest)}
                >
                  {interest}
                </Badge>
              ))}
            </div>
            
            {/* Custom interests */}
            {interests.filter((i) => !INTEREST_OPTIONS.includes(i)).length > 0 && (
              <>
                <Separator />
                <div className="flex flex-wrap gap-2">
                  {interests
                    .filter((i) => !INTEREST_OPTIONS.includes(i))
                    .map((interest) => (
                      <Badge
                        key={interest}
                        variant="default"
                        className="cursor-pointer"
                        onClick={() => toggleInterest(interest)}
                      >
                        {interest} ×
                      </Badge>
                    ))}
                </div>
              </>
            )}

            <div className="flex gap-2">
              <Input
                placeholder="직접 입력"
                value={customInterest}
                onChange={(e) => setCustomInterest(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addCustomInterest();
                  }
                }}
              />
              <Button type="button" variant="outline" onClick={addCustomInterest}>
                추가
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Resolution */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              <CardTitle>다짐</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <Label htmlFor="resolution">다짐</Label>
            <Input
              id="resolution"
              placeholder="예: 매주 꾸준히 글을 작성하고, 다른 분들의 글도 열심히 읽겠습니다!"
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              maxLength={300}
            />
            <p className="text-xs text-muted-foreground text-right">
              {resolution.length}/300
            </p>
          </CardContent>
        </Card>

        {/* Messages */}
        {error && (
          <p className="text-sm text-destructive text-center">{error}</p>
        )}
        {success && (
          <p className="text-sm text-success text-center">프로필이 수정되었습니다!</p>
        )}

        {/* Submit Button */}
        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            취소
          </Button>
          <Button type="submit" disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? '저장 중...' : '저장'}
          </Button>
        </div>
      </form>
    </div>
  );
}
