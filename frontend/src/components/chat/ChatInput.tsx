import { useState, useRef, FormEvent, ChangeEvent, useCallback } from 'react';
import { presignUpload, uploadToR2 } from '../../lib/api';

interface ChatInputProps {
  readonly onSend: (text: string, imageUrls?: string[], audioUrl?: string) => void;
  readonly disabled: boolean;
}

interface UploadingImage {
  file: File;
  publicUrl: string | null;
  previewUrl: string;
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [text, setText] = useState('');
  const [images, setImages] = useState<UploadingImage[]>([]);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const uploadImage = useCallback(async (file: File): Promise<string> => {
    const result = await presignUpload('request-photos', file.name, file.type);
    await uploadToR2(result.uploadUrl, file, file.type);
    return result.publicUrl;
  }, []);

  const uploadAudio = useCallback(async (blob: Blob): Promise<string> => {
    const ext = blob.type.includes('webm') ? 'webm' : 'mp4';
    const filename = `recording.${ext}`;
    const result = await presignUpload('request-audio', filename, blob.type);
    await uploadToR2(result.uploadUrl, blob, blob.type);
    return result.publicUrl;
  }, []);

  const handleImageSelect = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      if (files.length === 0) return;

      const validFiles = files.filter((f) =>
        ['image/jpeg', 'image/png', 'image/webp'].includes(f.type),
      );
      if (validFiles.length + images.length > 3) {
        validFiles.splice(3 - images.length);
      }

      setIsUploading(true);

      for (const file of validFiles) {
        const previewUrl = URL.createObjectURL(file);
        const uploadingImage: UploadingImage = { file, publicUrl: null, previewUrl };
        setImages((prev) => [...prev, uploadingImage]);

        try {
          const publicUrl = await uploadImage(file);
          setImages((prev) =>
            prev.map((img) =>
              img.file === file ? { ...img, publicUrl } : img,
            ),
          );
        } catch {
          setImages((prev) => prev.filter((img) => img.file !== file));
          URL.revokeObjectURL(previewUrl);
        }
      }

      setIsUploading(false);

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [images.length, uploadImage],
  );

  const triggerImagePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/mp4';

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        setIsUploading(true);

        try {
          const publicUrl = await uploadAudio(blob);
          setAudioUrl(publicUrl);
        } catch {
          setAudioUrl(null);
        } finally {
          setIsUploading(false);
        }
      };

      recorder.start();
      setIsRecording(true);
    } catch {
      // recording not supported or permission denied
    }
  }, [uploadAudio]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, []);

  const toggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  const removeImage = useCallback((index: number) => {
    setImages((prev) => {
      const img = prev[index];
      if (img) {
        URL.revokeObjectURL(img.previewUrl);
      }
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const removeAudio = useCallback(() => {
    setAudioUrl(null);
  }, []);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();

    if (disabled || isUploading) return;

    const imageUrls = images
      .map((img) => img.publicUrl)
      .filter((url): url is string => url !== null);
    const hasPendingImages = images.some((img) => img.publicUrl === null);

    if (hasPendingImages) return;
    if (!trimmed && imageUrls.length === 0 && !audioUrl) return;

    onSend(trimmed, imageUrls.length > 0 ? imageUrls : undefined, audioUrl ?? undefined);

    images.forEach((img) => URL.revokeObjectURL(img.previewUrl));
    setText('');
    setImages([]);
    setAudioUrl(null);
    inputRef.current?.focus();
  };

  return (
    <footer className="sticky bottom-0 z-10 shrink-0 border-t border-border bg-surface">
      <div className="mx-auto flex max-w-[720px] flex-col gap-0 px-5 pt-2.5">
        {(images.length > 0 || audioUrl) && (
          <div className="mb-2 flex flex-wrap items-center gap-2">
            {images.map((img, i) => (
              <div key={i} className="relative size-14 shrink-0 overflow-hidden rounded-lg">
                <img
                  src={img.previewUrl}
                  alt="Preview"
                  className="size-full object-cover"
                />
                {img.publicUrl === null && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                    <svg
                      className="h-4 w-4 animate-spin text-white"
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => removeImage(i)}
                  className="absolute right-0.5 top-0.5 flex size-4 items-center justify-center rounded-full bg-black/60 text-[10px] text-white hover:bg-black/80"
                >
                  &times;
                </button>
              </div>
            ))}

            {audioUrl && (
              <div className="flex items-center gap-2 rounded-lg bg-emerald/10 px-3 py-1.5">
                <svg
                  className="h-4 w-4 text-emerald"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                </svg>
                <span className="text-xs text-steel">Audio listo</span>
                <button
                  type="button"
                  onClick={removeAudio}
                  className="text-xs text-zinc-muted hover:text-steel"
                >
                  &times;
                </button>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-2 pb-2.5">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            onChange={handleImageSelect}
          />

          <button
            type="button"
            disabled={disabled || isUploading}
            onClick={triggerImagePicker}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-iron transition-colors hover:bg-hover hover:text-zinc-muted disabled:opacity-40"
            title="Adjuntar imagen"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </button>

          <button
            type="button"
            disabled={disabled || (isUploading && !isRecording)}
            onClick={toggleRecording}
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors disabled:opacity-40 ${
              isRecording
                ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20'
                : 'text-iron hover:bg-hover hover:text-zinc-muted'
            }`}
            title={isRecording ? 'Detener grabacion' : 'Adjuntar audio'}
          >
            {isRecording ? (
              <span className="relative flex size-2.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex size-2.5 rounded-full bg-red-500" />
              </span>
            ) : (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            )}
          </button>

          <form onSubmit={handleSubmit} className="flex flex-1 items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={disabled}
              placeholder={
                isRecording
                  ? 'Grabando...'
                  : disabled
                    ? 'NORA esta escribiendo...'
                    : 'Escribi un mensaje...'
              }
              className="h-9 flex-1 rounded-xl border border-border bg-elevated px-4 text-[0.9375rem] text-steel outline-none transition-colors placeholder:text-iron focus:border-emerald/50 disabled:opacity-50"
            />

            <button
              type="submit"
              disabled={
                disabled ||
                isUploading ||
                images.some((img) => img.publicUrl === null) ||
                (!text.trim() && images.filter((img) => img.publicUrl !== null).length === 0 && !audioUrl)
              }
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald text-[#09090b] transition-all hover:bg-emerald-depth active:scale-95 disabled:bg-iron disabled:text-surface"
              title="Enviar"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          </form>
        </div>
      </div>
    </footer>
  );
}
