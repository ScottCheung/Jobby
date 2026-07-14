/** @format */

import React, { useEffect, useRef } from 'react';

interface AudioVisualizerProps {
  stream: MediaStream | null;
  isRecording: boolean;
}

export function AudioVisualizer({ stream, isRecording }: AudioVisualizerProps) {
  const glowCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const coreCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const volumeRef = useRef<number>(0);
  const rippleRef = useRef<number>(0);

  useEffect(() => {
    if (!isRecording || !stream) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      if (sourceRef.current) {
        sourceRef.current.disconnect();
        sourceRef.current = null;
      }
      if (analyserRef.current) {
        analyserRef.current.disconnect();
        analyserRef.current = null;
      }
      if (
        audioContextRef.current &&
        audioContextRef.current.state !== 'closed'
      ) {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
      return;
    }

    try {
      const AudioCtx =
        window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      const audioCtx = new AudioCtx();
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      audioContextRef.current = audioCtx;
      analyserRef.current = analyser;
      sourceRef.current = source;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const reduceMotion =
        window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      const colors = ['#4285F4', '#9B72CB', '#D96570', '#34A853'];
      let phase = 0;

      // Build a smooth organic "blob" outline using layered sine harmonics,
      // then stitch it with quadratic curves (classic smooth-blob technique)
      const buildBlobPoints = (
        cx: number,
        cy: number,
        baseRadius: number,
        vol: number,
      ) => {
        const N = 48;
        const pts: { x: number; y: number }[] = [];
        const wobbleAmp = reduceMotion ? 3 : 6 + vol * 100;
        const breathe = reduceMotion ? 0 : Math.sin(phase * 0.8) * 2;

        for (let i = 0; i < N; i++) {
          const a = (i / N) * Math.PI * 2;
          const noise =
            Math.sin(a * 3 + phase * 1.3) * 0.5 +
            Math.sin(a * 5 - phase * 0.8) * 0.3 +
            Math.cos(a * 2 + phase * 0.5) * 0.2;
          const r = baseRadius + noise * wobbleAmp + breathe;
          pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
        }
        return pts;
      };

      const drawBlobPath = (
        ctx: CanvasRenderingContext2D,
        pts: { x: number; y: number }[],
      ) => {
        ctx.beginPath();
        const n = pts.length;
        for (let i = 0; i < n; i++) {
          const p1 = pts[i];
          const p2 = pts[(i + 1) % n];
          const mx = (p1.x + p2.x) / 2;
          const my = (p1.y + p2.y) / 2;
          if (i === 0) {
            const prev = pts[n - 1];
            ctx.moveTo((prev.x + p1.x) / 2, (prev.y + p1.y) / 2);
          }
          ctx.quadraticCurveTo(p1.x, p1.y, mx, my);
        }
        ctx.closePath();
      };

      const setupCanvas = (canvas: HTMLCanvasElement, dpr: number) => {
        const rect = canvas.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;
        if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
          canvas.width = width * dpr;
          canvas.height = height * dpr;
        }
        return { width, height };
      };

      const draw = () => {
        const glowCanvas = glowCanvasRef.current;
        const coreCanvas = coreCanvasRef.current;
        if (!glowCanvas || !coreCanvas) return;

        const glowCtx = glowCanvas.getContext('2d');
        const coreCtx = coreCanvas.getContext('2d');
        if (!glowCtx || !coreCtx) return;

        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const { width, height } = setupCanvas(glowCanvas, dpr);
        setupCanvas(coreCanvas, dpr);

        // Volume via RMS of time-domain signal
        let sum = 0;
        if (analyserRef.current) {
          analyserRef.current.getByteTimeDomainData(dataArray);
          for (let i = 0; i < bufferLength; i++) {
            const v = (dataArray[i] - 128) / 128;
            sum += v * v;
          }
        }
        const rms = Math.sqrt(sum / bufferLength);
        volumeRef.current = volumeRef.current * 0.8 + rms * 0.2;
        const vol = Math.min(volumeRef.current * 3.2, 1);

        phase += 0.018;
        rippleRef.current += 0.006 + vol * 0.2;
        if (rippleRef.current > 1) rippleRef.current = 0;

        const cx = width / 2;
        const cy = height / 2;
        const baseRadius = Math.min(width, height) * 0.22 + vol * 10;

        [glowCtx, coreCtx].forEach((ctx, layer) => {
          ctx.save();
          ctx.scale(dpr, dpr);
          ctx.clearRect(0, 0, width, height);

          // Soft ripple ring — only visible while actually speaking
          if (vol > 0.03) {
            const ringR = baseRadius + rippleRef.current * (baseRadius * 1.3);
            ctx.beginPath();
            ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
            ctx.strokeStyle = colors[1];
            ctx.lineWidth = 1.5;
            ctx.globalAlpha = (1 - rippleRef.current) * 0.35 * vol;
            ctx.stroke();
          }

          // Rotating conic gradient (falls back to a rotated linear blend)
          let gradient: CanvasGradient;
          if (typeof (ctx as any).createConicGradient === 'function') {
            gradient = (ctx as any).createConicGradient(phase * 0.8, cx, cy);
          } else {
            gradient = ctx.createLinearGradient(
              cx - baseRadius,
              cy,
              cx + baseRadius,
              cy,
            );
          }
          colors.forEach((c, i) => gradient.addColorStop(i / colors.length, c));
          gradient.addColorStop(1, colors[0]);

          // Glow layer: slightly larger blob, blurred via CSS filter (cheap)
          // Core layer: tighter blob + crisp rim for definition
          const radius = layer === 0 ? baseRadius : baseRadius * 0.5;
          const pts = buildBlobPoints(cx, cy, radius, vol);
          drawBlobPath(ctx, pts);
          ctx.fillStyle = gradient;
          ctx.globalAlpha = layer === 0 ? 0.4 : 0.92;
          ctx.fill();

          if (layer === 1) {
            ctx.lineWidth = 1;
            ctx.strokeStyle = 'rgba(255,255,255,0.2)';
            ctx.globalAlpha = 0.5;
            ctx.stroke();
          }

          ctx.restore();
        });

        animationRef.current = requestAnimationFrame(draw);
      };

      draw();
    } catch (err) {
      console.error('Visualizer initialization failed:', err);
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (sourceRef.current) {
        sourceRef.current.disconnect();
      }
      if (analyserRef.current) {
        analyserRef.current.disconnect();
      }
      if (
        audioContextRef.current &&
        audioContextRef.current.state !== 'closed'
      ) {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, [stream, isRecording]);

  return (
    <div className='w-full flex justify-center items-center h-[1000px] mt-[-400px] mb-[-400px] relative '>
      <canvas
        ref={glowCanvasRef}
        className='absolute inset-0 w-full h-full bg-transparent'
        style={{ filter: 'blur(50px)' }}
      />

      <canvas
        ref={coreCanvasRef}
        style={{ filter: 'blur(20px)' }}
        className='absolute inset-0 w-full h-full bg-transparent'
      />
    </div>
  );
}
