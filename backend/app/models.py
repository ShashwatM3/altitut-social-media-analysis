"""Pydantic models shared across the backend."""

from __future__ import annotations

from typing import Annotated, Any, Literal

from pydantic import BaseModel, Field

Provider = Literal["linkedin", "facebook", "instagram"]
Tone = Literal["professional", "punchy", "playful", "educational"]
Placement = Literal["feed", "reel", "story"]
PostStatus = Literal["draft", "publishing", "published", "partial", "failed", "scheduled"]
Source = Literal["seed", "competitor-scout", "telegram-bot"]
RagDocType = Literal["competitor", "content-pack", "altitut", "platform-guide"]
ScoutStepId = Literal[
    "discover",
    "website",
    "social",
    "research",
    "synthesize-identity",
    "synthesize-social",
    "synthesize-verdict",
    "save",
]
AutoPostStepId = Literal["validate", "publish", "poll", "save", "delete"]


class ParagraphBlock(BaseModel):
    type: Literal["paragraph"] = "paragraph"
    text: str


class BulletsBlock(BaseModel):
    type: Literal["bullets"] = "bullets"
    items: list[str]


class LabeledBlock(BaseModel):
    type: Literal["labeled"] = "labeled"
    label: str
    items: list[str]


ContentBlock = Annotated[
    ParagraphBlock | BulletsBlock | LabeledBlock,
    Field(discriminator="type"),
]


class PackEntry(BaseModel):
    label: str
    blocks: list[ContentBlock] | None = None
    value: str | None = None  # legacy single-string entries


class PackEpisode(BaseModel):
    title: str
    entries: list[PackEntry]


class PackSection(BaseModel):
    id: str
    title: str
    entries: list[PackEntry] | None = None
    episodes: list[PackEpisode] | None = None


class PackLinks(BaseModel):
    website: str | None = None
    instagram: str | None = None
    linkedin: str | None = None
    twitter: str | None = None


class AnalysisPack(BaseModel):
    name: str
    tag: str
    meta: str
    links: PackLinks | None = None
    referenceReels: list[str] | None = None
    tldr: str | None = None
    sections: list[PackSection]


class StoredPack(AnalysisPack):
    id: str
    source: Source
    createdAt: str


class RagChunk(BaseModel):
    id: str
    docType: RagDocType
    sourceName: str
    sectionTitle: str
    entryLabel: str
    text: str
    embedding: list[float]


class RetrievedChunk(BaseModel):
    id: str
    docType: RagDocType
    sourceName: str
    sectionTitle: str
    entryLabel: str
    text: str
    score: float


class PendingChunk(BaseModel):
    id: str
    docType: RagDocType
    sourceName: str
    sectionTitle: str
    entryLabel: str
    text: str


class ScoutCandidate(BaseModel):
    name: str
    website: str
    whyChosen: str
    links: PackLinks


class ScoutState(BaseModel):
    productDescription: str
    existingNames: list[str] = Field(default_factory=list)
    candidate: ScoutCandidate | None = None
    alternates: list[dict[str, str]] | None = None
    websiteDigest: str | None = None
    socialDigest: str | None = None
    researchDigest: str | None = None
    sections: list[PackSection] | None = None
    tldr: str | None = None
    tag: str | None = None
    meta: str | None = None


class ReelMusicInfo(BaseModel):
    artist: str
    song: str
    usesOriginalAudio: bool | None = None


class ReelData(BaseModel):
    url: str
    caption: str = ""
    hashtags: list[str] = Field(default_factory=list)
    ownerUsername: str = ""
    ownerFullName: str = ""
    likes: int | None = None
    comments: int | None = None
    videoViews: int | None = None
    videoDurationSeconds: float | None = None
    timestamp: str | None = None
    videoUrl: str | None = None
    displayUrl: str | None = None
    images: list[str] = Field(default_factory=list)
    musicInfo: ReelMusicInfo | None = None
    productType: str = ""


class ReelAnalysis(BaseModel):
    section: PackSection
    observedFacts: str


class PlatformCaption(BaseModel):
    caption: str = ""
    firstComment: str = ""
    hashtags: list[str] = Field(default_factory=list)


class CaptionRequest(BaseModel):
    platforms: list[Provider]
    mediaKind: Literal["video", "image"] = "video"
    brief: str = ""
    tone: Tone = "professional"
    mode: Literal["generate", "refine", "shorten"] = "generate"
    existingCopy: dict[Provider, str] | None = None
    packContext: str | None = None


class CaptionResponse(BaseModel):
    captions: dict[Provider, PlatformCaption] = Field(
        default_factory=lambda: {
            "linkedin": PlatformCaption(),
            "facebook": PlatformCaption(),
            "instagram": PlatformCaption(),
        }
    )


class MediaItemInfo(BaseModel):
    url: str
    path: str
    width: int | None = None
    height: int | None = None
    bytes: int


class MediaInfo(BaseModel):
    kind: Literal["video", "image", "none"]
    urls: list[str]
    storagePaths: list[str]
    width: int | None = None
    height: int | None = None
    durationSec: float | None = None
    bytes: int | None = None
    items: list[MediaItemInfo] | None = None


class AutopostTarget(BaseModel):
    platform: Provider
    placement: Placement
    visibility: str | None = None
    pageId: str | None = None
    postToProfile: bool = False
    collaborators: list[str] | None = None
    locationId: str | None = None


class UploadPostResult(BaseModel):
    platform: Provider
    status: Literal["pending", "success", "failed", "skipped"]
    postUrl: str | None = None
    platformPostId: str | None = None
    error: str | None = None


class AutopostState(BaseModel):
    postId: str
    status: PostStatus | None = None
    media: MediaInfo
    brief: str | None = None
    copy: dict[Provider, PlatformCaption] = Field(default_factory=dict)
    targets: list[AutopostTarget]
    scheduledFor: str | None = None
    timezone: str | None = None
    vendorRequestId: str | None = None
    jobId: str | None = None
    results: list[UploadPostResult] | None = None
    warnings: list[str] | None = None
    done: bool = False
    availablePages: list[dict[str, str]] | None = None


class SocialPost(BaseModel):
    id: str
    createdAt: str
    status: PostStatus
    warnings: list[str] | None = None
    media: MediaInfo
    brief: str | None = None
    copy: dict[Provider, PlatformCaption]
    targets: list[AutopostTarget]
    scheduledFor: str | None = None
    timezone: str | None = None
    vendor: Literal["upload_post"] = "upload_post"
    vendorRequestId: str | None = None
    jobId: str | None = None
    results: list[UploadPostResult]


class SocialAccount(BaseModel):
    provider: Provider
    vendor: Literal["upload_post"] = "upload_post"
    uploadPostProfile: str
    displayName: str
    status: Literal["active", "needs_reauth"]
    linkedinPageId: str | None = None
    facebookPageId: str | None = None
    instagramUserId: str | None = None
    connectedAt: str
    updatedAt: str


class TelegramUpdate(BaseModel):
    update_id: int | None = None
    message: dict[str, Any] | None = None


class ChatMessagePart(BaseModel):
    type: Literal["text"]
    text: str


class ChatMessage(BaseModel):
    role: Literal["user", "assistant", "system"]
    parts: list[ChatMessagePart]


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
