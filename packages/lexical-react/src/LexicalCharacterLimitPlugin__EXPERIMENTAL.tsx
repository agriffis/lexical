/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import type {LexicalEditor} from 'lexical';

import {$rootTextContent} from '@lexical/text';
import * as React from 'react';
import {useEffect, useState} from 'react';

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

function useOverlay(maxLength: number, strlen: StrlenFn): void {
  //
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
  const [overflow, setOverflow] = useState(() =>
    overflowCount(editor, maxLength, strlen),
  );
  useEffect(() => {
    return editor.registerTextContentListener((text) => {
      setOverflow(overflowCount(editor, maxLength, strlen));
    });
  }, [editor, maxLength, strlen]);
  return children(overflow);
}

function overflowCount(
  editor: LexicalEditor,
  maxLength: number,
  strlen: StrlenFn,
): number {
  return editor.getEditorState().read(() => $overflowCount(maxLength, strlen));
}

function $overflowCount(maxLength: number, strlen: StrlenFn): number {
  return maxLength - strlen($rootTextContent());
}
