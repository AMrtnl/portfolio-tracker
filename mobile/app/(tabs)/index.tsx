import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAccounts, usePortfolio } from '../../src/api/queries';
import { API_BASE_URL, describeError } from '../../src/api/client';
import { AllocationBar } from '../../src/components/AllocationBar';
import { AnimatedMoney } from '../../src/components/AnimatedMoney';
import { Freshness } from '../../src/components/Freshness';
import { HeroCurve } from '../../src/components/HeroCurve';
import { ListRow } from '../../src/components/ListRow';
import { DeltaPill, ProviderGlyph } from '../../src/components/Pills';
import { ListGroup, Section } from '../../src/components/Section';
import { ScreenFill, ScreenScroll } from '../../src/components/ScreenScroll';
import {
  ConfigurationNotice,
  EmptyState,
  ErrorState,
  LoadingState,
  WarningBanner,
} from '../../src/components/StateViews';
import { Caption, Mono, Overline } from '../../src/components/Type';
import { formatMoney, formatPercent } from '../../src/lib/format';
import {
  allocationByAsset,
  dayChange,
  mixedCurrencies,
  portfolioCurrency,
  sourceProblems,
} from '../../src/lib/portfolio';
import { useRefresh } from '../../src/lib/useRefresh';
import { color, space } from '../../src/theme/tokens';
import type { ProviderId } from '../../src/api/types';

/**
 * Portfolio home.
 *
 * Layout borrows from Yahoo Finance (large value with the day move stacked
 * directly beneath and an explicit refresh timestamp) and Origin (overline label
 * above the total, allocation as its own block). The hero is deliberately
 * unboxed — no card — so nothing competes with the number.
 */
export default function PortfolioScreen() {
  const router = useRouter();
  const portfolioQuery = usePortfolio();
  const accountsQuery = useAccounts();

  const refetchAll = useCallback(
    () => Promise.all([portfolioQuery.refetch(), accountsQuery.refetch()]),
    [portfolioQuery, accountsQuery],
  );
  const { refreshing, onRefresh } = useRefresh(refetchAll);

  if (!API_BASE_URL) {
    return (
      <ScreenFill>
        <ConfigurationNotice />
      </ScreenFill>
    );
  }

  if (portfolioQuery.isLoading) {
    return (
      <ScreenFill>
        <LoadingState />
      </ScreenFill>
    );
  }

  const portfolio = portfolioQuery.data;

  if (portfolioQuery.isError || !portfolio) {
    // 503 from /api/portfolio specifically means "no accounts configured", which
    // is an empty state rather than a failure.
    const message = describeError(portfolioQuery.error);
    const noAccounts = message.toLowerCase().includes('no accounts');
    return (
      <ScreenFill>
        {noAccounts ? (
          <View style={styles.emptyWrap}>
            <EmptyState
              icon="wallet-outline"
              title="No accounts yet"
              message="Connect a brokerage, crypto wallet or manual account in the Meridian web app, then pull to refresh here."
            />
          </View>
        ) : (
          <ErrorState
            title="Couldn’t load portfolio"
            message={message}
            hint="Meridian only talks to your own backend, so this usually means the server is asleep or unreachable."
            onRetry={() => void portfolioQuery.refetch()}
          />
        )}
      </ScreenFill>
    );
  }

  const currency = portfolioCurrency(portfolio);
  const day = dayChange(portfolio);
  const accounts = accountsQuery.data;
  const foreign = mixedCurrencies(accounts, currency);
  const allocation = allocationByAsset(portfolio);
  const problems = sourceProblems(portfolio);
  const sources = [...(portfolio.sources ?? [])].sort(
    (a, b) => b.valueUsd - a.valueUsd,
  );

  return (
    <ScreenScroll refreshing={refreshing} onRefresh={onRefresh}>
      <View style={styles.hero}>
        <Overline>Portfolio</Overline>
        <Caption style={styles.heroLabel}>
          Total value
          {accounts?.length
            ? ` · ${accounts.length} account${accounts.length === 1 ? '' : 's'}`
            : ''}
        </Caption>
        <AnimatedMoney value={day.total} currency={currency} />

        <View style={styles.dayRow}>
          <Ionicons
            name={day.positive ? 'arrow-up' : 'arrow-down'}
            size={15}
            color={day.positive ? color.gain : color.loss}
          />
          <Mono
            style={[
              styles.dayAmount,
              { color: day.positive ? color.gain : color.loss },
            ]}
          >
            {formatMoney(day.amount, currency, { signed: true })}
          </Mono>
          <Mono
            style={[
              styles.dayPercent,
              { color: day.positive ? color.gain : color.loss },
            ]}
          >
            ({formatPercent(day.percent)})
          </Mono>
          <Caption>today</Caption>
        </View>

        <HeroCurve up={day.positive} bleed={space['2xl']} />
      </View>

      <View style={styles.metaBlock}>
        <Freshness
          retrievedAt={portfolio.lastUpdated}
          isFetching={portfolioQuery.isFetching && !refreshing}
        />
        {foreign.length > 0 ? (
          <Caption style={styles.currencyNote}>
            Totals are summed in {currency}. Accounts reporting{' '}
            {foreign.join(', ')} are not FX-converted yet — open an account for its
            native figures.
          </Caption>
        ) : null}
      </View>

      <WarningBanner title="Some sources reported problems" lines={problems} />

      <Section overline="Performance">
        <View style={styles.performance}>
          {(
            [
              ['24h', portfolio.pnl24h],
              ['7d', portfolio.pnl7d],
              ['30d', portfolio.pnl30d],
            ] as const
          ).map(([label, value]) => (
            <View key={label} style={styles.performanceCell}>
              <Overline>{label}</Overline>
              <DeltaPill value={Number(value) || 0} style={styles.performancePill} />
            </View>
          ))}
        </View>
        <Caption style={styles.performanceNote}>
          Value-weighted across sources that report performance.
        </Caption>
      </Section>

      <Section overline="Allocation" title="What you hold">
        <AllocationBar slices={allocation} currency={currency} />
      </Section>

      {sources.length > 0 ? (
        <Section
          overline="Sources"
          title="Where it sits"
          action={{ label: 'Accounts', onPress: () => router.push('/(tabs)/accounts') }}
        >
          <ListGroup>
            {sources.map((source) => (
              <ListRow
                key={source.accountId}
                leading={<ProviderGlyph provider={source.provider as ProviderId} />}
                title={source.label}
                subtitle={source.provider}
                errorText={source.error}
                trailing={
                  <Mono
                    style={source.status === 'error' ? styles.sourceError : undefined}
                  >
                    {formatMoney(source.valueUsd, currency)}
                  </Mono>
                }
                onPress={
                  source.accountId === 'unknown'
                    ? undefined
                    : () => router.push(`/account/${source.accountId}`)
                }
              />
            ))}
          </ListGroup>
        </Section>
      ) : null}

      <View style={styles.disclosure}>
        <Ionicons name="lock-closed-outline" size={13} color={color.mutedForeground} />
        <Caption style={styles.disclosureText}>
          Read-only. Meridian never places orders and holds no brokerage
          credentials on this device.
        </Caption>
      </View>
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  hero: { gap: space.xs },
  heroLabel: { marginTop: space.sm },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: space.md,
    flexWrap: 'wrap',
  },
  dayAmount: { fontSize: 17 },
  dayPercent: { fontSize: 15, opacity: 0.9 },
  metaBlock: { gap: space.sm, marginTop: -space.xl },
  currencyNote: { fontSize: 12, lineHeight: 17 },
  performance: { flexDirection: 'row', gap: space['3xl'] },
  performanceCell: { gap: space.sm },
  performancePill: { marginTop: 2 },
  performanceNote: { fontSize: 12 },
  sourceError: { color: color.loss },
  emptyWrap: { flex: 1, justifyContent: 'center' },
  disclosure: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' },
  disclosureText: { flex: 1, fontSize: 12, lineHeight: 17, opacity: 0.85 },
});
