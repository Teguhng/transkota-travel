import asyncio
import json
import urllib.request
import websockets

async def run():
    tab = json.loads(urllib.request.urlopen("http://127.0.0.1:9222/json").read())[0]
    ws_url = tab["webSocketDebuggerUrl"]
    
    async with websockets.connect(ws_url, max_size=50_000_000) as ws:
        msg_id = 0
        async def send(method, params=None):
            nonlocal msg_id
            msg_id += 1
            curr_id = msg_id
            await ws.send(json.dumps({"id": curr_id, "method": method, "params": params or {}}))
            while True:
                msg = json.loads(await ws.recv())
                if msg.get("id") == curr_id:
                    return msg.get("result", {})

        # Navigate to login
        print("Navigating to /login...")
        await send("Page.navigate", {"url": "http://localhost:3000/login"})
        await asyncio.sleep(1.0)
        
        # Fill login form and click submit button
        print("Logging in as aziz...")
        res = await send("Runtime.evaluate", {
            "expression": """
                (() => {
                    const idInput = document.querySelector('input[name="identifier"]');
                    const passInput = document.querySelector('input[name="password"]');
                    const btn = document.querySelector('button[type="submit"]');
                    if (idInput && passInput && btn) {
                        idInput.value = 'aziz';
                        passInput.value = 'Password123!';
                        btn.click();
                        return 'clicked submit';
                    }
                    return 'inputs not found';
                })()
            """,
            "returnByValue": True
        })
        print("Submit login:", res)
        await asyncio.sleep(1.5)
        
        # Now navigate to /booking/1/kursi
        print("Navigating to /booking/1/kursi...")
        await send("Page.navigate", {"url": "http://localhost:3000/booking/1/kursi"})
        await asyncio.sleep(1.5)
        
        # Check current URL
        url_res = await send("Runtime.evaluate", {"expression": "window.location.href", "returnByValue": True})
        print("Current URL:", url_res.get("result", {}).get("value"))
        
        # Inspect seats
        seats_res = await send("Runtime.evaluate", {
            "expression": """
                (() => {
                    const btns = Array.from(document.querySelectorAll('.seat-btn'));
                    return btns.map(b => ({
                        no: b.getAttribute('data-seat-no'),
                        status: b.getAttribute('data-status'),
                        disabled: b.disabled,
                        classes: b.className
                    }));
                })()
            """,
            "returnByValue": True
        })
        print("Seats found:", seats_res.get("result", {}).get("value"))

asyncio.run(run())

