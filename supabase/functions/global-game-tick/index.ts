/**
 * Advances the global crash round state machine. Schedule every 1s (Supabase Dashboard → Edge Functions → Schedules).
 * Uses service role; never depends on browser clients.
 *
 * Env (auto-injected on Supabase): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const LOBBY = "global";
const COUNTDOWN_MS = 10_000;
const POST_CRASH_MS = 2400;
const GROWTH = 0.05;
const START_RATE = 0.45;

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

function generateCrashPoint(): number {
  const random = Math.random();
  let point: number;
  if (random < 0.33) point = 1 + Math.random() * 0.99;
  else if (random < 0.6) point = 2 + Math.random() * 2.99;
  else if (random < 0.8) point = 5 + Math.random() * 4.99;
  else if (random < 0.92) point = 10 + Math.random() * 39.99;
  else if (random < 0.97) point = 50 + Math.random() * 49.99;
  else if (random < 0.995) point = 100 + Math.random() * 899.99;
  else point = 1000 + Math.random() * 9000;
  return clamp(Number(point.toFixed(2)), 1, 10000);
}

/** ms from active start until multiplier reaches crashPoint (same curve as client game.js). */
function elapsedMsToCrash(crashPoint: number, growth: number, startRate: number): number {
  const g = Math.max(0.0001, growth);
  const sr = Math.max(0.01, startRate);
  const scale = sr / g;
  const inner = (crashPoint - 1) / scale + 1;
  if (inner <= 1) return 0;
  const t = Math.log(inner) / g;
  return clamp(Math.floor(t * 1000), 0, 900_000);
}

Deno.serve(async () => {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    return new Response(JSON.stringify({ ok: false, error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const now = new Date();

  const { data: latest, error: selErr } = await supabase
    .from("global_rounds")
    .select("*")
    .eq("lobby_id", LOBBY)
    .order("round_seq", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (selErr) {
    return new Response(JSON.stringify({ ok: false, error: selErr.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }

  if (!latest) {
    const crash = generateCrashPoint();
    const countdownEnds = new Date(now.getTime() + COUNTDOWN_MS);
    const lucky = Math.random() < 0.05;
    const { error: insErr } = await supabase.from("global_rounds").insert({
      lobby_id: LOBBY,
      round_seq: 1,
      status: "countdown",
      crash_point: crash,
      countdown_ends_at: countdownEnds.toISOString(),
      countdown_ms: COUNTDOWN_MS,
      is_lucky_round: lucky,
      growth_per_sec: GROWTH,
      start_rate_per_sec: START_RATE,
      updated_at: now.toISOString()
    });
    if (insErr) {
      return new Response(JSON.stringify({ ok: false, error: insErr.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
    return new Response(JSON.stringify({ ok: true, action: "seed_round_1" }), { headers: { "Content-Type": "application/json" } });
  }

  const cdEnd = new Date(latest.countdown_ends_at).getTime();
  const crashAt = latest.crash_at ? new Date(latest.crash_at).getTime() : null;
  const crashedAt = latest.crashed_at ? new Date(latest.crashed_at).getTime() : null;

  if (latest.status === "countdown" && now.getTime() >= cdEnd) {
    const growth = Number(latest.growth_per_sec) || GROWTH;
    const sr = Number(latest.start_rate_per_sec) || START_RATE;
    const cp = Number(latest.crash_point);
    const dur = elapsedMsToCrash(cp, growth, sr);
    const activeStart = new Date(cdEnd);
    const crash = new Date(activeStart.getTime() + dur);
    const { data: updated, error: upErr } = await supabase
      .from("global_rounds")
      .update({
        status: "active",
        active_started_at: activeStart.toISOString(),
        crash_at: crash.toISOString(),
        updated_at: now.toISOString()
      })
      .eq("id", latest.id)
      .eq("status", "countdown")
      .select("id")
      .maybeSingle();
    if (upErr) {
      return new Response(JSON.stringify({ ok: false, error: upErr.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
    return new Response(JSON.stringify({ ok: true, action: updated ? "active" : "noop_countdown" }), {
      headers: { "Content-Type": "application/json" }
    });
  }

  if (latest.status === "active" && crashAt != null && now.getTime() >= crashAt) {
    const crashIso = new Date(crashAt).toISOString();
    const { data: updated, error: upErr } = await supabase
      .from("global_rounds")
      .update({
        status: "crashed",
        crashed_at: crashIso,
        updated_at: now.toISOString()
      })
      .eq("id", latest.id)
      .eq("status", "active")
      .select("id")
      .maybeSingle();
    if (upErr) {
      return new Response(JSON.stringify({ ok: false, error: upErr.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
    return new Response(JSON.stringify({ ok: true, action: updated ? "crashed" : "noop_active" }), {
      headers: { "Content-Type": "application/json" }
    });
  }

  if (latest.status === "crashed" && crashedAt != null && now.getTime() >= crashedAt + POST_CRASH_MS) {
    const nextSeq = Number(latest.round_seq) + 1;
    const crash = generateCrashPoint();
    const countdownEnds = new Date(now.getTime() + COUNTDOWN_MS);
    const lucky = Math.random() < 0.05;
    const { error: insErr } = await supabase.from("global_rounds").insert({
      lobby_id: LOBBY,
      round_seq: nextSeq,
      status: "countdown",
      crash_point: crash,
      countdown_ends_at: countdownEnds.toISOString(),
      countdown_ms: COUNTDOWN_MS,
      is_lucky_round: lucky,
      growth_per_sec: GROWTH,
      start_rate_per_sec: START_RATE,
      updated_at: now.toISOString()
    });
    if (insErr) {
      return new Response(JSON.stringify({ ok: false, error: insErr.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
    return new Response(JSON.stringify({ ok: true, action: "new_round", round_seq: nextSeq }), {
      headers: { "Content-Type": "application/json" }
    });
  }

  return new Response(JSON.stringify({ ok: true, action: "idle", status: latest.status }), {
    headers: { "Content-Type": "application/json" }
  });
});
