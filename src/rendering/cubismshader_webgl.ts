/**
 * Copyright(c) Live2D Inc. All rights reserved.
 *
 * Use of this source code is governed by the Live2D Open Software license
 * that can be found at https://www.live2d.com/eula/live2d-open-software-license-agreement_en.html.
 */

import { CubismMatrix44 } from '../math/cubismmatrix44';
import {
  CubismColorBlend,
  CubismModel,
  CubismAlphaBlend
} from '../model/cubismmodel';
import { csmMap, iterator } from '../type/csmmap';
import { csmRect } from '../type/csmrectf';
import { csmVector } from '../type/csmvector';
import { CubismLogError, CubismLogWarning } from '../utils/cubismdebug';
import { CubismRenderTarget_WebGL } from './cubismrendertarget_webgl';
import { CubismBlendMode, CubismTextureColor } from './cubismrenderer';
import { CubismRenderer_WebGL } from './cubismrenderer_webgl';

// Shader
const VertShaderSrcCopyPath = 'vertshadersrccopy.vert';
const FragShaderSrcCopyPath = 'fragshadersrccopy.frag';
const FragShaderSrcColorBlendPath = 'fragshadersrccolorblend.frag';
const FragShaderSrcAlphaBlendPath = 'fragshadersrcalphablend.frag';
const VertShaderSrcBlendPath = 'vertshadersrcblend.vert';
const FragShaderSrcBlendPath = 'fragshadersrcpremultipliedalphablend.frag';

// Blend mode Prefix
const ColorBlendPrefix = 'ColorBlend_';
const AlphaBlendPrefix = 'AlphaBlend_';

let s_instance: CubismShaderManager_WebGL; // インスタンス（シングルトン）

const s_renderTargetVertexArray: Float32Array = new Float32Array([
  -1.0, -1.0, 1.0, -1.0, -1.0, 1.0, 1.0, 1.0
]);
const s_renderTargetUvArray: Float32Array = new Float32Array([
  0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 1.0, 1.0
]);
const s_renderTargetReverseUvArray = new Float32Array([
  0.0, 1.0, 1.0, 1.0, 0.0, 0.0, 1.0, 0.0
]);

/**
 * WebGL用のシェーダープログラムを生成・破棄するクラス
 */
export class CubismShader_WebGL {
  /**
   * 非同期でシェーダーをパスから読み込む
   *
   * @param url シェーダーのURL
   *
   * @return シェーダーのソースコード
   */
  private async loadShader(url: string): Promise<string> {
    const response = await fetch(url);
    return await response.text();
  }

  /**
   * ブレンドモード用のシェーダーを読み込む
   */
  private async loadBlendModeShaders(): Promise<void> {
    const shaderDir = '../../Framework/Shaders/WebGL/';

    // シェーダーファイルのパスとプロパティの対応
    // NOTE: prop は CubismShader_WebGL に設定された変数名
    const shaderFiles: { path: string; prop: keyof CubismShader_WebGL }[] = [
      { path: shaderDir + VertShaderSrcCopyPath, prop: '_vertShaderSrcCopy' },
      { path: shaderDir + FragShaderSrcCopyPath, prop: '_fragShaderSrcCopy' },
      {
        path: shaderDir + FragShaderSrcColorBlendPath,
        prop: '_fragShaderSrcColorBlend'
      },
      {
        path: shaderDir + FragShaderSrcAlphaBlendPath,
        prop: '_fragShaderSrcAlphaBlend'
      },
      { path: shaderDir + VertShaderSrcBlendPath, prop: '_vertShaderSrcBlend' },
      { path: shaderDir + FragShaderSrcBlendPath, prop: '_fragShaderSrcBlend' }
    ];

    // シェーダーファイルを非同期で読み込み、結果をプロパティに設定
    const results = await Promise.all(
      shaderFiles.map(file =>
        this.loadShader(file.path)
          .then(data => ({ prop: file.prop, data }))
          .catch(error => {
            console.error(`Error loading ${file.path} shader:`, error);
            return { prop: file.prop, data: '' };
          })
      )
    );

    // 変数に内容を登録
    results.forEach(result => {
      (this as any)[result.prop] = result.data;
    });
  }

  /**
   * コンストラクタ
   */
  public constructor() {
    this._shaderSets = new csmVector<CubismShaderSet>();
    this._isShaderLoaded = false;

    // カラーブレンド用のマップ
    this._colorBlendMap = new csmMap<CubismColorBlend, string>();
    this._colorBlendValues = new csmVector<CubismColorBlend>();

    const colorBlendKeys = Object.keys(CubismColorBlend);

    // Object.values() のポリフィル
    const colorBlendRawValues = Object.keys(CubismColorBlend).map(
      k => CubismColorBlend[k as keyof typeof CubismColorBlend]
    );

    for (let i = 0; i < colorBlendKeys.length; i++) {
      const colorBlendKey = colorBlendKeys[i];

      if (colorBlendKey.includes(ColorBlendPrefix)) {
        const blendModeName = colorBlendKey.slice(ColorBlendPrefix.length);

        const colorBlendNumber = parseInt(colorBlendRawValues[i].toString());

        this._colorBlendMap.setValue(colorBlendNumber, blendModeName);

        this._colorBlendValues.pushBack(colorBlendNumber);
      }
    }

    // アルファブレンド用のマップ
    this._alphaBlendMap = new csmMap<CubismAlphaBlend, string>();
    this._alphaBlendValues = new csmVector<CubismAlphaBlend>();

    const alphaBlendKeys = Object.keys(CubismAlphaBlend);

    // Object.values() のポリフィル
    const alphaBlendRawValues = Object.keys(CubismAlphaBlend).map(
      k => CubismAlphaBlend[k as keyof typeof CubismAlphaBlend]
    );

    for (let i = 0; i < alphaBlendKeys.length; i++) {
      const alphaBlendKey = alphaBlendKeys[i];

      if (alphaBlendKey.includes(AlphaBlendPrefix)) {
        const blendModeName = alphaBlendKey.slice(AlphaBlendPrefix.length);

        const alphaBlendNumber = parseInt(alphaBlendRawValues[i].toString());

        this._alphaBlendMap.setValue(alphaBlendNumber, blendModeName);

        this._alphaBlendValues.pushBack(alphaBlendNumber);
      }
    }

    this._blendShaderSetMap = new csmMap<string, number>();

    this._shaderCount =
      ShaderNames.ShaderNames_ShaderCount +
      1 +
      (this._colorBlendValues.getSize() - 3) *
        (this._alphaBlendValues.getSize() - 1) *
        3;
    // シェーダーの数 =
    // (マスク生成用 + (通常用 + 加算 + 乗算) * (マスク無の乗算済アルファ対応版 + マスク有の乗算済アルファ対応版 + マスク有反転の乗算済アルファ対応版))
    // + 1（コピー用のシェーダー）
    // + カラーブレンドの数（後方互換とNone除く） * アルファブレンドの数（None除く） * （通常 + マスク + 反転マスク）
  }

  /**
   * デストラクタ相当の処理
   */
  public release(): void {
    this.releaseShaderProgram();
  }

  /**
   * 描画用のシェーダプログラムの一連のセットアップを実行する
   *
   * @param renderer レンダラー
   * @param model 描画対象のモデル
   * @param index 描画対象のメッシュのインデックス
   */
  public setupShaderProgramForDrawable(
    renderer: CubismRenderer_WebGL,
    model: Readonly<CubismModel>,
    index: number
  ): void {
    if (!renderer.isPremultipliedAlpha()) {
      CubismLogError('NoPremultipliedAlpha is not allowed');
    }

    if (this._shaderSets.getSize() == 0) {
      this.generateShaders();
    }

    // Blending
    let srcColor: number;
    let dstColor: number;
    let srcAlpha: number;
    let dstAlpha: number;

    // _shaderSets用のオフセット計算
    const masked: boolean =
      renderer.getClippingContextBufferForDrawable() != null; // この描画オブジェクトはマスク対象か
    const invertedMask: boolean = model.getDrawableInvertedMaskBit(index);
    const offset: number = masked ? (invertedMask ? 2 : 1) : 0;

    let shaderSet: CubismShaderSet;
    // Cubism 5.2以前のシェーダを使用する場合はtrue
    let isUsingCompatible: boolean = true;

    if (model.isBlendModeEnabled()) {
      const colorBlendMode: CubismColorBlend =
        model.getDrawableColorBlend(index);
      const alphaBlendMode: CubismAlphaBlend =
        model.getDrawableAlphaBlend(index);

      if (
        colorBlendMode == CubismColorBlend.ColorBlend_None ||
        alphaBlendMode == CubismAlphaBlend.AlphaBlend_None ||
        (colorBlendMode == CubismColorBlend.ColorBlend_Normal &&
          alphaBlendMode == CubismAlphaBlend.AlphaBlend_Over)
      ) {
        // Cubism 5.2以前のシェーダを使用する。
        shaderSet = this._shaderSets.at(
          ShaderNames.ShaderNames_NormalPremultipliedAlpha + offset
        );

        srcColor = this.gl.ONE;
        dstColor = this.gl.ONE_MINUS_SRC_ALPHA;
        srcAlpha = this.gl.ONE;
        dstAlpha = this.gl.ONE_MINUS_SRC_ALPHA;
      } else {
        switch (colorBlendMode) {
          // Cubism 5.2以前のシェーダを使用する。
          case CubismColorBlend.ColorBlend_AddCompatible:
            shaderSet = this._shaderSets.at(
              ShaderNames.ShaderNames_AddPremultipliedAlpha + offset
            );
            srcColor = this.gl.ONE;
            dstColor = this.gl.ONE;
            srcAlpha = this.gl.ZERO;
            dstAlpha = this.gl.ONE;
            break;
          // Cubism 5.2以前のシェーダを使用する。
          case CubismColorBlend.ColorBlend_MultiplyCompatible:
            shaderSet = this._shaderSets.at(
              ShaderNames.ShaderNames_MultPremultipliedAlpha + offset
            );
            srcColor = this.gl.DST_COLOR;
            dstColor = this.gl.ONE_MINUS_SRC_ALPHA;
            srcAlpha = this.gl.ZERO;
            dstAlpha = this.gl.ONE;
            break;
          // ブレンドモードの組み合わせでシェーダーを決定
          default:
            {
              const srcBuffer =
                renderer._currentOffscreen != null
                  ? renderer._currentOffscreen
                  : renderer.getModelRenderTarget(0);

              // 先にコピーを行う
              CubismRenderTarget_WebGL.copyBuffer(
                this.gl as WebGL2RenderingContext,
                srcBuffer,
                renderer.getModelRenderTarget(1)
              );
              const baseShaderSetIndex = this._blendShaderSetMap.getValue(
                this._colorBlendMap.getValue(colorBlendMode) +
                  this._alphaBlendMap.getValue(alphaBlendMode)
              );
              shaderSet = this._shaderSets.at(baseShaderSetIndex + offset);
              srcColor = this.gl.ONE;
              dstColor = this.gl.ZERO;
              srcAlpha = this.gl.ONE;
              dstAlpha = this.gl.ZERO;
              isUsingCompatible = false;
            }
            break;
        }
      }
    } else {
      // Cubism 5.2以前のシェーダを使用する。
      switch (model.getDrawableBlendMode(index)) {
        case CubismBlendMode.CubismBlendMode_Normal:
        default:
          shaderSet = this._shaderSets.at(
            ShaderNames.ShaderNames_NormalPremultipliedAlpha + offset
          );
          srcColor = this.gl.ONE;
          dstColor = this.gl.ONE_MINUS_SRC_ALPHA;
          srcAlpha = this.gl.ONE;
          dstAlpha = this.gl.ONE_MINUS_SRC_ALPHA;
          break;

        case CubismBlendMode.CubismBlendMode_Additive:
          shaderSet = this._shaderSets.at(
            ShaderNames.ShaderNames_AddPremultipliedAlpha + offset
          );
          srcColor = this.gl.ONE;
          dstColor = this.gl.ONE;
          srcAlpha = this.gl.ZERO;
          dstAlpha = this.gl.ONE;
          break;

        case CubismBlendMode.CubismBlendMode_Multiplicative:
          shaderSet = this._shaderSets.at(
            ShaderNames.ShaderNames_MultPremultipliedAlpha + offset
          );
          srcColor = this.gl.DST_COLOR;
          dstColor = this.gl.ONE_MINUS_SRC_ALPHA;
          srcAlpha = this.gl.ZERO;
          dstAlpha = this.gl.ONE;
          break;
      }
    }

    this.gl.useProgram(shaderSet.shaderProgram);

    // 頂点配列の設定
    if (renderer._bufferData.vertex == null) {
      renderer._bufferData.vertex = this.gl.createBuffer();
    }
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, renderer._bufferData.vertex);

    // 頂点配列の設定
    const vertexArray: Float32Array = model.getDrawableVertices(index);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, vertexArray, this.gl.DYNAMIC_DRAW);
    this.gl.enableVertexAttribArray(shaderSet.attributePositionLocation);
    this.gl.vertexAttribPointer(
      shaderSet.attributePositionLocation,
      2,
      this.gl.FLOAT,
      false,
      0,
      0
    );

    // テクスチャ頂点の設定
    if (renderer._bufferData.uv == null) {
      renderer._bufferData.uv = this.gl.createBuffer();
    }
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, renderer._bufferData.uv);
    const uvArray: Float32Array = model.getDrawableVertexUvs(index);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, uvArray, this.gl.DYNAMIC_DRAW);
    this.gl.enableVertexAttribArray(shaderSet.attributeTexCoordLocation);
    this.gl.vertexAttribPointer(
      shaderSet.attributeTexCoordLocation,
      2,
      this.gl.FLOAT,
      false,
      0,
      0
    );

    if (masked) {
      this.gl.activeTexture(this.gl.TEXTURE1);

      // frameBufferに書かれたテクスチャ
      const tex: WebGLTexture = renderer
        .getDrawableMaskBuffer(
          renderer.getClippingContextBufferForDrawable()._bufferIndex
        )
        .getColorBuffer();
      this.gl.bindTexture(this.gl.TEXTURE_2D, tex);
      this.gl.uniform1i(shaderSet.samplerTexture1Location, 1);

      // view座標をClippingContextの座標に変換するための行列を設定
      this.gl.uniformMatrix4fv(
        shaderSet.uniformClipMatrixLocation,
        false,
        renderer.getClippingContextBufferForDrawable()._matrixForDraw.getArray()
      );

      // 使用するカラーチャンネルを設定
      const channelIndex: number =
        renderer.getClippingContextBufferForDrawable()._layoutChannelIndex;
      const colorChannel: CubismTextureColor = renderer
        .getClippingContextBufferForDrawable()
        .getClippingManager()
        .getChannelFlagAsColor(channelIndex);
      this.gl.uniform4f(
        shaderSet.uniformChannelFlagLocation,
        colorChannel.r,
        colorChannel.g,
        colorChannel.b,
        colorChannel.a
      );

      if (model.isBlendModeEnabled()) {
        this.gl.uniform1f(
          shaderSet.uniformInvertMaskFlagLocation,
          invertedMask ? 1.0 : 0.0
        );
      }
    }

    // テクスチャ設定
    const textureNo: number = model.getDrawableTextureIndex(index);
    const textureId: WebGLTexture = renderer
      .getBindedTextures()
      .getValue(textureNo);
    this.gl.activeTexture(this.gl.TEXTURE0);
    this.gl.bindTexture(this.gl.TEXTURE_2D, textureId);
    this.gl.uniform1i(shaderSet.samplerTexture0Location, 0);

    //座標変換
    const matrix4x4: CubismMatrix44 = renderer.getMvpMatrix();
    this.gl.uniformMatrix4fv(
      shaderSet.uniformMatrixLocation,
      false,
      matrix4x4.getArray()
    );

    //ベース色の取得
    let baseColor: CubismTextureColor = null;

    if (model.isBlendModeEnabled()) {
      // ブレンドモードではモデルカラーは最後に処理するため不透明度のみ対応させる
      const drawableOpacity = model.getDrawableOpacity(index);
      baseColor = new CubismTextureColor(
        drawableOpacity,
        drawableOpacity,
        drawableOpacity,
        drawableOpacity
      );
    } else {
      baseColor = renderer.getModelColorWithOpacity(
        model.getDrawableOpacity(index)
      );
    }

    const multiplyColor: CubismTextureColor = model.getMultiplyColor(index);
    const screenColor: CubismTextureColor = model.getScreenColor(index);

    this.gl.uniform4f(
      shaderSet.uniformBaseColorLocation,
      baseColor.r,
      baseColor.g,
      baseColor.b,
      baseColor.a
    );

    this.gl.uniform4f(
      shaderSet.uniformMultiplyColorLocation,
      multiplyColor.r,
      multiplyColor.g,
      multiplyColor.b,
      multiplyColor.a
    );

    this.gl.uniform4f(
      shaderSet.uniformScreenColorLocation,
      screenColor.r,
      screenColor.g,
      screenColor.b,
      screenColor.a
    );

    // Cubism 5.3以降のシェーダを使用する場合
    if (model.isBlendModeEnabled()) {
      this.gl.activeTexture(this.gl.TEXTURE2);

      // Cubism 5.2以前のシェーダを使用する場合は不要なのでこの処理をスキップ
      if (!isUsingCompatible) {
        const tex: WebGLTexture = renderer
          .getModelRenderTarget(1)
          .getColorBuffer();
        this.gl.bindTexture(this.gl.TEXTURE_2D, tex);
        this.gl.uniform1i(shaderSet.samplerFrameBufferTextureLocation, 2);
      }
    }

    // IBOを作成し、データを転送
    if (renderer._bufferData.index == null) {
      renderer._bufferData.index = this.gl.createBuffer();
    }
    const indexArray: Uint16Array = model.getDrawableVertexIndices(index);

    this.gl.bindBuffer(
      this.gl.ELEMENT_ARRAY_BUFFER,
      renderer._bufferData.index
    );
    this.gl.bufferData(
      this.gl.ELEMENT_ARRAY_BUFFER,
      indexArray,
      this.gl.DYNAMIC_DRAW
    );

    this.gl.blendFuncSeparate(srcColor, dstColor, srcAlpha, dstAlpha);
  }

  /**
   * オフスクリーン用のシェーダプログラムの一連のセットアップを実行する
   *
   * @param renderer レンダラー
   * @param model 描画対象のモデル
   * @param offscreen 描画対象のオフスクリーン
   */
  public setupShaderProgramForOffscreen(
    renderer: CubismRenderer_WebGL,
    model: Readonly<CubismModel>,
    offscreen: CubismRenderTarget_WebGL
  ): void {
    if (!renderer.isPremultipliedAlpha()) {
      CubismLogError('NoPremultipliedAlpha is not allowed');
    }

    if (this._shaderSets.getSize() === 0) {
      this.generateShaders();
    }

    if (this._isShaderLoaded == false) {
      CubismLogWarning('Shader program is not initialized.');
      return;
    }

    // Blending
    let srcColor: number;
    let dstColor: number;
    let srcAlpha: number;
    let dstAlpha: number;

    const offscreenIndex: number = offscreen.getOffscreenIndex();
    // _shaderSets用のオフセット計算
    const masked: boolean =
      renderer.getClippingContextBufferForOffscreen() != null; // この描画オブジェクトはマスク対象か
    const invertedMask: boolean =
      model.getOffscreenInvertedMask(offscreenIndex);
    const offset: number = masked ? (invertedMask ? 2 : 1) : 0;

    let shaderSet: CubismShaderSet;
    // Cubism 5.2以前のシェーダを使用する場合はtrue
    let isUsingCompatible: boolean = true;

    const colorBlendMode: CubismColorBlend =
      model.getOffscreenColorBlend(offscreenIndex);
    const alphaBlendMode: CubismAlphaBlend =
      model.getOffscreenAlphaBlend(offscreenIndex);

    if (
      colorBlendMode == CubismColorBlend.ColorBlend_None ||
      alphaBlendMode == CubismAlphaBlend.AlphaBlend_None ||
      (colorBlendMode == CubismColorBlend.ColorBlend_Normal &&
        alphaBlendMode == CubismAlphaBlend.AlphaBlend_Over)
    ) {
      // Cubism 5.2以前のシェーダを使用する。
      shaderSet = this._shaderSets.at(
        ShaderNames.ShaderNames_NormalPremultipliedAlpha + offset
      );

      srcColor = this.gl.ONE;
      dstColor = this.gl.ONE_MINUS_SRC_ALPHA;
      srcAlpha = this.gl.ONE;
      dstAlpha = this.gl.ONE_MINUS_SRC_ALPHA;
    } else {
      switch (colorBlendMode as CubismColorBlend) {
        // Cubism 5.2以前のシェーダを使用する。
        case CubismColorBlend.ColorBlend_AddCompatible:
          shaderSet = this._shaderSets.at(
            ShaderNames.ShaderNames_AddPremultipliedAlpha + offset
          );
          srcColor = this.gl.ONE;
          dstColor = this.gl.ONE;
          srcAlpha = this.gl.ZERO;
          dstAlpha = this.gl.ONE;
          break;
        case CubismColorBlend.ColorBlend_MultiplyCompatible:
          shaderSet = this._shaderSets.at(
            ShaderNames.ShaderNames_MultPremultipliedAlpha + offset
          );
          srcColor = this.gl.DST_COLOR;
          dstColor = this.gl.ONE_MINUS_SRC_ALPHA;
          srcAlpha = this.gl.ZERO;
          dstAlpha = this.gl.ONE;
          break;
        default:
          {
            const srcBuffer =
              offscreen.getOldOffscreen() != null
                ? offscreen.getOldOffscreen()
                : renderer.getModelRenderTarget(0);

            // 先にコピーを行う
            CubismRenderTarget_WebGL.copyBuffer(
              this.gl as WebGL2RenderingContext,
              srcBuffer,
              renderer.getModelRenderTarget(1)
            );
            const baseShaderSetIndex = this._blendShaderSetMap.getValue(
              this._colorBlendMap.getValue(colorBlendMode) +
                this._alphaBlendMap.getValue(alphaBlendMode)
            );
            shaderSet = this._shaderSets.at(baseShaderSetIndex + offset);
            srcColor = this.gl.ONE;
            dstColor = this.gl.ZERO;
            srcAlpha = this.gl.ONE;
            dstAlpha = this.gl.ZERO;
            isUsingCompatible = false;
          }
          break;
      }
    }

    this.gl.useProgram(shaderSet.shaderProgram);

    // 頂点配列の設定
    CubismRenderTarget_WebGL.copyBuffer(
      this.gl as WebGL2RenderingContext,
      offscreen,
      renderer.getModelRenderTarget(2)
    );
    this.gl.activeTexture(this.gl.TEXTURE0);
    const tex0 = renderer.getModelRenderTarget(2).getColorBuffer();
    this.gl.bindTexture(this.gl.TEXTURE_2D, tex0);
    this.gl.uniform1i(shaderSet.samplerTexture0Location, 0);

    //座標変換
    const matrix4x4: CubismMatrix44 = new CubismMatrix44();
    matrix4x4.loadIdentity();
    this.gl.uniformMatrix4fv(
      shaderSet.uniformMatrixLocation,
      false,
      matrix4x4.getArray()
    );

    // ベース色の取得
    const offscreenOpacity = model.getOffscreenOpacity(offscreenIndex);
    // 乗算済みアルファを使用するのでオフスクリーンの透明度を 1.0 に乗算した状態
    const baseColor: CubismTextureColor = new CubismTextureColor(
      offscreenOpacity,
      offscreenOpacity,
      offscreenOpacity,
      offscreenOpacity
    );

    const multiplyColor: CubismTextureColor =
      model.getMultiplyColorOffscreen(offscreenIndex);
    const screenColor: CubismTextureColor =
      model.getScreenColorOffscreen(offscreenIndex);

    this.gl.uniform4f(
      shaderSet.uniformBaseColorLocation,
      baseColor.r,
      baseColor.g,
      baseColor.b,
      baseColor.a
    );

    this.gl.uniform4f(
      shaderSet.uniformMultiplyColorLocation,
      multiplyColor.r,
      multiplyColor.g,
      multiplyColor.b,
      multiplyColor.a
    );

    this.gl.uniform4f(
      shaderSet.uniformScreenColorLocation,
      screenColor.r,
      screenColor.g,
      screenColor.b,
      screenColor.a
    );

    this.gl.activeTexture(this.gl.TEXTURE2);

    // Cubism 5.2以前のシェーダを使用する場合は不要なのでこの処理をスキップ
    if (!isUsingCompatible) {
      const tex1: WebGLTexture = renderer
        .getModelRenderTarget(1)
        .getColorBuffer();
      this.gl.bindTexture(this.gl.TEXTURE_2D, tex1);
      this.gl.uniform1i(shaderSet.samplerFrameBufferTextureLocation, 2);
    }

    if (masked) {
      this.gl.activeTexture(this.gl.TEXTURE1);

      // frameBufferに書かれたテクスチャ
      const tex2: WebGLTexture = renderer
        .getOffscreenMaskBuffer(
          renderer.getClippingContextBufferForOffscreen()._bufferIndex
        )
        .getColorBuffer();
      this.gl.bindTexture(this.gl.TEXTURE_2D, tex2);
      this.gl.uniform1i(shaderSet.samplerTexture1Location, 1);

      // view座標をClippingContextの座標に変換するための行列を設定
      this.gl.uniformMatrix4fv(
        shaderSet.uniformClipMatrixLocation,
        false,
        renderer
          .getClippingContextBufferForOffscreen()
          ._matrixForDraw.getArray()
      );

      // 使用するカラーチャンネルを設定
      const channelIndex: number =
        renderer.getClippingContextBufferForOffscreen()._layoutChannelIndex;
      const colorChannel: CubismTextureColor = renderer
        .getClippingContextBufferForOffscreen()
        .getClippingManager()
        .getChannelFlagAsColor(channelIndex);
      this.gl.uniform4f(
        shaderSet.uniformChannelFlagLocation,
        colorChannel.r,
        colorChannel.g,
        colorChannel.b,
        colorChannel.a
      );

      if (model.isBlendModeEnabled()) {
        this.gl.uniform1f(
          shaderSet.uniformInvertMaskFlagLocation,
          invertedMask ? 1.0 : 0.0
        );
      }
    }

    // 頂点位置属性の設定
    if (!renderer._bufferData.vertex) {
      renderer._bufferData.vertex = this.gl.createBuffer();
    }
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, renderer._bufferData.vertex);
    this.gl.bufferData(
      this.gl.ARRAY_BUFFER,
      s_renderTargetVertexArray,
      this.gl.STATIC_DRAW
    );
    this.gl.enableVertexAttribArray(shaderSet.attributePositionLocation);
    this.gl.vertexAttribPointer(
      shaderSet.attributePositionLocation,
      2,
      this.gl.FLOAT,
      false,
      Float32Array.BYTES_PER_ELEMENT * 2,
      0
    );

    // テクスチャ座標属性の設定
    if (!renderer._bufferData.uv) {
      renderer._bufferData.uv = this.gl.createBuffer();
    }
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, renderer._bufferData.uv);
    this.gl.bufferData(
      this.gl.ARRAY_BUFFER,
      s_renderTargetReverseUvArray,
      this.gl.STATIC_DRAW
    );
    this.gl.enableVertexAttribArray(shaderSet.attributeTexCoordLocation);
    this.gl.vertexAttribPointer(
      shaderSet.attributeTexCoordLocation,
      2,
      this.gl.FLOAT,
      false,
      Float32Array.BYTES_PER_ELEMENT * 2,
      0
    );

    this.gl.blendFuncSeparate(srcColor, dstColor, srcAlpha, dstAlpha);
  }

  /**
   * マスク用のシェーダプログラムの一連のセットアップを実行する
   *
   * @param renderer レンダラー
   * @param model 描画対象のモデル
   * @param index 描画対象のメッシュのインデックス
   */
  public setupShaderProgramForMask(
    renderer: CubismRenderer_WebGL,
    model: Readonly<CubismModel>,
    index: number
  ): void {
    if (!renderer.isPremultipliedAlpha()) {
      CubismLogError('NoPremultipliedAlpha is not allowed');
    }

    if (this._shaderSets.getSize() == 0) {
      this.generateShaders();
    }

    const shaderSet: CubismShaderSet = this._shaderSets.at(
      ShaderNames.ShaderNames_SetupMask
    );
    this.gl.useProgram(shaderSet.shaderProgram);

    // 頂点配列の設定
    if (renderer._bufferData.vertex == null) {
      renderer._bufferData.vertex = this.gl.createBuffer();
    }
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, renderer._bufferData.vertex);
    const vertexArray: Float32Array = model.getDrawableVertices(index);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, vertexArray, this.gl.DYNAMIC_DRAW);
    this.gl.enableVertexAttribArray(shaderSet.attributePositionLocation);
    this.gl.vertexAttribPointer(
      shaderSet.attributePositionLocation,
      2,
      this.gl.FLOAT,
      false,
      0,
      0
    );

    //テクスチャ設定
    if (renderer._bufferData.uv == null) {
      renderer._bufferData.uv = this.gl.createBuffer();
    }
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, renderer._bufferData.uv);
    const textureNo: number = model.getDrawableTextureIndex(index);
    const textureId: WebGLTexture = renderer
      .getBindedTextures()
      .getValue(textureNo);
    this.gl.activeTexture(this.gl.TEXTURE0);
    this.gl.bindTexture(this.gl.TEXTURE_2D, textureId);
    this.gl.uniform1i(shaderSet.samplerTexture0Location, 0);

    // テクスチャ頂点の設定
    if (renderer._bufferData.uv == null) {
      renderer._bufferData.uv = this.gl.createBuffer();
    }
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, renderer._bufferData.uv);
    const uvArray: Float32Array = model.getDrawableVertexUvs(index);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, uvArray, this.gl.DYNAMIC_DRAW);
    this.gl.enableVertexAttribArray(shaderSet.attributeTexCoordLocation);
    this.gl.vertexAttribPointer(
      shaderSet.attributeTexCoordLocation,
      2,
      this.gl.FLOAT,
      false,
      0,
      0
    );

    // チャンネル
    const channelIndex: number =
      renderer.getClippingContextBufferForMask()._layoutChannelIndex;
    const colorChannel: CubismTextureColor = renderer
      .getClippingContextBufferForMask()
      .getClippingManager()
      .getChannelFlagAsColor(channelIndex);
    this.gl.uniform4f(
      shaderSet.uniformChannelFlagLocation,
      colorChannel.r,
      colorChannel.g,
      colorChannel.b,
      colorChannel.a
    );

    this.gl.uniformMatrix4fv(
      shaderSet.uniformClipMatrixLocation,
      false,
      renderer.getClippingContextBufferForMask()._matrixForMask.getArray()
    );

    const rect: csmRect =
      renderer.getClippingContextBufferForMask()._layoutBounds;

    this.gl.uniform4f(
      shaderSet.uniformBaseColorLocation,
      rect.x * 2.0 - 1.0,
      rect.y * 2.0 - 1.0,
      rect.getRight() * 2.0 - 1.0,
      rect.getBottom() * 2.0 - 1.0
    );

    const multiplyColor: CubismTextureColor = model.getMultiplyColor(index);
    const screenColor: CubismTextureColor = model.getScreenColor(index);

    this.gl.uniform4f(
      shaderSet.uniformMultiplyColorLocation,
      multiplyColor.r,
      multiplyColor.g,
      multiplyColor.b,
      multiplyColor.a
    );

    this.gl.uniform4f(
      shaderSet.uniformScreenColorLocation,
      screenColor.r,
      screenColor.g,
      screenColor.b,
      screenColor.a
    );

    // Blending
    const srcColor: number = this.gl.ZERO;
    const dstColor: number = this.gl.ONE_MINUS_SRC_COLOR;
    const srcAlpha: number = this.gl.ZERO;
    const dstAlpha: number = this.gl.ONE_MINUS_SRC_ALPHA;

    // IBOを作成し、データを転送
    if (renderer._bufferData.index == null) {
      renderer._bufferData.index = this.gl.createBuffer();
    }
    const indexArray: Uint16Array = model.getDrawableVertexIndices(index);

    this.gl.bindBuffer(
      this.gl.ELEMENT_ARRAY_BUFFER,
      renderer._bufferData.index
    );
    this.gl.bufferData(
      this.gl.ELEMENT_ARRAY_BUFFER,
      indexArray,
      this.gl.DYNAMIC_DRAW
    );

    this.gl.blendFuncSeparate(srcColor, dstColor, srcAlpha, dstAlpha);
  }

  /**
   * オフスクリーンのレンダリングターゲット用のシェーダープログラムを設定する
   *
   * @param renderer レンダラー
   */
  public setupShaderProgramForOffscreenRenderTarget(
    renderer: CubismRenderer_WebGL
  ): void {
    if (this._shaderSets.getSize() === 0) {
      this.generateShaders();
    }

    if (this._isShaderLoaded == false) {
      CubismLogWarning('Shader program is not initialized.');
      return;
    }

    // この時点のテクスチャはPMAになっているはずなので計算を行う
    const baseColor = renderer.getModelColor();
    baseColor.r *= baseColor.a;
    baseColor.g *= baseColor.a;
    baseColor.b *= baseColor.a;
    this.copyTexture(renderer, baseColor);
  }

  /**
   * オフスクリーンのレンダリングターゲットの内容をコピーする
   *
   * @param renderer レンダラー
   * @param baseColor ベースカラー
   */
  public copyTexture(
    renderer: CubismRenderer_WebGL,
    baseColor: CubismTextureColor
  ) {
    // Blending
    const srcColor = this.gl.ONE;
    const dstColor = this.gl.ONE_MINUS_SRC_ALPHA;
    const srcAlpha = this.gl.ONE;
    const dstAlpha = this.gl.ONE_MINUS_SRC_ALPHA;

    const shaderSet = this._shaderSets.at(10); // ShaderNames_Copy = 10

    this.gl.useProgram(shaderSet.shaderProgram);

    this.gl.uniform4f(
      shaderSet.uniformBaseColorLocation,
      baseColor.r,
      baseColor.g,
      baseColor.b,
      baseColor.a
    );

    // オフスクリーンの内容を設定
    this.gl.activeTexture(this.gl.TEXTURE0);
    const tex = renderer.getModelRenderTarget(0).getColorBuffer();
    this.gl.bindTexture(this.gl.TEXTURE_2D, tex);
    this.gl.uniform1i(shaderSet.samplerTexture0Location, 0);

    // 頂点位置属性の設定
    if (!renderer._bufferData.vertex) {
      renderer._bufferData.vertex = this.gl.createBuffer();
    }
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, renderer._bufferData.vertex);
    this.gl.bufferData(
      this.gl.ARRAY_BUFFER,
      s_renderTargetVertexArray,
      this.gl.STATIC_DRAW
    );
    this.gl.enableVertexAttribArray(shaderSet.attributePositionLocation);
    this.gl.vertexAttribPointer(
      shaderSet.attributePositionLocation,
      2,
      this.gl.FLOAT,
      false,
      Float32Array.BYTES_PER_ELEMENT * 2,
      0
    );

    // テクスチャ座標属性の設定
    if (!renderer._bufferData.uv) {
      renderer._bufferData.uv = this.gl.createBuffer();
    }
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, renderer._bufferData.uv);
    this.gl.bufferData(
      this.gl.ARRAY_BUFFER,
      s_renderTargetUvArray,
      this.gl.STATIC_DRAW
    );
    this.gl.enableVertexAttribArray(shaderSet.attributeTexCoordLocation);
    this.gl.vertexAttribPointer(
      shaderSet.attributeTexCoordLocation,
      2,
      this.gl.FLOAT,
      false,
      Float32Array.BYTES_PER_ELEMENT * 2,
      0
    );

    this.gl.blendFuncSeparate(srcColor, dstColor, srcAlpha, dstAlpha);
  }

  /**
   * シェーダープログラムを解放する
   */
  public releaseShaderProgram(): void {
    for (let i = 0; i < this._shaderSets.getSize(); i++) {
      this.gl.deleteProgram(this._shaderSets.at(i).shaderProgram);
      this._shaderSets.at(i).shaderProgram = 0;
      this._shaderSets.set(i, void 0);
      this._shaderSets.set(i, null);
    }
  }

  /**
   * シェーダープログラムを初期化する
   *
   * @param vertShaderSrc 頂点シェーダのソース
   * @param fragShaderSrc フラグメントシェーダのソース
   */
  public generateShaders(): void {
    this._isShaderLoaded = false;
    for (let i = 0; i < this._shaderCount; i++) {
      this._shaderSets.pushBack(new CubismShaderSet());
    }

    this._shaderSets.at(0).shaderProgram = this.loadShaderProgram(
      vertexShaderSrcSetupMask,
      fragmentShaderSrcsetupMask
    );

    this._shaderSets.at(1).shaderProgram = this.loadShaderProgram(
      vertexShaderSrc,
      fragmentShaderSrcPremultipliedAlpha
    );
    this._shaderSets.at(2).shaderProgram = this.loadShaderProgram(
      vertexShaderSrcMasked,
      fragmentShaderSrcMaskPremultipliedAlpha
    );
    this._shaderSets.at(3).shaderProgram = this.loadShaderProgram(
      vertexShaderSrcMasked,
      fragmentShaderSrcMaskInvertedPremultipliedAlpha
    );

    // 加算も通常と同じシェーダーを利用する
    this._shaderSets.at(4).shaderProgram = this._shaderSets.at(1).shaderProgram;
    this._shaderSets.at(5).shaderProgram = this._shaderSets.at(2).shaderProgram;
    this._shaderSets.at(6).shaderProgram = this._shaderSets.at(3).shaderProgram;

    // 乗算も通常と同じシェーダーを利用する
    this._shaderSets.at(7).shaderProgram = this._shaderSets.at(1).shaderProgram;
    this._shaderSets.at(8).shaderProgram = this._shaderSets.at(2).shaderProgram;
    this._shaderSets.at(9).shaderProgram = this._shaderSets.at(3).shaderProgram;

    // SetupMask
    this._shaderSets.at(0).attributePositionLocation =
      this.gl.getAttribLocation(
        this._shaderSets.at(0).shaderProgram,
        'a_position'
      );
    this._shaderSets.at(0).attributeTexCoordLocation =
      this.gl.getAttribLocation(
        this._shaderSets.at(0).shaderProgram,
        'a_texCoord'
      );
    this._shaderSets.at(0).samplerTexture0Location = this.gl.getUniformLocation(
      this._shaderSets.at(0).shaderProgram,
      's_texture0'
    );
    this._shaderSets.at(0).uniformClipMatrixLocation =
      this.gl.getUniformLocation(
        this._shaderSets.at(0).shaderProgram,
        'u_clipMatrix'
      );
    this._shaderSets.at(0).uniformChannelFlagLocation =
      this.gl.getUniformLocation(
        this._shaderSets.at(0).shaderProgram,
        'u_channelFlag'
      );
    this._shaderSets.at(0).uniformBaseColorLocation =
      this.gl.getUniformLocation(
        this._shaderSets.at(0).shaderProgram,
        'u_baseColor'
      );
    this._shaderSets.at(0).uniformMultiplyColorLocation =
      this.gl.getUniformLocation(
        this._shaderSets.at(0).shaderProgram,
        'u_multiplyColor'
      );
    this._shaderSets.at(0).uniformScreenColorLocation =
      this.gl.getUniformLocation(
        this._shaderSets.at(0).shaderProgram,
        'u_screenColor'
      );

    // 通常（PremultipliedAlpha）
    this._shaderSets.at(1).attributePositionLocation =
      this.gl.getAttribLocation(
        this._shaderSets.at(1).shaderProgram,
        'a_position'
      );
    this._shaderSets.at(1).attributeTexCoordLocation =
      this.gl.getAttribLocation(
        this._shaderSets.at(1).shaderProgram,
        'a_texCoord'
      );
    this._shaderSets.at(1).samplerTexture0Location = this.gl.getUniformLocation(
      this._shaderSets.at(1).shaderProgram,
      's_texture0'
    );
    this._shaderSets.at(1).uniformMatrixLocation = this.gl.getUniformLocation(
      this._shaderSets.at(1).shaderProgram,
      'u_matrix'
    );
    this._shaderSets.at(1).uniformBaseColorLocation =
      this.gl.getUniformLocation(
        this._shaderSets.at(1).shaderProgram,
        'u_baseColor'
      );
    this._shaderSets.at(1).uniformMultiplyColorLocation =
      this.gl.getUniformLocation(
        this._shaderSets.at(1).shaderProgram,
        'u_multiplyColor'
      );
    this._shaderSets.at(1).uniformScreenColorLocation =
      this.gl.getUniformLocation(
        this._shaderSets.at(1).shaderProgram,
        'u_screenColor'
      );

    // 通常（クリッピング、PremultipliedAlpha）
    this._shaderSets.at(2).attributePositionLocation =
      this.gl.getAttribLocation(
        this._shaderSets.at(2).shaderProgram,
        'a_position'
      );
    this._shaderSets.at(2).attributeTexCoordLocation =
      this.gl.getAttribLocation(
        this._shaderSets.at(2).shaderProgram,
        'a_texCoord'
      );
    this._shaderSets.at(2).samplerTexture0Location = this.gl.getUniformLocation(
      this._shaderSets.at(2).shaderProgram,
      's_texture0'
    );
    this._shaderSets.at(2).samplerTexture1Location = this.gl.getUniformLocation(
      this._shaderSets.at(2).shaderProgram,
      's_texture1'
    );
    this._shaderSets.at(2).uniformMatrixLocation = this.gl.getUniformLocation(
      this._shaderSets.at(2).shaderProgram,
      'u_matrix'
    );
    this._shaderSets.at(2).uniformClipMatrixLocation =
      this.gl.getUniformLocation(
        this._shaderSets.at(2).shaderProgram,
        'u_clipMatrix'
      );
    this._shaderSets.at(2).uniformChannelFlagLocation =
      this.gl.getUniformLocation(
        this._shaderSets.at(2).shaderProgram,
        'u_channelFlag'
      );
    this._shaderSets.at(2).uniformBaseColorLocation =
      this.gl.getUniformLocation(
        this._shaderSets.at(2).shaderProgram,
        'u_baseColor'
      );
    this._shaderSets.at(2).uniformMultiplyColorLocation =
      this.gl.getUniformLocation(
        this._shaderSets.at(2).shaderProgram,
        'u_multiplyColor'
      );
    this._shaderSets.at(2).uniformScreenColorLocation =
      this.gl.getUniformLocation(
        this._shaderSets.at(2).shaderProgram,
        'u_screenColor'
      );

    // 通常（クリッピング・反転, PremultipliedAlpha）
    this._shaderSets.at(3).attributePositionLocation =
      this.gl.getAttribLocation(
        this._shaderSets.at(3).shaderProgram,
        'a_position'
      );
    this._shaderSets.at(3).attributeTexCoordLocation =
      this.gl.getAttribLocation(
        this._shaderSets.at(3).shaderProgram,
        'a_texCoord'
      );
    this._shaderSets.at(3).samplerTexture0Location = this.gl.getUniformLocation(
      this._shaderSets.at(3).shaderProgram,
      's_texture0'
    );
    this._shaderSets.at(3).samplerTexture1Location = this.gl.getUniformLocation(
      this._shaderSets.at(3).shaderProgram,
      's_texture1'
    );
    this._shaderSets.at(3).uniformMatrixLocation = this.gl.getUniformLocation(
      this._shaderSets.at(3).shaderProgram,
      'u_matrix'
    );
    this._shaderSets.at(3).uniformClipMatrixLocation =
      this.gl.getUniformLocation(
        this._shaderSets.at(3).shaderProgram,
        'u_clipMatrix'
      );
    this._shaderSets.at(3).uniformChannelFlagLocation =
      this.gl.getUniformLocation(
        this._shaderSets.at(3).shaderProgram,
        'u_channelFlag'
      );
    this._shaderSets.at(3).uniformBaseColorLocation =
      this.gl.getUniformLocation(
        this._shaderSets.at(3).shaderProgram,
        'u_baseColor'
      );
    this._shaderSets.at(3).uniformMultiplyColorLocation =
      this.gl.getUniformLocation(
        this._shaderSets.at(3).shaderProgram,
        'u_multiplyColor'
      );
    this._shaderSets.at(3).uniformScreenColorLocation =
      this.gl.getUniformLocation(
        this._shaderSets.at(3).shaderProgram,
        'u_screenColor'
      );

    // 加算（PremultipliedAlpha）
    this._shaderSets.at(4).attributePositionLocation =
      this.gl.getAttribLocation(
        this._shaderSets.at(4).shaderProgram,
        'a_position'
      );
    this._shaderSets.at(4).attributeTexCoordLocation =
      this.gl.getAttribLocation(
        this._shaderSets.at(4).shaderProgram,
        'a_texCoord'
      );
    this._shaderSets.at(4).samplerTexture0Location = this.gl.getUniformLocation(
      this._shaderSets.at(4).shaderProgram,
      's_texture0'
    );
    this._shaderSets.at(4).uniformMatrixLocation = this.gl.getUniformLocation(
      this._shaderSets.at(4).shaderProgram,
      'u_matrix'
    );
    this._shaderSets.at(4).uniformBaseColorLocation =
      this.gl.getUniformLocation(
        this._shaderSets.at(4).shaderProgram,
        'u_baseColor'
      );
    this._shaderSets.at(4).uniformMultiplyColorLocation =
      this.gl.getUniformLocation(
        this._shaderSets.at(4).shaderProgram,
        'u_multiplyColor'
      );
    this._shaderSets.at(4).uniformScreenColorLocation =
      this.gl.getUniformLocation(
        this._shaderSets.at(4).shaderProgram,
        'u_screenColor'
      );

    // 加算（クリッピング、PremultipliedAlpha）
    this._shaderSets.at(5).attributePositionLocation =
      this.gl.getAttribLocation(
        this._shaderSets.at(5).shaderProgram,
        'a_position'
      );
    this._shaderSets.at(5).attributeTexCoordLocation =
      this.gl.getAttribLocation(
        this._shaderSets.at(5).shaderProgram,
        'a_texCoord'
      );
    this._shaderSets.at(5).samplerTexture0Location = this.gl.getUniformLocation(
      this._shaderSets.at(5).shaderProgram,
      's_texture0'
    );
    this._shaderSets.at(5).samplerTexture1Location = this.gl.getUniformLocation(
      this._shaderSets.at(5).shaderProgram,
      's_texture1'
    );
    this._shaderSets.at(5).uniformMatrixLocation = this.gl.getUniformLocation(
      this._shaderSets.at(5).shaderProgram,
      'u_matrix'
    );
    this._shaderSets.at(5).uniformClipMatrixLocation =
      this.gl.getUniformLocation(
        this._shaderSets.at(5).shaderProgram,
        'u_clipMatrix'
      );
    this._shaderSets.at(5).uniformChannelFlagLocation =
      this.gl.getUniformLocation(
        this._shaderSets.at(5).shaderProgram,
        'u_channelFlag'
      );
    this._shaderSets.at(5).uniformBaseColorLocation =
      this.gl.getUniformLocation(
        this._shaderSets.at(5).shaderProgram,
        'u_baseColor'
      );
    this._shaderSets.at(5).uniformMultiplyColorLocation =
      this.gl.getUniformLocation(
        this._shaderSets.at(5).shaderProgram,
        'u_multiplyColor'
      );
    this._shaderSets.at(5).uniformScreenColorLocation =
      this.gl.getUniformLocation(
        this._shaderSets.at(5).shaderProgram,
        'u_screenColor'
      );

    // 加算（クリッピング・反転、PremultipliedAlpha）
    this._shaderSets.at(6).attributePositionLocation =
      this.gl.getAttribLocation(
        this._shaderSets.at(6).shaderProgram,
        'a_position'
      );
    this._shaderSets.at(6).attributeTexCoordLocation =
      this.gl.getAttribLocation(
        this._shaderSets.at(6).shaderProgram,
        'a_texCoord'
      );
    this._shaderSets.at(6).samplerTexture0Location = this.gl.getUniformLocation(
      this._shaderSets.at(6).shaderProgram,
      's_texture0'
    );
    this._shaderSets.at(6).samplerTexture1Location = this.gl.getUniformLocation(
      this._shaderSets.at(6).shaderProgram,
      's_texture1'
    );
    this._shaderSets.at(6).uniformMatrixLocation = this.gl.getUniformLocation(
      this._shaderSets.at(6).shaderProgram,
      'u_matrix'
    );
    this._shaderSets.at(6).uniformClipMatrixLocation =
      this.gl.getUniformLocation(
        this._shaderSets.at(6).shaderProgram,
        'u_clipMatrix'
      );
    this._shaderSets.at(6).uniformChannelFlagLocation =
      this.gl.getUniformLocation(
        this._shaderSets.at(6).shaderProgram,
        'u_channelFlag'
      );
    this._shaderSets.at(6).uniformBaseColorLocation =
      this.gl.getUniformLocation(
        this._shaderSets.at(6).shaderProgram,
        'u_baseColor'
      );
    this._shaderSets.at(6).uniformMultiplyColorLocation =
      this.gl.getUniformLocation(
        this._shaderSets.at(6).shaderProgram,
        'u_multiplyColor'
      );
    this._shaderSets.at(6).uniformScreenColorLocation =
      this.gl.getUniformLocation(
        this._shaderSets.at(6).shaderProgram,
        'u_screenColor'
      );

    // 乗算（PremultipliedAlpha）
    this._shaderSets.at(7).attributePositionLocation =
      this.gl.getAttribLocation(
        this._shaderSets.at(7).shaderProgram,
        'a_position'
      );
    this._shaderSets.at(7).attributeTexCoordLocation =
      this.gl.getAttribLocation(
        this._shaderSets.at(7).shaderProgram,
        'a_texCoord'
      );
    this._shaderSets.at(7).samplerTexture0Location = this.gl.getUniformLocation(
      this._shaderSets.at(7).shaderProgram,
      's_texture0'
    );
    this._shaderSets.at(7).uniformMatrixLocation = this.gl.getUniformLocation(
      this._shaderSets.at(7).shaderProgram,
      'u_matrix'
    );
    this._shaderSets.at(7).uniformBaseColorLocation =
      this.gl.getUniformLocation(
        this._shaderSets.at(7).shaderProgram,
        'u_baseColor'
      );
    this._shaderSets.at(7).uniformMultiplyColorLocation =
      this.gl.getUniformLocation(
        this._shaderSets.at(7).shaderProgram,
        'u_multiplyColor'
      );
    this._shaderSets.at(7).uniformScreenColorLocation =
      this.gl.getUniformLocation(
        this._shaderSets.at(7).shaderProgram,
        'u_screenColor'
      );

    // 乗算（クリッピング、PremultipliedAlpha）
    this._shaderSets.at(8).attributePositionLocation =
      this.gl.getAttribLocation(
        this._shaderSets.at(8).shaderProgram,
        'a_position'
      );
    this._shaderSets.at(8).attributeTexCoordLocation =
      this.gl.getAttribLocation(
        this._shaderSets.at(8).shaderProgram,
        'a_texCoord'
      );
    this._shaderSets.at(8).samplerTexture0Location = this.gl.getUniformLocation(
      this._shaderSets.at(8).shaderProgram,
      's_texture0'
    );
    this._shaderSets.at(8).samplerTexture1Location = this.gl.getUniformLocation(
      this._shaderSets.at(8).shaderProgram,
      's_texture1'
    );
    this._shaderSets.at(8).uniformMatrixLocation = this.gl.getUniformLocation(
      this._shaderSets.at(8).shaderProgram,
      'u_matrix'
    );
    this._shaderSets.at(8).uniformClipMatrixLocation =
      this.gl.getUniformLocation(
        this._shaderSets.at(8).shaderProgram,
        'u_clipMatrix'
      );
    this._shaderSets.at(8).uniformChannelFlagLocation =
      this.gl.getUniformLocation(
        this._shaderSets.at(8).shaderProgram,
        'u_channelFlag'
      );
    this._shaderSets.at(8).uniformBaseColorLocation =
      this.gl.getUniformLocation(
        this._shaderSets.at(8).shaderProgram,
        'u_baseColor'
      );
    this._shaderSets.at(8).uniformMultiplyColorLocation =
      this.gl.getUniformLocation(
        this._shaderSets.at(8).shaderProgram,
        'u_multiplyColor'
      );
    this._shaderSets.at(8).uniformScreenColorLocation =
      this.gl.getUniformLocation(
        this._shaderSets.at(8).shaderProgram,
        'u_screenColor'
      );

    // 乗算（クリッピング・反転、PremultipliedAlpha）
    this._shaderSets.at(9).attributePositionLocation =
      this.gl.getAttribLocation(
        this._shaderSets.at(9).shaderProgram,
        'a_position'
      );
    this._shaderSets.at(9).attributeTexCoordLocation =
      this.gl.getAttribLocation(
        this._shaderSets.at(9).shaderProgram,
        'a_texCoord'
      );
    this._shaderSets.at(9).samplerTexture0Location = this.gl.getUniformLocation(
      this._shaderSets.at(9).shaderProgram,
      's_texture0'
    );
    this._shaderSets.at(9).samplerTexture1Location = this.gl.getUniformLocation(
      this._shaderSets.at(9).shaderProgram,
      's_texture1'
    );
    this._shaderSets.at(9).uniformMatrixLocation = this.gl.getUniformLocation(
      this._shaderSets.at(9).shaderProgram,
      'u_matrix'
    );
    this._shaderSets.at(9).uniformClipMatrixLocation =
      this.gl.getUniformLocation(
        this._shaderSets.at(9).shaderProgram,
        'u_clipMatrix'
      );
    this._shaderSets.at(9).uniformChannelFlagLocation =
      this.gl.getUniformLocation(
        this._shaderSets.at(9).shaderProgram,
        'u_channelFlag'
      );
    this._shaderSets.at(9).uniformBaseColorLocation =
      this.gl.getUniformLocation(
        this._shaderSets.at(9).shaderProgram,
        'u_baseColor'
      );
    this._shaderSets.at(9).uniformMultiplyColorLocation =
      this.gl.getUniformLocation(
        this._shaderSets.at(9).shaderProgram,
        'u_multiplyColor'
      );
    this._shaderSets.at(9).uniformScreenColorLocation =
      this.gl.getUniformLocation(
        this._shaderSets.at(9).shaderProgram,
        'u_screenColor'
      );

    // ブレンドモード用のシェーダーのソースの読み込み
    this.loadBlendModeShaders()
      .then(() => {
        // NOTE: ファイルの読み込みを待つ必要があるためこのようにする
        this.registerBlendShader();
        this._isShaderLoaded = true;
      })
      .catch(error => {
        console.error('Failed to load blend mode shaders:', error);
      });
  }

  /**
   * ブレンドモード用のシェーダープログラムを登録する
   */
  public registerBlendShader(): void {
    // コピー用シェーダーの設定
    const vertShaderSrcCopy = this._vertShaderSrcCopy;
    const fragShaderSrcCopy = this._fragShaderSrcCopy;

    const copyShaderSet = this._shaderSets.at(10); // ShaderNames.Copy = 10
    copyShaderSet.shaderProgram = this.loadShaderProgram(
      vertShaderSrcCopy,
      fragShaderSrcCopy
    );
    copyShaderSet.attributeTexCoordLocation = this.gl.getAttribLocation(
      copyShaderSet.shaderProgram,
      'a_texCoord'
    );
    copyShaderSet.attributePositionLocation = this.gl.getAttribLocation(
      copyShaderSet.shaderProgram,
      'a_position'
    );
    copyShaderSet.uniformBaseColorLocation = this.gl.getUniformLocation(
      copyShaderSet.shaderProgram,
      'u_baseColor'
    );

    let shaderSetIndex = 11;
    // ブレンドモード用シェーダーの設定
    for (
      let colorBlendIndex = 0;
      colorBlendIndex < this._colorBlendValues.getSize();
      colorBlendIndex++
    ) {
      // NONEと後方互換はスキップ
      if (
        this._colorBlendValues.at(colorBlendIndex) ==
          CubismColorBlend.ColorBlend_None ||
        this._colorBlendValues.at(colorBlendIndex) ==
          CubismColorBlend.ColorBlend_AddCompatible ||
        this._colorBlendValues.at(colorBlendIndex) ==
          CubismColorBlend.ColorBlend_MultiplyCompatible
      ) {
        continue;
      }

      // カラーブレンド用のマクロ
      const colorBlendValue = this._colorBlendValues.at(colorBlendIndex);
      const colorBlendName = this._colorBlendMap
        .getValue(colorBlendValue)
        .toUpperCase();
      const colorBlendMacro = `#define COLOR_BLEND_${colorBlendName}\n`;

      for (
        let alphablendIndex = 0;
        alphablendIndex < this._alphaBlendValues.getSize();
        alphablendIndex++
      ) {
        // NONEと、カラーブレンド「Normal」かつアルファブレンド「Over」はスキップ
        if (
          this._alphaBlendValues.at(alphablendIndex) ==
            CubismAlphaBlend.AlphaBlend_None ||
          (this._colorBlendValues.at(colorBlendIndex) ==
            CubismColorBlend.ColorBlend_Normal &&
            this._alphaBlendValues.at(alphablendIndex) ==
              CubismAlphaBlend.AlphaBlend_Over)
        ) {
          continue;
        }

        // アルファブレンド用のマクロ
        const alphaBlendValue = this._alphaBlendValues.at(alphablendIndex);
        const alphaBlendName = this._alphaBlendMap
          .getValue(alphaBlendValue)
          .toUpperCase();
        const alphaBlendMacro = `#define ALPHA_BLEND_${alphaBlendName}\n`;

        // シェーダーのソースを生成
        this.generateBlendShader(
          colorBlendMacro,
          alphaBlendMacro,
          shaderSetIndex
        );

        this._blendShaderSetMap.setValue(
          this._colorBlendMap.getValue(
            this._colorBlendValues.at(colorBlendIndex)
          ) +
            this._alphaBlendMap.getValue(
              this._alphaBlendValues.at(alphablendIndex)
            ),
          shaderSetIndex
        );

        // 1つの組み合わせが終わるこのタイミングでシェーダーのインデックスを更新
        shaderSetIndex += ShaderType.ShaderType_Count;
      }
    }
  }

  /**
   * ブレンドモード用のシェーダープログラムを生成する
   *
   * @param colorBlendMacro カラーブレンド用のマクロ
   * @param alphaBlendMacro アルファブレンド用のマクロ
   * @param shaderSetBaseIndex _shaderSets のインデックス
   */
  private generateBlendShader(
    colorBlendMacro: string,
    alphaBlendMacro: string,
    shaderSetBaseIndex: number
  ): void {
    for (
      let shaderTypeIndex: ShaderType = 0;
      shaderTypeIndex < ShaderType.ShaderType_Count;
      shaderTypeIndex++
    ) {
      // ループごとにシェーダーのソースを初期化
      let vertexShaderSrc: string = '';
      let fragmentShaderStr: string = 'precision mediump float;\n';

      // シェーダの種類が変わるたびにインデックスを変更
      const shaderSetIndex = shaderSetBaseIndex + shaderTypeIndex;

      // マクロの定義
      fragmentShaderStr += colorBlendMacro;
      fragmentShaderStr += alphaBlendMacro;

      // ブレンドモードの種類に応じたマクロの定義
      fragmentShaderStr += this._fragShaderSrcColorBlend;
      fragmentShaderStr += this._fragShaderSrcAlphaBlend;

      // シェーダの種類に応じたマクロの定義
      if (
        shaderTypeIndex == ShaderType.ShaderType_Masked ||
        shaderTypeIndex == ShaderType.ShaderType_MaskedInverted
      ) {
        const clippingMaskMacro = '#define CLIPPING_MASK\n';
        vertexShaderSrc += clippingMaskMacro;
        fragmentShaderStr += clippingMaskMacro;
      }

      // シェーダの本体のソースをファイルから読み込み
      vertexShaderSrc += this._vertShaderSrcBlend;
      fragmentShaderStr += this._fragShaderSrcBlend;

      // シェーダープログラムの生成
      this._shaderSets.at(shaderSetIndex).shaderProgram =
        this.loadShaderProgram(vertexShaderSrc, fragmentShaderStr);

      // シェーダープログラムへの変数のリンク
      this._shaderSets.at(shaderSetIndex).attributePositionLocation =
        this.gl.getAttribLocation(
          this._shaderSets.at(shaderSetIndex).shaderProgram,
          'a_position'
        );
      this._shaderSets.at(shaderSetIndex).attributeTexCoordLocation =
        this.gl.getAttribLocation(
          this._shaderSets.at(shaderSetIndex).shaderProgram,
          'a_texCoord'
        );
      this._shaderSets.at(shaderSetIndex).samplerTexture0Location =
        this.gl.getUniformLocation(
          this._shaderSets.at(shaderSetIndex).shaderProgram,
          's_texture0'
        );
      this._shaderSets.at(shaderSetIndex).uniformMatrixLocation =
        this.gl.getUniformLocation(
          this._shaderSets.at(shaderSetIndex).shaderProgram,
          'u_matrix'
        );
      this._shaderSets.at(shaderSetIndex).uniformBaseColorLocation =
        this.gl.getUniformLocation(
          this._shaderSets.at(shaderSetIndex).shaderProgram,
          'u_baseColor'
        );
      this._shaderSets.at(shaderSetIndex).uniformMultiplyColorLocation =
        this.gl.getUniformLocation(
          this._shaderSets.at(shaderSetIndex).shaderProgram,
          'u_multiplyColor'
        );
      this._shaderSets.at(shaderSetIndex).uniformScreenColorLocation =
        this.gl.getUniformLocation(
          this._shaderSets.at(shaderSetIndex).shaderProgram,
          'u_screenColor'
        );

      // ブレンドモード用のテクスチャ
      this._shaderSets.at(shaderSetIndex).samplerFrameBufferTextureLocation =
        this.gl.getUniformLocation(
          this._shaderSets.at(shaderSetIndex).shaderProgram,
          's_blendTexture'
        );

      // クリップ対象の場合
      if (
        shaderTypeIndex == ShaderType.ShaderType_Masked ||
        shaderTypeIndex == ShaderType.ShaderType_MaskedInverted
      ) {
        // マスク用テクスチャ
        this._shaderSets.at(shaderSetIndex).samplerTexture1Location =
          this.gl.getUniformLocation(
            this._shaderSets.at(shaderSetIndex).shaderProgram,
            's_texture1'
          );

        // クリップ用の行列
        this._shaderSets.at(shaderSetIndex).uniformClipMatrixLocation =
          this.gl.getUniformLocation(
            this._shaderSets.at(shaderSetIndex).shaderProgram,
            'u_clipMatrix'
          );

        // チャンネルフラグ
        this._shaderSets.at(shaderSetIndex).uniformChannelFlagLocation =
          this.gl.getUniformLocation(
            this._shaderSets.at(shaderSetIndex).shaderProgram,
            'u_channelFlag'
          );

        // 反転マスク用の値（反転なら 1.0 が代入される）
        this._shaderSets.at(shaderSetIndex).uniformInvertMaskFlagLocation =
          this.gl.getUniformLocation(
            this._shaderSets.at(shaderSetIndex).shaderProgram,
            'u_invertClippingMask'
          );
      }
    }
  }

  /**
   * シェーダプログラムをロードしてアドレスを返す
   *
   * @param vertexShaderSource    頂点シェーダのソース
   * @param fragmentShaderSource  フラグメントシェーダのソース
   *
   * @return シェーダプログラムのアドレス
   */
  public loadShaderProgram(
    vertexShaderSource: string,
    fragmentShaderSource: string
  ): WebGLProgram {
    // Create Shader Program
    let shaderProgram: WebGLProgram = this.gl.createProgram();

    let vertShader = this.compileShaderSource(
      this.gl.VERTEX_SHADER,
      vertexShaderSource
    );

    if (!vertShader) {
      CubismLogError('Vertex shader compile error!');
      return 0;
    }

    let fragShader = this.compileShaderSource(
      this.gl.FRAGMENT_SHADER,
      fragmentShaderSource
    );
    if (!fragShader) {
      CubismLogError('Fragment shader compile error!');
      return 0;
    }

    // Attach vertex shader to program
    this.gl.attachShader(shaderProgram, vertShader);

    // Attach fragment shader to program
    this.gl.attachShader(shaderProgram, fragShader);

    // link program
    this.gl.linkProgram(shaderProgram);
    const linkStatus = this.gl.getProgramParameter(
      shaderProgram,
      this.gl.LINK_STATUS
    );

    // リンクに失敗したらシェーダーを削除
    if (!linkStatus) {
      CubismLogError('Failed to link program: {0}', shaderProgram);

      this.gl.deleteShader(vertShader);
      vertShader = 0;

      this.gl.deleteShader(fragShader);
      fragShader = 0;

      if (shaderProgram) {
        this.gl.deleteProgram(shaderProgram);
        shaderProgram = 0;
      }

      return 0;
    }

    // Release vertex and fragment shaders.
    this.gl.deleteShader(vertShader);
    this.gl.deleteShader(fragShader);

    return shaderProgram;
  }

  /**
   * シェーダープログラムをコンパイルする
   *
   * @param shaderType シェーダタイプ(Vertex/Fragment)
   * @param shaderSource シェーダソースコード
   *
   * @return コンパイルされたシェーダープログラム
   */
  public compileShaderSource(
    shaderType: GLenum,
    shaderSource: string
  ): WebGLProgram {
    const source: string = shaderSource;

    const shader: WebGLProgram = this.gl.createShader(shaderType);
    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);

    if (!shader) {
      const log: string = this.gl.getShaderInfoLog(shader);
      CubismLogError('Shader compile log: {0} ', log);
    }

    const status: any = this.gl.getShaderParameter(
      shader,
      this.gl.COMPILE_STATUS
    );
    if (!status) {
      const log: string = this.gl.getShaderInfoLog(shader);
      CubismLogError('Shader compile log: {0} ', log);
      this.gl.deleteShader(shader);
      return null;
    }

    return shader;
  }

  /**
   * WebGLレンダリングコンテキストを設定する
   *
   * @param gl WebGLレンダリングコンテキスト
   */
  public setGl(gl: WebGLRenderingContext | WebGL2RenderingContext): void {
    this.gl = gl;
  }

  _shaderSets: csmVector<CubismShaderSet>; // ロードしたシェーダープログラムを保持する変数
  gl: WebGLRenderingContext | WebGL2RenderingContext; // webglコンテキスト

  _colorBlendMap: csmMap<CubismColorBlend, string>; // カラーブレンドの値と名称を紐づけする変数
  _alphaBlendMap: csmMap<CubismAlphaBlend, string>; // アルファブレンドの値と名称を紐づけする変数

  _colorBlendValues: csmVector<CubismColorBlend>; // カラーブレンドの値を保持する変数
  _alphaBlendValues: csmVector<CubismAlphaBlend>; // アルファブレンドの値を保持する変数

  _blendShaderSetMap: csmMap<string, number>; // ブレンドモード用のシェーダーの名称とインデックスを紐づけする変数

  _shaderCount: number; // シェーダープログラムの数

  _vertShaderSrcCopy: string; // コピー用の頂点シェーダーのソース
  _fragShaderSrcCopy: string; // コピー用のフラグメントシェーダーのソース

  _fragShaderSrcColorBlend: string; // ブレンドモード用のシェーダーのソース
  _fragShaderSrcAlphaBlend: string; // アルファブレンド用のシェーダーのソース
  _vertShaderSrcBlend: string; // 頂点シェーダーのソース
  _fragShaderSrcBlend: string; // フラグメントシェーダーのソース
  _isShaderLoaded: boolean; // シェーダーの読み込みが完了したかどうか
}

/**
 * GLContextごとにCubismShader_WebGLを確保するためのクラス
 * シングルトンなクラスであり、CubismShaderManager_WebGL.getInstanceからアクセスする。
 */
export class CubismShaderManager_WebGL {
  /**
   * インスタンスを取得する（シングルトン）
   *
   * @return インスタンス
   */
  public static getInstance(): CubismShaderManager_WebGL {
    if (s_instance == null) {
      s_instance = new CubismShaderManager_WebGL();
    }
    return s_instance;
  }

  /**
   * インスタンスを開放する（シングルトン）
   */
  public static deleteInstance(): void {
    if (s_instance) {
      s_instance.release();
      s_instance = null;
    }
  }

  /**
   * Privateなコンストラクタ
   */
  private constructor() {
    this._shaderMap = new csmMap<WebGLRenderingContext, CubismShader_WebGL>();
  }

  /**
   * デストラクタ相当の処理
   */
  public release(): void {
    for (
      const ite: iterator<WebGLRenderingContext, CubismShader_WebGL> =
        this._shaderMap.begin();
      ite.notEqual(this._shaderMap.end());
      ite.preIncrement()
    ) {
      ite.ptr().second.release();
    }
    this._shaderMap.clear();
  }

  /**
   * GLContextをキーにShaderを取得する
   *
   * @param gl glコンテキスト
   *
   * @return shaderを返す
   */
  public getShader(gl: WebGLRenderingContext): CubismShader_WebGL {
    return this._shaderMap.getValue(gl);
  }

  /**
   * GLContextを登録する
   *
   * @param gl glコンテキスト
   */
  public setGlContext(gl: WebGLRenderingContext): void {
    if (!this._shaderMap.isExist(gl)) {
      const instance = new CubismShader_WebGL();
      instance.setGl(gl);
      this._shaderMap.setValue(gl, instance);
    }
  }

  /**
   * GLContextごとのShaderを保持する変数
   */
  private _shaderMap: csmMap<WebGLRenderingContext, CubismShader_WebGL>;
}

/**
 * CubismShader_WebGLのインナークラス
 */
export class CubismShaderSet {
  shaderProgram: WebGLProgram; // シェーダープログラムのアドレス
  attributePositionLocation: GLuint; // シェーダープログラムに渡す変数のアドレス（Position）
  attributeTexCoordLocation: GLuint; // シェーダープログラムに渡す変数のアドレス（TexCoord）
  uniformMatrixLocation: WebGLUniformLocation; // シェーダープログラムに渡す変数のアドレス（Matrix）
  uniformClipMatrixLocation: WebGLUniformLocation; // シェーダープログラムに渡す変数のアドレス（ClipMatrix）
  samplerTexture0Location: WebGLUniformLocation; // シェーダープログラムに渡す変数のアドレス（Texture0）
  samplerTexture1Location: WebGLUniformLocation; // シェーダープログラムに渡す変数のアドレス（Texture1）
  uniformBaseColorLocation: WebGLUniformLocation; // シェーダープログラムに渡す変数のアドレス（BaseColor）
  uniformChannelFlagLocation: WebGLUniformLocation; // シェーダープログラムに渡す変数のアドレス（ChannelFlag）
  uniformMultiplyColorLocation: WebGLUniformLocation; // シェーダープログラムに渡す変数のアドレス（MultiplyColor）
  uniformScreenColorLocation: WebGLUniformLocation; // シェーダープログラムに渡す変数のアドレス（ScreenColor）
  samplerFrameBufferTextureLocation: WebGLUniformLocation; // シェーダープログラムに渡す変数のアドレス（BlendTexture）
  uniformInvertMaskFlagLocation: WebGLUniformLocation; // シェーダープログラムに渡す変数のアドレス（InvertMask）
}

/**
 * シェーダーの名前を定義する列挙型
 */
export enum ShaderNames {
  // SetupMask
  ShaderNames_SetupMask,

  // Normal
  ShaderNames_NormalPremultipliedAlpha,
  ShaderNames_NormalMaskedPremultipliedAlpha,
  ShaderNames_NomralMaskedInvertedPremultipliedAlpha,

  // Add
  ShaderNames_AddPremultipliedAlpha,
  ShaderNames_AddMaskedPremultipliedAlpha,
  ShaderNames_AddMaskedPremultipliedAlphaInverted,

  // Mult
  ShaderNames_MultPremultipliedAlpha,
  ShaderNames_MultMaskedPremultipliedAlpha,
  ShaderNames_MultMaskedPremultipliedAlphaInverted,

  // ShaderCount
  ShaderNames_ShaderCount
}

/**
 * シェーダーの種類を定義する列挙型
 */
export enum ShaderType {
  ShaderType_Normal = 0,
  ShaderType_Masked = 1,
  ShaderType_MaskedInverted = 2,
  ShaderType_Count
}

export const vertexShaderSrcSetupMask =
  'attribute vec4     a_position;' +
  'attribute vec2     a_texCoord;' +
  'varying vec2       v_texCoord;' +
  'varying vec4       v_myPos;' +
  'uniform mat4       u_clipMatrix;' +
  'void main()' +
  '{' +
  '   gl_Position = u_clipMatrix * a_position;' +
  '   v_myPos = u_clipMatrix * a_position;' +
  '   v_texCoord = a_texCoord;' +
  '   v_texCoord.y = 1.0 - v_texCoord.y;' +
  '}';

export const fragmentShaderSrcsetupMask =
  'precision mediump float;' +
  'varying vec2       v_texCoord;' +
  'varying vec4       v_myPos;' +
  'uniform vec4       u_baseColor;' +
  'uniform vec4       u_channelFlag;' +
  'uniform sampler2D  s_texture0;' +
  'void main()' +
  '{' +
  '   float isInside = ' +
  '       step(u_baseColor.x, v_myPos.x/v_myPos.w)' +
  '       * step(u_baseColor.y, v_myPos.y/v_myPos.w)' +
  '       * step(v_myPos.x/v_myPos.w, u_baseColor.z)' +
  '       * step(v_myPos.y/v_myPos.w, u_baseColor.w);' +
  '   gl_FragColor = u_channelFlag * texture2D(s_texture0, v_texCoord).a * isInside;' +
  '}';

//----- バーテックスシェーダプログラム -----
// Normal & Add & Mult 共通
export const vertexShaderSrc =
  'attribute vec4     a_position;' + //v.vertex
  'attribute vec2     a_texCoord;' + //v.texcoord
  'varying vec2       v_texCoord;' + //v2f.texcoord
  'uniform mat4       u_matrix;' +
  'void main()' +
  '{' +
  '   gl_Position = u_matrix * a_position;' +
  '   v_texCoord = a_texCoord;' +
  '   v_texCoord.y = 1.0 - v_texCoord.y;' +
  '}';

// Normal & Add & Mult 共通（クリッピングされたものの描画用）
export const vertexShaderSrcMasked =
  'attribute vec4     a_position;' +
  'attribute vec2     a_texCoord;' +
  'varying vec2       v_texCoord;' +
  'varying vec4       v_clipPos;' +
  'uniform mat4       u_matrix;' +
  'uniform mat4       u_clipMatrix;' +
  'void main()' +
  '{' +
  '   gl_Position = u_matrix * a_position;' +
  '   v_clipPos = u_clipMatrix * a_position;' +
  '   v_texCoord = a_texCoord;' +
  '   v_texCoord.y = 1.0 - v_texCoord.y;' +
  '}';

//----- フラグメントシェーダプログラム -----
// Normal & Add & Mult 共通 （PremultipliedAlpha）
export const fragmentShaderSrcPremultipliedAlpha =
  'precision mediump float;' +
  'varying vec2       v_texCoord;' + //v2f.texcoord
  'uniform vec4       u_baseColor;' +
  'uniform sampler2D  s_texture0;' + //_MainTex
  'uniform vec4       u_multiplyColor;' +
  'uniform vec4       u_screenColor;' +
  'void main()' +
  '{' +
  '   vec4 texColor = texture2D(s_texture0, v_texCoord);' +
  '   texColor.rgb = texColor.rgb * u_multiplyColor.rgb;' +
  '   texColor.rgb = (texColor.rgb + u_screenColor.rgb * texColor.a) - (texColor.rgb * u_screenColor.rgb);' +
  '   vec4 color = texColor * u_baseColor;' +
  '   gl_FragColor = vec4(color.rgb, color.a);' +
  '}';

// Normal （クリッピングされたものの描画用、PremultipliedAlpha兼用）
export const fragmentShaderSrcMaskPremultipliedAlpha =
  'precision mediump float;' +
  'varying vec2       v_texCoord;' +
  'varying vec4       v_clipPos;' +
  'uniform vec4       u_baseColor;' +
  'uniform vec4       u_channelFlag;' +
  'uniform sampler2D  s_texture0;' +
  'uniform sampler2D  s_texture1;' +
  'uniform vec4       u_multiplyColor;' +
  'uniform vec4       u_screenColor;' +
  'void main()' +
  '{' +
  '   vec4 texColor = texture2D(s_texture0, v_texCoord);' +
  '   texColor.rgb = texColor.rgb * u_multiplyColor.rgb;' +
  '   texColor.rgb = (texColor.rgb + u_screenColor.rgb * texColor.a) - (texColor.rgb * u_screenColor.rgb);' +
  '   vec4 col_formask = texColor * u_baseColor;' +
  '   vec4 clipMask = (1.0 - texture2D(s_texture1, v_clipPos.xy / v_clipPos.w)) * u_channelFlag;' +
  '   float maskVal = clipMask.r + clipMask.g + clipMask.b + clipMask.a;' +
  '   col_formask = col_formask * maskVal;' +
  '   gl_FragColor = col_formask;' +
  '}';

// Normal & Add & Mult 共通（クリッピングされて反転使用の描画用、PremultipliedAlphaの場合）
export const fragmentShaderSrcMaskInvertedPremultipliedAlpha =
  'precision mediump float;' +
  'varying vec2      v_texCoord;' +
  'varying vec4      v_clipPos;' +
  'uniform sampler2D s_texture0;' +
  'uniform sampler2D s_texture1;' +
  'uniform vec4      u_channelFlag;' +
  'uniform vec4      u_baseColor;' +
  'uniform vec4      u_multiplyColor;' +
  'uniform vec4      u_screenColor;' +
  'void main()' +
  '{' +
  '   vec4 texColor = texture2D(s_texture0, v_texCoord);' +
  '   texColor.rgb = texColor.rgb * u_multiplyColor.rgb;' +
  '   texColor.rgb = (texColor.rgb + u_screenColor.rgb * texColor.a) - (texColor.rgb * u_screenColor.rgb);' +
  '   vec4 col_formask = texColor * u_baseColor;' +
  '   vec4 clipMask = (1.0 - texture2D(s_texture1, v_clipPos.xy / v_clipPos.w)) * u_channelFlag;' +
  '   float maskVal = clipMask.r + clipMask.g + clipMask.b + clipMask.a;' +
  '   col_formask = col_formask * (1.0 - maskVal);' +
  '   gl_FragColor = col_formask;' +
  '}';

// Namespace definition for compatibility.
import * as $ from './cubismshader_webgl';
// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Live2DCubismFramework {
  export const CubismShaderSet = $.CubismShaderSet;
  export type CubismShaderSet = $.CubismShaderSet;
  export const CubismShader_WebGL = $.CubismShader_WebGL;
  export type CubismShader_WebGL = $.CubismShader_WebGL;
  export const CubismShaderManager_WebGL = $.CubismShaderManager_WebGL;
  export type CubismShaderManager_WebGL = $.CubismShaderManager_WebGL;
  export const ShaderNames = $.ShaderNames;
  export type ShaderNames = $.ShaderNames;
}
