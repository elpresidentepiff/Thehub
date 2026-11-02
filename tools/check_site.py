#!/usr/bin/env python3
"""Release checks for the Hub site. Fails (exit 1) if anything that broke this session breaks again.

    python3 tools/check_site.py                  # check proto/opening.html
    python3 tools/check_site.py --page dist/index.html

Serves the repo over HTTP on a free port (so character-set bugs show up) and drives Chromium with
Playwright: real-phone emulation, reduced motion, console errors, contrast, pricing and the plan
calculator. Needs `pip install playwright` and `playwright install chromium`.
"""
import argparse
import functools
import http.server
import json
import subprocess
import sys
import threading
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PRICING = json.loads((ROOT / "pricing" / "pricing.json").read_text(encoding="utf-8"))
INK = (0x0B, 0x09, 0x07)

results = []


def check(name, ok, detail=""):
    results.append((name, bool(ok), detail))
    print(("PASS  " if ok else "FAIL  ") + name + (f"  [{detail}]" if detail and not ok else ""))


def money(pence):
    v = pence / 100
    return "£" + (str(int(v)) if v == int(v) else f"{v:.2f}")


def lum(c):
    c = [x / 255 for x in c]
    c = [x / 12.92 if x <= 0.03928 else ((x + 0.055) / 1.055) ** 2.4 for x in c]
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]


def contrast(a, b):
    hi, lo = sorted([lum(a), lum(b)], reverse=True)
    return (hi + 0.05) / (lo + 0.05)


def serve():
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(ROOT))
    handler.log_message = lambda *a, **k: None
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv


def expected_plan(need):
    plans = sorted(PRICING["memberships"], key=lambda m: m["hours_per_month"] or 10**9)
    return next(m for m in plans if m["hours_per_month"] is None or m["hours_per_month"] >= need)


def run(page):
    from playwright.sync_api import sync_playwright

    srv = serve()
    base = f"http://127.0.0.1:{srv.server_address[1]}/{page}"
    problems = []
    with sync_playwright() as p:
        b = p.chromium.launch()

        def open_page(init=None, **ctx):
            c = b.new_context(**ctx)
            if init:
                c.add_init_script(init)
            pg = c.new_page()
            pg.on("pageerror", lambda e: problems.append(f"pageerror: {e}"))
            pg.on("console", lambda m: problems.append(f"console: {m.text}") if m.type == "error" else None)
            pg.on("response", lambda r: problems.append(f"{r.status} {r.url}") if r.status >= 400 else None)
            pg.goto(base)
            pg.wait_for_timeout(900)
            return c, pg

        # --- document basics, over HTTP so a missing charset is caught ---
        c, pg = open_page(viewport={"width": 1280, "height": 900})
        d = pg.evaluate(
            """()=>({mode:document.compatMode,charset:document.characterSet,lang:document.documentElement.lang,
            vp:!!document.querySelector('meta[name=viewport]'),title:document.title.trim(),
            h1:document.querySelectorAll('h1').length,main:document.querySelectorAll('main').length,
            est:getComputedStyle(document.getElementById('L1')).opacity,
            text:document.body.innerText})"""
        )
        check("standards mode (doctype present)", d["mode"] == "CSS1Compat", d["mode"])
        check("character set is UTF-8", d["charset"] == "UTF-8", d["charset"])
        check("no mojibake in page text", "Â" not in d["text"] and "â€" not in d["text"])
        check("html lang is set", d["lang"] != "")
        check("viewport meta present", d["vp"])
        check("title present", d["title"] != "")
        check("exactly one h1", d["h1"] == 1, str(d["h1"]))
        check("exactly one main landmark", d["main"] == 1, str(d["main"]))
        check("first screen is visible at scroll 0 (EST. 1857)", d["est"] == "1", d["est"])

        # --- pricing on the page equals pricing.json ---
        shown = pg.evaluate("[...document.querySelectorAll('.m-plan .m-price')].map(e=>e.textContent.trim())")
        want = [f"{money(m['amount_pence'])} / {m['interval']}" for m in PRICING["memberships"]]
        check("membership prices match pricing.json", shown == want, f"{shown} vs {want}")
        day = pg.evaluate("document.querySelector('#m-day .m-price').textContent.trim()")
        check("day pass price matches pricing.json", day == money(PRICING["day_pass"]["amount_pence"]), day)
        c.close()

        # --- plan calculator against known cases ---
        c, pg = open_page(viewport={"width": 1280, "height": 900})
        for dw, hd in [(1, 1), (3, 6), (5, 8), (7, 12)]:
            pg.evaluate(f"document.getElementById('c-days').value={dw};document.getElementById('c-hours').value={hd};"
                        "document.getElementById('c-days').dispatchEvent(new Event('input'))")
            need = round(dw * hd * 52 / 12)
            plan = expected_plan(need)
            got = pg.evaluate("document.getElementById('c-price').textContent.trim()")
            line = pg.evaluate("document.getElementById('c-line').textContent")
            check(f"calculator {dw}d x {hd}h picks {plan['working_name']}",
                  got.startswith(money(plan["amount_pence"])) and line.startswith(plan["working_name"]), f"{got} | {line}")
        c.close()

        # --- real phone, tablet, desktop: no sideways scroll, content fits ---
        for label, kw in [
            ("phone", dict(viewport={"width": 390, "height": 780}, is_mobile=True, has_touch=True, device_scale_factor=2)),
            ("tablet", dict(viewport={"width": 768, "height": 1024})),
            ("desktop", dict(viewport={"width": 1280, "height": 900})),
        ]:
            c, pg = open_page(**kw)
            pg.evaluate("document.getElementById('membership').scrollIntoView()")
            pg.wait_for_timeout(300)
            r = pg.evaluate(
                """()=>({sx:document.documentElement.scrollWidth>document.documentElement.clientWidth,
                w:document.documentElement.clientWidth,
                fit:[...document.querySelectorAll('.m-plan,.m-day,.m-calc')].every(e=>e.scrollWidth<=e.clientWidth+1)})"""
            )
            check(f"{label}: no sideways scroll", not r["sx"])
            check(f"{label}: membership content fits its columns", r["fit"])
            if label == "phone":
                check("phone: layout width is device width (viewport meta works)", r["w"] == 390, str(r["w"]))
            c.close()

        # --- phone first screen: SCROLL hint and the corner note must not sit on each other ---
        c, pg = open_page(viewport={"width": 390, "height": 780}, is_mobile=True, has_touch=True)
        boxes = pg.evaluate(
            """()=>['hint','note'].map(i=>{const r=document.getElementById(i).getBoundingClientRect();
            return [r.left,r.top,r.right,r.bottom]})"""
        )
        (hl, ht, hr, hb), (nl, nt, nr, nb) = boxes
        check("phone: SCROLL hint does not overlap the corner note", hr <= nl or nr <= hl or hb <= nt or nb <= ht, str(boxes))
        c.close()

        # --- contrast of small text against the page ground ---
        c, pg = open_page(viewport={"width": 1280, "height": 900})
        for sel in [".m-lede", ".m-rate", ".m-facts dt", ".m-calc-sub", ".m-foot", ".m-tag", ".note", ".hint"]:
            rgb = pg.evaluate(
                """sel=>{const e=document.querySelector(sel);if(!e)return null;
                const m=getComputedStyle(e).color.match(/\\d+/g);return m?m.slice(0,3).map(Number):null}""",
                sel,
            )
            if rgb:
                ratio = contrast(tuple(rgb), INK)
                check(f"contrast {sel} >= 4.5", ratio >= 4.5, f"{ratio:.2f}")
        c.close()

        # --- head: description and icon exist, and the description never carries a typed price ---
        c, pg = open_page(viewport={"width": 1280, "height": 900})
        h = pg.evaluate(
            """()=>({desc:(document.querySelector('meta[name=description]')||{}).content||'',
            og:(document.querySelector('meta[property="og:title"]')||{}).content||'',
            icon:!!document.querySelector('link[rel=icon]'),theme:!!document.querySelector('meta[name=theme-color]')})"""
        )
        check("meta description present", len(h["desc"]) > 40, h["desc"])
        check("meta description carries no price (prices live only in pricing.json)", "£" not in h["desc"])
        check("social title, icon and theme colour present", bool(h["og"]) and h["icon"] and h["theme"])

        # --- closing: the name is on the page, not only in a hidden h1; the walk plays once ---
        pg.evaluate("window.scrollTo(0,document.querySelector('.scroller').scrollHeight-innerHeight)")
        pg.wait_for_timeout(600)
        cl = pg.evaluate(
            """()=>{const n=document.querySelector('.closing .name'),r=n.getBoundingClientRect(),v=document.getElementById('arrivevid').getBoundingClientRect();
            return {text:n.textContent.trim(),op:getComputedStyle(document.getElementById('pillars')).opacity,
            inView:r.top>=0&&r.bottom<=innerHeight,loop:document.getElementById('arrivevid').loop,vw:v.width,w:innerWidth,
            hidden:document.getElementById('arrivevid').getAttribute('aria-hidden')}}"""
        )
        check("closing shows THE HUB @ LLOYDS WHARF", cl["text"] == "THE HUB @ LLOYDS WHARF", cl["text"])
        check("closing is fully visible at the end of the sequence", cl["op"] == "1" and cl["inView"], str(cl))
        check("desktop: portrait footage is framed, not cropped to a strip", cl["vw"] < cl["w"] * 0.6, f"{cl['vw']} of {cl['w']}")
        check("tunnel video plays once (no loop jump-cut) and is hidden from screen readers", cl["loop"] is False and cl["hidden"] == "true")
        c.close()

        # --- contact route: shown when set, absent when not ---
        c, pg = open_page(viewport={"width": 1280, "height": 900})
        none = pg.evaluate("[document.querySelectorAll('#m-visit a').length,document.querySelectorAll('.m-ask').length]")
        check("no contact set: no empty mailto/tel links on the page", none == [0, 0], str(none))
        c.close()
        c, pg = open_page(init="window.HUB_CONTACT={email:'hello@example.test',phone:'+44 20 7946 0000'}",
                          viewport={"width": 390, "height": 780}, is_mobile=True, has_touch=True)
        got = pg.evaluate(
            """()=>({mail:[...document.querySelectorAll('#m-visit a')].map(a=>a.getAttribute('href')),
            ask:[...document.querySelectorAll('.m-ask')].map(a=>a.getAttribute('href')),
            sx:document.documentElement.scrollWidth>document.documentElement.clientWidth})"""
        )
        check("contact set: email and phone links are correct",
              got["mail"] == ["mailto:hello@example.test", "tel:+442079460000"], str(got["mail"]))
        check("contact set: every plan has an enquiry link naming the plan",
              len(got["ask"]) == len(PRICING["memberships"]) and all("Membership%20enquiry" in a for a in got["ask"]), str(got["ask"]))
        check("contact set: still no sideways scroll on a phone", not got["sx"])
        c.close()
        c, pg = open_page(init="window.HUB_CONTACT={email:'x\"><img src=x onerror=alert(1)>@a.b',phone:''}",
                          viewport={"width": 1280, "height": 900})
        bad = pg.evaluate("document.querySelectorAll('#m-visit img, .m-ask').length")
        check("a malformed email never becomes markup", bad == 0, str(bad))
        c.close()

        # --- keyboard: dots and sliders reachable ---
        c, pg = open_page(viewport={"width": 1280, "height": 900})
        pg.focus("#beatnav button")
        check("section dots are keyboard focusable", pg.evaluate("document.activeElement.parentElement.id") == "beatnav")
        pg.focus("#c-days")
        check("plan calculator sliders are focusable", pg.evaluate("document.activeElement.id") == "c-days")
        c.close()

        # --- reduced motion: static page, everything visible ---
        c, pg = open_page(viewport={"width": 1280, "height": 900}, reduced_motion="reduce")
        ops = pg.evaluate("[...document.querySelectorAll('.layer')].map(l=>getComputedStyle(l).opacity)")
        check("reduced motion: all layers visible", all(o == "1" for o in ops), str(ops))
        cur = lambda: pg.evaluate("[...document.querySelectorAll('#beatnav button')].findIndex(b=>b.getAttribute('aria-current')==='true')")
        check("reduced motion: first dot is current at the top", cur() == 0, str(cur()))
        pg.evaluate("document.getElementById('membership').scrollIntoView()")
        pg.wait_for_timeout(300)
        check("reduced motion: last dot is current at Membership", cur() == 4, str(cur()))
        pg.evaluate("document.querySelectorAll('#beatnav button')[1].click()")
        pg.wait_for_timeout(500)
        check("reduced motion: the Cleat dot takes you to the cleat and marks it", cur() == 1, str(cur()))
        c.close()
        b.close()
    srv.shutdown()

    check("no console errors, page errors or 4xx/5xx responses", not problems, "; ".join(problems[:4]))


def launch_gate(page):
    """Things that are fine in a prototype but must be false/true before the site goes public."""
    html = (ROOT / page).read_text(encoding="utf-8")
    import re
    m = re.search(r'window\.HUB_CONTACT=window\.HUB_CONTACT\|\|\{email:"([^"]*)",phone:"([^"]*)"\}', html)
    check("LAUNCH: an email or phone number is set", bool(m and (m.group(1) or m.group(2))))
    check("LAUNCH: prototype corner note is removed", 'id="note"' not in html or "Opening sequence prototype" not in html)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--page", default="proto/opening.html")
    ap.add_argument("--launch", action="store_true", help="also enforce the go-live blockers")
    args = ap.parse_args()
    page = args.page

    sync = subprocess.run([sys.executable, str(ROOT / "tools" / "build_pricing_js.py"), "--check"],
                          capture_output=True, text=True)
    check("pricing/pricing.js is in sync with pricing.json", sync.returncode == 0, sync.stderr.strip())

    run(page)
    if args.launch:
        launch_gate(page)
    failed = [r for r in results if not r[1]]
    print(f"\n{len(results) - len(failed)}/{len(results)} checks passed")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
