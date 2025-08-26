/**
 * Copyright(c) Live2D Inc. All rights reserved.
 *
 * Use of this source code is governed by the Live2D Open Software license
 * that can be found at https://www.live2d.com/eula/live2d-open-software-license-agreement_en.html.
 */

import { csmVector, iterator } from './csmvector';

//========================テンプレートの宣言==============================

/**
 * @brief   ソート比較関数の型定義<br>
 *
 * leftがright の関係が left < right の場合 true を返すようにしてください
 * leftがright の関係が left >= right の場合 false を返すようにしてください
 */
export type SortCompareFunction<T> = (left: T, right: T) => boolean;

/**
 * マージソート
 * @param list ソート対象の配列
 * @param begin ソート開始インデックス
 * @param end ソート終了インデックス
 * @param compare 比較関数 (left < right の場合 true)
 */
export function mergeSortByIterator<T>(
  begin: iterator<T>,
  end: iterator<T>,
  compare: SortCompareFunction<T>
): void {
  // 引数のチェック
  if (begin._vector != end._vector || !compare) {
    return;
  }

  mergeSortByIndex(begin._vector._ptr, begin._index, end._index, compare);
}

/**
 * マージソート
 * @param list ソート対象の配列
 * @param begin ソート開始インデックス
 * @param end ソート終了インデックス
 * @param compare 比較関数 (left < right の場合 true)
 */
export function mergeSortByIndex<T>(
  list: T[],
  begin: number,
  end: number,
  compare: SortCompareFunction<T>
): void {
  // 引数のチェック
  if (!compare) {
    return;
  }

  if (begin + 1 < end) {
    const mid = Math.floor((end + begin) / 2);
    mergeSortByIndex(list, begin, mid, compare); // 左半分をソート
    mergeSortByIndex(list, mid, end, compare); // 右半分をソート
    merge(list, begin, mid, end, compare); // ソート済みの左右をマージ
  }
}

/**
 * @brief 2つのソート済み部分配列 [left...mid] と [mid+1...right] をマージする関数
 *
 * @param list ソート対象の配列
 * @param left 左側のインデックス
 * @param mid 中間のインデックス
 * @param right 右側のインデックス
 * @param compare 比較関数 (left < right の場合 true)
 */
function merge<T>(
  list: T[],
  left: number,
  mid: number,
  right: number,
  compare: SortCompareFunction<T>
): void {
  const n1 = mid - left;
  const n2 = right - mid;
  const tmpL = list.slice(left, mid);
  const tmpR = list.slice(mid, right);

  let i = 0,
    j = 0,
    k = left;

  // 二分割配列をマージ
  while (i < n1 && j < n2) {
    if (compare(tmpL[i], tmpR[j])) {
      list[k++] = tmpL[i++];
    } else {
      list[k++] = tmpR[j++];
    }
  }

  // 残った要素をコピー
  while (i < n1) {
    list[k++] = tmpL[i++];
  }

  while (j < n2) {
    list[k++] = tmpR[j++];
  }
}
