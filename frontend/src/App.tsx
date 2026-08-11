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

const explorerAddress = CONTRACT_ADDRESS
  ? `${EXPLORER_BASE}/address/${CONTRACT_ADDRESS}`
  : '#'

const statusCopy = (result: BountyResult | null) => {
  if (!result) return 'No adjudication loaded'
  if (result.payout_status === 'RESERVED') return 'Bounty reserved'
  if (result.payout_status === 'UNDERFUNDED') return 'Valid report — pool underfunded'
  return 'No payout'
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
    void refresh('').catch((error) => {
      setNoticeKind('error')
      setNotice(error instanceof Error ? error.message : 'Unable to read contract state.')
    })
  }, [])

  const connect = () =>
    run('connect', async () => {
      const address = await connectWallet()
      setAccount(address)
      await refresh(address)
      setNoticeKind('success')
      setNotice('Wallet connected to GenLayer Studionet.')
    })

  const submit = (event: FormEvent) => {
    event.preventDefault()

    return run('submit', async () => {
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
      <header className="topbar">
        <a className="brand" href="#">
          <span className="brand-mark">W</span>
          <span>
            <strong>Whitehat Auto Bounty</strong>
            <small>on GenLayer</small>
          </span>
        </a>

        <div className="top-actions">
          <a
            className="contract-link"
            href={explorerAddress}
            target="_blank"
            rel="noreferrer"
          >
            Contract ↗
          </a>

          <button
            className="button wallet"
            onClick={connect}
            disabled={busy !== ''}
          >
            {account ? short(account, 6, 4) : busy === 'connect' ? 'Connecting…' : 'Connect wallet'}
          </button>
        </div>
      </header>

      <main className="shell">
        <section className="hero">
          <div className="eyebrow">DECENTRALIZED BUG BOUNTY ADJUDICATION</div>
          <h1>
            Report the bug.
            <br />
            <span>Let consensus price the impact.</span>
          </h1>
          <p>
            Public evidence is evaluated by GenLayer AI validators. Valid reports
            receive a deterministic bounty tier and backed payouts are reserved
            before researchers can withdraw.
          </p>

          <div className="flow">
            <span>Submit evidence</span>
            <b>→</b>
            <span>AI consensus</span>
            <b>→</b>
            <span>Severity</span>
            <b>→</b>
            <span>Reserve</span>
            <b>→</b>
            <span>Withdraw</span>
          </div>
        </section>

        {notice ? <div className={`notice ${noticeKind}`}>{notice}</div> : null}

        <section className="pool-grid">
          <div className="metric">
            <span>Pool balance</span>
            <strong>{formatWei(pool?.balance_wei)} GEN</strong>
            <small>Total native funds held by the contract</small>
          </div>
          <div className="metric">
            <span>Reserved</span>
            <strong>{formatWei(pool?.reserved_wei)} GEN</strong>
            <small>Already promised to approved reports</small>
          </div>
          <div className="metric accent">
            <span>Available</span>
            <strong>{formatWei(pool?.available_wei)} GEN</strong>
            <small>Can still back new bounty decisions</small>
          </div>
          <div className="metric">
            <span>Reports</span>
            <strong>{config?.reports_count ?? 0}</strong>
            <small>{config?.is_active ? 'Program active' : 'Program paused'}</small>
          </div>
        </section>

        <div className="workspace">
          <section className="panel">
            <div className="section-title">
              <span>01</span>
              <div>
                <h2>Researcher workspace</h2>
                <p>Submit one public report from the connected wallet.</p>
              </div>
            </div>

            <form className="form" onSubmit={submit}>
              <label>
                Bug report
                <textarea
                  rows={7}
                  value={bugDescription}
                  onChange={(event) => setBugDescription(event.target.value)}
                  placeholder="Describe the issue, affected behavior, exploitability, and impact..."
                  disabled={submitted || owner}
                />
              </label>

              <label>
                Public evidence URL
                <input
                  value={evidenceUrl}
                  onChange={(event) => setEvidenceUrl(event.target.value)}
                  placeholder="https://..."
                  disabled={submitted || owner}
                />
                <small>
                  Use a stable public HTTPS page that validators can render.
                </small>
              </label>

              <button
                className="button primary full"
                type="submit"
                disabled={
                  busy !== '' ||
                  !account ||
                  submitted ||
                  owner ||
                  !config?.is_active
                }
              >
                {owner
                  ? 'Owner cannot submit'
                  : submitted
                    ? 'Report already submitted'
                    : busy === 'submit'
                      ? 'AI validators adjudicating…'
                      : 'Submit report to GenLayer'}
              </button>
            </form>
          </section>

          <section className="panel result-panel">
            <div className="section-title">
              <span>02</span>
              <div>
                <h2>Adjudication result</h2>
                <p>Accepted state for the connected researcher.</p>
              </div>
            </div>

            {!account ? (
              <div className="empty">
                Connect a researcher wallet to load its report and payout state.
              </div>
            ) : !result ? (
              <div className="empty">
                No adjudication result exists for {short(account)}.
              </div>
            ) : (
              <div className="result-card">
                <div className="result-head">
                  <div>
                    <small>Severity</small>
                    <strong className={`severity ${result.severity.toLowerCase()}`}>
                      {result.severity}
                    </strong>
                  </div>
                  <span className={`payout-status ${result.payout_status.toLowerCase()}`}>
                    {statusCopy(result)}
                  </span>
                </div>

                <div className="bounty-amount">
                  <span>Adjudicated bounty</span>
                  <strong>{amountGen} GEN</strong>
                </div>

                <div className="reason">
                  <span>Consensus reason</span>
                  <p>{result.reason}</p>
                </div>

                <div className="pending">
                  <div>
                    <span>Withdrawable now</span>
                    <strong>{pendingGen} GEN</strong>
                  </div>

                  <button
                    className="button primary"
                    onClick={withdraw}
                    disabled={busy !== '' || BigInt(pendingWei || '0') <= BigInt(0)}
                  >
                    {busy === 'withdraw' ? 'Withdrawing…' : 'Withdraw bounty'}
                  </button>
                </div>

                {result.payout_status === 'UNDERFUNDED' ? (
                  <div className="underfunded">
                    The report is valid, but this pool does not currently have
                    enough unreserved funds to back the configured bounty.
                  </div>
                ) : null}
              </div>
            )}

            <button
              className="button ghost full refresh"
              onClick={() =>
                run('refresh', async () => {
                  await refresh(account)
                  setNoticeKind('info')
                  setNotice('Accepted onchain state refreshed.')
                })
              }
              disabled={busy !== ''}
            >
              {busy === 'refresh' ? 'Refreshing…' : 'Refresh accepted state'}
            </button>
          </section>
        </div>

        <section className="policy">
          <div>
            <div className="eyebrow">BOUNTY POLICY</div>
            <h2>Severity becomes deterministic settlement.</h2>
          </div>

          <div className="tiers">
            <div><span>Critical</span><strong>{formatWei(config?.bounty_critical_wei)} GEN</strong></div>
            <div><span>High</span><strong>{formatWei(config?.bounty_high_wei)} GEN</strong></div>
            <div><span>Medium</span><strong>{formatWei(config?.bounty_medium_wei)} GEN</strong></div>
            <div><span>Low</span><strong>{formatWei(config?.bounty_low_wei)} GEN</strong></div>
            <div><span>Invalid</span><strong>0 GEN</strong></div>
          </div>
        </section>

        {owner ? (
          <section className="owner-panel">
            <div className="section-title">
              <span>03</span>
              <div>
                <h2>Owner console</h2>
                <p>Pool operations and program policy.</p>
              </div>
            </div>

            <div className="owner-grid">
              <form className="owner-card" onSubmit={fund}>
                <h3>Fund bounty pool</h3>
                <label>
                  GEN amount
                  <input
                    value={fundAmount}
                    onChange={(event) => setFundAmount(event.target.value)}
                    inputMode="decimal"
                    placeholder="5"
                  />
                </label>
                <button className="button primary full" disabled={busy !== ''}>
                  {busy === 'fund' ? 'Funding…' : 'Fund pool'}
                </button>
              </form>

              <form className="owner-card" onSubmit={updateDocs}>
                <h3>Project documentation</h3>
                <label>
                  Public docs URL
                  <input
                    value={docsUrl}
                    onChange={(event) => setDocsUrl(event.target.value)}
                    placeholder="https://..."
                  />
                </label>
                <button className="button ghost full" disabled={busy !== ''}>
                  {busy === 'docs' ? 'Updating…' : 'Update docs URL'}
                </button>
              </form>

              <div className="owner-card">
                <h3>Program status</h3>
                <p>
                  {config?.is_active
                    ? 'New reports are currently accepted.'
                    : 'New reports are currently paused.'}
                </p>
                <button
                  className="button ghost full"
                  onClick={toggleProgram}
                  disabled={busy !== ''}
                >
                  {busy === 'toggle'
                    ? 'Updating…'
                    : config?.is_active
                      ? 'Pause program'
                      : 'Activate program'}
                </button>
              </div>
            </div>
          </section>
        ) : null}
      </main>

      <footer>
        <div>
          <strong>Whitehat Auto Bounty</strong>
          <span>AI adjudication + reserved native settlement on GenLayer</span>
        </div>
        <span>{CONTRACT_ADDRESS ? short(CONTRACT_ADDRESS, 10, 8) : 'Set VITE_CONTRACT_ADDRESS'}</span>
      </footer>
    </div>
  )
}

export default App
