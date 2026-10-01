import { useEffect, useId, useState, type KeyboardEvent } from 'react';
import { Node, mergeAttributes, type Editor } from '@tiptap/core';
import { forumService, forumError } from '@/services/forumService';
import type { ForumAccount } from '@/services/types';
import { ForumAvatar } from './ForumAvatar';

export const ForumMention = Node.create({
  name: 'mention', group: 'inline', inline: true, atom: true, selectable: false,
  addAttributes: () => ({ accountId: { default: null, parseHTML: el => el.getAttribute('data-account-id') }, label: { default: '', parseHTML: el => el.getAttribute('data-label') } }),
  parseHTML: () => [{ tag: 'span[data-forum-mention]' }],
  renderHTML: ({ node, HTMLAttributes }) => ['span', mergeAttributes(HTMLAttributes, { 'data-forum-mention': '', 'data-account-id': node.attrs.accountId, 'data-label': node.attrs.label, class: 'rounded bg-primary/10 px-1 text-primary' }), `@${node.attrs.label}`],
  renderText: ({ node }) => `@${node.attrs.label}`,
});

function queryAt(editor: Editor) {
  const { selection } = editor.state;
  if (!selection.empty || !selection.$from.parent.isTextblock) return null;
  const text = selection.$from.parent.textBetween(0, selection.$from.parentOffset, '\n', '\ufffc');
  const match = /(?:^|[\s，。！？、（(\p{Script=Han}])@([^@\s\ufffc]{0,40})$/u.exec(text);
  return match ? { query: match[1], from: selection.from - match[1].length - 1, to: selection.from } : null;
}
export function useForumMentions(editor: Editor | null, circleId: string, disabled: boolean) {
  const id = useId();
  const [match, setMatch] = useState<ReturnType<typeof queryAt>>(null), [rows, setRows] = useState<ForumAccount[]>([]);
  const [selected, setSelected] = useState(0), [loading, setLoading] = useState(false), [error, setError] = useState('');
  useEffect(() => {
    if (!editor) return;
    const update = () => { const next = queryAt(editor); setMatch(old => JSON.stringify(old) === JSON.stringify(next) ? old : next); };
    editor.on('transaction', update);
    return () => { editor.off('transaction', update); };
  }, [editor]);
  useEffect(() => {
    if (!match || disabled) return;
    let active = true; const controller = new AbortController();
    setRows([]); setSelected(0); setLoading(true); setError('');
    const timer = setTimeout(() => { void forumService.mentions(circleId, match.query, controller.signal)
      .then(data => { if (active) setRows(data); }).catch(err => { if (active) setError(forumError(err)); })
      .finally(() => { if (active) setLoading(false); }); }, 180);
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, [match, circleId, disabled]);
  const choose = (row: ForumAccount) => {
    if (!editor || !match || disabled || JSON.stringify(queryAt(editor)) !== JSON.stringify(match)) return;
    editor.chain().focus().insertContentAt({ from: match.from, to: match.to }, [
      { type: 'mention', attrs: { accountId: row.accountId, label: row.name } }, { type: 'text', text: ' ' },
    ]).run();
    setMatch(null);
  };
  const onKeyDownCapture = (event: KeyboardEvent) => {
    if (!match || disabled || event.nativeEvent.isComposing || event.keyCode === 229) return;
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setMatch(null); }
    else if (['ArrowDown', 'ArrowUp'].includes(event.key) && rows.length) {
      event.preventDefault(); event.stopPropagation(); setSelected(value => (value + (event.key === 'ArrowDown' ? 1 : -1) + rows.length) % rows.length);
    } else if (['Enter', 'Tab'].includes(event.key) && rows[selected]) { event.preventDefault(); event.stopPropagation(); choose(rows[selected]); }
  };
  const panel = match && !disabled ? <div className="border-t border-border bg-muted/20 p-2">
    <div className="mb-1 flex justify-between px-2 text-xs text-muted-foreground"><span>提及用户 · 每条最多 10 人</span><span>↑↓ 选择 · Enter 确认 · Esc 关闭</span></div>
    {loading ? <p role="status" className="p-2 text-sm">正在查找…</p> : error ? <p role="alert" className="p-2 text-sm text-destructive">{error}</p> : !rows.length ? <p className="p-2 text-sm text-muted-foreground">没有匹配的用户，继续输入姓名或志愿者 ID</p> :
      <div role="listbox" aria-label="提及用户" id={id} className="max-h-48 overflow-y-auto">{rows.map((row, index) => <button type="button" role="option" aria-selected={index === selected} key={row.accountId} onMouseDown={event => event.preventDefault()} onClick={() => choose(row)} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm ${selected === index ? 'bg-primary/10' : 'hover:bg-muted'}`}><ForumAvatar author={row} /><span>{row.name}<span className="ml-2 text-xs text-muted-foreground">{row.volunteerCode || '系统管理员'}</span></span></button>)}</div>}
  </div> : null;
  return { panel, onKeyDownCapture };
}
