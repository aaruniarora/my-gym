# my-gym — Plan

A calisthenics training app that plans every session for me, adapts to how much time I have, runs the workout hands-free, and shows my progress toward skills.

Status: **draft for review** — nothing built yet.

---

## 1. Goals

- Progress toward calisthenics skills without having to plan workouts.
- See progress clearly: skill levels, monthly milestone tests, charts.
- Improve flexibility for dance: front splits, middle splits, bridge, pike/pancake.
- Train safely: correct technique is shown and explained for every exercise, and harder skills unlock only when the prerequisites are met.

### Skills

The rule: any skill is fine as long as progress is visible. So the program works first on the skills that show progress fastest for a beginner, and uses them to unlock the long-term ones.

| Horizon | Skills |
|---|---|
| **Q1 focus** (fast, visible wins) | First strict pull-ups, full push-ups, dips, wall → chest-to-wall handstand, tuck L-sit, assisted pistol, splits, bridge, pike/pancake |
| **Q2+** (unlocked by Q1 milestones) | Muscle-up, front lever, back lever, planche, HSPU, dragon flag, V-sit |
| **Long term** | One-arm pull-up / chin-up, freestanding handstand, full planche / levers |

### Starting point (self-reported, confirmed by the week-1 test)

- Pull-ups: 0–2 strict
- Push-ups: fewer than 10
- Handstand: can hold against a wall
- Core: beginner (hanging knee raises, no L-sit yet)
- No injuries. Dances, and wants mobility and flexibility in every session.

### Equipment

- **Gym:** pull-up bar, dip station, TRX, resistance bands, dumbbells, kettlebells, box. No rings and no parallettes; the dip-station handles are used for L-sit and support work.
- **Home:** bands only. A door anchor (about $10) is recommended so bands can be used for rows and assisted pulling.

---

## 2. Program design

### Structure

- **Quarterly program** (12 weeks) made of **three 4-week blocks**:
  - Weeks 1–4: Foundations. **Week 1 doubles as the baseline test.**
  - Weeks 5–8: Build.
  - Weeks 9–11: Intensify.
  - Week 12: Deload and retest.
- **Monthly milestone tests** in weeks 4, 8 and 12, compared against the week-1 baseline.
- At the end of each quarter, the app proposes the next quarter's focus from the test results.

### Weekly split (4 days)

Each upper-body pattern is trained at least twice a week (ACSM 2026). Skill practice is short and frequent, because strength gains rise with training frequency (Pelland 2025).

| Day | Focus | Includes |
|---|---|---|
| A | **Pull focus** | Pull-up progression, TRX/band rows, scapular pulls, hangs, lever prep · secondary push |
| B | **Push focus** | Push-up and dip progressions, pike push-ups, planche leans · secondary pull |
| C | **Legs + splits** | Pistol progression, split squats, Nordic/hamstring work · long splits and pancake block |
| D | **Full-body skill + core** | Handstand, L-sit / compression, bridge, hollow and arch body, short conditioning circuit |

Handstand practice also appears briefly on A and B (for example 3–5 min).

### Adapting to how often I actually train

The 4-day split is the **default target**, not a rule. There are no fixed weekdays. Each time I open the app, it looks at the **last 7 days** and builds the session that best fills the gaps:

- **Coverage:** has each pattern (pull, push, legs, core, each flexibility area) had its 2 sessions this week? Whatever is furthest behind comes first.
- **Recovery:** no hard sets on the same pattern within about 48 hours. Skill practice and mobility can happen every day.
- **The session type changes with frequency:**

| Sessions in a week | What sessions look like |
|---|---|
| 1–2 | **Full-body** each time: push + pull + legs + one skill + flexibility. Fewer exercises, but each pattern still gets trained twice a week. |
| 3 | Full-body, rotating which skill and which flexibility area lead |
| 4 | The planned split (Pull / Push / Legs + splits / Skill + core) |
| 5–6 | 4-day split plus **light days** (skill, mobility, splits, easy conditioning) that don't eat into recovery |
| 7 | Same; the 7th day is mobility and stretching only |

- **Missed days don't break anything.** After a week off, the next session is full-body at slightly reduced volume, and normal progression resumes after one session.
- **Milestones scale to what I actually do.** If I average 2 sessions a week, the quarter's targets are scaled down to that and marked as such, so I'm not set up to "fail". The progress screen shows sessions per week next to the results, so I can see how frequency relates to progress.
- **Setting:** a weekly target (default 4) used for planning and the streak display. The app adapts whether I hit it or not.

### Session builder (time-boxed)

The user enters **any length from 10 to 120 minutes**. There are one-tap shortcuts for 10 / 20 / 30 / 45 / 60 / 90, but any number works (37, 75, …). The builder computes the session from that number; nothing is a fixed template.

How it fills the time:
1. **Minimums first:** warm-up 2 min and cool-down 2 min, always.
2. **Priority order for the rest:** main strength pairs → skill practice (from 20 min up) → secondary strength → flexibility → core/conditioning.
3. **Caps:** each block has a sensible maximum. Once strength volume has its useful number of sets for the day, more time doesn't add more sets, because strength returns flatten (Pelland 2025). Instead it goes to:
   - longer skill practice, with rest between attempts (skills reward quality, not fatigue)
   - flexibility, up to the weekly stretching targets
   - an optional conditioning finisher
4. **Long sessions (75–120 min)** add a dedicated splits/flexibility block, a second skill (for example handstand plus L-sit), and longer rests on hard sets. The app never just doubles the workout.
5. The builder adds or removes sets until the estimated time is within about ±2 min of the target. The session preview shows the total before you start.

Example splits (illustrative, worked out by the builder):

| Block | 10 min | 30 min | 60 min | 90 min |
|---|---|---|---|---|
| Mobility warm-up (incl. wrist prep before hand-balancing) | 2 | 5 | 8 | 10 |
| Skill practice | — | 8 | 12 | 20 (two skills) |
| Strength (pairs/supersets) | 6 (2 pairs, back-to-back) | 12 | 25 | 30 (capped, longer rests) |
| Core / conditioning | — | — | 7 | 10 |
| Flexibility (cool-down + splits block) | 2 | 5 | 8 | 20 |

A **10-minute session** has no skill block. It's the two main strength pairs for that day, done back-to-back with short rests, between a short warm-up and cool-down. The 20-minute session is the shortest that includes skill practice.

Time per exercise is estimated as follows:
- Timed exercises: sets × (work + rest).
- Rep-based exercises: sets × (reps × about 3 s + rest).
- Per-side exercises: both of the above, doubled.

The builder adds or removes sets until the session fits the time chosen.

### Rep ranges (by exercise type)

These are based on my journal (`resources/`: MarchOn whiteboards, F45 and my own notes) and on ACSM 2026. Phase 1 takes exercises, formats and typical doses from those resources.

| Type | Examples | Default dose | Why |
|---|---|---|---|
| **Skill holds / balance** | Handstand, L-sit, tuck lever, planche lean | Timed holds, 3–5 sets, long rest | Skills reward fresh, perfect reps |
| **Main strength progressions** | Pull-up, dip, push-up and pistol variations | **3×5 → 3×8**, then next variation (or 4×6–10 on easier variations) | Hard moves need good form at lower reps; the whiteboards do the same ("pull-ups 8×4", "dips 5×5") |
| **Accessories** | Rows, curls, lateral raises, glute bridges, face pulls, IYT | **3×10–15** (your usual 12×3) | Higher reps are fine for easier moves and build muscle and endurance |
| **Core** | Hollow body, leg raises, dead bugs, V-ups | 3×10–20 or timed holds | |
| **Conditioning** | EMOM, AMRAP, ladders, Hyrox-style | Time-based, as on the whiteboards | |

### Day modes (dedicated, but realistic)

Picked automatically from the check-in, and always changeable before starting:

- **Normal:** the full planned session; aim for the top of the rep range.
- **Push (feeling great):** the normal session, plus the app may offer **bonus sets**. A bonus set is offered when "reps left" is 3 or more on the last set, or when there's spare time. Optional, never required.
- **Tired / low:** the same exercises and the same skill practice, but one fewer set each, the bottom of the rep range, and longer rest. **It counts fully** toward streaks, coverage and the week's plan: showing up matters most (ACSM 2026).
- **Bare minimum (10 min):** warm-up, one strength pair and stretching. It keeps the streak alive on bad days.

Progression only uses sets done in Normal or Push mode. Tired-day sets are logged and shown in history, but they never count as a "miss" that triggers a drop-back.

### Progression rules

- **Reps:** double progression from the r/bodyweightfitness Recommended Routine. Start at 3×5. When all sets hit 8 reps for two sessions in a row, move to the next variation and go back to 3×5.
- **Assisted or weighted:** on band-assisted exercises, hitting 3×8 moves me to the **next lighter band**; after the lightest band comes the unassisted version. On weighted exercises, hitting the top of the rep range means the next weight up.
- **Holds:** start at 3×10 s and build to 3×30 s; for the hardest holds the target is 3×20 s. Then move to the next variation.
- **Effort:** stop sets 1–3 reps before failure. After each set the app asks "how many more could you have done?" Strength gains don't depend on going to failure (Robinson 2024), and the ACSM 2026 statement treats failure training as optional.
- **Straight-arm work** (planche, levers) progresses more conservatively: at most one variation step per block. Connective-tissue adaptation is debated, and fast ramps are the most common injury pattern.
- **Prerequisite gates:** gates attach to the **specific step** they protect, not to the whole tree. Earlier steps are never locked: for example, wall kick-ups stay open and only the freestanding drills need the 60 s chest-to-wall hold. A step unlocks only when its gate is met. These gates are coaching heuristics, not trial results:
  - Muscle-up: 8–10 strict pull-ups, 10 dips, chest-to-bar pull-ups.
  - Front lever: 8 pull-ups, 30 s hollow hold, 20 s tuck front lever.
  - Back lever: comfortable skin the cat, 20 s German hang, 5 pull-ups.
  - Planche work beyond leans: 20 push-ups, 30 s planche lean, wrist prep in place.
  - Freestanding handstand drills: 60 s chest-to-wall hold.
  - HSPU: 10 elevated pike push-ups.
  - One-arm pull-up: 12–15 pull-ups, archer pull-ups.
  - Dragon flag: 10 hanging leg raises, controlled negatives.

### Adapting to what I can already do

The program follows my actual level, not the calendar.

- **Placement, not a fixed start:** in the week-1 baseline, each skill tree starts at the hardest step I can do with good form. Example: if I can already kick up to a wall handstand, I start at "kick-up to wall, hold" rather than at wall plank. The app shows the technique card and asks me to confirm the form checklist.
- **"I can already do this" button:** available on any step, at any time. It sets up a quick check set (for example 3×10 s or 3×5) in the next session. If I pass, the step is marked done and I move on. If I don't, I stay where I am, with no penalty.
- **Moving up early:** if I beat a step's target before the block ends (for example 3×8 in the first session), I move to the next step right away rather than waiting for the monthly test. Monthly tests stay as the progress record.
- **Moving back down:** if I miss a step's target in 3 sessions in a row, or press the pain button, I drop one step for a week. The app suggests a lighter day, and nothing is lost in the history.
- **Unlocked a skill?** It switches to **maintenance**: about 1 short set a week, so it isn't lost. The freed-up time goes to the next skill in that tree, or to a skill whose prerequisites I've just met. The app tells me what was unlocked and what's next.
- **Re-planning within the quarter:** hitting a milestone early updates the rest of the quarter's targets straight away. The quarter structure stays the same; only what fills it changes.
- **Prerequisites still apply:** "I can already do this" can't skip past a safety prerequisite for straight-arm skills or freestanding handstand drills without passing that prerequisite's check. Example: planche work beyond leans still needs the 30 s lean and 20 push-ups.

### History as a tracker

History opens on a **month calendar**, with the session list below it.

- **A day only counts if real work was done.** Starting a session isn't enough, so nothing counts by accident.
  - **Completed:** the session finished, with at least 50% of planned sets logged or at least 10 minutes of logged work. Shown as a filled dot.
  - **Partial:** ended early, but met the 10-minute or 50% bar. It counts, shown as a lighter dot.
  - **Started only:** below the bar, for example 0–1 sets logged. It doesn't count, shown as a hollow dot.
- **The week row** shows "3 / 4 this week" against the weekly target. The streak is counted in weeks that hit the target.
- **Tapping a day** shows that day's sessions with their sets.

### Test weeks (weeks 1, 4, 8, 12)

A setting, **"How do you want to test?"**, offers two options:
- **Across the test week (default):** each normal session that week includes the 3–6 tests that match its day type, so every test is done fresh and the full set is done by the end of the week. Tests not yet done appear in the next session that week.
- **On one test day:** pick the weekday (default Saturday) for a dedicated test session. It runs the core tests in fatigue-aware order (NSCA principle: least fatiguing first): skills and balance → max-strength tests, alternating push and pull → core holds → flexibility last, when warm. The core is about 10–12 tests in 45–60 min, and the rest are optional and fill into that week's sessions.
- **PRs aren't tied to tests.** Any logged set that beats a best updates it straight away. Tests are standardised checkpoints, so the 4-weekly comparisons are like for like.

### Progress graphs (Phase 4)

- **Every graph has one point per week, not per day**, so a single tired session or a different band doesn't hide the trend.
- **Per exercise:** best set of the week, weekly total reps or seconds, heaviest weight, and the lightest band used.
- **Per skill:** the tree step reached by the end of each week, shown as a staircase.
- **Splits and leg-raise height:** the best cm of the week, left and right on one chart.
- **Milestone tests** (weeks 1/4/8/12) are marked on the same weekly axis.

### Training focus toggles

The app can be shared with friends, who may not want every part of the program. A setting has three ticks, **Strength, Mobility and Flexibility**, all ticked by default. At least one must stay ticked.

- **Strength off:** no strength, skill or core blocks. The session is made up of the ticked parts.
- **Mobility off:** the warm-up shrinks to a short safety minimum (for example wrist prep before hand-balancing, and a general warm-up before strength work). There are no mobility blocks or Movement days.
- **Flexibility off:** the cool-down becomes a short general cool-down with no splits, pike or bridge work, and the flexibility trees and tests are hidden.
- **The time available is filled from the ticked parts only.**
- **Cycle tracking (Phase 5):** a separate "Track my menstrual cycle" setting, off unless chosen. It also covers anyone who doesn't have cycles or doesn't want to track them.

### Other adaptations

- **Other activity (dance, etc.):** a quick log of type, duration and intensity, either in the check-in or any time. It counts toward the 7-day picture:
  - A hard dance class counts as leg/hip work. The next session avoids heavy legs or deep splits within about 24–48 hours, and moves upper-body work forward instead.
  - Stretching done in class counts toward the weekly stretch minutes.
- **Temporary niggle mode:** "sore wrist / shoulder / elbow / knee / lower back this week". Until I clear it (default 7 days, with a reminder to check), the builder avoids heavy loading of that area in **every** exercise and swaps in alternatives. It also **adds a short mobility block for that area** (for example shoulder CARs, wall slides and band external rotations for a shoulder niggle), done pain-free and gently, so the niggle area is worked rather than just rested. Light band shoulder work (face pulls, pull-aparts) stays available. Example: for a wrist niggle, no handstands, planche leans or push-ups on palms, but fist or dumbbell-handle push-ups and pulling work are fine. If it lasts beyond 2 weeks, the app suggests seeing a physio.
- **Exercise preferences:**
  - A **never-show list:** the builder always picks an alternate instead.
  - **Favourites:** preferred when two options are equally good.
  - If a disliked exercise is the only route through a safety prerequisite, the app says so and offers the nearest alternative that still trains that prerequisite. It never silently drops the prerequisite.
- **Change focus anytime:** I can reorder skill priorities whenever I like (for example "handstand first now"). The rest of the quarter re-plans around it: more practice time for the new top skill, and the others move toward maintenance or slower progress. Milestones are updated to match, and the change is noted on the progress timeline.
- **Smart deloads:** besides the planned week-12 deload, the app suggests an extra easy week if, over 2+ weeks:
  - reps or holds trend down across several exercises, or
  - readiness stays low, or
  - "reps left" ratings keep dropping at the same load.

  It shows the evidence and I accept or skip. It won't trigger more than once per block.
- **Adaptive rest:** each exercise has a default rest (longer for strength and skill work, shorter for accessories). It adjusts automatically:
  - +30 s after a set rated "0 left / grinder"
  - −15 s when I keep rating "3+ left"
  - always within sensible limits

  I can tap "+30 s" or "skip rest" in the player.
- **Configurable player:** get-ready countdown (default 10 s; 5–20), beeps and voice on/off, voice speed, and whether per-side exercises take a short pause when switching sides.

### Skill trees (draft; reviewed during build)

- **Pull-up:** dead hang → scapular pulls → TRX/band rows → slow negatives (3–5 s) → band-assisted → strict → chest-to-bar → explosive pull-ups
- **Muscle-up:** high pull-ups → band-assisted transitions → negatives → bar muscle-up
- **Front lever:** tuck hang → tuck FL → advanced tuck → one leg → straddle → full
- **Back lever:** skin the cat → German hang → tuck BL → advanced tuck → straddle → full
- **Push-up:** incline → knee → full → diamond / archer → pseudo-planche push-up
- **Dip:** bench dip → support hold → band-assisted → negatives → full → weighted
- **Handstand:** wall plank → wall walk → chest-to-wall hold → shoulder taps → kick-up practice → freestanding
- **HSPU:** pike push-up → elevated pike → wall negatives → wall HSPU
- **Planche:** planche lean → frog stand → tuck planche → advanced tuck → straddle
- **L-sit / V-sit:** foot-supported → tuck → one leg → full L-sit → V-sit
- **Pistol:** box squat → TRX-assisted → partial range → full pistol
- **Dragon flag:** tuck negatives → straddle negatives → full negatives → full
- **Front / middle splits:** passive holds → PNF contract-relax → loaded end-range (active) work, measured as distance from the floor
- **Bridge:** glute bridge → table → wall walk-down → full bridge → handstand to bridge (late)
- **Pike / pancake:** seated pike → loaded pike → pancake with active lifts

### Flexibility

- Static stretching gains max out at about **4 min per muscle group per session and 10 min per week**. Stretch intensity doesn't matter, so the program never pushes into pain (Ingram 2024).
- The app tracks **weekly stretch minutes per target area**: hamstrings, hip flexors, adductors, back/shoulders. It aims for at least 10 min each per week, spread across warm-ups and cool-downs.
- PNF / contract-relax stretching goes in cool-downs only, never before explosive work. Active end-range strength work follows trainer practice (Tom Merrick, Kit Laughlin).

### Movement maintenance (dance + taekwondo background)

Calisthenics stays the focus. This track keeps the range, balance and springiness I already have from dance and taekwondo, and builds on them. Kick height is currently at head height or above, so the goal is to **keep it**, and to keep it under control.

- **Active flexibility** (strength at end range, so the leg goes high *and stays there*): standing front, side and back leg raises with a hold at the top, slow controlled kicks, side-lying leg lifts, pancake active lifts. One drill goes in every Flexibility cool-down, after the passive stretches.
- **Balance and control:**
  - Single-leg stance progressions: eyes closed, then on toes, then on a soft surface.
  - Hip airplanes, single-leg RDLs, and holding a raised knee (chamber) for time.
  - About 1 minute in every warm-up.
- **Light on the toes / spring:**
  - Jump rope (the gym has one), pogo hops, skipping and low hops focused on soft landings.
  - Calf raises, tibialis raises, and foot work: short foot and toe yoga.
  - Plyometric volume stays low (contacts are counted) and is kept away from hard leg days.
- **Small stabilisers:** TFL and glute medius (side-lying hip abduction, banded lateral walks, clamshells), hip rotators (90/90 lifts), adductors (Copenhagen plank) and feet. They rotate in as accessories, 1–2 per session.
- **How it fits in:**
  - **Every session:** about 1–2 min of balance, feet and ankles in the warm-up (jump rope at the gym), plus one active-flexibility drill in the cool-down.
  - **5+ sessions a week:** one of the light days becomes a **Movement day** with balance, spring, active flexibility and small stabilisers.
- **Milestones** (in the week 1/4/8/12 tests):
  - active front and side leg-raise height (wall marks, cm, per side)
  - single-leg balance with eyes closed (seconds, per side)
  - continuous jump rope (minutes)

### Readiness and cycle-aware adjustments

- Training is adjusted **by symptoms, not by calendar phase**. Reviews find no meaningful effect of cycle phase on strength or adaptations (Colenso-Semple 2023, McNulty 2020, NSCA 2025), but symptoms and motivation do vary.
- **Pre-session check-in** (about 5 s): energy, sleep, and on period days, cramps and flow. Period and sleep data come in automatically from Apple Health when available (see §4).
- **Low readiness** → the app offers a lighter version of the day: one fewer set per exercise, skill practice kept, more mobility.
- **A lighter day keeps the coverage.** It cuts sets and intensity, not movement patterns, so a lighter day in a 2-session week still counts toward pull/push/legs coverage.
- **After about 3 months of data**, a chart overlays performance and readiness on cycle day, so I can see my own pattern.
- **Learning my personal pattern:** once there are 3 or more cycles of data, if my own logs show a consistent dip (for example lower reps and energy on days 1–2), the app offers the lighter version **in advance** on those days. It always shows why ("your last 3 cycles: −15% reps on day 1") and I can ignore it. This is based on my data, never on generic "phase" rules.
- **Milestone tests avoid my bad days:** if a monthly test falls on a day that is usually symptomatic for me, the app suggests moving it a few days so results aren't skewed.
- **High-readiness days are normal days.** The app doesn't push extra intensity because of the cycle phase; the evidence doesn't support that.
- **Red flag:** missed or irregular periods, or a downward trend over several weeks → the app shows a "see a doctor" note (possible low energy availability, which the IOC calls REDs). It doesn't diagnose anything.

### Nutrition

Not a feature for v1. At most, one static "eat better" tips page later (protein at every meal, the plate method, iron-rich foods).

---

## 3. Technique and safety (first-class feature)

Every exercise has a **technique card**, shown before the first set and available from any screen:

- **Demo:** a looping photo pair from free-exercise-db where one exists. Otherwise a curated **YouTube video** from a reputable coach, embedded in the card. Each video is checked by title and channel before it goes in, and I review the list.
- **Setup:** how to get into position.
- **3–4 key cues:** for example "ribs down, squeeze glutes, push the floor away".
- **Common mistakes:** what bad form looks like.
- **Stop if:** sharp or joint pain, numbness, a pinching shoulder. A pain button swaps to an easier variation immediately.
- **Regression / progression:** the easier and harder neighbours in the skill tree.

**Coaches used for demos and cues:**
- FitnessFAQs (Daniel Vadnal, physiotherapist)
- Calisthenicmovement
- Antranik
- GMB Fitness
- Bodyweight Warrior (Tom Merrick)
- Hybrid Calisthenics
- Stretch Therapy (Kit Laughlin)

**Safety rules built into the program:**
- Wrist prep before any hand-balancing.
- Prerequisite gates (see §2).
- Conservative progression on straight-arm work.
- Negatives always step down to a box or bench, never drop from a full hang.
- Deload in week 12.

**Form check (planned for v2):** record a set with the phone camera and play it back next to the demo. Worth booking an occasional session with a coach once straight-arm skills start (Q2).

---

## 4. App

### Platform

- An installable **web app (PWA)** for iPhone: added to the home screen, works offline.
- Hosted on **GitHub Pages** from this repo.
- **Supabase** handles login and cloud sync.

### Features (v1)

1. **Today screen:** shows the next session in the rotation. Inputs: time available, and location (gym, or home with bands). Plus the readiness check-in.
2. **Workout player (hands-free):**
   - Voice: "Next: hollow hold, 30 seconds, starting in 10" → 3-2-1 beeps → timer.
   - **Per-side exercises:** voice and beep say "Switch to left side" at the halfway point.
   - **Rep-based exercises:** no timer. Tap Done, adjust reps if needed, rate how many reps were left in the tank → the rest timer starts on its own.
   - **Logging every set:** reps or seconds, side, reps left in tank, plus whatever applies to that exercise:
     - **Weight** (kg) for dumbbells, kettlebells, slam balls and weighted pull-ups or dips (added weight).
     - **Band assistance** for assisted pull-ups, dips, front lever etc.: pick from **my own bands** (set up once by colour and label, ordered lightest to heaviest, optional resistance). Double bands are supported.
     - **Setup details** where they matter: TRX body angle (step position), box height, incline height for push-ups, foot elevation for pike push-ups.
     - **Pre-filled from last time.** If nothing changed, I just tap Done, so logging takes a couple of seconds.
     - Optional note per set or session ("grip slipped", "felt easy").
   - **Swap:** alternates filtered by the equipment available and by "this hurts".
   - Screen stays awake. Pause and skip are available.
3. **Technique cards** (§3).
4. **Progress:**
   - Skill-tree view (current step, next step, gate status).
   - Milestone test results by month.
   - **Per-exercise history:** every session's sets (for example "Band-assisted pull-up · green band · 6, 5, 5"), with charts of best set, total reps and weight over time.
   - **Assistance progress:** a step chart of band level over time (red → green → purple → none), so going from a heavy band to a light band shows up as progress even when the reps stay the same.
   - **Personal records:** best reps, longest hold and heaviest weight per exercise, with a celebration when a new one is set.
   - Weekly stretch minutes per area.
   - Streak / calendar view.
   - Since-last-month comparison.
5. **Program view:** the quarter, the current block and week, upcoming tests.
6. **Settings:** session-length presets, voice on/off, equipment lists, data export.

### Garmin data (proposed: replaces the Shortcuts route below)

Garmin Connect does **not** send cycle data to Apple Health, so the Shortcut route can't see my periods. Proposed instead:
- A **daily scheduled GitHub Action** runs a small script using the unofficial open-source `python-garminconnect` library. It logs in as me, reads **menstrual cycle, sleep and readiness data**, and writes them to Supabase `health_daily`.
- **Secrets:** Garmin login and Supabase key are stored as GitHub Actions secrets, never in the code. The library caches a login token so it doesn't sign in every day.
- **Caveats:**
  - It's unofficial and could break when Garmin changes things. It may also be against Garmin's terms of use.
  - Two-factor login may need a one-time manual step.
- **Fallback:** if it breaks, the app shows "Garmin sync failed" and offers a one-tap period log.

### Apple Health / Garmin data (via iOS Shortcuts)

- Web apps can't read Apple Health, and Garmin's developer program is paused for new applicants. So a **personal iOS Shortcut automation** runs daily. It reads menstrual flow and sleep from Apple Health ("Find Health Samples") and POSTs them to a Supabase Edge Function. It authenticates with a personal ingest token, not my password.
- **To check:** whether Garmin Connect writes cycle data into Apple Health. (Health app → Browse → Cycle Tracking.)
  - If it does, everything is automatic.
  - If it doesn't, log periods in Apple Health instead, or tap them in the app. Garmin's sleep data reaches Apple Health either way.

### Tech stack

- **Frontend:** Vite + React + TypeScript. Built and deployed to GitHub Pages by a GitHub Action. Service worker for offline use.
- **Offline-first:** sessions and logs are written to IndexedDB first, then synced to Supabase when online.
- **Auth:** Supabase email **one-time code**. Magic links open Safari instead of the installed home-screen app on iOS, so a code is used instead.
- **Security:** Row Level Security on every table, so only I can read my rows. The Supabase anon key is public by design.
- **Audio:** Web Speech API (voice) and Web Audio (beeps). iOS needs a tap before audio can play; the Start button provides it. Screen Wake Lock API, with a fallback.
- **Media:** the free-exercise-db images used are copied into the repo (the database is public domain under the Unlicense). YouTube videos are embedded by ID.

### Data model (Supabase)

| Table | Purpose |
|---|---|
| `profiles` | settings, equipment, session presets |
| `programs` | quarter: start date, focus skills, block/week |
| `skill_progress` | current step per skill tree, date unlocked |
| `sessions` | date, day type, minutes planned/actual, readiness, location |
| `set_logs` | session, exercise, variation, set #, reps/seconds, reps left in tank, side, weight kg, band id(s), setup (angle/height), note |
| `bands` | my bands: colour, label, order (light → heavy), optional resistance |
| `milestone_tests` | test date, test item, result |
| `stretch_logs` | area, seconds (rolled up per week) |
| `health_daily` | date, menstrual flow, sleep hours, source (shortcut/manual) |
| `checkins` | date, energy, sleep quality, symptoms |
| `activities` | date, type (dance, run, …), minutes, intensity, includes stretching |
| `niggles` | area, start date, cleared date |
| `preferences` | exercise id, never-show / favourite |
| `focus_changes` | date, new skill priority order |

The exercise library, skill trees and technique content live as versioned JSON in the repo, not in the database. That keeps them easy to review and edit.

---

## 5. Build phases

Each phase ends with something usable that I review before the next one starts.

1. **Content:** the exercise library (about 120 exercises) with technique cards, alternates and media, plus the skill trees, gates and test battery. *Reviewed by me before any app code is written.*
2. **Workout player:** session builder and hands-free player. Logs saved locally.
3. **Supabase:** login, sync, offline queue.
4. **Program and progress:** the quarter, milestone tests, charts, skill-tree view.
5. **Health data:** check-in, the Shortcut ingest endpoint, setup guide, cycle/readiness charts.
6. **Polish:** PWA install, icons, deploy to GitHub Pages.

---

## 6. Open items

- [x] Check whether Garmin cycle data appears in Apple Health: **it doesn't**, so the plan is a Garmin sync via GitHub Action. **Caveats accepted (2026-10-22).**
- [x] Phase 1 review decisions:
  - forearm stretches are allowed in the wrist niggle block (pain-free)
  - the "stop if painful" note is enough for niggle band drills
  - front lever and dragon flag gates stay as planned
- [ ] Find the existing Supabase account; create a project for my-gym.
- [x] Repo hygiene: `resources/` is in `.gitignore`, so the reference zips and the PDF stay local only. GitHub Pages on a free plan needs a **public** repo. Code and exercise content are fine to make public; personal data lives only in Supabase.
- [ ] Review the skill-tree drafts and the gate thresholds in phase 1.

---

## 7. Research basis

Training
- ACSM 2026 Position Stand, *Resistance Training Prescription for Muscle Function, Hypertrophy, and Physical Performance in Healthy Adults* (MSSE 2026). Infographic: https://acsm.org/wp-content/uploads/2026/03/Resistance-Training-Position-Stand-infographic.pdf
- Pelland et al., weekly volume and frequency meta-regression, *Sports Med* 2025 (doi:10.1007/s40279-025-02344-w); preprint: https://sportrxiv.org/index.php/server/preprint/view/537
- Robinson et al. 2024, proximity to failure meta-regression, *Sports Med*; summary: https://www.fau.edu/newsdesk/articles/muscle-growth-strength-study
- Calisthenics trials: https://apcz.umk.pl/JEHS/article/view/60373 , https://rsdjournal.org/rsd/article/view/9371
- r/bodyweightfitness Recommended Routine: https://reddit.rtrace.io/r/bodyweightfitness/wiki/kb/recommended_routine
- Steven Low, *Overcoming Gravity* (2nd ed.): progression charts
- Sleep loss and performance: https://www.strongerbyscience.com/research-spotlight-sleep-loss/ , https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12263768/

Flexibility
- Ingram et al., *Optimising the Dose of Static Stretching to Improve Flexibility*, *Sports Med* 2024 (doi:10.1007/s40279-024-02143-9)
- PNF in gymnasts: https://lida.sport-iat.de/ta/Record/4034663?lng=en

Menstrual cycle
- Colenso-Semple, D'Souza, Elliott-Sale, Phillips, *Front Sports Act Living* 2023: https://pmc.ncbi.nlm.nih.gov/articles/PMC10076834/
- McNulty et al., *Sports Med* 2020: https://nrl.northumbria.ac.uk/id/eprint/43759
- NSCA *Strength Cond J* 2025: https://journals.lww.com/nsca-scj/fulltext/2025/12000/evidence_for_periodizing_strength_and_or_endurance.4.aspx
- AIS Menstrual Cycle Tracking Guidelines: https://www.ais.gov.au/__data/assets/pdf_file/0005/1024889/Menstrual-Cycle-Tracking-Guidelines.pdf
- IOC 2023 REDs consensus: https://pubmed.ncbi.nlm.nih.gov/37752011/

Integrations
- Garmin Women's Health API: https://developer.garmin.com/gc-developer-program/womens-health-api/ ; program pause: https://tryterra.co/blog/garmin-connect-developer-program-pause
- free-exercise-db (Unlicense): https://github.com/yuhonas/free-exercise-db

Caveat: some figures come from secondary summaries. The ACSM infographic, Ingram 2024 and Colenso-Semple 2023 were checked against the source itself. Prerequisite gates and skill-tree steps are coaching consensus, not trial results.
