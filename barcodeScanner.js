import sharp from 'sharp';
import {
  MultiFormatReader,
  BarcodeFormat,
  DecodeHintType,
  RGBLuminanceSource,
  BinaryBitmap,
  HybridBinarizer,
  GlobalHistogramBinarizer,
  NotFoundException,
} from '@zxing/library';

// Suppress ZXing console errors
const originalConsoleError = console.error;
const originalConsoleLog = console.log;

function suppressConsole() {
  console.error = () => {};
  console.log = (...args) => {
    const message = args[0] ? String(args[0]) : '';
    if (!message.includes('MultiFormatReader') && 
        !message.includes('NotFoundException') &&
        !message.includes('ChecksumException') &&
        !message.includes('FormatException')) {
      originalConsoleLog.apply(console, args);
    }
  };
}

function restoreConsole() {
  console.error = originalConsoleError;
  console.log = originalConsoleLog;
}

/**
 * Decode barcode from image buffer
 */
async function decodeFromBuffer(imageBuffer, useGlobalHistogram = false) {
  suppressConsole();
  try {
    // Decode image to raw RGBA pixels
    const { data, info } = await sharp(imageBuffer)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const { width, height } = info;
    const pixelCount = width * height;

    // ZXing's RGBLuminanceSource expects packed 0xRRGGBB ints per pixel
    const intArray = new Int32Array(pixelCount);
    for (let i = 0; i < pixelCount; i++) {
      const r = data[i * 4];
      const g = data[i * 4 + 1];
      const b = data[i * 4 + 2];
      intArray[i] = (r << 16) | (g << 8) | b;
    }

    const luminanceSource = new RGBLuminanceSource(intArray, width, height);
    const binarizer = useGlobalHistogram 
      ? new GlobalHistogramBinarizer(luminanceSource)
      : new HybridBinarizer(luminanceSource);
    const binaryBitmap = new BinaryBitmap(binarizer);

    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.CODE_128,
      BarcodeFormat.CODE_39,
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
      BarcodeFormat.CODE_93,
      BarcodeFormat.ITF,
      BarcodeFormat.CODABAR,
    ]);
    hints.set(DecodeHintType.TRY_HARDER, true);

    const reader = new MultiFormatReader();
    reader.setHints(hints);

    const result = reader.decode(binaryBitmap);

    return {
      text: result.getText(),
      format: BarcodeFormat[result.getBarcodeFormat()],
    };
  } catch (error) {
    if (error instanceof NotFoundException) {
      return null;
    }
    throw error;
  } finally {
    restoreConsole();
  }
}

/**
 * Detect barcode from image buffer using ZXing with aggressive preprocessing
 */
export async function detectBarcode(imageBuffer) {
  suppressConsole();
  try {
    // Try original image first
    let result = await decodeFromBuffer(imageBuffer);
    if (result) return result.text;

    // Try with GlobalHistogramBinarizer
    result = await decodeFromBuffer(imageBuffer, true);
    if (result) return result.text;

    // Preprocessing strategies for low quality images
    const strategies = [
      // Strategy 1: Grayscale + Normalize + Sharpen
      async () => {
        return await sharp(imageBuffer)
          .grayscale()
          .normalize()
          .sharpen()
          .toBuffer();
      },
      // Strategy 2: Grayscale + High contrast
      async () => {
        return await sharp(imageBuffer)
          .grayscale()
          .linear(2, -100)
          .toBuffer();
      },
      // Strategy 3: Grayscale + Threshold (binarization)
      async () => {
        return await sharp(imageBuffer)
          .grayscale()
          .threshold(128)
          .toBuffer();
      },
      // Strategy 4: Grayscale + Threshold 100
      async () => {
        return await sharp(imageBuffer)
          .grayscale()
          .threshold(100)
          .toBuffer();
      },
      // Strategy 5: Grayscale + Threshold 150
      async () => {
        return await sharp(imageBuffer)
          .grayscale()
          .threshold(150)
          .toBuffer();
      },
      // Strategy 6: Resize (upscale for small images)
      async () => {
        return await sharp(imageBuffer)
          .resize(2000, 2000, { fit: 'inside', withoutEnlargement: false })
          .grayscale()
          .normalize()
          .sharpen()
          .toBuffer();
      },
      // Strategy 7: Brightness + Contrast
      async () => {
        return await sharp(imageBuffer)
          .modulate({ brightness: 1.5, saturation: 0.5 })
          .grayscale()
          .normalize()
          .toBuffer();
      },
      // Strategy 8: Median filter (noise reduction)
      async () => {
        return await sharp(imageBuffer)
          .grayscale()
          .median(5)
          .normalize()
          .sharpen()
          .toBuffer();
      },
      // Strategy 9: Strong sharpening
      async () => {
        return await sharp(imageBuffer)
          .grayscale()
          .sharpen({ sigma: 3, m1: 2, m2: 3 })
          .normalize()
          .toBuffer();
      },
      // Strategy 10: Resize + High contrast
      async () => {
        return await sharp(imageBuffer)
          .resize(1500, 1500, { fit: 'inside', withoutEnlargement: false })
          .grayscale()
          .linear(2.5, -150)
          .toBuffer();
      },
    ];

    // Try each preprocessing strategy
    for (const strategy of strategies) {
      try {
        const processed = await strategy();
        result = await decodeFromBuffer(processed);
        if (result) return result.text;
        
        // Try with GlobalHistogramBinarizer
        result = await decodeFromBuffer(processed, true);
        if (result) return result.text;
      } catch (error) {
        continue;
      }
    }

    return null;
  } catch (error) {
    return null;
  } finally {
    restoreConsole();
  }
}