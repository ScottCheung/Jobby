"""Low-cost media normalization shared by all upload endpoints."""

from __future__ import annotations

from io import BytesIO

from PIL import Image, ImageOps, UnidentifiedImageError


class MediaError(ValueError):
    pass


def optimize_image_to_webp(content: bytes, max_edge: int, quality: int) -> bytes:
    """Create a compact, center-cropped 16:9 WebP cover image."""
    try:
        with Image.open(BytesIO(content)) as source:
            # Animated GIFs intentionally become a lightweight first-frame cover.
            source.seek(0)
            image = ImageOps.exif_transpose(source).convert("RGB")
            target_width = min(max_edge, image.width)
            target_height = max(1, round(target_width * 9 / 16))
            image = ImageOps.fit(
                image,
                (target_width, target_height),
                method=Image.Resampling.LANCZOS,
                centering=(0.5, 0.5),
            )
            output = BytesIO()
            image.save(output, format="WEBP", quality=quality, method=6)
            return output.getvalue()
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        raise MediaError("Could not process this image") from exc


def optimize_avatar_to_webp(content: bytes, max_edge: int = 256, quality: int = 65) -> bytes:
    """Create a compact square WebP avatar at its rendered display density."""
    try:
        with Image.open(BytesIO(content)) as source:
            source.seek(0)
            image = ImageOps.exif_transpose(source).convert("RGB")
            edge = min(max_edge, image.width, image.height)
            image = ImageOps.fit(
                image,
                (edge, edge),
                method=Image.Resampling.LANCZOS,
                centering=(0.5, 0.5),
            )
            output = BytesIO()
            image.save(output, format="WEBP", quality=quality, method=6)
            return output.getvalue()
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        raise MediaError("Could not process this image") from exc
