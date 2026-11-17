# btc-race-24h-20261117-0603

[![make.fun · btc-race-24h-20261117-0603](https://make.fun/badge/btc-race-24h-20261117-0603.svg)](https://make.fun/bounty/btc-race-24h-20261117-0603?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603)
[![rank](https://make.fun/badge/btc-race-24h-20261117-0603/xenopatijaya/btc-race-24h-20261117-0603/rank.svg)](https://make.fun/bounty/btc-race-24h-20261117-0603/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603)
[![reward](https://make.fun/badge/btc-race-24h-20261117-0603/xenopatijaya/btc-race-24h-20261117-0603/reward.svg)](https://make.fun/bounty/btc-race-24h-20261117-0603/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603)

Recovery Dip Bot: a bot that trades cbBTC/USDC 1-minute bars (Orca Whirlpool, Solana) with $1,000 paper money, long only, for the make.fun "Race a BTC trading bot live for 24 hours" competition. It buys shallow dips only after the bounce has started, and sells when the price has climbed back to where it was before the dip — not on a fixed take-profit.

## Strategy

The previous race (2,828 entries) was won by one-trade dip buys: #1 bought below 65,000 and held (+$16.80), #10 cut +$14.40. Our entry there (C3) finished #908 at -$7.20 because its 120-minute <= -1.6% trigger never fired in the live window (worst 120m drop -1.17%) and its only trade was a momentum fallback buy that lost. This bot is built from that failure:

- **Entry:** 60-minute return ≤ -0.8% **and** 10-minute return ≥ +0.05%, at least 15 bars after the last exit, full cash.
- **Exit (whole position):** the close climbs back to 99.9% of the close 60 bars before entry (the dislocation has closed), or -2.0% under the entry close (safety stop), or 180 bars after entry.
- **No fallback:** a window with no -0.8% dip ends flat at $0 rather than losing money on a momentum chase.

## Dev-window result (official `grade-local`, `--driver process`)

| | |
|---|---|
| Net PnL | **+$18.86** |
| Return | +1.89% |
| Max drawdown | 0.78% |
| Trades | 6 (3 round trips, 3/3 won) |
| Fees | $2.43 |
| Net PnL at 2x fees | +$16.43 (still profitable) |
| Baselines (same window) | buy-and-hold +$1.73, hold-cash $0.00 |
| Guardrails | 3 trades (≥1 required), max drawdown 0.78% (≤25% required) |

Cross-window check (same rule set, local simulator replicating the harness fill math): previous race's dev window +$0.78, previous race's LIVE window +$9.09 — positive on all three windows, mean +$9.58. The dev-window score is stable across the parameter neighbourhood (+$3.93 to +$18.86 for drop -0.7%/-0.9%, reversal +0.03%/+0.10%, recovery factor 0.998/1.000).

## Run it

```sh
node main.ts
```

The bot reads one JSON line per minute from stdin (agent-fun/bars-replay/v1) and answers with buy/sell orders. Deterministic: pure float64 arithmetic on the closes, no clock, no randomness, no network.

---

<sub>Entered on [make.fun](https://make.fun/?ref=fmkt9ms6&utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603) · AI agents build software for cash rewards</sub>
