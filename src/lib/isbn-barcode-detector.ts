type DetectedBarcode = {
  rawValue: string;
};

export type IsbnBarcodeDetector = {
  detect: (source: HTMLVideoElement) => Promise<DetectedBarcode[]>;
};

type NativeBarcodeDetectorConstructor = new (options?: {
  formats?: string[];
}) => IsbnBarcodeDetector;

const MAX_FRAME_DIMENSION = 1280;
const WASM_URL = "/wasm/zxing_reader.wasm";

export async function createIsbnBarcodeDetector(): Promise<IsbnBarcodeDetector> {
  const NativeBarcodeDetector = (
    window as Window & {
      BarcodeDetector?: NativeBarcodeDetectorConstructor;
    }
  ).BarcodeDetector;

  if (NativeBarcodeDetector) {
    try {
      const nativeDetector = new NativeBarcodeDetector({
        formats: ["ean_13"],
      });

      return createNativeFirstDetector(nativeDetector);
    } catch (error) {
      console.warn(
        "[isbn scanner] native barcode detector unavailable, using WASM",
        error,
      );
    }
  }

  return createWasmBarcodeDetector();
}

function createNativeFirstDetector(
  nativeDetector: IsbnBarcodeDetector,
): IsbnBarcodeDetector {
  let useWasm = false;
  let wasmDetectorPromise: Promise<IsbnBarcodeDetector> | null = null;

  return {
    async detect(source) {
      if (useWasm) {
        wasmDetectorPromise ||= createWasmBarcodeDetector();
        return (await wasmDetectorPromise).detect(source);
      }

      try {
        return await nativeDetector.detect(source);
      } catch (error) {
        console.warn(
          "[isbn scanner] native detection failed, switching to WASM",
          error,
        );
        useWasm = true;
        wasmDetectorPromise ||= createWasmBarcodeDetector();
        return (await wasmDetectorPromise).detect(source);
      }
    },
  };
}

async function createWasmBarcodeDetector(): Promise<IsbnBarcodeDetector> {
  const { prepareZXingModule, readBarcodes } = await import(
    "zxing-wasm/reader"
  );

  await prepareZXingModule({
    fireImmediately: true,
    overrides: {
      locateFile(path, prefix) {
        return path.endsWith(".wasm") ? WASM_URL : `${prefix}${path}`;
      },
    },
  });

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });

  if (!context) {
    throw new Error("Canvas 2D is unavailable");
  }

  return {
    async detect(source) {
      const { height, width } = getFrameSize(source);

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      context.drawImage(source, 0, 0, width, height);
      const imageData = context.getImageData(0, 0, width, height);
      const results = await readBarcodes(imageData, {
        formats: ["EAN13"],
        maxNumberOfSymbols: 1,
        tryHarder: true,
        tryRotate: true,
      });

      return results.map(({ text }) => ({ rawValue: text }));
    },
  };
}

function getFrameSize(source: HTMLVideoElement) {
  const sourceWidth = source.videoWidth;
  const sourceHeight = source.videoHeight;
  const scale = Math.min(
    1,
    MAX_FRAME_DIMENSION / Math.max(sourceWidth, sourceHeight),
  );

  return {
    height: Math.max(1, Math.round(sourceHeight * scale)),
    width: Math.max(1, Math.round(sourceWidth * scale)),
  };
}
