# Whitehat Auto-Bounty — Testing Guide

All bounty amounts are denominated in **wei** (native token smallest unit).  
1 GEN = 1,000,000,000,000,000,000 wei (10¹⁸)

Default bounty amounts:

| Severity | Amount (wei)          | Amount (GEN) |
|----------|-----------------------|--------------|
| CRITICAL | 5,000,000,000,000,000 | 0.005        |
| HIGH     | 2,000,000,000,000,000 | 0.002        |
| MEDIUM   |   500,000,000,000,000 | 0.0005       |
| LOW      |   100,000,000,000,000 | 0.0001       |

---

## Test 1 — Funded pool: configure, fund, submit, withdraw

**Purpose:** Verify that a reward matching the configured amount can be funded and withdrawn end-to-end.

### Steps

**1a. Deploy contract**

```python
# Owner wallet: 0xOwner
# Constructor sets default bounty amounts in wei
```

**1b. Configure a specific bounty (optional override)**

```python
configure_bounties(
    critical_wei = 5_000_000_000_000_000,   # 0.005 GEN
    high_wei     = 2_000_000_000_000_000,   # 0.002 GEN
    medium_wei   =   500_000_000_000_000,   # 0.0005 GEN
    low_wei      =   100_000_000_000_000,   # 0.0001 GEN
)
```

**1c. Fund the pool**

```python
# Send value = 5_000_000_000_000_000 wei (enough for one CRITICAL payout)
fund_pool()  # payable, value = 5_000_000_000_000_000
```

**1d. Hacker submits CRITICAL report**

```python
# Hacker wallet: 0xHacker1
submit_report(
    bug_description = "Reentrancy in withdraw() allows draining the pool...",
    evidence_url    = "https://example.com/cve-report",
)
```

Expected: AI validators assign `CRITICAL`. `get_pending_payout("0xHacker1")` returns `"5000000000000000"`.

**1e. Hacker withdraws**

```python
# called from 0xHacker1
withdraw()
```

Expected:
- Pool balance decreases by `5_000_000_000_000_000` wei
- `get_pending_payout("0xHacker1")` returns `"0"`
- NativePayout transfers exactly `5_000_000_000_000_000` wei to `0xHacker1`

---

## Test 2 — Multiple competing claims, pool funded for all

**Purpose:** Verify independent claims from different wallets each receive their correct configured reward.

### Steps

**2a. Fund pool for multiple payouts**

```python
# Fund enough for 3 payouts: 1 CRITICAL + 1 HIGH + 1 MEDIUM
# = 5_000_000_000_000_000 + 2_000_000_000_000_000 + 500_000_000_000_000
# = 7_500_000_000_000_000 wei
fund_pool()  # value = 7_500_000_000_000_000
```

**2b. Three hackers submit independently**

```python
# 0xHacker1 — CRITICAL report
submit_report("Critical reentrancy...", "https://example.com/report1")

# 0xHacker2 — HIGH report
submit_report("Access control bypass...", "https://example.com/report2")

# 0xHacker3 — MEDIUM report
submit_report("Integer overflow in fee calculation...", "https://example.com/report3")
```

**2c. Each hacker withdraws**

```python
withdraw()  # from 0xHacker1 → receives 5_000_000_000_000_000 wei
withdraw()  # from 0xHacker2 → receives 2_000_000_000_000_000 wei
withdraw()  # from 0xHacker3 → receives   500_000_000_000_000 wei
```

Expected:
- Each `withdraw()` transfers the exact configured amount for that severity
- `get_pending_payout` returns `"0"` for all three after withdrawal
- Pool balance reaches 0
- No cross-contamination between claims

---

## Test 3 — Underfunded pool: withdraw reverts

**Purpose:** Verify the contract refuses to create a payout when the pool cannot cover it.

### Steps

**3a. Fund pool with less than one CRITICAL bounty**

```python
fund_pool()  # value = 1_000_000_000_000_000 wei (only 0.001 GEN)
```

**3b. Hacker submits CRITICAL report**

```python
# 0xHacker1
submit_report("Critical bug...", "https://example.com/report")
```

Expected: `get_pending_payout("0xHacker1")` returns `"5000000000000000"` (payout recorded).

**3c. Hacker attempts to withdraw**

```python
withdraw()  # from 0xHacker1
```

Expected: **reverts** with error:

```
Pool underfunded: cannot pay 5000000000000000 wei, pool has 1000000000000000 wei
```

The pending payout remains intact — `get_pending_payout("0xHacker1")` still returns `"5000000000000000"`.

**3d. Owner tops up the pool**

```python
fund_pool()  # value = 4_000_000_000_000_000 (top up to cover the difference)
```

**3e. Hacker retries withdraw**

```python
withdraw()  # from 0xHacker1 — succeeds now
```

Expected: transfer of `5_000_000_000_000_000` wei succeeds.

---

## Test 4 — Duplicate submission guard

**Purpose:** Verify one wallet cannot submit twice.

```python
# 0xHacker1 submits once — succeeds
submit_report("First report...", "https://example.com/r1")

# 0xHacker1 submits again — must revert
submit_report("Second report...", "https://example.com/r2")
# Expected error: "Already submitted a report"
```

---

## Test 5 — INVALID report receives no payout

**Purpose:** Verify irrelevant or low-quality reports produce no pending payout.

```python
submit_report(
    bug_description = "The website has a typo on the homepage.",
    evidence_url    = "https://example.com/not-a-bug",
)
```

Expected:
- `get_result("0xHacker")` contains `{"severity": "INVALID", ...}`
- `get_pending_payout("0xHacker")` returns `"0"`

---

## Unit consistency check

Verify that `get_config()` returns amounts in wei matching `configure_bounties()` inputs:

```python
configure_bounties(
    critical_wei = 9_000_000_000_000_000,
    high_wei     = 4_000_000_000_000_000,
    medium_wei   =   800_000_000_000_000,
    low_wei      =   200_000_000_000_000,
)

config = json.loads(get_config())
assert config["bounty_critical_wei"] == 9_000_000_000_000_000
assert config["bounty_high_wei"]     == 4_000_000_000_000_000
assert config["bounty_medium_wei"]   ==   800_000_000_000_000
assert config["bounty_low_wei"]      ==   200_000_000_000_000
```

All amounts displayed in the frontend must be converted from wei to GEN for human readability (`amount_wei / 1e18`), and all `configure_bounties` inputs must be passed in wei.
