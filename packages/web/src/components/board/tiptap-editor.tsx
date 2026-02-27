'use client';

import { useEditor, EditorContent } from '@tiptap/react';
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
  Undo,
  Redo,
  Quote,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const lowlight = createLowlight(common);

interface TiptapEditorProps {
  content?: object;
  onChange: (json: object, text: string) => void;
  placeholder?: string;
  editable?: boolean;
}

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

export function TiptapEditor({
  content,
  onChange,
  placeholder = '내용을 입력해주세요...',
  editable = true,
}: TiptapEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      Link.configure({ openOnClick: false, HTMLAttributes: { class: 'text-sky-500 underline' } }),
      Placeholder.configure({ placeholder }),
      CodeBlockLowlight.configure({ lowlight }),
    ],
    content: content || '',
    editable,
    onUpdate: ({ editor }) => {
      onChange(editor.getJSON(), editor.getText());
    },
  });

  if (!editor) return null;

  return (
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
          <ToolbarButton
            onClick={() => {
              const url = window.prompt('링크 URL을 입력하세요:');
              if (url) editor.chain().focus().setLink({ href: url }).run();
            }}
            active={editor.isActive('link')}
            title="링크"
          >
            <LinkIcon className="h-4 w-4" />
          </ToolbarButton>
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
        className={cn(
          'prose prose-sm dark:prose-invert max-w-none p-4',
          'min-h-[200px]',
          '[&_.tiptap_p.is-editor-empty:first-child::before]:text-zinc-400',
          '[&_.tiptap_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]',
          '[&_.tiptap_p.is-editor-empty:first-child::before]:float-left',
          '[&_.tiptap_p.is-editor-empty:first-child::before]:pointer-events-none',
          '[&_.tiptap_p.is-editor-empty:first-child::before]:h-0',
        )}
      />
    </div>
  );
}
