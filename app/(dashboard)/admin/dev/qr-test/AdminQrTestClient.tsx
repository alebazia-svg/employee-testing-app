'use client';

import jsQR from 'jsqr';
import { AlertTriangle, Camera, CheckCircle2, RefreshCw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Card } from '@/components/ui/card';

type CameraState = 'idle' | 'starting' | 'scanning' | 'found' | 'error';

function explainCameraError(error: unknown) {
  if (!(error instanceof DOMException)) return 'Не удалось открыть камеру. Попробуйте обновить страницу и разрешить доступ к камере.';
  if (error.name === 'NotAllowedError' || error.name === 'SecurityError') return 'Доступ к камере запрещён. Разрешите камеру для portal.alebazia.xyz.';
  if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') return 'Камера не найдена на этом устройстве.';
  if (error.name === 'NotReadableError' || error.name === 'TrackStartError') return 'Камера занята другим приложением или недоступна.';
  if (error.name === 'OverconstrainedError') return 'Не удалось выбрать заднюю камеру. Попробуйте ещё раз.';
  if (error.name === 'AbortError') return 'Запуск камеры был прерван. Попробуйте ещё раз.';
  return `Камера недоступна: ${error.name}.`;
}

export function AdminQrTestClient() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);
  const [state, setState] = useState<CameraState>('idle');
  const [result, setResult] = useState('');
  const [error, setError] = useState('');

  function stopCamera() {
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }

  function scanFrame() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < HTMLMediaElement.HAVE_ENOUGH_DATA) {
      frameRef.current = window.requestAnimationFrame(scanFrame);
      return;
    }

    const width = video.videoWidth;
    const height = video.videoHeight;
    if (!width || !height) {
      frameRef.current = window.requestAnimationFrame(scanFrame);
      return;
    }

    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) {
      setError('Не удалось подготовить изображение с камеры.');
      setState('error');
      stopCamera();
      return;
    }

    context.drawImage(video, 0, 0, width, height);
    const imageData = context.getImageData(0, 0, width, height);
    const code = jsQR(imageData.data, width, height, { inversionAttempts: 'attemptBoth' });

    if (code?.data) {
      setResult(code.data);
      setState('found');
      stopCamera();
      return;
    }

    frameRef.current = window.requestAnimationFrame(scanFrame);
  }

  async function startCamera() {
    setError('');
    setResult('');
    setState('starting');
    stopCamera();
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new DOMException('getUserMedia is not available', 'NotSupportedError');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (!videoRef.current) return;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setState('scanning');
      frameRef.current = window.requestAnimationFrame(scanFrame);
    } catch (reason) {
      stopCamera();
      setError(explainCameraError(reason));
      setState('error');
    }
  }

  useEffect(() => {
    return () => stopCamera();
  }, []);

  const isActive = state === 'starting' || state === 'scanning';

  return (
    <div className='grid gap-5'>
      <div>
        <p className='text-sm font-bold uppercase tracking-wide text-green-700'>Dev diagnostic</p>
        <h1 className='mt-1 text-3xl font-black text-slate-950'>QR camera test</h1>
        <p className='mt-2 max-w-2xl text-sm font-semibold text-slate-600'>
          Проверяет только камеру и распознавание QR. Не запускает рабочий день и не записывает данные.
        </p>
      </div>

      <Card className='max-w-md overflow-hidden p-4'>
        <div className='relative aspect-[3/4] overflow-hidden rounded-2xl bg-slate-950'>
          <video ref={videoRef} className='h-full w-full object-cover' muted playsInline autoPlay />
          {!isActive && (
            <div className='absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center text-white'>
              <Camera className='h-12 w-12 text-green-300' />
              <p className='text-xl font-black'>Проверка камеры</p>
              <p className='text-sm font-semibold text-slate-300'>Наведите камеру на любой QR-код.</p>
            </div>
          )}
          {isActive && (
            <div className='pointer-events-none absolute inset-0 flex items-center justify-center'>
              <div className='h-56 w-56 rounded-3xl border-4 border-green-300 shadow-[0_0_0_999px_rgba(2,6,23,0.35)]' />
            </div>
          )}
        </div>
        <canvas ref={canvasRef} className='hidden' />

        <button
          type='button'
          onClick={startCamera}
          disabled={state === 'starting'}
          className='mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-green-600 px-4 text-sm font-black text-white disabled:cursor-wait disabled:bg-slate-500'
        >
          {state === 'starting' ? <RefreshCw className='h-4 w-4 animate-spin' /> : <Camera className='h-4 w-4' />}
          {state === 'starting' ? 'Открываю камеру' : state === 'scanning' ? 'Сканирую' : 'Начать тест'}
        </button>
      </Card>

      {result && (
        <Card className='max-w-md border-green-200 bg-green-50 p-4'>
          <div className='flex items-start gap-3'>
            <CheckCircle2 className='mt-0.5 h-5 w-5 shrink-0 text-green-700' />
            <div>
              <p className='text-sm font-black text-green-900'>QR считан</p>
              <p className='mt-2 break-words rounded-lg bg-white p-3 font-mono text-sm text-slate-950 ring-1 ring-green-100'>{result}</p>
            </div>
          </div>
        </Card>
      )}

      {error && (
        <Card className='max-w-md border-amber-200 bg-amber-50 p-4'>
          <div className='flex items-start gap-3'>
            <AlertTriangle className='mt-0.5 h-5 w-5 shrink-0 text-amber-700' />
            <p className='text-sm font-bold text-amber-900'>{error}</p>
          </div>
        </Card>
      )}
    </div>
  );
}
