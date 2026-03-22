'use client';

import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { common, createLowlight } from 'lowlight';
import { ImageBlockExtension } from './image-block';

const lowlight = createLowlight(common);

interface TiptapRendererProps {
  content: object;
}

export function TiptapRenderer({ content }: TiptapRendererProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      Link.configure({ openOnClick: true }),
      CodeBlockLowlight.configure({ lowlight }),
      ImageBlockExtension,
    ],
    content,
    editable: false,
  });

  return <EditorContent editor={editor} className="prose prose-sm dark:prose-invert max-w-none" />;
}
