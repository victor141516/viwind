<script setup lang="ts">
import { computed, onMounted, reactive, watch } from "vue";
import { type Event, listen } from "@tauri-apps/api/event";
import { message } from "@tauri-apps/api/dialog";
import { Metadata, metadata } from "tauri-plugin-fs-extra-api";
import {
  checkFileIsVideo,
  estimateSize,
  humanFileSize,
  transcodeVideo,
  type Quality,
} from "./utils";

let initialQuality = 55;
const lsQuality = localStorage.getItem("quality");
if (lsQuality !== null) {
  const parsed = parseInt(lsQuality, 10);
  if (
    !Number.isNaN(parsed) &&
    Number.isInteger(parsed) &&
    parsed >= 40 &&
    parsed <= 70
  ) {
    initialQuality = parsed;
  }
}

const state = reactive({
  inputFile: "",
  quality: initialQuality,
  inputFileMeta: null as null | Metadata,
  estimatedOutputSize: computed((): string => {
    if (state.inputFileMeta === null) return "";
    return humanFileSize(
      estimateSize(
        state.inputFileMeta.size,
        state.quality.toString() as Quality
      )
    );
  }),
  transcodeProgress: null as null | number,
  isDragging: false,
});

watch(
  () => state.quality,
  (newValue) => {
    localStorage.setItem("quality", newValue.toString());
  }
);

const getFileNameFromEvent = (event: Event<unknown>) => {
  if (!Array.isArray(event.payload)) return;
  const path = event.payload?.[0];
  if (typeof path !== "string") return;
  return path;
};

onMounted(() => {
  listen("tauri://file-drop-hover", async (event) => {
    const path = getFileNameFromEvent(event);
    if (typeof path !== "string") return;

    const checkResult = await checkFileIsVideo(path);
    if (checkResult !== "VALID") return;

    state.isDragging = true;
  });
  listen("tauri://file-drop-cancelled", async () => {
    state.isDragging = false;
  });

  listen("tauri://file-drop", async (event) => {
    state.isDragging = false;

    const path = getFileNameFromEvent(event);
    if (typeof path !== "string") return;

    const checkResult = await checkFileIsVideo(path);
    if (checkResult !== "VALID") return;

    state.inputFile = path;
    state.inputFileMeta = await metadata(state.inputFile);
  });
});

const onSubmit = async () => {
  await transcodeVideo({
    inputFilePath: state.inputFile,
    quality: state.quality,
    onProgress: (progress) => {
      state.transcodeProgress = progress;
    },
    onComplete: async () => {
      state.transcodeProgress = null;
      await message("Conversion complete!");
    },
    onError: async (error) => {
      await message("Conversion error: " + error);
    },
  });
};

const filenameToDisplay = computed(() => {
  const filename = state.inputFile.split("/").pop();
  if (!filename) return "";
  if (filename.length < 20) return filename;
  return (
    filename.substring(0, 10) + "..." + filename.substring(filename.length - 10)
  );
});
</script>

<template>
  <form @submit.prevent="onSubmit" class="flex flex-col items-center gap-6">
    <div class="relative -mt-4">
      <img
        src="/input-icon-small.png"
        :class="{ 'scale-110': state.isDragging }"
      />
      <span class="absolute top-12 left-1">Drop file here</span>
      <span class="absolute text-4xl top-20 left-6">☞</span>
    </div>
    <span
      :class="{ 'opacity-0': state.inputFile === '' }"
      class="h-10 bg-slate-600 px-3 py-2 text-slate-200 rounded-md whitespace-nowrap overflow-hidden text-ellipsis"
      >{{ filenameToDisplay }}</span
    >
    <label class="flex flex-col items-center gap-2">
      <input type="range" v-model="state.quality" min="40" max="70" />
      <span :class="{ 'opacity-0': state.estimatedOutputSize === '' }">
        Result size will be around
        {{ state.estimatedOutputSize }}
      </span>
    </label>
    <div class="flex flex-col items-center">
      <button
        :disabled="state.transcodeProgress !== null || state.inputFile === ''"
        type="submit"
        class="bg-slate-600 px-3 py-2 text-slate-200 rounded-t-md w-full hover:bg-slate-700 active:bg-slate-800 disabled:bg-slate-500"
      >
        Convert!
      </button>
      <div
        class="rounded-b-md h-1 bg-slate-800 self-start"
        :style="`width: ${(state.transcodeProgress ?? 0) * 100}%`"
      ></div>
    </div>
  </form>
</template>
