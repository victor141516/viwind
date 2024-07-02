import { Command } from "@tauri-apps/api/shell";

const qualityRatios = {
  "40": 0.4481941579526197,
  "41": 0.47585825211475663,
  "42": 0.47585825211475663,
  "43": 0.4749733322576741,
  "44": 0.4749733322576741,
  "45": 0.4749733322576741,
  "46": 0.49937930657526214,
  "47": 0.49937930657526214,
  "48": 0.522379789788922,
  "49": 0.522379789788922,
  "50": 0.522379789788922,
  "51": 0.5568806427657994,
  "52": 0.5568806427657994,
  "53": 0.5686810907108213,
  "54": 0.5686810907108213,
  "55": 0.5912006670796293,
  "56": 0.5912006670796293,
  "57": 0.6296017034034428,
  "58": 0.6296017034034428,
  "59": 0.6296017034034428,
  "60": 0.6629754850286746,
  "61": 0.6629754850286746,
  "62": 0.6927821617586081,
  "63": 0.6927821617586081,
  "64": 0.7538019674953109,
  "65": 0.7538019674953109,
  "66": 0.7814097369250528,
  "67": 0.7814097369250528,
  "68": 0.8405114260070192,
  "69": 0.8405114260070192,
  "70": 0.8918438263191313,
} as const;

export type Quality = keyof typeof qualityRatios;

export const estimateSize = (
  originalSize: number,
  quality: keyof typeof qualityRatios
) => {
  return originalSize * qualityRatios[quality];
};

const validVideoExtensions = [
  "mp4",
  "avi",
  "mkv",
  "mov",
  "wmv",
  "flv",
  "webm",
  "mpg",
  "mpeg",
  "m4v",
  "3gp",
  "3g2",
  "swf",
  "vob",
  "m2v",
  "ts",
  "mts",
  "m2ts",
];

export const checkFileIsVideo = async (filePath: string) => {
  const isValidExtension = validVideoExtensions.some((ext) => {
    if (filePath.endsWith(`.${ext}`)) {
      return true;
    }
  });

  if (!isValidExtension) {
    return "INVALID_EXTENSION" as const;
  }

  return "VALID" as const;
};

export const humanFileSize = (bytes: number) => {
  const thresh = 1024;
  if (Math.abs(bytes) < thresh) {
    return bytes + " B";
  }

  const units = ["KiB", "MiB", "GiB", "TiB", "PiB", "EiB", "ZiB", "YiB"];
  let u = -1;
  const r = 10;

  do {
    bytes /= thresh;
    ++u;
  } while (
    Math.round(Math.abs(bytes) * r) / r >= thresh &&
    u < units.length - 1
  );

  return bytes.toFixed(1) + " " + units[u];
};

const parseTime = (time: string) => {
  const [hours, minutes, seconds] = time.split(":").map((x) => parseFloat(x));
  return hours * 3600 + minutes * 60 + seconds;
};

export const transcodeVideo = async ({
  inputFilePath,
  quality,
  onProgress,
  onComplete,
  onError,
}: {
  inputFilePath: string;
  quality: number;
  onProgress?: (progress: number) => void;
  onComplete?: () => void;
  onError?: (error: string) => void;
}) => {
  const outputFile =
    inputFilePath.substring(0, inputFilePath.lastIndexOf(".")) +
    `q_${quality}.mp4`;

  const args = [
    "-y",
    "-i",
    inputFilePath,
    "-c:v",
    "h264_videotoolbox",
    "-q:v",
    quality.toString(),
    outputFile,
  ];

  let durationStr: string;
  let currentTimeStr: string;
  let progress = 0;

  const command = Command.sidecar("binaries/ffmpeg", args);

  command.stderr.on("data", (data) => {
    if (data.startsWith("  Duration: ")) {
      const result = /  Duration: ([0-9]+:[0-9]+:[0-9]+.[0-9]+), .+/g.exec(
        data
      );
      if (result === null) return alert("Invalid duration format");
      durationStr = result[1];
    } else if (data.startsWith("frame=")) {
      const result = /time=([0-9]+:[0-9]+:[0-9]+.[0-9]+)/g.exec(data);
      if (!durationStr) return alert("No duration found");
      if (result === null) return alert("Invalid time format");
      currentTimeStr = result[1];

      progress = parseTime(currentTimeStr) / parseTime(durationStr);
      onProgress?.(progress);
    }
  });

  command.on("close", () => {
    onComplete?.();
  });

  command.on("error", (error) => {
    onError?.(error);
  });

  await command.spawn();
};
