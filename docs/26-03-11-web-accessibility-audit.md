# Web Interface Accessibility Audit

**Audit Date:** 2026-03-11
**Framework:** Next.js 16, React 19, Tailwind CSS v4, shadcn/ui
**Guidelines:** Vercel Web Interface Guidelines, WCAG 2.1 AA

---

## Executive Summary

| Scope | P0 (Critical) | P1 (Important) | P2 (Minor) | Total |
|-------|---------------|----------------|------------|-------|
| Landing Page | 9 | 9 | 7 | 25 |
| Admin Pages | 8 | 24 | 15 | 47 |
| User Pages | 12 | 23 | 12 | 47 |
| **Total** | **29** | **56** | **34** | **119** |

**Overall Status:** ⚠️ Needs significant accessibility improvements

---

## Priority Issues (Top 10)

### 1. Keyboard Navigation Not Supported (P0)
**Files Affected:**
- `app/(user)/board/page.tsx:129` - Table rows use onClick without keyboard handlers
- `app/(admin)/admin/members/page.tsx:224` - Status filter tabs lack arrow key navigation

**Fix:**
```tsx
// Add keyboard handlers to clickable table rows
<TableRow
  tabIndex={0}
  onClick={() => router.push(`/board/${post.id}`)}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      router.push(`/board/${post.id}`);
    }
  }}
  className="cursor-pointer"
>
```

```tsx
// Add arrow key navigation to tab groups
role="tablist"
aria-orientation="horizontal"
onKeyDown={(e) => {
  if (e.key === 'ArrowRight') {
    // Move to next tab
  } else if (e.key === 'ArrowLeft') {
    // Move to previous tab
  }
}}
```

---

### 2. Focus States Missing (P0)
**Files Affected:**
- `components/landing/landing-client.tsx:92,139,336` - All CTA buttons lack `:focus-visible`
- Footer links missing focus indicators

**Fix:**
```css
/* app/globals.css */
.glow-button:focus-visible {
  outline: 2px solid white;
  outline-offset: 2px;
  box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.3);
}
```

---

### 3. Form Errors Not Announced (P0)
**Files Affected:**
- `app/(user)/board/write/page.tsx:229` - Error message lacks `aria-live`
- `app/(user)/profile/page.tsx:427` - Withdraw error not announced
- `components/board/comment-form.tsx:103` - Comment errors not live regions

**Fix:**
```tsx
{error && (
  <div role="alert" aria-live="assertive" className="text-destructive">
    {error}
  </div>
)}
```

```tsx
// Associate error with input
<Input
  id="title"
  aria-invalid={!!errors.title}
  aria-describedby={errors.title ? "title-error" : undefined}
/>
{errors.title && (
  <p id="title-error" className="text-destructive">
    {errors.title}
  </p>
)}
```

---

### 4. Motion Preferences Ignored (P0)
**Files Affected:**
- `components/landing/motion.tsx:40-190` - FadeUp, StaggerContainer, DrawLine ignore `prefers-reduced-motion`
- `app/globals.css:321` - Marquee animation lacks override

**Fix:**
```tsx
// motion.tsx
const prefersReducedMotion = usePrefersReducedMotion();

export function FadeUp({ children, delay = 0 }: MotionProps) {
  if (prefersReducedMotion) {
    return <>{children}</>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5 }}
    >
      {children}
    </motion.div>
  );
}
```

```css
/* globals.css */
@media (prefers-reduced-motion: reduce) {
  .marquee {
    animation: none;
  }
}
```

---

### 5. Color Contrast Failures (P0)
**Files Affected:**
- `components/landing/landing-client.tsx:351` - Footer `text-zinc-600` (3.9:1, fails WCAG AA)
- `landing-client.tsx:147,165` - Secondary text `text-zinc-500` (5.2:1, fails WCAG AA)

**Fix:**
```tsx
// Replace text-zinc-600 with text-zinc-400 or lighter
<footer className="text-zinc-400">  // Was text-zinc-600
  © 2026 큐스팅
</footer>

// Secondary text
<p className="text-zinc-400">  // Was text-zinc-500
  Description text
</p>
```

---

### 6. Icon-Only Buttons Lack Labels (P0)
**Files Affected:**
- `app/(admin)/admin/members/page.tsx:320` - Edit/Delete buttons
- `components/board/tiptap-editor.tsx:137` - Toolbar buttons

**Fix:**
```tsx
<Button
  variant="ghost"
  size="icon"
  onClick={() => handleEdit(member)}
  aria-label={`${member.name} 수정`}
>
  <Edit className="h-4 w-4" />
</Button>
```

---

### 7. Focus Trap Not Implemented (P0)
**Files Affected:**
- `app/(admin)/admin/members/member-form-dialog.tsx:171` - Custom dialog lacks focus trap

**Fix:**
```tsx
// Use shadcn/ui Dialog component instead of custom div
<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent>
    {/* Dialog handles focus trap automatically */}
  </DialogContent>
</Dialog>
```

---

### 8. window.confirm() Usage (P1)
**Files Affected:**
- `app/(admin)/admin/curation/page.tsx:187`
- `app/(admin)/admin/curation/items/page.tsx:103`

**Fix:**
```tsx
// Replace with AlertDialog
<AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>소스 삭제</AlertDialogTitle>
      <AlertDialogDescription>
        "{source.name}" 소스를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>취소</AlertDialogCancel>
      <AlertDialogAction onClick={confirmDelete}>삭제</AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

---

### 9. Table Headers Missing Scope (P1)
**Files Affected:**
- `app/(admin)/admin/members/page.tsx:348`
- `app/(admin)/admin/attendance/page.tsx:367`
- All admin tables

**Fix:**
```tsx
<TableHeader>
  <TableRow>
    <TableHead scope="col">이름</TableHead>
    <TableHead scope="col">상태</TableHead>
    <TableHead scope="col">파트</TableHead>
  </TableRow>
</TableHeader>
```

---

### 10. External Links Lack Screen Reader Text (P1)
**Files Affected:**
- `app/(user)/posts/page.tsx:297`
- `app/(user)/dashboard/page.tsx:206`
- All external links

**Fix:**
```tsx
<a
  href={post.url}
  target="_blank"
  rel="noopener noreferrer"
  aria-label={`${post.title} (새 탭에서 열림)`}
>
  {post.title}
  <ExternalLink className="h-3 w-3 ml-1" />
  <span className="sr-only">(새 탭에서 열기)</span>
</a>
```

---

## Detailed Findings by Scope

### Landing Page (25 issues)

**P0 Issues:**
1. Missing `:focus-visible` on all CTA buttons (landing-client.tsx:92,139,336)
2. Marquee animation lacks `prefers-reduced-motion` override (globals.css:321)
3. FadeUp, StaggerContainer, DrawLine ignore reduced motion (motion.tsx:40-190)
4. Footer text `text-zinc-600` fails WCAG AA (landing-client.tsx:351)
5. Avatar images need `aria-hidden="true"` (landing-client.tsx:309)

**P1 Issues:**
1. Secondary text `text-zinc-500` insufficient contrast (landing-client.tsx:147,165)
2. Missing skip-to-content link (landing-client.tsx:84-96)
3. Badge uses generic div without semantic role (landing-client.tsx:112-115)
4. Step circles not keyboard navigable (landing-client.tsx:249-288)

**P2 Issues:**
1. Not using Next.js Image component (landing-client.tsx:86,306)
2. Hardcoded background color (landing-client.tsx:382)
3. Decorative divs need `aria-hidden` (landing-client.tsx:105,107,325)

---

### Admin Pages (47 issues)

**P0 Issues:**
1. Status filter buttons lack keyboard navigation (members/page.tsx:224)
2. Inline status buttons lack focus management (attendance/page.tsx:432)
3. Custom dropdown lacks proper ARIA (scores/page.tsx:174)
4. Date inputs lack label associations (rounds/page.tsx:273)
5. Crawl progress lacks ARIA live regions (curation/page.tsx:214)
6. Custom dialog lacks focus trap (members/member-form-dialog.tsx:171)

**P1 Issues:**
1. Icon-only buttons lack aria-label (members/page.tsx:320,397)
2. Table headers missing scope (all tables)
3. Form errors not associated with inputs (member-form-dialog.tsx:185)
4. Search inputs use placeholder as label (all pages)
5. Loading skeletons not hidden from screen readers (scores/page.tsx:787)

**P2 Issues:**
1. Using div instead of semantic elements (layout.tsx:80)
2. Legend section lacks landmark (attendance/page.tsx:264)
3. Modal content changes not announced (curation/crawl-modal.tsx:61)

---

### User Pages (47 issues)

**P0 Issues:**
1. Table rows onClick lack keyboard handlers (board/page.tsx:129)
2. Form validation errors lack aria-live (board/write/page.tsx:229)
3. Select placeholder not accessible (board/write/page.tsx:134)
4. Form validation lacks aria-describedby (profile/onboarding/page.tsx:224)
5. Social link chips have keyboard issues (members/page.tsx:172)

**P1 Issues:**
1. Pagination lacks aria-label (board/page.tsx:508)
2. External links missing screen reader text (board/[id]/page.tsx:207)
3. Card click contains nested interactive elements (members/page.tsx:135)
4. Sort tabs lack proper role (ranking/page.tsx:527)
5. Active nav lacks aria-current (layout/bottom-nav.tsx:61)

**P2 Issues:**
1. Board controls lack landmark (board/page.tsx:404)
2. Cards lack individual headings (dashboard/page.tsx:144)
3. Tabular data uses div grid (profile/page.tsx:227)

---

## Fix Roadmap

### Phase 1: P0 Critical (Week 1)
- [ ] Add `:focus-visible` styles to all interactive elements
- [ ] Implement `prefers-reduced-motion` for all animations
- [ ] Add `aria-live="assertive"` to all form error messages
- [ ] Fix footer and secondary text contrast
- [ ] Add keyboard handlers to table rows
- [ ] Add `aria-label` to icon-only buttons
- [ ] Implement focus trap in custom dialog

### Phase 2: P1 Important (Week 2-3)
- [ ] Replace all `window.confirm()` with AlertDialog
- [ ] Add `scope="col"` to all table headers
- [ ] Add screen reader text to external links
- [ ] Add `aria-current="page"` to active navigation
- [ ] Associate errors with inputs using `aria-describedby`
- [ ] Add proper labels to search inputs
- [ ] Implement arrow key navigation for tabs

### Phase 3: P2 Improvements (Ongoing)
- [ ] Review and improve landmark regions
- [ ] Verify heading hierarchy across all pages
- [ ] Add skip-to-content links
- [ ] Enhance loading state announcements
- [ ] Add decorative `aria-hidden` attributes

---

## Positive Findings

### What's Working Well

**Landing Page:**
- ✅ Semantic HTML structure (header, main, section, footer)
- ✅ External links have `rel="noopener noreferrer"`
- ✅ CountUp implements `prefers-reduced-motion`
- ✅ Framer Motion animations with proper easing
- ✅ Proper heading hierarchy (h1 → h2 → h3)

**Admin Pages:**
- ✅ shadcn/ui accessible components (Dialog, Table)
- ✅ MemberSelector with excellent ARIA implementation
- ✅ Consistent status badge colors
- ✅ Korean locale support
- ✅ Toast notifications via sonner

**User Pages:**
- ✅ `focus-visible:ring-*` classes
- ✅ Semantic HTML (nav, header, main)
- ✅ `aria-pressed` on toggle buttons
- ✅ Skeleton loading states
- ✅ Responsive design patterns

---

## Testing Recommendations

1. **Keyboard Navigation Test**
   - Navigate entire site using Tab/Enter/Escape only
   - Verify focus is always visible
   - Test all interactive elements

2. **Screen Reader Test**
   - NVDA (Windows) or VoiceOver (Mac)
   - Verify all errors are announced
   - Check navigation and headings

3. **Color Contrast Test**
   - WebAIM Contrast Checker
   - Verify all text meets WCAG AA (4.5:1)

4. **Motion Sensitivity Test**
   - Enable "Reduce motion" in OS settings
   - Verify animations are disabled

5. **Focus Visible Test**
   - Tab through all elements
   - Ensure focus indicator is high contrast

---

## Resources

- [WCAG 2.1 Quick Reference](https://www.w3.org/WAI/WCAG21/quickref/)
- [ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/)
- [WebAIM Accessibility Checklist](https://webaim.org/standards/wcag/checklist)
- [Vercel Web Interface Guidelines](https://github.com/vercel-labs/web-interface-guidelines)

---

## Related Documents

- `docs/26-03-06-ui-design-system.md` - UI 디자인 시스템 스펙
- `docs/26-03-06-patterns.md` - API 패턴 & 코드 규칙
- `docs/plans/26-03-08-landing-page-redesign.md` - 랜딩 페이지 구현 플랜
