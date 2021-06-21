/**
 * Copyright(c) Live2D Inc. All rights reserved.
 *
 * Use of this source code is governed by the Live2D Open Software license
 * that can be found at https://www.live2d.com/eula/live2d-open-software-license-agreement_en.html.
 */

import { CubismIdHandle } from '../id/cubismid';
import { CubismFramework } from '../live2dcubismframework';
import { csmString } from '../type/csmstring';
import { CubismJson } from '../utils/cubismjson';
import { Motion3 } from '../specs/motion3';

/**
 * motion3.jsonのコンテナ。
 */
export class CubismMotionJson {
  /**
   * コンストラクタ
   * @param source Data of motion3.json
   * @param size Buffer size
   */
  public constructor(source: Motion3 | string); // From JSON object or text
  /** @deprecated */
  public constructor(source: ArrayBuffer, size: number); // From JSON buffer
  public constructor(source: Motion3 | string | ArrayBuffer, size?: number) {
    if (source instanceof ArrayBuffer) {
      // For compatibility
      this._json = CubismJson.create(source, size ?? source.byteLength);
      // Convert ArrayBuffer to string
      const text = String.fromCharCode.apply(
        null,
        [].slice.call(new Uint8Array(source))
      );
      this.data = JSON.parse(text);
    } else if (typeof source === 'string') {
      this.data = JSON.parse(source);
    } else {
      this.data = source;
    }
  }

  /**
   * @deprecated
   * デストラクタ相当の処理
   */
  public release(): void {
    if (this._json) {
      CubismJson.delete(this._json);
    }
  }

  /**
   * モーションの長さを取得する
   * @return モーションの長さ[秒]
   */
  public getMotionDuration(): number {
    return this.data.Meta.Duration;
  }

  /**
   * モーションのループ情報の取得
   * @return true ループする
   * @return false ループしない
   */
  public isMotionLoop(): boolean | undefined {
    return this.data.Meta.Loop;
  }

  public getEvaluationOptionFlag(flagType: number): boolean | undefined {
    if (
      EvaluationOptionFlag.EvaluationOptionFlag_AreBeziersRistricted ===
      flagType
    ) {
      return this.data.Meta.AreBeziersRestricted;
    }

    return false;
  }

  /**
   * モーションカーブの個数の取得
   * @return モーションカーブの個数
   */
  public getMotionCurveCount(): number {
    return this.data.Meta.CurveCount;
  }

  /**
   * モーションのフレームレートの取得
   * @return フレームレート[FPS]
   */
  public getMotionFps(): number {
    return this.data.Meta.Fps;
  }

  /**
   * モーションのセグメントの総合計の取得
   * @return モーションのセグメントの取得
   */
  public getMotionTotalSegmentCount(): number {
    return this.data.Meta.TotalSegmentCount;
  }

  /**
   * モーションのカーブの制御店の総合計の取得
   * @return モーションのカーブの制御点の総合計
   */
  public getMotionTotalPointCount(): number {
    return this.data.Meta.TotalPointCount;
  }

  /**
   * モーションのフェードイン時間の存在
   * @return true 存在する
   * @return false 存在しない
   */
  public isExistMotionFadeInTime(): boolean {
    return this.data.Meta.FadeInTime != null;
  }

  /**
   * モーションのフェードアウト時間の存在
   * @return true 存在する
   * @return false 存在しない
   */
  public isExistMotionFadeOutTime(): boolean {
    return this.data.Meta.FadeOutTime != null;
  }

  /**
   * モーションのフェードイン時間の取得
   * @return フェードイン時間[秒]
   */
  public getMotionFadeInTime(): number | undefined {
    return this.data.Meta.FadeInTime;
  }

  /**
   * モーションのフェードアウト時間の取得
   * @return フェードアウト時間[秒]
   */
  public getMotionFadeOutTime(): number | undefined {
    return this.data.Meta.FadeOutTime;
  }

  /**
   * モーションのカーブの種類の取得
   * @param curveIndex カーブのインデックス
   * @return カーブの種類
   */
  public getMotionCurveTarget(curveIndex: number): string | undefined {
    return this.data.Curves[curveIndex]?.Target;
  }

  /**
   * モーションのカーブのIDの取得
   * @param curveIndex カーブのインデックス
   * @return カーブのID
   */
  public getMotionCurveId(curveIndex: number): CubismIdHandle | undefined {
    const id = this.data.Curves[curveIndex]?.Id;
    return id != null ? CubismFramework.getIdManager().getId(id) : undefined;
  }

  /**
   * モーションのカーブのフェードイン時間の存在
   * @param curveIndex カーブのインデックス
   * @return true 存在する
   * @return false 存在しない
   */
  public isExistMotionCurveFadeInTime(curveIndex: number): boolean {
    return this.data.Curves[curveIndex]?.FadeInTime != null;
  }

  /**
   * モーションのカーブのフェードアウト時間の存在
   * @param curveIndex カーブのインデックス
   * @return true 存在する
   * @return false 存在しない
   */
  public isExistMotionCurveFadeOutTime(curveIndex: number): boolean {
    return this.data.Curves[curveIndex]?.FadeOutTime != null;
  }

  /**
   * モーションのカーブのフェードイン時間の取得
   * @param curveIndex カーブのインデックス
   * @return フェードイン時間[秒]
   */
  public getMotionCurveFadeInTime(curveIndex: number): number | undefined {
    return this.data.Curves[curveIndex]?.FadeInTime;
  }

  /**
   * モーションのカーブのフェードアウト時間の取得
   * @param curveIndex カーブのインデックス
   * @return フェードアウト時間[秒]
   */
  public getMotionCurveFadeOutTime(curveIndex: number): number | undefined {
    return this.data.Curves[curveIndex]?.FadeOutTime;
  }

  /**
   * モーションのカーブのセグメントの個数を取得する
   * @param curveIndex カーブのインデックス
   * @return モーションのカーブのセグメントの個数
   */
  public getMotionCurveSegmentCount(curveIndex: number): number | undefined {
    return this.data.Curves[curveIndex]?.Segments.length;
  }

  /**
   * モーションのカーブのセグメントの値の取得
   * @param curveIndex カーブのインデックス
   * @param segmentIndex セグメントのインデックス
   * @return セグメントの値
   */
  public getMotionCurveSegment(
    curveIndex: number,
    segmentIndex: number
  ): number | undefined {
    return this.data.Curves[curveIndex]?.Segments[segmentIndex];
  }

  /**
   * イベントの個数の取得
   * @return イベントの個数
   */
  public getEventCount(): number | undefined {
    return this.data.Meta.UserDataCount;
  }

  /**
   *  イベントの総文字数の取得
   * @return イベントの総文字数
   */
  public getTotalEventValueSize(): number | undefined {
    return this.data.Meta.TotalUserDataSize;
  }

  /**
   * イベントの時間の取得
   * @param userDataIndex イベントのインデックス
   * @return イベントの時間[秒]
   */
  public getEventTime(userDataIndex: number): number | undefined {
    return this.data.UserData?.[userDataIndex]?.Time;
  }

  /**
   * イベントの取得
   * @param userDataIndex イベントのインデックス
   * @return イベントの文字列
   */
  public getEventValue(userDataIndex: number): csmString | undefined {
    const value = this.data.UserData?.[userDataIndex]?.Value;
    return value != null ? new csmString(value) : undefined;
  }

  /** @deprecated For comparability */
  _json: CubismJson | null | undefined;

  data: Motion3;
}

/**
 * @brief ベジェカーブの解釈方法のフラグタイプ
 */
export enum EvaluationOptionFlag {
  EvaluationOptionFlag_AreBeziersRistricted = 0 ///< ベジェハンドルの規制状態
}

// Namespace definition for compatibility.
import * as $ from './cubismmotionjson';
// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Live2DCubismFramework {
  export const CubismMotionJson = $.CubismMotionJson;
  export type CubismMotionJson = $.CubismMotionJson;
}
