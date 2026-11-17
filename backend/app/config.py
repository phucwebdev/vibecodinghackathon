"""Cấu hình trung tâm cho FastAPI Backend:
- Tự động nạp biến môi trường từ backend/.env
- Cấu hình chuỗi AI Fallback: gemini -> openrouter -> gemini2 (+ local_rule khi mất mạng)
- Cấu hình Firebase Firestore (Project: vibecoding-c4196)
- Quy tắc nghiệp vụ Thẻ thành viên & Dữ liệu mẫu chuẩn BTC (Bảng Kỹ thuật)
"""
from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Dict, List


def load_dotenv_file() -> None:
    """Đọc file .env trong thư mục backend (không bắt buộc cài python-dotenv)."""
    env_path = Path(__file__).resolve().parent.parent / ".env"
    if not env_path.is_file():
        return
    try:
        raw_text = env_path.read_text(encoding="utf-8")
    except Exception:
        return
    for raw_line in raw_text.splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("export "):
            line = line[7:].strip()
        if "=" not in line:
            continue
        key, val = line.split("=", 1)
        key = key.strip()
        val = val.strip()
        if (val.startswith('"') and val.endswith('"')) or (val.startswith("'") and val.endswith("'")):
            val = val[1:-1]
        if key and key not in os.environ:
            os.environ[key] = val


load_dotenv_file()


def env_str(name: str, default: str = "") -> str:
    val = os.environ.get(name, "")
    return val.strip() if val and val.strip() else default


def env_int(name: str, default: int) -> int:
    raw = os.environ.get(name, "")
    if not raw:
        return default
    try:
        return int(raw.strip())
    except ValueError:
        return default


class Settings:
    """Cấu hình động đọc trực tiếp từ biến môi trường & giá trị mặc định chuẩn."""

    @property
    def port(self) -> int:
        return env_int("PORT", 3001)

    @property
    def cors_origin(self) -> str:
        return env_str("CORS_ORIGIN", "*")

    # --- AI Fallback: gemini -> openrouter -> gemini2 ---
    @property
    def ai_order(self) -> List[str]:
        raw = env_str("AI_ORDER", "gemini,openrouter,gemini2")
        return [x.strip().lower() for x in raw.split(",") if x.strip()]

    @property
    def gemini_model(self) -> str:
        return env_str("GEMINI_MODEL", "gemini-flash-lite-latest")

    @property
    def openrouter_models(self) -> List[str]:
        raw = env_str(
            "OPENROUTER_MODEL",
            "openai/gpt-4.1-mini,anthropic/claude-haiku-5.5,deepseek/deepseek-v4.1-flash",
        )
        return [x.strip() for x in raw.split(",") if x.strip()]

    @property
    def timeout_ms(self) -> int:
        return env_int("AI_TIMEOUT_MS", 20_000)

    @property
    def total_budget_ms(self) -> int:
        return env_int("AI_TOTAL_BUDGET_MS", 45_000)

    @property
    def max_tokens(self) -> int:
        return env_int("AI_MAX_TOKENS", 1024)

    max_tokens_cap: int = 8192

    @property
    def system_prompt(self) -> str:
        return env_str(
            "AI_SYSTEM_PROMPT",
            "Bạn là trợ lý AI chuyên nghiệp cho Hệ thống Thẻ Thành Viên Doanh Nghiệp, luôn trả lời bằng tiếng Việt ngắn gọn, rõ ràng và chính xác.",
        )

    cooldown_ms: Dict[str, int] = {
        "auth": 10 * 60_000,
        "rate_limit": 30_000,
        "timeout": 20_000,
        "network": 20_000,
        "server": 20_000,
        "unknown": 10_000,
        "empty": 0,
        "invalid_json": 0,
        "bad_request": 0,
    }

    # --- Firebase Firestore ---
    @property
    def firebase_project_id(self) -> str:
        return env_str("FIREBASE_PROJECT_ID", "vibecoding-c4196")

    @property
    def firebase_api_key(self) -> str:
        return env_str("FIREBASE_API_KEY", "AIzaSyBESVfS2Bj9oHQlDdaJ9Zx8ZCWYoRFS2CM")

    @property
    def firebase_collection(self) -> str:
        return env_str("FIREBASE_COLLECTION", "loyalty_enterprise")

    @property
    def firebase_doc_id(self) -> str:
        return env_str("FIREBASE_DOC_ID", "bang_ky_thuat_v1")


SETTINGS = Settings()

# =========================================================
# QUY TẮC NGHIỆP VỤ & DỮ LIỆU MẪU CHUẨN BTC (BẢNG KỸ THUẬT)
# =========================================================
LOYALTY_RULES: Dict[str, Any] = {
    "vndPerPoint": 10000,
    "tiers": [
        {"key": "dong", "name": "Đồng", "min": 0, "color": "#9A5B2E"},
        {"key": "bac", "name": "Bạc", "min": 1000, "color": "#64748B"},
        {"key": "vang", "name": "Vàng", "min": 5000, "color": "#B7791F"},
    ],
}

SEED_REWARDS: List[Dict[str, Any]] = [
    {
        "id": "KT-VCH-01",
        "name": "Voucher 20.000đ",
        "desc": "Giảm giá đơn hàng",
        "cost": 500,
        "status": "Đang áp dụng",
    },
    {
        "id": "KT-VCH-02",
        "name": "Voucher 50.000đ",
        "desc": "Giảm giá đơn hàng",
        "cost": 1100,
        "status": "Đang áp dụng",
    },
    {
        "id": "KT-VCH-03",
        "name": "Quà tặng đặc biệt",
        "desc": "Quà tặng mô phỏng",
        "cost": 2000,
        "status": "Đang áp dụng",
    },
]

SEED_MEMBERS: List[Dict[str, Any]] = [
    {
        "id": "KT-001",
        "name": "An Nguyễn",
        "phone": "0900001001",
        "initialPoints": 200,
        "points": 250,
        "joined": "2026-09-05",
        "status": "Đang hoạt động",
        "qrPayload": "KT-001",
    },
    {
        "id": "KT-002",
        "name": "Bình Trần",
        "phone": "0900001002",
        "initialPoints": 1300,
        "points": 1450,
        "joined": "2026-08-17",
        "status": "Đang hoạt động",
        "qrPayload": "KT-002",
    },
    {
        "id": "KT-003",
        "name": "Chi Lê",
        "phone": "0900001003",
        "initialPoints": 1000,
        "points": 800,
        "joined": "2026-07-22",
        "status": "Đang hoạt động",
        "qrPayload": "KT-003",
    },
    {
        "id": "KT-004",
        "name": "Dũng Phạm",
        "phone": "0900001004",
        "initialPoints": 3000,
        "points": 3200,
        "joined": "2026-06-14",
        "status": "Đang hoạt động",
        "qrPayload": "KT-004",
    },
    {
        "id": "KT-005",
        "name": "Hà Võ",
        "phone": "0900001005",
        "initialPoints": 5000,
        "points": 5800,
        "joined": "2026-04-09",
        "status": "Đang hoạt động",
        "qrPayload": "KT-005",
    },
    {
        "id": "KT-006",
        "name": "Minh Đỗ",
        "phone": "0900001006",
        "initialPoints": 12000,
        "points": 12500,
        "joined": "2026-02-28",
        "status": "Đang hoạt động",
        "qrPayload": "KT-006",
    },
    {
        "id": "KT-007",
        "name": "Ngọc Bùi",
        "phone": "0900001007",
        "initialPoints": 4000,
        "points": 4700,
        "joined": "2026-03-11",
        "status": "Đang hoạt động",
        "qrPayload": "KT-007",
    },
    {
        "id": "KT-008",
        "name": "Phúc Hoàng",
        "phone": "0900001008",
        "initialPoints": 0,
        "points": 0,
        "joined": "2026-10-10",
        "status": "Đang hoạt động",
        "qrPayload": "KT-008",
    },
]

SEED_TXS: List[Dict[str, Any]] = [
    {
        "id": "TX-KT-001",
        "historyId": "KT-LS-001",
        "type": "earn",
        "memberId": "KT-001",
        "time": "2026-10-03T09:15:00",
        "amount": 500000,
        "points": 50,
        "balance": 250,
        "note": "Dữ liệu mẫu đã ghi nhận",
        "status": "COMMITTED",
    },
    {
        "id": "TX-KT-002",
        "historyId": "KT-LS-002",
        "type": "earn",
        "memberId": "KT-002",
        "time": "2026-10-04T11:40:00",
        "amount": 1500000,
        "points": 150,
        "balance": 1450,
        "note": "Dữ liệu mẫu đã ghi nhận",
        "status": "COMMITTED",
    },
    {
        "id": "TX-KT-003",
        "historyId": "KT-LS-003",
        "type": "redeem",
        "memberId": "KT-003",
        "time": "2026-10-05T14:05:00",
        "amount": 0,
        "points": -200,
        "balance": 800,
        "note": "Đổi ưu đãi",
        "status": "COMMITTED",
    },
    {
        "id": "TX-KT-004",
        "historyId": "KT-LS-004",
        "type": "earn",
        "memberId": "KT-004",
        "time": "2026-10-06T18:20:00",
        "amount": 2000000,
        "points": 200,
        "balance": 3200,
        "note": "Dữ liệu mẫu đã ghi nhận",
        "status": "COMMITTED",
    },
    {
        "id": "TX-KT-005",
        "historyId": "KT-LS-005",
        "type": "earn",
        "memberId": "KT-005",
        "time": "2026-10-08T10:30:00",
        "amount": 8000000,
        "points": 800,
        "balance": 5800,
        "note": "Dữ liệu mẫu đã ghi nhận",
        "status": "COMMITTED",
    },
    {
        "id": "TX-KT-006",
        "historyId": "KT-LS-006",
        "type": "earn",
        "memberId": "KT-006",
        "time": "2026-10-09T16:10:00",
        "amount": 5000000,
        "points": 500,
        "balance": 12500,
        "note": "Dữ liệu mẫu đã ghi nhận",
        "status": "COMMITTED",
    },
    {
        "id": "TX-KT-007",
        "historyId": "KT-LS-007",
        "type": "earn",
        "memberId": "KT-007",
        "time": "2026-10-11T12:55:00",
        "amount": 7000000,
        "points": 700,
        "balance": 4700,
        "note": "Dữ liệu mẫu đã ghi nhận",
        "status": "COMMITTED",
    },
]
