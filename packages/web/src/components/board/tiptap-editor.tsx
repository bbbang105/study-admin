'use client';

import { useState, useCallback } from 'react';
import { useEditor, EditorContent, ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { common, createLowlight } from 'lowlight';
import {
  Bold,
  Italic,
  Strikethrough,
  List,
  ListOrdered,
  Code,
  Link as LinkIcon,
  Unlink,
  Undo,
  Redo,
  Quote,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const lowlight = createLowlight(common);

// ─────────────────────────────────────────────
// Code block languages
// ─────────────────────────────────────────────

const CODE_LANGUAGES = [
  { value: '', label: 'Auto' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'python', label: 'Python' },
  { value: 'java', label: 'Java' },
  { value: 'go', label: 'Go' },
  { value: 'rust', label: 'Rust' },
  { value: 'c', label: 'C' },
  { value: 'cpp', label: 'C++' },
  { value: 'csharp', label: 'C#' },
  { value: 'ruby', label: 'Ruby' },
  { value: 'php', label: 'PHP' },
  { value: 'swift', label: 'Swift' },
  { value: 'kotlin', label: 'Kotlin' },
  { value: 'html', label: 'HTML' },
  { value: 'css', label: 'CSS' },
  { value: 'scss', label: 'SCSS' },
  { value: 'json', label: 'JSON' },
  { value: 'yaml', label: 'YAML' },
  { value: 'xml', label: 'XML' },
  { value: 'sql', label: 'SQL' },
  { value: 'bash', label: 'Bash' },
  { value: 'dockerfile', label: 'Dockerfile' },
  { value: 'markdown', label: 'Markdown' },
  { value: 'graphql', label: 'GraphQL' },
];

// ─────────────────────────────────────────────
// Custom code block with language selector
// ─────────────────────────────────────────────

function CodeBlockView({ node, updateAttributes }: NodeViewProps) {
  return (
    <NodeViewWrapper className="relative group">
      <select
        contentEditable={false}
        value={node.attrs.language || ''}
        onChange={(e) => updateAttributes({ language: e.target.value })}
        className={cn(
          'absolute right-2 top-2 z-10 rounded-md border border-border/60 bg-card px-2 py-0.5',
          'text-[11px] text-muted-foreground cursor-pointer',
          'opacity-50 group-hover:opacity-100 focus:opacity-100 transition-opacity',
          'outline-none focus:ring-1 focus:ring-ring',
        )}
      >
        {CODE_LANGUAGES.map((lang) => (
          <option key={lang.value} value={lang.value}>
            {lang.label}
          </option>
        ))}
      </select>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <pre>
        <NodeViewContent {...{ as: 'code' } as any} />
      </pre>
    </NodeViewWrapper>
  );
}

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface TiptapEditorProps {
  content?: object;
  onChange: (json: object, text: string) => void;
  placeholder?: string;
  editable?: boolean;
}

// ─────────────────────────────────────────────
// Toolbar button
// ─────────────────────────────────────────────

function ToolbarButton({
  onClick,
  active,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        'rounded-md p-1.5 transition-colors',
        active
          ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100'
          : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100'
      )}
    >
      {children}
    </button>
  );
}

// ─────────────────────────────────────────────
// Editor
// ─────────────────────────────────────────────

export function TiptapEditor({
  content,
  onChange,
  placeholder = '내용을 입력해주세요...',
  editable = true,
}: TiptapEditorProps) {
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      Link.configure({ openOnClick: false, HTMLAttributes: { class: 'text-sky-500 underline' } }),
      Placeholder.configure({ placeholder }),
      CodeBlockLowlight.extend({
        addNodeView() {
          return ReactNodeViewRenderer(CodeBlockView);
        },
      }).configure({ lowlight }),
    ],
    content: content || '',
    editable,
    onUpdate: ({ editor: e }) => {
      onChange(e.getJSON(), e.getText());
    },
  });

  const handleLinkSubmit = useCallback(() => {
    if (!editor || !linkUrl.trim()) return;
    const url = linkUrl.trim().startsWith('http') ? linkUrl.trim() : `https://${linkUrl.trim()}`;
    editor.chain().focus().setLink({ href: url }).run();
    setLinkUrl('');
    setLinkDialogOpen(false);
  }, [editor, linkUrl]);

  const handleLinkRemove = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().unsetLink().run();
  }, [editor]);

  if (!editor) return null;

  const isLinkActive = editor.isActive('link');

  return (
    <>
      <div className="rounded-md border border-zinc-200 dark:border-zinc-800">
        {editable && (
          <div className="flex flex-wrap items-center gap-0.5 border-b border-zinc-200 dark:border-zinc-800 p-1.5">
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleBold().run()}
              active={editor.isActive('bold')}
              title="굵게"
            >
              <Bold className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleItalic().run()}
              active={editor.isActive('italic')}
              title="기울임"
            >
              <Italic className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleStrike().run()}
              active={editor.isActive('strike')}
              title="취소선"
            >
              <Strikethrough className="h-4 w-4" />
            </ToolbarButton>
            <div className="mx-1 h-5 w-px bg-zinc-200 dark:bg-zinc-700" />
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              active={editor.isActive('bulletList')}
              title="글머리 기호"
            >
              <List className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              active={editor.isActive('orderedList')}
              title="번호 목록"
            >
              <ListOrdered className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
              active={editor.isActive('blockquote')}
              title="인용"
            >
              <Quote className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleCodeBlock().run()}
              active={editor.isActive('codeBlock')}
              title="코드 블록"
            >
              <Code className="h-4 w-4" />
            </ToolbarButton>
            <div className="mx-1 h-5 w-px bg-zinc-200 dark:bg-zinc-700" />
            {isLinkActive ? (
              <ToolbarButton
                onClick={handleLinkRemove}
                active
                title="링크 제거"
              >
                <Unlink className="h-4 w-4" />
              </ToolbarButton>
            ) : (
              <ToolbarButton
                onClick={() => {
                  setLinkUrl('');
                  setLinkDialogOpen(true);
                }}
                title="링크"
              >
                <LinkIcon className="h-4 w-4" />
              </ToolbarButton>
            )}
            <div className="ml-auto flex items-center gap-0.5">
              <ToolbarButton onClick={() => editor.chain().focus().undo().run()} title="되돌리기">
                <Undo className="h-4 w-4" />
              </ToolbarButton>
              <ToolbarButton onClick={() => editor.chain().focus().redo().run()} title="다시 실행">
                <Redo className="h-4 w-4" />
              </ToolbarButton>
            </div>
          </div>
        )}
        <EditorContent
          editor={editor}
          className="prose prose-sm dark:prose-invert max-w-none p-4 min-h-[400px]"
        />
      </div>

      {/* Link URL Dialog */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">링크 삽입</DialogTitle>
            <DialogDescription>URL을 입력하면 선택한 텍스트에 링크가 적용됩니다.</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleLinkSubmit();
            }}
          >
            <Input
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://example.com"
              autoFocus
            />
            <DialogFooter className="mt-4">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setLinkDialogOpen(false)}
              >
                취소
              </Button>
              <Button type="submit" size="sm" disabled={!linkUrl.trim()}>
                확인
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
