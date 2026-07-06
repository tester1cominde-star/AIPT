# Food Calorie Analyzer Backend

Backend بسيط بيستقبل صورة أكل أو باركود منتج ويرجع تحليل غذائي (سعرات، بروتين، فات...) JSON، باستخدام **مجموعة مفاتيح Gemini** (من أكونتات جيميل مختلفة) و **Open Food Facts API** للباركودات. البيانات بتتخزن في Supabase مع إمكانية استرجاع ملخص يومي.

## المميزات
1. تحليل صور الأكل باستخدام Gemini AI مع تدوير تلقائي للمفاتيح
2. تحليل باركود المنتجات باستخدام Open Food Facts API
3. تخزين البيانات في Supabase لكل مستخدم
4. استرجاع ملخص يومي لجميع الأكلات

## الفكرة
1. تجيب مفتاح Gemini مجاني من كل أكونت جيميل معاك (https://aistudio.google.com/app/apikey)
2. تحطهم كلهم في متغير بيئة واحد مفصولين بفاصلة: `GEMINI_API_KEYS`
3. السيرفر بيستخدم مفتاح واحد بالدور. لما يخلّص الكوتة (429)، بيتعلّم "cooldown" ويقفز على اللي بعده أوتوماتيك في نفس الطلب - المستخدم مش حاسب بأي فرق.

## التشغيل محليًا
```bash
npm install
cp .env.example .env
# افتح .env وضع مفاتيحك مفصولة بفاصلة في GEMINI_API_KEYS
# ضع بيانات Supabase في SUPABASE_URL و SUPABASE_ANON_KEY
npm start
```

## إعداد Supabase
1. أنشئ مشروع جديد في [Supabase](https://supabase.com)
2. افتح SQL Editor في Supabase Dashboard
3. شغل ملف `supabase-schema.sql` لإنشاء الجداول والسياسات
4. انسخ Project URL و anon key من Settings > API وضعهم في `.env`

## الـ Endpoints

### 1. تحليل صورة أكل
```bash
curl -X POST http://localhost:3000/analyze-food \
  -F "image=@/path/to/food.jpg" \
  -F "user_id=user123"
```
أو باستخدام header:
```bash
curl -X POST http://localhost:3000/analyze-food \
  -F "image=@/path/to/food.jpg" \
  -H "x-user-id: user123"
```

**الرد:**
```json
{
  "success": true,
  "data": {
    "food_name": "Chicken Rice Bowl",
    "portion_estimate": "1 plate",
    "calories_kcal": 450,
    "protein_g": 25,
    "carbs_g": 45,
    "fat_g": 15,
    "saturated_fat_g": 5,
    "sugar_g": 3,
    "fiber_g": 2,
    "sodium_mg": 800,
    "confidence": "medium",
    "notes": "Estimated based on typical portion"
  },
  "log_id": "uuid-of-saved-record"
}
```

### 2. تحليل باركود منتج
```bash
curl -X POST http://localhost:3000/analyze-barcode \
  -H "Content-Type: application/json" \
  -d '{"barcode": "7622210449283", "user_id": "user123"}'
```
أو باستخدام header:
```bash
curl -X POST http://localhost:3000/analyze-barcode \
  -H "Content-Type: application/json" \
  -H "x-user-id: user123" \
  -d '{"barcode": "7622210449283"}'
```

**الرد:**
```json
{
  "success": true,
  "data": {
    "food_name": "Product Name",
    "barcode": "7622210449283",
    "calories_kcal": 250,
    "protein_g": 10,
    "carbs_g": 30,
    "fat_g": 8,
    "saturated_fat_g": 3,
    "sugar_g": 15,
    "fiber_g": 1,
    "sodium_mg": 500,
    "portion_estimate": "100g",
    "confidence": "high",
    "notes": "Data from Open Food Facts database"
  },
  "log_id": "uuid-of-saved-record"
}
```

### 3. ملخص يومي
```bash
curl "http://localhost:3000/daily-summary?user_id=user123"
```
أو باستخدام header:
```bash
curl "http://localhost:3000/daily-summary" -H "x-user-id: user123"
```
مع تاريخ محدد (اختياري):
```bash
curl "http://localhost:3000/daily-summary?user_id=user123&date=2024-01-15"
```

**الرد:**
```json
{
  "success": true,
  "data": {
    "date": "2024-01-15",
    "user_id": "user123",
    "total_calories": 1200,
    "total_protein": 60,
    "total_carbs": 120,
    "total_fat": 40,
    "total_saturated_fat": 15,
    "total_sugar": 30,
    "total_fiber": 10,
    "total_sodium": 2500,
    "food_count": 3,
    "foods": [
      {
        "id": "uuid",
        "food_name": "Breakfast",
        "calories_kcal": 400,
        "protein_g": 20,
        "carbs_g": 40,
        "fat_g": 12,
        "created_at": "2024-01-15T08:00:00Z"
      }
    ]
  }
}
```

### متابعة حالة المفاتيح (كام متاح، كام في cooldown)
```bash
curl http://localhost:3000/health/keys
```
```json
{
  "pool_size": 3,
  "keys": [
    { "index": 0, "keyPreview": "AIzaSy...ab12", "available": true, "cooldownRemainingSeconds": 0 },
    { "index": 1, "keyPreview": "AIzaSy...cd34", "available": false, "cooldownRemainingSeconds": 45231 }
  ]
}
```

## طريقة الدوران بين المفاتيح
- **429 بسبب حد الدقيقة (RPM)**: المفتاح يتقفل دقيقة واحدة بس، وبعدين يرجع يشتغل تلقائيًا.
- **429 بسبب الكوتة اليومية**: المفتاح يتقفل 24 ساعة (تقريبًا لحد ما الكوتة اليومية تتجدد عند جوجل).
- لو **كل** المفاتيح خلّصت في نفس الوقت، السيرفر يرجع خطأ `503` مع `retryAfterSeconds` - ده الوقت الوحيد اللي التطبيق ممكن يوقف فيه فعليًا، فكل ما تزود مفاتيح كل ما قلّت الاحتمالية.

---

## 🚀 الاستضافة المجانية

**التوصية: Render** — من أسهل الخيارات وبدون كارت ائتمان.

بعض التفاصيل المهمة قبل ما تختار: <cite index="19-3">Render's free tier في 2026 بيركز على سهولة النشر، تقدر تنشر Web Service من غير Dockerfile أو CLI أو بيانات كارت ائتمان</cite>. العيب الوحيد إن <cite index="11-1">Render بيقدم استضافة مجانية لتطبيقات Express لكن مع cold start من 30 لـ60 ثانية</cite> (يعني أول طلب بعد فترة خمول هياخد وقت أطول شوية، والطلبات اللي بعده تكون سريعة عادي).

### خطوات النشر على Render
1. ادفع الكود بتاعك على GitHub (repo عادي، مش لازم يكون public)
2. روح على https://render.com وسجل حساب (بدون كارت ائتمان)
3. من الداشبورد: **New** → **Web Service** → اختر الـ repo بتاعك
4. الإعدادات:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Free
5. من تبويب **Environment**، ضيف متغير البيئة:
   - `GEMINI_API_KEYS` = `مفتاح1,مفتاح2,مفتاح3`
   - `SUPABASE_URL` = `your_supabase_project_url`
   - `SUPABASE_ANON_KEY` = `your_supabase_anon_key`
6. Deploy — هيديك رابط زي `https://your-app.onrender.com`

### بدائل تانية لو عايز تجرب
- **Fly.io**: <cite index="13-1">بيشغل تطبيقات Node.js في VMs خفيفة، بيدعم volumes للتخزين الدائم لو احتجت</cite>، لكن محتاج بيانات كارت ائتمان من البداية.
- **SnapDeploy**: <cite index="13-1">بيقدم حتى 4 containers مجانًا بـ512 MB رام لكل واحد، بدون كارت ائتمان، لكن الـ containers بتنام بعد فترة خمول وتاخد وقت للاستيقاظ</cite>.
- **Back4app**: بديل لو Render طلب كارت ائتمان في منطقتك، بيقدم حاويات Docker مجانية بموارد محدودة.

⚠️ ملاحظة: خدمات الاستضافة المجانية بتتغير شروطها بسرعة، فراجع صفحة الـ pricing بتاعة أي خدمة قبل ما تاخد قرار نهائي.

## ملاحظات مهمة
- **الـ cooldown state بتاعت المفاتيح متخزنة في الذاكرة (RAM)**، يعني لو السيرفر اتعمل له restart (زي ما بيحصل تلقائيًا بعد خمول في الاستضافة المجانية)، كل المفاتيح ترجع "متاحة" من جديد. ده مش مشكلة فعليًا - أسوأ حالة إنك تجرب مفتاح لسه في الكوتة القديمة وترجع تاخد 429 وتقفز على اللي بعده تلقائيًا.
- **الدقة تقريبية**: أي موديل AI بيقدّر تقريبي مش تحليل معملي.
- الصور بتتمسح من `uploads/` مباشرة بعد التحليل (المساحة على Render مؤقتة أصلًا، فده مناسب).
- ممكن تستبدل الموديل: غيّر `GEMINI_MODEL` في `server.js`.
