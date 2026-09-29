import { useEffect, useRef, useState } from "react";
import { Camera, RotateCcw } from "lucide-react";

interface PunchCameraProps {
  photoBase64: string | null;
  onCapture: (base64: string) => void;
  onRetake: () => void;
}

// Câmera frontal apenas para evidência da marcação. Não faz reconhecimento facial.
export function PunchCamera({ photoBase64, onCapture, onRetake }: PunchCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  useEffect(() => {
    if (photoBase64) return;

    let cancelled = false;

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "user" }, audio: false })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch(() => setCameraError("Câmera indisponível"));

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [photoBase64]);

  function capture() {
    const video = videoRef.current;
    if (!video) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    onCapture(dataUrl.split(",")[1]);
  }

  if (photoBase64) {
    return (
      <div className="flex flex-col items-center gap-4">
        <img
          src={`data:image/jpeg;base64,${photoBase64}`}
          alt="Foto capturada da marcação"
          className="h-64 w-64 rounded-2xl object-cover shadow-sm"
        />
        <button
          type="button"
          onClick={onRetake}
          className="flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-medium text-[#26313D] shadow-sm active:scale-95"
        >
          <RotateCcw size={16} />
          Refazer
        </button>
      </div>
    );
  }

  if (cameraError) {
    return <p className="text-sm text-[#D84B4B]">{cameraError}</p>;
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="h-64 w-64 rounded-2xl object-cover [transform:scaleX(-1)]"
      />
      <button
        type="button"
        onClick={capture}
        className="flex items-center gap-2 rounded-full bg-[#315F93] px-6 py-3 text-sm font-medium text-white shadow-sm active:scale-95"
      >
        <Camera size={18} />
        Tirar foto
      </button>
    </div>
  );
}
