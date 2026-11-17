"""Bộ kiểm thử toàn diện cho FastAPI Backend (Nghiệp vụ BTC TC-KT-01..04, Offline Sync, Banking Rollback, AI Fallback)."""
from __future__ import annotations

import asyncio
from fastapi.testclient import TestClient

from main import app
from app.firebase_store import FIREBASE_STORE, build_initial_seed_state


def run_tests() -> None:
    # Mock save/load để test nhanh & độc lập, đồng thời kiểm tra cả kết nối thật
    client = TestClient(app)

    # 1. Kiểm tra /api/health
    r_health = client.get("/api/health")
    assert r_health.status_code == 200
    h_data = r_health.json()
    assert h_data["ok"] is True
    providers = [p["provider"] for p in h_data["providers"]]
    assert providers == ["gemini", "openrouter", "gemini2"], f"Sai thứ tự provider: {providers}"
    print("✓ [1/7] /api/health & Thứ tự AI (gemini -> openrouter -> gemini2) chuẩn xác")

    # 2. Nạp dữ liệu mẫu BTC (/api/loyalty/seed)
    r_seed = client.post("/api/loyalty/seed")
    assert r_seed.status_code == 200
    s_data = r_seed.json()
    assert s_data["ok"] is True
    assert len(s_data["state"]["members"]) >= 8
    kt004 = next(m for m in s_data["state"]["members"] if m["id"] == "KT-004")
    assert kt004["name"] == "Dũng Phạm" and kt004["points"] == 3200
    print(f"✓ [2/7] /api/loyalty/seed nạp chuẩn 8 thành viên BTC lên Firebase (online={s_data['cloud']['online']})")

    # 3. TC-KT-01: Cộng điểm mới cho KT-008 (TX-NEW-001, 1.000.000đ -> +100 điểm, số dư 0 -> 100)
    r_tc1 = client.post(
        "/api/loyalty/earn",
        json={"memberCode": "KT-008", "amount": 1000000, "txCode": "TX-NEW-001"},
    )
    assert r_tc1.status_code == 200
    d_tc1 = r_tc1.json()
    assert d_tc1["points"] == 100
    assert d_tc1["member"]["points"] == 100
    print("✓ [3/7] TC-KT-01: Cộng 100 điểm cho KT-008 (0 -> 100) thành công")

    # 4. TC-KT-02: Nhập lại giao dịch TX-KT-002 cho KT-002 -> Báo trùng, không cộng thêm
    r_tc2 = client.post(
        "/api/loyalty/earn",
        json={"memberCode": "KT-002", "amount": 1500000, "txCode": "TX-KT-002"},
    )
    assert r_tc2.status_code == 409
    d_tc2 = r_tc2.json()
    assert d_tc2["duplicate"] is True
    print("✓ [4/7] TC-KT-02: Chặn cộng trùng mã giao dịch TX-KT-002 thành công")

    # 5. TC-KT-03 & TC-KT-04: Đổi ưu đãi đủ điểm (KT-005) và thiếu điểm (KT-008)
    r_tc3 = client.post(
        "/api/loyalty/redeem",
        json={"memberCode": "KT-005", "rewardId": "KT-VCH-01"},
    )
    assert r_tc3.status_code == 200
    assert r_tc3.json()["member"]["points"] == 5300

    r_tc4 = client.post(
        "/api/loyalty/redeem",
        json={"memberCode": "KT-008", "rewardId": "KT-VCH-01"},
    )
    assert r_tc4.status_code == 400
    assert r_tc4.json()["insufficient"] is True
    print("✓ [5/7] TC-KT-03 (5800 -> 5300) & TC-KT-04 (Từ chối khi thiếu điểm) thành công")

    # 6. Kiểm tra phát hiện Mất mạng -> Kích hoạt localStorage -> Có mạng lại đối soát & Rollback Ngân hàng
    client.post("/api/loyalty/network-mode", json={"offline": True})
    r_off = client.post(
        "/api/loyalty/earn",
        json={"memberCode": "KT-004", "amount": 500000, "txCode": "TX-OFF-001"},
    )
    assert r_off.status_code == 503
    assert r_off.json()["activateLocalStorage"] is True

    # Bật mạng trở lại và đẩy hàng đợi localStorage (1 giao dịch hợp lệ + 1 giao dịch trùng mã TX-KT-004 + 1 đổi quà thiếu điểm)
    client.post("/api/loyalty/network-mode", json={"offline": False})
    r_sync = client.post(
        "/api/loyalty/sync",
        json={
            "clientId": "test-pos-01",
            "queue": [
                {
                    "reqId": "REQ-OK-1",
                    "action": "earn",
                    "payload": {"memberCode": "KT-004", "amount": 500000, "txCode": "TX-OFF-001"},
                },
                {
                    "reqId": "REQ-DUP-2",
                    "action": "earn",
                    "payload": {"memberCode": "KT-004", "amount": 2000000, "txCode": "TX-KT-004"},
                },
                {
                    "reqId": "REQ-INSUF-3",
                    "action": "redeem",
                    "payload": {"memberCode": "KT-008", "rewardId": "KT-VCH-03", "txCode": "DOI-OFF-ERR"},
                },
            ],
        },
    )
    assert r_sync.status_code == 200
    sync_data = r_sync.json()
    assert sync_data["committedCount"] == 1
    assert sync_data["rolledBackCount"] == 2
    print("✓ [6/7] Đối soát Offline -> Firebase & Tự động Rollback Ngân hàng (1 COMMITTED, 2 ROLLED_BACK) thành công")

    # Khôi phục lại dữ liệu mẫu sạch trên Firebase sau khi test
    client.post("/api/loyalty/seed")

    # 7. Kiểm tra AI Advisor (/api/loyalty/ai-advisor)
    r_adv = client.post(
        "/api/loyalty/ai-advisor",
        json={"mode": "counter_member", "memberCode": "KT-007"},
    )
    assert r_adv.status_code == 200
    adv_data = r_adv.json()
    assert adv_data["ok"] is True and len(adv_data["text"]) > 10
    print(f"✓ [7/7] AI Advisor hoạt động tốt (provider={adv_data.get('provider')})")
    print("\n🎉 TẤT CẢ 7/7 BÀI KIỂM THỬ FASTAPI BACKEND + FIREBASE + AI FALLBACK ĐỀU VƯỢT QUA!")


if __name__ == "__main__":
    run_tests()
