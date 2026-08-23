import json
from pathlib import Path
from threading import Lock

from pydantic import BaseModel

from app.models.content import ContentDNA, RawContent
from app.models.transformation import Transformation, utc_now


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
            return {key: Transformation.model_validate(value) for key, value in data.items()}
        except (OSError, json.JSONDecodeError, ValueError) as exc:
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
