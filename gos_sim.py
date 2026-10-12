"""
Game Outcome Simulator (GOS) - reference implementation, schema v0.1
Kanboard #2300. Produces game outcome data in the agreed schema for
LoopLab and DM systems testing. Swap source to "live" when the MGI AI
team's feed is ready. DM systems should not care which source produced it.

Usage
    python gos_sim.py --seasons 1 --seed 42 --out ./out
Outputs
    out/game_outcomes.csv   one row per team per game (2 rows per game)
    out/season_summary.csv  one row per team per season
    out/game_outcomes.json  same rows as JSON, for DM systems / StreamingAssets
"""
import argparse, csv, json, math, os, random, uuid
from datetime import datetime, timedelta, timezone

SCHEMA_VERSION = "0.1"

CONFIG = {
    "weeks_per_season": 10,          # matches LocalSeasonBackend.total_weeks
    "points_per_win": 2,             # matches team.stats.points = wins * 2
    "w_offence": 0.45,               # team strength weights (sum to 1)
    "w_defence": 0.40,
    "w_special_teams": 0.15,
    "k": 0.08,                       # logistic steepness per strength point
    "home_advantage": 2.0,           # strength points added to home team
    "loser_score_mean": 20.0,
    "loser_score_sd": 6.0,
    "margin_base": 3.0,
    "margin_per_strength": 0.25,
    "margin_sd": 8.0,
}

# Placeholder team inputs. Names and team_ids from
# StreamingAssets/Coaches/Database/team.json (league == "NFL").
# Ratings there are all 1.0 today, so these 0-100 values are invented tiers.
# coach_*_bonus = Jashwant's 3 rolled-up coach bonuses (O, D, ST).
TEAMS = [
    # team_id, team_name, division, off, def, st, coach_o, coach_d, coach_st, is_player
    ("22dda48d-9e4d-469d-8e17-eb48dd5a58d7", "Buffalo Bills",        "East", 84, 80, 72, 0.04, 0.03, 0.01, False),
    ("4379eea3-230b-4c63-8c33-06dacd51a349", "New England Patriots", "East", 66, 70, 68, 0.02, 0.02, 0.01, False),
    ("88e80e3c-3511-403f-9033-332c76820e54", "New York Giants",      "East", 62, 64, 60, 0.01, 0.01, 0.00, False),
    ("3d743b76-bc76-4249-b550-d5a09b0e071a", "Dallas Cowboys",       "East", 78, 72, 70, 0.03, 0.02, 0.01, False),
    ("e6c4ce63-cbef-4e01-ba5f-804a984024ee", "Cincinnati Bengals",   "East", 80, 66, 64, 0.03, 0.01, 0.01, False),
    ("db3ed416-54bc-44d6-86dc-49b6cc79a2ef", "Cleveland Browns",     "East", 58, 74, 62, 0.01, 0.03, 0.00, False),
    ("466adf39-b0a1-4b20-ba94-f22a82ff92a2", "Los Angeles Rams",     "West", 76, 74, 70, 0.03, 0.03, 0.01, False),
    ("a866ce30-5869-4188-b93b-d415e1f97a9e", "Denver Broncos",       "West", 64, 78, 66, 0.01, 0.04, 0.01, False),
    ("64336ace-1ead-4eed-a112-3d402edc6d84", "New Orleans Saints",   "West", 68, 64, 74, 0.02, 0.01, 0.02, False),
    ("7e907f08-6389-4d4f-b2b1-a4899a80a576", "Chicago Bears",        "West", 60, 70, 64, 0.01, 0.02, 0.01, False),
    ("d6d0b322-6a53-4df9-9ae1-5abb357a05ef", "Carolina Panthers",    "West", 56, 60, 58, 0.00, 0.01, 0.00, False),
    ("00000000-0000-0000-0000-000000000001", "Player Team",          "West", 70, 70, 66, 0.02, 0.02, 0.01, True),
]
LEAGUE = "NFL"
PLAYER_ID = "player_001"


def team_strength(t):
    _, _, _, off, de, st, co, cd, cs, _ = t
    c = CONFIG
    return (c["w_offence"] * off * (1 + co)
            + c["w_defence"] * de * (1 + cd)
            + c["w_special_teams"] * st * (1 + cs))


def win_probability(str_home, str_away):
    """P(home wins). Logistic on strength gap plus home advantage."""
    x = CONFIG["k"] * (str_home - str_away + CONFIG["home_advantage"])
    return 1.0 / (1.0 + math.exp(-x))


def round_robin(n, weeks):
    """Circle method. Returns list of weeks, each a list of (home_idx, away_idx).
    n must be even. Home/away flips each round so it stays balanced."""
    idx = list(range(n))
    rounds = []
    for r in range(n - 1):
        pairs = []
        for i in range(n // 2):
            a, b = idx[i], idx[n - 1 - i]
            pairs.append((a, b) if (r + i) % 2 == 0 else (b, a))
        rounds.append(pairs)
        idx = [idx[0]] + [idx[-1]] + idx[1:-1]
    return rounds[:weeks]


def simulate_season(rng, season_id, run_id, seed, start):
    c = CONFIG
    strengths = [team_strength(t) for t in TEAMS]
    sched = round_robin(len(TEAMS), c["weeks_per_season"])
    rec = {i: {"w": 0, "l": 0, "pf": 0, "pa": 0, "streak": 0, "best": 0} for i in range(len(TEAMS))}
    rows = []
    for week, pairs in enumerate(sched, start=1):
        for g, (h, a) in enumerate(pairs, start=1):
            game_id = f"{season_id}-w{week:02d}-g{g:02d}"
            p_home = win_probability(strengths[h], strengths[a])
            home_wins = rng.random() < p_home
            gap = abs(strengths[h] - strengths[a])
            loser = max(0, round(rng.gauss(c["loser_score_mean"], c["loser_score_sd"])))
            margin = max(1, round(abs(rng.gauss(c["margin_base"] + c["margin_per_strength"] * gap, c["margin_sd"]))))
            winner_score = loser + margin
            ts = (start + timedelta(days=7 * (week - 1))).isoformat()
            for side, me, opp in (("home", h, a), ("away", a, h)):
                won = (side == "home") == home_wins
                pf, pa = (winner_score, loser) if won else (loser, winner_score)
                r = rec[me]
                r["w" if won else "l"] += 1
                r["pf"] += pf; r["pa"] += pa
                r["streak"] = (r["streak"] + 1 if r["streak"] > 0 else 1) if won else (r["streak"] - 1 if r["streak"] < 0 else -1)
                r["best"] = max(r["best"], r["streak"])
                t, o = TEAMS[me], TEAMS[opp]
                rows.append({
                    "schema_version": SCHEMA_VERSION,
                    "source": "simulator",
                    "run_id": run_id,
                    "seed": seed,
                    "season_id": season_id,
                    "week": week,
                    "game_id": game_id,
                    "event_id": f"{game_id}:{t[0]}",
                    "game_type": "regular",
                    "played_at": ts,
                    "team_id": t[0],
                    "team_name": t[1],
                    "is_player_team": t[9],
                    "player_id": PLAYER_ID if t[9] else "",
                    "league": LEAGUE,
                    "division": t[2],
                    "opponent_id": o[0],
                    "opponent_name": o[1],
                    "home_away": side,
                    "result": "W" if won else "L",
                    "points_for": pf,
                    "points_against": pa,
                    "margin": pf - pa,
                    "wins_to_date": r["w"],
                    "losses_to_date": r["l"],
                    "current_streak": r["streak"],
                    "standing_points_to_date": r["w"] * c["points_per_win"],
                    "team_strength": round(strengths[me], 2),
                    "opponent_strength": round(strengths[opp], 2),
                    "win_probability": round(p_home if side == "home" else 1 - p_home, 4),
                })
    # standings: points desc, then point diff, then points for, then team_id
    order = sorted(rec, key=lambda i: (-rec[i]["w"], -(rec[i]["pf"] - rec[i]["pa"]), -rec[i]["pf"], TEAMS[i][0]))
    summary = []
    for place, i in enumerate(order, start=1):
        r, t = rec[i], TEAMS[i]
        summary.append({
            "schema_version": SCHEMA_VERSION, "source": "simulator", "run_id": run_id,
            "season_id": season_id, "team_id": t[0], "team_name": t[1],
            "is_player_team": t[9], "player_id": PLAYER_ID if t[9] else "",
            "league": LEAGUE, "division": t[2],
            "games_played": r["w"] + r["l"], "wins": r["w"], "losses": r["l"],
            "standing_points": r["w"] * c["points_per_win"],
            "points_for": r["pf"], "points_against": r["pa"], "point_diff": r["pf"] - r["pa"],
            "longest_win_streak": r["best"], "placement": place,
            "team_strength": round(strengths[i], 2),
        })
    return rows, summary


def run(seasons, seed):
    rng = random.Random(seed)
    run_id = f"run-{seed}"
    start = datetime(2026, 9, 6, 18, 0, tzinfo=timezone.utc)
    all_rows, all_sum = [], []
    for s in range(1, seasons + 1):
        rows, summ = simulate_season(rng, f"S{s:04d}", run_id, seed, start)
        all_rows += rows; all_sum += summ
    return all_rows, all_sum


def validate(rows, summary):
    """Invariants every batch must pass, sim or live."""
    errs = []
    w = sum(r["result"] == "W" for r in rows); l = sum(r["result"] == "L" for r in rows)
    if w != l: errs.append(f"wins {w} != losses {l}")
    from collections import Counter
    if any(v != 2 for v in Counter(r["game_id"] for r in rows).values()): errs.append("game_id not exactly 2 rows")
    if len({r["event_id"] for r in rows}) != len(rows): errs.append("event_id not unique")
    for r in rows:
        if (r["result"] == "W") != (r["points_for"] > r["points_against"]): errs.append(f"score/result mismatch {r['event_id']}"); break
    per = Counter((r["season_id"], r["team_id"]) for r in rows)
    if set(per.values()) != {CONFIG["weeks_per_season"]}: errs.append("team game count != weeks_per_season")
    return errs


def write(rows, summary, out):
    os.makedirs(out, exist_ok=True)
    for name, data in (("game_outcomes", rows), ("season_summary", summary)):
        with open(os.path.join(out, f"{name}.csv"), "w", newline="") as f:
            wtr = csv.DictWriter(f, fieldnames=list(data[0])); wtr.writeheader(); wtr.writerows(data)
    with open(os.path.join(out, "game_outcomes.json"), "w") as f:
        json.dump({"schema_version": SCHEMA_VERSION, "games": rows, "seasons": summary}, f, indent=2)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--seasons", type=int, default=1)
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--out", default="out")
    a = ap.parse_args()
    rows, summ = run(a.seasons, a.seed)
    errs = validate(rows, summ)
    print("validation:", "PASS" if not errs else errs)
    write(rows, summ, a.out)
    print(f"{len(rows)} game rows, {len(summ)} season rows -> {a.out}")
