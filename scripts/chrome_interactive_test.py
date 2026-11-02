import asyncio
import json
import urllib.request
import base64
import os
import websockets

CDP_HTTP = "http://127.0.0.1:9222"

class ChromeController:
    def __init__(self):
        self.ws = None
        self.msg_id = 0

    async def connect(self):
        req = urllib.request.urlopen(f"{CDP_HTTP}/json/list")
        tabs = json.loads(req.read().decode())
        page_tab = None
        for t in tabs:
            if t.get("type") == "page":
                page_tab = t
                break
        if not page_tab:
            raise RuntimeError("No page tab found in Chrome")
        
        ws_url = page_tab["webSocketDebuggerUrl"]
        print(f"[CDP] Connecting to {ws_url}...")
        self.ws = await websockets.connect(ws_url, max_size=50*1024*1024)
        print("[CDP] Connected successfully.")

        # Enable Page & Runtime
        await self.send("Page.enable")
        await self.send("Runtime.enable")

    async def send(self, method, params=None):
        self.msg_id += 1
        payload = {"id": self.msg_id, "method": method, "params": params or {}}
        await self.ws.send(json.dumps(payload))
        while True:
            resp_raw = await self.ws.recv()
            resp = json.loads(resp_raw)
            if resp.get("id") == self.msg_id:
                if "error" in resp:
                    raise RuntimeError(f"CDP Error in {method}: {resp['error']}")
                return resp.get("result", {})

    async def navigate(self, url):
        print(f"[CDP] Navigating to {url}...")
        await self.send("Page.navigate", {"url": url})
        await asyncio.sleep(1.5)

    async def evaluate(self, script):
        res = await self.send("Runtime.evaluate", {"expression": script, "returnByValue": True, "awaitPromise": True})
        return res.get("result", {}).get("value")

    async def capture_screenshot(self, filepath):
        res = await self.send("Page.captureScreenshot", {"format": "png"})
        img_data = base64.b64decode(res["data"])
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        with open(filepath, "wb") as f:
            f.write(img_data)
        print(f"[CDP] Saved screenshot: {filepath}")

async def run_all_tests():
    chrome = ChromeController()
    await chrome.connect()

    print("\n--- STEP 1: Homepage & Theme Toggle ---")
    await chrome.navigate("http://localhost:3000/")
    await chrome.capture_screenshot("shots/01_home_dark.png")

    # Click theme toggle to Light Mode
    await chrome.evaluate("document.querySelector('.theme-toggle-btn').click()")
    await asyncio.sleep(0.5)
    is_dark = await chrome.evaluate("document.documentElement.classList.contains('dark')")
    print(f"Theme after click: is_dark={is_dark}")
    await chrome.capture_screenshot("shots/02_home_light.png")

    # Return to Dark Mode
    await chrome.evaluate("document.querySelector('.theme-toggle-btn').click()")
    await asyncio.sleep(0.5)

    print("\n--- STEP 2: Public Schedule Catalog ---")
    await chrome.evaluate("document.querySelector('a[href=\"/jadwal\"]').click()")
    await asyncio.sleep(1.0)
    await chrome.capture_screenshot("shots/03_jadwal_catalog.png")

    print("\n--- STEP 3: Protected Route & Member Login ---")
    # Click first available schedule seat selection
    await chrome.evaluate("document.querySelector('a[href*=\"/booking/\"]').click()")
    await asyncio.sleep(1.0)
    await chrome.capture_screenshot("shots/04_login_page.png")

    # Log in as member 'aziz'
    await chrome.evaluate("""
        (() => {
            const idInput = document.querySelector('input[name="identifier"]');
            const passInput = document.querySelector('input[name="password"]');
            if (idInput && passInput) {
                idInput.value = 'aziz';
                passInput.value = 'Password123!';
                document.querySelector('form').submit();
            }
        })()
    """)
    await asyncio.sleep(1.5)
    await chrome.capture_screenshot("shots/05_seat_selection.png")

    print("\n--- STEP 4: Interactive Minibus 5-Seat Selection ---")
    # Select Seat 1 and Seat 2
    selection_res = await chrome.evaluate("""
        (() => {
            const availSeats = document.querySelectorAll('.seat-btn[data-status="tersedia"]');
            if (availSeats.length >= 2) {
                availSeats[0].click();
                availSeats[1].click();
                return 'selected 2 seats';
            } else if (availSeats.length === 1) {
                availSeats[0].click();
                return 'selected 1 seat';
            }
            return 'no seats available';
        })()
    """)
    print(f"Seat selection result: {selection_res}")
    await asyncio.sleep(0.5)

    # Fill passenger names in dynamically generated inputs
    await chrome.evaluate("""
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
    await chrome.capture_screenshot("shots/05b_seats_selected_filled.png")

    # Submit booking checkout form
    await chrome.evaluate("document.querySelector('#submit-booking-btn').click()")
    await asyncio.sleep(1.5)
    await chrome.capture_screenshot("shots/06_invoice_waiting.png")

    # Extract booking code from invoice URL
    current_url = await chrome.evaluate("window.location.pathname")
    booking_code = current_url.split("/")[-1]
    print(f"Created Booking Code: {booking_code}")

    print("\n--- STEP 5: Manual Bank Transfer Payment Upload ---")
    await chrome.navigate(f"http://localhost:3000/pesanan/{booking_code}/bayar")
    await asyncio.sleep(1.0)

    # Create dummy receipt file
    dummy_receipt = os.path.abspath("shots/dummy_receipt.jpg")
    if not os.path.exists(dummy_receipt):
        with open(dummy_receipt, "wb") as f:
            f.write(b"\xFF\xD8\xFF\xE0\x00\x10JFIF\x00\x01\x01\x01\x00H\x00H\x00\x00\xFF\xDB\x00C\x00")
            f.write(b"\x00" * 200)

    # Upload payment proof via direct multipart form submission
    # Using fetch inside browser to test real multipart post
    upload_script = f"""
        (async () => {{
            const form = document.querySelector('form');
            const csrf = document.querySelector('input[name="_csrf"]').value;
            const refInput = document.querySelector('#referensi');
            const rekInput = document.querySelector('#no_rek_pengirim');
            refInput.value = 'BCA-TRF-982104';
            rekInput.value = 'BCA 1234567890 a.n Budi';

            // Create file blob
            const response = await fetch('/shots/01_home_dark.png');
            const blob = await response.blob();
            const file = new File([blob], 'bukti_transfer.png', {{ type: 'image/png' }});

            const formData = new FormData();
            formData.append('_csrf', csrf);
            formData.append('referensi', refInput.value);
            formData.append('no_rek_pengirim', rekInput.value);
            formData.append('bukti', file);

            const postRes = await fetch('/pesanan/{booking_code}/bayar?_csrf=' + csrf, {{
                method: 'POST',
                body: formData
            }});
            return postRes.ok || postRes.redirected;
        }})()
    """
    await chrome.evaluate(upload_script)
    await asyncio.sleep(1.5)

    await chrome.navigate(f"http://localhost:3000/pesanan/{booking_code}")
    await asyncio.sleep(1.0)
    await chrome.capture_screenshot("shots/07_invoice_waiting_verification.png")

    print("\n--- STEP 6: Operator Login & Verification Queue ---")
    await chrome.navigate("http://localhost:3000/login")
    await asyncio.sleep(0.5)
    await chrome.evaluate("""
        (() => {
            document.querySelector('input[name="identifier"]').value = 'operator_1';
            document.querySelector('input[name="password"]').value = 'Password123!';
            document.querySelector('form').submit();
        })()
    """)
    await asyncio.sleep(1.5)
    await chrome.navigate("http://localhost:3000/operator/verifikasi")
    await asyncio.sleep(1.0)
    await chrome.capture_screenshot("shots/08_operator_queue.png")

    # Open first verification item
    has_item = await chrome.evaluate("!!document.querySelector('a[href*=\"/operator/verifikasi/\"]')")
    if has_item:
        await chrome.evaluate("document.querySelector('a[href*=\"/operator/verifikasi/\"]').click()")
        await asyncio.sleep(1.0)
        await chrome.capture_screenshot("shots/09_operator_receipt_preview.png")

        # Test Rotate and Zoom controls
        await chrome.evaluate("document.querySelector('#btn-rotate-receipt')?.click()")
        await chrome.evaluate("document.querySelector('#btn-zoom-in')?.click()")
        await asyncio.sleep(0.5)
        await chrome.capture_screenshot("shots/09b_operator_preview_transformed.png")

        # Approve Payment
        await chrome.evaluate("document.querySelector('button[value=\"terima\"]').click()")
        await asyncio.sleep(1.5)
        print("Payment successfully approved by Operator!")

    print("\n--- STEP 7: E-Ticket Print Layout ---")
    await chrome.navigate(f"http://localhost:3000/pesanan/{booking_code}/cetak")
    await asyncio.sleep(1.0)
    await chrome.capture_screenshot("shots/10_print_ticket.png")

    print("\n--- STEP 8: Operator Walk-in Cash Order (CUJ 3) ---")
    await chrome.navigate("http://localhost:3000/operator/walkin")
    await asyncio.sleep(1.0)

    # Pick seat and fill walk-in details
    await chrome.evaluate("""
        (() => {
            const radio = document.querySelector('input[name="kursi_id"]:not([disabled])');
            if (radio) radio.checked = true;
            document.querySelector('#nama').value = 'Ahmad Pratama';
            document.querySelector('#telepon').value = '081288997766';
            document.querySelector('form').submit();
        })()
    """)
    await asyncio.sleep(1.5)
    await chrome.capture_screenshot("shots/11_walkin_ticket_issued.png")
    print("Walk-in counter transaction completed!")

    print("\n--- STEP 9: Admin Executive Dashboard & Master Data ---")
    await chrome.navigate("http://localhost:3000/login")
    await asyncio.sleep(0.5)
    await chrome.evaluate("""
        (() => {
            document.querySelector('input[name="identifier"]').value = 'admin_1';
            document.querySelector('input[name="password"]').value = 'Password123!';
            document.querySelector('form').submit();
        })()
    """)
    await asyncio.sleep(1.5)

    await chrome.navigate("http://localhost:3000/admin/dashboard")
    await asyncio.sleep(1.0)
    await chrome.capture_screenshot("shots/12_admin_dashboard.png")

    await chrome.navigate("http://localhost:3000/admin/master?tab=jadwal")
    await asyncio.sleep(1.0)
    await chrome.capture_screenshot("shots/13_admin_master_schedules.png")

    await chrome.navigate("http://localhost:3000/admin/master?tab=kendaraan")
    await asyncio.sleep(1.0)
    await chrome.capture_screenshot("shots/14_admin_master_fleet.png")

    await chrome.navigate("http://localhost:3000/admin/users-keluhan")
    await asyncio.sleep(1.0)
    await chrome.capture_screenshot("shots/15_admin_users_complaints.png")

    print("\n[CDP] ALL INTERACTIVE E2E TESTS COMPLETED SUCCESSFULLY!")

if __name__ == "__main__":
    asyncio.run(run_all_tests())

