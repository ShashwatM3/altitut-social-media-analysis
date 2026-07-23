"use client";

import { useRef, useState } from "react";
import { uploadToStorage, type StorageUploadResult } from "../../lib/storage";

export type MediaFile = {
  id: string;
  kind: "video" | "image";
  file?: File;
  url: string;
  path: string;
  width?: number;
  height?: number;
  durationSec?: number;
  bytes: number;
  progress: number;
  status: "uploading" | "done" | "error";
  error?: string;
};

type MediaDropzoneProps = {
  files: MediaFile[];
  onChange: (files: MediaFile[]) => void;
  onError: (message: string) => void;
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
}

function generateId() {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function ProgressRing({ progress }: { progress: number }) {
  const radius = 22;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;
  return (
    <div className="relative h-14 w-14">
      <svg className="h-full w-full -rotate-90" viewBox="0 0 52 52">
        <circle
          cx="26"
          cy="26"
          r={radius}
          stroke="#e5e7eb"
          strokeWidth="4"
          fill="none"
        />
        <circle
          cx="26"
          cy="26"
          r={radius}
          stroke="#005A6A"
          strokeWidth="4"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-deep-teal">
        {progress}%
      </span>
    </div>
  );
}

export function MediaDropzone({ files, onChange, onError }: MediaDropzoneProps) {
  const [isOver, setIsOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const existingKind = files.length > 0 ? files[0].kind : undefined;

  function updateFile(id: string, patch: Partial<MediaFile>) {
    onChange(files.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }

  function readImageMetadata(url: string, id: string) {
    const img = new Image();
    img.onload = () => {
      updateFile(id, { width: img.naturalWidth, height: img.naturalHeight });
    };
    img.src = url;
  }

  function readVideoMetadata(url: string, id: string) {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    video.onloadedmetadata = () => {
      updateFile(id, {
        width: video.videoWidth,
        height: video.videoHeight,
        durationSec: Number.isFinite(video.duration) ? video.duration : undefined,
      });
    };
    video.src = url;
  }

  function startUpload(file: File, kind: "video" | "image"): string {
    const id = generateId();
    const newFile: MediaFile = {
      id,
      kind,
      file,
      url: "",
      path: "",
      bytes: file.size,
      progress: 0,
      status: "uploading",
    };
    onChange([...files, newFile]);

    uploadToStorage(file, (progress) => updateFile(id, { progress }))
      .then((result: StorageUploadResult) => {
        updateFile(id, {
          url: result.url,
          path: result.path,
          status: "done",
          progress: 100,
        });
        if (kind === "image") readImageMetadata(result.url, id);
        else readVideoMetadata(result.url, id);
      })
      .catch((error: unknown) => {
        const code = (error as { code?: string })?.code;
        const message =
          code === "storage/unauthorized"
            ? "Firebase Storage rules are blocking uploads. See SETUP_NEEDED_FROM_YOU.md."
            : error instanceof Error
              ? error.message
              : "Upload failed.";
        updateFile(id, { status: "error", error: message });
        onError(message);
      });

    return id;
  }

  function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const incoming = Array.from(fileList);

    const hasVideo = incoming.some((f) => f.type.startsWith("video/"));
    const hasImage = incoming.some((f) => f.type.startsWith("image/"));
    const allMedia = incoming.every(
      (f) => f.type.startsWith("video/") || f.type.startsWith("image/"),
    );

    if (!allMedia) {
      onError("Only video and image files are supported.");
      return;
    }

    if (hasVideo && hasImage) {
      onError("A post cannot mix images and video.");
      return;
    }

    if (existingKind && ((hasVideo && existingKind !== "video") || (hasImage && existingKind !== "image"))) {
      onError("A post cannot mix images and video.");
      return;
    }

    if (hasVideo && (incoming.length > 1 || files.length > 0)) {
      onError("Only one video can be uploaded per post.");
      return;
    }

    if (hasImage) {
      const total = files.length + incoming.length;
      if (total > 10) {
        onError("A post cannot contain more than 10 images.");
        return;
      }
    }

    const incomingKind = hasVideo ? "video" : "image";
    for (const file of incoming) {
      startUpload(file, incomingKind);
    }
  }

  function move(from: number, to: number) {
    const next = [...files];
    const [removed] = next.splice(from, 1);
    next.splice(to, 0, removed);
    onChange(next);
  }

  function remove(id: string) {
    onChange(files.filter((f) => f.id !== id));
  }

  const allDone = files.length > 0 && files.every((f) => f.status === "done");

  return (
    <div className="grid gap-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsOver(true);
        }}
        onDragLeave={() => setIsOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        role="button"
        tabIndex={0}
        aria-label="Upload media"
        className={`relative flex min-h-[16rem] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
          isOver
            ? "border-deep-teal bg-teal-50"
            : "border-gray-300 bg-white hover:border-gray-400"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="video/*,image/*"
          multiple={existingKind !== "video"}
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <div className="rounded-full bg-teal-50 p-4">
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#005A6A"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        </div>
        <p className="mt-3 font-medium text-gray-900">
          Drop a video or images here, or click to browse
        </p>
        <p className="mt-1 text-sm text-gray-500">
          {existingKind === "video"
            ? "One video per post"
            : "Up to 10 images; videos and images cannot be mixed"}
        </p>
      </div>

      {files.length > 0 ? (
        <div className="grid gap-4">
          {files[0].kind === "video" ? (
            <div className="relative rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="relative overflow-hidden rounded-lg bg-black">
                <video
                  src={files[0].url}
                  controls
                  muted
                  playsInline
                  className="max-h-80 w-full"
                />
                {files[0].status === "uploading" ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                    <ProgressRing progress={files[0].progress} />
                  </div>
                ) : null}
              </div>
              <div className="mt-3 flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  {formatBytes(files[0].bytes)}
                  {files[0].durationSec
                    ? ` · ${Math.round(files[0].durationSec)}s`
                    : null}
                  {files[0].width && files[0].height
                    ? ` · ${files[0].width}×${files[0].height}`
                    : null}
                </div>
                <div className="flex items-center gap-2">
                  {files[0].status === "done" ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600">
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 16 16"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="3 8 7 12 13 5" />
                      </svg>
                      Uploaded
                    </span>
                  ) : null}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      remove(files[0].id);
                    }}
                    className="rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                  >
                    Remove
                  </button>
                </div>
              </div>
              {files[0].error ? (
                <p className="mt-2 text-sm text-bright-coral">{files[0].error}</p>
              ) : null}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
              {files.map((file, index) => (
                <div
                  key={file.id}
                  className="relative rounded-xl border border-gray-200 bg-white p-2 shadow-sm"
                >
                  <div className="relative aspect-square overflow-hidden rounded-lg bg-gray-100">
                    <img
                      src={file.url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                    {file.status === "uploading" ? (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                        <ProgressRing progress={file.progress} />
                      </div>
                    ) : null}
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-xs text-gray-500">
                      {formatBytes(file.bytes)}
                    </span>
                    <div className="flex items-center gap-1">
                      {index > 0 ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            move(index, index - 1);
                          }}
                          className="rounded p-1 text-gray-500 hover:bg-gray-100"
                          aria-label="Move left"
                        >
                          ←
                        </button>
                      ) : null}
                      {index < files.length - 1 ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            move(index, index + 1);
                          }}
                          className="rounded p-1 text-gray-500 hover:bg-gray-100"
                          aria-label="Move right"
                        >
                          →
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          remove(file.id);
                        }}
                        className="rounded p-1 text-red-500 hover:bg-red-50"
                        aria-label="Remove"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                  {file.error ? (
                    <p className="mt-1 text-xs text-bright-coral">{file.error}</p>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {allDone ? (
        <p className="flex items-center gap-1 text-sm font-medium text-green-600">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 8 7 12 13 5" />
          </svg>
          Media ready
        </p>
      ) : null}
    </div>
  );
}
