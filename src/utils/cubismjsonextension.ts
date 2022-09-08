/**
 * Copyright(c) Live2D Inc. All rights reserved.
 *
 * Use of this source code is governed by the Live2D Open Software license
 * that can be found at https://www.live2d.com/eula/live2d-open-software-license-agreement_en.html.
 */

import {
  JsonArray,
  JsonBoolean,
  JsonFloat,
  JsonMap,
  JsonNullvalue,
  JsonString,
  Value,
} from './cubismjson';

/**
 * CubismJsonで実装されているJsonパーサを使用せず、
 * TypeScript標準のJsonパーサなどを使用し出力された結果を
 * Cubism SDKで定義されているJSONエレメントの要素に
 * 置き換える処理をするクラス。
 */
export class CubismJsonExtension {
  static parseJsonObject(obj: Value, map: JsonMap) {
    Object.keys(obj).forEach((key) => {
      if (typeof obj[key] == 'boolean') {
        map.put(key, new JsonBoolean(obj[key]));
      } else if (typeof obj[key] == 'string') {
        map.put(key, new JsonString(obj[key]));
      } else if (typeof obj[key] == 'number') {
        map.put(key, new JsonFloat(obj[key]));
      } else if (obj[key] instanceof Array) {
        map.put(key, CubismJsonExtension.parseJsonArray(obj[key]));
      } else if (obj[key] instanceof Object) {
        map.put(
          key,
          CubismJsonExtension.parseJsonObject(obj[key], new JsonMap())
        );
      } else if (obj[key] == null) {
        map.put(key, new JsonNullvalue());
      } else {
        // どれにも当てはまらない場合でも処理する
        map.put(key, obj[key]);
      }
    });
    return map;
  }

  protected static parseJsonArray(obj: Value) {
    const arr = new JsonArray();
    Object.keys(obj).forEach((key) => {
      const convKey = Number(key);
      if (typeof convKey == 'number') {
        if (typeof obj[convKey] == 'boolean') {
          arr.add(new JsonBoolean(obj[convKey]));
        } else if (typeof obj[convKey] == 'string') {
          arr.add(new JsonString(obj[convKey]));
        } else if (typeof obj[convKey] == 'number') {
          arr.add(new JsonFloat(obj[convKey]));
        } else if (obj[key] instanceof Array) {
          arr.add(this.parseJsonArray(obj[key]));
        } else if (obj[key] instanceof Object) {
          arr.add(this.parseJsonObject(obj[key], new JsonMap()));
        } else if (obj[key] == null) {
          arr.add(new JsonNullvalue());
        } else {
          // どれにも当てはまらない場合でも処理する
          arr.add(obj[key]);
        }
      } else if (obj[key] instanceof Array) {
        arr.add(this.parseJsonArray(obj[key]));
      } else if (obj[key] instanceof Object) {
        arr.add(this.parseJsonObject(obj[key], new JsonMap()));
      } else if (obj[key] == null) {
        arr.add(new JsonNullvalue());
      } else {
        // 配列ともObjectとも判定できなかった場合でも処理する
        for (let i = 0; i < obj[key].length; i++) {
          arr.add(obj[key][i]);
        }
      }
    });
    return arr;
  }
}
