/**
 * UTF-8 호환 Base64 인코더/디코더 및 7일 만료 검증 모듈
 */
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export function generateCode(state) {
  try {
    const payload = {
      createdAt: Date.now(),
      data: state
    };
    const jsonStr = JSON.stringify(payload);
    
    const uint8 = new TextEncoder().encode(jsonStr);
    let binary = '';
    const len = uint8.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(uint8[i]);
    }
    return btoa(binary);
  } catch (err) {
    console.error("Code generation error:", err);
    return null;
  }
}

export function parseCode(code) {
  try {
    const binary = atob(code.trim());
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const jsonStr = new TextDecoder().decode(bytes);
    const payload = JSON.parse(jsonStr);

    if (!payload.createdAt || !payload.data) {
      return { success: true, data: payload, expired: false };
    }

    const now = Date.now();
    const age = now - payload.createdAt;

    if (age > SEVEN_DAYS_MS) {
      return { success: false, expired: true, message: "유효기간(1주일)이 만료된 식별코드입니다." };
    }

    return { success: true, data: payload.data, expired: false };
  } catch (err) {
    console.error("Code parse error:", err);
    return { success: false, expired: false, message: "유효하지 않거나 손상된 식별코드입니다." };
  }
}