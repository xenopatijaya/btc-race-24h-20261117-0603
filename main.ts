// Recovery Dip Bot for btc-race-24h-20261117-0603: "Race a BTC trading bot
// live for 24 hours" (cbBTC/USDC 1-minute bars, Orca Whirlpool, $1,000 paper
// money, long only).
//
// What the last race taught (final board btc-race-24h-20261115-0828, 2,828
// entries): the winners all made ONE trade — buy a dip, hold to the end.
// #1 bought below 65,000 and held up to 20 hours (+$16.80); the top 15 all
// made 1-2 trades and the #10 cut was +$14.40. Our previous entry ("Proper
// Horizon", C3) finished #908 at -$7.20 with 2 trades, and its failure is
// instructive: its 120-minute <= -1.6% trigger NEVER fired in the live
// window (worst 120m drop was only -1.17%), so the only trade it made was
// its fallback — a momentum buy late in the window that lost money. Two
// lessons: (1) triggers must fire in the shallow dips these windows
// actually have, and (2) a momentum fallback is worse than no trade.
//
// What this window's data says (dev window 2026-11-16 06:03 -> 2026-11-17
// 06:03 UTC, 1,440 bars): BTC ranged $63,874-$65,467, buy-and-hold +$1.73,
// worst 120-minute drop only -1.37%. It is a choppy range, not a trend —
// the C3 trigger (-1.6%) would never fire here either, so this bot trades
// smaller dislocations and exits on the recovery itself instead of on a
// fixed take-profit: buy the dip, sell when the price has climbed back to
// (almost) where it was before the dip started.
//
//   Entry (flat only): the 60-minute return is at or below -0.8% AND the
//     10-minute return is at or above +0.05% (the bounce has started), at
//     least 15 bars after the last exit, full cash.
//   Exit (whole position): the close climbs back to 99.9% of the close
//     60 bars before entry (the dislocation has closed), or -2.0% below
//     the entry close (safety stop), or 180 bars after entry, whichever
//     comes first.
//   No fallback: a window with no -0.8% dip simply ends flat at $0 rather
//     than losing money on a momentum chase.
//
// Cross-window check (local simulator replicating the harness fill math,
// fees 4 bps + slippage 2 bps + pool impact; verified against the official
// grade-local on the previous race's dev window within $0.01): this exact
// rule set measures dev window +$18.86 (3 trades, all won), previous
// race's dev window +$0.78 (3 trades), previous race's LIVE window +$9.09
// (1 trade) — positive on all three, mean +$9.58. The neighbours are
// stable on the dev window (+$3.93 to +$18.86 across drop -0.7%/-0.9%,
// reversal +0.03%/+0.10%, recovery factor 0.998/1.000); the live-window
// outcome of every design tested hinges on one trade, so no design was
// picked for a single window's luck — this one was picked for the best
// mean across the three and the best score on the window immediately
// before the race (the best predictor of the race window). Max drawdown
// 2.5% on the dev window, 3.3% on the previous dev window — far inside
// the 25% guardrail. Baselines on the dev window: buy-and-hold +$1.73,
// hold-cash $0.00.
//
// Deterministic: pure float64 arithmetic on the closes the harness sends,
// no clock, no randomness, no network, no files. One order per reply at
// most, max slippage 100 bps (1%) past the close the order was decided on.

import { runBars, type BarsState, type Batch, type BuyInput, type SellInput } from "./vendor/makefun-bars.ts";

const SYMBOL = "CBBTC";
const DROP_WINDOW = 60; // bars of the slide that sets the bounce up
const DROP_LIMIT = -0.008; // 60-minute return at or below -0.8%
const REVERSAL_WINDOW = 10; // bars of the reversal that confirms the bounce
const REVERSAL_MIN = 0.0005; // 10-minute return at or above +0.05%
const RECOVERY_FACTOR = 0.999; // exit when the close is back to 99.9% of the pre-dip close
const STOP_LOSS = 0.02; // safety exit at -2.0% under the entry close
const MAX_HOLD_BARS = 180; // exit after 180 bars whatever the price
const COOLDOWN_BARS = 15; // bars after an exit before the next entry
const MAX_SLIPPAGE_BPS = 100;

const closes: number[] = [];
let entryClose: number | null = null;
let entryRef: number | null = null;
let entrySeq = -1;
let lastExitSeq = -1_000_000;

// Return of the close `win` bars ago against the latest close, or null while
// the window is still filling.
function windowReturn(win: number): number | null {
  const n = closes.length;
  if (n <= win) return null;
  const now = closes[n - 1];
  const then = closes[n - 1 - win];
  if (then === 0) return null;
  return now / then - 1;
}

await runBars({
  onBatch(state: BarsState, batch: Batch) {
    let sawBar = false;
    for (const bar of batch.bars) {
      if (bar.symbol !== SYMBOL) continue;
      closes.push(Number(bar.c));
      sawBar = true;
    }
    if (!sawBar || state.warmingUp) return [];
    const closeRaw = state.close(SYMBOL);
    if (closeRaw === null) return [];
    const close = Number(closeRaw);
    const held = state.positions.get(SYMBOL);
    const seq = state.seq;

    if (held !== undefined) {
      // Holding: exit when the dislocation has closed (the close is back
      // to the pre-dip level), on the safety stop, or on the hold limit.
      const recovered = entryRef !== null && close >= entryRef * RECOVERY_FACTOR;
      const hitStop = close <= entryClose! * (1 - STOP_LOSS);
      const tooOld = seq - entrySeq >= MAX_HOLD_BARS;
      if (recovered || hitStop || tooOld) {
        lastExitSeq = seq;
        entryClose = null;
        entryRef = null;
        const sell: SellInput = { side: "sell", symbol: SYMBOL, qty: held.qty, max_slippage_bps: MAX_SLIPPAGE_BPS };
        return [sell];
      }
      return [];
    }

    // Flat: enter only after a shallow slide plus a fresh reversal, past the
    // cooldown after the previous exit.
    if (seq - lastExitSeq < COOLDOWN_BARS) return [];
    const slide = windowReturn(DROP_WINDOW);
    if (slide !== null && slide <= DROP_LIMIT) {
      const reversal = windowReturn(REVERSAL_WINDOW);
      if (reversal !== null && reversal >= REVERSAL_MIN) {
        const cash = state.cash;
        if (cash < BigInt(state.hello.fees.min_notional_quote_units)) return [];
        entryClose = close;
        entryRef = closes[closes.length - 1 - DROP_WINDOW];
        entrySeq = seq;
        const buy: BuyInput = { side: "buy", symbol: SYMBOL, notional_quote_units: cash, max_slippage_bps: MAX_SLIPPAGE_BPS };
        return [buy];
      }
    }
    return [];
  },
});
