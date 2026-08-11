# Whitehat Auto Bounty — Runtime Testing

This document records the core runtime tests completed in GenLayer Studio.

## Test Matrix

| Test | Expected | Observed |
|---|---|---|
| Valid CRITICAL report + sufficient pool | CRITICAL, RESERVED, 5 GEN | PASS |
| Researcher withdraw | Native payout succeeds, pending becomes 0 | PASS |
| INVALID report | INVALID, NO_PAYOUT, 0 GEN | PASS |
| CRITICAL report + insufficient pool | CRITICAL, UNDERFUNDED, no pending payout | PASS |
| Owner submits report | Rejected | PASS |

## 1. CRITICAL Report — Sufficient Pool

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

The researcher called:

```text
withdraw()
```

Observed transaction:

```text
Status: FINALIZED
Result: SUCCESS
```

Post-withdraw:

```text
get_pending_payout(researcher) -> "0"
```

Pool state:

```json
{
  "balance_wei": 2000000000000000000,
  "reserved_wei": 0,
  "available_wei": 2000000000000000000
}
```

Result: **PASS**

## 2. INVALID Report

Observed:

```json
{
  "severity": "INVALID",
  "reason": "The bug report describes a visual preference (dark vs light theme) with no security impact, no loss of funds, no unauthorized access, and no exploit. It does not describe a real security vulnerability as defined in the project documentation.",
  "amount_wei": 0,
  "payout_status": "NO_PAYOUT"
}
```

Result: **PASS**

## 3. CRITICAL Report — Underfunded Pool

Precondition:

```text
available pool = 2 GEN
CRITICAL bounty = 5 GEN
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

Result: **PASS**

## 4. Owner Submission Restriction

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

Result: **PASS**

## Summary

The completed tests verify:

1. AI-validator consensus can classify a valid report as `CRITICAL`.
2. Severity maps deterministically to the configured bounty.
3. Sufficient funds are reserved before withdrawal.
4. Native settlement succeeds.
5. Pending and reserved accounting clear after withdrawal.
6. Invalid reports receive no payout.
7. Underfunded valid reports do not create unbacked pending payouts.
8. Owner submission restrictions are enforced.
