// keyPool.js
// بيدير مجموعة مفاتيح Gemini (كل مفتاح من أكونت جيميل مختلف).
// لما مفتاح يخلّص الكوتة، بيدوّر تلقائيًا على اللي بعده - من غير ما الطلب الحالي يفضل.

// كولداون قصير (للـ rate limit بتاع الدقيقة/RPM) وكولداون طويل (لو الكوتة اليومية خلصت)
const SHORT_COOLDOWN_MS = 60 * 1000; // دقيقة
const LONG_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 ساعة

class KeyPool {
  constructor(keys) {
    if (!keys || keys.length === 0) {
      throw new Error("there is no gemini api key");
    }
    this.keys = keys;
    this.currentIndex = 0;
    // key -> timestamp اللي المفتاح يرجع يشتغل بعده
    this.cooldownUntil = new Map();
  }

  /**
   * يرجّع أول مفتاح متاح دلوقتي (مش في فترة cooldown)، بيدور من المفتاح الحالي فصاعدًا
   */
  getAvailableKey() {
    const now = Date.now();

    for (let i = 0; i < this.keys.length; i++) {
      const idx = (this.currentIndex + i) % this.keys.length;
      const key = this.keys[idx];
      const until = this.cooldownUntil.get(key) || 0;

      if (now >= until) {
        this.currentIndex = idx;
        return { key, index: idx };
      }
    }

    // كل المفاتيح في cooldown - نرجّع أقربهم انتهاءً بدل ما نوقف السيرفر تمامًا
    let earliestKey = this.keys[0];
    let earliestUntil = this.cooldownUntil.get(earliestKey) || 0;
    for (const key of this.keys) {
      const until = this.cooldownUntil.get(key) || 0;
      if (until < earliestUntil) {
        earliestUntil = until;
        earliestKey = key;
      }
    }
    return { key: earliestKey, index: this.keys.indexOf(earliestKey), allExhausted: true, retryAfterMs: earliestUntil - now };
  }

  /**
   * يوضع المفتاح في cooldown ويقفز للمفتاح اللي بعده
   * @param {string} key
   * @param {"minute"|"day"} kind - نوع تجاوز الكوتة (دقيقة/يوم) لتحديد مدة الانتظار
   */
  markExhausted(key, kind = "minute") {
    const cooldownMs = kind === "day" ? LONG_COOLDOWN_MS : SHORT_COOLDOWN_MS;
    this.cooldownUntil.set(key, Date.now() + cooldownMs);

    const idx = this.keys.indexOf(key);
    if (idx !== -1) {
      this.currentIndex = (idx + 1) % this.keys.length;
    }
  }

  /**
   * حالة كل مفتاح - مفيدة لعمل endpoint /health يوريك حالة كل حساب
   */
  getStatus() {
    const now = Date.now();
    return this.keys.map((key, idx) => {
      const until = this.cooldownUntil.get(key) || 0;
      return {
        index: idx,
        keyPreview: `${key.slice(0, 6)}...${key.slice(-4)}`,
        available: now >= until,
        cooldownRemainingSeconds: until > now ? Math.ceil((until - now) / 1000) : 0,
      };
    });
  }

  size() {
    return this.keys.length;
  }
}

/**
 * يحدد نوع تجاوز الكوتة (يومي ولا دقيقة) من رسالة/تفاصيل خطأ Gemini
 * Gemini بيرجع status: "RESOURCE_EXHAUSTED" مع تفاصيل quota metric زي "PerDay" أو "PerMinute"
 */
export function classifyQuotaError(geminiErrorBody) {
  const text = JSON.stringify(geminiErrorBody || {});
  if (/PerDay|per_day|daily/i.test(text)) return "day";
  return "minute";
}

export function createKeyPool(keysString) {
  const keys = (keysString || "")
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
  return new KeyPool(keys);
}

export default KeyPool;
