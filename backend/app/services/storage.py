import json
import logging
from pathlib import Path
from threading import Lock

from pydantic import BaseModel

from app.models.content import ContentDNA, RawContent
from app.models.transformation import Transformation, utc_now


logger = logging.getLogger(__name__)


class SourceRecord(BaseModel):
    source: RawContent
    content_dna: ContentDNA


class SourceNotFoundError(KeyError):
    pass


class TransformationNotFoundError(KeyError):
    pass


class LocalJSONStorage:
    def __init__(self, path: str) -> None:
        self.path = Path(path)
        self._lock = Lock()

    def _read(self) -> dict[str, SourceRecord]:
        if not self.path.exists():
            return {}
        try:
            data = json.loads(self.path.read_text(encoding="utf-8"))
            return {key: SourceRecord.model_validate(value) for key, value in data.items()}
        except (OSError, json.JSONDecodeError, ValueError) as exc:
            raise RuntimeError("Source storage could not be read") from exc

    def _write(self, records: dict[str, SourceRecord]) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        temporary_path = self.path.with_suffix(".tmp")
        temporary_path.write_text(
            json.dumps({key: record.model_dump(mode="json") for key, record in records.items()}, indent=2),
            encoding="utf-8",
        )
        temporary_path.replace(self.path)

    def save(self, record: SourceRecord) -> None:
        with self._lock:
            records = self._read()
            records[record.source.source_id] = record
            self._write(records)

    def get(self, source_id: str) -> SourceRecord:
        with self._lock:
            record = self._read().get(source_id)
        if record is None:
            raise SourceNotFoundError(source_id)
        return record


class LocalTransformationStorage:
    def __init__(self, path: str) -> None:
        self.path = Path(path)
        self._lock = Lock()

    def _read(self) -> dict[str, Transformation]:
        if not self.path.exists():
            return {}
        try:
            data = json.loads(self.path.read_text(encoding="utf-8"))
            if not isinstance(data, dict):
                return {}
            records: dict[str, Transformation] = {}
            for key, value in data.items():
                try:
                    records[key] = Transformation.model_validate(value)
                except Exception as val_exc:
                    logger.warning("Error validating transformation %s: %s", key, val_exc)
                    # Attempt lenient salvage for legacy claim statuses
                    try:
                        if isinstance(value, dict) and "source_integrity" in value and isinstance(value["source_integrity"], dict):
                            for claim in value["source_integrity"].get("claims", []):
                                if isinstance(claim, dict) and claim.get("status") not in {
                                    "supported", "corroborated", "conflict", "uncertain",
                                    "unresolved", "resolved", "superseded", "rejected"
                                }:
                                    claim["status"] = "supported"
                        records[key] = Transformation.model_validate(value)
                    except Exception:
                        logger.error("Failed to salvage transformation %s, skipping record", key)
            return records
        except (OSError, json.JSONDecodeError) as exc:
            raise RuntimeError("Transformation storage could not be read") from exc

    def _write(self, records: dict[str, Transformation]) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        temporary_path = self.path.with_suffix(".tmp")
        temporary_path.write_text(
            json.dumps({key: record.model_dump(mode="json") for key, record in records.items()}, indent=2),
            encoding="utf-8",
        )
        temporary_path.replace(self.path)

    def list(self) -> list[Transformation]:
        with self._lock:
            records = self._read()
        return sorted(records.values(), key=lambda item: item.updated_at, reverse=True)

    def save(self, transformation: Transformation) -> Transformation:
        stored = transformation.model_copy(update={"updated_at": utc_now()})
        with self._lock:
            records = self._read()
            records[stored.id] = stored
            self._write(records)
        return stored

    def get(self, transformation_id: str) -> Transformation:
        with self._lock:
            record = self._read().get(transformation_id)
        if record is None:
            raise TransformationNotFoundError(transformation_id)
        return record

    def delete(self, transformation_id: str) -> None:
        with self._lock:
            records = self._read()
            if transformation_id not in records:
                raise TransformationNotFoundError(transformation_id)
            del records[transformation_id]
            self._write(records)
