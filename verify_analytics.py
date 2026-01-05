from playwright.sync_api import sync_playwright
import json
from datetime import datetime

def verify_analytics(page):
    # Enable console logging for debugging
    page.on("console", lambda msg: print(f"Console: {msg.text}"))

    # 1. Navigate to the app
    # Using localhost:8080 as started in previous step
    page.goto("http://localhost:8080/index.html")

    # Wait for app initialization (App.init)
    page.wait_for_timeout(3000)

    # Check for API Key Modal and handle it
    if page.locator("#modal-apikey.active").count() > 0:
        print("API Key Modal detected. Entering dummy key...")
        page.fill("#inp-apikey", "dummy_key_123")
        page.click("text=Salvar e Iniciar")
        page.wait_for_timeout(1000)

    # Check for Onboarding Overlay and handle it
    if page.locator("#onboarding-overlay").is_visible():
        print("Onboarding detected. Filling form...")
        page.fill("#onb-name", "Test User")
        page.fill("#onb-weight", "70")
        page.fill("#onb-height", "175")
        page.fill("#onb-age", "30")
        # Click "Começar Jornada"
        page.click("text=Começar Jornada")
        page.wait_for_timeout(2000)

    # SEED DATA: Add a meal with symptoms via localStorage manipulation
    print("Seeding data via localStorage...")

    # Prefix is "quantix_ultimate_v2_"
    # Key is "meals"

    script = """
    () => {
        const prefix = "quantix_ultimate_v2_";
        const now = new Date();
        const dateKey = now.toISOString().split('T')[0];

        const meal = {
            id: Date.now(),
            timestamp: now.toISOString(),
            dateKey: dateKey,
            desc: "Feijoada Completa (Teste)",
            cals: 850,
            macros: {p: 45, c: 90, f: 35, fib: 12},
            category: "Almoço",
            type: "food",
            score: 4, // Low score to trigger feedback
            symptoms: ["bloated", "sleepy", "nauseous"],
            micros: { sodium: 1200, sugar: 5, potassium: 500 }
        };

        const meals = JSON.parse(localStorage.getItem(prefix + 'meals') || '[]');
        meals.push(meal);
        localStorage.setItem(prefix + 'meals', JSON.stringify(meals));

        // Also update profile to ensure correct BMR/TDEE if needed
        // but onboarding handled that.

        // Reload page to pick up changes
        location.reload();
    }
    """
    page.evaluate(script)

    # Wait for reload
    page.wait_for_timeout(3000)

    # Handle modals again if they appear after reload (API key might persist, Onboarding shouldn't)
    # API key is saved in localStorage 'quantix_ultimate_v2_api_key' manually?
    # App.saveApiKey() saves to 'quantix_ultimate_v2_api_key'.
    # So it should persist.

    # But checking just in case
    if page.locator("#modal-apikey.active").count() > 0:
        print("API Key Modal detected again.")
        page.fill("#inp-apikey", "dummy_key_123")
        page.click("text=Salvar e Iniciar")
        page.wait_for_timeout(1000)

    # 2. Navigate to Analytics Tab
    # Text is "Análise"
    print("Clicking Análise tab...")
    page.get_by_text("Análise").click()

    page.wait_for_timeout(2000) # Wait for animation/render

    # 3. Scroll to new charts to take screenshots

    # Take screenshot of the whole page
    page.screenshot(path="/home/jules/verification/analytics_full.png", full_page=True)

    # Also take targeted screenshots of the charts to see the legends clearly

    charts = [
        'chart-meal-dist',
        'chart-energy-balance',
        'chart-quality-matrix',
        'chart-top-offenders',
        'chart-symptoms'
    ]

    for chart_id in charts:
        print(f"Screenshotting {chart_id}...")
        loc = page.locator(f"#{chart_id}")
        if loc.count() > 0:
            container = page.locator(f"#{chart_id}")
            container.scroll_into_view_if_needed()
            page.wait_for_timeout(500)
            container.screenshot(path=f"/home/jules/verification/{chart_id}.png")
        else:
            print(f"Chart {chart_id} not found")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Emulate mobile or desktop? PWA usually mobile first.
        context = browser.new_context(viewport={"width": 375, "height": 812})
        page = context.new_page()
        try:
            verify_analytics(page)
        except Exception as e:
            print(f"Error: {e}")
        finally:
            browser.close()
