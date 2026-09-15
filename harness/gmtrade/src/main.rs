//! GMTrade (gmx-solana) rounding / dust value-leak numeric harness.
//!
//! Lead under test (from docs/hunts/gmtrade.md): favorable-rounding / dust
//! accumulation in the store program's deposit/withdraw math, and the
//! pool-backing invariant.
//!
//! The on-chain `store` program's deposit/withdraw amount math is a thin wrapper
//! over the pure-Rust `gmsol-model` crate (`Deposit::execute` / `Withdrawal::execute`,
//! `utils::usd_to_market_token_amount` / `market_token_amount_to_usd`). We drive that
//! EXACT code with deterministic oracle prices (the same role `mock-chainlink-verifier`
//! plays on a validator) and measure, to the token, what an attacker nets by looping
//! min-size deposit -> withdraw cycles.
//!
//! ORACLE (bug vs no-bug):
//!   * attacker end value (in USD at the operating oracle price) > start value  => VALUE EXTRACTED = BUG
//!   * else (attacker loses/breaks even, pool keeps the dust)                    => pool-favorable = NO BUG
//!
//! We run two configs:
//!   A. ZERO fees + ZERO price-impact  -> isolates PURE ROUNDING (the strongest attacker case).
//!   B. Default (realistic) fees+impact -> sanity that fees only make it worse for the attacker.

use gmsol_model::{
    market::{LiquidityMarketMutExt},
    params::{FeeParams, PriceImpactParams},
    price::Prices,
    test::{TestMarket, TestMarketConfig},
    MarketAction,
};

/// Zero-fee, zero-impact config for the u64/9 market: isolates pure rounding.
fn zero_config_u64() -> TestMarketConfig<u64, 9> {
    let mut c = TestMarketConfig::<u64, 9>::default();
    c.swap_fee_params = FeeParams::builder()
        .fee_receiver_factor(0)
        .positive_impact_fee_factor(0)
        .negative_impact_fee_factor(0)
        .build();
    c.swap_impact_params = PriceImpactParams::builder()
        .exponent(2_000_000_000)
        .positive_factor(0)
        .negative_factor(0)
        .build();
    c
}

fn zero_config_u128() -> TestMarketConfig<u128, 20> {
    let mut c = TestMarketConfig::<u128, 20>::default();
    c.swap_fee_params = FeeParams::builder()
        .fee_receiver_factor(0)
        .positive_impact_fee_factor(0)
        .negative_impact_fee_factor(0)
        .build();
    c.swap_impact_params = PriceImpactParams::builder()
        .exponent(200_000_000_000_000_000_000)
        .positive_factor(0)
        .negative_factor(0)
        .build();
    c
}

/// One deposit(long)->withdraw(all minted) round trip on a u64/9 market.
/// Returns (attacker_net_usd, minted, long_out, short_out) using min oracle price for value.
fn round_trip_u64(
    market: &mut TestMarket<u64, 9>,
    deposit_long: u64,
    prices: Prices<u64>,
) -> Result<(i128, u64, u64, u64), gmsol_model::Error> {
    let long_p = prices.long_token_price.min as i128;
    let short_p = prices.short_token_price.min as i128;

    let dep = market.deposit(deposit_long, 0, prices)?.execute()?;
    let minted = *dep.minted();
    if minted == 0 {
        // Deposit produced ZERO market tokens: the attacker's tokens are absorbed by
        // the pool with nothing minted back => pure loss (pool-favorable).
        let net = -(deposit_long as i128) * long_p;
        return Ok((net, 0, 0, 0));
    }
    let wd = market.withdraw(minted, prices)?.execute()?;
    let long_out = *wd.long_token_output();
    let short_out = *wd.short_token_output();
    let in_usd = deposit_long as i128 * long_p;
    let out_usd = long_out as i128 * long_p + short_out as i128 * short_p;
    Ok((out_usd - in_usd, minted, long_out, short_out))
}

fn round_trip_u128(
    market: &mut TestMarket<u128, 20>,
    deposit_long: u128,
    prices: Prices<u128>,
) -> Result<(i128, u128, u128, u128), gmsol_model::Error> {
    let long_p = prices.long_token_price.min as i128;
    let short_p = prices.short_token_price.min as i128;

    let dep = market.deposit(deposit_long, 0, prices)?.execute()?;
    let minted = *dep.minted();
    if minted == 0 {
        let net = -(deposit_long as i128) * long_p;
        return Ok((net, 0, 0, 0));
    }
    let wd = market.withdraw(minted, prices)?.execute()?;
    let long_out = *wd.long_token_output();
    let short_out = *wd.short_token_output();
    let in_usd = deposit_long as i128 * long_p;
    let out_usd = long_out as i128 * long_p + short_out as i128 * short_p;
    Ok((out_usd - in_usd, minted, long_out, short_out))
}

fn main() {
    println!("================ GMTrade deposit/withdraw ROUNDING numeric harness ================");
    println!("Target: gmsol-labs/gmx-solana  crate=gmsol-model (the store program's deposit/withdraw math)");
    println!("Oracle: attacker end USD value > start USD value  => VALUE EXTRACTED = BUG\n");

    let mut any_bug = false;

    // ---- Scenario A: u64/9 market, ZERO fees + ZERO impact (pure rounding) ----
    // Deposit sizes chosen to straddle rounding boundaries against the seed ratio.
    let sizes_u64: &[u64] = &[1, 2, 3, 5, 7, 11, 13, 99, 100, 101, 333, 1000, 9999, 12345];
    // Try several (long,short) price pairs to create non-trivial division remainders.
    let price_sets: &[(u64, u64, u64)] = &[(1, 1, 1), (120, 120, 1), (7, 7, 3), (100, 97, 101)];

    for &(idx, lp, sp) in price_sets {
        let prices = Prices::new_for_test(idx, lp, sp);
        for &size in sizes_u64 {
            let mut market = TestMarket::<u64, 9>::with_config(zero_config_u64());
            // Seed a victim LP so supply>0, pool_value>0 (mul_div path, not the empty-pool path).
            // Seed BIG relative to attacker so we probe the marginal rounding, not first-deposit inflation.
            let seed: u64 = 1_000_000_000;
            if market.deposit(seed, 0, prices).and_then(|a| a.execute()).is_err() {
                continue;
            }

            let iters = 100_000u64;
            let mut cumulative: i128 = 0;
            let mut best_single: i128 = i128::MIN;
            let mut ran = 0u64;
            for _ in 0..iters {
                match round_trip_u64(&mut market, size, prices) {
                    Ok((net, _m, _lo, _so)) => {
                        cumulative += net;
                        if net > best_single {
                            best_single = net;
                        }
                        ran += 1;
                    }
                    Err(_) => break, // e.g. pool cap / reserve hit; stop this cell
                }
            }
            let per_iter = if ran > 0 { cumulative as f64 / ran as f64 } else { 0.0 };
            let flag = if best_single > 0 || cumulative > 0 {
                any_bug = true;
                "  <<< ATTACKER-FAVORABLE !!!"
            } else {
                ""
            };
            println!(
                "A u64/9 zero-fee price(l={lp},s={sp}) dep={size:<6} iters={ran:<6} \
                 cum_net_usd={cumulative:<14} per_iter={per_iter:+.6} best_single={best_single}{flag}"
            );
        }
    }

    // ---- Scenario A': u128/20 market (production decimals), ZERO fees + ZERO impact ----
    {
        let prices = Prices::new_for_test(
            12_000_000_000_000u128,
            12_000_000_000_000u128,
            100_000_000_000u128,
        );
        let sizes_u128: &[u128] = &[1, 2, 3, 5, 7, 11, 13, 100, 1000, 99_999, 1_000_000];
        for &size in sizes_u128 {
            let mut market = TestMarket::<u128, 20>::with_config(zero_config_u128());
            let seed: u128 = 1_000_000_000_000_000;
            if market.deposit(seed, 0, prices).and_then(|a| a.execute()).is_err() {
                continue;
            }
            let iters = 100_000u64;
            let mut cumulative: i128 = 0;
            let mut best_single: i128 = i128::MIN;
            let mut ran = 0u64;
            for _ in 0..iters {
                match round_trip_u128(&mut market, size, prices) {
                    Ok((net, _m, _lo, _so)) => {
                        cumulative += net;
                        if net > best_single {
                            best_single = net;
                        }
                        ran += 1;
                    }
                    Err(_) => break,
                }
            }
            let per_iter = if ran > 0 { cumulative as f64 / ran as f64 } else { 0.0 };
            let flag = if best_single > 0 || cumulative > 0 {
                any_bug = true;
                "  <<< ATTACKER-FAVORABLE !!!"
            } else {
                ""
            };
            println!(
                "A' u128/20 zero-fee dep={size:<8} iters={ran:<6} cum_net_usd={cumulative:<20} \
                 per_iter={per_iter:+.6} best_single={best_single}{flag}"
            );
        }
    }

    // ---- Scenario B: u64/9 market, DEFAULT (realistic) fees+impact ----
    {
        let prices = Prices::new_for_test(120, 120, 1);
        let sizes_u64: &[u64] = &[1, 10, 100, 1000, 100_000, 1_000_000];
        for &size in sizes_u64 {
            let mut market = TestMarket::<u64, 9>::default();
            let seed: u64 = 1_000_000_000;
            if market.deposit(seed, 0, prices).and_then(|a| a.execute()).is_err() {
                continue;
            }
            let iters = 10_000u64;
            let mut cumulative: i128 = 0;
            let mut best_single: i128 = i128::MIN;
            let mut ran = 0u64;
            for _ in 0..iters {
                match round_trip_u64(&mut market, size, prices) {
                    Ok((net, _m, _lo, _so)) => {
                        cumulative += net;
                        if net > best_single {
                            best_single = net;
                        }
                        ran += 1;
                    }
                    Err(_) => break,
                }
            }
            let per_iter = if ran > 0 { cumulative as f64 / ran as f64 } else { 0.0 };
            let flag = if best_single > 0 || cumulative > 0 {
                any_bug = true;
                "  <<< ATTACKER-FAVORABLE !!!"
            } else {
                ""
            };
            println!(
                "B u64/9 DEFAULT-fees dep={size:<8} iters={ran:<6} cum_net_usd={cumulative:<16} \
                 per_iter={per_iter:+.6} best_single={best_single}{flag}"
            );
        }
    }

    // ---- Pool-backing invariant cross-check (conservation of value) ----
    // Victim deposits, attacker loops dust, then we redeem the victim's full GM position.
    // If the victim can withdraw AT LEAST what they put in (minus nothing), the pool never
    // leaked to the attacker. We report the victim's realized delta.
    {
        let prices = Prices::new_for_test(1, 1, 1);
        let mut market = TestMarket::<u64, 9>::with_config(zero_config_u64());
        let victim_deposit: u64 = 1_000_000_000;
        let vd = market.deposit(victim_deposit, 0, prices).unwrap().execute().unwrap();
        let victim_gm = *vd.minted();

        // Attacker hammers dust round-trips.
        let mut attacker_cum: i128 = 0;
        for _ in 0..200_000u64 {
            match round_trip_u64(&mut market, 1, prices) {
                Ok((net, _, _, _)) => attacker_cum += net,
                Err(_) => break,
            }
        }
        // Redeem victim fully.
        let vw = market.withdraw(victim_gm, prices).unwrap().execute().unwrap();
        let victim_out = *vw.long_token_output() as i128 + *vw.short_token_output() as i128;
        let victim_delta = victim_out - victim_deposit as i128;
        println!(
            "\nINVARIANT victim_deposit={victim_deposit} victim_out={victim_out} \
             victim_delta={victim_delta:+} attacker_cum_usd_over_200k={attacker_cum:+}"
        );
        println!(
            "  (victim_delta >= 0 means the pool retained value; attacker_cum <= 0 means no extraction)"
        );
    }

    println!("\n================================ VERDICT ================================");
    if any_bug {
        println!("RESULT: ATTACKER-FAVORABLE DRIFT DETECTED -> potential rounding bug. Inspect flagged rows.");
    } else {
        println!("RESULT: NO attacker-favorable drift in any scenario/size/price.");
        println!("Every deposit->withdraw round trip nets <= 0 to the attacker: rounding is POOL-FAVORABLE.");
        println!("Deposit mint = floor(supply*usd/pool_value); withdraw out = floor(...)/price (floor).");
        println!("Both directions floor toward the pool => dust is retained by the pool, not extractable.");
        println!("=> NOT A BUG (within rounding tolerance).");
    }
}
