/**
 * Copyright(c) Live2D Inc. All rights reserved.
 *
 * Use of this source code is governed by the Live2D Open Software license
 * that can be found at https://www.live2d.com/eula/live2d-open-software-license-agreement_en.html.
 */

import { CubismRenderTarget } from './cubismrendertarget';

/**
 * WebGL用オフスクリーンサーフェス
 * マスクの描画及びオフスクリーン機能に必要なフレームバッファなどを管理する。
 */
export class CubismRenderTarget_WebGL implements CubismRenderTarget {
  /**
   * WebGL2RenderingContext.blitFramebuffer() でバッファのコピーを行う。
   *
   * @param src コピー元のオフスクリーンサーフェス
   * @param dst コピー先のオフスクリーンサーフェス
   */
  public static copyBuffer(
    gl: WebGL2RenderingContext,
    src: CubismRenderTarget_WebGL,
    dst: CubismRenderTarget_WebGL
  ): void {
    if (src == null || dst == null) {
      return;
    }

    if (!(gl instanceof WebGL2RenderingContext)) {
      throw new Error('WebGL2RenderingContext is required for buffer copy.');
    }

    const previousFramebuffer = gl.getParameter(
      gl.FRAMEBUFFER_BINDING
    ) as WebGLFramebuffer;

    // 各オフスクリーンサーフェスのレンダーテクスチャをバインド
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, src.getRenderTexture());
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, dst.getRenderTexture());

    // バッファのコピーを実行
    gl.blitFramebuffer(
      0,
      0,
      src.getBufferWidth(),
      src.getBufferHeight(),
      0,
      0,
      dst.getBufferWidth(),
      dst.getBufferHeight(),
      gl.COLOR_BUFFER_BIT,
      gl.NEAREST
    );

    // コピー後、元のフレームバッファを復元
    gl.bindFramebuffer(gl.FRAMEBUFFER, previousFramebuffer);
  }

  /**
   * 描画を開始する。
   *
   * @param restoreFbo EndDraw時に復元するFBOを指定する。nullを指定すると、beginDraw時に現在のFBOを記憶しておく。
   */
  public beginDraw(restoreFbo: WebGLFramebuffer = null): void {
    if (this._renderTexture == null) {
      return;
    }

    // バックバッファのサーフェイスを記憶しておく。
    if (restoreFbo == null) {
      this._oldFbo = this._gl.getParameter(this._gl.FRAMEBUFFER_BINDING);
    } else {
      this._oldFbo = restoreFbo;
    }

    // RenderTextureをactiveにセット
    this._gl.bindFramebuffer(this._gl.FRAMEBUFFER, this._renderTexture);
  }

  /**
   * 描画を終了し、バックバッファのサーフェイスを復元する。
   */
  public endDraw(): void {
    // バックバッファのサーフェイスを復元
    this._gl.bindFramebuffer(this._gl.FRAMEBUFFER, this._oldFbo);
  }

  /**
   * バインドされているカラーバッファのクリアを行う。
   *
   * @param r 赤の成分 (0.0 - 1.0)
   * @param g 緑の成分 (0.0 - 1.0)
   * @param b 青の成分 (0.0 - 1.0)
   * @param a アルファの成分 (0.0 - 1.0)
   */
  public clear(r: number, g: number, b: number, a: number): void {
    // クリア処理
    this._gl.clearColor(r, g, b, a);
    this._gl.clear(this._gl.COLOR_BUFFER_BIT);
  }

  /**
   * オフスクリーンサーフェスを作成する。
   *
   * @param gl WebGLRenderingContextまたはWebGL2RenderingContext
   *          NOTE: Cubism 5.3以降のモデルが使用される場合はWebGL2RenderingContextを使用すること。
   * @param displayBufferWidth オフスクリーンサーフェスの幅
   * @param displayBufferHeight オフスクリーンサーフェスの高さ
   * @param previousFramebuffer 前のフレームバッファ
   *
   * @return 成功した場合はtrue、失敗した場合はfalse
   */
  public createOffscreenRenderTarget(
    gl: WebGLRenderingContext | WebGL2RenderingContext,
    displayBufferWidth: number,
    displayBufferHeight: number,
    previousFramebuffer: WebGLFramebuffer
  ): boolean {
    this.destroyRenderTarget();

    this._colorBuffer = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this._colorBuffer);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      displayBufferWidth,
      displayBufferHeight,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    gl.bindTexture(gl.TEXTURE_2D, null);

    // フレームバッファを作成
    const ret = gl.createFramebuffer();
    if (ret == null) {
      console.error('Failed to create framebuffer');
      return false;
    }

    // 作成したフレームバッファをバインド
    gl.bindFramebuffer(gl.FRAMEBUFFER, ret);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      this._colorBuffer,
      0
    );

    // 状態をチェック
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);

    // フレームバッファが完全でない場合はエラーを出力して以前のフレームバッファを復元
    if (status !== gl.FRAMEBUFFER_COMPLETE) {
      console.error('Framebuffer is not complete');
      gl.bindFramebuffer(gl.FRAMEBUFFER, previousFramebuffer);
      gl.deleteFramebuffer(ret);

      this.destroyRenderTarget();

      return false;
    }

    this._renderTexture = ret;
    this._bufferWidth = displayBufferWidth;
    this._bufferHeight = displayBufferHeight;

    this._gl = gl;

    return true;
  }

  /**
   * レンダーターゲットを破棄する。
   */
  public destroyRenderTarget(): void {
    if (this._colorBuffer) {
      this._gl.bindTexture(this._gl.TEXTURE_2D, null);
      this._gl.deleteTexture(this._colorBuffer);
      this._colorBuffer = null;
    }

    if (this._renderTexture) {
      this._gl.bindFramebuffer(this._gl.FRAMEBUFFER, null);
      this._gl.deleteFramebuffer(this._renderTexture);
      this._renderTexture = null;
    }
  }

  /**
   * WebGLのコンテキストを取得する。
   *
   * @return WebGLRenderingContextまたはWebGL2RenderingContext
   */
  public getGL(): WebGLRenderingContext | WebGL2RenderingContext {
    return this._gl;
  }

  /**
   * レンダーテクスチャを取得する。
   *
   * @return WebGLFramebuffer
   */
  public getRenderTexture(): WebGLFramebuffer {
    return this._renderTexture;
  }

  /**
   * カラーバッファを取得する。
   *
   * @return WebGLTexture
   */
  public getColorBuffer(): WebGLTexture {
    return this._colorBuffer;
  }

  /**
   * カラーバッファの幅を取得する。
   *
   * @return カラーバッファの幅
   */
  public getBufferWidth(): number {
    return this._bufferWidth;
  }

  /**
   * カラーバッファの高さを取得する。
   *
   * @return カラーバッファの高さ
   */
  public getBufferHeight(): number {
    return this._bufferHeight;
  }

  /**
   * オフスクリーンサーフェスが有効かどうかを確認する。
   *
   * @return 有効な場合はtrue、無効な場合はfalse
   */
  public isValid(): boolean {
    return this._renderTexture != null;
  }

  /**
   * オフスクリーンのインデックスを設定する。
   *
   * @param offscreenIndex オフスクリーンのインデックス
   */
  public setOffscreenIndex(offscreenIndex: number): void {
    this._offscreenIndex = offscreenIndex;
  }

  /**
   * オフスクリーンのインデックスを取得する。
   *
   * @return オフスクリーンのインデックス
   */
  public getOffscreenIndex(): number {
    return this._offscreenIndex;
  }

  /**
   * 以前のフレームバッファを取得する。
   *
   * @return 以前のフレームバッファ
   */
  public getOldFBO(): WebGLFramebuffer {
    return this._oldFbo;
  }

  /**
   * 以前のオフスクリーンサーフェスを設定する。
   *
   * @param oldOffscreen 以前のオフスクリーンサーフェス
   */
  public setOldOffscreen(oldOffscreen: CubismRenderTarget_WebGL): void {
    this._oldOffscreen = oldOffscreen;
  }

  /**
   * 以前のオフスクリーンサーフェスを取得する。
   *
   * @return 以前のオフスクリーンサーフェス
   */
  public getOldOffscreen(): CubismRenderTarget_WebGL {
    return this._oldOffscreen;
  }

  /**
   * 親のオフスクリーンサーフェスを設定する。
   *
   * @param parentOffscreenRenderTarget 親のオフスクリーンサーフェス
   */
  public setParentPartOffscreen(
    parentOffscreenRenderTarget: CubismRenderTarget_WebGL
  ): void {
    this._parentOffscreenRenderTarget = parentOffscreenRenderTarget;
  }

  /**
   * 親のオフスクリーンサーフェスを取得する。
   *
   * @return 親のオフスクリーンサーフェス
   */
  public getParentPartOffscreen(): CubismRenderTarget_WebGL {
    return this._parentOffscreenRenderTarget;
  }

  /**
   * コンストラクタ
   */
  constructor() {
    this._gl = null;
    this._colorBuffer = null;
    this._renderTexture = null;
    this._bufferWidth = 0;
    this._bufferHeight = 0;
    this._oldFbo = null;
    this._offscreenIndex = -1;
    this._parentOffscreenRenderTarget = null;
    this._oldOffscreen = null;
  }

  private _gl: WebGLRenderingContext | WebGL2RenderingContext; // WebGLのコンテキスト
  private _colorBuffer: WebGLTexture; // カラーバッファ
  private _renderTexture: WebGLFramebuffer; // フレームバッファ
  private _bufferWidth: number; // カラーバッファの幅
  private _bufferHeight: number; // カラーバッファの高さ
  private _oldFbo: WebGLFramebuffer; // 以前のフレームバッファ

  private _offscreenIndex: number; // オフスクリーンのインデックス
  private _parentOffscreenRenderTarget: CubismRenderTarget_WebGL; // 親のオフスクリーンレンダーターゲット
  private _oldOffscreen: CubismRenderTarget_WebGL; // 以前のオフスクリーンレンダーターゲット
}

// Namespace definition for compatibility.
import * as $ from './cubismrendertarget_webgl';
// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Live2DCubismFramework {
  export const CubismOffscreenSurface_WebGL = $.CubismRenderTarget_WebGL;
  export type CubismOffscreenSurface_WebGL = $.CubismRenderTarget_WebGL;
}
