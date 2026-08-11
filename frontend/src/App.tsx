import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'
import { CONTRACT_ADDRESS, EXPLORER_BASE } from './lib/config'
import {
  bounty,
  connectWallet,
  formatWei,
  parseGenToWei,
} from './lib/genlayer'
import type {
  BountyConfig,
  BountyResult,
  PoolStatus,
} from './lib/genlayer'

type Busy =
  | ''
  | 'connect'
  | 'refresh'
  | 'submit'
  | 'withdraw'
  | 'fund'
  | 'docs'
  | 'toggle'

const short = (value: string, head = 7, tail = 5) =>
  value && value.length > head + tail + 3
    ? `${value.slice(0, head)}…${value.slice(-tail)}`
    : value

const contractConfigured =
  Boolean(CONTRACT_ADDRESS) && /^0x[a-fA-F0-9]{40}$/.test(CONTRACT_ADDRESS)

const explorerAddress = contractConfigured
  ? `${EXPLORER_BASE}/address/${CONTRACT_ADDRESS}`
  : '#'

const statusCopy = (result: BountyResult | null) => {
  if (!result) return 'NO VERDICT'
  if (result.payout_status === 'RESERVED') return 'RESERVED'
  if (result.payout_status === 'UNDERFUNDED') return 'UNDERFUNDED'
  return 'NO PAYOUT'
}

function App() {
  const [account, setAccount] = useState('')
  const [config, setConfig] = useState<BountyConfig | null>(null)
  const [pool, setPool] = useState<PoolStatus | null>(null)
  const [result, setResult] = useState<BountyResult | null>(null)
  const [pendingWei, setPendingWei] = useState('0')
  const [submitted, setSubmitted] = useState(false)
  const [busy, setBusy] = useState<Busy>('')
  const [notice, setNotice] = useState('')
  const [noticeKind, setNoticeKind] = useState<'info' | 'success' | 'error'>('info')

  const [bugDescription, setBugDescription] = useState('')
  const [evidenceUrl, setEvidenceUrl] = useState('')
  const [fundAmount, setFundAmount] = useState('5')
  const [docsUrl, setDocsUrl] = useState('')

  const owner = useMemo(
    () =>
      Boolean(
        account &&
          config?.owner &&
          account.toLowerCase() === config.owner.toLowerCase(),
      ),
    [account, config],
  )

  const run = async (action: Busy, task: () => Promise<void>) => {
    try {
      setBusy(action)
      setNotice('')
      await task()
    } catch (error) {
      setNoticeKind('error')
      setNotice(error instanceof Error ? error.message : 'Unexpected error.')
    } finally {
      setBusy('')
    }
  }

  const refresh = useCallback(async (address = account) => {
    if (!contractConfigured) {
      setConfig(null)
      setPool(null)
      setResult(null)
      setPendingWei('0')
      setSubmitted(false)
      return
    }

    const [nextConfig, nextPool] = await Promise.all([
      bounty.getConfig(),
      bounty.getPoolStatus(),
    ])

    setConfig(nextConfig)
    setPool(nextPool)
    setDocsUrl(nextConfig.docs_url || '')

    if (address) {
      const [nextResult, nextPending, nextSubmitted] = await Promise.all([
        bounty.getResult(address),
        bounty.getPendingPayout(address),
        bounty.hasSubmitted(address),
      ])

      setResult(nextResult)
      setPendingWei(nextPending || '0')
      setSubmitted(nextSubmitted)
    }
  }, [account])

  useEffect(() => {
    if (!contractConfigured) return

    void refresh('').catch((error) => {
      setNoticeKind('error')
      setNotice(error instanceof Error ? error.message : 'Unable to read contract state.')
    })
  }, [])

  const connect = () =>
    run('connect', async () => {
      if (!contractConfigured) {
        throw new Error('Contract address is not configured for this deployment.')
      }

      const address = await connectWallet()
      setAccount(address)
      await refresh(address)
      setNoticeKind('success')
      setNotice('Wallet connected to GenLayer Studionet.')
    })

  const submit = (event: FormEvent) => {
    event.preventDefault()

    return run('submit', async () => {
      if (!contractConfigured) throw new Error('Contract address is not configured.')
      if (!account) throw new Error('Connect wallet first.')
      if (!bugDescription.trim()) throw new Error('Describe the report first.')
      if (!evidenceUrl.startsWith('https://')) {
        throw new Error('Evidence URL must be a public HTTPS page.')
      }

      const { hash } = await bounty.submitReport(
        account,
        bugDescription,
        evidenceUrl,
      )

      await refresh(account)
      setNoticeKind('success')
      setNotice(`Report adjudicated onchain. Transaction ${short(hash)} accepted.`)
    })
  }

  const withdraw = () =>
    run('withdraw', async () => {
      if (!contractConfigured) throw new Error('Contract address is not configured.')
      if (!account) throw new Error('Connect wallet first.')
      if (BigInt(pendingWei || '0') <= BigInt(0)) {
        throw new Error('No reserved payout is available for this wallet.')
      }

      const { hash } = await bounty.withdraw(account)
      await refresh(account)
      setNoticeKind('success')
      setNotice(`Native bounty withdrawn. Transaction ${short(hash)} accepted.`)
    })

  const fund = (event: FormEvent) => {
    event.preventDefault()

    return run('fund', async () => {
      if (!account) throw new Error('Connect the owner wallet first.')
      if (!owner) throw new Error('Only the contract owner should fund from this panel.')

      const amountWei = parseGenToWei(fundAmount)
      if (amountWei <= BigInt(0)) throw new Error('Fund amount must be greater than zero.')

      const { hash } = await bounty.fundPool(account, amountWei)
      await refresh(account)
      setNoticeKind('success')
      setNotice(`Pool funded. Transaction ${short(hash)} accepted.`)
    })
  }

  const updateDocs = (event: FormEvent) => {
    event.preventDefault()

    return run('docs', async () => {
      if (!account || !owner) throw new Error('Owner wallet required.')
      if (!docsUrl.startsWith('https://')) throw new Error('Docs URL must use HTTPS.')

      await bounty.updateDocsUrl(account, docsUrl)
      await refresh(account)
      setNoticeKind('success')
      setNotice('Project documentation URL updated.')
    })
  }

  const toggleProgram = () =>
    run('toggle', async () => {
      if (!account || !owner || !config) throw new Error('Owner wallet required.')

      await bounty.setActive(account, !config.is_active)
      await refresh(account)
      setNoticeKind('success')
      setNotice(`Bounty program ${config.is_active ? 'paused' : 'activated'}.`)
    })

  const pendingGen = formatWei(pendingWei)
  const amountGen = result ? formatWei(result.amount_wei) : '0'

  return (
    <div className="app">
      <header className="command-bar">
        <div className="brand">
          <div className="brand-symbol">WAB</div>
          <div>
            <strong>WHITEHAT AUTO BOUNTY</strong>
            <span>GENLAYER / SECURITY ADJUDICATION</span>
          </div>
        </div>

        <div className="command-actions">
          <div className={`live-state ${config?.is_active ? 'online' : 'offline'}`}>
            <i />
            {!contractConfigured
              ? 'SETUP REQUIRED'
              : config?.is_active
                ? 'PROGRAM LIVE'
                : 'PROGRAM PAUSED'}
          </div>

          <a
            href={explorerAddress}
            target={contractConfigured ? '_blank' : undefined}
            rel="noreferrer"
            className={`text-link ${!contractConfigured ? 'disabled-link' : ''}`}
          >
            CONTRACT ↗
          </a>

          <button
            className="connect-btn"
            onClick={connect}
            disabled={busy !== '' || !contractConfigured}
          >
            {account
              ? short(account, 6, 4)
              : busy === 'connect'
                ? 'CONNECTING…'
                : 'CONNECT WALLET'}
          </button>
        </div>
      </header>

      <main className="terminal-shell">
        <section className="system-strip">
          <div>
            <span>NETWORK</span>
            <strong>GENLAYER STUDIONET</strong>
          </div>
          <div>
            <span>POOL</span>
            <strong>{formatWei(pool?.balance_wei)} GEN</strong>
          </div>
          <div>
            <span>AVAILABLE</span>
            <strong>{formatWei(pool?.available_wei)} GEN</strong>
          </div>
          <div>
            <span>RESERVED</span>
            <strong>{formatWei(pool?.reserved_wei)} GEN</strong>
          </div>
          <div>
            <span>REPORTS</span>
            <strong>{config?.reports_count ?? 0}</strong>
          </div>
        </section>

        {!contractConfigured ? (
          <div className="setup-banner">
            <div>
              <strong>CONTRACT SETUP REQUIRED</strong>
              <span>
                Add <code>VITE_CONTRACT_ADDRESS</code> to Vercel Environment Variables,
                then redeploy.
              </span>
            </div>
            <span className="setup-badge">NOT CONNECTED</span>
          </div>
        ) : null}

        {notice ? (
          <div className={`notice ${noticeKind}`}>
            [{noticeKind.toUpperCase()}] {notice}
          </div>
        ) : null}

        <section className="intro">
          <div className="intro-index">01 / INTAKE</div>
          <h1>
            Submit evidence.
            <br />
            <em>Consensus decides severity.</em>
          </h1>
          <p>
            A public bug report enters decentralized review. GenLayer validators
            evaluate evidence against project documentation, classify impact, and
            reserve a backed bounty when funds are available.
          </p>
        </section>

        <div className="primary-grid">
          <section className="module report-module">
            <div className="module-head">
              <div>
                <span className="module-code">REPORT://NEW</span>
                <h2>Vulnerability intake</h2>
              </div>
              <span className="module-state">{submitted ? 'LOCKED' : 'READY'}</span>
            </div>

            <form onSubmit={submit} className="report-form">
              <label>
                <span>01 — BUG DESCRIPTION</span>
                <textarea
                  rows={10}
                  value={bugDescription}
                  onChange={(event) => setBugDescription(event.target.value)}
                  placeholder="Describe affected behavior, exploitability, impact, and reproduction context..."
                  disabled={submitted || owner || !contractConfigured}
                />
              </label>

              <label>
                <span>02 — PUBLIC EVIDENCE URL</span>
                <input
                  value={evidenceUrl}
                  onChange={(event) => setEvidenceUrl(event.target.value)}
                  placeholder="https://..."
                  disabled={submitted || owner || !contractConfigured}
                />
              </label>

              <div className="intake-meta">
                <span>HTTPS PUBLIC EVIDENCE REQUIRED</span>
                <span>ONE REPORT / WALLET</span>
              </div>

              <button
                className="action-btn"
                type="submit"
                disabled={
                  busy !== '' ||
                  !contractConfigured ||
                  !account ||
                  submitted ||
                  owner ||
                  !config?.is_active
                }
              >
                <span>
                  {busy === 'submit'
                    ? 'VALIDATORS RUNNING'
                    : 'SUBMIT FOR AI REVIEW'}
                </span>
                <b>→</b>
              </button>

              {owner ? (
                <div className="inline-warning">
                  OWNER WALLET CANNOT SUBMIT REPORTS
                </div>
              ) : null}
              {submitted ? (
                <div className="inline-warning">
                  THIS WALLET HAS ALREADY SUBMITTED
                </div>
              ) : null}
            </form>
          </section>

          <aside className="module bounty-module">
            <div className="module-head">
              <div>
                <span className="module-code">POLICY://BOUNTY</span>
                <h2>Reward matrix</h2>
              </div>
            </div>

            <div className="severity-table">
              <div className="severity-row critical">
                <span><i /> CRITICAL</span>
                <strong>{formatWei(config?.bounty_critical_wei)} GEN</strong>
              </div>
              <div className="severity-row high">
                <span><i /> HIGH</span>
                <strong>{formatWei(config?.bounty_high_wei)} GEN</strong>
              </div>
              <div className="severity-row medium">
                <span><i /> MEDIUM</span>
                <strong>{formatWei(config?.bounty_medium_wei)} GEN</strong>
              </div>
              <div className="severity-row low">
                <span><i /> LOW</span>
                <strong>{formatWei(config?.bounty_low_wei)} GEN</strong>
              </div>
              <div className="severity-row invalid">
                <span><i /> INVALID</span>
                <strong>0 GEN</strong>
              </div>
            </div>

            <div className="fund-meter">
              <div className="meter-label">
                <span>POOL ACCOUNTING</span>
                <span>{formatWei(pool?.available_wei)} AVAILABLE</span>
              </div>
              <div className="meter">
                <div
                  style={{
                    width: `${Math.min(
                      100,
                      Number(pool?.balance_wei || 0) > 0
                        ? (Number(pool?.available_wei || 0) /
                            Number(pool?.balance_wei || 1)) *
                          100
                        : 0,
                    )}%`,
                  }}
                />
              </div>
              <p>
                Reserved rewards are removed from available liquidity before new
                bounty decisions.
              </p>
            </div>
          </aside>
        </div>

        <section className="module verdict-module">
          <div className="module-head">
            <div>
              <span className="module-code">CONSENSUS://RESULT</span>
              <h2>AI adjudication & settlement</h2>
            </div>
            <button
              className="refresh-btn"
              onClick={() =>
                run('refresh', async () => {
                  await refresh(account)
                  setNoticeKind('info')
                  setNotice('Accepted onchain state refreshed.')
                })
              }
              disabled={busy !== '' || !contractConfigured}
            >
              {busy === 'refresh' ? 'REFRESHING…' : 'REFRESH STATE ↻'}
            </button>
          </div>

          {!contractConfigured ? (
            <div className="empty-state">
              <span>CONTRACT NOT CONNECTED</span>
              <p>Configure the deployment address to load live onchain state.</p>
            </div>
          ) : !account ? (
            <div className="empty-state">
              <span>NO WALLET SESSION</span>
              <p>
                Connect a researcher wallet to inspect its adjudication and
                settlement state.
              </p>
            </div>
          ) : !result ? (
            <div className="empty-state">
              <span>NO VERDICT FOUND</span>
              <p>No adjudication result exists for {short(account)}.</p>
            </div>
          ) : (
            <div className="verdict-grid">
              <div className="verdict-primary">
                <span className="data-label">SEVERITY</span>
                <div className={`verdict-severity ${result.severity.toLowerCase()}`}>
                  {result.severity}
                </div>
                <div className="verdict-status">{statusCopy(result)}</div>
              </div>

              <div className="verdict-data">
                <div>
                  <span className="data-label">ADJUDICATED BOUNTY</span>
                  <strong>{amountGen} GEN</strong>
                </div>
                <div>
                  <span className="data-label">WITHDRAWABLE</span>
                  <strong>{pendingGen} GEN</strong>
                </div>
                <div className="reason-block">
                  <span className="data-label">CONSENSUS REASON</span>
                  <p>{result.reason}</p>
                </div>
              </div>

              <div className="settlement">
                <span className="data-label">SETTLEMENT</span>
                <button
                  className="claim-btn"
                  onClick={withdraw}
                  disabled={busy !== '' || BigInt(pendingWei || '0') <= BigInt(0)}
                >
                  {busy === 'withdraw'
                    ? 'PROCESSING…'
                    : `WITHDRAW ${pendingGen} GEN`}
                </button>

                {result.payout_status === 'UNDERFUNDED' ? (
                  <p className="underfunded">
                    VALID REPORT / INSUFFICIENT AVAILABLE POOL
                  </p>
                ) : null}
              </div>
            </div>
          )}
        </section>

        {owner ? (
          <section className="owner-console">
            <div className="owner-title">
              <div>
                <span className="module-code">ADMIN://OWNER</span>
                <h2>Program controls</h2>
              </div>
              <span>{short(account)}</span>
            </div>

            <div className="owner-grid">
              <form onSubmit={fund}>
                <label>
                  <span>FUND POOL / GEN</span>
                  <input
                    value={fundAmount}
                    onChange={(e) => setFundAmount(e.target.value)}
                  />
                </label>
                <button disabled={busy !== ''}>FUND POOL</button>
              </form>

              <form onSubmit={updateDocs}>
                <label>
                  <span>PROJECT DOCS URL</span>
                  <input
                    value={docsUrl}
                    onChange={(e) => setDocsUrl(e.target.value)}
                  />
                </label>
                <button disabled={busy !== ''}>UPDATE DOCS</button>
              </form>

              <div className="owner-control">
                <span>PROGRAM STATE</span>
                <strong>{config?.is_active ? 'ACTIVE' : 'PAUSED'}</strong>
                <button onClick={toggleProgram} disabled={busy !== ''}>
                  {config?.is_active ? 'PAUSE PROGRAM' : 'ACTIVATE PROGRAM'}
                </button>
              </div>
            </div>
          </section>
        ) : null}
      </main>

      <footer>
        <span>WHITEHAT AUTO BOUNTY / GENLAYER STUDIONET</span>
        <span>
          {contractConfigured
            ? short(CONTRACT_ADDRESS, 10, 8)
            : 'CONTRACT SETUP REQUIRED'}
        </span>
      </footer>
    </div>
  )
}

export default App
