"""
Conversation CRUD routes.

  POST   /conversations              → create
  GET    /conversations              → list
  GET    /conversations/{id}         → get detail
  DELETE /conversations/{id}         → delete
"""
from __future__ import annotations
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from src.utils.auth import TokenPayload, verify_token
from src.memory.db_store import (
    create_conversation,
    list_conversations,
    get_conversation,
    delete_conversation,
    update_conversation,
)

router = APIRouter()


# ── Request / Response models ────────────────────────────────────────────────

class CreateConversationRequest(BaseModel):
    title: Optional[str] = "New Chat"
    language: Optional[str] = "en"


class UpdateConversationRequest(BaseModel):
    title: Optional[str] = None
    language: Optional[str] = None


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.post("")
async def create_conversation_endpoint(
    body: CreateConversationRequest,
    user: TokenPayload = Depends(verify_token),
):
    conv = create_conversation(
        user_id=user.sub,
        title=body.title or "New Chat",
        language=body.language or "en",
    )
    return {"success": True, "conversation": conv}


@router.get("")
async def list_conversations_endpoint(
    limit: int = 20,
    user: TokenPayload = Depends(verify_token),
):
    conversations = list_conversations(user_id=user.sub, limit=limit)
    return {"success": True, "conversations": conversations}


@router.get("/{conversation_id}")
async def get_conversation_endpoint(
    conversation_id: str,
    user: TokenPayload = Depends(verify_token),
):
    conv = get_conversation(conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if conv.get("userId") != user.sub:
        raise HTTPException(status_code=403, detail="Not your conversation")
    return {"success": True, "conversation": conv}


@router.patch("/{conversation_id}")
async def update_conversation_endpoint(
    conversation_id: str,
    body: UpdateConversationRequest,
    user: TokenPayload = Depends(verify_token),
):
    conv = get_conversation(conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if conv.get("userId") != user.sub:
        raise HTTPException(status_code=403, detail="Not your conversation")

    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if updates:
        update_conversation(conversation_id, **updates)

    return {"success": True}


@router.delete("/{conversation_id}")
async def delete_conversation_endpoint(
    conversation_id: str,
    user: TokenPayload = Depends(verify_token),
):
    conv = get_conversation(conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if conv.get("userId") != user.sub:
        raise HTTPException(status_code=403, detail="Not your conversation")

    delete_conversation(conversation_id)
    return {"success": True}
