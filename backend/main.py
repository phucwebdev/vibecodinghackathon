"""FastAPI Server chính cho Hệ thống Thẻ Thành Viên 2 Đầu (Doanh nghiệp & Ngân hàng):
- Chạy local: cd backend && uvicorn main:app --host 0.0.0.0 --port 3001 --reload
- Chạy trực tiếp: cd backend && python main.py
- Deploy Render (Root Directory: backend): uvicorn main:app --host 0.0.0.0 --port $PORT
- Kèm Background Keep-Alive Monitor tự động ping /api/health mỗi 5 phút (300s) để giữ máy chủ Render luôn sống 24/7.
"""
from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Any, AsyncIterator, Dict

import httpx
from fastapi import FastAPI, Query, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.ai_fallback import generate_ai, get_ai_status
from app.config import SETTINGS, env_int, env_str
from app.firebase_store import FIREBASE_STORE
from app.loyalty_service import (
    advisor_insight_service,
    earn_points_service,
    get_enterprise_state,
    load_sample_service,
    reconcile_offline_queue_service,
    redeem_reward_service,
    register_member_service,
    reset_all_service,
    simulate_bank_error_service,
)
from app.schemas import (
    AIAdvisorRequest,
    AIChatRequest,
    EarnPointsRequest,
    OfflineSyncRequest,
    RedeemRewardRequest,
    RegisterMemberRequest,
    SimulateBankErrorRequest,
)

MAX_INPUT_CHARS = 40_000
KEEPALIVE_INTERVAL_SEC = env_int("KEEPALIVE_INTERVAL_SEC", 300)  # 5 phút = 300 giây

_monitor_stats: Dict[str, Any] = {
    "enabled": True,
    "intervalSec": KEEPALIVE_INTERVAL_SEC,
    "pings": 0,
    "lastPingAt": None,
    "lastStatus": None,
}


async def _keep_alive_loop() -> None:
    """Background monitor: cứ mỗi 5 phút (300s) tự động bắn request vào /api/health để giữ Render không ngủ."""
    await asyncio.sleep(5)
    while True:
        try:
            # Render tự động gắn biến môi trường RENDER_EXTERNAL_URL (VD: https://ten-service.onrender.com)
            base_url = (
                env_str("KEEPALIVE_URL")
                or env_str("RENDER_EXTERNAL_URL")
                or f"http://127.0.0.1:{SETTINGS.port}"
            ).rstrip("/")
            target = f"{base_url}/api/health"
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.get(target)
                _monitor_stats["pings"] += 1
                _monitor_stats["lastPingAt"] = datetime.now(timezone.utc).isoformat()
                _monitor_stats["lastStatus"] = res.status_code
        except asyncio.CancelledError:
            break
        except Exception:
            _monitor_stats["lastPingAt"] = datetime.now(timezone.utc).isoformat()
            _monitor_stats["lastStatus"] = "error"
        await asyncio.sleep(KEEPALIVE_INTERVAL_SEC)


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    task = asyncio.create_task(_keep_alive_loop())
    try:
        yield
    finally:
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass


app = FastAPI(
    title="Thẻ Thành Viên 2 Đầu – Enterprise FastAPI Backend",
    version="2.0.0",
    lifespan=lifespan,
    description=(
        "Backend Doanh nghiệp (FastAPI): AI Fallback (Gemini -> OpenRouter -> Gemini 2 -> Offline Rule) "
        "+ Lưu trực tiếp Firebase Firestore + Đối soát & Hoàn điểm Ngân hàng (Rollback) khi đồng bộ Offline "
        "+ Keep-Alive Monitor 5 phút/lần cho Render."
    ),
)

origins = (
    ["*"]
    if SETTINGS.cors_origin == "*"
    else [o.strip() for o in SETTINGS.cors_origin.split(",") if o.strip()]
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "HEAD", "OPTIONS"],
    allow_headers=["*"],
    max_age=86400,
)


def envelope(status_code: int, payload: Dict[str, Any]) -> JSONResponse:
    """Đảm bảo trả về cả cấu trúc chuẩn {success, data, error} lẫn các trường phẳng cho Frontend."""
    is_ok = bool(payload.get("ok", status_code < 400))
    err_msg = payload.get("error") if not is_ok else None
    body = {
        "success": is_ok,
        "data": payload if is_ok else None,
        "error": err_msg,
        **payload,
    }
    return JSONResponse(
        status_code=status_code,
        content=body,
        headers={"Cache-Control": "no-store"},
    )


@app.get("/")
async def root_endpoint() -> JSONResponse:
    return JSONResponse(
        status_code=200,
        content={
            "ok": True,
            "status": "alive",
            "message": "FastAPI Backend Thẻ Thành Viên Doanh Nghiệp đang chạy",
            "monitor": _monitor_stats,
        },
    )


@app.api_route("/api/health", methods=["GET", "HEAD"])
@app.api_route("/health", methods=["GET", "HEAD"])
@app.api_route("/ping", methods=["GET", "HEAD"])
async def health_endpoint(
    request: Request,
    detail: bool = Query(default=False, description="Truyền ?detail=1 để xem thêm trạng thái Firebase"),
) -> Response:
    """Endpoint siêu nhẹ trả 200 OK tức thì (<1ms) để Monitor 5 phút kích Render sống liên tục."""
    if request.method == "HEAD":
        return Response(status_code=200, headers={"Cache-Control": "no-store"})

    payload: Dict[str, Any] = {
        "ok": True,
        "status": "alive",
        "time": datetime.now(timezone.utc).isoformat(),
        "providers": get_ai_status(),
        "monitor": _monitor_stats,
    }
    if detail:
        _, cloud_meta = await FIREBASE_STORE.load_state()
        payload["cloud"] = cloud_meta

    return JSONResponse(status_code=200, content=payload, headers={"Cache-Control": "no-store"})


@app.post("/api/ai/chat")
async def ai_chat_endpoint(req: AIChatRequest) -> JSONResponse:
    messages_list = [m.model_dump() for m in req.messages] if req.messages else None
    prompt_str = (req.prompt or "").strip()
    if not messages_list and not prompt_str:
        return envelope(400, {"ok": False, "error": 'Thiếu nội dung: gửi "prompt" hoặc "messages".'})

    total_chars = len(req.system or "") + len(prompt_str) + sum(
        len(m.get("content", "")) for m in (messages_list or [])
    )
    if total_chars > MAX_INPUT_CHARS:
        return envelope(413, {"ok": False, "error": "Nội dung quá dài, vui lòng rút gọn."})

    result = await generate_ai(
        {
            "messages": messages_list,
            "prompt": prompt_str,
            "system": req.system,
            "maxTokens": req.maxTokens,
            "temperature": req.temperature,
            "json": req.json_mode,
            "providers": req.providers,
        },
        allow_offline_fallback=True,
    )
    return envelope(200 if result.get("ok") else 503, result)


@app.get("/api/loyalty/state")
async def loyalty_state_endpoint() -> JSONResponse:
    res = await get_enterprise_state()
    return envelope(200, res)


@app.post("/api/loyalty/register")
async def loyalty_register_endpoint(req: RegisterMemberRequest) -> JSONResponse:
    code, res = await register_member_service(req.name, req.phone)
    return envelope(code, res)


@app.post("/api/loyalty/earn")
async def loyalty_earn_endpoint(req: EarnPointsRequest) -> JSONResponse:
    code, res = await earn_points_service(
        member_code=req.memberCode,
        amount=req.amount,
        tx_code=req.txCode,
        idempotency_key=req.idempotencyKey,
    )
    return envelope(code, res)


@app.post("/api/loyalty/redeem")
async def loyalty_redeem_endpoint(req: RedeemRewardRequest) -> JSONResponse:
    code, res = await redeem_reward_service(
        member_code=req.memberCode,
        reward_id=req.rewardId,
        tx_code=req.txCode,
        voucher_id=req.voucherId,
        idempotency_key=req.idempotencyKey,
    )
    return envelope(code, res)


@app.post("/api/loyalty/seed")
async def loyalty_seed_endpoint() -> JSONResponse:
    code, res = await load_sample_service()
    return envelope(code, res)


@app.post("/api/loyalty/reset")
async def loyalty_reset_endpoint() -> JSONResponse:
    code, res = await reset_all_service()
    return envelope(code, res)


@app.post("/api/loyalty/sync")
async def loyalty_sync_endpoint(req: OfflineSyncRequest) -> JSONResponse:
    queue_dicts = [item.model_dump() for item in req.queue]
    code, res = await reconcile_offline_queue_service(queue_dicts)
    return envelope(code, res)


@app.post("/api/loyalty/simulate-bank-error")
async def loyalty_simulate_bank_error_endpoint(req: SimulateBankErrorRequest) -> JSONResponse:
    code, res = await simulate_bank_error_service(req.memberCode, req.scenario)
    return envelope(code, res)


@app.post("/api/loyalty/network-mode")
async def loyalty_network_mode_endpoint(request: Request) -> JSONResponse:
    try:
        body = await request.json()
    except Exception:
        body = {}
    offline = bool(body.get("offline", False))
    FIREBASE_STORE.set_simulate_offline(offline)
    _, cloud_meta = await FIREBASE_STORE.load_state()
    return envelope(
        200,
        {
            "ok": True,
            "cloud": cloud_meta,
            "message": (
                "Đã giả lập trạng thái Mất mạng tại Backend -> Kích hoạt localStorage ở Client"
                if offline
                else "Đã khôi phục kết nối Firebase tại Backend -> Sẵn sàng đồng bộ"
            ),
        },
    )


@app.post("/api/loyalty/ai-advisor")
async def loyalty_ai_advisor_endpoint(req: AIAdvisorRequest) -> JSONResponse:
    res = await advisor_insight_service(
        mode=req.mode,
        member_code=req.memberCode,
        custom_question=req.customQuestion,
    )
    return envelope(200, res)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=SETTINGS.port, reload=False)
