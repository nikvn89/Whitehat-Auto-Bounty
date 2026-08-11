# 🛡️ Whitehat Auto-Bounty

**The world's first fully automated bug bounty platform powered by AI Smart Contracts on GenLayer.**

> No human reviewers. No payment delays. No disputes. AI validators reach consensus and lock your reward in a single transaction.

🔗 **Live Demo:** [whitehat-auto-bounty.vercel.app](https://whitehat-auto-bounty.vercel.app)  
📄 **Contract:** [0xe3b1BdC4796441341A4c6c0eDCA85E024365156a](https://explorer-studio.genlayer.com/address/0xe3b1BdC4796441341A4c6c0eDCA85E024365156a)

---

## The Problem

Traditional bug bounty platforms (Immunefi, HackerOne) have three systemic failures:

| Problem | Impact |
|---|---|
| **Manual review** | Weeks to months before a hacker knows if their report is valid |
| **Severity disputes** | Projects routinely downgrade severity to pay less |
| **Manual payment** | Approved reports still require someone to manually send funds |

These friction points discourage whitehats from reporting — especially for smaller projects that can't afford a dedicated security team.

---

## The Solution

Whitehat Auto-Bounty puts the entire process on **GenLayer** — a blockchain where smart contracts can access the internet and reason like security experts.

Instead of a human reviewer:

1. A council of **AI Validators** independently reads the project's codebase/docs
2. Cross-references with the hacker's evidence
3. Reaches **cryptographic consensus** on severity
4. **Locks the reward immediately** — in the same transaction

No waiting. No disputes. No trust required.

---

## How It Works

### For Project Owners

```
Deploy contract
     ↓
update_docs_url("https://github.com/your/project")
     ↓
configure_bounties(
    critical_wei = 5_000_000_000_000_000,
    high_wei     = 2_000_000_000_000_000,
    medium_wei   =   500_000_000_000_000,
    low_wei      =   100_000_000_000_000,
)
     ↓
fund_pool()  ← deposit native token (wei) as reward pool
```

### For Whitehats

```
submit_report(bug_description, evidence_url)
     ↓
GenLayer AI Validators:
  - fetch project docs
  - fetch evidence URL
  - independently assess severity
  - reach consensus
     ↓
Result locked on-chain: CRITICAL / HIGH / MEDIUM / LOW / INVALID
     ↓
withdraw()  ← pull your reward anytime
```

---

## Severity Levels

All bounty amounts are denominated in **wei** (10⁻¹⁸ native token). 1 GEN = 10¹⁸ wei.

| Severity | Default Reward (wei)  | Default Reward (GEN) | Example |
|---|---|---|---|
| **CRITICAL** | 5,000,000,000,000,000 | 0.005 | Unauthorized fund withdrawal, total protocol compromise |
| **HIGH**     | 2,000,000,000,000,000 | 0.002 | Privilege escalation, significant fund loss |
| **MEDIUM**   |   500,000,000,000,000 | 0.0005 | Partial information leak, griefing attack |
| **LOW**      |   100,000,000,000,000 | 0.0001 | Minor issue with minimal impact |
| **INVALID**  | 0 | 0 | Not a bug, out of scope, insufficient evidence |

Amounts are configured in wei, displayed in the frontend as GEN (`amount_wei / 1e18`).

---

## Technical Architecture

### Smart Contract (`auto_bounty_v2.py`)

Built on **GenVM v0.2.16** with the following design decisions:

**Nondeterministic Web Fetching**
```python
docs_content = gl.nondet.web.render(self.project_docs_url, mode="text")
evidence_content = gl.nondet.web.render(evidence_url, mode="text")
```
Each validator independently fetches live data — no oracle, no trusted middleman.

**AI Consensus via `prompt_non_comparative`**
```python
raw_result = gl.eq_principle.prompt_non_comparative(
    build_prompt_input,
    task=task_prompt,
    criteria=validation_criteria
)
```
Validators must agree the output is a valid JSON with one of the five severity values. Disagreements trigger re-evaluation.

**Pull Payment Pattern**
```python
# submit_report: lock the reward
self.pending_payouts[sender] = u256(amount_wei)

# withdraw: hacker claims it
payout.emit_transfer(value=amount_wei)
```
Rewards are locked atomically with the AI verdict. The hacker withdraws on their own schedule — no race conditions, no failed transfers that lose the verdict.

**Pool Balance Check Before Payout**
```python
pool_balance = u256(gl.message.contract_value)
if pool_balance < amount_wei:
    raise gl.vm.UserError(
        "Pool underfunded: cannot pay "
        + str(int(amount_wei))
        + " wei, pool has "
        + str(int(pool_balance))
        + " wei"
    )
```
The contract verifies available pool funds before creating each payout. If underfunded, `withdraw()` reverts with exact amounts — the pending payout is preserved until the owner tops up the pool.

**One Submission Per Wallet**
```python
if sender in self.submissions:
    raise gl.vm.UserError("Already submitted")
```
Prevents pool drain attacks from repeated submissions.

**EVM Native Payout**
```python
@gl.evm.contract_interface
class NativePayout:
    class Write:
        def emit_transfer(self, value: u256, /) -> None: ...
```
Transfers native token directly to the hacker's EOA — no wrapped tokens, no intermediate steps.

### Frontend

- **Vite + React + TypeScript** — fast, type-safe
- **genlayer-js** — reads contract state, sends transactions
- **MetaMask** — wallet connection (auto-adds GenLayer Studio network)
- **Deployed on Vercel**

---

## Running Locally

```bash
git clone https://github.com/nikvn89/Whitehat-Auto-Bounty
cd Whitehat-Auto-Bounty/frontend
npm install
npm run dev
```

Open `http://localhost:5173`

**Connect MetaMask** — the app will prompt you to add the GenLayer Studio network automatically.

---

## Contract Read Methods

| Method | Args | Returns |
|---|---|---|
| `get_config` | — | JSON: owner, docs_url, bounty amounts in wei, is_active, reports_count |
| `get_result` | `addr: str` | JSON: severity, reason, amount_wei |
| `get_pending_payout` | `addr: str` | Pending amount in wei (string) |
| `has_submitted` | `addr: str` | bool |

## Contract Write Methods

| Method | Who | Description |
|---|---|---|
| `submit_report(bug_description, evidence_url)` | Anyone | Submit a bug report for AI assessment |
| `withdraw()` | Hacker | Claim locked reward (reverts if pool underfunded) |
| `fund_pool()` payable | Owner | Add native token to reward pool |
| `update_docs_url(docs_url)` | Owner | Set project docs/repo link |
| `configure_bounties(critical_wei, high_wei, medium_wei, low_wei)` | Owner | Set reward amounts in wei |
| `set_active(status)` | Owner | Pause/resume the program |

---

## Why GenLayer?

This dApp is only possible on GenLayer because it requires **AI reasoning inside consensus** — not just on-chain data. Every validator independently:

- Fetches live web content (the project's real codebase, the hacker's real evidence)
- Applies security expertise to assess severity
- Reaches agreement through cryptographic consensus

On any other blockchain, you would need a centralized oracle or a trusted committee. On GenLayer, the AI *is* the consensus mechanism.

---

## Security Notes

- **Prompt injection defense:** All content from bug descriptions and evidence URLs is treated as untrusted input. Validators are explicitly instructed not to follow embedded instructions.
- **Owner cannot submit:** The contract owner is blocked from submitting reports, preventing self-dealing.
- **One report per wallet:** Prevents pool drain via repeated submissions.
- **Checks-effects-interactions:** Submission is marked before LLM call; balance zeroed before transfer.
- **Pool balance verified before payout:** `withdraw()` checks contract balance covers the pending amount before calling `emit_transfer`. Reverts with exact wei amounts if underfunded.

---

## Testing

See [TESTING.md](./TESTING.md) for step-by-step test cases covering:

- Funded pool: configure → fund → submit → withdraw exact configured amount
- Multiple competing claims from different wallets
- Underfunded pool: withdraw reverts, pending payout preserved, succeeds after top-up
- Duplicate submission guard
- INVALID report produces no payout
- Unit consistency: `configure_bounties` inputs match `get_config` outputs

---

## 🧑‍⚖️ Judge's Testing Guide

> Everything is pre-configured. You only need MetaMask and ~3 minutes.

### Prerequisites
- MetaMask installed in browser ([download](https://metamask.io))
- Any wallet — no real funds needed (GenLayer testnet)

### Step 1 — Connect Wallet
1. Open the dApp and click **Connect Wallet**
2. MetaMask will prompt to add **Genlayer Studio Network** automatically → click **Approve**

### Step 2 — Submit Bug Report
1. Click **Submit Report**
2. Copy-paste **exactly**:

**Bug Description:**
```
Found a critical Reentrancy vulnerability in the EtherStore contract. The withdraw function calls msg.sender.call{value:_amount}("") before updating balances[msg.sender] -= _amount. An attacker can deploy a malicious contract with a fallback function that re-calls withdraw(), draining the entire pool before the balance is zeroed.
```

**Evidence URL:**
```
https://pastebin.com/J2uK1bCC
```

3. Click **Submit** → confirm in MetaMask
4. Wait ~2 minutes — AI validators are working

### Step 3 — View AI Verdict
The app displays the consensus result automatically:
- **CRITICAL** — confirmed reentrancy vulnerability
- Reward locked in wei, displayed as GEN in the frontend

### Step 4 — Withdraw Reward
Click **Withdraw** → confirm MetaMask → done.

After withdrawal, `get_pending_payout` returns `"0"`.

### Verify On-Chain
Every step is verifiable on the GenLayer Explorer:

🔗 [View Contract](https://explorer-studio.genlayer.com/address/0xe3b1BdC4796441341A4c6c0eDCA85E024365156a)

> **Note:** Each wallet can only submit once. Use a fresh MetaMask account if testing multiple times.

---

Built for the **GenLayer Hackathon** · Powered by GenVM Semantic Consensus
