import { useState } from 'react';
import { Message } from '../../types/chat';

interface MessageBubbleProps {
  readonly message: Message;
}

const PAUSE_SVG = (
  <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
  </svg>
);

const PLAY_SVG = (
  <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
    <path d="M8 5v14l11-7z" />
  </svg>
);

function AudioPlayer({ url }: { url: string }) {
  const [playing, setPlaying] = useState(false);
  const audioRef = useState(() => new Audio(url))[0];

  const togglePlay = () => {
    if (playing) {
      audioRef.pause();
      audioRef.currentTime = 0;
    } else {
      audioRef.play();
    }
    setPlaying(!playing);
  };

  return (
    <div className="flex items-center gap-2 rounded-lg bg-slate-100 px-2 py-1">
      <button
        type="button"
        onClick={togglePlay}
        className="flex size-6 items-center justify-center rounded-full bg-emerald text-[#09090b]"
      >
        {playing ? PAUSE_SVG : PLAY_SVG}
      </button>
      <span className="text-xs text-steel">{playing ? 'Reproduciendo...' : 'Mensaje de voz'}</span>
    </div>
  );
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.sender === 'user';
  const hasImages = message.imageUrls && message.imageUrls.length > 0;
  const hasAudio = !!message.audioUrl;

  const hasMedia = hasImages || hasAudio;

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className="flex max-w-[70%] flex-col">
        <div
          className={`overflow-hidden rounded-[20px] px-4 py-2.5 text-sm leading-relaxed ${
            isUser
              ? 'rounded-br-[6px] bg-emerald text-[#09090b]'
              : 'rounded-bl-[6px] border border-border bg-elevated text-steel'
          }`}
        >
          {hasMedia && (
            <div className={`mb-2 flex flex-col gap-2 ${!isUser && 'pt-0'}`}>
              {hasImages && (
                <div
                  className={`grid gap-1 ${
                    message.imageUrls!.length === 1
                      ? 'grid-cols-1'
                      : 'grid-cols-2'
                  }`}
                >
                  {message.imageUrls!.map((url, i) => (
                    <img
                      key={i}
                      src={url}
                      alt={`adjunto-${i + 1}`}
                      className="w-full rounded-lg object-cover"
                      style={{ maxHeight: '160px' }}
                    />
                  ))}
                </div>
              )}
              {hasAudio && <AudioPlayer url={message.audioUrl!} />}
            </div>
          )}
          {message.text}
        </div>
        <span
          className={`mt-1 font-mono text-[0.6875rem] text-zinc-muted ${
            isUser ? 'text-right' : 'text-left'
          }`}
        >
          {message.timestamp}
        </span>
      </div>
    </div>
  );
}
