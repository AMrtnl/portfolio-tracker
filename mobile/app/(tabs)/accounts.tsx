import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  useAccounts,
  useConnections,
  useSnapStatus,
} from '../../src/api/queries';
import { API_BASE_URL, describeError } from '../../src/api/client';
import { Freshness } from '../../src/components/Freshness';
import { ListRow } from '../../src/components/ListRow';
import {
  ProviderGlyph,
  StatusPill,
  accountStatusPill,
  providerLabel,
} from '../../src/components/Pills';
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
import {
  formatMoney,
  relativeTime,
  shortenIdentifier,
} from '../../src/lib/format';
import { useRefresh } from '../../src/lib/useRefresh';
import { color, space } from '../../src/theme/tokens';
import type { AccountType, PublicAccount } from '../../src/api/types';

const GROUP_ORDER: { type: AccountType; label: string }[] = [
  { type: 'broker', label: 'Brokerages' },
  { type: 'crypto_wallet', label: 'Crypto wallets' },
  { type: 'bank', label: 'Banks' },
  { type: 'manual', label: 'Manual' },
];

/**
 * Accounts, grouped by kind with a freshness line per row.
 *
 * Modelled on Wealthfront's linked-accounts list (institution glyph, masked
 * number, per-row sync age) and Copilot Money's grouped account sections. Adding
 * or removing an account stays in the web app — this screen is read-only.
 */
export default function AccountsScreen() {
  const router = useRouter();
  const accountsQuery = useAccounts();
  const snapStatusQuery = useSnapStatus();
  const snapConfigured = snapStatusQuery.data?.configured ?? false;
  const connectionsQuery = useConnections(snapConfigured);

  const refetchAll = useCallback(
    () =>
      Promise.all([
        accountsQuery.refetch(),
        snapStatusQuery.refetch(),
        snapConfigured ? connectionsQuery.refetch() : Promise.resolve(null),
      ]),
    [accountsQuery, snapStatusQuery, connectionsQuery, snapConfigured],
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

  if (accountsQuery.isError) {
    return (
      <ScreenFill>
        <ErrorState
          title="Couldn’t load accounts"
          message={describeError(accountsQuery.error)}
          onRetry={() => void accountsQuery.refetch()}
        />
      </ScreenFill>
    );
  }

  const accounts = accountsQuery.data ?? [];
  const connections = connectionsQuery.data?.connections ?? [];
  const disabledConnections = connections.filter((connection) => connection.disabled);

  const groups = GROUP_ORDER.map((group) => ({
    ...group,
    accounts: accounts.filter((account) => account.type === group.type),
  })).filter((group) => group.accounts.length > 0);

  return (
    <ScreenScroll refreshing={refreshing} onRefresh={onRefresh}>
      <View style={styles.header}>
        <Display>Accounts</Display>
        <Caption>
          {accounts.length === 0
            ? 'Nothing connected yet'
            : `${accounts.length} connected · ${
                accounts.filter((account) => account.status === 'connected').length
              } healthy`}
        </Caption>
      </View>

      <WarningBanner
        title="Connections need repair"
        lines={disabledConnections.map(
          (connection) =>
            `${connection.brokerageName} was disabled${
              connection.disabledDate
                ? ` ${relativeTime(connection.disabledDate)}`
                : ''
            } — reconnect it in the Meridian web app.`,
        )}
      />

      {snapStatusQuery.data && !snapStatusQuery.data.configured ? (
        <Panel>
          <View style={styles.noticeRow}>
            <Ionicons name="information-circle-outline" size={18} color={color.primary} />
            <View style={styles.noticeText}>
              <Body>Brokerage sync is off</Body>
              <Caption>
                Your server has no SnapTrade key configured, so only crypto and
                manual accounts appear. Keys stay on the server — never in this app.
              </Caption>
            </View>
          </View>
        </Panel>
      ) : null}

      {accounts.length === 0 ? (
        <EmptyState
          icon="wallet-outline"
          title="No accounts connected"
          message="Add a brokerage, crypto wallet or manual account from the Meridian web app, then pull to refresh."
        />
      ) : (
        groups.map((group) => (
          <Section
            key={group.type}
            overline={group.label}
            caption={`${group.accounts.length} account${
              group.accounts.length === 1 ? '' : 's'
            }`}
          >
            <ListGroup>
              {group.accounts.map((account) => (
                <AccountRow
                  key={account.id}
                  account={account}
                  onPress={() => router.push(`/account/${account.id}`)}
                />
              ))}
            </ListGroup>
          </Section>
        ))
      )}

      {snapConfigured && connections.length > 0 ? (
        <Section
          overline="Connection health"
          caption="Brokerage authorizations held by your server"
        >
          <ListGroup>
            {connections.map((connection) => (
              <ListRow
                key={connection.id}
                title={connection.brokerageName}
                subtitle={[
                  connection.type,
                  connection.dataFreshnessMode,
                  connection.createdDate
                    ? `linked ${relativeTime(connection.createdDate)}`
                    : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
                trailing={
                  <StatusPill
                    label={connection.disabled ? 'Disabled' : 'Active'}
                    tone={connection.disabled ? 'bad' : 'ok'}
                  />
                }
              />
            ))}
          </ListGroup>
          <Freshness
            retrievedAt={connectionsQuery.data?.retrievedAt}
            isFetching={connectionsQuery.isFetching && !refreshing}
            label="Checked"
          />
        </Section>
      ) : null}
    </ScreenScroll>
  );
}

function AccountRow({
  account,
  onPress,
}: {
  account: PublicAccount;
  onPress: () => void;
}) {
  const pill = accountStatusPill(account.status, Boolean(account.lastError));
  const identity =
    account.maskedIdentifier ?? shortenIdentifier(account.externalId);
  // Brokerage labels are usually the institution name already, and repeating it
  // pushes the sync age off the end of the line.
  const institution =
    account.institution && account.institution !== account.label
      ? account.institution
      : account.institution
        ? null
        : providerLabel(account.provider);

  return (
    <ListRow
      leading={<ProviderGlyph provider={account.provider} />}
      title={account.label}
      subtitle={[
        institution,
        identity || null,
        `synced ${relativeTime(account.lastSyncedAt)}`,
      ]
        .filter(Boolean)
        .join(' · ')}
      errorText={account.lastError ?? undefined}
      trailing={
        <>
          <Mono>
            {account.totalValueUsd === undefined
              ? '—'
              : formatMoney(account.totalValueUsd, account.currency, {
                  compact: true,
                })}
          </Mono>
          <StatusPill label={pill.label} tone={pill.tone} />
        </>
      }
      onPress={onPress}
    />
  );
}

const styles = StyleSheet.create({
  header: { gap: space.xs },
  noticeRow: { flexDirection: 'row', gap: space.md },
  noticeText: { flex: 1, gap: 3 },
});
