import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'
import { Coins } from 'lucide-react'

interface Asset {
  asset: string
  amount: string
  usdValue: string
  chain: string
}

interface AssetsListProps {
  assets: Asset[]
}

export function AssetsList({ assets }: AssetsListProps) {
  return (
    <Card className="col-span-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Coins className="h-5 w-5" />
          Assets
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {assets.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No assets found. Connect your wallet to see your holdings.
            </p>
          ) : (
            <div className="space-y-2">
              {assets.map((asset, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-sm font-bold text-primary">
                        {asset.asset.substring(0, 2).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium">{asset.asset}</p>
                      <p className="text-sm text-muted-foreground">{asset.chain}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{parseFloat(asset.amount).toFixed(4)}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatCurrency(asset.usdValue)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
