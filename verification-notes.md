# Verification Notes

The terminal now exposes a private-vault organization workflow with a scenario name field, comma-separated tags, free-text search, and tag filters. The desktop review confirms these additions fit into the terminal’s left-side operations rail alongside the calibrated reference controls and the CSV, PDF, and print report actions.

The mobile review confirms that the initial implementation hid the extended sidebar sections; the responsive rules were corrected. The final mobile view displays calibration asset selection, calibration-rule selection, tagged private-vault inputs, search, and branded report actions above the vertically stacked market workspace without horizontal clipping.

The calibration feed remains a manual/cached public-reference input, consistent with its documented rate-limit constraints. The expanded automated suite passed nine tests, including tag normalization and calibration-rule variance, and TypeScript validation completed without errors.
