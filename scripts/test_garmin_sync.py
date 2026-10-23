import json
import unittest
from pathlib import Path

from scripts.garmin_sync import parse_day

RAW = json.loads((Path(__file__).parent / "fixtures" / "garmin_day.json").read_text())
ARGS = ("sleep", "body_battery", "readiness", "hr", "hrv", "menstrual")


class ParseDay(unittest.TestCase):
    def test_fixture(self):
        row = parse_day(RAW["date"], *(RAW[k] for k in ARGS))
        self.assertEqual(row, {
            "date": "2000-01-02", "period_flow": "medium", "cramps": 2, "sleep_hours": 7.5, "sleep_score": 81,
            "body_battery": 77, "readiness": 64, "resting_hr": 52, "hrv": 48, "source": "garmin",
        })

    def test_empty_inputs(self):
        for raw in (None, {}):
            row = parse_day("2000-01-02", raw, [] if raw == {} else None, None, raw, raw, raw)
            self.assertEqual(row["source"], "garmin")
            self.assertTrue(all(v is None for k, v in row.items() if k not in ("date", "source")))

    def test_menstrual_log_without_flow_or_cramps(self):
        row = parse_day("2000-01-02", None, None, None, None, None, {"dailyLog": {"symptoms": ["FATIGUE"]}})
        self.assertIsNone(row["period_flow"])
        self.assertEqual(row["cramps"], 0)


if __name__ == "__main__":
    unittest.main()
