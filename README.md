# 🛡️ Whitehat Auto-Bounty

**The world's first fully automated bug bounty platform powered by AI Smart Contracts on GenLayer.**

> No human reviewers. No payment delays. No disputes. AI validators reach consensus and lock your reward in a single transaction.

🔗 **Live Demo:** [whitehat-auto-bounty.vercel.app](https://whitehat-auto-bounty.vercel.app)  
📄 **Contract:** [0xbcf9EE06A7Cb5bb74Da57b71F7dBfe4081BA09e3](https://explorer-studio.genlayer.com/address/0xbcf9EE06A7Cb5bb74Da57b71F7dBfe4081BA09e3)

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
configure_bounties(critical=5000, high=2000, medium=500, low=100)
     ↓
fund_pool()  ← deposit GEN tokens as reward pool
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

| Severity | Default Reward | Example |
|---|---|---|
| **CRITICAL** | 5,000 GEN | Unauthorized fund withdrawal, total protocol compromise |
| **HIGH** | 2,000 GEN | Privilege escalation, significant fund loss |
| **MEDIUM** | 500 GEN | Partial information leak, griefing attack |
| **LOW** | 100 GEN | Minor issue with minimal impact |
| **INVALID** | 0 GEN | Not a bug, out of scope, insufficient evidence |

---

## Technical Architecture

### Smart Contract (`auto_bounty.py`)

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
self.pending_payouts[sender] = u256(amount_to_pay)

# withdraw: hacker claims it
payout.emit_transfer(value=amount)
```
Rewards are locked atomically with the AI verdict. The hacker withdraws on their own schedule — no race conditions, no failed transfers that lose the verdict.

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
Transfers GEN directly to the hacker's EOA — no wrapped tokens, no intermediate steps.

### Frontend

- **Vite + React + TypeScript** — fast, type-safe
- **genlayer-js** — reads contract state, sends transactions
- **MetaMask** — wallet connection (auto-adds GenLayer Studio network)
- **Deployed on Vercel**

---

## Running Locally

```bash
git clone https://github.com/your/whitehat-auto-bounty
cd whitehat-auto-bounty
npm install
npm run dev
```

Open `http://localhost:5173`

**Connect MetaMask** — the app will prompt you to add the GenLayer Studio network automatically.

---

## Contract Read Methods

| Method | Args | Returns |
|---|---|---|
| `get_config` | — | JSON: owner, docs_url, bounty amounts, is_active, reports_count |
| `get_result` | `addr: str` | JSON: severity, reason, amount |
| `get_pending_payout` | `addr: str` | Amount in GEN (string) |
| `has_submitted` | `addr: str` | bool |

## Contract Write Methods

| Method | Who | Description |
|---|---|---|
| `submit_report(bug_description, evidence_url)` | Anyone | Submit a bug report for AI assessment |
| `withdraw()` | Hacker | Claim locked reward |
| `fund_pool()` payable | Owner | Add GEN to reward pool |
| `update_docs_url(docs_url)` | Owner | Set project docs/repo link |
| `configure_bounties(critical, high, medium, low)` | Owner | Set reward amounts |
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

---

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
- AI reason: *"Bug matches reentrancy in EtherStore withdraw() exactly as shown in project docs."*
- Reward: **5000 GEN** locked and ready

### Step 4 — Withdraw Reward
Click **Withdraw 5000 GEN** → confirm MetaMask → done.

After withdrawal, the app shows: *"Reward already withdrawn."*

### Verify On-Chain
Every step is verifiable on the GenLayer Explorer:

🔗 [View Contract](https://explorer-studio.genlayer.com/address/0xbcf9EE06A7Cb5bb74Da57b71F7dBfe4081BA09e3)

> **Note:** Each wallet can only submit once. Use a fresh MetaMask account if testing multiple times.

---

Built for the **GenLayer Hackathon** · Powered by GenVM Semantic Consensus
