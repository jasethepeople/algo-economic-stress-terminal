# External Data Basis

The calibration panel uses CoinGecko’s keyless public `simple/price` endpoint for manually refreshed BTC, ETH, and SOL reference quotes. It requests USD price, 24-hour volume, 24-hour change, and the last-update timestamp. CoinGecko documents that the keyless public pool has dynamic shared rate limits and is not intended for production high-frequency polling, so this terminal caches a response for 60 seconds and exposes refresh as a user action rather than a background feed.

Source documentation: https://docs.coingecko.com/reference/simple-price

Keyless API policy and endpoint base URL: https://docs.coingecko.com/docs/keyless-public-api
