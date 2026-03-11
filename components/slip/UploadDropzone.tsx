"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Props = {
  loading?: boolean;
  onFileSelect: (file: File) => Promise<void> | void;
};

const ACCEPTED = ["image/jpeg", "image/png", "application/pdf"];
const MAX_SIZE = 5 * 1024 * 1024;

export function UploadDropzone({ onFileSelect, loading = false }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const validateFile = (file: File): string | null => {
    if (!ACCEPTED.includes(file.type)) return "Format tidak didukung. Gunakan JPG, PNG, atau PDF.";
    if (file.size > MAX_SIZE) return "Ukuran file maksimal 5MB.";
    return null;
  };

  const handleFile = async (file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    if (file.type.startsWith("image/")) {
      setPreview(URL.createObjectURL(file));
    } else {
      setPreview(null);
    }
    await onFileSelect(file);
  };

  return (
    <div className="mx-auto flex w-full min-w-[375px] max-w-xl flex-col gap-3 px-4 py-3">
      <div className="rounded-md border border-emerald-300 bg-emerald-50 p-3 text-xs text-emerald-800">
        🔒 Foto slip lo dihapus otomatis dalam 24 jam. Nama & perusahaan tidak disimpan.
      </div>

      <div
        className={`flex min-h-44 flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-4 text-center ${
          dragging ? "border-blue-500 bg-blue-50" : "border-gray-300"
        }`}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={async (event) => {
          event.preventDefault();
          setDragging(false);
          const file = event.dataTransfer.files?.[0];
          if (file) await handleFile(file);
        }}
      >
        <p className="text-sm font-medium">Drag & drop slip kamu di sini</p>
        <p className="text-xs text-gray-600">Format: JPG, PNG, PDF — maks 5MB</p>
        <Button type="button" className="h-10 text-sm" onClick={() => inputRef.current?.click()} disabled={loading}>
          Pilih File
        </Button>
        <Input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,application/pdf"
          className="hidden"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (file) await handleFile(file);
          }}
        />
      </div>

      {loading ? <p className="text-sm text-gray-700">AI sedang membaca slip kamu...</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {preview ? (
        <div className="overflow-hidden rounded-md border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Preview slip" className="h-auto w-full object-cover" />
        </div>
      ) : null}
    </div>
  );
}
