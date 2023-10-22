/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import type {LexicalEditor, LexicalNode} from 'lexical';

import {createDOMRange} from '@lexical/selection';
import {$rootTextContent} from '@lexical/text';
import {mergeRegister, positionNodeOnRange} from '@lexical/utils';
import {$getRoot, $isElementNode} from 'lexical';
import * as React from 'react';
import {useEffect, useState} from 'react';
import invariant from 'shared/invariant';

import {useLexicalComposerContext} from './LexicalComposerContext';

type StrlenFn = (text: string) => number;

let textEncoderInstance: null | TextEncoder = null;

function textEncoder(): null | TextEncoder {
  if (window.TextEncoder === undefined) {
    return null;
  }

  if (textEncoderInstance === null) {
    textEncoderInstance = new window.TextEncoder();
  }

  return textEncoderInstance;
}

export function utf8Length(text: string): number {
  const currentTextEncoder = textEncoder();

  if (currentTextEncoder === null) {
    // http://stackoverflow.com/a/5515960/210370
    const m = encodeURIComponent(text).match(/%[89ABab]/g);
    return text.length + (m ? m.length : 0);
  }

  return currentTextEncoder.encode(text).length;
}

export function utf16Length(text: string): number {
  return text.length;
}

export function CharacterLimitPlugin({
  strlen = utf16Length,
  children,
  maxLength,
}: {
  maxLength: number;
  strlen?: StrlenFn;
  children?: (overflowed: number) => JSX.Element;
}): null | JSX.Element {
  useOverlay(maxLength, strlen);

  if (children === undefined) {
    return null;
  }
  return (
    <OverflowCount strlen={strlen} maxLength={maxLength}>
      {children}
    </OverflowCount>
  );
}

let x = 0;

function useOverlay(maxLength: number, strlen: StrlenFn): void {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    let removePositionNodeOnRange = () => {};
    return mergeRegister(
      editor.registerTextContentListener(() => {
        removePositionNodeOnRange();
        editor.getEditorState().read(() => {
          const overflowLength_ = $overflowLength(maxLength, strlen);
          if (overflowLength_ <= 0) {
            console.info('no overflow');
            return;
          }
          const levelAccLength = [0];
          let level = 0;
          let node: LexicalNode = $getRoot();
          let pivot: null | LexicalNode = null;
          loop: while (node !== null) {
            // if (x++ > 100) {
            debugger;
            // }
            const nodeLength = strlen(node.getTextContent());
            if (levelAccLength[level] + nodeLength < overflowLength_) {
              // Tree iterate left and up
              levelAccLength[level] += nodeLength;
              const previousSibling: null | LexicalNode =
                node.getPreviousSibling();
              if (previousSibling !== null) {
                if (
                  $isElementNode(previousSibling) &&
                  !previousSibling.isInline()
                ) {
                  // TODO revise this hardcoded \n\n condition. This works well for 99% of the cases
                  // but it might make sense to switch to a MS/GDoc model where only inline characters
                  // are taken into account.
                  levelAccLength[level] += 2; // \n\n
                }
                node = previousSibling;
              } else {
                level--;
                node = node.getParentOrThrow();
              }
            } else {
              // Tree iterate down and right-most
              if (!$isElementNode(node)) {
                pivot = node;
                break loop;
              }
              level++;
              if (levelAccLength[level] === undefined) {
                levelAccLength[level] = 0;
              }
              const lastChild: null | LexicalNode = node.getLastChild();
              // Can happen when custom getTextContent on ElementNode
              if (lastChild === null) {
                pivot = node;
                break loop;
              }
              node = lastChild;
            }
          }
          invariant(pivot !== null, 'CharacterLimit was unable to find pivot');
          // pivot could be elementnode in custom ocassions, null when not oveflow
          // beware offset can be affected by \n\n
          const offset =
            strlen(pivot.getTextContent()) -
            (overflowLength_ - levelAccLength[level]);
          const lastEditorNode = $getRoot().getLastDescendant();
          invariant(
            lastEditorNode !== null,
            'Unexpected null last editor node',
          );
          // revise offset for strlen
          const range = createDOMRange(
            editor,
            pivot,
            offset,
            lastEditorNode,
            lastEditorNode.getTextContentSize(),
          );
          if (range !== null) {
            removePositionNodeOnRange = positionNodeOnRange(
              editor,
              range,
              (domNodes) => {
                for (const domNode of domNodes) {
                  domNode.style.backgroundColor = 'red';
                }
              },
            );
          }
        });
      }),
      removePositionNodeOnRange,
    );
  }, [editor, maxLength, strlen]);
}

function OverflowCount({
  strlen,
  children,
  maxLength,
}: {
  maxLength: number;
  strlen: StrlenFn;
  children: (overflowed: number) => JSX.Element;
}): JSX.Element {
  const [editor] = useLexicalComposerContext();
  const [overflow, setOverflow] = useState(
    () => -overflowLength(editor, maxLength, strlen),
  );
  useEffect(() => {
    return editor.registerTextContentListener((text) => {
      setOverflow(-overflowLength(editor, maxLength, strlen));
    });
  }, [editor, maxLength, strlen]);
  return children(overflow);
}

function overflowLength(
  editor: LexicalEditor,
  maxLength: number,
  strlen: StrlenFn,
): number {
  return editor.getEditorState().read(() => $overflowLength(maxLength, strlen));
}

function $overflowLength(maxLength: number, strlen: StrlenFn): number {
  return strlen($rootTextContent()) - maxLength;
}
