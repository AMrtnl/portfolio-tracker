import {
  extractPositionsPayload,
  normalizeAccount,
  normalizeActivities,
  normalizeBalances,
  normalizeConnections,
  normalizeOrders,
  num,
} from './normalize';

describe('num', () => {
  it('parses numbers and numeric strings', () => {
    expect(num(12.5)).toBe(12.5);
    expect(num('3.14')).toBe(3.14);
    expect(num('')).toBeNull();
    expect(num(undefined)).toBeNull();
    expect(num(NaN)).toBeNull();
  });
});

describe('normalizeAccount', () => {
  it('maps account fields and masks number suffix', () => {
    const vm = normalizeAccount({
      id: 'acc-1',
      brokerage_authorization: 'auth-1',
      name: 'RRSP',
      number: '123456789',
      institution_name: 'Wealthsimple',
      created_date: '2024-01-01T00:00:00Z',
      sync_status: {
        holdings: {
          last_successful_sync: '2026-08-01T12:00:00Z',
          holdings_unavailable: false,
        },
      },
      balance: { total: { amount: 1000.5, currency: 'CAD' } },
      is_paper: false,
      raw_type: 'RRSP',
      account_category: 'INVESTMENT',
      status: 'open',
    });

    expect(vm.externalId).toBe('acc-1');
    expect(vm.institution).toBe('Wealthsimple');
    expect(vm.numberSuffix).toBe('••••6789');
    expect(vm.currency).toBe('CAD');
    expect(vm.totalValue).toBe(1000.5);
    expect(vm.lastHoldingsSync).toBe('2026-08-01T12:00:00Z');
  });
});

describe('normalizeBalances', () => {
  it('keeps reported currency and cash/buying power', () => {
    const rows = normalizeBalances([
      { currency: { code: 'EUR' }, cash: 250, buying_power: 500 },
      { currency: { code: 'USD' }, cash: 0, buying_power: null },
    ]);
    expect(rows).toEqual([
      { currency: 'EUR', cash: 250, buyingPower: 500 },
      { currency: 'USD', cash: 0, buyingPower: null },
    ]);
  });
});

describe('extractPositionsPayload', () => {
  it('reads AllAccountPositionsResponse.results', () => {
    const positions = extractPositionsPayload({
      results: [
        {
          instrument: {
            kind: 'stock',
            id: 'i1',
            symbol: 'AAPL',
            raw_symbol: 'AAPL',
            description: 'Apple',
          },
          units: '10',
          price: '200',
          cost_basis: '150',
          currency: 'USD',
          cash_equivalent: false,
        },
        {
          instrument: {
            kind: 'mutualfund',
            id: 'i2',
            symbol: 'SPAXX',
            raw_symbol: 'SPAXX',
          },
          units: '100',
          price: '1',
          currency: 'USD',
          cash_equivalent: true,
        },
      ],
      data_freshness: { as_of: '2026-08-06T00:00:00Z' },
    });

    expect(positions).toHaveLength(2);
    expect(positions[0].symbol).toBe('AAPL');
    expect(positions[0].marketValue).toBe(2000);
    expect(positions[0].currency).toBe('USD');
    expect(positions[1].cashEquivalent).toBe(true);
  });

  it('skips zero-unit and missing symbol rows', () => {
    expect(
      extractPositionsPayload({
        results: [
          {
            instrument: { symbol: 'X', raw_symbol: 'X', id: '1', kind: 'stock' },
            units: '0',
            price: '1',
            currency: 'USD',
          },
        ],
        data_freshness: { as_of: '2026-08-06T00:00:00Z' },
      }),
    ).toEqual([]);
  });
});

describe('normalizeOrders', () => {
  it('flattens RecentOrdersResponse', () => {
    const orders = normalizeOrders({
      orders: [
        {
          brokerage_order_id: 'o1',
          action: 'BUY',
          status: 'EXECUTED',
          universal_symbol: {
            id: 's1',
            symbol: 'MSFT',
            raw_symbol: 'MSFT',
            currency: { code: 'USD' },
          },
          total_quantity: '5',
          filled_quantity: '5',
          execution_price: '400',
          time_placed: '2026-08-05T15:00:00Z',
        },
      ],
    });
    expect(orders[0].symbol).toBe('MSFT');
    expect(orders[0].action).toBe('BUY');
    expect(orders[0].currency).toBe('USD');
  });
});

describe('normalizeActivities', () => {
  it('maps paginated activity data', () => {
    const acts = normalizeActivities({
      data: [
        {
          id: 'a1',
          type: 'DIVIDEND',
          amount: 12.34,
          units: 0,
          price: 0,
          currency: { code: 'CAD' },
          symbol: { symbol: 'VGRO.TO', raw_symbol: 'VGRO' },
          trade_date: '2026-07-01',
          fee: 0,
        },
      ],
    });
    expect(acts[0].type).toBe('DIVIDEND');
    expect(acts[0].symbol).toBe('VGRO.TO');
    expect(acts[0].currency).toBe('CAD');
  });
});

describe('normalizeConnections', () => {
  it('flags disabled connections', () => {
    const rows = normalizeConnections([
      {
        id: 'c1',
        name: 'Schwab',
        disabled: true,
        disabled_date: '2026-08-01',
        brokerage: { display_name: 'Charles Schwab', slug: 'SCHWAB', name: 'Schwab' },
        type: 'read',
      },
    ]);
    expect(rows[0].disabled).toBe(true);
    expect(rows[0].brokerageName).toBe('Charles Schwab');
  });
});
