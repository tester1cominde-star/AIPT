# ملخص مشروع AIPT - Food Calorie Analyzer

## نظرة عامة
مشروع **AIPT** هو Backend مكتوب بـ Node.js يحلل صور الأكل والباركودات لتوفير معلومات غذائية مفصلة (سعرات حرارية، بروتين، كربوهيدرات، دهون، إلخ). يستخدم المشروع الذكاء الاصطناعي والخدمات الخارجية لتحليل الأطعمة وتخزين البيانات في قاعدة بيانات Supabase.

## التقنيات المستخدمة

### Backend Framework
- **Node.js** + **Express** للـ Server
- **Type:** ES Modules (JavaScript modules)

### AI Services
- **Groq AI** (model: qwen/qwen3.6-27b) لتحليل صور الأكل
- **Gemini AI** (سابقاً) مع نظام تدوير المفاتيح لتجاوز الحدود المجانية
- **Open Food Facts API** لاسترجاع بيانات المنتجات من الباركود

### Barcode Detection
- **@zxing/library** لقراءة الباركود من الصور
- **Sharp** لمعالجة الصور وتحسين جودتها
- **barcode-detector** كبديل محتمل

### Database
- **Supabase** (PostgreSQL) لتخزين سجلات الأكل
- Row Level Security (RLS) لحماية البيانات

### File Upload
- **Multer** مع تخزين في الذاكرة (مناسب للبيئات Serverless مثل Vercel)

### Other Tools
- **CORS** للسماح بالطلبات من المصادر المختلفة
- **dotenv** لإدارة متغيرات البيئة
- **node-cron** للتنفيذ المجدول (keep-alive ping)
- **axios** للطلبات HTTP

## المميزات الرئيسية

### 1. تحليل صور الأكل بالذكاء الاصطناعي
- استقبال صورة من المستخدم
- تحليلها باستخدام Groq AI
- تقدير القيم الغذائية: سعرات، بروتين، كربوهيدرات، دهون، إلخ
- حفظ النتائج في Supabase

### 2. تحليل الباركود
- اكتشاف الباركود من الصور باستخدام ZXing
- دعم متعدد للصور ذات الجودة المنخفضة (11 استراتيجية معالجة)
- استرجاع بيانات المنتج من Open Food Facts API
- حفظ النتائج في Supabase

### 3. الملخص اليومي
- استرجاع ملخص غذائي لكل مستخدم ليوم محدد
- تجميع القيم الغذائية الكلية
- عرض قائمة بجميع الأكلات المسجلة

### 4. نظام تدوير المفاتيح (سابقاً)
- استخدام مجموعة مفاتيح Gemini من حسابات مختلفة
- تدوير تلقائي عند الوصول للحدود (429)
- Cooldown مدة دقيقة للحدود الدقيقة أو 24 ساعة للحدود اليومية
- المتابعة التلقائية للمفاتيح المتاحة والقيد Cooldown

## هيكل المشروع

```
AIPT/
├── server.js                 # Express Server الرئيسي
├── package.json              # التبعيات والسكريبتات
├── .env.example              # مثال لمتغيرات البيئة
├── .gitignore                # الملفات المتجاهلة
├── README.md                 # التوثيق بالعربية
├── API_DOCUMENTATION.md      # التوثيق الكامل للـ API
├── API_ENDPOINTS.md          # تفاصيل الـ Endpoints
├── supabase-schema.sql       # Schema قاعدة البيانات
├── supabaseClient.js         # إعداد Supabase Client
├── keyPool.js                # نظام تدوير المفاتيح
├── barcodeScanner.js         # قراءة الباركود من الصور
├── barcodeUtils.js           # التكامل مع Open Food Facts
├── models/
│   ├── geminiService.js      # خدمة Gemini AI
│   └── groqService.js        # خدمة Groq AI
├── routes/
│   ├── foodRoutes.js         # مسارات تحليل الأكل والباركود
│   └── healthRoutes.js       # مسارات الصحة والملخصات
└── uploads/                  # مجلد الصور المرفوعة (مؤقت)
```

## الـ Endpoints الرئيسية

### 1. POST /analyze-food
تحليل صورة أكل بالذكاء الاصطناعي
- **Input:** صورة + user_id
- **Output:** تحليل غذائي JSON
- **حفظ تلقائي في Supabase**

### 2. POST /analyze-barcode
تحليل باركود منتج
- **Input:** صورة تحتوي باركود + user_id
- **Output:** بيانات المنتج من Open Food Facts
- **حفظ تلقائي في Supabase**

### 3. GET /health/daily-summary
ملخص غذائي يومي
- **Input:** user_id + date (اختياري)
- **Output:** ملخص القيم الغذائية الكلية + قائمة الأكلات

### 4. GET /health/keys
متابعة حالة المفاتيح (سابقاً)
- **Output:** عدد المفاتيح المتاحة والقيد Cooldown

### 5. GET /
صفحة رئيسية HTML تعرض حالة النظام والـ Endpoints المتاحة

## قاعدة البيانات

### جدول food_logs
```sql
- id: UUID (Primary Key)
- user_id: TEXT
- food_name: TEXT
- portion_estimate: TEXT
- calories_kcal: NUMERIC
- protein_g: NUMERIC
- carbs_g: NUMERIC
- fat_g: NUMERIC
- saturated_fat_g: NUMERIC
- sugar_g: NUMERIC
- fiber_g: NUMERIC
- sodium_mg: NUMERIC
- confidence: TEXT
- notes: TEXT
- image_url: TEXT
- barcode: TEXT
- created_at: TIMESTAMP
- date: DATE
```

### الأمان
- Row Level Security (RLS) مفعّل
- سياسات للقراءة والكتابة والتحديث والحذف
- فهرسة على user_id و date للبحث السريع

## متغيرات البيئة المطلوبة

```bash
# للنسخة الحالية (Groq)
GROQ_API_KEY=your_groq_api_key

# للنسخة القديمة (Gemini مع تدوير المفاتيح)
GEMINI_API_KEYS=key1,key2,key3
GEMINI_MODEL=gemini-1.5-flash

# قاعدة البيانات
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key

# السيرفر
PORT=3000
BASE_URL=https://your-app-url.com  # للـ keep-alive ping
```

## النشر

### البيئة الحالية
- **Platform:** Vercel
- **URL:** https://aipt-seven.vercel.app/
- **Type:** Serverless function

### خيارات النشر الأخرى
- **Render** (Free tier مع cold start)
- **Fly.io** (VMs خفيفة)
- **SnapDeploy** (4 containers مجانية)
- **Back4app** (Docker containers مجانية)

## المميزات التقنية

### معالجة الصور
- 11 استراتيجية لمعالجة الصور ذات الجودة المنخفضة
- Dual binarizer approach
- TRY_HARDER hint للكشف الأفضل

### معالجة الأخطاء
- استجابات أخطاء متسقة
- رموز HTTP مناسبة
- تدهور محترم (تحذير إذا فشل الحفظ في DB لكن نجح التحليل)

### الأداء
- Multer memory storage (مناسب لـ Serverless)
- فهرسة قاعدة البيانات
- Cron job للـ keep-alive

## الاستخدامات المحتملة

1. **تطبيقات التتبع الغذائي** - تسجيل ومراقبة السعرات اليومية
2. **تطبيقات اللياقة والصحة** - متابعة التغذية للرياضيين
3. **تطبيقات إدارة الوزن** - حساب السعرات للمساعدة في فقدان/زيادة الوزن
4. **تطبيقات التسوق الذكي** - مقارنة القيم الغذائية للمنتجات
5. **نظام إدارة المطاعم** - تحليل القوائم الغذائية

## التحديات والحلول

### الحد من المفاتيح المجانية
- **الحل:** نظام تدوير المفاتيح المتعددة
- **النتيجة:** استخدام كوته أكبر من خلال حسابات متعددة

### جودة الصور المنخفضة
- **الحل:** 11 استراتيجية معالجة مسبقة
- **النتيجة:** تحسين احتمالية قراءة الباركود

### تخزين الملفات في Serverless
- **الحل:** Multer memory storage
- **النتيجة:** مناسب لـ Vercel والبيئات Serverless

## التطويرات المستقبلية المقترحة

1. إضافة نظام مصادقة (JWT, OAuth)
2. تطبيق rate limiting middleware
3. التحقق من حجم الصور
4. دعم المزيد من تنسيقات الباركود
5. تخزين مؤقت (caching) للمنتجات الشائعة
6. تحليل دفعي لصور متعددة
7. وظيفة التصدير (CSV, PDF)
8. تكامل مع تطبيقات موبايل
9. إضافة قاعدة بيانات محلية للمنتجات الشائعة
10. دعم لغات متعددة

## ملاحظات مهمة

- **الدقة تقريبية:** الذكاء الاصطناعي يقدر تقريبياً وليس تحليل معملي
- **الصور المؤقتة:** الصور تُمسح بعد التحليل
- **Cooldown في الذاكرة:** حالة المفاتيح متخزنة في RAM وتُفقد عند إعادة التشغيل
- **RLS:** يجب التأكد من سياسات الأمان في Supabase
- **Cold Start:** الاستضافة المجانية تأخذ وقتاً للاستيقاظ بعد الخمول

## الخلاصة

مشروع AIPT هو Backend قوي ومرن لتحليل الأطعمة باستخدام الذكاء الاصطناعي والباركودات. يوفر حلاً متكاملاً لتتبع التغذية مع بنية قابلة للتوسع ونشر سهل على منصات متعددة. النظام مصمم للتعامل مع حدود الـ API المجانية من خلال تدوير المفاتيح ومعالجة الأخطاء بشكل احترافي.
