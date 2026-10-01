import { afterEach, describe, expect, it } from 'vitest';
import { Editor, Node, type JSONContent } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { GapCursor } from '@tiptap/pm/gapcursor';
import { ForumImageCursor, imageParagraph, placeImageCaret } from '@/components/Forum/forumImageCursor';
const editors: Editor[] = [];
afterEach(() => { for (const editor of editors.splice(0)) editor.destroy(); });
const image = { type: 'forumImage' }, p = (text = '') => ({ type: 'paragraph', ...(text ? { content: [{ type: 'text', text }] } : {}) });
const make = (content: JSONContent[]) => {
  const editor = new Editor({ extensions: [ForumImageCursor, StarterKit.configure({ trailingNode: false }), Node.create({ name: 'forumImage', group: 'block', atom: true, renderHTML: () => ['figure'] })], content: { type: 'doc', content } });
  editors.push(editor); return editor;
};
describe('image caret and paragraphs', () => {
  it('Enter on a selected first/last image inserts after it and undo preserves the image', () => {
    for (const content of [[image], [p('上文'), image]]) {
      const editor = make(content), position = editor.state.doc.content.size - 1;
      editor.commands.setNodeSelection(position); expect(imageParagraph(editor)).toBe(true);
      expect(editor.getJSON().content?.map(n => n.type)).toEqual([...content.map(n => n.type), 'paragraph']);
      expect(editor.state.selection.$from.parent.type.name).toBe('paragraph');
      expect(editor.commands.undo()).toBe(true); expect(editor.getJSON().content?.map(n => n.type)).toEqual(content.map(n => n.type));
    }
  });
  it('before/after caret alone never adds paragraphs, Enter inserts exactly at the chosen boundary', () => {
    for (const side of ['before', 'after']) {
      const editor = make([p('前文'), image, p('后文')]), imagePos = editor.state.doc.firstChild!.nodeSize;
      const before = editor.getJSON(); placeImageCaret(editor, imagePos + (side === 'after' ? 1 : 0));
      expect(editor.getJSON()).toEqual(before); expect(editor.state.selection).toBeInstanceOf(GapCursor);
      expect(imageParagraph(editor)).toBe(true);
      const nodes = editor.getJSON().content!;
      expect(nodes.map(n => n.type)).toEqual(side === 'before' ? ['paragraph', 'paragraph', 'forumImage', 'paragraph'] : ['paragraph', 'forumImage', 'paragraph', 'paragraph']);
      expect(editor.state.doc.firstChild?.textContent).toBe('前文'); expect(editor.state.doc.lastChild?.textContent).toBe('后文');
    }
  });
  it('supports both document edges and gaps between images without changing ordinary Enter', () => {
    const editor = make([image, image]); placeImageCaret(editor, 1); imageParagraph(editor);
    expect(editor.getJSON().content?.map(n => n.type)).toEqual(['forumImage', 'paragraph', 'forumImage']);
    expect(imageParagraph(editor)).toBe(false);
    placeImageCaret(editor, 0); imageParagraph(editor);
    placeImageCaret(editor, editor.state.doc.content.size); imageParagraph(editor);
    expect(editor.getJSON().content?.map(n => n.type)).toEqual(['paragraph', 'forumImage', 'paragraph', 'forumImage', 'paragraph']);
  });
});
