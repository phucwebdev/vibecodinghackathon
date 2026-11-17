"""Bộ Fallback AI 4 Tầng cho Doanh nghiệp:
Tầng 1: Gemini (GEMINI_API_KEY - gemini-flash-lite-latest)
Tầng 2: OpenRouter (OPENROUTER_API_KEY - tự xoay 3 model: gpt-4.1-mini -> claude-haiku-5.5 -> deepseek-v4.1-flash)
Tầng 3: Gemini dự phòng (GEMINI_API_KEY_2)
Tầng 4: Local Offline Rule Engine (Tự động kích hoạt khi mất mạng hoàn toàn để API luôn trả 200 OK)
"""
from __future__ import annotations

import json
import math
import re
import time
from datetime import datetime, timezone
from typing import Any, Callable, Dict, List, Optional

import httpx

from .config import LOYALTY_RULES, SEED_REWARDS, SETTINGS, env_str


class ProviderError(Exception):
    def __init__(
        self,
        message: str,
        kind: str = "unknown",
        status: Optional[int] = None,
        retry_after_ms: int = 0,
    ) -> None:
        super().__init__(message)
        self.kind = kind
        self.status = status
        self.retry_after_ms = retry_after_ms


def kind_from_status(status: int, message: str = "", error_code: str = "") -> str:
    msg_lower = message.lower()
    if status in (401, 402, 403):
        return "auth"
    if status == 400 and any(k in msg_lower for k in ("api key", "workspace", "credit balance", "billing")):
        return "auth"
    if status == 429:
        if "insufficient_quota" in error_code.lower() or any(
            k in msg_lower for k in ("exceeded your current quota", "billing")
        ):
            return "auth"
        return "rate_limit"
    if status == 408:
        return "timeout"
    if status >= 500:
        return "server"
    return "bad_request"


def normalize_messages(messages: List[Dict[str, str]]) -> List[Dict[str, str]]:
    out: List[Dict[str, str]] = []
    for m in messages:
        if not m or not m.get("content"):
            continue
        role = "assistant" if m.get("role") == "assistant" else "user"
        content = str(m.get("content", ""))
        if out and out[-1]["role"] == role:
            out[-1]["content"] += "\n" + content
        else:
            out.append({"role": role, "content": content})
    return out


def extract_json(text: str) -> Any:
    cleaned = re.sub(r"^```(?:json)?\s*", "", text.strip(), flags=re.IGNORECASE)
    cleaned = re.sub(r"\s*```$", "", cleaned).strip()
    try:
        return json.loads(cleaned)
    except Exception:
        pass
    match_start = re.search(r"[\[{]", cleaned)
    end_brace = max(cleaned.rfind("}"), cleaned.rfind("]"))
    if match_start and end_brace > match_start.start():
        snippet = cleaned[match_start.start() : end_brace + 1]
        try:
            return json.loads(snippet)
        except Exception:
            pass
    raise ProviderError("Phản hồi không phải JSON hợp lệ", kind="invalid_json")


async def post_json(url: str, headers: Dict[str, str], body: Dict[str, Any], timeout_ms: int) -> Dict[str, Any]:
    timeout_sec = max(0.2, timeout_ms / 1000.0)
    try:
        async with httpx.AsyncClient(timeout=timeout_sec) as client:
            res = await client.post(
                url,
                headers={"Content-Type": "application/json", **headers},
                json=body,
            )
    except httpx.TimeoutException as exc:
        raise ProviderError(f"Quá thời gian chờ ({timeout_ms}ms)", kind="timeout") from exc
    except Exception as exc:
        raise ProviderError(f"Lỗi mạng: {exc}", kind="network") from exc

    text = res.text
    try:
        data = res.json() if text else {}
    except Exception:
        data = {}

    if res.status_code >= 400:
        err_obj = data.get("error") if isinstance(data, dict) else None
        if isinstance(err_obj, dict):
            msg = err_obj.get("message") or str(err_obj)
            err_code = str(err_obj.get("code") or "")
        else:
            msg = (data.get("message") if isinstance(data, dict) else None) or text[:300] or res.reason_phrase
            err_code = ""
        ra_header = res.headers.get("retry-after", "")
        retry_after_ms = int(float(ra_header) * 1000) if ra_header.replace(".", "", 1).isdigit() else 0
        kind = kind_from_status(res.status_code, str(msg), err_code)
        raise ProviderError(
            f"HTTP {res.status_code}: {msg}",
            kind=kind,
            status=res.status_code,
            retry_after_ms=retry_after_ms,
        )
    return data if isinstance(data, dict) else {}


def _make_gemini_provider(name: str, key_env: str) -> Dict[str, Any]:
    async def _generate(opts: Dict[str, Any]) -> Dict[str, Any]:
        model = SETTINGS.gemini_model
        contents = [
            {
                "role": "model" if m["role"] == "assistant" else "user",
                "parts": [{"text": m["content"]}],
            }
            for m in normalize_messages(opts["messages"])
        ]
        gen_cfg: Dict[str, Any] = {
            "maxOutputTokens": opts["max_tokens"],
            "temperature": opts["temperature"],
        }
        if opts.get("json"):
            gen_cfg["responseMimeType"] = "application/json"

        body: Dict[str, Any] = {
            "contents": contents,
            "generationConfig": gen_cfg,
        }
        if opts.get("system"):
            body["systemInstruction"] = {"parts": [{"text": opts["system"]}]}

        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
        data = await post_json(
            url,
            {"x-goog-api-key": env_str(key_env)},
            body,
            opts["timeout_ms"],
        )
        candidates = data.get("candidates") or []
        parts = (candidates[0].get("content", {}).get("parts") or []) if candidates else []
        text = "".join(p.get("text", "") for p in parts)
        if not text.strip():
            block_reason = data.get("promptFeedback", {}).get("blockReason") or (
                candidates[0].get("finishReason") if candidates else "empty"
            )
            raise ProviderError(f"Gemini trả về rỗng ({block_reason})", kind="empty")
        usage_meta = data.get("usageMetadata") or {}
        return {
            "text": text,
            "model": model,
            "usage": {
                "input": usage_meta.get("promptTokenCount"),
                "output": usage_meta.get("candidatesTokenCount"),
            },
        }

    return {
        "name": name,
        "get_model": lambda: SETTINGS.gemini_model,
        "is_configured": lambda: bool(env_str(key_env)),
        "generate": _generate,
    }


def _make_openrouter_provider() -> Dict[str, Any]:
    async def _generate(opts: Dict[str, Any]) -> Dict[str, Any]:
        models = SETTINGS.openrouter_models
        msgs = normalize_messages(opts["messages"])
        if opts.get("system"):
            msgs = [{"role": "system", "content": opts["system"]}, *msgs]
        body: Dict[str, Any] = {
            "models": models,
            "max_tokens": opts["max_tokens"],
            "messages": msgs,
            "temperature": opts["temperature"],
        }
        if opts.get("json"):
            body["response_format"] = {"type": "json_object"}

        data = await post_json(
            "https://openrouter.ai/api/v1/chat/completions",
            {"Authorization": f"Bearer {env_str('OPENROUTER_API_KEY')}"},
            body,
            opts["timeout_ms"],
        )
        choices = data.get("choices") or []
        text = (choices[0].get("message", {}).get("content") or "") if choices else ""
        if not text.strip():
            raise ProviderError("OpenRouter trả về rỗng", kind="empty")
        usage = data.get("usage") or {}
        return {
            "text": text,
            "model": data.get("model") or (models[0] if models else "openrouter"),
            "usage": {
                "input": usage.get("prompt_tokens"),
                "output": usage.get("completion_tokens"),
            },
        }

    return {
        "name": "openrouter",
        "get_model": lambda: " -> ".join(SETTINGS.openrouter_models),
        "is_configured": lambda: bool(env_str("OPENROUTER_API_KEY")),
        "generate": _generate,
    }


PROVIDERS: Dict[str, Dict[str, Any]] = {
    "gemini": _make_gemini_provider("gemini", "GEMINI_API_KEY"),
    "openrouter": _make_openrouter_provider(),
    "gemini2": _make_gemini_provider("gemini2", "GEMINI_API_KEY_2"),
}

_cooldown_until: Dict[str, float] = {}
_last_error: Dict[str, Dict[str, Any]] = {}


def reset_ai_state() -> None:
    _cooldown_until.clear()
    _last_error.clear()


def provider_order(override: Optional[List[str]] = None) -> List[str]:
    raw = override if (isinstance(override, list) and len(override) > 0) else SETTINGS.ai_order
    seen = set()
    order: List[str] = []
    for item in raw:
        name = str(item).strip().lower()
        if name in PROVIDERS and name not in seen:
            seen.add(name)
            order.append(name)
    return order


def get_ai_status() -> List[Dict[str, Any]]:
    now_ms = time.time() * 1000.0
    out: List[Dict[str, Any]] = []
    for name in provider_order():
        p = PROVIDERS[name]
        until = _cooldown_until.get(name, 0.0)
        cooling_sec = math.ceil((until - now_ms) / 1000.0) if until > now_ms else 0
        out.append(
            {
                "provider": name,
                "model": p["get_model"](),
                "configured": p["is_configured"](),
                "coolingDownSec": cooling_sec,
                "lastError": _last_error.get(name),
            }
        )
    return out


def build_offline_rule_response(prompt_text: str, json_mode: bool = False) -> Dict[str, Any]:
    """Tầng 4: Bộ suy luận nội bộ khi mất mạng hoàn toàn (Local Rule Engine)."""
    if json_mode:
        fallback_obj = {
            "mode": "offline_rule_engine",
            "summary": "Hệ thống đang ở chế độ Offline. Khuyến nghị: Ưu tiên nhắc khách tích điểm đủ mốc Bạc (1.000 điểm) và Vàng (5.000 điểm), hoặc đổi Voucher 20.000đ (500 điểm).",
            "tips": [
                "Tỷ lệ quy đổi: 10.000đ = 1 điểm.",
                "Mốc hạng: Đồng (<1.000), Bạc (1.000-4.999), Vàng (>=5.000).",
                "Mọi giao dịch lúc mất mạng được lưu an toàn trong hàng đợi đối soát.",
            ],
        }
        return {
            "text": json.dumps(fallback_obj, ensure_ascii=False),
            "data": fallback_obj,
        }
    return {
        "text": (
            "[Chế độ Offline Cục Bộ] Hệ thống tạm thời mất kết nối Internet tới Cloud AI, "
            "đã tự động kích hoạt Bộ quy tắc nghiệp vụ nội bộ:\n"
            "• Tỷ lệ tích điểm: 10.000đ = 1 điểm (Mỗi mã giao dịch chỉ cộng 1 lần).\n"
            "• Ngưỡng hạng: Đồng (< 1.000 điểm) · Bạc (1.000 – 4.999 điểm) · Vàng (≥ 5.000 điểm).\n"
            "• Ưu đãi quy đổi: Voucher 20.000đ (500 điểm), Voucher 50.000đ (1.100 điểm), Quà tặng đặc biệt (2.000 điểm)."
        )
    }


async def generate_ai(
    req: Dict[str, Any],
    allow_offline_fallback: bool = False,
) -> Dict[str, Any]:
    """Gọi lần lượt gemini -> openrouter -> gemini2. Nếu mất mạng và allow_offline_fallback=True thì dùng Tầng 4."""
    started_ms = time.time() * 1000.0
    budget_ms = SETTINGS.total_budget_ms
    per_provider_ms = SETTINGS.timeout_ms

    raw_msgs = req.get("messages")
    if isinstance(raw_msgs, list) and len(raw_msgs) > 0:
        messages = [
            {"role": m.get("role", "user"), "content": str(m.get("content", ""))}
            for m in raw_msgs
        ]
    else:
        messages = [{"role": "user", "content": str(req.get("prompt") or "")}]

    max_tok = min(int(req.get("maxTokens") or SETTINGS.max_tokens), SETTINGS.max_tokens_cap)
    temp = float(req.get("temperature")) if req.get("temperature") is not None else 0.7
    json_mode = bool(req.get("json"))

    opts = {
        "system": req.get("system") or SETTINGS.system_prompt,
        "messages": messages,
        "max_tokens": max_tok,
        "temperature": temp,
        "json": json_mode,
    }

    attempts: List[Dict[str, Any]] = []
    order = provider_order(req.get("providers"))

    for name in order:
        p = PROVIDERS[name]
        if not p["is_configured"]():
            attempts.append({"provider": name, "skipped": "chưa có API key"})
            continue

        now_ms = time.time() * 1000.0
        until = _cooldown_until.get(name, 0.0)
        if until > now_ms:
            rem_sec = math.ceil((until - now_ms) / 1000.0)
            attempts.append({"provider": name, "skipped": f"đang tạm khoá {rem_sec}s"})
            continue

        remaining_ms = int(budget_ms - (now_ms - started_ms))
        if remaining_ms < 2000:
            attempts.append({"provider": name, "skipped": "hết ngân sách thời gian"})
            break

        t0 = time.time() * 1000.0
        try:
            out = await p["generate"]({**opts, "timeout_ms": min(per_provider_ms, remaining_ms)})
            result: Dict[str, Any] = {
                "ok": True,
                "text": out["text"],
                "provider": name,
                "model": out["model"],
                "usage": out.get("usage"),
            }
            if json_mode:
                result["data"] = extract_json(out["text"])
            attempts.append({"provider": name, "ok": True, "ms": int(time.time() * 1000.0 - t0)})
            _cooldown_until.pop(name, None)
            _last_error.pop(name, None)
            result["ms"] = int(time.time() * 1000.0 - started_ms)
            result["attempts"] = attempts
            return result
        except Exception as exc:
            kind = exc.kind if isinstance(exc, ProviderError) else "unknown"
            retry_ms = exc.retry_after_ms if isinstance(exc, ProviderError) else 0
            cd_ms = max(SETTINGS.cooldown_ms.get(kind, 10_000), retry_ms)
            if cd_ms > 0:
                _cooldown_until[name] = time.time() * 1000.0 + cd_ms
            _last_error[name] = {
                "kind": kind,
                "message": str(exc),
                "at": datetime.now(timezone.utc).isoformat(),
            }
            attempts.append(
                {
                    "provider": name,
                    "ok": False,
                    "kind": kind,
                    "error": str(exc),
                    "ms": int(time.time() * 1000.0 - t0),
                }
            )

    if allow_offline_fallback:
        prompt_str = "\n".join(m["content"] for m in messages)
        local_res = build_offline_rule_response(prompt_str, json_mode=json_mode)
        return {
            "ok": True,
            "text": local_res["text"],
            **({"data": local_res["data"]} if "data" in local_res else {}),
            "provider": "local-offline",
            "model": "rule-engine-v1",
            "offlineFallback": True,
            "ms": int(time.time() * 1000.0 - started_ms),
            "attempts": attempts,
        }

    return {
        "ok": False,
        "error": "Tất cả nhà cung cấp AI đều đang lỗi hoặc chưa cấu hình. Vui lòng thử lại sau ít phút.",
        "ms": int(time.time() * 1000.0 - started_ms),
        "attempts": attempts,
    }
