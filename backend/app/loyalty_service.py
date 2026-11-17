"""Nghiệp vụ Thẻ Thành Viên 2 Đầu (Doanh nghiệp) & Đối soát Giao dịch Ngân hàng (Core Banking Rollback):
- Khi CÓ MẠNG: Đẩy thẳng mọi thao tác lên Firebase Firestore.
- Khi MẤT MẠNG: Backend báo trạng thái `activateLocalStorage=True` để Frontend kích hoạt localStorage.
- Khi CÓ MẠNG TRỞ LẠI: Đối soát hàng đợi từ localStorage đẩy lên Firebase; nếu phát hiện xung đột/lỗi
  (trùng mã giao dịch trên Cloud hoặc không đủ số dư thực tế) -> Tự động sinh Bút toán Đảo (Rollback / Hoàn điểm).
"""
from __future__ import annotations

import copy
import math
import re
import uuid
from typing import Any, Dict, List, Optional, Tuple

from .ai_fallback import generate_ai
from .config import LOYALTY_RULES, SEED_MEMBERS, SEED_REWARDS, SEED_TXS
from .firebase_store import FIREBASE_STORE, build_initial_seed_state, now_iso


def norm_code(code: Optional[str]) -> str:
    return str(code or "").strip().upper()


def tier_of(points: int) -> Dict[str, Any]:
    pts = int(points or 0)
    current = LOYALTY_RULES["tiers"][0]
    for t in LOYALTY_RULES["tiers"]:
        if pts >= t["min"]:
            current = t
    return current


def next_tier_of(points: int) -> Optional[Dict[str, Any]]:
    pts = int(points or 0)
    for t in LOYALTY_RULES["tiers"]:
        if pts < t["min"]:
            return t
    return None


def find_member(state: Dict[str, Any], code_or_phone: str) -> Optional[Dict[str, Any]]:
    c = norm_code(code_or_phone)
    if not c:
        return None
    for m in state.get("members", []):
        if norm_code(m.get("id")) == c or norm_code(m.get("phone")) == c:
            return m
    return None


def tx_exists(state: Dict[str, Any], tx_code: str) -> bool:
    c = norm_code(tx_code)
    if not c:
        return False
    return any(
        norm_code(t.get("id")) == c and t.get("status", "COMMITTED") == "COMMITTED"
        for t in state.get("txs", [])
    )


def next_member_id(state: Dict[str, Any]) -> str:
    seq = int(state.get("seq") or len(state.get("members", [])))
    while True:
        seq += 1
        candidate = f"TV-{seq:04d}"
        if not find_member(state, candidate):
            state["seq"] = seq
            return candidate


async def get_enterprise_state() -> Dict[str, Any]:
    state, cloud_meta = await FIREBASE_STORE.load_state()
    return {
        "ok": True,
        "state": state,
        "rules": LOYALTY_RULES,
        "rewards": state.get("rewards") or SEED_REWARDS,
        "cloud": cloud_meta,
    }


async def register_member_service(name: str, phone: str) -> Tuple[int, Dict[str, Any]]:
    clean_name = re.sub(r"\s+", " ", str(name or "").strip())
    clean_phone = re.sub(r"[\s.\-]", "", str(phone or ""))
    if len(clean_name) < 2:
        return 400, {"ok": False, "field": "name", "error": "Vui lòng nhập họ tên (ít nhất 2 ký tự)."}
    if not re.match(r"^0\d{9}$", clean_phone):
        return 400, {"ok": False, "field": "phone", "error": "Số điện thoại gồm 10 chữ số, bắt đầu bằng 0."}

    state, cloud_meta = await FIREBASE_STORE.load_state()
    if not cloud_meta["online"]:
        return 503, {
            "ok": False,
            "offline": True,
            "activateLocalStorage": True,
            "cloud": cloud_meta,
            "error": "Backend nhận thấy mất kết nối mạng tới Firebase. Kích hoạt chế độ lưu localStorage.",
        }

    if any(m.get("phone") == clean_phone for m in state.get("members", [])):
        return 409, {
            "ok": False,
            "field": "phone",
            "error": "Số điện thoại này đã có thẻ. Hãy mở thẻ bằng số điện thoại ở bên dưới.",
        }

    new_id = next_member_id(state)
    member = {
        "id": new_id,
        "name": clean_name,
        "phone": clean_phone,
        "initialPoints": 0,
        "points": 0,
        "joined": now_iso()[:10],
        "status": "Đang hoạt động",
        "qrPayload": new_id,
    }
    state.setdefault("members", []).append(member)
    saved_ok, cloud_meta = await FIREBASE_STORE.save_state(state)
    if not saved_ok:
        return 503, {
            "ok": False,
            "offline": True,
            "activateLocalStorage": True,
            "cloud": cloud_meta,
            "error": "Mất mạng khi đang ghi lên Firebase. Chuyển sang lưu tạm localStorage.",
        }

    return 200, {
        "ok": True,
        "member": member,
        "state": state,
        "cloud": cloud_meta,
    }


async def earn_points_service(
    member_code: str,
    amount: float,
    tx_code: str,
    idempotency_key: Optional[str] = None,
) -> Tuple[int, Dict[str, Any]]:
    state, cloud_meta = await FIREBASE_STORE.load_state()
    if not cloud_meta["online"]:
        return 503, {
            "ok": False,
            "offline": True,
            "activateLocalStorage": True,
            "cloud": cloud_meta,
            "error": "Backend phát hiện mất mạng. Đã kích hoạt lưu tạm vào localStorage.",
        }

    member = find_member(state, member_code)
    if not member:
        return 404, {"ok": False, "field": "member", "error": "Không tìm thấy thành viên có mã này."}

    amt = math.floor(float(amount or 0))
    if amt <= 0:
        return 400, {"ok": False, "field": "amount", "error": "Vui lòng nhập số tiền giao dịch lớn hơn 0."}

    code = norm_code(tx_code)
    if not code:
        return 400, {"ok": False, "field": "tx", "error": "Vui lòng nhập mã giao dịch."}

    if tx_exists(state, code):
        return 409, {
            "ok": False,
            "field": "tx",
            "duplicate": True,
            "error": f"Mã giao dịch {code} đã được cộng điểm trước đó. Không cộng lại.",
        }

    vnd_per_pt = int(LOYALTY_RULES["vndPerPoint"])
    pts = amt // vnd_per_pt
    if pts < 1:
        return 400, {
            "ok": False,
            "field": "amount",
            "error": f"Giao dịch dưới {vnd_per_pt:,}đ chưa đủ để cộng điểm.".replace(",", "."),
        }

    before_tier = tier_of(member["points"])
    member["points"] = int(member.get("points", 0)) + pts
    after_tier = tier_of(member["points"])
    tier_up = after_tier if after_tier["key"] != before_tier["key"] else None

    tx_entry = {
        "id": code,
        "type": "earn",
        "memberId": member["id"],
        "time": now_iso(),
        "amount": amt,
        "points": pts,
        "balance": member["points"],
        "status": "COMMITTED",
        "idempotencyKey": idempotency_key or code,
    }
    state.setdefault("txs", []).append(tx_entry)

    saved_ok, cloud_meta = await FIREBASE_STORE.save_state(state)
    if not saved_ok:
        return 503, {
            "ok": False,
            "offline": True,
            "activateLocalStorage": True,
            "cloud": cloud_meta,
            "error": "Không thể ghi lên Firebase do mất mạng. Đã chuyển sang localStorage.",
        }

    return 200, {
        "ok": True,
        "member": member,
        "points": pts,
        "tierUp": tier_up,
        "tx": tx_entry,
        "state": state,
        "cloud": cloud_meta,
    }


async def redeem_reward_service(
    member_code: str,
    reward_id: str,
    tx_code: Optional[str] = None,
    voucher_id: Optional[str] = None,
    idempotency_key: Optional[str] = None,
) -> Tuple[int, Dict[str, Any]]:
    state, cloud_meta = await FIREBASE_STORE.load_state()
    if not cloud_meta["online"]:
        return 503, {
            "ok": False,
            "offline": True,
            "activateLocalStorage": True,
            "cloud": cloud_meta,
            "error": "Backend phát hiện mất mạng. Đã kích hoạt lưu tạm vào localStorage.",
        }

    member = find_member(state, member_code)
    rewards = state.get("rewards") or SEED_REWARDS
    reward = next((r for r in rewards if r["id"] == reward_id), None)
    if not member or not reward:
        return 404, {"ok": False, "error": "Không tìm thấy thành viên hoặc ưu đãi."}

    cost = int(reward["cost"])
    cur_pts = int(member.get("points", 0))
    if cur_pts < cost:
        missing = f"{cost - cur_pts:,}".replace(",", ".")
        return 400, {
            "ok": False,
            "insufficient": True,
            "error": f"Bạn cần thêm {missing} điểm để đổi ưu đãi này.",
        }

    member["points"] = cur_pts - cost
    tx_id = norm_code(tx_code) or f"DOI-{uuid.uuid4().hex[:6].upper()}"
    vch_id = norm_code(voucher_id) or f"VC-{uuid.uuid4().hex[:6].upper()}"
    timestamp = now_iso()

    tx_entry = {
        "id": tx_id,
        "type": "redeem",
        "memberId": member["id"],
        "time": timestamp,
        "amount": 0,
        "points": -cost,
        "balance": member["points"],
        "note": reward["name"],
        "status": "COMMITTED",
        "idempotencyKey": idempotency_key or tx_id,
    }
    voucher_entry = {
        "id": vch_id,
        "memberId": member["id"],
        "rewardId": reward["id"],
        "name": reward["name"],
        "desc": reward.get("desc", ""),
        "time": timestamp,
        "status": "ACTIVE",
    }
    state.setdefault("txs", []).append(tx_entry)
    state.setdefault("wallet", []).append(voucher_entry)

    saved_ok, cloud_meta = await FIREBASE_STORE.save_state(state)
    if not saved_ok:
        return 503, {
            "ok": False,
            "offline": True,
            "activateLocalStorage": True,
            "cloud": cloud_meta,
            "error": "Không thể ghi lên Firebase do mất mạng. Đã chuyển sang localStorage.",
        }

    return 200, {
        "ok": True,
        "member": member,
        "reward": reward,
        "voucher": voucher_entry,
        "tx": tx_entry,
        "state": state,
        "cloud": cloud_meta,
    }


async def load_sample_service() -> Tuple[int, Dict[str, Any]]:
    state, cloud_meta = await FIREBASE_STORE.load_state()
    if not cloud_meta["online"]:
        return 503, {
            "ok": False,
            "offline": True,
            "activateLocalStorage": True,
            "cloud": cloud_meta,
            "error": "Đang mất mạng, không thể nạp mẫu lên Firebase.",
        }

    seed_ids = {m["id"] for m in SEED_MEMBERS}
    # Giữ lại thành viên đăng ký mới ngoài 8 thành viên mẫu BTC
    custom_members = [m for m in state.get("members", []) if m.get("id") not in seed_ids]
    state["members"] = copy.deepcopy(SEED_MEMBERS) + custom_members
    state["txs"] = [t for t in state.get("txs", []) if t.get("memberId") not in seed_ids] + copy.deepcopy(SEED_TXS)
    state["wallet"] = [w for w in state.get("wallet", []) if w.get("memberId") not in seed_ids]
    state["rewards"] = copy.deepcopy(SEED_REWARDS)

    saved_ok, cloud_meta = await FIREBASE_STORE.save_state(state)
    if not saved_ok:
        return 503, {
            "ok": False,
            "offline": True,
            "activateLocalStorage": True,
            "cloud": cloud_meta,
            "error": "Mất mạng khi đang nạp dữ liệu mẫu lên Firebase.",
        }

    return 200, {
        "ok": True,
        "state": state,
        "cloud": cloud_meta,
    }


async def reset_all_service() -> Tuple[int, Dict[str, Any]]:
    empty_state = {
        "members": [],
        "txs": [],
        "wallet": [],
        "rewards": copy.deepcopy(SEED_REWARDS),
        "seq": 0,
        "updatedAt": now_iso(),
    }
    saved_ok, cloud_meta = await FIREBASE_STORE.save_state(empty_state)
    return (200 if saved_ok else 503), {
        "ok": saved_ok,
        "state": empty_state,
        "cloud": cloud_meta,
    }


# =========================================================
# NGHIỆP VỤ NGÂN HÀNG: ĐỐI SOÁT OFFLINE & TỰ ĐỘNG ROLLBACK
# =========================================================
async def reconcile_offline_queue_service(queue: List[Dict[str, Any]]) -> Tuple[int, Dict[str, Any]]:
    """Khi có mạng trở lại:
    Đẩy toàn bộ giao dịch lưu tạm ở localStorage vào Firebase.
    - Hợp lệ -> COMMITTED trên Firebase.
    - Lỗi đối soát (Trùng mã GD đã có trên Cloud / Không đủ số dư thực tế trên Cloud)
      -> Thực hiện Bút toán Đảo (ROLLED_BACK / Hoàn điểm tự động) như nghiệp vụ Ngân hàng.
    """
    state, cloud_meta = await FIREBASE_STORE.load_state()
    if not cloud_meta["online"]:
        return 503, {
            "ok": False,
            "offline": True,
            "activateLocalStorage": True,
            "cloud": cloud_meta,
            "error": "Vẫn chưa kết nối được Firebase. Hàng đợi giữ nguyên trong localStorage.",
        }

    committed: List[Dict[str, Any]] = []
    rolled_back: List[Dict[str, Any]] = []
    settled_keys = {
        t.get("idempotencyKey") or t.get("id")
        for t in state.get("txs", [])
        if t.get("status") == "COMMITTED"
    }

    for item in queue:
        req_id = item.get("reqId") or str(uuid.uuid4())
        action = item.get("action")
        payload = item.get("payload") or {}

        if req_id in settled_keys:
            committed.append({"reqId": req_id, "action": action, "status": "ALREADY_SETTLED"})
            continue

        if action == "register":
            clean_name = re.sub(r"\s+", " ", str(payload.get("name") or "").strip())
            clean_phone = re.sub(r"[\s.\-]", "", str(payload.get("phone") or ""))
            req_member_id = norm_code(payload.get("id")) or next_member_id(state)
            if any(m.get("phone") == clean_phone for m in state.get("members", [])):
                rolled_back.append(
                    {
                        "reqId": req_id,
                        "action": "register",
                        "status": "ROLLED_BACK",
                        "reason": f"Số điện thoại {clean_phone} đã tồn tại trên Firebase khi đối soát.",
                    }
                )
                continue
            if find_member(state, req_member_id):
                req_member_id = next_member_id(state)
            new_m = {
                "id": req_member_id,
                "name": clean_name,
                "phone": clean_phone,
                "initialPoints": 0,
                "points": 0,
                "joined": (payload.get("joined") or now_iso())[:10],
                "status": "Đang hoạt động",
                "qrPayload": req_member_id,
            }
            state.setdefault("members", []).append(new_m)
            committed.append({"reqId": req_id, "action": "register", "memberId": req_member_id, "status": "COMMITTED"})

        elif action == "earn":
            member_code = norm_code(payload.get("memberCode") or payload.get("memberId"))
            tx_code = norm_code(payload.get("txCode") or payload.get("id"))
            amt = math.floor(float(payload.get("amount") or 0))
            pts = amt // int(LOYALTY_RULES["vndPerPoint"])
            member = find_member(state, member_code)

            if not member:
                rolled_back.append(
                    {
                        "reqId": req_id,
                        "action": "earn",
                        "txId": tx_code,
                        "memberId": member_code,
                        "status": "ROLLED_BACK",
                        "reason": f"Không tìm thấy hồ sơ thành viên {member_code} trên Firebase khi đối soát.",
                    }
                )
                continue

            if tx_exists(state, tx_code) or pts < 1:
                reason = (
                    f"Mã giao dịch {tx_code} đã tồn tại trên Firebase (trùng hóa đơn khi đối soát)."
                    if tx_exists(state, tx_code)
                    else "Số tiền giao dịch không hợp lệ khi đối soát."
                )
                reversal_tx = {
                    "id": f"REV-{tx_code}-{uuid.uuid4().hex[:4].upper()}",
                    "type": "reversal",
                    "memberId": member["id"],
                    "time": now_iso(),
                    "amount": amt,
                    "points": 0,
                    "revertedPoints": -pts,
                    "balance": member["points"],
                    "note": f"Bút toán đảo: Hủy cộng tạm {pts} điểm ({reason})",
                    "status": "ROLLED_BACK",
                    "originalTxId": tx_code,
                }
                state.setdefault("txs", []).append(reversal_tx)
                rolled_back.append(
                    {
                        "reqId": req_id,
                        "action": "earn",
                        "txId": tx_code,
                        "memberId": member["id"],
                        "revertedPoints": pts,
                        "balanceAfterRollback": member["points"],
                        "status": "ROLLED_BACK",
                        "reason": reason,
                    }
                )
                continue

            member["points"] = int(member.get("points", 0)) + pts
            tx_entry = {
                "id": tx_code,
                "type": "earn",
                "memberId": member["id"],
                "time": payload.get("time") or now_iso(),
                "amount": amt,
                "points": pts,
                "balance": member["points"],
                "note": "Đồng bộ từ hàng đợi Offline -> Firebase",
                "status": "COMMITTED",
                "idempotencyKey": req_id,
            }
            state.setdefault("txs", []).append(tx_entry)
            settled_keys.add(req_id)
            committed.append(
                {
                    "reqId": req_id,
                    "action": "earn",
                    "txId": tx_code,
                    "memberId": member["id"],
                    "points": pts,
                    "status": "COMMITTED",
                }
            )

        elif action == "redeem":
            member_code = norm_code(payload.get("memberCode") or payload.get("memberId"))
            reward_id = payload.get("rewardId")
            tx_code = norm_code(payload.get("txCode") or payload.get("id")) or f"DOI-{uuid.uuid4().hex[:6].upper()}"
            vch_id = norm_code(payload.get("voucherId")) or f"VC-{uuid.uuid4().hex[:6].upper()}"
            member = find_member(state, member_code)
            rewards = state.get("rewards") or SEED_REWARDS
            reward = next((r for r in rewards if r["id"] == reward_id), None)

            if not member or not reward:
                rolled_back.append(
                    {
                        "reqId": req_id,
                        "action": "redeem",
                        "txId": tx_code,
                        "status": "ROLLED_BACK",
                        "reason": "Thành viên hoặc mã ưu đãi không hợp lệ khi đối soát.",
                    }
                )
                continue

            cost = int(reward["cost"])
            if int(member.get("points", 0)) < cost:
                reason = (
                    f"Số dư thực tế trên Firebase ({member['points']} điểm) không đủ để trừ {cost} điểm "
                    f"cho {reward['name']}. Đã tự động hoàn điểm & hủy voucher tạm."
                )
                reversal_tx = {
                    "id": f"REV-{tx_code[:10]}-{uuid.uuid4().hex[:4].upper()}",
                    "type": "reversal",
                    "memberId": member["id"],
                    "time": now_iso(),
                    "amount": 0,
                    "points": 0,
                    "refundedPoints": cost,
                    "balance": member["points"],
                    "note": f"Bút toán hoàn điểm Ngân hàng: +{cost} điểm ({reward['name']} lỗi đối soát)",
                    "status": "ROLLED_BACK",
                    "originalTxId": tx_code,
                }
                state.setdefault("txs", []).append(reversal_tx)
                rolled_back.append(
                    {
                        "reqId": req_id,
                        "action": "redeem",
                        "txId": tx_code,
                        "memberId": member["id"],
                        "refundedPoints": cost,
                        "balanceAfterRollback": member["points"],
                        "status": "ROLLED_BACK",
                        "reason": reason,
                    }
                )
                continue

            member["points"] = int(member.get("points", 0)) - cost
            tx_entry = {
                "id": tx_code,
                "type": "redeem",
                "memberId": member["id"],
                "time": payload.get("time") or now_iso(),
                "amount": 0,
                "points": -cost,
                "balance": member["points"],
                "note": reward["name"],
                "status": "COMMITTED",
                "idempotencyKey": req_id,
            }
            voucher_entry = {
                "id": vch_id,
                "memberId": member["id"],
                "rewardId": reward["id"],
                "name": reward["name"],
                "desc": reward.get("desc", ""),
                "time": payload.get("time") or now_iso(),
                "status": "ACTIVE",
            }
            state.setdefault("txs", []).append(tx_entry)
            state.setdefault("wallet", []).append(voucher_entry)
            settled_keys.add(req_id)
            committed.append(
                {
                    "reqId": req_id,
                    "action": "redeem",
                    "txId": tx_code,
                    "memberId": member["id"],
                    "points": -cost,
                    "status": "COMMITTED",
                }
            )

    saved_ok, cloud_meta = await FIREBASE_STORE.save_state(state)
    if not saved_ok:
        return 503, {
            "ok": False,
            "offline": True,
            "activateLocalStorage": True,
            "cloud": cloud_meta,
            "error": "Đứt kết nối giữa chừng khi đẩy batch lên Firebase. Giữ nguyên hàng đợi để thử lại.",
        }

    return 200, {
        "ok": True,
        "committedCount": len(committed),
        "rolledBackCount": len(rolled_back),
        "committed": committed,
        "rolledBack": rolled_back,
        "state": state,
        "cloud": cloud_meta,
    }


async def simulate_bank_error_service(member_code: str, scenario: str) -> Tuple[int, Dict[str, Any]]:
    """Mô phỏng trực tiếp 1 ca giao dịch Offline bị lỗi khi đối soát Ngân hàng để Demo."""
    if scenario == "duplicate_tx_earn":
        fake_queue = [
            {
                "reqId": f"SIM-DUP-{uuid.uuid4().hex[:6].upper()}",
                "action": "earn",
                "payload": {
                    "memberCode": member_code or "KT-002",
                    "amount": 1500000,
                    "txCode": "TX-KT-002",
                },
            }
        ]
    else:
        fake_queue = [
            {
                "reqId": f"SIM-INSUF-{uuid.uuid4().hex[:6].upper()}",
                "action": "redeem",
                "payload": {
                    "memberCode": member_code or "KT-008",
                    "rewardId": "KT-VCH-03",
                    "txCode": f"DOI-ERR-{uuid.uuid4().hex[:4].upper()}",
                },
            }
        ]
    return await reconcile_offline_queue_service(fake_queue)


# =========================================================
# TRỢ LÝ AI DOANH NGHIỆP (TƯ VẤN QUẦY & PHÂN TÍCH TỆP KHÁCH)
# =========================================================
def _deterministic_advisor_fallback(mode: str, state: Dict[str, Any], member_code: Optional[str]) -> str:
    members = state.get("members", [])
    rewards = state.get("rewards") or SEED_REWARDS
    if mode in ("counter_member", "member_reward") and member_code:
        m = find_member(state, member_code)
        if not m:
            return f"Chưa tìm thấy hồ sơ thành viên {member_code}."
        pts = int(m.get("points", 0))
        cur_t = tier_of(pts)
        nxt_t = next_tier_of(pts)
        redeemable = [r for r in rewards if pts >= int(r["cost"])]
        lines = [
            f"• Hồ sơ {m['name']} ({m['id']}): đang có {pts:,} điểm – Hạng {cur_t['name']}.".replace(",", ".")
        ]
        if nxt_t:
            need_pts = nxt_t["min"] - pts
            need_vnd = need_pts * int(LOYALTY_RULES["vndPerPoint"])
            lines.append(
                f"• Cơ hội Upsell tại Quầy: Chỉ cần tích thêm {need_pts:,} điểm (tương đương đơn hàng {need_vnd:,}đ) là thăng lên Hạng {nxt_t['name']}!".replace(
                    ",", "."
                )
            )
        else:
            lines.append("• Khách hàng VIP đang ở Hạng Vàng cao nhất – ưu tiên chăm sóc đặc quyền.")
        if redeemable:
            best = redeemable[-1]
            lines.append(
                f"• Đổi ưu đãi ngay: Đủ điểm nhận \"{best['name']}\" ({best['cost']:,} điểm).".replace(",", ".")
            )
        else:
            cheapest = rewards[0]
            need_r = int(cheapest["cost"]) - pts
            lines.append(
                f"• Mục tiêu đổi quà: Cần thêm {need_r:,} điểm để đổi \"{cheapest['name']}\" ({cheapest['cost']} điểm).".replace(
                    ",", "."
                )
            )
        return "\n".join(lines)

    # Phân tích toàn bộ tệp khách hàng cho Doanh nghiệp
    total_m = len(members)
    dong_c = sum(1 for m in members if tier_of(m["points"])["key"] == "dong")
    bac_c = sum(1 for m in members if tier_of(m["points"])["key"] == "bac")
    vang_c = sum(1 for m in members if tier_of(m["points"])["key"] == "vang")
    near_up = [
        f"{m['name']} ({m['id']}: {m['points']} điểm, thiếu {next_tier_of(m['points'])['min'] - m['points']} điểm lên {next_tier_of(m['points'])['name']})"
        for m in members
        if next_tier_of(m["points"]) and (next_tier_of(m["points"])["min"] - m["points"]) <= 500
    ]
    zero_m = [f"{m['name']} ({m['id']})" for m in members if int(m.get("points", 0)) == 0]
    return (
        f"• Cơ cấu {total_m} thành viên: {vang_c} Vàng · {bac_c} Bạc · {dong_c} Đồng.\n"
        f"• Khách hàng sát mốc lên hạng cần đẩy doanh số: {', '.join(near_up) if near_up else 'Chưa có'}.\n"
        f"• Khách hàng mới (0 điểm) cần kích hoạt mua đơn đầu: {', '.join(zero_m) if zero_m else 'Không có'}."
    )


async def advisor_insight_service(
    mode: str,
    member_code: Optional[str] = None,
    custom_question: Optional[str] = None,
) -> Dict[str, Any]:
    state, cloud_meta = await FIREBASE_STORE.load_state()
    rule_summary = _deterministic_advisor_fallback(mode, state, member_code)

    if not cloud_meta["online"]:
        return {
            "ok": True,
            "text": rule_summary,
            "provider": "local-offline",
            "model": "rule-engine-v1",
            "offlineFallback": True,
            "cloud": cloud_meta,
        }

    prompt = (
        f"Dữ liệu tóm tắt từ hệ thống Thẻ thành viên Doanh nghiệp:\n{rule_summary}\n\n"
        f"Quy tắc: 10.000đ = 1 điểm; Đồng <1.000, Bạc 1.000-4.999, Vàng >=5.000; "
        f"Ưu đãi: Voucher 20.000đ (500đ), Voucher 50.000đ (1.100đ), Quà tặng đặc biệt (2.000đ).\n"
        f"{f'Câu hỏi thêm: {custom_question}' if custom_question else 'Hãy viết 3 gạch đầu dòng tư vấn ngắn gọn, thực chiến cho nhân viên/quản lý dựa trên số liệu trên.'}"
    )
    ai_res = await generate_ai(
        {
            "prompt": prompt,
            "maxTokens": 350,
            "temperature": 0.4,
        },
        allow_offline_fallback=True,
    )
    if not ai_res.get("ok") or ai_res.get("offlineFallback"):
        return {
            "ok": True,
            "text": rule_summary,
            "provider": "local-rule-advisor",
            "model": "deterministic-v1",
            "offlineFallback": True,
            "cloud": cloud_meta,
        }
    return {
        **ai_res,
        "cloud": cloud_meta,
    }
