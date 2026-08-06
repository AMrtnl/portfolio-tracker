import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useAccounts, useCombinedActivityFeed } from '../../src/api/queries';
import { API_BASE_URL, describeError } from '../../src/api/client';
import { ListRow } from '../../src/components/ListRow';
import { ListGroup, Section } from '../../src/components/Section';
import { ScreenFill, ScreenScroll } from '../../src/components/ScreenScroll';
import {
  ConfigurationNotice,
  EmptyState,
  ErrorState,
  LoadingState,
  WarningBanner,
} from '../../src/components/StateViews';
import { Caption, Display, Mono, Overline } from '../../src/components/Type';
import {
  formatMoney,
  formatQuantity,
  groupByDay,
} from '../../src/lib/format';
import { useRefresh } from '../../src/lib/useRefresh';
import { selectionFeedback } from '../../src/lib/haptics';
import { color, font, radius, space } from '../../src/theme/tokens';
import type { SnapActivityVM, SnapOrderVM } from '../../src/api/types';

type Feed = 'activities' | 'orders';

type ActivityRow = SnapActivityVM & { accountLabel: string };
type OrderRow = SnapOrderVM & { accountLabel: string };

/**
 * Combined orders and activities feed.
 *
 * Day-grouped rows follow Acorns' History screen and Sumeria's transaction list;
 * the Orders / Activity switch mirrors Public's History filters. Orders are shown
 * as records only — this app has no trading surface.
 */
export default function ActivityScreen() {
  const queryClient = useQueryClient();
  const accountsQuery = useAccounts();
  const feed = useCombinedActivityFeed(accountsQuery.data);
  const [tab, setTab] = useState<Feed>('activities');

  const refetchAll = useCallback(async () => {
    await accountsQuery.refetch();
    await queryClient.refetchQueries({ queryKey: ['snaptrade'] });
  }, [accountsQuery, queryClient]);
  const { refreshing, onRefresh } = useRefresh(refetchAll);

  const activityDays = useMemo(
    () =>
      groupByDay(
        [...feed.activities].sort(
          (a, b) => dateValue(b.tradeDate) - dateValue(a.tradeDate),
        ) as ActivityRow[],
        (item) => item.tradeDate ?? item.settlementDate,
      ),
    [feed.activities],
  );

  const orderDays = useMemo(
    () =>
      groupByDay(
        [...feed.orders].sort(
          (a, b) => dateValue(b.timePlaced) - dateValue(a.timePlaced),
        ) as OrderRow[],
        (item) => item.timeExecuted ?? item.timePlaced,
      ),
    [feed.orders],
  );

  if (!API_BASE_URL) {
    return (
      <ScreenFill>
        <ConfigurationNotice />
      </ScreenFill>
    );
  }

  if (accountsQuery.isLoading || (feed.isLoading && feed.sources.length > 0)) {
    return (
      <ScreenFill>
        <LoadingState label="Loading activity…" />
      </ScreenFill>
    );
  }

  if (accountsQuery.isError) {
    return (
      <ScreenFill>
        <ErrorState
          message={describeError(accountsQuery.error)}
          onRetry={() => void accountsQuery.refetch()}
        />
      </ScreenFill>
    );
  }

  const days = tab === 'activities' ? activityDays : orderDays;
  const failureLines = feed.failures.flatMap((failure) =>
    failure.messages.map(
      (message) => `${failure.label}: ${describeError(message)}`,
    ),
  );

  return (
    <ScreenScroll refreshing={refreshing} onRefresh={onRefresh}>
      <View style={styles.header}>
        <Display>Activity</Display>
        <Caption>
          {feed.sources.length === 0
            ? 'Brokerage accounts only'
            : `Last ~90 days across ${feed.sources.length} brokerage account${
                feed.sources.length === 1 ? '' : 's'
              }`}
        </Caption>
      </View>

      {feed.sources.length === 0 ? (
        <EmptyState
          icon="time-outline"
          title="No brokerage accounts"
          message="Orders and activities come from SnapTrade-connected brokerages. Crypto wallets and manual accounts have no transaction feed."
        />
      ) : (
        <>
          <View style={styles.switcher}>
            <SegmentButton
              label={`Activity · ${feed.activities.length}`}
              active={tab === 'activities'}
              onPress={() => setTab('activities')}
            />
            <SegmentButton
              label={`Orders · ${feed.orders.length}`}
              active={tab === 'orders'}
              onPress={() => setTab('orders')}
            />
          </View>

          <WarningBanner
            title="Some accounts didn’t report"
            lines={failureLines}
          />

          {feed.isTotalFailure ? (
            <ErrorState
              title="Activity unavailable"
              message="Every brokerage feed failed. Your server may be missing SnapTrade keys, or the connection needs repair."
              onRetry={() => void refetchAll()}
            />
          ) : days.length === 0 ? (
            <EmptyState
              icon={tab === 'orders' ? 'receipt-outline' : 'swap-vertical-outline'}
              title={tab === 'orders' ? 'No recent orders' : 'No recent activity'}
              message={
                tab === 'orders'
                  ? 'Brokerages report recent orders for roughly the last day.'
                  : 'Trades, dividends and transfers from the last ~90 days appear here.'
              }
            />
          ) : (
            days.map((day) => (
              <Section key={day.key} overline={day.label}>
                <ListGroup>
                  {tab === 'activities'
                    ? (day.items as ActivityRow[]).map((activity, index) => (
                        <ActivityListRow
                          key={activity.id ?? `${day.key}-${index}`}
                          activity={activity}
                        />
                      ))
                    : (day.items as OrderRow[]).map((order, index) => (
                        <OrderListRow
                          key={order.brokerageOrderId ?? `${day.key}-${index}`}
                          order={order}
                        />
                      ))}
                </ListGroup>
              </Section>
            ))
          )}
        </>
      )}
    </ScreenScroll>
  );
}

function ActivityListRow({ activity }: { activity: ActivityRow }) {
  const amount = activity.amount ?? 0;
  const positive = amount >= 0;
  const title = [activity.type, activity.symbol].filter(Boolean).join(' · ') ||
    activity.description ||
    'Activity';

  return (
    <ListRow
      leading={<ActivityGlyph type={activity.type} amount={activity.amount} />}
      title={title}
      subtitle={[
        activity.accountLabel,
        activity.units !== null ? `${formatQuantity(activity.units)} units` : null,
        activity.price !== null
          ? `@ ${formatMoney(activity.price, activity.currency ?? 'USD')}`
          : null,
        activity.fee ? `fee ${formatMoney(activity.fee, activity.currency ?? 'USD')}` : null,
      ]
        .filter(Boolean)
        .join(' · ')}
      trailing={
        activity.amount === null ? (
          <Mono style={styles.muted}>—</Mono>
        ) : (
          <Mono style={{ color: positive ? color.gain : color.foreground }}>
            {formatMoney(amount, activity.currency ?? 'USD', { signed: true })}
          </Mono>
        )
      }
    />
  );
}

function OrderListRow({ order }: { order: OrderRow }) {
  const filled = order.filledQuantity ?? order.totalQuantity;
  const price = order.executionPrice ?? order.limitPrice;
  const currency = order.currency ?? 'USD';

  return (
    <ListRow
      leading={<ActivityGlyph type={order.action} />}
      title={[order.action, order.symbol].filter(Boolean).join(' ') || 'Order'}
      subtitle={[
        order.accountLabel,
        order.orderType,
        filled ? `${formatQuantity(filled)} filled` : null,
      ]
        .filter(Boolean)
        .join(' · ')}
      trailing={
        <>
          <Mono>{price ? formatMoney(price, currency) : '—'}</Mono>
          {order.status ? (
            <Caption style={styles.status}>{order.status}</Caption>
          ) : null}
        </>
      }
    />
  );
}

/**
 * Direction glyph. Cash direction is read from the amount's sign whenever there
 * is one, so the arrow can never disagree with the figure next to it — a BUY
 * moves shares in but cash out. Type matching is only the fallback.
 */
function ActivityGlyph({
  type,
  amount,
}: {
  type?: string | null;
  amount?: number | null;
}) {
  const normalized = (type ?? '').toUpperCase();
  const inbound =
    amount !== null && amount !== undefined && amount !== 0
      ? amount > 0
      : /SELL|DIVIDEND|CONTRIBUTION|DEPOSIT|INTEREST|TRANSFER_IN/.test(normalized);

  return (
    <View style={styles.glyph}>
      <Ionicons
        name={inbound ? 'arrow-down-outline' : 'arrow-up-outline'}
        size={15}
        color={inbound ? color.gain : color.mutedForeground}
      />
    </View>
  );
}

function SegmentButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onPress={() => {
        selectionFeedback();
        onPress();
      }}
      style={({ pressed }) => [
        styles.segment,
        active && styles.segmentActive,
        pressed && styles.segmentPressed,
      ]}
    >
      <Overline style={active ? styles.segmentLabelActive : undefined}>
        {label}
      </Overline>
    </Pressable>
  );
}

function dateValue(iso: string | null | undefined): number {
  const time = iso ? new Date(iso).getTime() : NaN;
  return Number.isFinite(time) ? time : 0;
}

const styles = StyleSheet.create({
  header: { gap: space.xs },
  switcher: {
    flexDirection: 'row',
    gap: space.xs,
    padding: 3,
    borderRadius: radius.md,
    backgroundColor: color.muted,
    marginTop: -space.lg,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 9,
    borderRadius: radius.sm,
  },
  segmentActive: { backgroundColor: color.surface },
  segmentPressed: { opacity: 0.7 },
  segmentLabelActive: { color: color.foreground },
  glyph: {
    width: 30,
    height: 30,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.haze,
  },
  muted: { color: color.mutedForeground },
  status: { fontFamily: font.body, fontSize: 11, textTransform: 'capitalize' },
});
