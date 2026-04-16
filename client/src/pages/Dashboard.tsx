import { usePortfolio, usePortfolioHistory } from '@/hooks/usePortfolio'
import { useCryptoPrices } from '@/hooks/useMarketData'
import { cn } from '@/lib/utils'
import { AreaChart, Area, PieChart, Pie, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts'
import { TrendingUp, TrendingDown, Wallet, BarChart3, Globe, ArrowRight, Zap } from 'lucide-react'
import { format } from 'date-fns'
import { Link } from 'react-router-dom'

const ALLOC_COLORS = ['#C9A84C','#4C8FFF','#10D4A0','#9B6DFF','#FF5370']

function SkeletonCard() {
  return <div className="stat-card space-y-2.5"><div className="skeleton h-3 w-16"/><div className="skeleton h-7 w-28"/><div className="skeleton h-3 w-12"/></div>
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-14 px-6 rounded-2xl text-center fade-up"
      style={{border:'1px dashed var(--gold-border)',background:'linear-gradient(135deg,rgba(201,168,76,0.04) 0%,transparent 100%)'}}>
      <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
        style={{background:'var(--gold-dim)',border:'1px solid var(--gold-border)'}}>
        <Wallet className="w-6 h-6" style={{color:'var(--gold)'}}/>
      </div>
      <h3 className="text-base font-semibold mb-1">Connect your first account</h3>
      <p className="text-sm mb-5 max-w-xs" style={{color:'var(--text-secondary)'}}>
        Link Hyperliquid, Binance, IBKR, Schwab and more — all in one place.
      </p>
      <Link to="/accounts" className="btn-gold flex items-center gap-2 px-5 py-2.5 text-sm" style={{textDecoration:'none'}}>
        Add account <ArrowRight className="w-3.5 h-3.5"/>
      </Link>
    </div>
  )
}

function CustomTooltip({active,payload,label}:any) {
  if (!active||!payload?.length) return null
  return (
    <div className="px-3 py-2 rounded-xl text-xs"
      style={{background:'var(--bg-elevated)',border:'1px solid var(--gold-border)',boxShadow:'0 8px 24px rgba(0,0,0,0.4)'}}>
      <p style={{color:'var(--text-muted)'}}>{label}</p>
      <p className="font-semibold mt-0.5 text-gold">${parseFloat(payload[0].value).toLocaleString('en-US',{maximumFractionDigits:0})}</p>
    </div>
  )
}

export function Dashboard() {
  const {data:portfolio,isLoading} = usePortfolio()
  const {data:history=[]} = usePortfolioHistory(90)
  const {data:prices=[]} = useCryptoPrices()
  const total=portfolio?.totalValue??0, pnl24h=portfolio?.pnl24h??0, pnlPct=portfolio?.pnl24hPercent??0
  const breakdown=portfolio?.breakdown??{crypto:0,tradfi:0,cash:0,predictions:0,defi:0}
  const alloc=[{name:'Crypto',value:breakdown.crypto},{name:'TradFi',value:breakdown.tradfi},{name:'DeFi',value:breakdown.defi},{name:'Pred',value:breakdown.predictions},{name:'Cash',value:breakdown.cash}].filter(d=>d.value>0)
  const chartData=history.map((h:any)=>({date:format(new Date(h.date),'MMM d'),value:h.totalValue}))
  const topPositions=(portfolio?.positions??[]).slice(0,5)
  const topBalances=(portfolio?.balances??[]).sort((a:any,b:any)=>parseFloat(b.usdValue)-parseFloat(a.usdValue)).slice(0,6)

  if (isLoading) return (
    <div className="p-5 space-y-4 fade-up">
      <div className="space-y-1"><div className="skeleton h-5 w-24"/><div className="skeleton h-3 w-16 mt-1"/></div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{[0,1,2,3].map(i=><SkeletonCard key={i}/>)}</div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2 card p-5 space-y-3"><div className="skeleton h-4 w-32"/><div className="skeleton h-52 rounded-xl"/></div>
        <div className="card p-5 space-y-3"><div className="skeleton h-4 w-24"/><div className="skeleton h-32 rounded-xl"/>{[0,1,2].map(i=><div key={i} className="skeleton h-3"/>)}</div>
      </div>
    </div>
  )

  if (total===0) return (
    <div className="p-5 space-y-4 fade-up">
      <div><h1 className="text-xl font-bold">Dashboard</h1><p className="text-xs mt-0.5" style={{color:'var(--text-muted)'}}>Welcome to FinVault</p></div>
      <EmptyState/>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 opacity-30 pointer-events-none">{[0,1,2,3].map(i=><SkeletonCard key={i}/>)}</div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 opacity-30 pointer-events-none">
        <div className="lg:col-span-2 card p-5 space-y-3"><div className="skeleton h-4 w-32"/><div className="skeleton h-52 rounded-xl"/></div>
        <div className="card p-5 space-y-3"><div className="skeleton h-4 w-24"/><div className="skeleton h-32 rounded-xl"/></div>
      </div>
    </div>
  )

  return (
    <div className="p-5 space-y-4 fade-up">
      <div><h1 className="text-xl font-bold">Dashboard</h1><p className="text-xs mt-0.5" style={{color:'var(--text-muted)'}}>{portfolio?.lastUpdated?`Updated ${format(new Date(portfolio.lastUpdated),'HH:mm')}`:'Connecting…'}</p></div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {label:'Net Worth',value:`$${total.toLocaleString('en-US',{maximumFractionDigits:0})}`,sub:'Live',icon:Wallet,pos:undefined as boolean|undefined},
          {label:'24h P&L',value:`${pnl24h>=0?'+':''}$${Math.abs(pnl24h).toFixed(2)}`,sub:`${pnl24h>=0?'+':''}${pnlPct.toFixed(2)}%`,icon:pnl24h>=0?TrendingUp:TrendingDown,pos:pnl24h>=0},
          {label:'Positions',value:String(topPositions.length),sub:`${topBalances.length} assets`,icon:BarChart3,pos:undefined},
          {label:'Crypto %',value:total>0?`${((breakdown.crypto/total)*100).toFixed(0)}%`:'—',sub:`$${breakdown.crypto.toLocaleString('en-US',{maximumFractionDigits:0})}`,icon:Globe,pos:undefined},
        ].map(({label,value,sub,icon:Icon,pos})=>(
          <div key={label} className="stat-card flex gap-3 items-start">
            <div className="p-2 rounded-lg shrink-0" style={{background:'var(--bg-elevated)'}}><Icon className="w-4 h-4" style={{color:'var(--text-muted)'}}/></div>
            <div className="min-w-0">
              <p className="text-xs mb-1" style={{color:'var(--text-muted)'}}>{label}</p>
              <p className="text-lg font-bold truncate" style={{fontFamily:'Space Grotesk'}}>{value}</p>
              {sub&&<p className={cn('text-xs font-semibold mt-0.5',pos===true?'gain':pos===false?'loss':'')} style={pos===undefined?{color:'var(--text-muted)'}:{}}>{sub}</p>}
            </div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2 card p-5">
          <p className="text-sm font-semibold mb-4" style={{fontFamily:'Space Grotesk'}}>Performance (90d)</p>
          {chartData.length>1?(
            <ResponsiveContainer width="100%" height={196}>
              <AreaChart data={chartData} margin={{left:-20,right:0,top:4,bottom:0}}>
                <defs><linearGradient id="goldGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#C9A84C" stopOpacity={0.16}/><stop offset="100%" stopColor="#C9A84C" stopOpacity={0}/></linearGradient></defs>
                <XAxis dataKey="date" tick={{fontSize:10,fill:'var(--text-muted)'}} tickLine={false} axisLine={false}/>
                <YAxis tick={{fontSize:10,fill:'var(--text-muted)'}} tickLine={false} axisLine={false} tickFormatter={v=>`$${v>=1000?(v/1000).toFixed(0)+'k':v}`}/>
                <Tooltip content={<CustomTooltip/>}/>
                <Area type="monotone" dataKey="value" stroke="#C9A84C" strokeWidth={1.5} fill="url(#goldGrad)" dot={false}/>
              </AreaChart>
            </ResponsiveContainer>
          ):(
            <div className="h-[196px] flex flex-col items-center justify-center" style={{color:'var(--text-muted)'}}>
              <Zap className="w-5 h-5 mb-2 opacity-30"/><p className="text-xs">Performance data appears after 24h</p>
            </div>
          )}
        </div>
        <div className="card p-5">
          <p className="text-sm font-semibold mb-3" style={{fontFamily:'Space Grotesk'}}>Allocation</p>
          {alloc.length>0?(
            <>
              <ResponsiveContainer width="100%" height={124}>
                <PieChart>
                  <Pie data={alloc} cx="50%" cy="50%" innerRadius={36} outerRadius={58} paddingAngle={2} dataKey="value">
                    {alloc.map((_,i)=><Cell key={i} fill={ALLOC_COLORS[i%ALLOC_COLORS.length]}/>)}
                  </Pie>
                  <Tooltip formatter={(v:any)=>[`$${parseFloat(v).toLocaleString()}`,'']} contentStyle={{background:'var(--bg-elevated)',border:'1px solid var(--gold-border)',borderRadius:10}}/>
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-2">{alloc.map((d,i)=>(
                <div key={d.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full" style={{background:ALLOC_COLORS[i%ALLOC_COLORS.length]}}/><span style={{color:'var(--text-secondary)'}}>{d.name}</span></div>
                  <span className="font-semibold">{total>0?`${((d.value/total)*100).toFixed(1)}%`:'—'}</span>
                </div>
              ))}</div>
            </>
          ):(
            <div className="h-[200px] flex items-center justify-center text-xs" style={{color:'var(--text-muted)'}}>No data</div>
          )}
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="card p-5">
          <p className="text-sm font-semibold mb-4" style={{fontFamily:'Space Grotesk'}}>Top Holdings</p>
          <div className="space-y-3">{topBalances.map((b:any)=>{
            const usd=parseFloat(b.usdValue??0),pct=total>0?(usd/total)*100:0
            return (<div key={`${b.asset}-${b.platform}`} className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0" style={{background:'var(--bg-elevated)',color:'var(--gold)',border:'1px solid var(--gold-border)'}}>{b.asset.slice(0,2)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between text-sm mb-0.5"><span className="font-medium">{b.asset}</span><span className="font-semibold">${usd.toLocaleString('en-US',{maximumFractionDigits:2})}</span></div>
                <div className="flex justify-between text-xs mb-1" style={{color:'var(--text-muted)'}}><span>{b.platform}</span><span>{pct.toFixed(1)}%</span></div>
                <div className="h-0.5 rounded-full overflow-hidden" style={{background:'var(--bg-elevated)'}}><div className="h-full rounded-full" style={{width:`${Math.min(pct,100)}%`,background:'var(--gold)'}}/></div>
              </div>
            </div>)
          })}</div>
        </div>
        <div className="card p-5">
          <p className="text-sm font-semibold mb-4" style={{fontFamily:'Space Grotesk'}}>Open Positions</p>
          {topPositions.length>0?(
            <div className="space-y-2">{topPositions.map((p:any,i:number)=>{
              const pnl=parseFloat(p.pnl)
              return (<div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-xl" style={{background:'var(--bg-elevated)'}}>
                <span className={pnl>=0?'badge-gain':'badge-loss'}>{p.side}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between text-sm"><span className="font-medium">{p.asset}</span><span className={cn('font-semibold text-xs',pnl>=0?'gain':'loss')}>{pnl>=0?'+':''}${Math.abs(pnl).toFixed(2)}</span></div>
                  <p className="text-xs mt-0.5" style={{color:'var(--text-muted)'}}>{p.platform} · {parseFloat(p.pnlPercent).toFixed(2)}%</p>
                </div>
              </div>)
            })}</div>
          ):(<p className="text-xs" style={{color:'var(--text-muted)'}}>No open positions.</p>)}
        </div>
      </div>
      {prices.length>0&&(
        <div className="card p-5">
          <p className="text-sm font-semibold mb-3" style={{fontFamily:'Space Grotesk'}}>Crypto Market</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
            {prices.slice(0,8).map((p:any)=>(
              <div key={p.symbol} className="text-center p-3 rounded-xl" style={{background:'var(--bg-elevated)',border:'1px solid var(--glass-border)'}}>
                <p className="text-xs font-semibold mb-1" style={{color:'var(--text-secondary)'}}>{p.symbol}</p>
                <p className="text-sm font-semibold">${p.price<1?p.price.toFixed(4):p.price.toLocaleString('en-US',{maximumFractionDigits:0})}</p>
                <p className={cn('text-xs font-semibold mt-0.5',p.change24hPercent>=0?'gain':'loss')}>{p.change24hPercent>=0?'+':''}{p.change24hPercent.toFixed(2)}%</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
