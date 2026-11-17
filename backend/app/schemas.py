"""Pydantic V2 Schemas cho Hệ thống Thẻ Thành Viên 2 Đầu & AI Fallback."""
from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    role: Literal["system", "user", "assistant"] = "user"
    content: str


class AIChatRequest(BaseModel):
    prompt: Optional[str] = None
    messages: Optional[List[ChatMessage]] = None
    system: Optional[str] = None
    json_mode: bool = Field(default=False, alias="json")
    maxTokens: Optional[int] = None
    temperature: Optional[float] = 0.7
    providers: Optional[List[str]] = None

    model_config = {"populate_by_name": True}


class RegisterMemberRequest(BaseModel):
    name: str
    phone: str


class EarnPointsRequest(BaseModel):
    memberCode: str
    amount: float
    txCode: str
    idempotencyKey: Optional[str] = None


class RedeemRewardRequest(BaseModel):
    memberCode: str
    rewardId: str
    txCode: Optional[str] = None
    voucherId: Optional[str] = None
    idempotencyKey: Optional[str] = None


class OfflineQueueItem(BaseModel):
    reqId: str
    action: Literal["register", "earn", "redeem"]
    payload: Dict[str, Any]
    createdAt: Optional[str] = None
    optimisticPointsDelta: Optional[int] = 0


class OfflineSyncRequest(BaseModel):
    clientId: Optional[str] = "default-client"
    queue: List[OfflineQueueItem] = Field(default_factory=list)


class SimulateBankErrorRequest(BaseModel):
    memberCode: str = "KT-004"
    scenario: Literal["duplicate_tx_earn", "insufficient_balance_redeem"] = "duplicate_tx_earn"


class AIAdvisorRequest(BaseModel):
    mode: Literal["counter_member", "business_overview", "member_reward"] = "counter_member"
    memberCode: Optional[str] = None
    customQuestion: Optional[str] = None
