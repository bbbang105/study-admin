'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  ArrowLeft,
  FileText,
  Heart,
  Image,
  Link2,
  Plus,
  Save,
  Target,
  Trash2,
  User,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { AvatarUpload } from '@/components/avatar-upload';
import { Switch } from '@/components/ui/switch';
import { PART_OPTIONS } from '@/lib/part-config';
import { FormPageSkeleton } from '@/components/ui/page-state';

const INTEREST_OPTIONS = [
  // 개발
  '프론트엔드',
  '백엔드',
  '풀스택',
  '모바일',
  'DevOps',
  '클라우드',
  '데이터 엔지니어링',
  '보안',
  '시스템 설계',
  '데이터베이스',
  '테스팅',
  // AI/트렌드
  'AI',
  'LLM',
  '데이터 사이언스',
  'Web3',
  // 디자인/기획
  'UX/UI',
  '프로덕트 매니지먼트',
  '서비스 기획',
  '브랜딩',
  '디자인 시스템',
  // 커리어/성장
  '커리어 성장',
  '사이드 프로젝트',
  '스타트업',
  '오픈소스',
  '기술 블로그',
  // 인문/일상
  '독서',
  '글쓰기',
  '생산성',
  '자기계발',
  '인문학',
  '심리학',
  '경제/재테크',
  '건강/운동',
  '여행',
  '일상 기록',
];

// 멤버당 블로그 최대 개수 (서버 MAX_BLOGS_PER_MEMBER와 동일, 서버가 최종 검증)
const MAX_BLOGS = 3;

interface BlogItem {
  key: string;
  id?: string;
  label: string;
  blogUrl: string;
  rssConsent: boolean;
}

interface ProfileBlog {
  id: string;
  label: string | null;
  blogUrl: string;
  rssConsent: boolean;
}

interface ProfileData {
  user: {
    id: string;
  };
  member: {
    name: string;
    nickname: string;
    part: string;
    blogs: ProfileBlog[];
    profileImageUrl: string | null;
    bio: string | null;
    interests: string[] | null;
    resolution: string | null;
    onboardingCompleted: boolean;
    githubUrl: string | null;
    linkedinUrl: string | null;
    instagramUrl: string | null;
  } | null;
}

let blogKeySeq = 0;
const newBlogKey = () => `blog-${Date.now()}-${blogKeySeq++}`;

export default function ProfileEditPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [userId, setUserId] = useState('');
  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  const [selectedPart, setSelectedPart] = useState('');
  const [customPart, setCustomPart] = useState('');
  const [blogs, setBlogs] = useState<BlogItem[]>([]);
  const [profileImageUrl, setProfileImageUrl] = useState('');
  const [bio, setBio] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [resolution, setResolution] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [instagramUrl, setInstagramUrl] = useState('');

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
        if (data.user?.id) setUserId(data.user.id);
        if (data.member.name) setName(data.member.name);
        if (data.member.nickname) setNickname(data.member.nickname);
        if (data.member.part) {
          const isPreset = PART_OPTIONS.some((o) => o.value === data.member!.part);
          if (isPreset) {
            setSelectedPart(data.member.part);
          } else {
            setSelectedPart('other');
            setCustomPart(data.member.part);
          }
        }
        if (Array.isArray(data.member.blogs)) {
          setBlogs(
            data.member.blogs.map((b) => ({
              key: newBlogKey(),
              id: b.id,
              label: b.label ?? '',
              blogUrl: b.blogUrl,
              rssConsent: b.rssConsent,
            }))
          );
        }
        if (data.member.profileImageUrl) setProfileImageUrl(data.member.profileImageUrl);
        if (data.member.bio) setBio(data.member.bio);
        if (data.member.interests) setInterests(data.member.interests);
        if (data.member.resolution) setResolution(data.member.resolution);
        if (data.member.githubUrl) setGithubUrl(data.member.githubUrl);
        if (data.member.linkedinUrl) setLinkedinUrl(data.member.linkedinUrl);
        if (data.member.instagramUrl) setInstagramUrl(data.member.instagramUrl);
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
    setInterests((prev) => {
      if (prev.includes(interest)) {
        return prev.filter((i) => i !== interest);
      }
      if (prev.length >= 6) return prev;
      return [...prev, interest];
    });
  };

  const addBlog = () => {
    setBlogs((prev) =>
      prev.length >= MAX_BLOGS
        ? prev
        : [...prev, { key: newBlogKey(), label: '', blogUrl: '', rssConsent: true }]
    );
  };

  const removeBlog = (key: string) => {
    setBlogs((prev) => (prev.length <= 1 ? prev : prev.filter((b) => b.key !== key)));
  };

  const updateBlog = (key: string, patch: Partial<Omit<BlogItem, 'key'>>) => {
    setBlogs((prev) => prev.map((b) => (b.key === key ? { ...b, ...patch } : b)));
  };

  const blogsValid =
    blogs.length >= 1 &&
    blogs.length <= MAX_BLOGS &&
    blogs.every((b) => b.blogUrl.trim().length > 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const part = selectedPart === 'other' ? customPart.trim() : selectedPart;
      const response = await fetch('/api/profile/edit', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim() || null,
          nickname: nickname.trim() || null,
          part: part || null,
          blogs: blogs.map((b) => ({
            id: b.id,
            label: b.label.trim() || null,
            blogUrl: b.blogUrl.trim(),
            rssConsent: b.rssConsent,
          })),
          profileImageUrl: profileImageUrl || null,
          bio: bio || null,
          interests: interests.length > 0 ? interests : null,
          resolution: resolution || null,
          githubUrl: githubUrl || null,
          linkedinUrl: linkedinUrl || null,
          instagramUrl: instagramUrl || null,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.message || result.error?.message || '저장에 실패했습니다.');
        return;
      }

      toast.success('프로필이 저장되었습니다.');
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
    return <FormPageSkeleton />;
  }

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="shrink-0" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">프로필 수정</h1>
          <p className="text-muted-foreground text-sm">프로필 정보를 수정하세요.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Name & Nickname */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="h-5 w-5" />
              <CardTitle>이름 & 닉네임</CardTitle>
            </div>
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
          </CardContent>
        </Card>

        {/* Part */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="h-5 w-5" />
              <CardTitle>파트</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <Label htmlFor="part">파트</Label>
            <select
              id="part"
              value={selectedPart}
              onChange={(e) => {
                setSelectedPart(e.target.value);
                if (e.target.value !== 'other') setCustomPart('');
              }}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
          </CardContent>
        </Card>

        {/* Profile Image */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Image className="h-5 w-5" />
              <CardTitle>프로필 이미지</CardTitle>
            </div>
            <CardDescription>프로필에 표시될 이미지 URL을 입력하세요.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <AvatarUpload
              currentImageUrl={profileImageUrl}
              onUploadComplete={(url) => setProfileImageUrl(url)}
              userId={userId}
            />
          </CardContent>
        </Card>

        {/* Bio */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              <CardTitle>자기소개</CardTitle>
            </div>
            <CardDescription>
              어떤 일을 하고 있는지, 스터디에서 어떤 글을 쓸 계획인지 자유롭게 소개해주세요.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Label htmlFor="bio">
              자기소개 <span className="text-destructive">*</span>
              <span className="text-xs text-muted-foreground ml-2">(최소 100자, 최대 200자)</span>
            </Label>
            <textarea
              id="bio"
              placeholder="어떤 일을 하고 있는지, 스터디에서 어떤 글을 쓸 계획인지 자유롭게 소개해주세요."
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={200}
              rows={4}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
            />
            <p
              className={`text-xs text-right ${
                bio.trim().length >= 100 ? 'text-muted-foreground' : 'text-destructive'
              }`}
            >
              {bio.trim().length}/100자 이상 (최대 200자)
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
            <CardDescription>
              <span className="text-xs text-muted-foreground">
                ({interests.length}/6 선택, 최소 3개)
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent>
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
            <p className="text-xs text-muted-foreground text-right">{resolution.length}/300</p>
          </CardContent>
        </Card>

        {/* Blogs */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              <CardTitle>블로그</CardTitle>
            </div>
            <CardDescription>
              블로그를 최대 {MAX_BLOGS}개까지 등록할 수 있습니다. 각 블로그별로 이름과 RSS 자동 수집
              여부를 설정하세요. 주소를 변경하면 RSS가 자동으로 재감지됩니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {blogs.map((blog, idx) => (
              <div key={blog.key} className="space-y-3 rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">블로그 {idx + 1}</p>
                  {blogs.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => removeBlog(blog.key)}
                      aria-label={`블로그 ${idx + 1} 삭제`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`blog-label-${blog.key}`}>이름 (선택)</Label>
                  <Input
                    id={`blog-label-${blog.key}`}
                    placeholder="예: 기술 블로그, 벨로그"
                    value={blog.label}
                    onChange={(e) => updateBlog(blog.key, { label: e.target.value })}
                    maxLength={100}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`blog-url-${blog.key}`}>
                    블로그 URL <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id={`blog-url-${blog.key}`}
                    placeholder="https://velog.io/@username"
                    value={blog.blogUrl}
                    onChange={(e) => updateBlog(blog.key, { blogUrl: e.target.value })}
                    maxLength={500}
                  />
                </div>
                <div className="flex items-center justify-between rounded-md border p-2.5">
                  <div className="space-y-0.5">
                    <Label htmlFor={`blog-rss-${blog.key}`} className="text-sm font-medium">
                      RSS 자동 수집
                    </Label>
                    {!blog.rssConsent && (
                      <p className="text-xs text-muted-foreground">
                        끄면 이 블로그 글을 직접 등록해야 합니다.
                      </p>
                    )}
                  </div>
                  <Switch
                    id={`blog-rss-${blog.key}`}
                    checked={blog.rssConsent}
                    onCheckedChange={(checked) => updateBlog(blog.key, { rssConsent: checked })}
                  />
                </div>
              </div>
            ))}
            {blogs.length < MAX_BLOGS && (
              <Button type="button" variant="outline" className="w-full" onClick={addBlog}>
                <Plus className="h-4 w-4 mr-2" />
                블로그 추가 ({blogs.length}/{MAX_BLOGS})
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Social Links */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              <CardTitle>소셜 링크</CardTitle>
            </div>
            <CardDescription>
              다른 스터디원들이 볼 수 있는 소셜 링크를 입력하세요. (선택)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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

        {/* Messages */}
        {error && <p className="text-sm text-destructive text-center">{error}</p>}

        {/* Submit Button */}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end sm:gap-4">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            취소
          </Button>
          <Button
            type="submit"
            disabled={
              saving ||
              !name.trim() ||
              !nickname.trim() ||
              !blogsValid ||
              interests.length < 3 ||
              bio.trim().length < 100
            }
          >
            <Save className="h-4 w-4 mr-2" />
            {saving ? '저장 중...' : '저장'}
          </Button>
        </div>
      </form>
    </div>
  );
}
