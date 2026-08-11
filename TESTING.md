# Whitehat Auto Bounty — Runtime Testing

This document records the core runtime tests completed in GenLayer Studio on Studionet.

The tests cover AI adjudication, deterministic bounty mapping, reserved-fund accounting, native settlement, invalid-report handling, insufficient liquidity, and owner restrictions.

---

## Test Matrix

| Test | Expected | Observed |
|---|---|---|
| Valid CRITICAL report + sufficient pool | CRITICAL → RESERVED | PASS |
| Researcher withdrawal | Native payout succeeds | PASS |
| 60 GEN settlement stress test | Reserve → withdraw → accounting clears | PASS |
| INVALID report | INVALID → NO_PAYOUT → 0 GEN | PASS |
| CRITICAL report + insufficient pool | UNDERFUNDED → no pending payout | PASS |
| Owner submits report | Rejected | PASS |
| Restore default bounty configuration | 5 / 2 / 1 / 0.5 GEN | PASS |

---

## 1. CRITICAL Report — Sufficient Pool

A valid vulnerability report was submitted with public evidence describing an in-scope critical vulnerability.

Observed result:

```json
{
  "severity": "CRITICAL",
  "reason": "The report matches the project documentation exactly: withdraw_all lacks authorization, allowing any external user to transfer the entire treasury balance to themselves. This is a real, in-scope issue with clear evidence and complete fund-drain impact.",
  "amount_wei": 5000000000000000000,
  "payout_status": "RESERVED"
}
```

Pending payout:

```text
5000000000000000000
```

This confirms that:

```text
CRITICAL
    ↓
5 GEN bounty
    ↓
Sufficient available pool
    ↓
RESERVED
```

Result: **PASS**

---

## 2. Native Settlement

The researcher called:

```text
withdraw()
```

Observed transaction:

```text
Status: FINALIZED
Result: SUCCESS
```

After withdrawal:

```text
get_pending_payout(researcher) -> "0"
```

This verifies that the researcher can successfully receive a bounty that was previously reserved by the contract.

Result: **PASS**

---

## 3. 60 GEN Settlement Stress Test

An additional settlement test was performed to verify reserved-fund accounting with a larger and clearly observable payout.

For this test only, the CRITICAL bounty was temporarily configured to:

```text
60 GEN
```

After a valid CRITICAL adjudication, the observed pool state was:

```json
{
  "balance_wei": 104000000000000000000,
  "reserved_wei": 60000000000000000000,
  "available_wei": 44000000000000000000
}
```

Equivalent values:

```text
Pool balance = 104 GEN
Reserved     = 60 GEN
Available    = 44 GEN
```

The accounting therefore satisfied:

```text
104 GEN - 60 GEN = 44 GEN available
```

The reserved 60 GEN was no longer available for another bounty allocation.

### Researcher Withdrawal

The researcher wallet holding the pending payout called:

```text
withdraw()
```

Observed transaction:

```text
Status: ACCEPTED
Result: SUCCESS
```

After withdrawal, `get_pool_status()` returned:

```json
{
  "balance_wei": 44000000000000000000,
  "reserved_wei": 0,
  "available_wei": 44000000000000000000
}
```

Equivalent values:

```text
Pool balance = 44 GEN
Reserved     = 0 GEN
Available    = 44 GEN
```

This verifies the complete settlement path:

```text
CRITICAL adjudication
        ↓
60 GEN bounty
        ↓
60 GEN RESERVED
        ↓
Available liquidity reduced
        ↓
Researcher withdraw()
        ↓
Native payout succeeds
        ↓
Reserved amount cleared
        ↓
Pool accounting updated
```

Result: **PASS**

---

## 4. INVALID Report

An invalid report describing a non-security issue was submitted.

Observed:

```json
{
  "severity": "INVALID",
  "reason": "The bug report describes a visual preference (dark vs light theme) with no security impact, no loss of funds, no unauthorized access, and no exploit. It does not describe a real security vulnerability as defined in the project documentation.",
  "amount_wei": 0,
  "payout_status": "NO_PAYOUT"
}
```

No bounty was created or reserved.

Result: **PASS**

---

## 5. CRITICAL Report — Underfunded Pool

Precondition:

```text
Available pool   = 2 GEN
CRITICAL bounty  = 5 GEN
```

Evidence:

```text
https://pastebin.com/gTHUdSCf
```

Observed:

```json
{
  "severity": "CRITICAL",
  "reason": "The report matches the project documentation exactly: withdraw_all lacks authorization, allowing any external user to drain 100% of treasury funds. The documented expected severity is CRITICAL, and the provided evidence supports direct, real exploitability and total fund loss.",
  "amount_wei": 5000000000000000000,
  "payout_status": "UNDERFUNDED"
}
```

Pending payout:

```text
get_pending_payout(researcher) -> "0"
```

Pool remained:

```json
{
  "balance_wei": 2000000000000000000,
  "reserved_wei": 0,
  "available_wei": 2000000000000000000
}
```

The contract therefore recorded the valid adjudication without creating an unbacked payout.

Result: **PASS**

---

## 6. Owner Submission Restriction

The contract owner attempted to submit a report.

Input:

```text
submit_report(
  "Test owner submission validation.",
  "https://example.com"
)
```

Observed:

```text
Status: FINALIZED
Result: ERROR
Owner cannot submit reports
```

The owner was prevented from participating as a bounty researcher.

Result: **PASS**

---

## 7. Restore Default Bounty Configuration

After completing the 60 GEN settlement stress test, the bounty configuration was restored to the intended default values.

Observed configuration:

```text
CRITICAL = 5 GEN
HIGH     = 2 GEN
MEDIUM   = 1 GEN
LOW      = 0.5 GEN
```

Onchain values:

```text
bounty_critical_wei = 5000000000000000000
bounty_high_wei     = 2000000000000000000
bounty_medium_wei   = 1000000000000000000
bounty_low_wei      = 500000000000000000
```

Final program state:

```text
is_active            = true
reserved_payouts_wei = 0
```

Result: **PASS**

---

## Runtime Observation

During AI adjudication, GenLayer Studio may display:

```text
Reading storage in nondet mode is not supported
```

In the verified Studio runs documented above, adjudication transactions still finalized and the resulting onchain state was successfully recorded.

This is documented as a Studionet runtime observation.

---

## Summary

The completed runtime tests verify that:

1. GenLayer AI-validator consensus can classify a valid vulnerability report as `CRITICAL`.
2. Invalid reports can be classified as `INVALID`.
3. Severity maps deterministically to the configured bounty amount.
4. Sufficient bounty funds are reserved before settlement.
5. Reserved funds are removed from available liquidity.
6. Researchers can successfully withdraw their reserved native-token bounty.
7. Pending and global reserved accounting clear after withdrawal.
8. Valid but underfunded reports do not create unbacked pending payouts.
9. Owner submission restrictions are enforced.
10. A 60 GEN reserve-and-withdraw settlement was successfully completed.
11. The default bounty configuration was restored after testing.

---

## Final Verified State

After all runtime tests:

```text
CRITICAL bounty = 5 GEN
HIGH bounty     = 2 GEN
MEDIUM bounty   = 1 GEN
LOW bounty      = 0.5 GEN

PROGRAM ACTIVE
RESERVED PAYOUTS = 0
```

The core flow has therefore been tested end-to-end:

```text
Submit report
      ↓
GenLayer AI adjudication
      ↓
Severity classification
      ↓
Deterministic bounty mapping
      ↓
Reserve available funds
      ↓
Researcher withdrawal
      ↓
Native settlement
      ↓
Pool accounting updated
```
