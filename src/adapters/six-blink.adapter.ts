import axios from 'axios';
import fs from 'fs';
import https from 'https';
import { IAdapter } from './base.adapter.js';
import { Balance, Position, TxRecord } from '../types/common.js';

/**
 * Six Group B-Link — ISO 20022 Banking Framework Adapter
 *
 * SETUP REQUIRED (Enterprise registration required):
 * 1. Register at https://www.six-group.com/en/products-services/banking-services/b-link.html
 * 2. Complete KYC and legal agreements with Six Group
 * 3. Obtain:
 *    - mTLS client certificate (.p12 or .pem)
 *    - API endpoint URL
 *    - OAuth2 credentials
 * 4. Set in .env:
 *    SIX_BLINK_CERT_PATH=./certs/six-blink.p12
 *    SIX_BLINK_CERT_PASSWORD=your_cert_password
 *    SIX_BLINK_ENDPOINT=https://api.six-group.com/b-link
 *
 * Supported ISO 20022 message types:
 *   - camt.052 — Bank to Customer Account Report
 *   - camt.053 — Bank to Customer Statement
 *   - camt.054 — Bank to Customer Debit/Credit Notification
 *   - pain.001 — Customer Credit Transfer Initiation
 *   - pain.002 — Payment Status Report
 */

export class SixBlinkAdapter implements IAdapter {
  platform = 'six-blink';
  accountType = 'BANK' as const;

  private agent: https.Agent | null = null;
  private accessToken: string = '';

  constructor(
    private endpoint: string,
    private certPath: string,
    private certPassword: string,
    private clientId?: string,
    private clientSecret?: string
  ) {}

  isConfigured(): boolean {
    return !!this.endpoint && !!this.certPath && fs.existsSync(this.certPath);
  }

  private getAgent(): https.Agent {
    if (this.agent) return this.agent;
    const pfx = fs.readFileSync(this.certPath);
    this.agent = new https.Agent({ pfx, passphrase: this.certPassword, rejectUnauthorized: true });
    return this.agent;
  }

  private async ensureToken(): Promise<void> {
    if (this.accessToken || !this.clientId) return;
    const { data } = await axios.post(
      `${this.endpoint}/oauth/token`,
      `grant_type=client_credentials&client_id=${this.clientId}&client_secret=${this.clientSecret}`,
      { httpsAgent: this.getAgent(), headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
    this.accessToken = data.access_token;
  }

  private headers() {
    return {
      Authorization: `Bearer ${this.accessToken}`,
      'Content-Type': 'application/xml',
      Accept: 'application/xml',
    };
  }

  /**
   * Fetch account statement using camt.052 (Account Report)
   */
  async getBalances(): Promise<Balance[]> {
    if (!this.isConfigured()) return [];
    try {
      await this.ensureToken();

      // Build camt.052 request — Account Report
      const msgId = `MSG-${Date.now()}`;
      const now = new Date().toISOString();
      const requestXml = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.060.001.03">
  <AcctRptgReq>
    <GrpHdr>
      <MsgId>${msgId}</MsgId>
      <CreDtTm>${now}</CreDtTm>
    </GrpHdr>
    <RptgReq>
      <AcctRptgReq>
        <ReqdMsgNmId>camt.052</ReqdMsgNmId>
      </AcctRptgReq>
    </RptgReq>
  </AcctRptgReq>
</Document>`;

      const { data: xml } = await axios.post(
        `${this.endpoint}/camt/report`,
        requestXml,
        { httpsAgent: this.getAgent(), headers: this.headers() }
      );

      return this.parseCamt052Balances(xml);
    } catch (err) {
      console.error('Six B-Link getBalances error:', (err as Error).message);
      return [];
    }
  }

  private parseCamt052Balances(xml: string): Balance[] {
    // Simple XML parsing — production would use a proper ISO 20022 parser
    const balances: Balance[] = [];
    const balRegex = /<Bal>([\s\S]*?)<\/Bal>/g;
    let match;
    while ((match = balRegex.exec(xml)) !== null) {
      const block = match[1];
      const ccy = block.match(/<Ccy>(\w+)<\/Ccy>/)?.[1] ?? 'CHF';
      const amt = block.match(/<Amt[^>]*>([0-9.]+)<\/Amt>/)?.[1] ?? '0';
      const cd = block.match(/<CdtDbtInd>(\w+)<\/CdtDbtInd>/)?.[1];
      const value = cd === 'DBIT' ? -parseFloat(amt) : parseFloat(amt);
      if (value !== 0) {
        balances.push({
          asset: ccy,
          amount: value.toString(),
          usdValue: '0', // FX conversion via market data service
          chain: 'Swiss Banking',
          platform: 'six-blink',
        });
      }
    }
    return balances;
  }

  async getPositions(): Promise<Position[]> {
    // B-Link is for banking — securities positions would be in a separate custody system
    return [];
  }

  async getTransactions(from?: Date): Promise<TxRecord[]> {
    if (!this.isConfigured()) return [];
    try {
      await this.ensureToken();
      const startDate = from
        ? from.toISOString().slice(0, 10)
        : new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);

      const msgId = `STMT-${Date.now()}`;
      const now = new Date().toISOString();

      // camt.053 — Statement
      const requestXml = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.060.001.03">
  <AcctRptgReq>
    <GrpHdr>
      <MsgId>${msgId}</MsgId>
      <CreDtTm>${now}</CreDtTm>
    </GrpHdr>
    <RptgReq>
      <AcctRptgReq>
        <ReqdMsgNmId>camt.053</ReqdMsgNmId>
        <AcctRptgFrToDt>
          <FrDt>${startDate}</FrDt>
          <ToDt>${new Date().toISOString().slice(0, 10)}</ToDt>
        </AcctRptgFrToDt>
      </AcctRptgReq>
    </RptgReq>
  </AcctRptgReq>
</Document>`;

      const { data: xml } = await axios.post(
        `${this.endpoint}/camt/statement`,
        requestXml,
        { httpsAgent: this.getAgent(), headers: this.headers() }
      );

      return this.parseCamt053Transactions(xml);
    } catch {
      return [];
    }
  }

  private parseCamt053Transactions(xml: string): TxRecord[] {
    const txs: TxRecord[] = [];
    const txRegex = /<Ntry>([\s\S]*?)<\/Ntry>/g;
    let match;
    while ((match = txRegex.exec(xml)) !== null) {
      const block = match[1];
      const amt = parseFloat(block.match(/<Amt[^>]*>([0-9.]+)<\/Amt>/)?.[1] ?? '0');
      const ccy = block.match(/<Amt Ccy="(\w+)">/)?.[1] ?? 'CHF';
      const cd = block.match(/<CdtDbtInd>(\w+)<\/CdtDbtInd>/)?.[1];
      const date = block.match(/<ValDt>[^<]*<Dt>([0-9-]+)<\/Dt>/)?.[1]
        ?? block.match(/<BookgDt>[^<]*<Dt>([0-9-]+)<\/Dt>/)?.[1]
        ?? new Date().toISOString().slice(0, 10);
      const ref = block.match(/<AcctSvcrRef>([^<]+)<\/AcctSvcrRef>/)?.[1] ?? '';
      if (amt > 0) {
        txs.push({
          asset: ccy,
          type: cd === 'CRDT' ? 'DEPOSIT' : 'WITHDRAWAL',
          amount: amt,
          fee: 0,
          currency: ccy,
          timestamp: new Date(date),
          platform: 'six-blink',
        });
      }
    }
    return txs;
  }
}
