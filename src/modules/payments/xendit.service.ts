import axios, { AxiosInstance } from 'axios';
import pc from 'picocolors';
import { ENV } from '../../config/env';

export interface CreateQrCodeParams {
  referenceId: string;
  amount: number;
  currency?: string;
  expiresAt?: Date | string;
  description?: string;
}

export interface XenditQrCodeResponse {
  id: string;
  reference_id: string;
  type: string;
  currency: string;
  amount: number;
  channel_code?: string;
  status: string; // 'ACTIVE' | 'INACTIVE' | 'COMPLETED'
  qr_string: string;
  expires_at: string;
}

export interface CreateVirtualAccountParams {
  externalId: string;
  bankCode: string; // 'MANDIRI' | 'BRI' | 'BCA' | 'BNI' | 'PERMATA' | 'BSI'
  name: string;
  amount: number;
  expiresAt?: Date | string;
}

export interface XenditVirtualAccountResponse {
  id: string;
  external_id: string;
  bank_code: string;
  account_number: string;
  name: string;
  amount: number;
  status: string;
  expires_at: string;
}

export interface CreateEwalletParams {
  referenceId: string;
  channelCode: string; // 'ID_DANA' | 'ID_GOPAY' | 'ID_SHOPEEPAY' | 'ID_OVO' | 'ID_LINKAJA'
  amount: number;
  phone?: string;
  redirectUrl?: string;
}

export interface XenditEwalletResponse {
  id: string;
  reference_id: string;
  channel_code: string;
  currency: string;
  amount: number;
  status: string;
  checkout_url?: string;
  qr_string?: string;
  expires_at?: string;
}

export class XenditService {
  private secretKey: string;
  private client: AxiosInstance;

  constructor() {
    this.secretKey = ENV.XENDIT_SECRET_KEY;

    this.client = axios.create({
      baseURL: 'https://api.xendit.co',
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(`${this.secretKey}:`).toString('base64')}`,
        'api-version': '2022-07-31',
      },
    });
  }

  /**
   * Membuat Dynamic QR Code via Xendit QR Code API murni
   */
  async createQrCode(params: CreateQrCodeParams): Promise<XenditQrCodeResponse> {
    const { referenceId, amount, currency = 'IDR' } = params;

    if (!this.secretKey) {
      throw new Error('XENDIT_SECRET_KEY belum dikonfigurasi di file .env');
    }

    const expiresAt = params.expiresAt
      ? new Date(params.expiresAt).toISOString()
      : new Date(Date.now() + 15 * 60 * 1000).toISOString();

    try {
      console.log(`  ${pc.blue('ℹ')} ${pc.bold(pc.blue('[Xendit API]'))} Membuat Dynamic QR Code untuk ${pc.cyan(referenceId)} - Nominal: ${pc.yellow(amount)}`);

      const response = await this.client.post<any>('/qr_codes', {
        reference_id: referenceId,
        type: 'DYNAMIC',
        currency,
        amount,
        expires_at: expiresAt,
      });

      const data = response.data;

      return {
        id: data.id,
        reference_id: data.reference_id,
        type: data.type,
        currency: data.currency,
        amount: data.amount,
        channel_code: data.channel_code || 'QRIS',
        status: data.status,
        qr_string: data.qr_string,
        expires_at: data.expires_at,
      };
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || error.message || 'Gagal memproses QR Code ke Xendit';
      console.error(`  ${pc.red('✖')} ${pc.bold(pc.red('[Xendit API Error]'))} ${errorMsg}`);
      throw new Error(errorMsg);
    }
  }

  /**
   * Membuat Virtual Account (VA Bank) di Xendit
   */
  async createVirtualAccount(params: CreateVirtualAccountParams): Promise<XenditVirtualAccountResponse> {
    const { externalId, bankCode, name, amount } = params;

    if (!this.secretKey) {
      throw new Error('XENDIT_SECRET_KEY belum dikonfigurasi di file .env');
    }

    const expiresAt = params.expiresAt
      ? new Date(params.expiresAt).toISOString()
      : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    try {
      console.log(`  ${pc.blue('ℹ')} ${pc.bold(pc.blue('[Xendit VA API]'))} Membuat Virtual Account ${pc.magenta(bankCode)} untuk ${pc.cyan(externalId)} - Nominal: ${pc.yellow(amount)}`);

      const response = await this.client.post<any>('/callback_virtual_accounts', {
        external_id: externalId,
        bank_code: bankCode.toUpperCase(),
        name,
        is_closed: true,
        expected_amount: amount,
        expiration_date: expiresAt,
      });

      const data = response.data;

      return {
        id: data.id,
        external_id: data.external_id,
        bank_code: data.bank_code,
        account_number: data.account_number,
        name: data.name,
        amount: data.expected_amount || amount,
        status: data.status,
        expires_at: data.expiration_date || expiresAt,
      };
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || error.message || `Gagal membuat Virtual Account ${bankCode} di Xendit`;
      console.error(`  ${pc.red('✖')} ${pc.bold(pc.red('[Xendit VA Error]'))} ${errorMsg}`);
      throw new Error(errorMsg);
    }
  }

  /**
   * Membuat E-Wallet Charge di Xendit
   */
  async createEwalletCharge(params: CreateEwalletParams): Promise<XenditEwalletResponse> {
    const { referenceId, channelCode, amount, phone, redirectUrl } = params;

    if (!this.secretKey) {
      throw new Error('XENDIT_SECRET_KEY belum dikonfigurasi di file .env');
    }

    try {
      console.log(`  ${pc.blue('ℹ')} ${pc.bold(pc.blue('[Xendit EWallet API]'))} Membuat Charge ${pc.magenta(channelCode)} untuk ${pc.cyan(referenceId)} - Nominal: ${pc.yellow(amount)}`);

      const response = await this.client.post<any>('/ewallets/charges', {
        reference_id: referenceId,
        currency: 'IDR',
        amount,
        checkout_method: 'ONE_TIME_PAYMENT',
        channel_code: channelCode,
        channel_properties: {
          success_redirect_url: redirectUrl || 'https://almaslaundry.com/payment/success',
          ...(phone ? { mobile_number: phone } : {}),
        },
      });

      const data = response.data;
      const actions = data.actions || {};

      return {
        id: data.id,
        reference_id: data.reference_id,
        channel_code: data.channel_code,
        currency: data.currency,
        amount: data.charge_amount || amount,
        status: data.status,
        checkout_url: actions.mobile_web_checkout_url || actions.desktop_web_checkout_url || actions.mobile_deeplink_checkout_url,
        qr_string: actions.qr_checkout_string,
        expires_at: data.expires_at || new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      };
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || error.message || `Gagal memproses e-wallet charge ${channelCode} di Xendit`;
      console.error(`  ${pc.red('✖')} ${pc.bold(pc.red('[Xendit EWallet Error]'))} ${errorMsg}`);
      throw new Error(errorMsg);
    }
  }

  /**
   * Simulasi Pembayaran QR Code di Xendit API murni
   */
  async simulatePayment(qrCodeId: string, amount: number): Promise<{ status: string; message: string }> {
    if (!this.secretKey) {
      throw new Error('XENDIT_SECRET_KEY belum dikonfigurasi di file .env');
    }

    try {
      console.log(`  ${pc.blue('ℹ')} ${pc.bold(pc.blue('[Xendit API]'))} Menjalankan simulasi bayar untuk QR: ${pc.cyan(qrCodeId)}`);

      await this.client.post(`/qr_codes/${qrCodeId}/payments/simulate`, { amount });

      return {
        status: 'COMPLETED',
        message: 'Pembayaran berhasil diselesaikan di Xendit',
      };
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || err.message || 'Gagal memproses simulasi pembayaran di Xendit';
      console.error(`  ${pc.red('✖')} ${pc.bold(pc.red('[Xendit Simulate Error]'))} ${errorMsg}`);
      throw new Error(errorMsg);
    }
  }

  /**
   * Simulasi Pembayaran Virtual Account (Sandbox)
   */
  async simulateVirtualAccountPayment(externalId: string, amount: number): Promise<{ status: string; message: string }> {
    if (!this.secretKey) {
      throw new Error('XENDIT_SECRET_KEY belum dikonfigurasi di file .env');
    }

    try {
      console.log(`  ${pc.blue('ℹ')} ${pc.bold(pc.blue('[Xendit VA Simulate]'))} Simulasi bayar VA external_id: ${pc.cyan(externalId)}`);

      await this.client.post(`/callback_virtual_accounts/external_id=${externalId}/simulate_payment`, { amount });

      return {
        status: 'COMPLETED',
        message: 'Pembayaran Virtual Account berhasil diselesaikan di Xendit',
      };
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || err.message || 'Gagal memproses simulasi pembayaran VA di Xendit';
      console.error(`  ${pc.red('✖')} ${pc.bold(pc.red('[Xendit VA Simulate Error]'))} ${errorMsg}`);
      throw new Error(errorMsg);
    }
  }

  /**
   * Verifikasi Webhook Token dari Xendit
   */
  verifyWebhookToken(callbackToken?: string): boolean {
    const expectedToken = ENV.XENDIT_WEBHOOK_VERIFICATION_TOKEN;
    if (!expectedToken) {
      return true;
    }
    return callbackToken === expectedToken;
  }
}

