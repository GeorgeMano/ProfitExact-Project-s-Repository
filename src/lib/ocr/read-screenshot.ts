import type { Worker } from "tesseract.js";
import { parseDeliveryScreenshot, type DeliveryReading } from "./delivery-screenshot";
import { parseEarningsScreenshot, type ScreenshotReading } from "./earnings-screenshot";

/**
 * Citirea capturii direct în browserul utilizatorului.
 *
 * Imaginea nu pleacă niciodată de pe dispozitiv: textul este recunoscut local
 * (Tesseract, limba română). Biblioteca și datele limbii se descarcă o singură
 * dată, la prima folosire, apoi rămân în memoria browserului.
 */

export type ReadProgress = (stage: "loading" | "reading", percent: number) => void;

/** Lățimea la care textul din captură se citește cel mai sigur. */
const TARGET_WIDTH = 2000;

let workerPromise: Promise<Worker> | null = null;
let progressListener: ReadProgress | null = null;

function getWorker() {
  workerPromise ??= import("tesseract.js").then(({ createWorker }) =>
    createWorker("ron", 1, {
      logger: (message) => {
        const percent = Math.round((message.progress ?? 0) * 100);
        if (message.status === "recognizing text") progressListener?.("reading", percent);
        else progressListener?.("loading", percent);
      },
    }),
  );
  // Dacă descărcarea eșuează, următoarea încercare pornește de la zero.
  workerPromise.catch(() => {
    workerPromise = null;
  });
  return workerPromise;
}

function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Imaginea nu a putut fi deschisă."));
    };
    image.src = url;
  });
}

/**
 * Pregătirea imaginii: tonuri de gri, text închis pe fond deschis (ecranele
 * aplicațiilor au fundal închis), contrast întins și lățime potrivită.
 */
export async function prepareScreenshot(file: Blob): Promise<HTMLCanvasElement> {
  const image = await loadImage(file);
  const scale = TARGET_WIDTH / image.naturalWidth;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(image.naturalWidth * scale);
  canvas.height = Math.round(image.naturalHeight * scale);
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Browserul nu poate prelucra imaginea.");

  context.imageSmoothingQuality = "high";
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  const data = pixels.data;

  let sum = 0;
  let min = 255;
  let max = 0;
  const gray = new Uint8ClampedArray(data.length / 4);
  for (let index = 0; index < gray.length; index += 1) {
    const offset = index * 4;
    const value = 0.299 * data[offset] + 0.587 * data[offset + 1] + 0.114 * data[offset + 2];
    gray[index] = value;
    sum += value;
    if (value < min) min = value;
    if (value > max) max = value;
  }

  const darkBackground = sum / gray.length < 128;
  const range = Math.max(1, max - min);
  for (let index = 0; index < gray.length; index += 1) {
    let value = ((gray[index] - min) * 255) / range;
    if (darkBackground) value = 255 - value;
    const offset = index * 4;
    data[offset] = value;
    data[offset + 1] = value;
    data[offset + 2] = value;
    data[offset + 3] = 255;
  }

  context.putImageData(pixels, 0, 0);
  return canvas;
}

/** Data de azi în România, pentru anul capturilor care nu îl scriu. */
export function todayInRomania() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Bucharest",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Textul brut din captură, rând cu rând. Folosit de toate cititoarele. */
export async function readScreenshotText(file: Blob, onProgress?: ReadProgress): Promise<string> {
  progressListener = onProgress ?? null;
  try {
    const [worker, canvas] = await Promise.all([getWorker(), prepareScreenshot(file)]);
    const { data } = await worker.recognize(canvas);
    return data.text;
  } finally {
    progressListener = null;
  }
}

export async function readEarningsScreenshot(
  file: Blob,
  onProgress?: ReadProgress,
): Promise<ScreenshotReading> {
  const text = await readScreenshotText(file, onProgress);
  return { ...parseEarningsScreenshot(text, todayInRomania()), rawText: text };
}

export async function readDeliveryScreenshot(
  file: Blob,
  onProgress?: ReadProgress,
): Promise<DeliveryReading> {
  const text = await readScreenshotText(file, onProgress);
  return { ...parseDeliveryScreenshot(text, todayInRomania()), rawText: text };
}
