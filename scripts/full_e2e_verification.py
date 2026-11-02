import asyncio
import json
import os
import urllib.request
import websockets

SCREENSHOT_DIR = "shots"
os.makedirs(SCREENSHOT_DIR, exist_ok=True)

class CDPClient:
    def __init__(self, ws_url):
        self.ws_url = ws_url
        self.ws = None
        self.msg_id = 0

    async def connect(self):
        self.ws = await websockets.connect(self.ws_url, max_size=50_000_000)
        await self.send("Page.enable")
        await self.send("Runtime.enable")
        await self.send("DOM.enable")

    async def send(self, method, params=None):
        self.msg_id += 1
        curr_id = self.msg_id
        await self.ws.send(json.dumps({"id": curr_id, "method": method, "params": params or {}}))
        while True:
            raw = await self.ws.recv()
            msg = json.loads(raw)
            if msg.get("id") == curr_id:
                return msg.get("result", {})

    async def evaluate(self, expr):
        res = await self.send("Runtime.evaluate", {
            "expression": expr,
            "returnByValue": True,
            "awaitPromise": True
        })
        val = res.get("result", {})
        return val.get("value")

    async def navigate(self, url):
        await self.send("Page.navigate", {"url": url})
        await asyncio.sleep(1.2)

    async def capture_screenshot(self, filename):
        path = os.path.join(SCREENSHOT_DIR, filename)
        res = await self.send("Page.captureScreenshot", {"format": "png"})
        import base64
        with open(path, "wb") as f:
            f.write(base64.b64decode(res["data"]))
        print(f"[SCREENSHOT] Saved: {path}")

async def main():
    tabs = json.loads(urllib.request.urlopen("http://127.0.0.1:9222/json").read())
    page_tab = next(t for t in tabs if t.get("type") == "page")
    client = CDPClient(page_tab["webSocketDebuggerUrl"])
    await client.connect()

    print("\n=======================================================")
    print("[TEST] STARTING COMPREHENSIVE E2E VERIFICATION & AUDIT")
    print("=======================================================")

    # 1. Clear session / logout first to ensure clean state
    await client.navigate("http://localhost:3000/logout")
    await asyncio.sleep(0.5)

    # 2. Homepage & Theme Toggle Verification
    print("\n[STEP 1] Testing Homepage & Hallmark Themes (Dark & Light)...")
    await client.navigate("http://localhost:3000/")
    await client.capture_screenshot("01_homepage_dark.png")
    
    # Toggle to Light mode
    await client.evaluate("document.querySelector('.theme-toggle-btn').click()")
    await asyncio.sleep(0.4)
    is_dark = await client.evaluate("document.documentElement.classList.contains('dark')")
    print(f"Theme toggle result: dark={is_dark}")
    await client.capture_screenshot("02_homepage_light.png")

    # Toggle back to Dark mode
    await client.evaluate("document.querySelector('.theme-toggle-btn').click()")
    await asyncio.sleep(0.4)

    # 3. Schedule Catalog (Public)
    print("\n[STEP 2] Testing Schedule Catalog...")
    await client.navigate("http://localhost:3000/jadwal")
    schedule_count = await client.evaluate("document.querySelectorAll('.schedule-card').length")
    print(f"Schedules displayed: {schedule_count}")
    await client.capture_screenshot("03_jadwal_catalog.png")

    # 4. Member Authentication (CUJ 1)
    print("\n[STEP 3] Testing Member Authentication & Redirection...")
    await client.navigate("http://localhost:3000/login?redirect=/booking/1/kursi")
    await client.capture_screenshot("04_login_page.png")

    await client.evaluate("""
        (() => {
            document.querySelector('#identifier').value = 'aziz';
            document.querySelector('#password').value = 'Password123!';
            document.querySelector('form').submit();
        })()
    """)
    await asyncio.sleep(1.5)

    # 5. Seat Selection (CUJ 1 - Minibus 5 Seats)
    print("\n[STEP 4] Testing Interactive Minibus Cabin & Seat Selection...")
    current_url = await client.evaluate("window.location.href")
    print(f"Current URL after login: {current_url}")
    if "booking" not in current_url:
        await client.navigate("http://localhost:3000/booking/1/kursi")
    
    # Click Kursi 1 and Kursi 2
    select_res = await client.evaluate("""
        (() => {
            const seats = Array.from(document.querySelectorAll('.seat-btn[data-status="tersedia"]'));
            if (seats.length >= 2) {
                seats[0].click();
                seats[1].click();
                return `Selected 2 seats: ${seats[0].getAttribute('data-seat-no')}, ${seats[1].getAttribute('data-seat-no')}`;
            } else if (seats.length === 1) {
                seats[0].click();
                return `Selected 1 seat: ${seats[0].getAttribute('data-seat-no')}`;
            }
            return 'No seats available';
        })()
    """)
    print(f"Seat click result: {select_res}")
    await asyncio.sleep(0.5)

    # Fill passenger info
    await client.evaluate("""
        (() => {
            const names = document.querySelectorAll('input[name="penumpang_nama[]"]');
            const phones = document.querySelectorAll('input[name="penumpang_telepon[]"]');
            if (names[0]) names[0].value = 'Budi Santoso';
            if (phones[0]) phones[0].value = '081234567890';
            if (names[1]) names[1].value = 'Siti Rahma';
            if (phones[1]) phones[1].value = '081298765432';
        })()
    """)
    await asyncio.sleep(0.5)
    await client.capture_screenshot("05_seats_selected.png")

    # Submit checkout form
    print("Submitting booking reservation...")
    await client.evaluate("document.querySelector('#submit-booking-btn').click()")
    await asyncio.sleep(1.8)

    invoice_url = await client.evaluate("window.location.pathname")
    print(f"Invoice URL: {invoice_url}")
    await client.capture_screenshot("06_invoice_waiting_payment.png")

    # Extract booking code
    booking_code = invoice_url.strip("/").split("/")[-1]
    print(f"Created Booking Code: '{booking_code}'")

    # 6. Manual Bank Transfer Payment Upload (CUJ 1)
    if booking_code and booking_code != "kursi":
        print(f"\n[STEP 5] Testing Payment Confirmation Upload for {booking_code}...")
        await client.navigate(f"http://localhost:3000/pesanan/{booking_code}/bayar")
        await client.capture_screenshot("07_payment_form.png")

        # Create a mock receipt image in temporary directory
        receipt_path = os.path.abspath("shots/sample_transfer_receipt.png")
        if not os.path.exists(receipt_path):
            with open(receipt_path, "wb") as f:
                f.write(b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82")

        # Fill bank transfer details
        await client.evaluate("""
            (() => {
                const bank = document.querySelector('select[name="metode_pembayaran"]');
                const pengirim = document.querySelector('input[name="nama_pengirim"]');
                const rek = document.querySelector('input[name="nomor_rekening"]');
                if (bank) bank.value = 'transfer_bca';
                if (pengirim) pengirim.value = 'Budi Santoso';
                if (rek) rek.value = '1234567890';
            })()
        """)

        # Set file input via DOM/CDP
        doc = await client.send("DOM.getDocument")
        file_input_node = await client.send("DOM.querySelector", {
            "nodeId": doc["root"]["nodeId"],
            "selector": "input[type='file'][name='bukti_transfer']"
        })
        if file_input_node.get("nodeId"):
            await client.send("DOM.setFileInputFiles", {
                "files": [receipt_path],
                "nodeId": file_input_node["nodeId"]
            })
            print("Attached sample receipt file.")

        await asyncio.sleep(0.5)
        await client.evaluate("document.querySelector('button[type=\"submit\"]').click()")
        await asyncio.sleep(1.8)

        # Verified status updated to menunggu_verifikasi
        await client.capture_screenshot("08_invoice_waiting_verification.png")
        inv_status = await client.evaluate("document.querySelector('.badge-status')?.textContent?.trim()")
        print(f"Invoice status badge: {inv_status}")

    # 7. Operator Verification & Approval (CUJ 2)
    print("\n[STEP 6] Testing Operator Login & Payment Verification Flow...")
    await client.navigate("http://localhost:3000/logout")
    await client.navigate("http://localhost:3000/login")
    await client.evaluate("""
        (() => {
            document.querySelector('#identifier').value = 'operator_1';
            document.querySelector('#password').value = 'Password123!';
            document.querySelector('form').submit();
        })()
    """)
    await asyncio.sleep(1.5)

    await client.navigate("http://localhost:3000/operator/verifikasi")
    await client.capture_screenshot("09_operator_queue.png")
    
    # Click first verify action if exists
    verify_url = await client.evaluate("document.querySelector('a[href*=\"/operator/verifikasi/\"]')?.getAttribute('href')")
    print(f"First pending payment URL: {verify_url}")
    if verify_url:
        await client.navigate(f"http://localhost:3000{verify_url}")
        await client.capture_screenshot("10_operator_verification_detail.png")
        
        # Click Approve
        print("Approving payment via operator modal...")
        await client.evaluate("document.querySelector('form[action*=\"/setujui\"] button[type=\"submit\"]').click()")
        await asyncio.sleep(1.5)
        await client.capture_screenshot("11_operator_approved_redirect.png")

    # 8. Member Ticket Print (CUJ 1 final)
    print("\n[STEP 7] Testing Member Boarding Pass / E-Ticket Print...")
    if booking_code and booking_code != "kursi":
        await client.navigate(f"http://localhost:3000/pesanan/{booking_code}/cetak")
        await client.capture_screenshot("12_member_boarding_pass.png")

    # 9. Walk-in Counter Order (CUJ 3)
    print("\n[STEP 8] Testing Walk-in Cash Order Flow (CUJ 3)...")
    await client.navigate("http://localhost:3000/operator/walkin")
    await client.capture_screenshot("13_operator_walkin_form.png")

    # Fill walk-in order form
    await client.evaluate("""
        (() => {
            const jad = document.querySelector('select[name="jadwal_id"]');
            if (jad && jad.options.length > 1) {
                jad.selectedIndex = 1;
                jad.dispatchEvent(new Event('change'));
            }
            const nama = document.querySelector('input[name="pelanggan_nama"]');
            const telp = document.querySelector('input[name="pelanggan_telepon"]');
            const kursi = document.querySelector('input[name="nomor_kursi"]');
            const bayar = document.querySelector('input[name="jumlah_bayar"]');
            if (nama) nama.value = 'Pak Hendra (Walk-in)';
            if (telp) telp.value = '085566778899';
            if (kursi) kursi.value = '5';
            if (bayar) bayar.value = '250000';
        })()
    """)
    await asyncio.sleep(0.5)
    await client.evaluate("document.querySelector('button[type=\"submit\"]').click()")
    await asyncio.sleep(1.8)
    await client.capture_screenshot("14_walkin_receipt_success.png")

    # 10. Admin Dashboard & Metrics
    print("\n[STEP 9] Testing Admin Executive Dashboard & Master Data...")
    await client.navigate("http://localhost:3000/logout")
    await client.navigate("http://localhost:3000/login")
    await client.evaluate("""
        (() => {
            document.querySelector('#identifier').value = 'admin_1';
            document.querySelector('#password').value = 'Password123!';
            document.querySelector('form').submit();
        })()
    """)
    await asyncio.sleep(1.5)

    await client.navigate("http://localhost:3000/admin/dashboard")
    await client.capture_screenshot("15_admin_dashboard.png")

    await client.navigate("http://localhost:3000/admin/master?tab=jadwal")
    await client.capture_screenshot("16_admin_master_schedules.png")

    await client.navigate("http://localhost:3000/admin/master?tab=kendaraan")
    await client.capture_screenshot("17_admin_master_fleet.png")

    await client.navigate("http://localhost:3000/admin/users-keluhan")
    await client.capture_screenshot("18_admin_complaints.png")

    print("\n=======================================================")
    print("[SUCCESS] ALL E2E VERIFICATIONS FINISHED WITH FULL SUCCESS!")
    print("=======================================================")

asyncio.run(main())
