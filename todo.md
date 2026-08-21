# Project TODO

- [x] Define typed simulation parameters for agent populations, volatility, bonding curve, transaction tax, seed capital, and configurable tick cadence.
- [x] Implement the agent-based market engine with arbitrageur, liquidity-provider, and momentum-trader decision policies.
- [x] Implement bonding-curve spot pricing, taxable execution, liquidity reserves, and slippage calculation.
- [x] Implement deterministic market shock actions for flash crashes, liquidity drains, and whale dumps.
- [x] Compute per-tick order-book depth, OHLC/volume history, agent positions, PnL, and wealth distribution.
- [x] Implement bounded server-side Monte Carlo stress paths and derive collapse probability, risk score, Gini coefficient, survival rate, and survival trend on every tick.
- [x] Add a real-time server-sent events feed that publishes full simulation snapshots at the configured tick interval while a terminal session is open.
- [x] Add database tables, helpers, typed procedures, and UI flows for named scenario snapshots with persisted state replay.
- [x] Build a dark glassmorphism multi-panel terminal shell with a compact command header and dense information hierarchy.
- [x] Build a Canvas-rendered high-frequency price, volume, and slippage visualization with an inspectable crosshair and live status.
- [x] Build a dynamic order-book depth display with bid/ask aggregation, spread, imbalance, and recent execution tape.
- [x] Build an agent exposure panel showing archetype inventory, PnL, win ratio, and survival state.
- [x] Build a systemic-risk panel showing collapse probability gauge, Gini coefficient, survival trend, and Monte Carlo distribution.
- [x] Build a parameter control panel with sliders, numeric inputs, tick cadence controls, scenario save/load, and market-shock triggers.
- [x] Add drag-resizable dashboard panels and responsive fallbacks for narrower desktop and tablet screens.
- [x] Write unit tests covering simulation invariants, shock effects, risk metrics, and scenario serialization/replay.
- [x] Run final type checks and tests, review runtime logs, and verify terminal behavior visually at desktop and mobile breakpoints.
- [x] Create a final project checkpoint and document the request-scoped live-streaming behavior of the current hosting mode.
