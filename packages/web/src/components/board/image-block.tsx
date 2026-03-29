'use client';

import type { RawCommands, ReactNodeViewProps } from '@tiptap/react';
import { mergeAttributes, Node, NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { X, ZoomIn, ZoomOut } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

/* -- Type augmentation for setImage command -- */
declare module '@tiptap/react' {
  interface Commands<ReturnType> {
    imageBlock: {
      setImage: (attrs: { src: string; alt?: string; title?: string }) => ReturnType;
    };
  }
}

/* -- React NodeView Component -- */

function ImageBlockView({
  node,
  updateAttributes,
  deleteNode,
  selected,
  editor,
}: ReactNodeViewProps) {
  const { src, alt, width, caption } = node.attrs as {
    src: string;
    alt: string;
    title: string;
    width: number | null;
    caption: string;
  };
  const isEditable = editor?.isEditable ?? false;
  const [isHovered, setIsHovered] = useState(false);
  const [resizing, setResizing] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const imgRef = useRef<HTMLImageElement>(null);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  const showControls = isEditable && (selected || isHovered);

  // Mouse resize
  const onResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!imgRef.current) return;
    setResizing(true);
    startXRef.current = e.clientX;
    startWidthRef.current = imgRef.current.offsetWidth;
  }, []);

  useEffect(() => {
    if (!resizing) return;
    const onMove = (e: MouseEvent) => {
      const diff = e.clientX - startXRef.current;
      const newWidth = Math.max(80, startWidthRef.current + diff);
      updateAttributes({ width: newWidth });
    };
    const onUp = () => setResizing(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [resizing, updateAttributes]);

  // Touch resize
  const onTouchResizeStart = useCallback((e: React.TouchEvent) => {
    e.stopPropagation();
    if (!imgRef.current) return;
    setResizing(true);
    startXRef.current = e.touches[0]!.clientX;
    startWidthRef.current = imgRef.current.offsetWidth;
  }, []);

  useEffect(() => {
    if (!resizing) return;
    const onTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (!touch) return;
      const diff = touch.clientX - startXRef.current;
      const newWidth = Math.max(80, startWidthRef.current + diff);
      updateAttributes({ width: newWidth });
    };
    const onTouchEnd = () => setResizing(false);
    window.addEventListener('touchmove', onTouchMove);
    window.addEventListener('touchend', onTouchEnd);
    return () => {
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [resizing, updateAttributes]);

  return (
    <NodeViewWrapper className="image-block-wrapper" data-drag-handle>
      <figure
        className={`image-block ${selected ? 'selected' : ''}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{ width: width ? `${width}px` : undefined }}
      >
        {/* Delete button */}
        {showControls && (
          <button
            type="button"
            className="image-block-delete"
            onClick={deleteNode}
            aria-label="이미지 삭제"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}

        {/* Image */}
        <img
          ref={imgRef}
          src={src}
          alt={alt || ''}
          draggable={false}
          style={{ width: '100%', height: 'auto', cursor: isEditable ? undefined : 'pointer' }}
          onClick={isEditable ? undefined : () => setLightboxOpen(true)}
        />

        {/* Resize handle (bottom-right corner) */}
        {showControls && (
          <div
            className="image-block-resize-handle"
            onMouseDown={onResizeStart}
            onTouchStart={onTouchResizeStart}
          />
        )}

        {/* Caption */}
        {isEditable ? (
          <figcaption
            className="image-block-caption"
            contentEditable
            suppressContentEditableWarning
            data-placeholder="캡션 추가..."
            ref={(el) => {
              if (el && el.textContent !== (caption || '')) {
                el.textContent = caption || '';
              }
            }}
            onInput={(e) => {
              try {
                updateAttributes({ caption: e.currentTarget.textContent ?? '' });
              } catch {
                // Node already deleted
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Backspace' || e.key === 'Delete') {
                e.stopPropagation();
              }
            }}
          />
        ) : caption ? (
          <figcaption className="image-block-caption">{caption}</figcaption>
        ) : null}
      </figure>

      {/* Lightbox modal (read-only) */}
      {!isEditable && (
        <Dialog
          open={lightboxOpen}
          onOpenChange={(open) => {
            setLightboxOpen(open);
            if (!open) setZoom(1);
          }}
        >
          <DialogContent className="max-w-[90vw] max-h-[90vh] p-0 border-none bg-transparent shadow-none [&>button]:text-white [&>button]:bg-black/50 [&>button]:rounded-full [&>button]:p-1.5">
            <DialogTitle className="sr-only">이미지 확대 보기</DialogTitle>
            <div className="relative flex items-center justify-center overflow-auto max-h-[85vh]">
              <img
                src={src}
                alt={alt || ''}
                draggable={false}
                className="rounded-lg object-contain transition-transform duration-200"
                style={{ transform: `scale(${zoom})`, maxHeight: '85vh', maxWidth: '90vw' }}
              />
              {/* Zoom controls */}
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/60 rounded-full px-3 py-1.5">
                <button
                  type="button"
                  className="text-white hover:text-white/80 disabled:text-white/30"
                  onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
                  disabled={zoom <= 0.5}
                >
                  <ZoomOut className="h-4 w-4" />
                </button>
                <span className="text-white text-xs tabular-nums min-w-[3ch] text-center">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  type="button"
                  className="text-white hover:text-white/80 disabled:text-white/30"
                  onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
                  disabled={zoom >= 3}
                >
                  <ZoomIn className="h-4 w-4" />
                </button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </NodeViewWrapper>
  );
}

/* -- TipTap Extension -- */

export const ImageBlockExtension = Node.create({
  name: 'imageBlock',
  group: 'block',
  atom: false,
  draggable: true,

  addAttributes() {
    return {
      src: { default: null },
      alt: { default: '' },
      title: { default: '' },
      width: { default: null },
      caption: { default: '' },
    };
  },

  parseHTML() {
    return [
      // Parse <figure> with <img> (new format)
      {
        tag: 'figure[data-type="image-block"]',
        getAttrs(dom: HTMLElement) {
          const img = dom.querySelector('img');
          const figcaption = dom.querySelector('figcaption');
          return {
            src: img?.getAttribute('src'),
            alt: img?.getAttribute('alt') || '',
            width: dom.style.width ? parseInt(dom.style.width) : null,
            caption: figcaption?.textContent || '',
          };
        },
      },
      // Fallback: parse plain <img> for backward compat
      {
        tag: 'img[src]',
        getAttrs(dom: HTMLElement) {
          const widthAttr = dom.getAttribute('width');
          const style = dom.getAttribute('style') || '';
          let width: number | null = null;
          if (widthAttr) width = parseInt(widthAttr);
          else {
            const match = style.match(/width:\s*(\d+)px/);
            if (match?.[1]) width = parseInt(match[1]);
          }
          return {
            src: dom.getAttribute('src'),
            alt: dom.getAttribute('alt') || '',
            title: dom.getAttribute('title') || '',
            width,
          };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, string> }) {
    const { src, alt, title, width, caption } = HTMLAttributes;
    const figureAttrs: Record<string, string> = { 'data-type': 'image-block' };
    if (width) figureAttrs.style = `width: ${width}px`;

    return [
      'figure',
      figureAttrs,
      ['img', mergeAttributes({ src, alt, title, draggable: 'false' })],
      ['figcaption', {}, caption || ''],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageBlockView);
  },

  addCommands() {
    return {
      setImage:
        (attrs: { src: string; alt?: string; title?: string }) =>
        ({
          commands,
        }: {
          commands: {
            insertContent: (content: { type: string; attrs: Record<string, unknown> }) => boolean;
          };
        }) => {
          return commands.insertContent({ type: this.name, attrs });
        },
    } satisfies Partial<RawCommands> as never;
  },
});
