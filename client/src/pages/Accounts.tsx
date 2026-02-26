import { useState } from 'react'
import { useAccounts, useAddAccount, useDeleteAccount, useToggleAccount } from '@/hooks/useAccounts'
import { Wallet, Plus, Trash2, Power, CheckCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'

const PLATFORM_CONFIGS: Record<string, {
  name: string; icon: string; type: string; category: string;
  fields: { key: string; label: string; type: string; placeholder: string }[]
}> = {
  hyperliquid: { name: 'Hyperliquid', icon: 'HL', type: 'CRYPTO_EXCHANGE', category: 'Crypto', fields: [{ key: 'mnemonic', label: 'Mnemonic / Private Key', type: 'password', placeholder: 'seed phrase or 0x private key' }] },
  binance: { name: 'Binance', icon: 'BN', type: 'CRYPTO_EXCHANGE', category: 'Crypto', fields: [{ key: 'apiKey', label: 'API Key', type: 'text', placeholder: '' }, { key: 'apiSecret', label: 'API Secret', type: 'password', placeholder: '' }] },
  bybit: { name: 'Bybit', icon: 'BY', type: 'CRYPTO_EXCHANGE', category: 'Crypto', fields: [{ key: 'apiKey', label: 'API Key', type: 'text', placeholder: '' }, { key: 'apiSecret', label: 'API Secret', type: 'password', placeholder: '' }] },
  bitget: { name: 'Bitget', icon: 'BG', type: 'CRYPTO_EXCHANGE', category: 'Crypto', fields: [{ key: 'apiKey', label: 'API Key', type: 'text', placeholder: '' }, { key: 'apiSecret', label: 'API Secret', type: 'password', placeholder: '' }, { key: 'passphrase', label: 'Passphrase', type: 'password', placeholder: '' }] },
  coinbase: { name: 'Coinbase', icon: 'CB', type: 'CRYPTO_EXCHANGE', category: 'Crypto', fields: [{ key: 'apiKey', label: 'API Key', type: 'text', placeholder: '' }, { key: 'apiSecret', label: 'API Secret', type: 'password', placeholder: '' }] },
  kraken: { name: 'Kraken', icon: 'KR', type: 'CRYPTO_EXCHANGE', category: 'Crypto', fields: [{ key: 'apiKey', label: 'API Key', type: 'text', placeholder: '' }, { key: 'privateKey', label: 'Private Key', type: 'password', placeholder: 'Base64 encoded' }] },
  okx: { name: 'OKX', icon: 'OK', type: 'CRYPTO_EXCHANGE', category: 'Crypto', fields: [{ key: 'apiKey', label: 'API Key', type: 'text', placeholder: '' }, { key: 'apiSecret', label: 'API Secret', type: 'password', placeholder: '' }, { key: 'passphrase', label: 'Passphrase', type: 'password', placeholder: '' }] },
  gate: { name: 'Gate.io', icon: 'GT', type: 'CRYPTO_EXCHANGE', category: 'Crypto', fields: [{ key: 'apiKey', label: 'API Key', type: 'text', placeholder: '' }, { key: 'apiSecret', label: 'API Secret', type: 'password', placeholder: '' }] },
  polymarket: { name: 'Polymarket', icon: '🔮', type: 'PREDICTION', category: 'Predictions', fields: [{ key: 'privateKey', label: 'EVM Private Key', type: 'password', placeholder: '0x...' }] },
  kalshi: { name: 'Kalshi', icon: '📊', type: 'PREDICTION', category: 'Predictions', fields: [{ key: 'apiKey', label: 'API Key', type: 'password', placeholder: '' }] },
  aster: { name: 'Aster DeFi', icon: '⚡', type: 'DEFI', category: 'DeFi', fields: [{ key: 'address', label: 'Wallet Address', type: 'text', placeholder: '0x...' }] },
  ibkr: { name: 'Interactive Brokers', icon: 'IB', type: 'BROKER', category: 'TradFi', fields: [{ key: 'gatewayUrl', label: 'Gateway URL', type: 'text', placeholder: 'https://localhost:5000' }] },
  schwab: { name: 'Charles Schwab', icon: 'CS', type: 'BROKER', category: 'TradFi', fields: [{ key: 'clientId', label: 'Client ID', type: 'text', placeholder: '' }, { key: 'clientSecret', label: 'Client Secret', type: 'password', placeholder: '' }, { key: 'refreshToken', label: 'Refresh Token', type: 'password', placeholder: '' }] },
  swissquote: { name: 'Swissquote', icon: 'SQ', type: 'BROKER', category: 'TradFi', fields: [{ key: 'clientId', label: 'Client ID', type: 'text', placeholder: '' }, { key: 'clientSecret', label: 'Client Secret', type: 'password', placeholder: '' }, { key: 'refreshToken', label: 'Refresh Token', type: 'password', placeholder: '' }] },
  'six-blink': { name: 'Six B-Link', icon: '🏦', type: 'BANK', category: 'TradFi', fields: [{ key: 'endpoint', label: 'API Endpoint', type: 'text', placeholder: 'https://api.six-group.com/b-link' }, { key: 'certPath', label: 'Certificate Path', type: 'text', placeholder: './certs/six-blink.p12' }, { key: 'certPassword', label: 'Certificate Password', type: 'password', placeholder: '' }] },
}

function AddAccountModal({ onClose }: { onClose: () => void }) {
  const add = useAddAccount()
  const [platform, setPlatform] = useState('')
  const [name, setName] = useState('')
  const [creds, setCreds] = useState<Record<string, string>>({})

  const config = platform ? PLATFORM_CONFIGS[platform] : null

  function submit() {
    if (!config) return
    add.mutate({ name: name || config.name, type: config.type, platform, credentials: creds }, {
      onSuccess: () => onClose(),
    })
  }

  const categories = [...new Set(Object.values(PLATFORM_CONFIGS).map(c => c.category))]

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <h3 className="font-bold text-lg mb-4">Connect Account</h3>

        {!platform ? (
          <div className="space-y-4">
            {categories.map(cat => (
              <div key={cat}>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">{cat}</p>
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(PLATFORM_CONFIGS).filter(([, c]) => c.category === cat).map(([id, c]) => (
                    <button key={id} onClick={() => setPlatform(id)}
                      className="flex flex-col items-center gap-1.5 p-3 bg-secondary/40 hover:bg-secondary rounded-lg transition-colors text-center">
                      <span className="text-lg">{c.icon.length <= 2 ? <span className="font-bold text-sm">{c.icon}</span> : c.icon}</span>
                      <span className="text-xs font-medium">{c.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-4">
              <button onClick={() => setPlatform('')} className="text-xs text-muted-foreground hover:text-foreground">← Back</button>
              <span className="text-sm font-semibold">{config?.name}</span>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Account Name</label>
              <input type="text" placeholder={config?.name} value={name} onChange={e => setName(e.target.value)}
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary" />
            </div>
            {config?.fields.map(f => (
              <div key={f.key}>
                <label className="block text-xs text-muted-foreground mb-1">{f.label}</label>
                <input type={f.type} placeholder={f.placeholder} value={creds[f.key] ?? ''}
                  onChange={e => setCreds(p => ({ ...p, [f.key]: e.target.value }))}
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary font-mono text-xs" />
              </div>
            ))}
            <p className="text-xs text-muted-foreground mt-2">
              Credentials are encrypted with AES-256 before storage.
            </p>
          </div>
        )}

        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border border-border text-sm hover:bg-secondary transition-colors">Cancel</button>
          {platform && (
            <button onClick={submit} disabled={add.isPending}
              className="flex-1 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50 hover:bg-primary/90 transition-colors">
              {add.isPending ? 'Connecting…' : 'Connect'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export function Accounts() {
  const { data: accounts = [], isLoading } = useAccounts()
  const deleteAccount = useDeleteAccount()
  const toggleAccount = useToggleAccount()
  const [showModal, setShowModal] = useState(false)

  if (isLoading) return <div className="p-6"><div className="h-64 skeleton rounded-xl" /></div>

  return (
    <div className="p-6 space-y-6">
      {showModal && <AddAccountModal onClose={() => setShowModal(false)} />}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Accounts</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage your exchange, broker, and bank connections</p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors">
          <Plus className="w-4 h-4" /> Connect Account
        </button>
      </div>

      {accounts.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {accounts.map((acc: any) => {
            const config = PLATFORM_CONFIGS[acc.platform]
            return (
              <div key={acc.id} className={cn('bg-card border rounded-xl p-5 transition-opacity', !acc.isActive && 'opacity-50')}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center text-sm font-bold">
                      {config?.icon ?? acc.platform.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{acc.name}</p>
                      <p className="text-xs text-muted-foreground capitalize">{acc.type.replace('_', ' ')}</p>
                    </div>
                  </div>
                  <CheckCircle className={cn('w-4 h-4 shrink-0 mt-0.5', acc.isActive ? 'text-green-500' : 'text-muted-foreground')} />
                </div>
                <p className="text-xs text-muted-foreground">
                  {acc.lastSynced ? `Synced ${format(new Date(acc.lastSynced), 'MMM d, HH:mm')}` : 'Not yet synced'}
                </p>
                <div className="flex gap-2 mt-3">
                  <button onClick={() => toggleAccount.mutate({ id: acc.id, isActive: !acc.isActive })}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-border text-xs hover:bg-secondary transition-colors">
                    <Power className="w-3 h-3" />
                    {acc.isActive ? 'Disable' : 'Enable'}
                  </button>
                  <button onClick={() => deleteAccount.mutate(acc.id)}
                    className="flex items-center justify-center p-1.5 rounded-lg border border-border text-muted-foreground hover:text-destructive hover:border-destructive transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <Wallet className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-40" />
          <p className="font-semibold text-lg">No accounts connected</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
            Connect your exchanges, brokers, and banks to see your unified portfolio across all platforms.
          </p>
          <button onClick={() => setShowModal(true)}
            className="mt-4 px-6 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors">
            Get Started
          </button>
        </div>
      )}

      {/* Setup guides */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="font-semibold mb-4">Setup Guides</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          {[
            { title: 'IBKR Client Portal Gateway', desc: 'Download and run the CP Gateway on localhost:5000, then authenticate with your IBKR credentials.', url: 'https://www.interactivebrokers.com/en/trading/ib-api.php' },
            { title: 'Schwab Developer API', desc: 'Register an app at developer.schwab.com to get Client ID and Secret, then complete the OAuth flow.', url: 'https://developer.schwab.com' },
            { title: 'Six Group B-Link', desc: 'Enterprise registration required. Contact Six Group to obtain mTLS certificates and API access.', url: 'https://www.six-group.com/en/products-services/banking-services/b-link.html' },
            { title: 'Polymarket', desc: 'Use your EVM wallet private key. The wallet must hold USDC on Polygon for prediction market positions.', url: 'https://polymarket.com' },
          ].map(g => (
            <div key={g.title} className="p-3 bg-secondary/40 rounded-lg">
              <p className="font-semibold text-sm">{g.title}</p>
              <p className="text-xs text-muted-foreground mt-1">{g.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
