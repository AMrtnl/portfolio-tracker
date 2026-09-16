import { parseAmount, parseDate, parseStatement } from './import';

describe('parseDate', () => {
  it('reads ISO and European forms', () => {
    expect(parseDate('2026-09-16')).toBe('2026-09-16');
    expect(parseDate('16.09.2026')).toBe('2026-09-16');
    expect(parseDate('16/09/2026')).toBe('2026-09-16');
    expect(parseDate('2026/09/16')).toBe('2026-09-16');
    expect(parseDate('05.06.26')).toBe('2026-06-05');
  });

  it('falls back to month-first only when day-first is impossible', () => {
    expect(parseDate('09/16/2026')).toBe('2026-09-16');
  });

  it('rejects nonsense', () => {
    expect(parseDate('Datum')).toBeNull();
    expect(parseDate('99.99.2026')).toBeNull();
  });
});

describe('parseAmount', () => {
  it('handles Swiss, German, and accounting formats', () => {
    expect(parseAmount("1'234.50")).toBe(1234.5);
    expect(parseAmount('1.234,50')).toBe(1234.5);
    expect(parseAmount('-12,30')).toBe(-12.3);
    expect(parseAmount('(45.00)')).toBe(-45);
    expect(parseAmount('CHF 12.00')).toBe(12);
    expect(parseAmount('+ 3 000.00')).toBe(3000);
    expect(parseAmount('1,234')).toBe(1234);
  });

  it('rejects text', () => {
    expect(parseAmount('Betrag')).toBeNull();
    expect(parseAmount('')).toBeNull();
  });
});

describe('parseStatement', () => {
  it('reads a Swiss semicolon export with a header and signed amounts', () => {
    const csv = [
      'Datum;Buchungstext;Betrag;Saldo',
      "01.09.2026;MIGROS ZUERICH;-54.30;3'200.00",
      "25.09.2026;Lohn September;+6'500.00;9'645.70",
      '05.09.2026;NETFLIX.COM;-17.90;9627.80',
    ].join('\n');
    const { rows, errors, mapping } = parseStatement(csv);
    expect(errors).toEqual([]);
    expect(mapping).toMatchObject({ date: 0, note: 1, amount: 2 });
    expect(rows).toEqual([
      { date: '2026-09-01', kind: 'spend', amount: 54.3, note: 'MIGROS ZUERICH', category: 'groceries' },
      { date: '2026-09-25', kind: 'income', amount: 6500, note: 'Lohn September', category: 'salary' },
      { date: '2026-09-05', kind: 'spend', amount: 17.9, note: 'NETFLIX.COM', category: 'subscriptions' },
    ]);
  });

  it('reads separate debit and credit columns', () => {
    const csv = [
      'Date,Description,Debit,Credit',
      '2026-09-02,"Coop, Bern",23.40,',
      '2026-09-03,Salary,,5000.00',
    ].join('\n');
    const { rows } = parseStatement(csv);
    expect(rows[0]).toMatchObject({ kind: 'spend', amount: 23.4, note: 'Coop, Bern', category: 'groceries' });
    expect(rows[1]).toMatchObject({ kind: 'income', amount: 5000, category: 'salary' });
  });

  it('sniffs columns when there is no header', () => {
    const csv = ['16.09.2026;SBB CFF FFS;-3.20', '17.09.2026;Uber;-14.00'].join('\n');
    const { rows, errors } = parseStatement(csv);
    expect(errors).toEqual([]);
    expect(rows.map((r) => r.category)).toEqual(['transport', 'transport']);
  });

  it('reports unreadable lines instead of dropping them silently', () => {
    const csv = ['Date,Text,Amount', '2026-09-01,Ok,-1.00', 'garbage,line,here', '2026-09-02,Zero,0'].join('\n');
    const { rows, errors } = parseStatement(csv);
    expect(rows).toHaveLength(1);
    expect(errors).toHaveLength(2);
  });

  it('handles an empty file', () => {
    expect(parseStatement('   \n').errors[0]).toMatch(/empty/);
  });
});
