import { useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAccounts, usePortfolio } from '../../src/api/queries';
import { API_BASE_URL, describeError } from '../../src/api/client';
import { AllocationBar } from '../../src/components/AllocationBar';
import { ListRow } from '../../src/components/ListRow';
import { ListGroup, Panel, Section } from '../../src/components/Section';
import { ScreenFill, ScreenScroll } from '../../src/components/ScreenScroll';
import {
  ConfigurationNotice,
  EmptyState,
  ErrorState,
  LoadingState,
  WarningBanner,
} from '../../src/components/StateViews';
import { Body, Caption, Display, Mono } from '../../src/components/Type';
import { formatFigure, formatMoney } from '../../src/lib/format';
import {
  allocationByAsset,
  dayChange,
  portfolioCurrency,
  sourceProblems,
} from '../../src/lib/portfolio';
import { accountClass, accountValue, isLiability } from '../../src/wealth/classify';
import { usePrivacy } from '../../src/wealth/PrivacyContext';
import { useRefresh } from '../../src/lib/useRefresh';
import { CLASSES, color, space } from '../../src/theme/tokens';

export default function WealthScreen() {
  const router = useRouter();
  const { hidden } = usePrivacy();
  const accountsQuery = useAccounts();
  const accounts = accountsQuery.data ?? [];
  const hasAccounts = accounts.length > 0;
  const portfolioQuery = usePortfolio(hasAccounts);

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

  if (accountsQuery.isLoading) {
    return (
      <ScreenFill>
        <LoadingState label="Loading accounts…" />
      </ScreenFill>
    );
  }

  const assets = accounts.filter((a) => !isLiability(a));
  const loans = accounts.filter(isLiability);
  const gross = assets.reduce((s, a) => s + accountValue(a), 0);
  const debt = loans.reduce((s, a) => s + accountValue(a), 0);
  const net = gross - debt;
  const currency = portfolioCurrency(portfolioQuery.data) || 'USD';
  const day = dayChange(portfolioQuery.data);
  const problems = sourceProblems(portfolioQuery.data);

  if (!hasAccounts) {
    return (
      <ScreenScroll refreshing={refreshing} onRefresh={onRefresh}>
        <View style={styles.hero}>
          <Caption>Net worth</Caption>
          <Display style={styles.heroValue}>
            <Caption style={styles.unit}>USD </Caption>
            {formatFigure(0, { hidden })}
          </Display>
          <Caption>Add what you own and what you owe</Caption>
        </View>
        <EmptyState
          icon="wallet-outline"
          title="Your book is empty"
          message="Cash, brokers, crypto, pension, property, and loans. Add them on Accounts — cash flow and subscriptions work immediately."
        />
        <Pressable
          onPress={() => router.push('/(tabs)/accounts')}
          style={styles.add}
          accessibilityRole="button"
        >
          <Ionicons name="add" size={18} color={color.primary} />
          <Body style={styles.addLabel}>Add account</Body>
        </Pressable>
      </ScreenScroll>
    );
  }

  if (portfolioQuery.isLoading && !portfolioQuery.data) {
    return (
      <ScreenFill>
        <LoadingState />
      </ScreenFill>
    );
  }

  if (portfolioQuery.isError && !portfolioQuery.data) {
    const message = describeError(portfolioQuery.error);
    const noAccounts = message.toLowerCase().includes('no accounts');
    if (!noAccounts) {
      return (
        <ScreenFill>
          <ErrorState
            title="Couldn’t load wealth"
            message={message}
            onRetry={() => void portfolioQuery.refetch()}
          />
        </ScreenFill>
      );
    }
  }

  const allocation = allocationByAsset(portfolioQuery.data);

  return (
    <ScreenScroll refreshing={refreshing} onRefresh={onRefresh}>
      <View style={styles.hero}>
        <Caption>Net worth</Caption>
        <Display style={styles.heroValue}>
          <Caption style={styles.unit}>{currency} </Caption>
          {formatFigure(net, { hidden })}
        </Display>
        <Mono
          style={[
            styles.day,
            { color: day.positive ? color.gain : color.loss },
          ]}
        >
          {hidden ? '••' : formatFigure(day.amount, { signed: true })} today
        </Mono>
      </View>

      <View style={styles.stats}>
        <View style={styles.stat}>
          <Caption>Assets</Caption>
          <Mono style={styles.statVal}>
            {hidden ? '••••••' : formatMoney(gross, currency, { compact: true })}
          </Mono>
        </View>
        <View style={styles.stat}>
          <Caption>Debt</Caption>
          <Mono style={[styles.statVal, { color: debt ? color.loss : color.foreground }]}>
            {hidden
              ? '••••••'
              : debt
                ? `−${formatMoney(debt, currency, { compact: true })}`
                : formatMoney(0, currency, { compact: true })}
          </Mono>
        </View>
        <View style={styles.stat}>
          <Caption>Today</Caption>
          <Mono
            style={[
              styles.statVal,
              { color: day.positive ? color.gain : color.loss },
            ]}
          >
            {hidden ? '••' : formatFigure(day.amount, { signed: true })}
          </Mono>
        </View>
      </View>

      <WarningBanner title="Some sources reported problems" lines={problems} />

      {allocation.length > 0 ? (
        <Section overline="Holdings" title="What you own">
          <AllocationBar slices={allocation} currency={currency} />
        </Section>
      ) : null}

      {CLASSES.map((c) => {
        const rows = assets.filter((a) => accountClass(a) === c.id);
        if (!rows.length) return null;
        const sum = rows.reduce((s, a) => s + accountValue(a), 0);
        return (
          <Section key={c.id} overline={c.name} caption={`${rows.length} account${rows.length === 1 ? '' : 's'}`}>
            <Panel>
              <View style={styles.classHead}>
                <View style={[styles.dot, { backgroundColor: c.color }]} />
                <Mono style={styles.classSum}>
                  {hidden ? '••••••' : formatMoney(sum, currency, { compact: true })}
                </Mono>
              </View>
              <ListGroup>
                {rows.map((a) => (
                  <ListRow
                    key={a.id}
                    title={a.label}
                    subtitle={a.notes || a.institution || a.type}
                    trailing={
                      <Mono>
                        {hidden
                          ? '••••••'
                          : formatMoney(accountValue(a), a.currency || currency, {
                              compact: true,
                            })}
                      </Mono>
                    }
                    onPress={() => router.push(`/account/${a.id}`)}
                  />
                ))}
              </ListGroup>
            </Panel>
          </Section>
        );
      })}

      {loans.length > 0 ? (
        <Section overline="Liabilities" title="Loans">
          <Panel>
            <ListGroup>
              {loans.map((l) => (
                <ListRow
                  key={l.id}
                  title={l.label}
                  subtitle={l.notes || l.institution || 'Loan'}
                  trailing={
                    <Mono style={{ color: color.loss }}>
                      {hidden
                        ? '••••••'
                        : `−${formatMoney(accountValue(l), l.currency || currency, { compact: true })}`}
                    </Mono>
                  }
                  onPress={() => router.push(`/account/${l.id}`)}
                />
              ))}
            </ListGroup>
          </Panel>
        </Section>
      ) : null}

      <Pressable
        onPress={() => router.push('/(tabs)/accounts')}
        style={styles.add}
        accessibilityRole="button"
      >
        <Ionicons name="add" size={18} color={color.primary} />
        <Body style={styles.addLabel}>Add account</Body>
      </Pressable>
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  hero: { gap: 6 },
  heroValue: { fontSize: 40, lineHeight: 46 },
  unit: { fontSize: 15, letterSpacing: 0.4 },
  day: { marginTop: 4, fontSize: 15 },
  stats: { flexDirection: 'row', gap: 8 },
  stat: {
    flex: 1,
    gap: 6,
    backgroundColor: color.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
    borderRadius: 20,
    padding: 13,
  },
  statVal: { fontSize: 15 },
  classHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  classSum: { fontSize: 15 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  add: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(10,132,255,0.14)',
  },
  addLabel: { color: color.primary, fontSize: 16 },
});
