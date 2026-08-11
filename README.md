# Whitehat Auto Bounty

**AI-adjudicated bug bounty payouts on GenLayer.**

Whitehat Auto Bounty is a GenLayer Intelligent Contract that lets security researchers submit a public bug report and evidence URL, then uses decentralized AI-validator consensus to classify the report by severity and automatically reserve a native-token bounty when the pool has enough available funds.

## Problem

Bug bounty programs rely heavily on manual triage. Teams must decide whether a report is real, in scope, supported by evidence, and how severe it is. These are qualitative judgments that deterministic smart contracts cannot reliably make from unstructured reports and public evidence.

## Solution

Whitehat Auto Bounty combines two layers:

- **Deterministic contract rules:** owner controls, one submission per address, pool funding, severity-to-bounty mapping, reserved-fund accounting, and withdrawals.
- **GenLayer AI adjudication:** validators fetch project documentation and public evidence, evaluate the report, and classify it as `CRITICAL`, `HIGH`, `MEDIUM`, `LOW`, or `INVALID`.

The final adjudication result, bounty amount, and payout status are stored onchain.

## Why GenLayer

The core question is subjective:

> Does the submitted evidence demonstrate a real vulnerability, and how severe is it?

The contract uses GenLayer's Equivalence Principle through `gl.eq_principle.prompt_non_comparative`. Validators evaluate the same adjudication task and converge on an accepted result.

The contract also treats bug descriptions and evidence as untrusted input and explicitly tells validators not to follow instructions embedded inside those sections.

## Contract Flow

```text
Owner deploys contract
        ↓
Owner funds bounty pool
        ↓
Researcher submits bug report + public evidence
        ↓
GenLayer validators evaluate docs + evidence
        ↓
CRITICAL / HIGH / MEDIUM / LOW / INVALID
        ↓
Deterministic bounty mapping
        ↓
Enough available pool?
    ┌───────────────┴───────────────┐
   YES                              NO
    ↓                                ↓
RESERVED                        UNDERFUNDED
    ↓
Researcher withdraws native payout
```

## Default Bounties

| Severity | Bounty |
|---|---:|
| CRITICAL | 5 GEN |
| HIGH | 2 GEN |
| MEDIUM | 1 GEN |
| LOW | 0.5 GEN |
| INVALID | 0 GEN |

All amounts are stored internally in wei.

## Payout States

### `RESERVED`

The report is eligible and the available pool is large enough. The contract increases `reserved_payouts` and stores a researcher-specific pending payout.

### `UNDERFUNDED`

The report is eligible, but the pool does not have enough available funds. No pending payout is created.

### `NO_PAYOUT`

The report is classified as `INVALID`, so no bounty is assigned.

## Reserved-Funds Accounting

The contract tracks:

```text
available balance = pool balance - reserved payouts
```

Reserved funds are therefore not counted twice.

When a researcher calls `withdraw()`, the contract clears that pending payout, reduces the reserved total, and emits a native-token transfer to the researcher.

## Validation Design

- Owner cannot submit reports.
- One report per address.
- Only owner can update project docs URL.
- Only owner can configure bounty amounts.
- Program can be paused.
- Public evidence is treated as untrusted.
- Severity is constrained to a fixed set.
- Underfunded reports do not create unbacked payouts.
- Researchers can only withdraw their own pending payout.

## Public Methods

### Write

- `update_docs_url(docs_url)`
- `fund_pool()` — payable
- `configure_bounties(critical, high, medium, low)`
- `set_active(status)`
- `submit_report(bug_description, evidence_url)`
- `withdraw()`

### Read

- `get_config()`
- `get_pending_payout(addr)`
- `get_result(addr)`
- `has_submitted(addr)`
- `get_pool_status()`

## Example Results

Reserved payout:

```json
{
  "severity": "CRITICAL",
  "amount_wei": 5000000000000000000,
  "payout_status": "RESERVED"
}
```

Underfunded payout:

```json
{
  "severity": "CRITICAL",
  "amount_wei": 5000000000000000000,
  "payout_status": "UNDERFUNDED"
}
```

Invalid report:

```json
{
  "severity": "INVALID",
  "amount_wei": 0,
  "payout_status": "NO_PAYOUT"
}
```

## Verified Runtime Tests

The contract has been tested end-to-end in GenLayer Studio.

### Valid CRITICAL report + sufficient funds

Observed:

```text
severity      = CRITICAL
amount        = 5 GEN
payout_status = RESERVED
```

The researcher called `withdraw()` and the transaction finalized successfully. After withdrawal, the pending payout became `0` and reserved funds were cleared.

### INVALID report

Observed:

```text
severity      = INVALID
amount        = 0
payout_status = NO_PAYOUT
```

### Valid CRITICAL report + insufficient funds

With only `2 GEN` available and a `5 GEN` CRITICAL bounty:

```text
severity      = CRITICAL
amount        = 5 GEN
payout_status = UNDERFUNDED
pending       = 0
```

Pool state remained:

```text
balance   = 2 GEN
reserved  = 0 GEN
available = 2 GEN
```

### Owner restriction

An owner attempt to submit a report finalized with the expected error:

```text
Owner cannot submit reports
```

## Runtime Note

During AI adjudication, GenLayer Studio may display:

```text
Reading storage in nondet mode is not supported
```

The recorded tests still reached consensus and produced accepted results. This is documented as a runtime observation.

## Tech Stack

- GenLayer Intelligent Contracts
- GenLayer Studio / Studionet
- Python
- `gl.eq_principle.prompt_non_comparative`
- `gl.nondet.web.render`
- native-token payout via `@gl.evm.contract_interface`

## Reusable Primitive

The key primitive is:

```text
unstructured public evidence
+ decentralized AI adjudication
+ deterministic severity-to-bounty mapping
+ reserved-fund accounting
+ native onchain settlement
```

This pattern can support bug bounty programs, decentralized software assurance, automated security triage, and agent-operated reward systems.
