# Whitehat Auto Bounty

**AI-adjudicated bug bounty payouts on GenLayer.**

Whitehat Auto Bounty is a GenLayer Intelligent Contract and dApp that allows security researchers to submit public bug reports and evidence, uses decentralized AI-validator consensus to determine vulnerability severity, and automatically reserves native-token bounty payouts when sufficient funds are available.

The project combines subjective AI adjudication with deterministic onchain payout rules, reserved-fund accounting, and native settlement.

---

## Problem

Bug bounty programs rely heavily on manual triage.

Teams must determine whether:

- a reported vulnerability is real,
- the issue is within scope,
- the submitted evidence actually supports the claim,
- and how severe the impact is.

These decisions depend on interpreting unstructured reports, technical documentation, and public evidence.

Traditional deterministic smart contracts cannot reliably make these qualitative judgments on their own.

---

## Solution

Whitehat Auto Bounty combines two layers.

### Deterministic Contract Logic

The Intelligent Contract handles:

- owner controls,
- one submission per researcher address,
- bounty pool funding,
- configurable severity-to-bounty mapping,
- reserved-fund accounting,
- underfunded payout handling,
- researcher-specific pending payouts,
- and native-token withdrawals.

### GenLayer AI Adjudication

GenLayer validators evaluate:

- project documentation,
- the submitted bug description,
- and public evidence.

Validators determine whether the vulnerability is valid and classify it as:

```text
CRITICAL
HIGH
MEDIUM
LOW
INVALID
```

The accepted adjudication result is then passed into deterministic settlement logic.

The final severity, bounty amount, payout status, and settlement state are stored onchain.

---

## Why GenLayer

The core question behind a bug bounty cannot be reduced to a simple deterministic rule:

> Does the submitted evidence demonstrate a real vulnerability, and how severe is its impact?

Answering this requires interpretation of technical documentation and unstructured evidence.

Whitehat Auto Bounty uses GenLayer's Equivalence Principle through:

```python
gl.eq_principle.prompt_non_comparative
```

Multiple validators independently evaluate the same adjudication task and converge on an accepted result.

The contract also treats bug descriptions and external evidence as untrusted input and explicitly instructs validators not to follow commands or instructions contained inside those sections.

This allows subjective security analysis to be combined with deterministic onchain settlement.

---

## Contract Flow

```text
Owner deploys contract
        ↓
Owner funds bounty pool
        ↓
Researcher submits bug report + public evidence
        ↓
GenLayer validators evaluate documentation + evidence
        ↓
CRITICAL / HIGH / MEDIUM / LOW / INVALID
        ↓
Deterministic severity-to-bounty mapping
        ↓
Enough available pool?
    ┌───────────────┴───────────────┐
   YES                              NO
    ↓                                ↓
RESERVED                        UNDERFUNDED
    ↓
Researcher withdraws native payout
```

---

## Default Bounties

| Severity | Bounty |
|----------|-------:|
| CRITICAL | 5 GEN |
| HIGH | 2 GEN |
| MEDIUM | 1 GEN |
| LOW | 0.5 GEN |
| INVALID | 0 GEN |

All bounty amounts are stored internally in wei.

The owner can update these amounts through the contract configuration.

---

## Payout States

### `RESERVED`

The report is valid and the bounty pool has enough available liquidity.

The contract:

1. determines the bounty from severity,
2. increases `reserved_payouts`,
3. creates a researcher-specific pending payout,
4. and prevents those funds from being allocated again.

The researcher can then withdraw the reserved native-token bounty.

### `UNDERFUNDED`

The report is valid, but the available bounty pool is smaller than the required reward.

No unbacked pending payout is created.

The adjudication result remains recorded onchain with:

```text
payout_status = UNDERFUNDED
```

### `NO_PAYOUT`

The report is classified as:

```text
INVALID
```

No bounty is assigned and no funds are reserved.

---

## Reserved-Funds Accounting

The contract tracks available liquidity using:

```text
available balance = pool balance - reserved payouts
```

This prevents the same funds from being promised to multiple researchers.

For example:

```text
Pool balance:      104 GEN
Reserved payouts:   60 GEN
Available balance:  44 GEN
```

Only the remaining `44 GEN` can be used to back additional bounty decisions.

When a researcher successfully calls:

```text
withdraw()
```

the contract:

1. clears the researcher's pending payout,
2. reduces the global reserved amount,
3. transfers the native-token bounty,
4. and updates the pool accounting.

---

## Validation Design

Whitehat Auto Bounty includes several safeguards:

- Owner cannot submit bug reports.
- One report is allowed per researcher address.
- Only the owner can update the project documentation URL.
- Only the owner can configure bounty amounts.
- The bounty program can be paused or activated.
- Public evidence is treated as untrusted input.
- Validator output is constrained to a fixed severity set.
- Underfunded reports do not create unbacked payouts.
- Reserved funds are excluded from available liquidity.
- Researchers can only withdraw their own pending payouts.

---

## Public Methods

### Write

```text
update_docs_url(docs_url)
fund_pool()
configure_bounties(critical, high, medium, low)
set_active(status)
submit_report(bug_description, evidence_url)
withdraw()
```

`fund_pool()` accepts native GEN to fund the bounty pool.

### Read

```text
get_config()
get_pending_payout(addr)
get_result(addr)
has_submitted(addr)
get_pool_status()
```

These methods expose contract configuration, adjudication results, researcher payout state, submission state, and bounty-pool accounting.

---

## Example Results

### Reserved Payout

```json
{
  "severity": "CRITICAL",
  "amount_wei": 5000000000000000000,
  "payout_status": "RESERVED"
}
```

### Underfunded Payout

```json
{
  "severity": "CRITICAL",
  "amount_wei": 5000000000000000000,
  "payout_status": "UNDERFUNDED"
}
```

### Invalid Report

```json
{
  "severity": "INVALID",
  "amount_wei": 0,
  "payout_status": "NO_PAYOUT"
}
```

---

## Verified Runtime Tests

The contract has been tested end-to-end in GenLayer Studio on Studionet.

### 1. Valid CRITICAL Report + Sufficient Funds

A valid vulnerability report was submitted with public evidence and adjudicated by GenLayer validators.

The result reached:

```text
severity      = CRITICAL
payout_status = RESERVED
```

The contract successfully created a pending researcher payout backed by bounty-pool funds.

---

### 2. Native Settlement Stress Test

To verify reserved-fund accounting and native settlement with a clearly visible balance change, the CRITICAL bounty was temporarily configured to:

```text
60 GEN
```

After a CRITICAL adjudication, the observed pool state was:

```text
balance   = 104 GEN
reserved  = 60 GEN
available = 44 GEN
```

This demonstrated that reserved bounty funds were correctly removed from available liquidity before settlement.

The researcher then called:

```text
withdraw()
```

The withdrawal transaction finalized successfully.

After withdrawal, the observed pool state was:

```text
balance   = 44 GEN
reserved  = 0 GEN
available = 44 GEN
```

This verifies the complete settlement path:

```text
AI adjudication
      ↓
CRITICAL
      ↓
Bounty calculation
      ↓
Reserve funds
      ↓
Researcher withdrawal
      ↓
Native payout
      ↓
Reserved accounting cleared
```

After completing the settlement test, the bounty configuration was restored to the normal default values:

```text
CRITICAL = 5 GEN
HIGH     = 2 GEN
MEDIUM   = 1 GEN
LOW      = 0.5 GEN
```

---

### 3. INVALID Report

An invalid report was submitted and adjudicated.

Observed result:

```text
severity      = INVALID
amount        = 0 GEN
payout_status = NO_PAYOUT
```

No bounty was reserved.

---

### 4. Valid CRITICAL Report + Insufficient Funds

The contract was also tested with insufficient bounty-pool liquidity.

With only:

```text
2 GEN
```

available and a:

```text
5 GEN
```

CRITICAL bounty requirement, the adjudication produced:

```text
severity      = CRITICAL
amount        = 5 GEN
payout_status = UNDERFUNDED
pending       = 0 GEN
```

Pool state remained:

```text
balance   = 2 GEN
reserved  = 0 GEN
available = 2 GEN
```

This confirms that the contract does not create unbacked researcher payouts.

---

### 5. Owner Submission Restriction

The contract owner attempted to submit a vulnerability report.

The transaction produced the expected restriction:

```text
Owner cannot submit reports
```

This confirms separation between bounty administration and researcher participation.

---

## Final Verified Configuration

After runtime testing, the contract was restored to its intended production configuration.

```text
CRITICAL = 5 GEN
HIGH     = 2 GEN
MEDIUM   = 1 GEN
LOW      = 0.5 GEN

PROGRAM ACTIVE
RESERVED PAYOUTS = 0
```

The bounty pool remains available for additional testing and submissions.

---

## Runtime Note

During AI adjudication, GenLayer Studio may display:

```text
Reading storage in nondet mode is not supported
```

In the verified Studio runs documented above, adjudication transactions still finalized and the resulting onchain state was successfully recorded.

This is documented here as a runtime observation from Studionet testing.

---

## Tech Stack

- GenLayer Intelligent Contracts
- GenLayer Studio / Studionet
- Python
- React
- TypeScript
- Vite
- `genlayer-js`
- `viem`
- `gl.eq_principle.prompt_non_comparative`
- `gl.nondet.web.render`
- native-token payout via `@gl.evm.contract_interface`

---

## Reusable Primitive

Whitehat Auto Bounty demonstrates a reusable GenLayer primitive:

```text
Unstructured public evidence
        +
Decentralized AI adjudication
        +
Deterministic severity-to-bounty mapping
        +
Reserved-fund accounting
        +
Native onchain settlement
```

The same architecture can be extended beyond traditional bug bounty programs to applications such as:

- decentralized software assurance,
- automated security triage,
- protocol vulnerability reward programs,
- agent-operated bounty systems,
- and other evidence-based reward mechanisms where qualitative judgment must trigger deterministic onchain settlement.

---

## Deployment

- **Network:** GenLayer Studionet
- **Intelligent Contract:** `<0x07F92a3705Ef184bd2eC7617E9cbcA78c69ccE83>`
- **Live App:** `<https://whitehat-auto-bounty.vercel.app/>`

---

## Status

**End-to-end tested on GenLayer Studionet.**

Verified flows include:

```text
Valid report → AI adjudication → RESERVED → native withdrawal
Invalid report → NO_PAYOUT
Valid report + insufficient funds → UNDERFUNDED
Owner submission → rejected
Reserved-fund accounting → verified
```
