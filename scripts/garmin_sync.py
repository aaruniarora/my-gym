"""Daily Garmin -> Supabase health_daily sync. Prints only counts and ok/failed."""
import base64
import io
import os
import sys
import tarfile
import tempfile
from datetime import date, datetime, timedelta, timezone

FIELDS = ("period_flow", "cramps", "sleep_hours", "sleep_score", "body_battery", "readiness", "resting_hr", "hrv")
FLOW = {"LIGHT": "light", "MEDIUM": "medium", "HEAVY": "heavy", "NONE": "none"}


def parse_day(day, sleep, body_battery, readiness, hr, hrv, menstrual):
    dto = (sleep or {}).get("dailySleepDTO") or {}
    secs = dto.get("sleepTimeSeconds")
    score = ((dto.get("sleepScores") or {}).get("overall") or {}).get("value")
    levels = [v[1] for e in (body_battery or []) for v in (e.get("bodyBatteryValuesArray") or []) if len(v) > 1 and v[1] is not None]
    snaps = sorted((s for s in (readiness or []) if s.get("score") is not None), key=lambda s: s.get("timestamp") or "")
    rhr = (hr or {}).get("restingHeartRate")
    log = (menstrual or {}).get("dailyLog")
    flow = FLOW.get(str(log.get("flow")).upper()) if log and log.get("flow") else None
    # Garmin logs cramps as a yes/no symptom; yes maps to 2 (moderate) on the 0-3 scale.
    cramps = (2 if "CRAMPS" in (log.get("symptoms") or []) else 0) if log else None
    return {
        "date": day,
        "period_flow": flow,
        "cramps": cramps,
        "sleep_hours": round(secs / 3600, 1) if secs else None,
        "sleep_score": score,
        "body_battery": max(levels) if levels else None,
        "readiness": snaps[-1]["score"] if snaps else None,
        "resting_hr": rhr,
        "hrv": round(h) if (h := ((hrv or {}).get("hrvSummary") or {}).get("lastNightAvg")) is not None else None,
        "source": "garmin",
    }


def garmin_client():
    from garminconnect import Garmin
    client = Garmin(os.environ.get("GARMIN_EMAIL"), os.environ.get("GARMIN_PASSWORD"))
    tokens = os.environ.get("GARMIN_TOKENS")
    if tokens:
        path = tempfile.mkdtemp()
        with tarfile.open(fileobj=io.BytesIO(base64.b64decode(tokens)), mode="r:gz") as tar:
            tar.extractall(path, filter="data")
        client.login(path)
    else:
        client.login()
    return client


def fetch(call, *args):
    try:
        return call(*args)
    except Exception:
        return None


def main():
    from supabase import create_client
    try:
        db = create_client(os.environ["VITE_SUPABASE_URL"], os.environ["VITE_SUPABASE_PUBLISHABLE_KEY"])
        user_id = db.auth.sign_in_with_password({"email": os.environ["SUPABASE_EMAIL"], "password": os.environ["SUPABASE_PASSWORD"]}).user.id
    except Exception as e:
        print(f"failed: Supabase sign-in ({type(e).__name__})")
        sys.exit(1)
    now = datetime.now(timezone.utc).isoformat()
    try:
        g = garmin_client()
        days = [(date.today() - timedelta(days=i)).isoformat() for i in range(3)]
        rows = [parse_day(d, fetch(g.get_sleep_data, d), fetch(g.get_body_battery, d), fetch(g.get_training_readiness, d),
                          fetch(g.get_heart_rates, d), fetch(g.get_hrv_data, d), fetch(g.get_menstrual_data_for_date, d)) for d in days]
        existing = {r["date"]: r for r in db.table("health_daily").select("*").in_("date", days).execute().data}
        kept = 0
        for row in rows:
            old = existing.get(row["date"])
            row["user_id"] = user_id
            if old and old.get("source") == "manual":
                row.update({k: old[k] for k in FIELDS if old.get(k) is not None}, source="manual")
                kept += 1
        db.table("health_daily").upsert(rows, on_conflict="user_id,date").execute()
        db.table("garmin_status").upsert({"user_id": user_id, "last_ok": now, "last_attempt": now, "last_error": None}).execute()
        filled = sum(1 for r in rows for k in FIELDS if r[k] is not None)
        print(f"ok: {len(rows)} days, {filled} fields, {kept} manual rows kept")
    except Exception as e:
        db.table("garmin_status").upsert({"user_id": user_id, "last_error": type(e).__name__, "last_attempt": now}).execute()
        print(f"failed: {type(e).__name__}")
        sys.exit(1)


if __name__ == "__main__":
    main()
