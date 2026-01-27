from playwright.sync_api import sync_playwright

def verify_spotlight(page):
    """
    Navigates to the local server, captures console logs, and takes a screenshot.
    """
    # Listen for all console events and print them
    page.on("console", lambda msg: print(f"Browser Console: {msg.text}"))

    page.goto("http://localhost:8000")
    page.wait_for_selector('canvas')
    page.wait_for_timeout(2000)
    page.screenshot(path="/home/jules/verification/verification.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            # Create a verification directory
            import os
            os.makedirs('/home/jules/verification', exist_ok=True)
            verify_spotlight(page)
            print("Screenshot saved to /home/jules/verification/verification.png")
        finally:
            browser.close()
