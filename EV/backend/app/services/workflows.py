from pathlib import Path
import json

from app.models.transformation import WorkflowTemplate


WORKFLOW_STORAGE = Path("data/workflows.json")


# ============================================================
# BUILT-IN WORKFLOW TEMPLATES
# ============================================================

WORKFLOW_TEMPLATES = [
    WorkflowTemplate(
        id="public_announcement",
        name="Public Announcement",
        description=(
            "Create public-facing communication assets for "
            "announcing important information or achievements."
        ),
        output_types=[
            "linkedin",
            "twitter",
            "video",
            "infographic",
        ],
        generation_config={
            "audience": "General Public",
            "tone": "Professional",
            "language": "English",
            "detail": "Balanced",
            "objective": "Announce",
            "style": "Social Media",
        },
    ),

    WorkflowTemplate(
        id="executive_briefing",
        name="Executive Briefing",
        description=(
            "Create concise, decision-oriented communication "
            "for executive stakeholders."
        ),
        output_types=[
            "executive_summary",
            "presentation",
            "advisory",
        ],
        generation_config={
            "audience": "Executives",
            "tone": "Professional",
            "language": "English",
            "detail": "Concise",
            "objective": "Inform",
            "style": "Corporate",
        },
    ),

    WorkflowTemplate(
        id="government_communication",
        name="Government Communication",
        description=(
            "Create formal communication suitable for government "
            "officials and institutional stakeholders."
        ),
        output_types=[
            "executive_summary",
            "advisory",
            "presentation",
            "infographic",
        ],
        generation_config={
            "audience": "Government Officials",
            "tone": "Formal",
            "language": "English",
            "detail": "Detailed",
            "objective": "Inform",
            "style": "Government",
        },
    ),

    WorkflowTemplate(
        id="social_media_campaign",
        name="Social Media Campaign",
        description=(
            "Create a coordinated public communication package "
            "across social platforms and video."
        ),
        output_types=[
            "linkedin",
            "twitter",
            "video",
            "infographic",
        ],
        generation_config={
            "audience": "General Public",
            "tone": "Persuasive",
            "language": "English",
            "detail": "Balanced",
            "objective": "Announce",
            "style": "Social Media",
        },
    ),
]


# ============================================================
# CUSTOM WORKFLOW STORAGE
# ============================================================

def _load_custom_workflows() -> list[WorkflowTemplate]:
    """
    Load saved operator-created workflows from local JSON storage.

    Built-in workflows are kept in code.
    Custom workflows are persisted separately in data/workflows.json.
    """

    if not WORKFLOW_STORAGE.exists():
        return []

    try:
        raw = json.loads(
            WORKFLOW_STORAGE.read_text(
                encoding="utf-8",
            )
        )

        if not isinstance(raw, list):
            return []

        workflows: list[WorkflowTemplate] = []

        for item in raw:
            try:
                workflows.append(
                    WorkflowTemplate.model_validate(item)
                )
            except Exception:
                # Ignore malformed individual workflow records
                # instead of breaking the entire application.
                continue

        return workflows

    except (OSError, json.JSONDecodeError):
        return []


def _save_custom_workflows(
    workflows: list[WorkflowTemplate],
) -> None:
    """
    Persist custom workflows to local JSON storage.
    """

    WORKFLOW_STORAGE.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    WORKFLOW_STORAGE.write_text(
        json.dumps(
            [
                workflow.model_dump()
                for workflow in workflows
            ],
            indent=2,
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )


# ============================================================
# PUBLIC WORKFLOW API
# ============================================================

def get_workflow_templates() -> list[WorkflowTemplate]:
    """
    Return all available workflows.

    Built-in workflows are always available.
    Custom workflows are loaded from persistent storage.
    """

    custom_workflows = _load_custom_workflows()

    # Built-ins first, then operator-created workflows.
    return [
        *WORKFLOW_TEMPLATES,
        *custom_workflows,
    ]


def save_custom_workflow(
    workflow: WorkflowTemplate,
) -> WorkflowTemplate:
    """
    Create or update an operator-created workflow.

    A workflow with the same ID is replaced rather than duplicated.
    """

    existing = _load_custom_workflows()

    # Remove any existing workflow with the same ID.
    existing = [
        item
        for item in existing
        if item.id != workflow.id
    ]

    existing.append(workflow)

    _save_custom_workflows(existing)

    return workflow