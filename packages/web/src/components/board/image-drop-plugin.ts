import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

/** Upload an image file to /api/board/image. Returns URL or null. */
async function uploadImage(file: File): Promise<string | null> {
  const formData = new FormData();
  formData.append('image', file);
  try {
    const res = await fetch('/api/board/image', { method: 'POST', body: formData });
    if (!res.ok) return null;
    const json = (await res.json()) as { success: boolean; data?: { url: string } };
    const url = json.data?.url;
    if (!url) return null;
    try {
      if (new URL(url).protocol !== 'https:') return null;
    } catch {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

/** Extract valid image files from DataTransfer. */
function getImageFiles(dt: DataTransfer): File[] {
  const files: File[] = [];
  for (let i = 0; i < dt.files.length; i++) {
    const f = dt.files.item(i);
    if (f && ALLOWED_TYPES.includes(f.type) && f.size <= MAX_SIZE) files.push(f);
  }
  return files;
}

export const imageDropPluginKey = new PluginKey('imageDropPlugin');

interface PluginState {
  decorations: DecorationSet;
  pending: Map<string, number>; // id -> pos
}

/** Create a widget decoration for upload placeholder. */
function placeholderWidget(id: string) {
  const el = document.createElement('div');
  el.className = 'image-upload-placeholder';
  el.setAttribute('data-upload-id', id);
  el.innerHTML =
    '<div class="image-upload-spinner">' +
    '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
    '<path d="M21 12a9 9 0 1 1-6.219-8.56"/>' +
    '</svg>' +
    '</div>';
  return el;
}

/**
 * ProseMirror plugin for image drag-and-drop and paste upload.
 * Shows a placeholder decoration during upload, then inserts the image node.
 */
export function createImageDropPlugin() {
  return new Plugin<PluginState>({
    key: imageDropPluginKey,

    state: {
      init() {
        return { decorations: DecorationSet.empty, pending: new Map() };
      },
      apply(tr, state) {
        // Map decoration positions through the transaction
        let { decorations, pending } = state;
        decorations = decorations.map(tr.mapping, tr.doc);

        // Add new placeholder
        const add = tr.getMeta(imageDropPluginKey) as
          | { type: 'add'; id: string; pos: number }
          | { type: 'remove'; id: string }
          | undefined;

        if (add?.type === 'add') {
          const widget = Decoration.widget(add.pos, () => placeholderWidget(add.id), {
            id: add.id,
          });
          decorations = decorations.add(tr.doc, [widget]);
          pending = new Map(pending);
          pending.set(add.id, add.pos);
        }

        if (add?.type === 'remove') {
          const found = decorations.find(undefined, undefined, (spec) => spec.id === add.id);
          if (found.length) {
            decorations = decorations.remove(found);
          }
          pending = new Map(pending);
          pending.delete(add.id);
        }

        return { decorations, pending };
      },
    },

    props: {
      decorations(state) {
        return imageDropPluginKey.getState(state)?.decorations ?? DecorationSet.empty;
      },

      handleDrop(view, event) {
        if (!event.dataTransfer) return false;
        const files = getImageFiles(event.dataTransfer);
        if (files.length === 0) return false;

        event.preventDefault();
        const coords = { left: event.clientX, top: event.clientY };
        const pos = view.posAtCoords(coords)?.pos ?? view.state.selection.from;

        for (const file of files) {
          const id = `upload-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

          // Add placeholder decoration
          const tr = view.state.tr;
          tr.setMeta(imageDropPluginKey, { type: 'add', id, pos });
          view.dispatch(tr);

          // Upload and replace
          uploadImage(file).then((url) => {
            // Remove placeholder
            const removeTr = view.state.tr;
            removeTr.setMeta(imageDropPluginKey, { type: 'remove', id });

            if (url) {
              // Find where the placeholder was and insert image there
              const pluginState = imageDropPluginKey.getState(view.state);
              const insertPos = pluginState?.pending.get(id) ?? view.state.selection.from;
              const imageNode = view.state.schema.nodes['imageBlock']!.create({ src: url });
              removeTr.insert(Math.min(insertPos, view.state.doc.content.size), imageNode);
            }

            view.dispatch(removeTr);
          });
        }
        return true;
      },

      handlePaste(view, event) {
        if (!event.clipboardData) return false;
        const files = getImageFiles(event.clipboardData);
        if (files.length === 0) return false;

        event.preventDefault();
        const pos = view.state.selection.from;

        for (const file of files) {
          const id = `upload-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

          const tr = view.state.tr;
          tr.setMeta(imageDropPluginKey, { type: 'add', id, pos });
          view.dispatch(tr);

          uploadImage(file).then((url) => {
            const removeTr = view.state.tr;
            removeTr.setMeta(imageDropPluginKey, { type: 'remove', id });

            if (url) {
              const pluginState = imageDropPluginKey.getState(view.state);
              const insertPos = pluginState?.pending.get(id) ?? view.state.selection.from;
              const imageNode = view.state.schema.nodes['imageBlock']!.create({ src: url });
              removeTr.insert(Math.min(insertPos, view.state.doc.content.size), imageNode);
            }

            view.dispatch(removeTr);
          });
        }
        return true;
      },
    },
  });
}
