import { useCallback, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  useAccounts,
  useAddManualAccount,
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
import { PressableButton } from '../../src/components/PressableButton';
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
import { color, font, radius, space } from '../../src/theme/tokens';
import type { AccountType, PublicAccount } from '../../src/api/types';
import { isLiability } from '../../src/wealth/classify';
import { usePrivacy } from '../../src/wealth/PrivacyContext';

const GROUP_ORDER: { type: AccountType; label: string }[] = [
  { type: 'estate', label: 'Real estate' },
  { type: 'pension', label: 'Pension' },
  { type: 'broker', label: 'Brokerages' },
  { type: 'crypto_wallet', label: 'Crypto wallets' },
  { type: 'bank', label: 'Banks' },
  { type: 'manual', label: 'Manual' },
  { type: 'loan', label: 'Loans' },
];

type SimpleKind = 'cash' | 'pension' | 'estate' | 'loan';

const SIMPLE: Record<
  SimpleKind,
  { title: string; name: string; inst: string; amount: string }
> = {
  cash: { title: 'Cash', name: 'UBS · Checking', inst: 'UBS', amount: 'Balance' },
  pension: { title: 'Pension', name: 'VIAC · 3a', inst: 'VIAC', amount: 'Current value' },
  estate: { title: 'Property', name: 'Apartment', inst: 'Home', amount: 'Estimated value' },
  loan: { title: 'Loan', name: 'Mortgage', inst: 'Bank', amount: 'Outstanding' },
};

export default function AccountsScreen() {
  const router = useRouter();
  const { hidden } = usePrivacy();
  const accountsQuery = useAccounts();
  const addAccount = useAddManualAccount();
  const snapStatusQuery = useSnapStatus();
  const snapConfigured = snapStatusQuery.data?.configured ?? false;
  const connectionsQuery = useConnections(snapConfigured);
  const [sheet, setSheet] = useState<'chooser' | SimpleKind | null>(null);
  const [label, setLabel] = useState('');
  const [institution, setInstitution] = useState('');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');

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
        <Caption>
          {accounts.length === 0
            ? 'Cash, brokers, crypto, pension, property, and loans'
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
          message="Add cash, a pension, property, or a loan here. Brokerage and Hyperliquid wallets still connect from the web app."
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
                  hidden={hidden}
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

      <PressableButton label="Add account" onPress={() => setSheet('chooser')} fullWidth />

      <AddAccountSheet
        sheet={sheet}
        onClose={() => setSheet(null)}
        onPick={setSheet}
        label={label}
        setLabel={setLabel}
        institution={institution}
        setInstitution={setInstitution}
        amount={amount}
        setAmount={setAmount}
        notes={notes}
        setNotes={setNotes}
        loading={addAccount.isPending}
        onSave={() => {
          if (sheet === 'chooser' || !sheet) return;
          const n = parseFloat(amount);
          if (!label.trim() || !Number.isFinite(n) || n < 0) return;
          addAccount.mutate(
            {
              label: label.trim(),
              institution: institution.trim() || undefined,
              notes: notes.trim() || undefined,
              balance: n,
              currency: 'USD',
              type:
                sheet === 'cash'
                  ? 'bank'
                  : sheet === 'loan'
                    ? 'loan'
                    : sheet === 'pension'
                      ? 'pension'
                      : 'estate',
              kind: sheet === 'loan' ? 'liability' : 'asset',
              bookClass:
                sheet === 'cash'
                  ? 'cash'
                  : sheet === 'pension'
                    ? 'pension'
                    : sheet === 'estate'
                      ? 'estate'
                      : undefined,
            },
            {
              onSuccess: () => {
                setLabel('');
                setInstitution('');
                setAmount('');
                setNotes('');
                setSheet(null);
              },
              onError: (err) => Alert.alert('Couldn’t save', describeError(err)),
            },
          );
        }}
      />
    </ScreenScroll>
  );
}

function AccountRow({
  account,
  onPress,
  hidden,
}: {
  account: PublicAccount;
  onPress: () => void;
  hidden: boolean;
}) {
  const pill = accountStatusPill(account.status, Boolean(account.lastError));
  const identity =
    account.maskedIdentifier ?? shortenIdentifier(account.externalId);
  const institution =
    account.institution && account.institution !== account.label
      ? account.institution
      : account.institution
        ? null
        : providerLabel(account.provider);
  const debt = isLiability(account);
  const value = account.totalValueUsd;

  return (
    <ListRow
      leading={<ProviderGlyph provider={account.provider} />}
      title={account.label}
      subtitle={[
        institution,
        identity || null,
        account.notes,
        `synced ${relativeTime(account.lastSyncedAt)}`,
      ]
        .filter(Boolean)
        .join(' · ')}
      errorText={account.lastError ?? undefined}
      trailing={
        <>
          <Mono style={debt ? { color: color.loss } : undefined}>
            {hidden
              ? '••••••'
              : value === undefined
                ? '—'
                : `${debt ? '−' : ''}${formatMoney(Math.abs(value), account.currency, {
                    compact: true,
                  })}`}
          </Mono>
          <StatusPill label={pill.label} tone={pill.tone} />
        </>
      }
      onPress={onPress}
    />
  );
}

function AddAccountSheet({
  sheet,
  onClose,
  onPick,
  label,
  setLabel,
  institution,
  setInstitution,
  amount,
  setAmount,
  notes,
  setNotes,
  loading,
  onSave,
}: {
  sheet: 'chooser' | SimpleKind | null;
  onClose: () => void;
  onPick: (kind: SimpleKind | 'chooser') => void;
  label: string;
  setLabel: (v: string) => void;
  institution: string;
  setInstitution: (v: string) => void;
  amount: string;
  setAmount: (v: string) => void;
  notes: string;
  setNotes: (v: string) => void;
  loading: boolean;
  onSave: () => void;
}) {
  const copy = sheet && sheet !== 'chooser' ? SIMPLE[sheet] : null;
  return (
    <Modal visible={sheet !== null} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.sheet}>
        {sheet === 'chooser' || !copy ? (
          <>
            <Display>Add account</Display>
            <Caption>Cash, pension, property, and loans. Brokers and wallets still connect from the web.</Caption>
            {(Object.keys(SIMPLE) as SimpleKind[]).map((kind) => (
              <Pressable key={kind} onPress={() => onPick(kind)} style={styles.choice}>
                <Body>{SIMPLE[kind].title}</Body>
                <Ionicons name="chevron-forward" size={16} color={color.mutedForeground} />
              </Pressable>
            ))}
            <PressableButton label="Cancel" variant="quiet" onPress={onClose} fullWidth />
          </>
        ) : (
          <>
            <Display>{copy.title}</Display>
            <TextInput
              value={label}
              onChangeText={setLabel}
              placeholder={copy.name}
              placeholderTextColor={color.mutedForeground}
              style={styles.input}
            />
            <TextInput
              value={institution}
              onChangeText={setInstitution}
              placeholder={copy.inst}
              placeholderTextColor={color.mutedForeground}
              style={styles.input}
            />
            <TextInput
              value={amount}
              onChangeText={setAmount}
              placeholder={copy.amount}
              placeholderTextColor={color.mutedForeground}
              keyboardType="decimal-pad"
              style={styles.input}
            />
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Notes · optional"
              placeholderTextColor={color.mutedForeground}
              style={styles.input}
            />
            <PressableButton
              label={loading ? 'Saving…' : `Save ${copy.title.toLowerCase()}`}
              onPress={onSave}
              loading={loading}
              fullWidth
            />
            <PressableButton label="Back" variant="quiet" onPress={() => onPick('chooser')} fullWidth />
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: { gap: space.xs },
  noticeRow: { flexDirection: 'row', gap: space.md },
  noticeText: { flex: 1, gap: 3 },
  sheet: {
    flex: 1,
    backgroundColor: color.background,
    padding: space['2xl'],
    paddingTop: 28,
    gap: space.md,
  },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
  },
  input: {
    backgroundColor: color.accent,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: color.foreground,
    fontFamily: font.bodySemi,
    fontSize: 16,
  },
});
