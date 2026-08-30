from app.models.content import RawContent
from app.services.source_integrity import (
    SourceIntegrityService,
    _ExtractedClaim,
)


def _filler(paragraphs: int, marker: str, start_page: int = 1) -> str:
    paras = [marker]

    for i in range(paragraphs):
        words = " ".join(f"filler{j}" for j in range(60))
        paras.append(
            f"[Page {start_page + i}]\nFiller paragraph {i}. {words}"
        )

    return "\n\n".join(paras)


def test_large_source_is_chunked_and_conflicts_keep_pages():
    # Build a 2-part conflict far apart in the document: one chunk says
    # 2022, another says 2023. Filler keeps them in separate chunks.
    beginning = _filler(250, "The incident occurred in 2022.", start_page=1)
    ending = _filler(250, "The incident occurred in 2023.", start_page=251)
    text = beginning + "\n\n" + ending

    source = RawContent(
        source_id="conflict-doc",
        source_type="pdf",
        title="Conflict Doc",
        text=text,
    )

    service = SourceIntegrityService(api_key="dummy", model="x")

    def fake_extract_claims(src: RawContent) -> list[_ExtractedClaim]:
        if "2022" in src.text:
            year = "2022"
        elif "2023" in src.text:
            year = "2023"
        else:
            return []

        page = src.metadata.get("page")

        return [
            _ExtractedClaim(
                claim_key="incident_year",
                subject="incident",
                predicate="occurred_in",
                value=year,
                unit="year",
                time="",
                location="",
                scope="",
                supporting_excerpt=f"The incident occurred in {year}.",
                source_reference=f"page {page}",
            )
        ]

    service._extract_claims = fake_extract_claims  # type: ignore[assignment]

    result = service.analyze([source])

    # Both conflicting values were extracted from the document.
    values = {claim.value for claim in result.claims}
    assert "2022" in values
    assert "2023" in values

    # Every claim carries page-level evidence (no silent loss).
    assert all(
        claim.evidence[0].page is not None
        for claim in result.claims
    )

    # Conflicting values for the same claim key must be surfaced,
    # not silently merged into one value.
    assert len(result.conflicts) >= 1
    conflict = result.conflicts[0]
    assert conflict.status == "unresolved"
    assert len(conflict.claim_ids) >= 2
