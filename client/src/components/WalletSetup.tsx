import * as React from 'react'
import { useState } from 'react'
import axios from 'axios'
import { Wallet, Eye, EyeOff, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface WalletSetupProps {
  onSuccess: (address: string) => void
}

export function WalletSetup({ onSuccess }: WalletSetupProps) {
  const [mnemonic, setMnemonic] = useState('')
  const [showMnemonic, setShowMnemonic] = useState(false)
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [savedAddress, setSavedAddress] = useState('')

  const wordCount = mnemonic.trim().split(/\s+/).filter(Boolean).length

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('loading')
    setErrorMsg('')

    try {
      const { data } = await axios.post('/api/wallet/mnemonic', { mnemonic: mnemonic.trim() })
      setSavedAddress(data.address)
      setStatus('success')
      setTimeout(() => onSuccess(data.address), 1200)
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.error ?? 'Failed to save mnemonic. Please try again.')
      setStatus('error')
    }
  }

  return (
    <div className="flex items-center justify-center min-h-[80vh] px-4">
      <Card className="w-full max-w-lg shadow-lg">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-2">
            <div className="rounded-full bg-primary/10 p-3">
              <Wallet className="h-7 w-7 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl">Connect your wallet</CardTitle>
          <CardDescription>
            Enter your 12 or 24-word mnemonic phrase to start tracking your portfolio.
            Your phrase is sent only to your local server and never stored in the browser.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Mnemonic input */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="mnemonic">
                Mnemonic phrase
                <span className={cn(
                  'ml-2 text-xs font-normal',
                  wordCount === 12 || wordCount === 24 ? 'text-green-500' : 'text-muted-foreground'
                )}>
                  {wordCount > 0 ? `${wordCount} words` : ''}
                </span>
              </label>
              <div className="relative">
                <textarea
                  id="mnemonic"
                  rows={3}
                  placeholder="word1 word2 word3 … word12"
                  value={mnemonic}
                  onChange={e => { setMnemonic(e.target.value); setStatus('idle'); setErrorMsg('') }}
                  className={cn(
                    'w-full resize-none rounded-md border bg-background px-3 py-2 pr-10 text-sm',
                    'placeholder:text-muted-foreground',
                    'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                    showMnemonic ? '' : 'blur-text',
                    status === 'error' ? 'border-destructive' : 'border-input'
                  )}
                  style={showMnemonic ? {} : { WebkitTextSecurity: 'disc' } as React.CSSProperties}
                  autoComplete="off"
                  spellCheck={false}
                />
                <button
                  type="button"
                  onClick={() => setShowMnemonic(v => !v)}
                  className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                  aria-label={showMnemonic ? 'Hide mnemonic' : 'Show mnemonic'}
                >
                  {showMnemonic ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Error message */}
            {status === 'error' && (
              <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {errorMsg}
              </div>
            )}

            {/* Success message */}
            {status === 'success' && (
              <div className="flex items-center gap-2 rounded-md border border-green-500/40 bg-green-500/10 px-3 py-2 text-sm text-green-600">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                Wallet connected!&nbsp;
                <span className="font-mono text-xs truncate">{savedAddress}</span>
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={wordCount < 12 || status === 'loading' || status === 'success'}
            >
              {status === 'loading' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {status === 'success' ? 'Connected!' : 'Save & connect'}
            </Button>
          </form>

          <p className="mt-4 text-center text-xs text-muted-foreground">
            🔒 Your mnemonic is only stored in memory on your local server and is cleared on restart.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
