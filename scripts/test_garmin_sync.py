import json
import unittest
from datetime import date, timedelta
from pathlib import Path

from scripts.garmin_sync import chunk_range, count_by_type, has_any_data, parse_day, parse_menstrual_range

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


class Helpers(unittest.TestCase):
    def test_chunk_range_180_days(self):
        start, end = date(2000, 1, 1), date(2000, 1, 1) + timedelta(days=179)
        chunks = chunk_range(start, end)
        self.assertEqual(len(chunks), 2)
        self.assertEqual((chunks[0][0], chunks[-1][1]), (start, end))
        self.assertEqual(chunks[1][0], chunks[0][1] + timedelta(days=1))
        self.assertTrue(all((b - a).days + 1 <= 90 for a, b in chunks))

    def test_count_by_type(self):
        rows = [parse_day(f"2000-01-0{i}", RAW["sleep"], None, None, None, RAW["hrv"] if i < 3 else None, None) for i in (1, 2, 3)]
        self.assertEqual(count_by_type(rows), {"sleep": 3, "body_battery": 0, "readiness": 0, "hr": 0, "hrv": 2, "menstrual": 0})

    def test_has_any_data(self):
        empty = [parse_day("2000-01-02", None, None, None, None, None, None)] * 3
        self.assertFalse(has_any_data(empty))
        self.assertTrue(has_any_data(empty + [parse_day("2000-01-03", None, None, None, RAW["hr"], None, None)]))

    def test_parse_menstrual_range(self):
        raw = json.loads((Path(__file__).parent / "fixtures" / "garmin_menstrual_range.json").read_text())
        self.assertEqual(parse_menstrual_range(raw), {
            "2000-01-01": {"period_flow": "heavy", "cramps": 2},
            "2000-01-02": {"period_flow": "light", "cramps": 0},
            "2000-01-29": {"period_flow": None, "cramps": 0},
        })
        self.assertEqual(parse_menstrual_range(None), {})


if __name__ == "__main__":
    unittest.main()
