'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Heading,
  List,
  ListOrdered,
  Quote,
  Code,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type Format =
  | 'bold'
  | 'italic'
  | 'underline'
  | 'strikethrough'
  | 'link'
  | 'heading'
  | 'bullet'
  | 'number'
  | 'code'
  | 'blockquote';


interface AgentDescriptionEditorProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

const CONTROLS: { id: Format; Icon: React.ElementType; title: string }[] = [
  { id: 'bold', Icon: Bold, title: 'Negrito (Ctrl+B)' },
  { id: 'italic', Icon: Italic, title: 'Itálico (Ctrl+I)' },
  { id: 'underline', Icon: Underline, title: 'Sublinhado (Ctrl+U)' },
  { id: 'strikethrough', Icon: Strikethrough, title: 'Riscado' },
  { id: 'heading', Icon: Heading, title: 'Título' },
  { id: 'bullet', Icon: List, title: 'Lista com marcadores' },
  { id: 'number', Icon: ListOrdered, title: 'Lista numerada' },
  { id: 'code', Icon: Code, title: 'Código' },
  { id: 'blockquote', Icon: Quote, title: 'Citação' },
];

const execCommand = (command: string, value?: string) => {
  try {
    document.execCommand(command, false, value ?? undefined);
  } catch {
    // Comandos como `createLink` podem falhar sem seleção válida.
  }
};

/** Retorna o elemento de bloco (p, div, heading, pre, blockquote, li) que
 *  contém a seleção atual, ou null se não houver. Mais confiável que
 *  queryCommandValue, que costuma retornar vazio dentro de elementos
 *  aninhados. */
const getSelectedBlockElement = (): HTMLElement | null => {
  const sel = window.getSelection();
  if (!sel?.rangeCount) return null;
  const node = sel.getRangeAt(0).commonAncestorContainer;
  const el =
    node.nodeType === Node.ELEMENT_NODE
      ? (node as HTMLElement)
      : node.parentElement;
  if (!el) return null;
  let current: HTMLElement | null = el;
  while (current && current.nodeType === Node.ELEMENT_NODE) {
    const tag = current.tagName.toLowerCase();
    if (
      ['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'pre', 'blockquote', 'li'].includes(tag)
    ) {
      return current;
    }
    current = current.parentElement as HTMLElement | null;
  }
  return null;
};

export function AgentDescriptionEditor({
  id,
  value,
  onChange,
  disabled = false,
}: AgentDescriptionEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  // `true` enquanto a última alteração partiu do usuário (digitação ou barra
  // de ferramentas). Assim não sobrescrevemos o cursor ao sincronizar o
  // valor controlado vindo do pai.
  const isUserChangeRef = useRef(false);
  // Último valor gravado no DOM. undefined no primeiro render para garantir
  // que a sincronização inicial escreva o valor vindo do pai.
  const committedValueRef = useRef<string | undefined>(undefined);
  const [active, setActive] = useState<Set<Format>>(new Set());

  const format = useCallback(
    (formatId: Format) => {
      if (disabled) return;
      const el = editorRef.current;
      if (!el) return;
      el.focus();

      switch (formatId) {
        case 'bold':
          execCommand('bold');
          break;
        case 'italic':
          execCommand('italic');
          break;
        case 'underline':
          execCommand('underline');
          break;
        case 'strikethrough':
          execCommand('strikethrough');
          break;
        case 'heading': {
          const block = getSelectedBlockElement();
          if (block && /^h[1-6]$/i.test(block.tagName)) execCommand('formatBlock', '<p>');
          else execCommand('formatBlock', '<h2>');
          break;
        }
        case 'bullet': {
          toggleList(false);
          break;
        }
        case 'number': {
          toggleList(true);
          break;
        }
        case 'code': {
          const block = getSelectedBlockElement();
          if (block && block.tagName.toLowerCase() === 'pre') execCommand('formatBlock', '<p>');
          else execCommand('formatBlock', '<pre>');
          break;
        }
        case 'blockquote': {
          const block = getSelectedBlockElement();
          if (block && block.tagName.toLowerCase() === 'blockquote') execCommand('formatBlock', '<p>');
          else execCommand('formatBlock', '<blockquote>');
          break;
        }
      }

      isUserChangeRef.current = true;
      onChange(editorRef.current.innerHTML);
      refreshActive();
    },
    [disabled, onChange]
  );

  const onInput = useCallback(() => {
    isUserChangeRef.current = true;
    onChange(editorRef.current?.innerHTML ?? '');
    refreshActive();
  }, [onChange]);

  // Cola apenas texto puro, removendo estilos/spans que editores de texto
  // externos (Word, Docs, etc.) costumam injetar.
  const onPaste = useCallback(
    (e: React.ClipboardEvent<HTMLDivElement>) => {
      if (disabled) return;
      e.preventDefault();
      const el = editorRef.current;
      if (!el) return;
      const text = e.clipboardData?.getData('text/plain') ?? '';
      if (!text) return;
      el.focus();
      execCommand('insertText', text);
      isUserChangeRef.current = true;
      onChange(el.innerHTML);
      refreshActive();
    },
    [disabled, onChange]
  );

  const refreshActive = useCallback(() => {
    const el = editorRef.current;
    if (!el) {
      setActive(new Set());
      return;
    }
    const next = new Set<Format>();
    const check = (command: string, id: Format) => {
      try {
        if (document.queryCommandState(command)) next.add(id);
      } catch {
        // Ignorado: comando pode não ter suporte no contexto atual.
      }
    };
    check('bold', 'bold');
    check('italic', 'italic');
    check('underline', 'underline');
    check('strikethrough', 'strikethrough');
    check('insertUnorderedList', 'bullet');
    check('insertOrderedList', 'number');
    const block = document.queryCommandValue('formatBlock');
    if (/^(h[1-6])$/i.test(block)) next.add('heading');
    if (/^(pre)$/i.test(block)) next.add('code');
    if (/^(blockquote)$/i.test(block)) next.add('blockquote');

    setActive(next);
  }, []);

  /** Envolve o texto selecionado em <ul>/<ol> com um <li> por linha.
   *  Quando a seleção tem quebras de linha (<br), cada linha vira um item
   *  separado. Sem seleção (cursor colapsado), delega ao insertUnorderedList
   *  / insertOrderedList do navegador. */
  const wrapSelectionInList = useCallback(
    (ordered: boolean) => {
      const sel = window.getSelection();
      if (!sel?.rangeCount) return;
      const range = sel.getRangeAt(0);
      const el = editorRef.current;
      if (!el) return;

      // Cursor colapsado (apenas o ponto de inserção): deixa o navegador cuidar.
      if (range.collapsed) {
        execCommand('formatBlock', '<p>');
        execCommand(ordered ? 'insertOrderedList' : 'insertUnorderedList');
        isUserChangeRef.current = true;
        onChange(el.innerHTML);
        refreshActive();
        return;
      }

      const contents = range.cloneContents();
      const temp = document.createElement('div');
      temp.appendChild(contents);
      const html = temp.innerHTML;

      // Se não há quebras de linha, usa o comando nativo do navegador.
      if (!/<br\s*\/?>/i.test(html)) {
        execCommand('formatBlock', '<p>');
        execCommand(ordered ? 'insertOrderedList' : 'insertUnorderedList');
        return;
      }

      // Há quebras de linha: cria um <li> por linha, preservando formatação
      // (negrito, itálico, etc.) dentro de cada item.
      const listEl = document.createElement(ordered ? 'ol' : 'ul');
      const parts = html.split(/<br\s*\/?>/i);

      parts.forEach(part => {
        if (!part.trim()) return;
        const li = document.createElement('li');
        li.innerHTML = part;
        listEl.appendChild(li);
      });

      try {
        range.deleteContents();
        range.insertNode(listEl);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
      } catch {
        // Se algo falhar na manipulação direta do DOM, aborta silenciosamente.
      }

      isUserChangeRef.current = true;
      onChange(el.innerHTML);
      refreshActive();
    },
    [onChange, refreshActive]
  );

  /** Alterna lista com marcadores/numerada.
   *  Se a seleção já estiver dentro de um <li>, desativa a lista (volta para
   *  parágrafos comuns). Senão, aplica a lista. */
  const toggleList = useCallback(
    (ordered: boolean) => {
      const sel = window.getSelection();
      if (!sel?.rangeCount) return;
      const el = editorRef.current;
      if (!el) return;

      const block = getSelectedBlockElement();

      // Já está em um <li>: desativa a lista, convertendo para parágrafos.
      if (block && block.tagName.toLowerCase() === 'li') {
        execCommand('formatBlock', '<p>');
        isUserChangeRef.current = true;
        onChange(el.innerHTML);
        refreshActive();
        return;
      }

      wrapSelectionInList(ordered);
    },
    [onChange, refreshActive, wrapSelectionInList]
  );

  // Atualiza estados ativos dos botões sempre que a seleção muda.
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    const onSelChange = () => requestAnimationFrame(refreshActive);
    el.addEventListener('keyup', onSelChange);
    el.addEventListener('mouseup', onSelChange);
    el.addEventListener('touchend', onSelChange);
    document.addEventListener('selectionchange', onSelChange);
    return () => {
      el.removeEventListener('keyup', onSelChange);
      el.removeEventListener('mouseup', onSelChange);
      el.removeEventListener('touchend', onSelChange);
      document.removeEventListener('selectionchange', onSelChange);
    };
  }, [refreshActive]);

  // Atalhos de teclado.
  useEffect(() => {
    if (disabled) return;
    const el = editorRef.current;
    if (!el) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const isCmd = (e.metaKey || e.ctrlKey) && !e.altKey;
      if (!isCmd) return;
      if (e.key === 'b') {
        e.preventDefault();
        format('bold');
      } else if (e.key === 'i') {
        e.preventDefault();
        format('italic');
      } else if (e.key === 'u') {
        e.preventDefault();
        format('underline');
      }
    };
    el.addEventListener('keydown', onKeyDown);
    return () => el.removeEventListener('keydown', onKeyDown);
  }, [disabled, format]);

  // Sincroniza o valor controlado (vindo do pai) com o DOM, exceto quando a
  // mudança partiu do usuário — isso preserva o cursor enquanto se digita.
  // Só reescreve o DOM quando o conteúdo difere, evitando apagar o cursor em
  // re-renders não relacionados ao editor.
  useEffect(() => {
    const el = editorRef.current;
    if (!el || isUserChangeRef.current) return;
    if (el.innerHTML !== value) el.innerHTML = value;
    committedValueRef.current = value;
  }, [value]);

  // Libera o bloqueio de sincronização após cada commit do React.
  useEffect(() => {
    isUserChangeRef.current = false;
  });

  return (
    <div className="rounded-lg border border-border/60 shadow-sm flex flex-col">
      <div className="flex items-center gap-2 border-b border-border/60 bg-background/50 p-1 overflow-x-auto p-3">
        {CONTROLS.map((control) => {
          const pressed = active.has(control.id);
          return (
            <button
              key={control.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => format(control.id)}
              disabled={disabled}
              aria-pressed={pressed}
              title={control.title}
              className={cn(
                'inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors',
                pressed
                  ? 'bg-primary text-primary-foreground'
                  : 'border-transparent text-muted-foreground hover:bg-muted hover:text-foreground',
                disabled && 'opacity-50 pointer-events-none cursor-not-allowed'
              )}
            >
              <control.Icon className="h-4 w-4" aria-hidden="true" />
            </button>
          );
        })}
      </div>

      <div className="relative flex-1 min-h-0 max-h-[320px] overflow-y-auto">
        <div
          ref={editorRef}
          id={id}
          role="textbox"
          aria-multiline="true"
          aria-labelledby={id ?? undefined}
          aria-disabled={disabled}
          contentEditable={!disabled}
          data-placeholder="Regras, tom, limites e diretrizes do agente…"
          onInput={onInput}
          onPaste={onPaste}
          className={cn(
            'w-full min-h-[200px] outline-none text-foreground p-2',
            'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            '[&_p]:mb-3 [&_pre]:bg-muted [&_pre]:rounded [&_pre]:p-2 [&_pre]:text-sm [&_pre]:font-mono',
            '[&_blockquote]:border-l-1 [&_blockquote]:border-primary [&_blockquote]:pl-4 [&_blockquote]:italic',
            '[&_h2]:text-xl [&_h2]:font-bold',
            disabled ? 'bg-muted/50 pointer-events-none' : ''
          )}
        />
        <style jsx>{`
          [contenteditable][data-placeholder]:empty:before {
            content: attr(data-placeholder);
            color: hsl(var(--muted-foreground));
            pointer-events: none;
            display: block;
          }
          /* Listas visíveis: elementos criados via execCommand dentro do
             contenteditable não são alcançados pelo escopo do styled-jsx,
             então usamos :global para garantir que os marcadores apareçam. */
          :global(ul), :global(ol) {
            margin: 0 0 0.75rem 1.5rem;
            padding-left: 1.5rem;
          }
          :global(ul) { list-style-type: disc; }
          :global(ol) { list-style-type: decimal; }
          :global(li) { margin-bottom: 0.25rem; }
        `}</style>
      </div>
    </div>
  );
}
