import { useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  useAddSubscription,
  useDeleteSubscription,
  useSubscriptions,
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
import {
  MONTHS,
  WEEKDAYS,
  chargeDay,
  monthGrid,
  monthlyEquivalent,
} from '../../src/wealth/calendar';
import { usePrivacy } from '../../src/wealth/PrivacyContext';
import { color, font, radius, space } from '../../src/theme/tokens';
import type { BillingCycle } from '../../src/api/types';

const SUB_CATS = [
  { id: 'essentials', name: 'Essentials', color: '#4BD57E' },
  { id: 'telecom', name: 'Telecom', color: '#3ABEFF' },
  { id: 'transport', name: 'Transport', color: '#FFD84D' },
  { id: 'software', name: 'Software', color: '#A57BFF' },
  { id: 'media', name: 'Media', color: '#FF5C48' },
  { id: 'home', name: 'Home', color: '#FF9F45' },
];

function catOf(id?: string) {
  return SUB_CATS.find((c) => c.id === id) ?? SUB_CATS[0];
}

export default function SubscriptionsScreen() {
  const { hidden } = usePrivacy();
  const query = useSubscriptions();
  const addSub = useAddSubscription();
  const delSub = useDeleteSubscription();
  const subs = query.data?.subscriptions ?? [];
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selDay, setSelDay] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [plan, setPlan] = useState('');
  const [amount, setAmount] = useState('');
  const [cycle, setCycle] = useState<BillingCycle>('monthly');
  const [day, setDay] = useState(String(today.getDate()));
  const [cat, setCat] = useState('essentials');

  const step = (dir: number) => {
    setSelDay(null);
    let m = month + dir;
    let y = year;
    if (m < 0) {
      m = 11;
      y -= 1;
    }
    if (m > 11) {
      m = 0;
      y += 1;
    }
    setMonth(m);
    setYear(y);
  };

  const byDay = useMemo(() => {
    const map: Record<number, typeof subs> = {};
    for (const s of subs) {
      const d = chargeDay(s, year, month);
      if (d) (map[d] = map[d] || []).push(s);
    }
    return map;
  }, [subs, year, month]);

  const monthCharges = Object.values(byDay).flat();
  const monthTotal = monthCharges.reduce((s, x) => s + x.amount, 0);
  const monthlyRun = subs.reduce((s, x) => s + monthlyEquivalent(x), 0);
  const grid = useMemo(() => monthGrid(year, month), [year, month]);
  const isThisMonth = year === today.getFullYear() && month === today.getMonth();
  const sorted = [...subs].sort((a, b) => monthlyEquivalent(b) - monthlyEquivalent(a));

  if (!API_BASE_URL) {
    return (
      <ScreenFill>
        <ConfigurationNotice />
      </ScreenFill>
    );
  }

  if (query.isLoading) {
    return (
      <ScreenFill>
        <LoadingState label="Loading subscriptions…" />
      </ScreenFill>
    );
  }

  function submit() {
    const n = parseFloat(amount);
    const d = parseInt(day, 10);
    if (!name.trim() || !Number.isFinite(n) || n <= 0 || !Number.isFinite(d)) return;
    addSub.mutate(
      {
        name: name.trim(),
        plan: plan.trim() || undefined,
        amount: n,
        cycle,
        day: d,
        month: cycle === 'monthly' ? undefined : today.getMonth(),
        cat,
      },
      {
        onSuccess: () => {
          setName('');
          setPlan('');
          setAmount('');
          setOpen(false);
        },
        onError: (err) => Alert.alert('Couldn’t save', describeError(err)),
      },
    );
  }

  return (
    <ScreenScroll refreshing={query.isFetching} onRefresh={() => void query.refetch()}>
      <View style={styles.hero}>
        <Caption>
          {MONTHS[month]} {year} · Due
        </Caption>
        <Display style={styles.heroValue}>
          <Caption style={styles.unit}>USD </Caption>
          {formatFigure(monthTotal, { hidden })}
        </Display>
        <Caption>
          {monthCharges.length} charges · {formatFigure(monthlyRun, { hidden })}/mo average
        </Caption>
      </View>

      <Panel>
        <View style={styles.calHead}>
          <Pressable onPress={() => step(-1)} hitSlop={12} accessibilityLabel="Previous month">
            <Ionicons name="chevron-back" size={20} color={color.primary} />
          </Pressable>
          <Body>
            {MONTHS[month]} {year}
          </Body>
          <Pressable onPress={() => step(1)} hitSlop={12} accessibilityLabel="Next month">
            <Ionicons name="chevron-forward" size={20} color={color.primary} />
          </Pressable>
        </View>
        <View style={styles.weekdays}>
          {WEEKDAYS.map((d, i) => (
            <Caption key={`${d}-${i}`} style={styles.weekday}>
              {d}
            </Caption>
          ))}
        </View>
        <View style={styles.grid}>
          {grid.map((cell, i) => {
            const charges = cell.outside ? null : byDay[cell.day];
            const isToday = isThisMonth && !cell.outside && cell.day === today.getDate();
            const on = selDay === cell.day && !cell.outside;
            return (
              <Pressable
                key={i}
                disabled={cell.outside || !charges}
                onPress={() => setSelDay(on ? null : cell.day)}
                style={[
                  styles.cell,
                  cell.outside && styles.cellOut,
                  charges && styles.cellHas,
                  on && styles.cellOn,
                  isToday && styles.cellToday,
                ]}
              >
                <Caption style={on ? { color: '#000' } : undefined}>{cell.day}</Caption>
                {charges ? (
                  <View style={styles.dots}>
                    {charges.slice(0, 3).map((s) => (
                      <View
                        key={s.id}
                        style={[styles.mini, { backgroundColor: catOf(s.cat).color }]}
                      />
                    ))}
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </Panel>

      <View style={styles.stats}>
        <View style={styles.stat}>
          <Caption>Monthly</Caption>
          <Mono>{formatFigure(monthlyRun, { hidden })}</Mono>
        </View>
        <View style={styles.stat}>
          <Caption>Yearly</Caption>
          <Mono>{formatFigure(monthlyRun * 12, { hidden })}</Mono>
        </View>
        <View style={styles.stat}>
          <Caption>Active</Caption>
          <Mono>{hidden ? '••' : String(subs.length)}</Mono>
        </View>
      </View>

      {sorted.length > 0 ? (
        <Section overline="All subscriptions">
          <ListGroup>
            {sorted.map((s) => (
              <ListRow
                key={s.id}
                title={s.name}
                subtitle={`${s.plan ? `${s.plan} · ` : ''}day ${s.day} · ${s.cycle}`}
                trailing={
                  <Mono>{hidden ? '••••' : formatMoney(s.amount, 'USD', { compact: true })}</Mono>
                }
                onPress={() =>
                  Alert.alert('Remove subscription?', s.name, [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Remove',
                      style: 'destructive',
                      onPress: () => delSub.mutate(s.id),
                    },
                  ])
                }
              />
            ))}
          </ListGroup>
        </Section>
      ) : (
        <EmptyState
          icon="calendar-outline"
          title="No recurring charges"
          message="Add rent, insurance, or Netflix and they land on the calendar."
        />
      )}

      <PressableButton label="Add subscription" onPress={() => setOpen(true)} fullWidth />

      <Modal visible={open} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.sheet}>
          <Display>Add subscription</Display>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Name · Netflix, Swisscom…"
            placeholderTextColor={color.mutedForeground}
            style={styles.input}
          />
          <TextInput
            value={plan}
            onChangeText={setPlan}
            placeholder="Plan · optional"
            placeholderTextColor={color.mutedForeground}
            style={styles.input}
          />
          <TextInput
            value={amount}
            onChangeText={setAmount}
            placeholder="Amount"
            placeholderTextColor={color.mutedForeground}
            keyboardType="decimal-pad"
            style={styles.input}
          />
          <View style={styles.seg}>
            {(['monthly', 'quarterly', 'yearly'] as const).map((c) => (
              <Pressable
                key={c}
                onPress={() => setCycle(c)}
                style={[styles.segBtn, cycle === c && styles.segOn]}
              >
                <Caption style={cycle === c ? { color: color.foreground } : undefined}>
                  {c}
                </Caption>
              </Pressable>
            ))}
          </View>
          <TextInput
            value={day}
            onChangeText={setDay}
            placeholder="Day of month"
            placeholderTextColor={color.mutedForeground}
            keyboardType="number-pad"
            style={styles.input}
          />
          <View style={styles.chips}>
            {SUB_CATS.map((c) => (
              <Pressable
                key={c.id}
                onPress={() => setCat(c.id)}
                style={[styles.chip, cat === c.id && { backgroundColor: `${c.color}33` }]}
              >
                <Caption>{c.name}</Caption>
              </Pressable>
            ))}
          </View>
          <PressableButton
            label={addSub.isPending ? 'Saving…' : 'Add subscription'}
            onPress={submit}
            loading={addSub.isPending}
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
  calHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 8,
  },
  weekdays: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    gap: 3,
  },
  cellOut: { opacity: 0.25 },
  cellHas: { backgroundColor: 'rgba(255,255,255,0.06)' },
  cellOn: { backgroundColor: '#fff' },
  cellToday: { borderWidth: 1.5, borderColor: color.primary },
  dots: { flexDirection: 'row', gap: 2, height: 4 },
  mini: { width: 4, height: 4, borderRadius: 2 },
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
  sheet: {
    flex: 1,
    backgroundColor: color.background,
    padding: space['2xl'],
    paddingTop: 28,
    gap: space.md,
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
  seg: {
    flexDirection: 'row',
    backgroundColor: color.muted,
    borderRadius: radius.pill,
    padding: 3,
  },
  segBtn: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: radius.pill },
  segOn: { backgroundColor: 'rgba(255,255,255,0.14)' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: color.muted,
  },
});
