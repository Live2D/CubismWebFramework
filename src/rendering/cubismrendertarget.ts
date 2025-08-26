/**
 * Copyright(c) Live2D Inc. All rights reserved.
 *
 * Use of this source code is governed by the Live2D Open Software license
 * that can be found at https://www.live2d.com/eula/live2d-open-software-license-agreement_en.html.
 */

/**
 * 描画ターゲットの定義
 */
export interface CubismRenderTarget {
  /**
   * オフスクリーンのインデックスを設定する。
   *
   * @param offscreenIndex オフスクリーンのインデックス
   */
  setOffscreenIndex(offscreenIndex: number): void;

  /**
   * オフスクリーンのインデックスを取得する。
   *
   * @return オフスクリーンのインデックス
   */
  getOffscreenIndex(): number;

  /**
   * 以前のオフスクリーンサーフェスを設定する。
   *
   * @param oldOffscreen 以前のオフスクリーンサーフェス
   */
  setOldOffscreen(oldOffscreen: CubismRenderTarget): void;

  /**
   * 以前のオフスクリーンサーフェスを取得する。
   *
   * @return 以前のオフスクリーンサーフェス
   */
  getOldOffscreen(): CubismRenderTarget;

  /**
   * 親のオフスクリーンサーフェスを設定する。
   *
   * @param parentOffscreenRenderTarget 親のオフスクリーンサーフェス
   */
  setParentPartOffscreen(parentOffscreenRenderTarget: CubismRenderTarget): void;

  /**
   * 親のオフスクリーンサーフェスを取得する。
   *
   * @return 親のオフスクリーンサーフェス
   */
  getParentPartOffscreen(): CubismRenderTarget;
}
