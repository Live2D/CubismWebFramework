/**
 * Copyright(c) Live2D Inc. All rights reserved.
 *
 * Use of this source code is governed by the Live2D Open Software license
 * that can be found at https://www.live2d.com/eula/live2d-open-software-license-agreement_en.html.
 */

import { csmVector } from '../type/csmvector';

/**
 * フレームバッファなどのコンテナのクラス
 */
class CubismRenderTargetContainer {
  /**
   * Constructor
   *
   * @param colorBuffer カラーバッファ
   * @param renderTexture レンダーテクスチャ
   * @param inUse 使用中かどうか
   */
  public constructor(
    colorBuffer: WebGLTexture = null,
    renderTexture: WebGLFramebuffer = null,
    inUse: boolean = false
  ) {
    this.colorBuffer = colorBuffer;
    this.renderTexture = renderTexture;
    this.inUse = inUse;
  }

  public clear(): void {
    this.colorBuffer = null;
    this.renderTexture = null;
    this.inUse = false;
  }

  /**
   * カラーバッファを取得
   *
   * @returns カラーバッファ
   */
  public getColorBuffer(): WebGLTexture {
    return this.colorBuffer;
  }

  /**
   * レンダーテクスチャを取得
   *
   * @returns レンダーテクスチャ
   */
  public getRenderTexture(): WebGLFramebuffer {
    return this.renderTexture;
  }

  public colorBuffer: WebGLTexture; // colorBuffer
  public renderTexture: WebGLFramebuffer; // renderTarget
  public inUse: boolean; // Whether this container's render target is currently in use
}

/**
 * WebGLContextごとのリソース管理を行う内部クラス
 */
class CubismWebGLContextManager {
  constructor(gl: WebGLRenderingContext | WebGL2RenderingContext) {
    this.gl = gl;
    this.offscreenRenderTargetContainers =
      new csmVector<CubismRenderTargetContainer>();
    this.previousActiveRenderTextureMaxCount = 0;
    this.currentActiveRenderTextureCount = 0;
    this.hasResetThisFrame = false;
    this.width = 0;
    this.height = 0;
  }

  public release(): void {
    if (this.offscreenRenderTargetContainers != null) {
      for (
        let index = 0;
        index < this.offscreenRenderTargetContainers.getSize();
        ++index
      ) {
        const container = this.offscreenRenderTargetContainers.at(index);
        this.gl.deleteTexture(container.colorBuffer);
        this.gl.deleteFramebuffer(container.renderTexture);
      }
      this.offscreenRenderTargetContainers.clear();
      this.offscreenRenderTargetContainers = null;
    }
  }

  public gl: WebGLRenderingContext | WebGL2RenderingContext; // WebGLContext
  public offscreenRenderTargetContainers: csmVector<CubismRenderTargetContainer>; // オフスクリーン描画用レンダーターゲットのリスト
  public previousActiveRenderTextureMaxCount: number; // 直前のアクティブなレンダーターゲットの最大数
  public currentActiveRenderTextureCount: number; // 現在のアクティブなレンダーターゲットの数
  public hasResetThisFrame: boolean; // 今フレームでリセットされたかどうか
  public width: number; // 幅
  public height: number; // 高さ
}

/**
 * WebGL用オフスクリーン描画機能を管理するマネージャ
 * オフスクリーン描画機能に必要なフレームバッファなどを含むコンテナを管理する。
 * 複数のWebGLContextに対応。
 */
export class CubismWebGLOffscreenManager {
  /**
   * コンストラクタ
   */
  private constructor() {
    this._contextManagers = new Map<
      WebGLRenderingContext | WebGL2RenderingContext,
      CubismWebGLContextManager
    >();
  }

  /**
   * デストラクタ相当の処理
   */
  public release(): void {
    if (this._contextManagers != null) {
      for (const manager of this._contextManagers.values()) {
        manager.release();
      }
      this._contextManagers.clear();
      this._contextManagers = null;
    }
    CubismWebGLOffscreenManager._instance = null;
  }

  /**
   * インスタンスの取得
   *
   * @return インスタンス
   */
  public static getInstance(): CubismWebGLOffscreenManager {
    if (this._instance == null) {
      this._instance = new CubismWebGLOffscreenManager();
    }

    return this._instance;
  }

  /**
   * WebGLContextに対応するマネージャーを取得または作成
   *
   * @param gl WebGLRenderingContextまたはWebGL2RenderingContext
   * @return WebGLContextManager
   */
  private getContextManager(
    gl: WebGLRenderingContext | WebGL2RenderingContext
  ): CubismWebGLContextManager {
    if (!this._contextManagers.has(gl)) {
      this._contextManagers.set(gl, new CubismWebGLContextManager(gl));
    }
    return this._contextManagers.get(gl);
  }

  /**
   * 指定されたWebGLContextのマネージャーを削除
   *
   * @param gl WebGLRenderingContextまたはWebGL2RenderingContext
   */
  public removeContext(
    gl: WebGLRenderingContext | WebGL2RenderingContext
  ): void {
    if (this._contextManagers.has(gl)) {
      const manager = this._contextManagers.get(gl);
      manager.release();
      this._contextManagers.delete(gl);
    }
  }

  /**
   * 初期化処理
   *
   * @param gl WebGLRenderingContextまたはWebGL2RenderingContext
   * @param width 幅
   * @param height 高さ
   */
  public initialize(
    gl: WebGLRenderingContext | WebGL2RenderingContext,
    width: number,
    height: number
  ): void {
    const contextManager = this.getContextManager(gl);

    // initialize offscreenRenderTargetContainers
    if (contextManager.offscreenRenderTargetContainers != null) {
      for (
        let index = 0;
        index < contextManager.offscreenRenderTargetContainers.getSize();
        ++index
      ) {
        const container =
          contextManager.offscreenRenderTargetContainers.at(index);
        contextManager.gl.deleteTexture(container.colorBuffer);
        contextManager.gl.deleteFramebuffer(container.renderTexture);
        container.clear();
      }
      contextManager.offscreenRenderTargetContainers.clear();
    } else {
      contextManager.offscreenRenderTargetContainers =
        new csmVector<CubismRenderTargetContainer>();
    }

    contextManager.width = width;
    contextManager.height = height;
    contextManager.previousActiveRenderTextureMaxCount = 0;
    contextManager.currentActiveRenderTextureCount = 0;
    contextManager.hasResetThisFrame = false;
  }

  /**
   * フレーム描画開始時のリセット
   *
   * @param gl WebGLRenderingContextまたはWebGL2RenderingContext
   */
  public resetPreviousActiveCount(
    gl: WebGLRenderingContext | WebGL2RenderingContext
  ): void {
    const contextManager = this.getContextManager(gl);
    if (contextManager.hasResetThisFrame) {
      return;
    }
    contextManager.previousActiveRenderTextureMaxCount = 0;
    contextManager.hasResetThisFrame = true;
  }

  /**
   * フレーム描画終了時のフラグクリア
   *
   * @param gl WebGLRenderingContextまたはWebGL2RenderingContext
   */
  public clearPreviousActiveRenderTextureCountResetFlag(
    gl: WebGLRenderingContext | WebGL2RenderingContext
  ): void {
    const contextManager = this.getContextManager(gl);
    if (!contextManager.hasResetThisFrame) {
      return;
    }
    contextManager.hasResetThisFrame = false;
  }

  /**
   * コンテナサイズの取得
   *
   * @param gl WebGLRenderingContextまたはWebGL2RenderingContext
   */
  public getContainerSize(
    gl: WebGLRenderingContext | WebGL2RenderingContext
  ): number {
    const contextManager = this.getContextManager(gl);
    if (contextManager.offscreenRenderTargetContainers == null) {
      return 0;
    }
    return contextManager.offscreenRenderTargetContainers.getSize();
  }

  /**
   * 使用可能なリソースコンテナの取得
   *
   * @param gl WebGLRenderingContextまたはWebGL2RenderingContext
   * @param width 幅
   * @param height 高さ
   * @return 使用可能なリソースコンテナ
   */
  public getOffscreenRenderTargetContainers(
    gl: WebGLRenderingContext | WebGL2RenderingContext,
    width: number,
    height: number
  ): CubismRenderTargetContainer {
    const contextManager = this.getContextManager(gl);

    // コンテナが初期化されていないか、サイズが変わったら初期化し直す
    if (
      contextManager.width != width ||
      contextManager.height != height ||
      contextManager.offscreenRenderTargetContainers == null
    ) {
      this.initialize(gl, width, height);
    }

    contextManager.currentActiveRenderTextureCount++;

    // 最大数更新
    contextManager.previousActiveRenderTextureMaxCount =
      contextManager.currentActiveRenderTextureCount >
      contextManager.previousActiveRenderTextureMaxCount
        ? contextManager.currentActiveRenderTextureCount
        : contextManager.previousActiveRenderTextureMaxCount;

    // 使われていないリソースコンテナがあればそれを返す
    for (
      let index = 0;
      index < contextManager.offscreenRenderTargetContainers.getSize();
      ++index
    ) {
      const container =
        contextManager.offscreenRenderTargetContainers.at(index);
      if (container.inUse == false) {
        container.inUse = true;
        return container;
      }
    }

    // 使われていないリソースコンテナがなければ新たに作成する
    const colorTexture = contextManager.gl.createTexture();
    contextManager.gl.bindTexture(contextManager.gl.TEXTURE_2D, colorTexture);
    contextManager.gl.texImage2D(
      contextManager.gl.TEXTURE_2D,
      0,
      contextManager.gl.RGBA,
      width,
      height,
      0,
      contextManager.gl.RGBA,
      contextManager.gl.UNSIGNED_BYTE,
      null
    );
    contextManager.gl.texParameteri(
      contextManager.gl.TEXTURE_2D,
      contextManager.gl.TEXTURE_WRAP_S,
      contextManager.gl.CLAMP_TO_EDGE
    );
    contextManager.gl.texParameteri(
      contextManager.gl.TEXTURE_2D,
      contextManager.gl.TEXTURE_WRAP_T,
      contextManager.gl.CLAMP_TO_EDGE
    );
    contextManager.gl.texParameteri(
      contextManager.gl.TEXTURE_2D,
      contextManager.gl.TEXTURE_MIN_FILTER,
      contextManager.gl.LINEAR
    );
    contextManager.gl.texParameteri(
      contextManager.gl.TEXTURE_2D,
      contextManager.gl.TEXTURE_MAG_FILTER,
      contextManager.gl.LINEAR
    );

    const renderFramebuffer = contextManager.gl.createFramebuffer();
    if (renderFramebuffer == null) {
      console.error('Failed to create framebuffer');
      return null;
    }
    contextManager.gl.bindFramebuffer(
      contextManager.gl.FRAMEBUFFER,
      renderFramebuffer
    );
    contextManager.gl.framebufferTexture2D(
      contextManager.gl.FRAMEBUFFER,
      contextManager.gl.COLOR_ATTACHMENT0,
      contextManager.gl.TEXTURE_2D,
      colorTexture,
      0
    );

    const status = contextManager.gl.checkFramebufferStatus(
      contextManager.gl.FRAMEBUFFER
    );
    if (status !== contextManager.gl.FRAMEBUFFER_COMPLETE) {
      console.error('Framebuffer is not complete');
      contextManager.gl.deleteFramebuffer(renderFramebuffer);
      return null;
    }

    const offscreenRenderTextureContainer = new CubismRenderTargetContainer(
      colorTexture,
      renderFramebuffer,
      true
    );
    contextManager.offscreenRenderTargetContainers.pushBack(
      offscreenRenderTextureContainer
    );

    return offscreenRenderTextureContainer;
  }

  /**
   * リソースコンテナの使用状態を取得
   *
   * @param gl WebGLRenderingContextまたはWebGL2RenderingContext
   * @param renderTexture WebGLFramebuffer
   * @return 使用中はtrue、未使用の場合はfalse
   */
  public getUsingRenderTextureState(
    gl: WebGLRenderingContext | WebGL2RenderingContext,
    renderTexture: WebGLFramebuffer
  ): boolean {
    const contextManager = this.getContextManager(gl);
    for (
      let index = 0;
      index < contextManager.offscreenRenderTargetContainers.getSize();
      ++index
    ) {
      if (
        contextManager.offscreenRenderTargetContainers.at(index)
          .renderTexture != renderTexture
      ) {
        continue;
      }

      return contextManager.offscreenRenderTargetContainers.at(index).inUse;
    }
    return true;
  }

  /**
   * リソースコンテナの使用を終了する。
   *
   * @param gl WebGLRenderingContextまたはWebGL2RenderingContext
   * @param renderTexture WebGLFramebuffer
   */
  public stopUsingRenderTexture(
    gl: WebGLRenderingContext | WebGL2RenderingContext,
    renderTexture: WebGLFramebuffer
  ): void {
    const contextManager = this.getContextManager(gl);
    for (
      let index = 0;
      index < contextManager.offscreenRenderTargetContainers.getSize();
      ++index
    ) {
      if (
        contextManager.offscreenRenderTargetContainers.at(index)
          .renderTexture != renderTexture
      ) {
        continue;
      }

      contextManager.offscreenRenderTargetContainers.at(index).inUse = false;

      contextManager.currentActiveRenderTextureCount--;
      if (contextManager.currentActiveRenderTextureCount < 0) {
        contextManager.currentActiveRenderTextureCount = 0;
      }
      break;
    }
  }

  /**
   * リソースコンテナの使用を全て終了する。
   *
   * @param gl WebGLRenderingContextまたはWebGL2RenderingContext
   */
  public stopUsingAllRenderTextures(
    gl: WebGLRenderingContext | WebGL2RenderingContext
  ): void {
    const contextManager = this.getContextManager(gl);
    for (
      let index = 0;
      index < contextManager.offscreenRenderTargetContainers.getSize();
      ++index
    ) {
      contextManager.offscreenRenderTargetContainers.at(index).inUse = false;
    }

    contextManager.currentActiveRenderTextureCount = 0;
  }

  /**
   * 使用されていないリソースコンテナを解放する。
   *
   * @param gl WebGLRenderingContextまたはWebGL2RenderingContext
   */
  public releaseStaleRenderTextures(
    gl: WebGLRenderingContext | WebGL2RenderingContext
  ): void {
    const contextManager = this.getContextManager(gl);
    if (
      contextManager.offscreenRenderTargetContainers == null ||
      contextManager.offscreenRenderTargetContainers.getSize() === 0 ||
      contextManager.offscreenRenderTargetContainers.getSize() <=
        contextManager.previousActiveRenderTextureMaxCount
    ) {
      return;
    }

    const newSize = Math.max(
      0,
      contextManager.previousActiveRenderTextureMaxCount
    );
    for (
      let index = newSize;
      index < contextManager.offscreenRenderTargetContainers.getSize();
      ++index
    ) {
      const container =
        contextManager.offscreenRenderTargetContainers.at(index);
      contextManager.gl.bindTexture(contextManager.gl.TEXTURE_2D, null);
      contextManager.gl.deleteTexture(container.colorBuffer);
      contextManager.gl.bindFramebuffer(contextManager.gl.FRAMEBUFFER, null);
      contextManager.gl.deleteFramebuffer(container.renderTexture);
      container.clear();
    }
    contextManager.offscreenRenderTargetContainers.resize(newSize);
  }

  /**
   * 直前のアクティブなレンダーターゲットの最大数を取得
   *
   * @param gl WebGLRenderingContextまたはWebGL2RenderingContext
   * @returns 直前のアクティブなレンダーターゲットの最大数
   */
  public getPreviousActiveRenderTextureCount(
    gl: WebGLRenderingContext | WebGL2RenderingContext
  ): number {
    const contextManager = this.getContextManager(gl);
    return contextManager.previousActiveRenderTextureMaxCount;
  }

  /**
   * 現在のアクティブなレンダーターゲットの数を取得
   *
   * @param gl WebGLRenderingContextまたはWebGL2RenderingContext
   * @returns 現在のアクティブなレンダーターゲットの数
   */
  public getCurrentActiveRenderTextureCount(
    gl: WebGLRenderingContext | WebGL2RenderingContext
  ): number {
    const contextManager = this.getContextManager(gl);
    return contextManager.currentActiveRenderTextureCount;
  }

  private static _instance: CubismWebGLOffscreenManager; // オフスクリーン描画用レンダーターゲットマネージャ
  private _contextManagers: Map<
    WebGLRenderingContext | WebGL2RenderingContext,
    CubismWebGLContextManager
  >; // WebGLContextごとのマネージャー
}
