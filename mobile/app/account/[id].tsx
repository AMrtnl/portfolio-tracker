import { useCallback, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import {
  useAccounts,
  useActivities,
  useOrders,
  usePortfolio,
  useSnapAccountDetail,
} from '../../src/api/queries';
import { describeError } from '../../src/api/client';
import { AllocationBar } from '../../src/components/AllocationBar';
import { Freshness } from '../../src/components/Freshness';
import { ListRow } from '../../src/components/ListRow';
import {
  StatusPill,
  accountStatusPill,
  providerLabel,
} from '../../src/components/Pills';
import { ListGroup, Panel, Section } from '../../src/components/Section';
import { ScreenFill, ScreenScroll } from '../../src/components/ScreenScroll';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  WarningBanner,
} from '../../src/components/StateViews';
import { Body, Caption, Display, Mono, Overline } from '../../src/components/Type';
import {
  formatDate,
  formatMoney,
  formatQuantity,
  relativeTime,
  shortenIdentifier,
  toNumber,
} from '../../src/lib/format';
import { useRefresh } from '../../src/lib/useRefresh';
import { color, font, space } from '../../src/theme/tokens';

/**
 * Account detail.
 *
 * Follows Fidelity's account drill-down: identity and value at the top, then
 * balances, positions and history. Brokerage accounts get their live SnapTrade
 * detail; crypto and manual accounts fall back to the aggregate payload, which is
 * the only place their holdings exist.
 */
export default function AccountDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const accountsQuery = useAccounts();
  const portfolioQuery = usePortfolio();

  const account = useMemo(
    () => accountsQuery.data?.find((candidate) => candidate.id === id),
    [accountsQuery.data, id],
  );

  const isBrokerage = account?.provider === 'snaptrade' && Boolean(account.externalId);
  const externalId = isBrokerage ? account?.externalId : undefined;

  const detailQuery = useSnapAccountDetail(externalId);
  const ordersQuery = useOrders(externalId);
  const activitiesQuery = useActivities(externalId, 50);

  const refetchAll = useCallback(
    () =>
      Promise.all([
        accountsQuery.refetch(),
        portfolioQuery.refetch(),
        externalId ? detailQuery.refetch() : Promise.resolve(null),
        externalId ? ordersQuery.refetch() : Promise.resolve(null),
        externalId ? activitiesQuery.refetch() : Promise.resolve(null),
      ]),
    [accountsQuery, portfolioQuery, detailQuery, ordersQuery, activitiesQuery, externalId],
  );
  const { refreshing, onRefresh } = useRefresh(refetchAll);

  if (accountsQuery.isLoading) {
    return (
      <ScreenFill plain>
        <LoadingState label="Loading account…" />
      </ScreenFill>
    );
  }

  if (!account) {
    return (
      <ScreenFill plain>
        <ErrorState
          title="Account not found"
          message="It may have been removed on the server. Pull to refresh the Accounts tab."
        />
      </ScreenFill>
    );
  }

  const pill = accountStatusPill(account.status, Boolean(account.lastError));
  const detail = detailQuery.data;
  const snapAccount = detail?.account;
  const currency = (snapAccount?.currency ?? account.currency ?? 'USD').toUpperCase();
  const headlineValue =
    snapAccount?.totalValue ?? account.totalValueUsd ?? null;

  const positions = detail?.positions.data ?? [];
  const balances = detail?.balances.data ?? [];
  const orders = ordersQuery.data?.orders ?? [];
  const activities = activitiesQuery.data?.activities ?? [];

  // Crypto and manual accounts only exist in the aggregate payload.
  const localAssets = (portfolioQuery.data?.assets ?? []).filter(
    (asset) => asset.accountId === account.id,
  );
  const localPositions = (portfolioQuery.data?.positions ?? []).filter(
    (position) => position.accountId === account.id,
  );

  const sectionProblems = [
    account.lastError ? `Last sync: ${account.lastError}` : null,
    detail?.balances.error ? `Balances: ${detail.balances.error}` : null,
    detail?.positions.error ? `Positions: ${detail.positions.error}` : null,
    ordersQuery.data?.error ? `Orders: ${ordersQuery.data.error}` : null,
    activitiesQuery.data?.error ? `Activities: ${activitiesQuery.data.error}` : null,
    detailQuery.isError ? `Account detail: ${describeError(detailQuery.error)}` : null,
  ].filter((line): line is string => Boolean(line));

  return (
    <ScreenScroll
      plain
      insideTabs={false}
      headerOffset={44}
      refreshing={refreshing}
      onRefresh={onRefresh}
    >
      <View style={styles.hero}>
        <Overline>{providerLabel(account.provider)}</Overline>
        <Display style={styles.name}>{account.label}</Display>
        <View style={styles.identityRow}>
          <StatusPill label={pill.label} tone={pill.tone} />
          {snapAccount?.isPaper ? (
            <StatusPill label="Paper account" tone="warn" />
          ) : null}
        </View>
        <Caption>
          {[
            snapAccount?.institution ?? account.institution,
            snapAccount?.numberSuffix
              ? `•••• ${snapAccount.numberSuffix}`
              : shortenIdentifier(account.externalId),
            snapAccount?.accountType,
          ]
            .filter(Boolean)
            .join(' · ')}
        </Caption>

        <View style={styles.valueBlock}>
          <Caption>Reported value</Caption>
          <Mono style={styles.value}>
            {headlineValue === null ? '—' : formatMoney(headlineValue, currency)}
          </Mono>
          <Caption>
            Native currency {currency} · synced {relativeTime(account.lastSyncedAt)}
          </Caption>
        </View>
      </View>

      <WarningBanner title="Partial data" lines={sectionProblems} />

      {isBrokerage && detailQuery.isLoading ? <LoadingState label="Loading brokerage detail…" /> : null}

      {snapAccount?.holdingsUnavailable ? (
        <Panel>
          <Body>Holdings unavailable</Body>
          <Caption>
            The brokerage did not return holdings for this account. This is normal
            for some institutions and connection states.
          </Caption>
        </Panel>
      ) : null}

      {balances.length > 0 ? (
        <Section overline="Cash" caption="As reported by the brokerage">
          <ListGroup>
            {balances.map((balance, index) => (
              <ListRow
                key={`${balance.currency}-${index}`}
                title={balance.currency}
                subtitle={
                  balance.buyingPower !== null
                    ? `Buying power ${formatMoney(balance.buyingPower, balance.currency)}`
                    : 'Cash balance'
                }
                trailing={<Mono>{formatMoney(balance.cash, balance.currency)}</Mono>}
              />
            ))}
          </ListGroup>
        </Section>
      ) : null}

      {positions.length > 0 ? (
        <>
          <Section overline="Allocation">
            <AllocationBar
              slices={positions
                .filter((position) => (position.marketValue ?? 0) > 0)
                .map((position) => ({
                  label: position.symbol,
                  value: position.marketValue ?? 0,
                  sublabel: position.name ?? undefined,
                }))}
              currency={currency}
            />
          </Section>

          <Section overline="Positions" caption={`${positions.length} holding${positions.length === 1 ? '' : 's'}`}>
            <ListGroup>
              {positions.map((position, index) => {
                const pnl = position.openPnl;
                return (
                  <ListRow
                    key={`${position.symbol}-${index}`}
                    title={position.symbol}
                    subtitle={[
                      position.name,
                      `${formatQuantity(position.units)} units`,
                      position.averageCost !== null
                        ? `avg ${formatMoney(position.averageCost, position.currency)}`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                    trailing={
                      <>
                        <Mono>
                          {formatMoney(position.marketValue, position.currency)}
                        </Mono>
                        {pnl !== null ? (
                          <Caption
                            style={[
                              styles.pnl,
                              { color: pnl >= 0 ? color.gain : color.loss },
                            ]}
                          >
                            {formatMoney(pnl, position.currency, { signed: true })}
                          </Caption>
                        ) : null}
                      </>
                    }
                  />
                );
              })}
            </ListGroup>
          </Section>
        </>
      ) : null}

      {!isBrokerage && localAssets.length > 0 ? (
        <Section
          overline="Holdings"
          caption="From the latest portfolio sync"
        >
          <ListGroup>
            {localAssets.map((asset, index) => (
              <ListRow
                key={`${asset.asset}-${index}`}
                title={asset.asset}
                subtitle={`${formatQuantity(asset.amount)} · ${asset.chain}`}
                trailing={<Mono>{formatMoney(asset.usdValue, 'USD')}</Mono>}
              />
            ))}
          </ListGroup>
        </Section>
      ) : null}

      {!isBrokerage && localPositions.length > 0 ? (
        <Section overline="Open positions">
          <ListGroup>
            {localPositions.map((position, index) => (
              <ListRow
                key={`${position.asset}-${index}`}
                title={`${position.asset} · ${position.side}`}
                subtitle={`${formatQuantity(position.size)} · ${position.leverage}x ${position.type.toLowerCase()}`}
                trailing={
                  <>
                    <Mono>{formatMoney(position.markPrice, 'USD')}</Mono>
                    <Caption
                      style={[
                        styles.pnl,
                        {
                          color:
                            toNumber(position.pnl) >= 0 ? color.gain : color.loss,
                        },
                      ]}
                    >
                      {formatMoney(position.pnl, 'USD', { signed: true })}
                    </Caption>
                  </>
                }
              />
            ))}
          </ListGroup>
        </Section>
      ) : null}

      {isBrokerage ? (
        <>
          <Section overline="Recent orders" caption="Roughly the last 24 hours">
            {orders.length === 0 ? (
              <EmptyState
                icon="receipt-outline"
                title="No recent orders"
                message="Nothing reported by this brokerage in the recent-orders window."
              />
            ) : (
              <ListGroup>
                {orders.map((order, index) => (
                  <ListRow
                    key={order.brokerageOrderId ?? index}
                    title={[order.action, order.symbol].filter(Boolean).join(' ') || 'Order'}
                    subtitle={[
                      order.status,
                      order.orderType,
                      order.timePlaced ? formatDate(order.timePlaced) : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                    trailing={
                      <Mono>
                        {order.executionPrice ?? order.limitPrice
                          ? formatMoney(
                              order.executionPrice ?? order.limitPrice,
                              order.currency ?? currency,
                            )
                          : '—'}
                      </Mono>
                    }
                  />
                ))}
              </ListGroup>
            )}
          </Section>

          <Section overline="Activity" caption="Last ~90 days">
            {activities.length === 0 ? (
              <EmptyState
                icon="swap-vertical-outline"
                title="No activity"
                message="No trades, dividends or transfers reported in the window."
              />
            ) : (
              <ListGroup>
                {activities.slice(0, 25).map((activity, index) => (
                  <ListRow
                    key={activity.id ?? index}
                    title={
                      [activity.type, activity.symbol].filter(Boolean).join(' · ') ||
                      activity.description ||
                      'Activity'
                    }
                    subtitle={[
                      activity.tradeDate ? formatDate(activity.tradeDate) : null,
                      activity.units !== null
                        ? `${formatQuantity(activity.units)} units`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                    trailing={
                      <Mono>
                        {activity.amount === null
                          ? '—'
                          : formatMoney(
                              activity.amount,
                              activity.currency ?? currency,
                              { signed: true },
                            )}
                      </Mono>
                    }
                  />
                ))}
              </ListGroup>
            )}
          </Section>

          <Freshness
            retrievedAt={detail?.retrievedAt}
            isFetching={detailQuery.isFetching && !refreshing}
            label="Brokerage data retrieved"
          />
        </>
      ) : null}

      {!isBrokerage && localAssets.length === 0 && localPositions.length === 0 ? (
        <EmptyState
          icon="ellipse-outline"
          title="No holdings reported"
          message="This account returned no balances on the last sync."
        />
      ) : null}

      <Caption style={styles.footnote}>
        Read-only view. Orders are shown as records; Meridian cannot place or
        cancel them.
      </Caption>
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  hero: { gap: space.sm },
  name: { fontSize: 28, lineHeight: 33 },
  identityRow: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
  valueBlock: { marginTop: space.lg, gap: 2 },
  value: { fontFamily: font.monoMedium, fontSize: 28, lineHeight: 34 },
  pnl: { fontFamily: font.mono, fontSize: 12 },
  footnote: { fontSize: 12, opacity: 0.8 },
});
