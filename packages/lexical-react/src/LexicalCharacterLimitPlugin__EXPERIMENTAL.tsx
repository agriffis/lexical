/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

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
  strlen?: (text: string) => number;
  children?: (overflowed: number) => JSX.Element;
}) {
  const overflow = 0;

  if (children === undefined) {
    return null;
  }
  return children(overflow);
}
