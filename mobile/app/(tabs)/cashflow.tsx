import { useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import {
  useAddTransaction,
  useCashflow,
  useDeleteTransaction,
  useTransactions,
} from '../../src/api/queries';
import { API_BASE_URL, describeError } from '../../src/api/client';
import { ListRow } from '../../src/components/ListRow';
import { PressableButton } from '../../src/components/PressableButton';
import { ListGroup, Panel, Section } from '../../src/components/Section';
import { ScreenFill, ScreenScroll } from '../../src/components/ScreenScroll';
import {
  ConfigurationNotice,
  EmptyState,
  LoadingState,
} from '../../src/components/StateViews';
import { Body, Caption, Display, Mono } from '../../src/components/Type';
import { formatFigure, formatMoney } from '../../src/lib/format';
import { usePrivacy } from '../../src/wealth/PrivacyContext';
import { color, font, radius, space } from '../../src/theme/tokens';
import type { TxKind } from '../../src/api/types';

const SPEND_CATS = [
  { id: 'housing', name: 'Housing' },
  { id: 'insurance', name: 'Insurance' },
  { id: 'groceries', name: 'Groceries' },
  { id: 'subscriptions', name: 'Subscriptions' },
  { id: 'transport', name: 'Transport' },
  { id: 'leisure', name: 'Leisure' },
  { id: 'other', name: 'Other' },
];
const INCOME_CATS = [
  { id: 'salary', name: 'Salary' },
  { id: 'bonus', name: 'Bonus' },
  { id: 'other-income', name: 'Other' },
];

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function CashflowScreen() {
  const { hidden } = usePrivacy();
  const cashflow = useCashflow(6);
  const txs = useTransactions();
  const addTx = useAddTransaction();
  const delTx = useDeleteTransaction();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<TxKind>('spend');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('groceries');
  const [note, setNote] = useState('');

  const months = cashflow.data?.months ?? [];
  const month = months[months.length - 1];
  const prev = months[months.length - 2];
  const saved = month ? month.income - month.spend : 0;
  const rate = month && month.income > 0 ? (saved / month.income) * 100 : 0;
  const cats = cashflow.data?.categories ?? [];
  const spendTotal = cats.reduce((s, c) => s + c.amount, 0);
  const recent = (txs.data ?? []).slice(0, 8);
  const catList = kind === 'income' ? INCOME_CATS : SPEND_CATS;

  const bars = useMemo(() => {
    const max = Math.max(...months.map((m) => Math.max(m.income, m.spend)), 1);
    return months.map((m) => ({
      ...m,
      incomeH: Math.max(4, (m.income / max) * 88),
      spendH: Math.max(4, (m.spend / max) * 88),
    }));
  }, [months]);

  if (!API_BASE_URL) {
    return (
      <ScreenFill>
        <ConfigurationNotice />
      </ScreenFill>
    );
  }

  if (cashflow.isLoading) {
    return (
      <ScreenFill>
        <LoadingState label="Loading cash flow…" />
      </ScreenFill>
    );
  }

  function submit() {
    const n = parseFloat(amount);
    if (!Number.isFinite(n) || n <= 0) return;
    addTx.mutate(
      { date: todayIso(), kind, amount: n, category, note: note.trim() || undefined },
      {
        onSuccess: () => {
          setAmount('');
          setNote('');
          setOpen(false);
        },
        onError: (err) => Alert.alert('Couldn’t save', describeError(err)),
      },
    );
  }

  return (
    <ScreenScroll
      refreshing={cashflow.isFetching}
      onRefresh={() => void Promise.all([cashflow.refetch(), txs.refetch()])}
    >
      <View style={styles.hero}>
        <Caption>
          {month ? `${month.label} · Saved this month` : 'Saved this month'}
        </Caption>
        <Display style={styles.heroValue}>
          <Caption style={styles.unit}>USD </Caption>
          {formatFigure(saved, { hidden })}
        </Display>
        <Caption>
          {month?.income
            ? `${rate.toFixed(1)}% savings rate`
            : 'Log income and spending to see your rate'}
        </Caption>
      </View>

      {cashflow.data?.hasActivity ? (
        <Panel>
          <View style={styles.chart}>
            {bars.map((m) => (
              <View key={m.key} style={styles.col}>
                <View style={styles.colBars}>
                  <View
                    style={[
                      styles.bar,
                      { height: m.incomeH, backgroundColor: color.gain },
                    ]}
                  />
                  <View
                    style={[
                      styles.bar,
                      { height: m.spendH, backgroundColor: color.loss },
                    ]}
                  />
                </View>
                <Caption>{m.label}</Caption>
              </View>
            ))}
          </View>
        </Panel>
      ) : (
        <EmptyState
          icon="swap-horizontal-outline"
          title="No cash flow yet"
          message="Add a salary deposit or a grocery run and the bars fill in from there."
        />
      )}

      <View style={styles.stats}>
        <View style={styles.stat}>
          <Caption>Income</Caption>
          <Mono style={{ color: color.gain }}>
            {formatFigure(month?.income ?? 0, { hidden })}
          </Mono>
        </View>
        <View style={styles.stat}>
          <Caption>Spent</Caption>
          <Mono style={{ color: color.loss }}>
            {formatFigure(month?.spend ?? 0, { hidden })}
          </Mono>
        </View>
        <View style={styles.stat}>
          <Caption>vs. prev</Caption>
          <Mono>
            {prev
              ? formatFigure((month?.spend ?? 0) - prev.spend, {
                  hidden,
                  signed: true,
                })
              : '—'}
          </Mono>
        </View>
      </View>

      {spendTotal > 0 ? (
        <Section overline="Where it goes">
          <Panel>
            {cats.map((c) => (
              <View key={c.id} style={styles.catRow}>
                <View style={[styles.dot, { backgroundColor: c.color }]} />
                <Body style={styles.catName}>{c.name}</Body>
                <View style={styles.catTrack}>
                  <View
                    style={[
                      styles.catFill,
                      {
                        width: `${(c.amount / spendTotal) * 100}%`,
                        backgroundColor: c.color,
                      },
                    ]}
                  />
                </View>
                <Mono>{hidden ? '••••' : formatMoney(c.amount, 'USD', { compact: true })}</Mono>
              </View>
            ))}
          </Panel>
        </Section>
      ) : null}

      {recent.length > 0 ? (
        <Section overline="Recent">
          <ListGroup>
            {recent.map((t) => (
              <ListRow
                key={t.id}
                title={t.note || t.category}
                subtitle={`${t.date} · ${t.category}`}
                trailing={
                  <Mono style={{ color: t.kind === 'income' ? color.gain : color.loss }}>
                    {hidden
                      ? '••••'
                      : `${t.kind === 'income' ? '+' : '−'}${formatFigure(t.amount)}`}
                  </Mono>
                }
                onPress={() =>
                  Alert.alert('Delete transaction?', t.note || t.category, [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Delete',
                      style: 'destructive',
                      onPress: () => delTx.mutate(t.id),
                    },
                  ])
                }
              />
            ))}
          </ListGroup>
        </Section>
      ) : null}

      <PressableButton label="Add transaction" onPress={() => setOpen(true)} fullWidth />

      <Modal visible={open} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.sheet}>
          <Display>Add transaction</Display>
          <View style={styles.seg}>
            {(['spend', 'income'] as const).map((k) => (
              <Pressable
                key={k}
                onPress={() => {
                  setKind(k);
                  setCategory(k === 'income' ? 'salary' : 'groceries');
                }}
                style={[styles.segBtn, kind === k && styles.segOn]}
              >
                <Body style={kind === k ? styles.segOnText : undefined}>
                  {k === 'spend' ? 'Spend' : 'Income'}
                </Body>
              </Pressable>
            ))}
          </View>
          <TextInput
            value={amount}
            onChangeText={setAmount}
            placeholder="Amount"
            placeholderTextColor={color.mutedForeground}
            keyboardType="decimal-pad"
            style={styles.input}
          />
          <View style={styles.chips}>
            {catList.map((c) => (
              <Pressable
                key={c.id}
                onPress={() => setCategory(c.id)}
                style={[styles.chip, category === c.id && styles.chipOn]}
              >
                <Caption style={category === c.id ? { color: color.foreground } : undefined}>
                  {c.name}
                </Caption>
              </Pressable>
            ))}
          </View>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Note · optional"
            placeholderTextColor={color.mutedForeground}
            style={styles.input}
          />
          <PressableButton
            label={addTx.isPending ? 'Saving…' : kind === 'income' ? 'Add income' : 'Add spend'}
            onPress={submit}
            loading={addTx.isPending}
            fullWidth
          />
          <PressableButton label="Cancel" variant="quiet" onPress={() => setOpen(false)} fullWidth />
        </View>
      </Modal>
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  hero: { gap: 6 },
  heroValue: { fontSize: 40, lineHeight: 46 },
  unit: { fontSize: 15 },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: 120, paddingTop: 8 },
  col: { flex: 1, alignItems: 'center', gap: 6 },
  colBars: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 92 },
  bar: { width: 10, borderRadius: 4 },
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
  catRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  catName: { width: 92 },
  catTrack: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  catFill: { height: 4, borderRadius: 2 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  sheet: {
    flex: 1,
    backgroundColor: color.background,
    padding: space['2xl'],
    paddingTop: 28,
    gap: space.md,
  },
  seg: {
    flexDirection: 'row',
    backgroundColor: color.muted,
    borderRadius: radius.pill,
    padding: 3,
  },
  segBtn: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: radius.pill },
  segOn: { backgroundColor: 'rgba(255,255,255,0.14)' },
  segOnText: { color: color.foreground },
  input: {
    backgroundColor: color.accent,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: color.foreground,
    fontFamily: font.bodySemi,
    fontSize: 16,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: color.muted,
  },
  chipOn: { backgroundColor: 'rgba(10,132,255,0.28)' },
});
