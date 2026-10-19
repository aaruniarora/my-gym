# Authoring exercises

Each file in this folder is a JSON array of exercises for one pattern group (`pull.json`, `push.json`, ...). The source of truth is `content/schema.ts`; this guide is everything you need to write content without reading it.

Check your work with `npm run validate` (errors fail, warnings don't).

## Example

```json
{
  "id": "band-assisted-pull-up",
  "name": "Band-assisted pull-up",
  "aliases": ["assisted pull-up"],
  "type": "main_strength",
  "pattern": "pull",
  "mode": "reps",
  "equipment": ["pull_up_bar", "band"],
  "homeOk": false,
  "loads": ["shoulder", "elbow"],
  "phases": ["main"],
  "dose": { "sets": [4, 4], "reps": [6, 10], "progressionTarget": { "sets": 4, "reps": 10 } },
  "loggable": { "weight": false, "band": true, "setup": null },
  "technique": {
    "setup": "Loop the band over the bar and step one foot into it from a box. Grip just wider than the shoulders and hang with straight arms.",
    "cues": ["Pull the shoulders down first", "Drive the elbows to the ribs", "Chin over the bar, then lower slowly"],
    "mistakes": ["Kicking or swinging to get up", "Half reps that stop before straight arms", "Shrugging the shoulders to the ears"],
    "stopIf": ["Sharp or joint pain in the elbow or shoulder", "Pinching at the front of the shoulder"]
  },
  "regression": "pull-up-slow-negative",
  "progression": "strict-pull-up",
  "alternates": {
    "home": ["band-row"],
    "niggle": { "elbow": ["scapular-pull"], "shoulder": ["band-row"] },
    "general": ["trx-row"]
  },
  "media": { "kind": "exdb", "exdbId": "Band_Assisted_Pull-Up" },
  "sources": ["journal p03"],
  "notes": "Hitting 4x10 moves to the next lighter band."
}
```

## Fields

| Field | Required | Value |
|---|---|---|
| `id` | yes | kebab-case, unique across all files, never renamed once used (e.g. `tuck-front-lever`) |
| `name` | yes | display name |
| `aliases` | no | other names, for search |
| `type` | yes | see enums; picks the dose defaults |
| `pattern` | yes | see enums |
| `mode` | yes | see enums |
| `equipment` | yes | at least one; use `none` for nothing |
| `homeOk` | yes | see rules below |
| `loads` | yes | niggle areas this exercise loads; `[]` if none |
| `stretchAreas` | no | for stretches and mobility |
| `phases` | yes | at least one |
| `flags` | no | safety flags |
| `dose` | no | override of the type defaults, only the keys that differ |
| `loggable` | yes | `weight`: log kg; `band`: log band assistance; `setup`: setup detail to log, or `null` |
| `technique` | yes | `setup` 1-3 sentences; `cues` exactly 3-4; `mistakes` at least 2; `stopIf` at least 1 |
| `regression`, `progression` | no | exercise ids of the easier / harder neighbour |
| `alternates` | yes | `home`, `niggle`, optional `general`; all exercise ids |
| `media` | yes | see media rule |
| `sources` | no | e.g. `["journal p03"]` |
| `notes` | no | free text |

No other fields are allowed.

## Enums

- `type`: `skill_hold`, `main_strength`, `accessory`, `core`, `conditioning`, `mobility`, `stretch`
- `pattern`: `pull`, `push`, `legs`, `core`, `handstand`, `flexibility`, `conditioning`, `warmup`
- `mode`: `reps`, `time`, `time_per_side`, `reps_per_side`
- `equipment`: `pull_up_bar`, `dip_station`, `trx`, `band`, `door_anchor`, `dumbbell`, `kettlebell`, `slam_ball`, `box`, `bench`, `wall`, `floor`, `none`
- `loads` and `alternates.niggle` keys: `wrist`, `shoulder`, `elbow`, `knee`, `lower_back`
- `stretchAreas`: `hamstrings`, `hip_flexors`, `adductors`, `back_shoulders`, `wrists`, `other`
- `phases`: `warmup`, `main`, `cooldown`
- `flags`: `pnf`, `explosive`, `straight_arm`, `hand_balancing`, `needs_wrist_prep`
- `loggable.setup`: `trx_angle`, `box_height`, `incline_height`, `foot_elevation`, or `null`
- `media.preferredChannels`: `FitnessFAQs`, `Calisthenicmovement`, `Antranik`, `GMB Fitness`, `Bodyweight Warrior`, `Hybrid Calisthenics`, `Stretch Therapy`

## Dose defaults and overrides

Defaults per `type` live in `content/dose-defaults.json`. Ranges are `[min, max]`.

| type | sets | reps | seconds | rest (s) |
|---|---|---|---|---|
| `skill_hold` | 3-5 | | 10-30 | 120 |
| `main_strength` | 3 | 5-8 | | 120 |
| `accessory` | 3 | 10-15 | | 60 |
| `core` | 3 | 10-20 | 20-45 | 60 |
| `conditioning` | 3-5 | | 30-45 | 30 |
| `mobility` | 1-2 | 8-12 | 30-60 | 0 |
| `stretch` | 1-3 | | 30-120 | 0 |

`dose` on an exercise overrides only the keys you give: `sets`, `reps`, `seconds`, `restSeconds`, `progressionTarget` (`{ "sets": 3, "reps": 8 }` or `{ "sets": 3, "seconds": 20 }`). Only override when the exercise warrants it, e.g. easier strength variations `{ "sets": [4, 4], "reps": [6, 10] }`, hardest holds `{ "progressionTarget": { "sets": 3, "seconds": 20 } }`.

After applying defaults, `time` / `time_per_side` modes must have `seconds` and `reps` / `reps_per_side` modes must have `reps`. So a rep-based `conditioning` exercise or a timed `accessory` needs an override. Stretching is capped at 4 min per area per session and 10 min per week, so keep stretch doses within that.

## Media rule

- If `content/media/exdb-catalog.json` has a reasonable match (search by name), use `{ "kind": "exdb", "exdbId": "<exact id from the catalog>" }`. Ids there look like `Band_Assisted_Pull-Up`.
- Otherwise use a YouTube placeholder:
  ```json
  { "kind": "youtube", "videoId": null, "searchHint": "FitnessFAQs band assisted pull up tutorial", "preferredChannels": ["FitnessFAQs"] }
  ```
  with a precise `searchHint` and 1-2 channels from the list above.
- Never invent ids. `videoId` stays `null` until the user curates a real video (an 11-character id). Uncurated videos show as warnings, not errors.

## homeOk rule

Home means bands only. `homeOk: true` is allowed only if every `equipment` entry is one of `band`, `door_anchor`, `wall`, `floor`, `none` (a bench is not home). If `homeOk` is `false`, `alternates.home` must list at least one home exercise.

## Alternates rule

- `home`: home-friendly substitutes; required when `homeOk` is `false`.
- `niggle`: for each area in `loads`, at least one substitute that doesn't load that area, e.g. `{ "wrist": ["fist-push-up"] }`.
- `general`: other equivalent options, optional.
- Every id must exist in some exercise file (any group).

## Safety flags

- `hand_balancing` or `straight_arm` must also have `needs_wrist_prep`.
- `pnf` stretches use `"phases": ["cooldown"]` only.
- `explosive` on jumps, kipping, explosive pulls; PNF never goes before explosive work.
- Negatives always step down to a box or bench, never drop from a full hang: say so in `setup` and include `box` in `equipment`.
- `stopIf` includes sharp or joint pain, numbness or a pinching shoulder where relevant, plus any exercise-specific red flag.

## Skill-tree steps and gates

`content/skill-trees.json` lists each tree's `steps` in order: `{ exerciseId, target, checkSet?, gate? }`. A `gate` sits on the step it protects, never on the whole tree, so earlier steps stay open. The step unlocks only when every requirement is met:

```json
{ "exerciseId": "freestanding-handstand", "target": { "sets": 5, "seconds": 20 }, "checkSet": { "sets": 3, "seconds": 10 },
  "gate": { "description": "Unlocks freestanding handstand drills once you hold a 60 s chest-to-wall handstand.",
            "requirements": [{ "testId": "chest-to-wall-handstand-hold", "metric": "seconds", "min": 60 }] } }
```

`description` is one sentence saying what the gate unlocks. Each requirement names a test in `content/test-battery.json`, its `metric` (`reps`, `seconds`, `cm_from_floor`, `pass_fail`; `pass_fail` uses `"min": 1`) and the minimum.

## Niggle mobility blocks

`content/niggle-mobility.json` maps each niggle area to the short pain-free mobility block added in niggle mode. All five areas are required, 1-5 ids each (aim for 3-5):

```json
{ "wrist": ["wrist-circles", "wrist-rocks", "elbow-cars"], "shoulder": ["shoulder-cars", "wall-slide"], "elbow": ["..."], "knee": ["..."], "lower_back": ["..."] }
```

Every id must be an existing exercise of type `mobility` or `stretch`, with `homeOk: true`, that does not list that area in its `loads`.

## Flexibility trees

Skill-tree steps for flexibility use `cmFromFloor` targets, e.g. `"target": { "sets": 1, "cmFromFloor": 10 }`, and omit `checkSet`. A step's target must equal the exercise's progression target; set `dose.progressionTarget` on the exercise when the tree needs a specific value. Any target (`target`, `checkSet`, `progressionTarget`) may carry `cmFromFloor` alongside `sets` / `reps` / `seconds`.

## Rules the validator enforces

Errors:
- Every file parses and matches the schema (no unknown fields, enums and kebab-case ids valid).
- Exercise, skill tree and test ids are unique.
- `regression`, `progression`, all `alternates` ids, skill-tree step `exerciseId` and test `exerciseId` exist.
- Every id in `alternates.home` is an exercise with `homeOk: true`.
- Every area in `loads` has at least one id in `alternates.niggle.<area>`.
- No id in `alternates.niggle.<area>` itself loads `<area>`.
- `homeOk: true` only with home equipment; `homeOk: false` needs at least one `alternates.home` id.
- `exdbId` exists in `content/media/exdb-catalog.json`.
- After defaults, `time` modes have `seconds` and `reps` modes have `reps`.
- `hand_balancing` or `straight_arm` also has `needs_wrist_prep`.
- `pnf` has `phases` exactly `["cooldown"]`.
- The progression target (`dose.progressionTarget`, else max sets with max reps or max seconds after defaults) uses `reps` for rep modes and `seconds` for time modes.
- The progression target's `sets`, `reps` and `seconds` each lie within the dose range after defaults; `cmFromFloor` targets are exempt.
- A skill-tree step target equals the exercise's progression target (sets and reps or seconds); `cmFromFloor` steps are exempt.
- A skill-tree `checkSet` has no more sets, reps or seconds than its target.
- Step gate requirements reference an existing test, with the same `metric` as that test.
- `niggle-mobility.json` exists and has all five areas; each id exists, is type `mobility` or `stretch`, is `homeOk: true` and does not load that area.
- `dose-defaults.json` is valid and `content/schema/*.schema.json` is up to date (`npm run schema:gen`).

Warnings:
- YouTube `videoId` still `null` (uncurated).
- `homeOk: false` although all equipment is home equipment.
