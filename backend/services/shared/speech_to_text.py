from __future__ import annotations

import io
import logging
import threading
from typing import Any

from services.shared.settings import get_settings

logger = logging.getLogger(__name__)


class SpeechTranscriptionError(RuntimeError):
    pass


class SpeechTranscriptionUnavailableError(SpeechTranscriptionError):
    pass


_model_lock = threading.Lock()
_cached_model: Any | None = None
_cached_model_name: str | None = None


def _load_audio_samples(content: bytes):
    try:
        import av
        import numpy as np
    except ImportError as exc:
        raise SpeechTranscriptionUnavailableError(
            "Local transcription dependencies are unavailable",
        ) from exc

    try:
        container = av.open(io.BytesIO(content))
    except Exception as exc:
        raise SpeechTranscriptionError("Could not open audio recording") from exc

    resampler = av.audio.resampler.AudioResampler(
        format="s16",
        layout="mono",
        rate=16000,
    )
    chunks: list["np.ndarray[Any, Any]"] = []

    try:
        for frame in container.decode(audio=0):
            resampled = resampler.resample(frame)
            frames = resampled if isinstance(resampled, list) else [resampled]
            for audio_frame in frames:
                if audio_frame is None:
                    continue
                chunk = audio_frame.to_ndarray()
                if chunk.size == 0:
                    continue
                mono = chunk[0] if chunk.ndim > 1 else chunk
                chunks.append(mono.astype("float32") / 32768.0)
    except Exception as exc:
        raise SpeechTranscriptionError("Could not decode audio recording") from exc
    finally:
        container.close()

    if not chunks:
        raise SpeechTranscriptionError("Audio recording did not contain usable speech")

    return np.concatenate(chunks, axis=0)


def _get_model():
    global _cached_model, _cached_model_name

    settings = get_settings()
    if not settings.speech_to_text_enabled:
        raise SpeechTranscriptionUnavailableError("Local transcription is disabled")

    with _model_lock:
        if (
            _cached_model is not None
            and _cached_model_name == settings.speech_to_text_model
        ):
            return _cached_model

        try:
            from faster_whisper import WhisperModel
        except ImportError as exc:
            raise SpeechTranscriptionUnavailableError(
                "Local transcription model is not installed",
            ) from exc

        logger.info(
            "Loading local speech model %s on %s",
            settings.speech_to_text_model,
            settings.speech_to_text_device,
        )
        _cached_model = WhisperModel(
            settings.speech_to_text_model,
            device=settings.speech_to_text_device,
            compute_type=settings.speech_to_text_compute_type,
        )
        _cached_model_name = settings.speech_to_text_model
        return _cached_model


def _round_timestamp(value: float | None) -> float:
    return round(max(0.0, float(value or 0.0)), 2)


def transcribe_audio_bytes(content: bytes) -> dict[str, Any]:
    settings = get_settings()
    model = _get_model()
    audio = _load_audio_samples(content)

    try:
        segments_iter, info = model.transcribe(
            audio,
            beam_size=settings.speech_to_text_beam_size,
            language=settings.speech_to_text_language or None,
            vad_filter=settings.speech_to_text_vad_filter,
            word_timestamps=True,
            condition_on_previous_text=False,
        )
    except Exception as exc:
        raise SpeechTranscriptionError("Local transcription failed") from exc

    segments: list[dict[str, Any]] = []
    full_text_parts: list[str] = []
    detected_language = getattr(info, "language", None)
    duration_seconds = _round_timestamp(getattr(info, "duration", 0.0))

    for segment in segments_iter:
        text = (segment.text or "").strip()
        if not text:
            continue
        words: list[dict[str, Any]] = []
        for word in getattr(segment, "words", []) or []:
            word_text = (getattr(word, "word", "") or "").strip()
            if not word_text:
                continue
            words.append(
                {
                    "text": word_text,
                    "start": _round_timestamp(getattr(word, "start", None)),
                    "end": _round_timestamp(getattr(word, "end", None)),
                }
            )

        segment_start = _round_timestamp(getattr(segment, "start", None))
        segment_end = _round_timestamp(getattr(segment, "end", None))
        if words:
            segment_start = words[0]["start"]
            segment_end = words[-1]["end"]

        segments.append(
            {
                "text": text,
                "start": segment_start,
                "end": segment_end,
                "words": words,
            }
        )
        full_text_parts.append(text)

    if not segments:
        raise SpeechTranscriptionError("Local transcription returned no speech")

    if duration_seconds <= 0:
        duration_seconds = segments[-1]["end"]

    return {
        "provider": "faster-whisper",
        "model": settings.speech_to_text_model,
        "language": detected_language,
        "duration_seconds": duration_seconds,
        "segments": segments,
        "text": " ".join(full_text_parts).strip(),
    }
