import { Extension, type Editor } from '@tiptap/core';
import { GapCursor } from '@tiptap/pm/gapcursor';
import { NodeSelection, Plugin, Selection, TextSelection } from '@tiptap/pm/state';

const besideImage = (selection: Selection) => selection instanceof GapCursor &&
  (selection.$from.nodeBefore?.type.name === 'forumImage' || selection.$from.nodeAfter?.type.name === 'forumImage');

// Selecting an image edge changes only the caret, never the document.
export function placeImageCaret(editor: Editor, position: number) {
  if (!editor.isEditable) return;
  editor.view.focus();
  editor.view.dispatch(editor.state.tr.setSelection(new GapCursor(editor.state.doc.resolve(position))).scrollIntoView());
}

export function imageParagraph(editor: Editor): boolean {
  if (!editor.isEditable) return false;
  const { selection, schema, tr } = editor.state;
  const image = selection instanceof NodeSelection && selection.node.type.name === 'forumImage';
  if (!image && !besideImage(selection)) return false;
  const position = image ? selection.to : selection.from;
  const $position = tr.doc.resolve(position), paragraph = schema.nodes.paragraph;
  if (!$position.parent.canReplaceWith($position.index(), $position.index(), paragraph)) return false;
  tr.insert(position, paragraph.create());
  tr.setSelection(TextSelection.create(tr.doc, position + 1)).setStoredMarks([]);
  editor.view.dispatch(tr.scrollIntoView());
  return true;
}

function arrow(editor: Editor, direction: -1 | 1): boolean {
  const { selection, doc, tr } = editor.state;
  if (selection instanceof NodeSelection && selection.node.type.name === 'forumImage') {
    placeImageCaret(editor, direction < 0 ? selection.from : selection.to);
    return true;
  }
  if (!besideImage(selection)) return false;
  const adjacent = direction < 0 ? selection.$from.nodeBefore : selection.$from.nodeAfter;
  if (adjacent?.type.name === 'forumImage') {
    tr.setSelection(NodeSelection.create(doc, direction < 0 ? selection.from - adjacent.nodeSize : selection.from));
  } else {
    const next = Selection.findFrom(selection.$from, direction, true);
    if (!next) return true;
    tr.setSelection(next);
  }
  editor.view.dispatch(tr.scrollIntoView());
  return true;
}

export const ForumImageCursor = Extension.create({
  name: 'forumImageCursor', priority: 1100,
  addKeyboardShortcuts() {
    return {
      Enter: () => imageParagraph(this.editor),
      ArrowLeft: () => arrow(this.editor, -1), ArrowUp: () => arrow(this.editor, -1),
      ArrowRight: () => arrow(this.editor, 1), ArrowDown: () => arrow(this.editor, 1),
    };
  },
  addProseMirrorPlugins() {
    return [new Plugin({ props: {
      handleTextInput: (view, _from, _to, text) => {
        if (!besideImage(view.state.selection)) return false;
        const { from } = view.state.selection;
        const tr = view.state.tr.insert(from, view.state.schema.nodes.paragraph.create(null, view.state.schema.text(text)));
        tr.setSelection(TextSelection.create(tr.doc, from + 1 + text.length));
        view.dispatch(tr.scrollIntoView());
        return true;
      },
    } })];
  },
});
