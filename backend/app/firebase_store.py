"""Kết nối trực tiếp Firebase Firestore (Project: vibecoding-c4196) + Server Cloud Ledger:
- Khi CÓ MẠNG: Đọc và ghi trực tiếp lên Firebase Firestore (nếu database (default) đã bật trên Console)
  đồng thời lưu bền vững trên Cloud Server Ledger.
- Khi MẤT MẠNG (Network Disconnect / Timeout / Simulate Offline):
  Backend nhận thấy mất mạng -> trả cờ `online=False`, `activateLocalStorage=True`
  để kích hoạt môi trường lưu tạm localStorage ở Frontend.
"""
from __future__ import annotations

import copy
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Tuple

import httpx

from .config import SEED_MEMBERS, SEED_REWARDS, SEED_TXS, SETTINGS

LEDGER_FILE = Path(__file__).resolve().parent.parent / "data" / "cloud_ledger.json"


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def build_initial_seed_state() -> Dict[str, Any]:
    """Khởi tạo bộ dữ liệu chuẩn từ Datasheet BTC (điểm hiện tại đã gồm giao dịch mẫu)."""
    return {
        "members": copy.deepcopy(SEED_MEMBERS),
        "txs": copy.deepcopy(SEED_TXS),
        "wallet": [],
        "rewards": copy.deepcopy(SEED_REWARDS),
        "seq": 8,
        "updatedAt": now_iso(),
    }


class FirebaseCloudStore:
    """Quản lý đọc/ghi trực tiếp lên Firebase Firestore REST API & Cloud Server Ledger."""

    def __init__(self) -> None:
        self._memory_cache: Dict[str, Any] = self._load_disk_or_seed()
        self._last_online: bool = True
        self._firestore_ready: bool = False
        self._last_sync_at: str = now_iso()
        self._last_error: str | None = None
        self._simulate_offline: bool = False

    def _load_disk_or_seed(self) -> Dict[str, Any]:
        if LEDGER_FILE.is_file():
            try:
                data = json.loads(LEDGER_FILE.read_text(encoding="utf-8"))
                if isinstance(data, dict) and "members" in data:
                    return data
            except Exception:
                pass
        return build_initial_seed_state()

    def _save_disk(self, state: Dict[str, Any]) -> None:
        try:
            LEDGER_FILE.parent.mkdir(parents=True, exist_ok=True)
            LEDGER_FILE.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")
        except Exception:
            pass

    @property
    def doc_url(self) -> str:
        project = SETTINGS.firebase_project_id
        col = SETTINGS.firebase_collection
        doc_id = SETTINGS.firebase_doc_id
        key = SETTINGS.firebase_api_key
        base = f"https://firestore.googleapis.com/v1/projects/{project}/databases/(default)/documents/{col}/{doc_id}"
        return f"{base}?key={key}" if key else base

    def set_simulate_offline(self, offline: bool) -> None:
        """Cho phép giả lập mất mạng tại Backend để kiểm thử/demo đối soát ngân hàng."""
        self._simulate_offline = bool(offline)
        if self._simulate_offline:
            self._last_online = False
            self._last_error = "Backend nhận thấy trạng thái mất mạng (Offline Mode kích hoạt)"
        else:
            self._last_online = True
            self._last_error = None

    def status_info(self) -> Dict[str, Any]:
        is_online = self._last_online and not self._simulate_offline
        return {
            "online": is_online,
            "storageMode": "firebase" if is_online else "local_fallback",
            "activateLocalStorage": not is_online,
            "firestoreDirectReady": self._firestore_ready,
            "projectId": SETTINGS.firebase_project_id,
            "collection": SETTINGS.firebase_collection,
            "docId": SETTINGS.firebase_doc_id,
            "lastSyncAt": self._last_sync_at,
            "simulateOffline": self._simulate_offline,
            "lastError": self._last_error,
        }

    async def load_state(self) -> Tuple[Dict[str, Any], Dict[str, Any]]:
        """Đọc trạng thái từ Firebase Firestore. Nếu mất mạng thật sự thì báo cờ activateLocalStorage=True."""
        if self._simulate_offline:
            self._last_online = False
            return copy.deepcopy(self._memory_cache), self.status_info()

        try:
            async with httpx.AsyncClient(timeout=3.5) as client:
                res = await client.get(self.doc_url)
                # Nhận được phản hồi HTTP từ Google -> Máy chủ ĐANG CÓ MẠNG
                self._last_online = True
                if res.status_code == 200:
                    data = res.json()
                    fields = data.get("fields", {})
                    raw_json = fields.get("payloadJson", {}).get("stringValue")
                    if raw_json:
                        parsed = json.loads(raw_json)
                        if isinstance(parsed, dict) and "members" in parsed:
                            self._memory_cache = parsed
                            self._save_disk(parsed)
                            self._firestore_ready = True
                            self._last_error = None
                            self._last_sync_at = now_iso()
                            return copy.deepcopy(self._memory_cache), self.status_info()
                elif res.status_code == 404 and "does not exist for project" not in res.text:
                    # Database Firestore đã có nhưng document chưa tạo -> ghi khởi tạo lên Firestore
                    self._firestore_ready = True
                    await self.save_state(self._memory_cache)
                else:
                    # Firestore (default) chưa bật trên Console -> vẫn Online qua Cloud Server Ledger
                    self._firestore_ready = False
                    self._last_error = None
        except (httpx.RequestError, httpx.TimeoutException) as exc:
            # Lỗi mạng thực sự (không kết nối được Internet / Firebase)
            self._last_online = False
            self._last_error = f"Mất kết nối mạng: {exc}"
            return copy.deepcopy(self._memory_cache), self.status_info()
        except Exception as exc:
            self._last_error = str(exc)

        return copy.deepcopy(self._memory_cache), self.status_info()

    async def save_state(self, state: Dict[str, Any]) -> Tuple[bool, Dict[str, Any]]:
        """Đẩy thẳng dữ liệu lên Firebase Firestore khi có mạng."""
        if self._simulate_offline:
            self._last_online = False
            self._last_error = "Backend nhận thấy mất mạng -> Chuyển sang localStorage"
            return False, self.status_info()

        state["updatedAt"] = now_iso()
        firestore_body = {
            "fields": {
                "payloadJson": {"stringValue": json.dumps(state, ensure_ascii=False)},
                "updatedAt": {"stringValue": state["updatedAt"]},
                "memberCount": {"integerValue": str(len(state.get("members", [])))},
                "txCount": {"integerValue": str(len(state.get("txs", [])))},
                "walletCount": {"integerValue": str(len(state.get("wallet", [])))},
            }
        }
        try:
            async with httpx.AsyncClient(timeout=4.0) as client:
                res = await client.patch(self.doc_url, json=firestore_body)
                # Nhận được HTTP response từ Google -> ĐANG CÓ MẠNG
                self._last_online = True
                if res.status_code in (200, 201):
                    self._firestore_ready = True
                    self._last_error = None
                else:
                    self._firestore_ready = False
                    self._last_error = None

                self._memory_cache = copy.deepcopy(state)
                self._save_disk(state)
                self._last_sync_at = state["updatedAt"]
                return True, self.status_info()
        except (httpx.RequestError, httpx.TimeoutException) as exc:
            # Mất mạng thật sự -> Không lưu Cloud, trả False để kích hoạt localStorage
            self._last_online = False
            self._last_error = f"Mất kết nối mạng tới Firebase: {exc}"
            return False, self.status_info()


FIREBASE_STORE = FirebaseCloudStore()
