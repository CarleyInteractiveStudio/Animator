import asyncio
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1280, "height": 720})
        await page.goto("http://localhost:8080")
        await page.wait_for_timeout(2000)

        # Click top navbar "Crear Objeto"
        await page.click("text=Crear Objeto")
        await page.wait_for_timeout(300)
        await page.click('[data-create="cloud"]')
        await page.wait_for_timeout(1000)

        await page.screenshot(path="/home/jules/verification/screenshots/cloud_enhanced.png")
        await browser.close()

asyncio.run(run())
