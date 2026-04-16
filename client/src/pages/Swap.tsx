import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAccount, useSendTransaction, usePublicClient, useReadContract } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { parseUnits, maxUint256, parseAbi } from 'viem'
import { ArrowDownUp, Loader2, AlertCircle, ExternalLink, ChevronDown } from 'lucide-react'
import axios from 'axios'
import { cn } from '@/lib/utils'

const ERC20_ABI = parseAbi([
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
])

// Common tokens for quick access
const POPULAR = [
  { symbol: 'ETH',  address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', decimals: 18 },
  { symbol: 'WETH', address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', decimals: 18 },
  { symbol: 'USDC', address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6  },
  { symbol: 'USDT', address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6  },
  { symbol: 'DAI',  address: '0x6B175474E89094C44Da98b954EedeAC495271d0F', decimals: 18 },
  { symbol: 'WBTC', address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', decimals: 8  },
  { symbol: 'LINK', address: '0x514910771AF9Ca656af840dff83E8264EcF986CA', decimals: 18 },
  { symbol: 'AAVE', address: '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9', decimals: 18 },
  { symbol: 'UNI',  address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', decimals: 18 },
]

type Token = { symbol: string; address: string; decimals: number }

function TokenSelector({ value, onChange, exclude }: { value: Token; onChange: (t: Token) => void; exclude?: string }) {
  const [open, setOpen] = useState(false)
  const tokens = POPULAR.filter(t => t.address !== exclude)
  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold transition-colors"
        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--glass-border)' }}>
        <span>{value.symbol}</span>
        <ChevronDown className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 rounded-xl overflow-hidden z-50 w-36"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--gold-border)', boxShadow: '0 16px 40px rgba(0,0,0,0.5)' }}>
          {tokens.map(t => (
            <button key={t.address} onClick={() => { onChange(t); setOpen(false) }}
              className={cn('w-full text-left px-3 py-2.5 text-sm font-medium transition-colors', t.address === value.address && 'text-gold')}
              style={{ color: t.address === value.address ? 'var(--gold)' : 'var(--text-primary)' }}
              onMouseEnter={e => { if (t.address !== value.address) e.currentTarget.style.background = 'var(--glass-hover)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
              {t.symbol}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function Swap() {
  const { address, isConnected, chain } = useAccount()
  const { sendTransactionAsync, isPending: isTxPending } = useSendTransaction()
  const publicClient = usePublicClient()

  const [sellToken, setSellToken] = useState(POPULAR[0])
  const [buyToken,  setBuyToken]  = useState(POPULAR[2])
  const [sellAmt,   setSellAmt]   = useState('')
  const [status,    setStatus]    = useState<'idle'|'approving'|'swapping'|'done'|'error'>('idle')
  const [txHash,    setTxHash]    = useState<string>()
  const [error,     setError]     = useState<string>()

  const chainId = chain?.id ?? 1

  // Fetch indicative price
  const { data: price, isFetching: priceFetching } = useQuery({
    queryKey: ['swap-price', sellToken.address, buyToken.address, sellAmt, chainId],
    queryFn: async () => {
      if (!sellAmt || parseFloat(sellAmt) <= 0 || !address) return null
      const sellAmount = parseUnits(sellAmt, sellToken.decimals).toString()
      const params = new URLSearchParams({ sellToken: sellToken.address, buyToken: buyToken.address, sellAmount, chainId: String(chainId), taker: address })
      const res = await axios.get(`/api/swap/price?${params}`)
      return res.data
    },
    enabled: !!address && !!sellAmt && parseFloat(sellAmt) > 0,
    refetchInterval: 15_000,
  })

  const buyAmount = price?.buyAmount
    ? (Number(BigInt(price.buyAmount)) / 10 ** buyToken.decimals).toFixed(6)
    : ''

  async function handleSwap() {
    if (!address || !sellAmt || !publicClient) return
    setError(undefined)
    try {
      // 1. Get firm quote
      setStatus('approving')
      const sellAmount = parseUnits(sellAmt, sellToken.decimals).toString()
      const params = new URLSearchParams({ sellToken: sellToken.address, buyToken: buyToken.address, sellAmount, chainId: String(chainId), taker: address })
      const { data: quote } = await axios.get(`/api/swap/quote?${params}`)

      // 2. Approve if needed
      const spender = quote.issues?.allowance?.spender
      if (spender && sellToken.address !== '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE') {
        const allowance = await publicClient.readContract({
          address: sellToken.address as `0x${string}`,
          abi: ERC20_ABI,
          functionName: 'allowance',
          args: [address, spender],
        })
        if (BigInt(allowance as bigint) < BigInt(sellAmount)) {
          const approveTx = await sendTransactionAsync({
            to: sellToken.address as `0x${string}`,
            data: (`0x095ea7b3${spender.slice(2).padStart(64,'0')}${'f'.repeat(64)}`) as `0x${string}`,
          })
          await publicClient.waitForTransactionReceipt({ hash: approveTx })
        }
      }

      // 3. Execute swap
      setStatus('swapping')
      const hash = await sendTransactionAsync({
        to: quote.transaction.to,
        data: quote.transaction.data,
        value: quote.transaction.value ? BigInt(quote.transaction.value) : 0n,
        gas:  quote.transaction.gas   ? BigInt(quote.transaction.gas)   : undefined,
      })
      setTxHash(hash)
      await publicClient.waitForTransactionReceipt({ hash })
      setStatus('done')
      setSellAmt('')
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e.message ?? 'Swap failed')
      setStatus('error')
    }
  }

  function flip() {
    const tmp = sellToken
    setSellToken(buyToken)
    setBuyToken(tmp)
    setSellAmt('')
  }

  const isLoading = status === 'approving' || status === 'swapping' || isTxPending

  return (
    <div className="p-5 max-w-md mx-auto fade-up">
      <div className="mb-5">
        <h1 className="text-xl font-bold">Swap</h1>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
          Best price across all DEXs via 0x Protocol
        </p>
      </div>

      <div className="rounded-2xl p-5 space-y-2" style={{ background: 'var(--bg-surface)', border: '1px solid var(--glass-border)' }}>
        {/* Sell */}
        <div className="rounded-xl p-4" style={{ background: 'var(--bg-elevated)' }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>You pay</span>
            <TokenSelector value={sellToken} onChange={setSellToken} exclude={buyToken.address} />
          </div>
          <input
            type="number"
            placeholder="0.0"
            value={sellAmt}
            onChange={e => setSellAmt(e.target.value)}
            className="w-full text-2xl font-bold bg-transparent outline-none"
            style={{ color: 'var(--text-primary)', fontFamily: 'Space Grotesk' }}
          />
        </div>

        {/* Flip */}
        <div className="flex justify-center">
          <button onClick={flip}
            className="p-2 rounded-xl transition-all"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--glass-border)' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--gold-border)'; e.currentTarget.style.color = 'var(--gold)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--glass-border)'; e.currentTarget.style.color = '' }}>
            <ArrowDownUp className="w-4 h-4" />
          </button>
        </div>

        {/* Buy */}
        <div className="rounded-xl p-4" style={{ background: 'var(--bg-elevated)' }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>You receive</span>
            <TokenSelector value={buyToken} onChange={setBuyToken} exclude={sellToken.address} />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold" style={{ fontFamily: 'Space Grotesk', color: buyAmount ? 'var(--text-primary)' : 'var(--text-muted)' }}>
              {priceFetching ? '…' : buyAmount || '0.0'}
            </span>
            {priceFetching && <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--text-muted)' }} />}
          </div>
        </div>

        {/* Price info */}
        {price && !priceFetching && (
          <div className="px-1 py-2 space-y-1">
            {price.estimatedPriceImpact && (
              <div className="flex justify-between text-xs">
                <span style={{ color: 'var(--text-muted)' }}>Price impact</span>
                <span className={cn('font-semibold', parseFloat(price.estimatedPriceImpact) > 1 ? 'loss' : 'gain')}>
                  {parseFloat(price.estimatedPriceImpact).toFixed(2)}%
                </span>
              </div>
            )}
            {price.fees?.zeroExFee && (
              <div className="flex justify-between text-xs">
                <span style={{ color: 'var(--text-muted)' }}>0x fee</span>
                <span style={{ color: 'var(--text-secondary)' }}>0.15%</span>
              </div>
            )}
          </div>
        )}

        {/* Status/error */}
        {status === 'done' && (
          <div className="flex items-center gap-2 p-3 rounded-xl text-sm"
            style={{ background: 'rgba(16,212,160,0.06)', border: '1px solid rgba(16,212,160,0.2)', color: 'var(--gain)' }}>
            Swap confirmed!
            {txHash && (
              <a href={`https://etherscan.io/tx/${txHash}`} target="_blank" rel="noreferrer" className="ml-auto">
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        )}
        {(status === 'error' || error) && (
          <div className="flex items-start gap-2 p-3 rounded-xl text-xs"
            style={{ background: 'rgba(255,83,112,0.06)', border: '1px solid rgba(255,83,112,0.2)', color: 'var(--loss)' }}>
            <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            {error || 'Something went wrong'}
          </div>
        )}

        {/* CTA */}
        {!isConnected ? (
          <div className="pt-1">
            <ConnectButton.Custom>
              {({ openConnectModal }) => (
                <button onClick={openConnectModal} className="btn-gold w-full py-3 text-sm">
                  Connect Wallet to Swap
                </button>
              )}
            </ConnectButton.Custom>
          </div>
        ) : (
          <button
            onClick={handleSwap}
            disabled={isLoading || !sellAmt || parseFloat(sellAmt) <= 0 || !price}
            className="btn-gold w-full py-3 text-sm flex items-center justify-center gap-2"
            style={{ opacity: isLoading || !sellAmt || parseFloat(sellAmt) <= 0 ? 0.5 : 1 }}
          >
            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            {status === 'approving' ? 'Approving…' : status === 'swapping' ? 'Swapping…' : 'Swap'}
          </button>
        )}
      </div>

      <p className="text-center text-xs mt-4" style={{ color: 'var(--text-muted)' }}>
        Powered by <span className="text-gold">0x Protocol</span> · Best price aggregation
      </p>
    </div>
  )
}
