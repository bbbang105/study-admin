'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Image, FileText, Heart, Target, ArrowRight, Check } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

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

export default function OnboardingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(1);

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

  const handleSubmit = async () => {
    setSaving(true);
    setError(null);

    try {
      const response = await fetch('/api/profile/onboarding', {
        method: 'POST',
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

      router.push('/profile');
    } catch (err) {
      setError('서버 오류가 발생했습니다.');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const nextStep = () => setStep((prev) => Math.min(prev + 1, 4));
  const prevStep = () => setStep((prev) => Math.max(prev - 1, 1));

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">프로필 작성</h1>
        <p className="text-muted-foreground">
          다른 스터디원들에게 나를 소개해보세요.
        </p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-between">
        {[1, 2, 3, 4].map((s) => (
          <div key={s} className="flex items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                s < step
                  ? 'bg-primary text-primary-foreground'
                  : s === step
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {s < step ? <Check className="h-4 w-4" /> : s}
            </div>
            {s < 4 && (
              <div
                className={`w-16 md:w-24 h-1 mx-2 ${
                  s < step ? 'bg-primary' : 'bg-muted'
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Profile Image */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Image className="h-5 w-5" />
              <CardTitle>프로필 이미지</CardTitle>
            </div>
            <CardDescription>
              프로필에 표시될 이미지 URL을 입력하세요. (선택사항)
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
              <p className="text-xs text-muted-foreground">
                JPG, PNG, WebP 형식의 이미지 URL을 입력하세요.
              </p>
            </div>
            {profileImageUrl && (
              <div className="flex justify-center">
                <img
                  src={profileImageUrl}
                  alt="Preview"
                  className="w-32 h-32 rounded-full object-cover border"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 2: Bio */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              <CardTitle>한줄 소개</CardTitle>
            </div>
            <CardDescription>
              나를 한 문장으로 소개해보세요. (선택사항)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
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
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Interests */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Heart className="h-5 w-5" />
              <CardTitle>관심 분야</CardTitle>
            </div>
            <CardDescription>
              관심 있는 분야를 선택하거나 직접 입력하세요. (선택사항)
            </CardDescription>
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
      )}

      {/* Step 4: Resolution */}
      {step === 4 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              <CardTitle>다짐</CardTitle>
            </div>
            <CardDescription>
              이번 스터디에서의 다짐을 적어보세요. (선택사항)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
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
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error Message */}
      {error && (
        <p className="text-sm text-destructive text-center">{error}</p>
      )}

      {/* Navigation Buttons */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={prevStep}
          disabled={step === 1}
        >
          이전
        </Button>
        
        {step < 4 ? (
          <Button onClick={nextStep}>
            다음
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? '저장 중...' : '완료'}
          </Button>
        )}
      </div>

      {/* Skip Button */}
      <div className="text-center">
        <Button
          variant="ghost"
          onClick={handleSubmit}
          disabled={saving}
          className="text-muted-foreground"
        >
          나중에 작성하기
        </Button>
      </div>
    </div>
  );
}
