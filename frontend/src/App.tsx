import React, { useState, useEffect, useCallback } from 'react';
import { getAddress } from 'viem';
import { getClient, CONTRACT_ADDRESS } from './lib/genlayer';
import {
  Bug,
  Shield,
  Wallet,
  XCircle,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  Download,
  ExternalLink,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface BountyConfig {
  owner: string;
  docs_url: string;
  bounty_critical: number;
  bounty_high: number;
  bounty_medium: number;
  bounty_low: number;
  is_active: boolean;
  reports_count: number;
}

interface ReportResult {
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INVALID';
  reason: string;
  amount: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const SEVERITY_COLOR: Record<string, string> = {
  CRITICAL: '#ef4444',
  HIGH:     '#f97316',
  MEDIUM:   '#eab308',
  LOW:      '#22c55e',
  INVALID:  '#6b7280',
};

const short = (addr: string) =>
  addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : '';

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  // wallet
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');

  // data
  const [config, setConfig] = useState<BountyConfig | null>(null);
  const [myResult, setMyResult] = useState<ReportResult | null>(null);
  const [myPending, setMyPending] = useState<string>('0');
  const [hasSubmitted, setHasSubmitted] = useState(false);

  // ui
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('');
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showOwnerPanel, setShowOwnerPanel] = useState(false);

  // form — submit report
  const [bugDesc, setBugDesc] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState('');

  // form — owner
  const [newDocsUrl, setNewDocsUrl] = useState('');
  const [cfgCritical, setCfgCritical] = useState('5000');
  const [cfgHigh, setCfgHigh] = useState('2000');
  const [cfgMedium, setCfgMedium] = useState('500');
  const [cfgLow, setCfgLow] = useState('100');
  const [fundAmount, setFundAmount] = useState('10');

  // ── Data fetching ──────────────────────────────────────────────────────────

  const fetchConfig = useCallback(async () => {
    try {
      // @ts-ignore
      const res = await getClient().readContract({
        address: CONTRACT_ADDRESS,
        functionName: 'get_config',
        args: [],
      });
      if (res) setConfig(JSON.parse(res as string));
    } catch (e) {
      console.error('fetchConfig failed', e);
    }
  }, []);

  const fetchMyData = useCallback(async (addr: string) => {
    if (!addr) return;
    try {
      // @ts-ignore
      const [resultRaw, pendingRaw, submittedRaw] = await Promise.all([
        getClient().readContract({
          address: CONTRACT_ADDRESS,
          functionName: 'get_result',
          args: [addr],
        }),
        // @ts-ignore
        getClient().readContract({
          address: CONTRACT_ADDRESS,
          functionName: 'get_pending_payout',
          args: [addr],
        }),
        // @ts-ignore
        getClient().readContract({
          address: CONTRACT_ADDRESS,
          functionName: 'has_submitted',
          args: [addr],
        }),
      ]);
      if (resultRaw && resultRaw !== '') setMyResult(JSON.parse(resultRaw as string));
      setMyPending(String(pendingRaw || '0'));
      setHasSubmitted(Boolean(submittedRaw));
    } catch (e) {
      console.error('fetchMyData failed', e);
    }
  }, []);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);
  useEffect(() => {
    if (walletAddress) fetchMyData(walletAddress);
  }, [walletAddress, fetchMyData]);

  // ── Wallet ─────────────────────────────────────────────────────────────────

  const handleConnectWallet = async () => {
    try {
      if (!(window as any).ethereum) {
        alert('No Web3 wallet detected. Please install MetaMask.');
        return;
      }
      const accounts = await (window as any).ethereum.request({ method: 'eth_requestAccounts' });
      try {
        await (window as any).ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0xf22f' }],
        });
      } catch (switchError: any) {
        if (switchError.code === 4902) {
          await (window as any).ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: '0xf22f',
              chainName: 'Genlayer Studio Network',
              rpcUrls: ['https://studio.genlayer.com/api'],
              nativeCurrency: { name: 'GEN Token', symbol: 'GEN', decimals: 18 },
              blockExplorerUrls: ['https://explorer-studio.genlayer.com'],
            }],
          });
        }
      }
      if (accounts.length > 0) {
        setWalletAddress(getAddress(accounts[0]));
        setWalletConnected(true);
      }
    } catch (e: any) {
      alert('Failed to connect wallet: ' + e.message);
    }
  };

  const handleDisconnect = () => {
    setWalletAddress('');
    setWalletConnected(false);
    setMyResult(null);
    setMyPending('0');
    setHasSubmitted(false);
  };

  // ── Poll helper ────────────────────────────────────────────────────────────

  const waitFor = (
    condition: () => Promise<boolean>,
    msg: string,
    onDone: () => void,
  ) => {
    setLoadingText(msg);
    let attempts = 0;
    const poll = async () => {
      attempts++;
      try { if (await condition()) { onDone(); setLoading(false); return; } }
      catch (_) {}
      if (attempts >= 90) { onDone(); setLoading(false); return; }
      setTimeout(poll, 4000);
    };
    setTimeout(poll, 4000);
  };

  // ── Hacker: submit report ──────────────────────────────────────────────────

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!walletConnected) { alert('Connect your wallet first.'); return; }
    try {
      setShowSubmitModal(false);
      setLoading(true);
      setLoadingText('Confirm transaction in your wallet...');

      // @ts-ignore
      await getClient(walletAddress).writeContract({
        address: CONTRACT_ADDRESS,
        functionName: 'submit_report',
        args: [bugDesc, evidenceUrl],
      });

      waitFor(
        async () => {
          // @ts-ignore
          const r = await getClient().readContract({
            address: CONTRACT_ADDRESS,
            functionName: 'get_result',
            args: [walletAddress],
          });
          return Boolean(r) && r !== '';
        },
        'AI validators are reviewing your report... This may take a minute.',
        () => { fetchMyData(walletAddress); fetchConfig(); },
      );
    } catch (e: any) {
      alert('Error: ' + e.message);
      setLoading(false);
    }
  };

  // ── Hacker: withdraw ───────────────────────────────────────────────────────

  const handleWithdraw = async () => {
    if (!walletConnected) { alert('Connect your wallet first.'); return; }
    try {
      setLoading(true);
      setLoadingText('Withdrawing your reward...');

      // @ts-ignore
      await getClient(walletAddress).writeContract({
        address: CONTRACT_ADDRESS,
        functionName: 'withdraw',
        args: [],
      });

      waitFor(
        async () => {
          // @ts-ignore
          const r = await getClient().readContract({
            address: CONTRACT_ADDRESS,
            functionName: 'get_pending_payout',
            args: [walletAddress],
          });
          return String(r) === '0';
        },
        'Waiting for withdrawal confirmation...',
        () => { fetchMyData(walletAddress); },
      );
    } catch (e: any) {
      alert('Error: ' + e.message);
      setLoading(false);
    }
  };

  // ── Owner: update docs URL ─────────────────────────────────────────────────

  const handleUpdateDocs = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!walletConnected) { alert('Connect owner wallet first.'); return; }
    try {
      setLoading(true);
      setLoadingText('Updating docs URL...');
      // @ts-ignore
      await getClient(walletAddress).writeContract({
        address: CONTRACT_ADDRESS,
        functionName: 'update_docs_url',
        args: [newDocsUrl],
      });
      waitFor(
        async () => {
          // @ts-ignore
          const r = await getClient().readContract({ address: CONTRACT_ADDRESS, functionName: 'get_config', args: [] });
          if (!r) return false;
          return JSON.parse(r as string).docs_url === newDocsUrl;
        },
        'Waiting for confirmation...',
        () => { fetchConfig(); setNewDocsUrl(''); },
      );
    } catch (e: any) {
      alert('Error: ' + e.message);
      setLoading(false);
    }
  };

  // ── Owner: configure bounties ──────────────────────────────────────────────

  const handleConfigureBounties = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!walletConnected) { alert('Connect owner wallet first.'); return; }
    try {
      setLoading(true);
      setLoadingText('Updating bounty amounts...');
      // @ts-ignore
      await getClient(walletAddress).writeContract({
        address: CONTRACT_ADDRESS,
        functionName: 'configure_bounties',
        args: [parseInt(cfgCritical), parseInt(cfgHigh), parseInt(cfgMedium), parseInt(cfgLow)],
      });
      waitFor(
        async () => {
          // @ts-ignore
          const r = await getClient().readContract({ address: CONTRACT_ADDRESS, functionName: 'get_config', args: [] });
          if (!r) return false;
          const c = JSON.parse(r as string);
          return c.bounty_critical === parseInt(cfgCritical);
        },
        'Waiting for confirmation...',
        () => { fetchConfig(); },
      );
    } catch (e: any) {
      alert('Error: ' + e.message);
      setLoading(false);
    }
  };

  // ── Owner: fund pool ───────────────────────────────────────────────────────

  const handleFundPool = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!walletConnected) { alert('Connect owner wallet first.'); return; }
    try {
      setLoading(true);
      setLoadingText('Funding pool...');
      // @ts-ignore
      await getClient(walletAddress).writeContract({
        address: CONTRACT_ADDRESS,
        functionName: 'fund_pool',
        args: [],
        value: BigInt(Math.round(parseFloat(fundAmount) * 1e18)),
      });
      waitFor(
        async () => true,
        'Waiting for confirmation...',
        () => { fetchConfig(); setFundAmount('10'); },
      );
    } catch (e: any) {
      alert('Error: ' + e.message);
      setLoading(false);
    }
  };

  // ── Owner: toggle active ───────────────────────────────────────────────────

  const handleToggleActive = async () => {
    if (!walletConnected) { alert('Connect owner wallet first.'); return; }
    try {
      setLoading(true);
      setLoadingText('Toggling program status...');
      const newStatus = !config?.is_active;
      // @ts-ignore
      await getClient(walletAddress).writeContract({
        address: CONTRACT_ADDRESS,
        functionName: 'set_active',
        args: [newStatus],
      });
      waitFor(
        async () => {
          // @ts-ignore
          const r = await getClient().readContract({ address: CONTRACT_ADDRESS, functionName: 'get_config', args: [] });
          if (!r) return false;
          return JSON.parse(r as string).is_active === newStatus;
        },
        'Waiting for confirmation...',
        () => { fetchConfig(); },
      );
    } catch (e: any) {
      alert('Error: ' + e.message);
      setLoading(false);
    }
  };

  // ── Derived ────────────────────────────────────────────────────────────────

  const isOwner = config && walletConnected &&
    walletAddress.toLowerCase() === config.owner.toLowerCase();

  const canWithdraw = myPending && myPending !== '0' && BigInt(myPending) > 0n;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-color)', color: 'var(--text-primary)', fontFamily: 'var(--font-mono, monospace)' }}>

      {/* ── Navbar ── */}
      <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 2rem', borderBottom: '1px solid var(--border-color)', background: 'var(--surface-color)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }} onClick={fetchConfig}>
          <Bug size={28} color="var(--accent-color)" />
          <span style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--text-primary)', letterSpacing: '0.5px' }}>
            Whitehat Auto-Bounty
          </span>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button
            onClick={fetchConfig}
            style={{ background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', padding: '0.45rem 0.75rem', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}
          >
            <RefreshCw size={14} /> Refresh
          </button>
          {walletConnected ? (
            <button
              onClick={handleDisconnect}
              style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid var(--success-color)', color: 'var(--success-color)', padding: '0.45rem 1rem', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.875rem' }}
            >
              <Wallet size={14} /> {short(walletAddress)} <XCircle size={13} />
            </button>
          ) : (
            <button className="btn-primary" onClick={handleConnectWallet} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Wallet size={15} /> Connect Wallet
            </button>
          )}
        </div>
      </nav>

      {/* ── Loading overlay ── */}
      {loading && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '1.25rem', zIndex: 2000 }}>
          <Loader2 size={52} color="var(--accent-color)" style={{ animation: 'spin 1.2s linear infinite' }} />
          <p style={{ color: 'var(--accent-color)', fontSize: '1.1rem', fontWeight: 500, textAlign: 'center', maxWidth: '320px' }}>{loadingText}</p>
        </div>
      )}

      <main style={{ maxWidth: '860px', margin: '0 auto', padding: '2rem 1.5rem' }}>

        {/* ── Hero / Program Status ── */}
        <div className="glass-panel" style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ fontSize: '1.4rem', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Shield size={22} color="var(--accent-color)" />
              Bug Bounty Program
            </h1>
            {config ? (
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                {config.reports_count} report{config.reports_count !== 1 ? 's' : ''} submitted
                {config.docs_url && (
                  <> · <a href={config.docs_url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-color)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                    Project Docs <ExternalLink size={11} />
                  </a></>
                )}
              </p>
            ) : (
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Loading...</p>
            )}
          </div>
          {config && (
            <span style={{ padding: '0.35rem 0.9rem', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.5px', background: config.is_active ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', color: config.is_active ? 'var(--success-color)' : '#ef4444', border: `1px solid ${config.is_active ? 'var(--success-color)' : '#ef4444'}` }}>
              {config.is_active ? '● ACTIVE' : '● PAUSED'}
            </span>
          )}
        </div>

        {/* ── Bounty Table ── */}
        {config && (
          <div className="glass-panel" style={{ marginBottom: '2rem' }}>
            <h2 style={{ fontSize: '1rem', marginBottom: '1rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>Reward Table</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
              {(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const).map(sev => (
                <div key={sev} style={{ textAlign: 'center', padding: '1rem 0.5rem', borderRadius: '8px', border: `1px solid ${SEVERITY_COLOR[sev]}33`, background: `${SEVERITY_COLOR[sev]}11` }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, color: SEVERITY_COLOR[sev], letterSpacing: '1px', marginBottom: '0.5rem' }}>{sev}</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {sev === 'CRITICAL' ? config.bounty_critical :
                     sev === 'HIGH' ? config.bounty_high :
                     sev === 'MEDIUM' ? config.bounty_medium :
                     config.bounty_low}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>GEN</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── My Report Status (connected hacker) ── */}
        {walletConnected && !isOwner && (
          <div className="glass-panel" style={{ marginBottom: '2rem' }}>
            <h2 style={{ fontSize: '1rem', marginBottom: '1rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>My Submission</h2>

            {!hasSubmitted ? (
              <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '1.25rem', fontSize: '0.95rem' }}>
                  Found a vulnerability? Submit your report — AI validators will assess it immediately.
                </p>
                <button
                  className="btn-primary"
                  onClick={() => setShowSubmitModal(true)}
                  disabled={!config?.is_active}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', opacity: config?.is_active ? 1 : 0.5 }}
                >
                  <Bug size={16} /> Submit Report
                </button>
                {!config?.is_active && (
                  <p style={{ color: '#ef4444', fontSize: '0.8rem', marginTop: '0.5rem' }}>Program is currently paused.</p>
                )}
              </div>
            ) : myResult ? (
              <div>
                {/* Result card */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1rem' }}>
                  {myResult.severity === 'INVALID'
                    ? <XCircle size={28} color={SEVERITY_COLOR.INVALID} />
                    : <CheckCircle2 size={28} color={SEVERITY_COLOR[myResult.severity]} />
                  }
                  <div>
                    <span style={{ fontSize: '1.1rem', fontWeight: 700, color: SEVERITY_COLOR[myResult.severity] }}>{myResult.severity}</span>
                    {myResult.amount > 0 && (
                      <span style={{ marginLeft: '10px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>→ {myResult.amount} GEN</span>
                    )}
                  </div>
                </div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontStyle: 'italic', marginBottom: '1.25rem', lineHeight: 1.6 }}>
                  "{myResult.reason}"
                </p>

                {canWithdraw && (
                  <button
                    className="btn-primary"
                    onClick={handleWithdraw}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(16,185,129,0.1)', borderColor: 'var(--success-color)', color: 'var(--success-color)' }}
                  >
                    <Download size={16} /> Withdraw {myPending} GEN
                  </button>
                )}
                {!canWithdraw && myResult.severity !== 'INVALID' && (
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    <CheckCircle2 size={13} style={{ display: 'inline', marginRight: '4px' }} color="var(--success-color)" />
                    Reward already withdrawn.
                  </p>
                )}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                  <Loader2 size={18} style={{ animation: 'spin 1.2s linear infinite' }} />
                  Report submitted — AI consensus in progress...
                </div>
                <button
                  onClick={() => fetchMyData(walletAddress)}
                  style={{ background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--accent-color)', padding: '0.4rem 1rem', borderRadius: '6px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}
                >
                  <RefreshCw size={14} /> Check Result
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Owner Panel ── */}
        {isOwner && (
          <div className="glass-panel" style={{ marginBottom: '2rem' }}>
            <button
              onClick={() => setShowOwnerPanel(p => !p)}
              style={{ width: '100%', background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 0, fontSize: '1rem', fontWeight: 600 }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Shield size={16} color="var(--accent-color)" /> Owner Controls
              </span>
              {showOwnerPanel ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>

            {showOwnerPanel && (
              <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                {/* Toggle active */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.9rem' }}>Program Status</span>
                  <button
                    onClick={handleToggleActive}
                    style={{ padding: '0.4rem 1rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, border: 'none', background: config?.is_active ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)', color: config?.is_active ? '#ef4444' : 'var(--success-color)' }}
                  >
                    {config?.is_active ? 'Pause Program' : 'Resume Program'}
                  </button>
                </div>

                {/* Fund pool */}
                <form onSubmit={handleFundPool} style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                  <div className="input-group" style={{ margin: 0, flex: 1 }}>
                    <label>Fund Pool (GEN)</label>
                    <input className="input-field" type="number" min="1" step="1" value={fundAmount} onChange={e => setFundAmount(e.target.value)} />
                  </div>
                  <button type="submit" className="btn-primary" style={{ whiteSpace: 'nowrap' }}>Add Funds</button>
                </form>

                {/* Update docs URL */}
                <form onSubmit={handleUpdateDocs} style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                  <div className="input-group" style={{ margin: 0, flex: 1 }}>
                    <label>Project Docs / Repo URL</label>
                    <input className="input-field" type="url" placeholder={config?.docs_url || 'https://github.com/...'} value={newDocsUrl} onChange={e => setNewDocsUrl(e.target.value)} />
                  </div>
                  <button type="submit" className="btn-primary" disabled={!newDocsUrl}>Update</button>
                </form>

                {/* Configure bounties */}
                <form onSubmit={handleConfigureBounties}>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>Bounty Amounts (GEN)</p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    {[
                      { label: 'CRITICAL', val: cfgCritical, set: setCfgCritical, color: SEVERITY_COLOR.CRITICAL },
                      { label: 'HIGH', val: cfgHigh, set: setCfgHigh, color: SEVERITY_COLOR.HIGH },
                      { label: 'MEDIUM', val: cfgMedium, set: setCfgMedium, color: SEVERITY_COLOR.MEDIUM },
                      { label: 'LOW', val: cfgLow, set: setCfgLow, color: SEVERITY_COLOR.LOW },
                    ].map(({ label, val, set, color }) => (
                      <div key={label} className="input-group" style={{ margin: 0 }}>
                        <label style={{ color }}>{label}</label>
                        <input className="input-field" type="number" min="0" value={val} onChange={e => set(e.target.value)} />
                      </div>
                    ))}
                  </div>
                  <button type="submit" className="btn-primary">Save Bounties</button>
                </form>

              </div>
            )}
          </div>
        )}

        {/* ── How it works ── */}
        <div className="glass-panel" style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1rem', marginBottom: '1rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>How it works</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {[
              { icon: '🔍', text: 'Submit your bug description and evidence URL on-chain.' },
              { icon: '🤖', text: 'AI validators on GenLayer independently read the project docs and your evidence, then reach consensus on severity.' },
              { icon: '💸', text: 'If valid, your reward is locked immediately. Withdraw it anytime — no human approval needed.' },
            ].map(({ icon, text }, i) => (
              <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>{icon}</span>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6, margin: 0 }}>{text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Contract info ── */}
        <div style={{ textAlign: 'center', fontSize: '0.78rem', color: 'var(--text-secondary)', paddingBottom: '2rem' }}>
          <a
            href={`https://explorer-studio.genlayer.com/address/${CONTRACT_ADDRESS}`}
            target="_blank"
            rel="noreferrer"
            style={{ color: 'var(--text-secondary)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
          >
            Contract: {short(CONTRACT_ADDRESS)} <ExternalLink size={11} />
          </a>
        </div>

      </main>

      {/* ── Submit Report Modal ── */}
      {showSubmitModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '1.5rem' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '480px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Bug size={18} color="var(--accent-color)" /> Submit Bug Report
              </h2>
              <button onClick={() => setShowSubmitModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <XCircle size={20} />
              </button>
            </div>

            <div style={{ background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.3)', borderRadius: '6px', padding: '0.75rem 1rem', marginBottom: '1.25rem', display: 'flex', gap: '8px' }}>
              <AlertTriangle size={16} color="#eab308" style={{ flexShrink: 0, marginTop: '1px' }} />
              <p style={{ fontSize: '0.82rem', color: '#eab308', margin: 0, lineHeight: 1.5 }}>
                You can only submit once per wallet. Make sure your evidence URL is publicly accessible.
              </p>
            </div>

            <form onSubmit={handleSubmitReport}>
              <div className="input-group">
                <label>Bug Description</label>
                <textarea
                  className="input-field"
                  required
                  rows={4}
                  placeholder="Describe the vulnerability clearly: what it is, where it is, and what impact it has..."
                  value={bugDesc}
                  onChange={e => setBugDesc(e.target.value)}
                  style={{ resize: 'vertical' }}
                />
              </div>
              <div className="input-group">
                <label>Evidence URL</label>
                <input
                  className="input-field"
                  required
                  type="url"
                  placeholder="https://github.com/... or a public PoC link"
                  value={evidenceUrl}
                  onChange={e => setEvidenceUrl(e.target.value)}
                />
                <small style={{ color: 'var(--text-secondary)' }}>Must be a publicly accessible page. AI validators will fetch it.</small>
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '1.25rem' }}>
                <button type="submit" className="btn-primary" style={{ flex: 1 }}>Submit</button>
                <button type="button" className="btn-primary" onClick={() => setShowSubmitModal(false)} style={{ flex: 1, borderColor: 'var(--text-secondary)', color: 'var(--text-secondary)' }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
