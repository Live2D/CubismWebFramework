/**
 * Copyright(c) Live2D Inc. All rights reserved.
 *
 * Use of this source code is governed by the Live2D Open Software license
 * that can be found at https://www.live2d.com/eula/live2d-open-software-license-agreement_en.html.
 */


varying vec2 v_texCoord; //v2f.texcoord
varying vec2 v_blendCoord;
varying vec4 v_clipPos;
uniform sampler2D s_texture0; //_MainTex
uniform sampler2D s_blendTexture;
uniform vec4 u_baseColor; //v2f.color
uniform vec4 u_multiplyColor;
uniform vec4 u_screenColor;
uniform sampler2D s_texture1; // _ClippingMaskTex
uniform float u_invertClippingMask;
uniform vec4 u_channelFlag;

vec3 ColorBlend(vec3 colorSource, vec3 colorDestination);
vec4 AlphaBlend(vec3 C, vec3 Cs, float As, vec3 Cd, float Ad);

void main()
{
  vec4 texColor = texture2D(s_texture0, v_texCoord);
  texColor.rgb = texColor.rgb * u_multiplyColor.rgb;
  texColor.rgb = (texColor.rgb + u_screenColor.rgb * texColor.a) - (texColor.rgb * u_screenColor.rgb);
  vec4 colorSource = texColor;
  colorSource.rgb *= u_baseColor.rgb;

  float maskVal = 1.0;
#ifdef CLIPPING_MASK
    vec4 clipMask = (1.0 - texture2D(s_texture1, v_clipPos.xy / v_clipPos.w)) * u_channelFlag;
    maskVal = clipMask.r + clipMask.g + clipMask.b + clipMask.a;
    maskVal = abs(u_invertClippingMask - maskVal);
#endif
  colorSource.a *= u_baseColor.a * maskVal;

  if (colorSource.a < 0.00001)
  {
    colorSource = vec4(0.0, 0.0, 0.0, 0.0);
  }
  else {
    colorSource.rgb /= colorSource.a;
  }

  vec4 colorDestination = texture2D(s_blendTexture, v_blendCoord);

  if (colorDestination.a < 0.00001)
  {
    colorDestination = vec4(0.0, 0.0, 0.0, 0.0);
  }
  else {
    colorDestination.rgb /= colorDestination.a;
  }

  gl_FragColor = AlphaBlend(ColorBlend(colorSource.rgb, colorDestination.rgb), colorSource, colorDestination);
}
