'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { User, Heart, Target, ArrowRight, ArrowLeft, Check, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { AvatarUpload } from '@/components/avatar-upload';
import { Separator } from '@/components/ui/separator';
import { PART_OPTIONS } from '@/lib/part-config';

const INTEREST_OPTIONS = [
  // 개발
  '프론트엔드', '백엔드', '풀스택', '모바일', 'DevOps', '클라우드',
  '데이터 엔지니어링', '보안', '시스템 설계', '데이터베이스', '테스팅',
  // AI/트렌드
  'AI/ML', 'LLM', '데이터 사이언스', 'Web3',
  // 디자인/기획
  'UX/UI', '프로덕트 매니지먼트', '서비스 기획', '브랜딩', '디자인 시스템',
  // 커리어/성장
  '커리어 성장', '사이드 프로젝트', '스타트업', '오픈소스', '기술 블로그',
  // 인문/일상
  '독서', '글쓰기', '생산성', '자기계발', '인문학', '심리학',
  '경제/재테크', '건강/운동', '여행', '일상 기록',
];

const TOTAL_STEPS = 3;

export default function OnboardingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(1);

  // Form state
  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  const [selectedPart, setSelectedPart] = useState('');
  const [customPart, setCustomPart] = useState('');
  const [blogUrl, setBlogUrl] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [bio, setBio] = useState('');
  const [profileImageUrl, setProfileImageUrl] = useState('');
  const [resolution, setResolution] = useState('');
  const [userId, setUserId] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [instagramUrl, setInstagramUrl] = useState('');

  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        const response = await fetch('/api/auth/me');
        if (!response.ok) {
          router.push('/login');
          return;
        }
        const data = await response.json();

        // 이미 온보딩 완료한 유저는 대시보드로
        if (data.hasMemberRecord && data.onboardingCompleted) {
          router.push('/dashboard');
          return;
        }

        // Discord 정보로 pre-fill
        if (data.id) setUserId(data.id);
        if (data.nickname) setNickname(data.nickname);
        else if (data.discordUsername) setNickname(data.discordUsername);
        if (data.avatarUrl) setProfileImageUrl(data.avatarUrl);
      } catch {
        router.push('/login');
      } finally {
        setLoading(false);
      }
    };

    fetchUserInfo();
  }, [router]);

  const toggleInterest = (interest: string) => {
    setInterests((prev) => {
      if (prev.includes(interest)) {
        return prev.filter((i) => i !== interest);
      }
      if (prev.length >= 6) return prev;
      return [...prev, interest];
    });
  };

  const part = selectedPart === 'other' ? customPart.trim() : selectedPart;
  const isStep1Valid = name.trim().length > 0 && nickname.trim().length > 0 && part.length > 0 && blogUrl.trim().length > 0;
  const isStep2Valid = interests.length >= 3 && interests.length <= 6 && bio.trim().length >= 100;
  const isStep3Valid = resolution.trim().length > 0;

  const canProceed = () => {
    switch (step) {
      case 1: return isStep1Valid;
      case 2: return isStep2Valid;
      case 3: return isStep3Valid;
      default: return false;
    }
  };

  const handleSubmit = async () => {
    if (!isStep3Valid) return;

    setSaving(true);
    setError(null);

    try {
      const response = await fetch('/api/profile/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          nickname: nickname.trim(),
          part,
          blogUrl: blogUrl.trim(),
          profileImageUrl: profileImageUrl || null,
          bio: bio.trim(),
          interests,
          resolution: resolution.trim(),
          githubUrl: githubUrl.trim() || null,
          linkedinUrl: linkedinUrl.trim() || null,
          instagramUrl: instagramUrl.trim() || null,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.message || '저장에 실패했습니다.');
        return;
      }

      router.push('/dashboard');
    } catch {
      setError('서버 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const nextStep = () => setStep((prev) => Math.min(prev + 1, TOTAL_STEPS));
  const prevStep = () => setStep((prev) => Math.max(prev - 1, 1));

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">스터디 시작하기</h1>
        <p className="text-muted-foreground mt-1">
          프로필을 작성하고 스터디에 참가하세요.
        </p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-between">
        {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((s) => (
          <div key={s} className="flex items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                s < step
                  ? 'bg-primary text-primary-foreground'
                  : s === step
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {s < step ? <Check className="h-4 w-4" /> : s}
            </div>
            {s < TOTAL_STEPS && (
              <div
                className={`w-16 md:w-32 h-1 mx-2 rounded-full transition-colors ${
                  s < step ? 'bg-primary' : 'bg-muted'
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: 기본 정보 */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="h-5 w-5" />
              <CardTitle>기본 정보</CardTitle>
            </div>
            <CardDescription>
              스터디에서 사용할 기본 정보를 입력해주세요.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">
                이름 (실명) <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                placeholder="실명을 입력하세요"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={50}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="nickname">
                닉네임 <span className="text-destructive">*</span>
              </Label>
              <Input
                id="nickname"
                placeholder="스터디에서 사용할 닉네임"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                maxLength={100}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="part">
                파트 <span className="text-destructive">*</span>
              </Label>
              <select
                id="part"
                value={selectedPart}
                onChange={(e) => {
                  setSelectedPart(e.target.value);
                  if (e.target.value !== 'other') setCustomPart('');
                }}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="">파트를 선택하세요</option>
                {PART_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {selectedPart === 'other' && (
                <Input
                  placeholder="파트를 직접 입력하세요"
                  value={customPart}
                  onChange={(e) => setCustomPart(e.target.value)}
                  maxLength={50}
                />
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="blogUrl">
                블로그 URL <span className="text-destructive">*</span>
              </Label>
              <Input
                id="blogUrl"
                placeholder="https://velog.io/@username"
                value={blogUrl}
                onChange={(e) => setBlogUrl(e.target.value)}
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground">
                Velog, Tistory, Medium 등 블로그 주소를 입력하세요.
              </p>
            </div>

            <Separator />

            <div className="space-y-1">
              <p className="text-sm font-medium">소셜 링크 (선택)</p>
              <p className="text-xs text-muted-foreground">다른 스터디원들이 볼 수 있는 소셜 링크를 입력하세요.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="githubUrl">GitHub</Label>
              <Input
                id="githubUrl"
                placeholder="https://github.com/username"
                value={githubUrl}
                onChange={(e) => setGithubUrl(e.target.value)}
                maxLength={500}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="linkedinUrl">LinkedIn</Label>
              <Input
                id="linkedinUrl"
                placeholder="https://linkedin.com/in/username"
                value={linkedinUrl}
                onChange={(e) => setLinkedinUrl(e.target.value)}
                maxLength={500}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="instagramUrl">Instagram</Label>
              <Input
                id="instagramUrl"
                placeholder="https://instagram.com/username"
                value={instagramUrl}
                onChange={(e) => setInstagramUrl(e.target.value)}
                maxLength={500}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: 관심사 & 자기소개 */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Heart className="h-5 w-5" />
              <CardTitle>관심사 & 자기소개</CardTitle>
            </div>
            <CardDescription>
              다른 스터디원들에게 나를 소개해보세요.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <Label>
                관심사 <span className="text-destructive">*</span>
                <span className="text-xs text-muted-foreground ml-2">
                  ({interests.length}/6 선택, 최소 3개)
                </span>
              </Label>
              <div className="flex flex-wrap gap-2">
                {INTEREST_OPTIONS.map((interest) => (
                  <Badge
                    key={interest}
                    variant={interests.includes(interest) ? 'default' : 'outline'}
                    className={`cursor-pointer transition-colors ${
                      !interests.includes(interest) && interests.length >= 6
                        ? 'opacity-50 cursor-not-allowed'
                        : ''
                    }`}
                    onClick={() => toggleInterest(interest)}
                  >
                    {interest}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio">
                자기소개 <span className="text-destructive">*</span>
                <span className="text-xs text-muted-foreground ml-2">
                  (최소 100자, 최대 200자)
                </span>
              </Label>
              <textarea
                id="bio"
                placeholder="어떤 일을 하고 있는지, 스터디에서 어떤 글을 쓸 계획인지 자유롭게 소개해주세요."
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={200}
                rows={4}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
              />
              <p className={`text-xs text-right ${
                bio.trim().length >= 100 ? 'text-muted-foreground' : 'text-destructive'
              }`}>
                {bio.trim().length}/100자 이상 (최대 200자)
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: 프로필 이미지 & 다짐 */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              <CardTitle>마무리</CardTitle>
            </div>
            <CardDescription>
              프로필 이미지와 다짐을 작성해주세요.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>프로필 이미지</Label>
              <AvatarUpload
                currentImageUrl={profileImageUrl}
                onUploadComplete={(url) => setProfileImageUrl(url)}
                userId={userId}
              />
              <p className="text-xs text-muted-foreground">
                Discord 프로필 이미지가 기본으로 설정됩니다. 변경을 원하면 새 이미지를 업로드하세요.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="resolution">
                다짐 <span className="text-destructive">*</span>
              </Label>
              <textarea
                id="resolution"
                placeholder="이번 스터디에서의 다짐을 적어보세요. (예: 매주 꾸준히 글을 작성하고, 다른 분들의 글도 열심히 읽겠습니다!)"
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                rows={3}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
              />
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
          <ArrowLeft className="h-4 w-4 mr-1" />
          이전
        </Button>

        {step < TOTAL_STEPS ? (
          <Button onClick={nextStep} disabled={!canProceed()}>
            다음
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <Button onClick={handleSubmit} disabled={saving || !canProceed()}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                저장 중...
              </>
            ) : (
              '완료'
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
