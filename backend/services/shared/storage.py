"""Provider-neutral object storage for user-uploaded assets."""

from __future__ import annotations

from functools import lru_cache
from urllib.parse import quote

import boto3
import httpx

from services.shared.settings import AppSettings, get_settings


class StorageError(RuntimeError):
    pass


class ObjectStorage:
    def upload(self, key: str, content: bytes, content_type: str) -> str:
        raise NotImplementedError

    def delete(self, key: str) -> None:
        raise NotImplementedError


class S3ObjectStorage(ObjectStorage):
    """Works with MinIO, AWS S3, Cloudflare R2, and other S3-compatible hosts."""

    def __init__(self, settings: AppSettings):
        if not settings.storage_s3_endpoint:
            raise StorageError("STORAGE_S3_ENDPOINT is required for the s3 storage provider")
        if not settings.storage_s3_access_key_id or not settings.storage_s3_secret_access_key:
            raise StorageError("S3 credentials are required for the s3 storage provider")
        self.settings = settings
        self.client = boto3.client(
            "s3",
            endpoint_url=settings.storage_s3_endpoint,
            region_name=settings.storage_s3_region,
            aws_access_key_id=settings.storage_s3_access_key_id,
            aws_secret_access_key=settings.storage_s3_secret_access_key,
        )

    def upload(self, key: str, content: bytes, content_type: str) -> str:
        try:
            self.client.put_object(
                Bucket=self.settings.storage_bucket,
                Key=key,
                Body=content,
                ContentType=content_type,
                CacheControl="public, max-age=31536000, immutable",
            )
        except Exception as exc:
            raise StorageError("Could not upload file to object storage") from exc
        return self.public_url(key)

    def delete(self, key: str) -> None:
        try:
            self.client.delete_object(Bucket=self.settings.storage_bucket, Key=key)
        except Exception as exc:
            raise StorageError("Could not delete file from object storage") from exc

    def public_url(self, key: str) -> str:
        base_url = (self.settings.storage_public_base_url or self.settings.storage_s3_endpoint or "").rstrip("/")
        return f"{base_url}/{self.settings.storage_bucket}/{quote(key)}"


class SupabaseObjectStorage(ObjectStorage):
    """Supabase Storage REST adapter; keeps application code independent of Supabase SDKs."""

    def __init__(self, settings: AppSettings):
        if not settings.supabase_url or not settings.supabase_service_role_key:
            raise StorageError(
                "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for the supabase storage provider"
            )
        self.settings = settings
        self.base_url = settings.supabase_url.rstrip("/")
        self.headers = {
            "Contributorization": f"Bearer {settings.supabase_service_role_key}",
            "apikey": settings.supabase_service_role_key,
        }

    def upload(self, key: str, content: bytes, content_type: str) -> str:
        url = f"{self.base_url}/storage/v1/object/{self.settings.storage_bucket}/{quote(key)}"
        try:
            response = httpx.post(
                url,
                content=content,
                headers={**self.headers, "Content-Type": content_type, "x-upsert": "true"},
                timeout=30,
            )
            response.raise_for_status()
        except httpx.HTTPError as exc:
            raise StorageError("Could not upload file to Supabase Storage") from exc
        return self.public_url(key)

    def delete(self, key: str) -> None:
        url = f"{self.base_url}/storage/v1/object/{self.settings.storage_bucket}"
        try:
            response = httpx.request(
                "DELETE", url, json={"prefixes": [key]}, headers=self.headers, timeout=30
            )
            response.raise_for_status()
        except httpx.HTTPError as exc:
            raise StorageError("Could not delete file from Supabase Storage") from exc

    def public_url(self, key: str) -> str:
        return f"{self.base_url}/storage/v1/object/public/{self.settings.storage_bucket}/{quote(key)}"


@lru_cache
def get_object_storage() -> ObjectStorage:
    settings = get_settings()
    if settings.storage_provider.lower() == "supabase":
        return SupabaseObjectStorage(settings)
    if settings.storage_provider.lower() == "s3":
        return S3ObjectStorage(settings)
    raise StorageError(f"Unsupported STORAGE_PROVIDER: {settings.storage_provider}")
