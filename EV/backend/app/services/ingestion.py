from io import BytesIO
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen

from pypdf import PdfReader

from app.models.content import RawContent


class IngestionError(ValueError):
    pass


class TextIngestionProvider:
    source_type = "text"

    def ingest(self, source_id: str, title: str, text: str) -> RawContent:
        normalized_text = text.strip()
        if not normalized_text:
            raise IngestionError("Source text cannot be empty")
        return RawContent(
            source_id=source_id,
            source_type=self.source_type,
            title=title.strip() or "Untitled source",
            text=normalized_text,
        )


class TXTIngestionProvider:
    source_type = "txt"

    def ingest(self, source_id: str, filename: str, content: bytes) -> RawContent:
        try:
            text = content.decode("utf-8-sig")
        except UnicodeDecodeError as exc:
            raise IngestionError("TXT files must be valid UTF-8 text") from exc
        return TextIngestionProvider().ingest(source_id, Path(filename).stem, text).model_copy(
            update={"source_type": self.source_type, "metadata": {"filename": filename}}
        )


class PDFIngestionProvider:
    source_type = "pdf"

    def ingest(self, source_id: str, filename: str, content: bytes) -> RawContent:
        try:
            reader = PdfReader(BytesIO(content))
            pages = [page.extract_text() or "" for page in reader.pages]
        except Exception as exc:
            raise IngestionError("Unable to read the PDF file") from exc

        text = "\n\n".join(
            f"[Page {page_number}]\n{page_text.strip()}"
            for page_number, page_text in enumerate(pages, start=1)
            if page_text.strip()
        )
        if not text.strip():
            raise IngestionError("The PDF does not contain extractable text")
        return RawContent(
            source_id=source_id,
            source_type=self.source_type,
            title=Path(filename).stem or "Untitled PDF",
            text=text,
            metadata={"filename": filename, "page_count": len(pages)},
        )


class URLIngestionProvider:
    source_type = "url"

    def ingest(self, source_id: str, title: str, url: str) -> RawContent:
        parsed = urlparse(url)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            raise IngestionError("Enter a valid HTTP or HTTPS URL")
        request = Request(url, headers={"User-Agent": "EV Content Transformation/0.1"})
        try:
            with urlopen(request, timeout=10) as response:
                content_type = response.headers.get("content-type", "")
                if "text/html" not in content_type and "text/plain" not in content_type:
                    raise IngestionError("This URL does not expose readable text content")
                raw = response.read(1_000_000).decode("utf-8", errors="replace")
        except HTTPError as exc:
            raise IngestionError(f"URL could not be fetched: HTTP {exc.code}") from exc
        except URLError as exc:
            raise IngestionError("URL could not be fetched") from exc
        text = " ".join(raw.replace("<", " <").replace(">", "> ").split())
        if not text.strip():
            raise IngestionError("No readable text could be extracted from this URL")
        return RawContent(
            source_id=source_id,
            source_type=self.source_type,
            title=title.strip() or parsed.netloc,
            text=text[:100_000],
            metadata={"url": url},
        )


class UnsupportedIngestionProvider:
    def ingest(self, source_id: str, source_type: str, title: str, note: str = "") -> RawContent:
        return RawContent(
            source_id=source_id,
            source_type=source_type,
            title=title.strip() or f"Unsupported {source_type.upper()} source",
            text=(
                f"{source_type.upper()} processing is not available in this EV backend configuration. "
                "This source was recorded for provenance but was not used to generate Content DNA."
            ),
            metadata={"status": "unsupported", "note": note},
        )
