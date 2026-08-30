from app.models.content import ContentDNA, Entities
from app.services.chunked_dna import _MergeItem, _union_dna
from app.services.llm import _normalize_entity_list, normalize_content_dna_dict


def test_normalize_entity_list_deduplicates_and_trims():
    raw = [
        "  Satya Nadella  ",
        "satya nadella",
        "Satya Nadella",
        "Sundar Pichai",
        "",
        " ",
        None,
        {"name": "Sam Altman"},
        {"entity": "Demis Hassabis"},
    ]
    cleaned = _normalize_entity_list(raw)
    assert cleaned == [
        "Satya Nadella",
        "Sundar Pichai",
        "Sam Altman",
        "Demis Hassabis",
    ]


def test_normalize_content_dna_extracts_all_entity_aliases():
    llm_payload = {
        "identity": {"title": "Multi-Entity Report"},
        "overview": {"summary": "Overview of global AI developments."},
        "entities": {
            "individuals": ["Dr. Yann LeCun", "Geoffrey Hinton"],
            "companies": ["OpenAI", "Anthropic", "DeepMind"],
            "institutions": ["Stanford University", "MIT"],
            "countries": ["United States", "United Kingdom", "France"],
            "cities": ["San Francisco", "Paris", "London"],
            "tools": ["PyTorch", "TensorFlow"],
            "frameworks": ["LangChain", "FastAPI"],
            "models": ["GPT-4o", "Claude 3.5 Sonnet", "Llama 3"],
            "hardware": ["NVIDIA H100", "TPU v5p"],
        },
    }

    normalized = normalize_content_dna_dict(llm_payload)
    dna = ContentDNA.model_validate(normalized)

    # People
    assert "Dr. Yann LeCun" in dna.entities.people
    assert "Geoffrey Hinton" in dna.entities.people

    # Organizations
    assert "OpenAI" in dna.entities.organizations
    assert "Anthropic" in dna.entities.organizations
    assert "Stanford University" in dna.entities.organizations
    assert "MIT" in dna.entities.organizations

    # Locations
    assert "United States" in dna.entities.locations
    assert "France" in dna.entities.locations
    assert "San Francisco" in dna.entities.locations
    assert "Paris" in dna.entities.locations

    # Technologies
    assert "PyTorch" in dna.entities.technologies
    assert "FastAPI" in dna.entities.technologies
    assert "GPT-4o" in dna.entities.technologies
    assert "NVIDIA H100" in dna.entities.technologies


def test_normalize_content_dna_extracts_flat_entity_keys():
    llm_payload = {
        "title": "Autonomous Transport Study",
        "summary": "Study on electric vehicle adoption across Nordic regions.",
        "persons": ["Elon Musk", "Mate Rimac"],
        "government_bodies": ["Department of Transportation", "European Commission"],
        "places": ["Norway", "Oslo", "Stockholm"],
        "systems": ["Autopilot", "Full Self-Driving", "Megacharger"],
    }

    normalized = normalize_content_dna_dict(llm_payload)
    dna = ContentDNA.model_validate(normalized)

    assert "Elon Musk" in dna.entities.people
    assert "Mate Rimac" in dna.entities.people
    assert "Department of Transportation" in dna.entities.organizations
    assert "European Commission" in dna.entities.organizations
    assert "Norway" in dna.entities.locations
    assert "Stockholm" in dna.entities.locations
    assert "Autopilot" in dna.entities.technologies
    assert "Megacharger" in dna.entities.technologies


def test_union_dna_preserves_all_entities_across_chunks():
    base = ContentDNA(
        entities=Entities(
            people=["Person A"],
            organizations=["Org A"],
            locations=["Location A"],
            technologies=["Tech A"],
        )
    )

    item1 = _MergeItem(
        dna=ContentDNA(
            entities=Entities(
                people=["Person B"],
                organizations=["Org B"],
                locations=["Location B"],
                technologies=["Tech B"],
            )
        ),
        page_start=1,
        page_end=5,
    )

    item2 = _MergeItem(
        dna=ContentDNA(
            entities=Entities(
                people=["Person C", "person a"],
                organizations=["Org C"],
                locations=["Location C"],
                technologies=["Tech C"],
            )
        ),
        page_start=6,
        page_end=10,
    )

    unioned = _union_dna(base, [item1, item2])

    assert set(unioned.entities.people) == {"Person A", "Person B", "Person C"}
    assert set(unioned.entities.organizations) == {"Org A", "Org B", "Org C"}
    assert set(unioned.entities.locations) == {"Location A", "Location B", "Location C"}
    assert set(unioned.entities.technologies) == {"Tech A", "Tech B", "Tech C"}
