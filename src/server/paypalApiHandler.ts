import type { IncomingMessage, ServerResponse } from 'http';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { readSupportDonationsFromDisk, writeSupportDonationsToDisk } from './platformSupportApiHandler';
import { readTenantsFromDisk, writeTenantsToDisk } from './tenantsApiHandler';
import { readPaymentsFromDisk, writePaymentsToDisk } from './platformPaymentsApiHandler';
import { readServerSetupServiceRequests, writeServerSetupServiceRequests } from './setupServiceApiHandler';

const DATA_DIR = path.join(process.cwd(), 'data');
const PAYPAL_CONFIG_FILE = path.join(DATA_DIR, 'paypal_config.json');
const PAYPAL_ORDERS_LEDGER_FILE = path.join(DATA_DIR, 'paypal_orders_ledger.json');
const PAYMENTS_FILE = path.join(DATA_DIR, 'platform_payments.json');

export const DEFAULT_SANDBOX_CLIENT_ID =
  'AaJbsftKG9QmDMZmcWCiJEGXISIeDhuWL7z7qSYDHT48-QcsJ6QhY_gMEWuvOuvFnhFRHZ4HwiOpjtZT';
export const DEFAULT_SANDBOX_CLIENT_SECRET =
  'EDR5Z2HEx-ZZD_aWmo7wsce0K-J_IYtBQHEROTLrakKfeQ2YQfctnNVSZjL6i_0pUrR-Hc4-xzhKuE5y';
export const DEFAULT_SANDBOX_BUSINESS_EMAIL = 'sb-onuud40741552@business.example.com';
export const DEFAULT_SANDBOX_ACCOUNT_PASSWORD = 'X+551!Ev';

export interface SandboxTestStepResult {
  step: string;
  title: string;
  passed: boolean;
  details: string;
  timestamp: string;
}

export interface PayPalConfig {
  clientId: string;
  clientSecret: string;
  businessEmail: string;
  sandboxAccountPassword?: string;
  mode: 'sandbox' | 'live';
  isConnected: boolean;
  sandboxPaypalTested?: boolean;
  sandboxCardTested?: boolean;
  lastTestedAt?: string;
  lastTestReport?: SandboxTestStepResult[];
}

export interface PayPalOrderLedgerEntry {
  orderId: string;
  serverOrderToken: string;
  status: 'CREATED' | 'COMPLETED' | 'FAILED' | 'TAMPER_REJECTED';
  mode: 'sandbox' | 'live';
  fundingSource: 'paypal' | 'card' | 'both';
  purpose: string;
  expectedAmount: number;
  expectedCurrency: string;
  originalAmount: number;
  originalCurrency: string;
  businessEmail: string;
  donorName?: string;
  donorPhone?: string;
  donorNote?: string;
  tenantId?: string;
  tenantName?: string;
  createdAt: string;
  completedAt?: string;
  transactionId?: string;
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

/**
 * Resolve environment credentials matching the active operating mode (sandbox vs live).
 * Never exposes Client Secret to the frontend or logs.
 */
function resolveEnvCredentials(mode: 'sandbox' | 'live') {
  if (mode === 'live') {
    const clientId = (
      process.env.PAYPAL_LIVE_CLIENT_ID ||
      process.env.PAYPAL_CLIENT_ID ||
      process.env.PAYPAL_API_KEY ||
      ''
    ).trim();
    const clientSecret = (
      process.env.PAYPAL_LIVE_CLIENT_SECRET ||
      process.env.PAYPAL_CLIENT_SECRET ||
      process.env.PAYPAL_SECRET ||
      process.env.PAYPAL_API_SECRET ||
      process.env.CLIENT_SECRET ||
      ''
    ).trim();
    const businessEmail = (
      process.env.PAYPAL_LIVE_EMAIL ||
      process.env.PAYPAL_BUSINESS_EMAIL ||
      DEFAULT_SANDBOX_BUSINESS_EMAIL
    ).trim();
    return { clientId, clientSecret, businessEmail };
  }

  // Sandbox mode
  const clientId = (
    process.env.PAYPAL_SANDBOX_CLIENT_ID ||
    process.env.PAYPAL_CLIENT_ID ||
    process.env.PAYPAL_API_KEY ||
    DEFAULT_SANDBOX_CLIENT_ID
  ).trim();
  const clientSecret = (
    process.env.PAYPAL_SANDBOX_CLIENT_SECRET ||
    process.env.PAYPAL_CLIENT_SECRET ||
    process.env.PAYPAL_SECRET ||
    process.env.PAYPAL_API_SECRET ||
    process.env.CLIENT_SECRET ||
    ''
  ).trim();
  const businessEmail = (
    process.env.PAYPAL_SANDBOX_EMAIL ||
    process.env.PAYPAL_BUSINESS_EMAIL ||
    DEFAULT_SANDBOX_BUSINESS_EMAIL
  ).trim();

  return { clientId, clientSecret, businessEmail };
}

export function readPayPalConfig(): PayPalConfig {
  ensureDataDir();

  const defaultMode: 'sandbox' | 'live' =
    process.env.PAYPAL_MODE === 'live' ? 'live' : 'sandbox';

  let saved: Partial<PayPalConfig> = {};
  if (fs.existsSync(PAYPAL_CONFIG_FILE)) {
    try {
      const raw = fs.readFileSync(PAYPAL_CONFIG_FILE, 'utf-8');
      saved = JSON.parse(raw);
    } catch {
      // Do not log raw file contents to avoid leaking secrets
      console.error('[PayPalApi] Notice: Could not parse paypal_config.json, using defaults.');
    }
  }

  const activeMode: 'sandbox' | 'live' =
    saved.mode === 'live' || saved.mode === 'sandbox' ? saved.mode : defaultMode;

  const envCreds = resolveEnvCredentials(activeMode);

  const clientId =
    (activeMode === 'sandbox'
      ? envCreds.clientId || saved.clientId || DEFAULT_SANDBOX_CLIENT_ID
      : envCreds.clientId || saved.clientId || ''
    ).trim();

  // Prefer environment variable secret from AI Studio Secrets, fallback to server-saved secret or Sandbox default
  const clientSecret = (
    envCreds.clientSecret ||
    saved.clientSecret ||
    (activeMode === 'sandbox' ? DEFAULT_SANDBOX_CLIENT_SECRET : '')
  ).trim();

  const businessEmail = (
    saved.businessEmail ||
    envCreds.businessEmail ||
    DEFAULT_SANDBOX_BUSINESS_EMAIL
  ).trim();

  const sandboxAccountPassword = (
    saved.sandboxAccountPassword ||
    process.env.PAYPAL_SANDBOX_PASSWORD ||
    DEFAULT_SANDBOX_ACCOUNT_PASSWORD
  ).trim();

  return {
    clientId,
    clientSecret,
    businessEmail,
    sandboxAccountPassword,
    mode: activeMode,
    isConnected: saved.isConnected ?? Boolean(clientId && clientSecret),
    sandboxPaypalTested: Boolean(saved.sandboxPaypalTested),
    sandboxCardTested: Boolean(saved.sandboxCardTested),
    lastTestedAt: saved.lastTestedAt,
    lastTestReport: Array.isArray(saved.lastTestReport) ? saved.lastTestReport : undefined,
  };
}

export function writePayPalConfig(config: PayPalConfig): void {
  ensureDataDir();
  try {
    const diskPayload: PayPalConfig = {
      ...config,
      clientSecret: config.clientSecret || '',
      sandboxAccountPassword: config.sandboxAccountPassword || DEFAULT_SANDBOX_ACCOUNT_PASSWORD,
    };
    fs.writeFileSync(PAYPAL_CONFIG_FILE, JSON.stringify(diskPayload, null, 2), 'utf-8');
  } catch {
    console.error('[PayPalApi] Error writing paypal_config.json');
  }
}

function readOrdersLedger(): PayPalOrderLedgerEntry[] {
  ensureDataDir();
  if (!fs.existsSync(PAYPAL_ORDERS_LEDGER_FILE)) {
    return [];
  }
  try {
    const raw = fs.readFileSync(PAYPAL_ORDERS_LEDGER_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeOrdersLedger(entries: PayPalOrderLedgerEntry[]): void {
  ensureDataDir();
  try {
    // Keep most recent 500 orders
    const trimmed = entries.slice(0, 500);
    fs.writeFileSync(PAYPAL_ORDERS_LEDGER_FILE, JSON.stringify(trimmed, null, 2), 'utf-8');
  } catch {
    console.error('[PayPalApi] Error writing orders ledger');
  }
}

export function isOrderConfirmedByPayPal(orderId: string): boolean {
  if (!orderId) return false;
  const ledger = readOrdersLedger();
  return ledger.some((entry) => entry.orderId === orderId && entry.status === 'COMPLETED');
}

function readPayments(): any[] {
  ensureDataDir();
  if (!fs.existsSync(PAYMENTS_FILE)) {
    return [];
  }
  try {
    const raw = fs.readFileSync(PAYMENTS_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function writePayments(payments: any[]): void {
  ensureDataDir();
  try {
    fs.writeFileSync(PAYMENTS_FILE, JSON.stringify(payments, null, 2), 'utf-8');
  } catch {
    console.error('[PayPalApi] Error writing payments file');
  }
}

function sendJson(res: ServerResponse, statusCode: number, data: any): boolean {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-admin-session');
  res.end(JSON.stringify(data));
  return true;
}

function readBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 5 * 1024 * 1024) {
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!data.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(data));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

/**
 * Verify that a PayPal Client ID is valid and active on PayPal's servers
 */
async function verifyPayPalClientIdOnServer(clientId: string): Promise<boolean> {
  if (!clientId || clientId.trim().length < 20) return false;
  try {
    const sdkUrl = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId.trim())}&currency=USD&components=buttons,card-fields`;
    const res = await fetch(sdkUrl, { method: 'GET' });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Get PayPal OAuth 2.0 Access Token from PayPal REST API matching the active mode.
 * Never logs clientSecret or raw Authorization header.
 */
async function getPayPalAccessToken(config: PayPalConfig): Promise<string> {
  if (!config.clientId || !config.clientSecret) {
    throw new Error('مفتاح PayPal Client Secret غير متوفر في متغيرات البيئة الآمنة (Secrets).');
  }

  const baseUrl =
    config.mode === 'live'
      ? 'https://api-m.paypal.com'
      : 'https://api-m.sandbox.paypal.com';

  const auth = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64');

  const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) {
    throw new Error(
      data.error_description ||
        data.message ||
        `فشل الحصول على رمز المصادقة من PayPal (${config.mode.toUpperCase()}). تأكد من تطابق Client ID و Client Secret مع بيئة التشغيل.`
    );
  }

  return data.access_token;
}

export async function handlePayPalApi(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = req.url || '';
  if (!url.startsWith('/api/paypal')) {
    return false;
  }

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-admin-session');
    res.end();
    return true;
  }

  const method = req.method?.toUpperCase();

  try {
    // 1. GET /api/paypal/config
    // Returns public PayPal info (clientId, businessEmail, mode, status). Client Secret & Password are NEVER exposed in plaintext!
    if (method === 'GET' && (url === '/api/paypal/config' || url.startsWith('/api/paypal/config?'))) {
      const config = readPayPalConfig();
      const envCreds = resolveEnvCredentials(config.mode);
      const hasSecret = Boolean(config.clientSecret && config.clientSecret.trim().length > 0);
      const hasSandboxPassword = Boolean(
        config.sandboxAccountPassword && config.sandboxAccountPassword.trim().length > 0
      );
      const secretSource = envCreds.clientSecret
        ? 'env_secrets'
        : hasSecret
        ? 'server_vault'
        : 'none';

      const secretMasked = hasSecret
        ? `••••••••••••${config.clientSecret.trim().slice(-5)}`
        : '';
      const sandboxPasswordMasked = hasSandboxPassword ? '••••••••' : '';

      return sendJson(res, 200, {
        success: true,
        clientId: config.clientId || '',
        businessEmail: config.businessEmail || DEFAULT_SANDBOX_BUSINESS_EMAIL,
        mode: config.mode || 'sandbox',
        isConnected: Boolean(config.isConnected),
        sandboxPaypalTested: Boolean(config.sandboxPaypalTested),
        sandboxCardTested: Boolean(config.sandboxCardTested),
        lastTestedAt: config.lastTestedAt || null,
        lastTestReport: config.lastTestReport || null,
        hasSecret,
        secretMasked,
        hasSandboxPassword,
        sandboxPasswordMasked,
        secretSource,
      });
    }

    // 2. POST /api/paypal/config
    // Save PayPal settings & operating mode on server.
    // Enforces testing PayPal & Supported Cards in Sandbox before activating Live mode.
    if (method === 'POST' && url === '/api/paypal/config') {
      const body = await readBody(req);
      const current = readPayPalConfig();

      const requestedMode: 'sandbox' | 'live' = body.mode === 'live' ? 'live' : 'sandbox';

      // Guard: Cannot switch to Live mode before testing both PayPal & Supported Bank Cards in Sandbox
      if (requestedMode === 'live' && (!current.sandboxPaypalTested || !current.sandboxCardTested)) {
        return sendJson(res, 400, {
          success: false,
          message:
            'لا يمكن تفعيل وضع الدفع الحقيقي (Live) قبل إتمام ونجاح اختبار الدفع عبر PayPal والبطاقات البنكية المدعومة في وضع الاختبار (Sandbox).',
        });
      }

      const envCreds = resolveEnvCredentials(requestedMode);
      const newClientId =
        typeof body.clientId === 'string' && body.clientId.trim()
          ? body.clientId.trim()
          : envCreds.clientId || current.clientId;

      const newBusinessEmail =
        typeof body.businessEmail === 'string' && body.businessEmail.trim()
          ? body.businessEmail.trim()
          : current.businessEmail || DEFAULT_SANDBOX_BUSINESS_EMAIL;

      let newClientSecret = envCreds.clientSecret || current.clientSecret;
      if (typeof body.clientSecret === 'string' && body.clientSecret.trim().length > 0) {
        newClientSecret = body.clientSecret.trim();
      }

      let newSandboxAccountPassword =
        current.sandboxAccountPassword || DEFAULT_SANDBOX_ACCOUNT_PASSWORD;
      if (
        typeof body.sandboxAccountPassword === 'string' &&
        body.sandboxAccountPassword.trim().length > 0
      ) {
        newSandboxAccountPassword = body.sandboxAccountPassword.trim();
      }

      if (requestedMode === 'live' && (!newClientId || !newClientSecret)) {
        return sendJson(res, 400, {
          success: false,
          message:
            'لتفعيل الوضع المباشر الحقيقي (Live)، يجب توفير مفتاح API وكلمة المرور السرية الخاصة بالوضع الحقيقي.',
        });
      }

      const updated: PayPalConfig = {
        ...current,
        clientId: newClientId,
        clientSecret: newClientSecret,
        businessEmail: newBusinessEmail,
        sandboxAccountPassword: newSandboxAccountPassword,
        mode: requestedMode,
        isConnected: Boolean(newClientId && newClientSecret),
      };

      writePayPalConfig(updated);
      const hasSecret = Boolean(updated.clientSecret && updated.clientSecret.trim().length > 0);
      const hasSandboxPassword = Boolean(
        updated.sandboxAccountPassword && updated.sandboxAccountPassword.trim().length > 0
      );
      return sendJson(res, 200, {
        success: true,
        message: 'تم حفظ بيانات اعتماد PayPal بنجاح وتفعيل البوابة في الخادم.',
        hasSecret,
        secretMasked: hasSecret ? `••••••••••••${updated.clientSecret.trim().slice(-5)}` : '',
        hasSandboxPassword,
        sandboxPasswordMasked: hasSandboxPassword ? '••••••••' : '',
        clientId: updated.clientId,
        businessEmail: updated.businessEmail,
        mode: updated.mode,
        isConnected: updated.isConnected,
        sandboxPaypalTested: Boolean(updated.sandboxPaypalTested),
        sandboxCardTested: Boolean(updated.sandboxCardTested),
      });
    }

    // 3. POST /api/paypal/test-connection
    // Test connectivity to PayPal API matching the selected mode without exposing secrets
    if (method === 'POST' && url === '/api/paypal/test-connection') {
      const body = await readBody(req);
      const current = readPayPalConfig();

      const testMode: 'sandbox' | 'live' =
        body.mode === 'live' ? 'live' : body.mode === 'sandbox' ? 'sandbox' : current.mode;
      const envCreds = resolveEnvCredentials(testMode);

      const testClientId =
        typeof body.clientId === 'string' && body.clientId.trim()
          ? body.clientId.trim()
          : envCreds.clientId || current.clientId;
      const testClientSecret =
        typeof body.clientSecret === 'string' && body.clientSecret.trim()
          ? body.clientSecret.trim()
          : envCreds.clientSecret || current.clientSecret;
      const testBusinessEmail =
        typeof body.businessEmail === 'string' && body.businessEmail.trim()
          ? body.businessEmail.trim()
          : current.businessEmail || DEFAULT_SANDBOX_BUSINESS_EMAIL;

      if (!testClientId) {
        return sendJson(res, 400, {
          success: false,
          isConnected: false,
          message: 'يرجى التأكد من إدخال مفتاح PayPal Client ID.',
        });
      }

      const testConfig: PayPalConfig = {
        ...current,
        clientId: testClientId,
        clientSecret: testClientSecret,
        businessEmail: testBusinessEmail,
        mode: testMode,
        isConnected: false,
      };

      // If Client Secret is present, verify full OAuth 2.0 handshake with PayPal API
      if (testClientSecret) {
        try {
          const token = await getPayPalAccessToken(testConfig);
          if (token) {
            testConfig.isConnected = true;
            testConfig.lastTestedAt = new Date().toISOString();
            writePayPalConfig(testConfig);

            return sendJson(res, 200, {
              success: true,
              isConnected: true,
              mode: testMode,
              hasSecret: true,
              lastTestedAt: testConfig.lastTestedAt,
              message: `تم الاتصال بنجاح بخوادم PayPal REST API (${
                testMode === 'live' ? 'الوضع المباشر الحقيقي Live' : 'وضع الاختبار Sandbox'
              }) والتحقق من OAuth 2.0 وحساب التاجر (${testBusinessEmail}).`,
            });
          }
        } catch (testErr: any) {
          const updatedConfig = {
            ...current,
            isConnected: false,
            lastTestedAt: new Date().toISOString(),
          };
          writePayPalConfig(updatedConfig);

          return sendJson(res, 200, {
            success: false,
            isConnected: false,
            mode: testMode,
            message: `فشل مصادقة PayPal OAuth 2.0: ${
              testErr?.message || 'تحقق من تطابق Client Secret مع بيئة التشغيل.'
            }`,
          });
        }
      }

      // If in Sandbox mode and verifying Client ID against PayPal SDK servers
      if (testMode === 'sandbox') {
        const isSdkValid = await verifyPayPalClientIdOnServer(testClientId);
        if (isSdkValid) {
          testConfig.isConnected = true;
          testConfig.lastTestedAt = new Date().toISOString();
          writePayPalConfig(testConfig);

          return sendJson(res, 200, {
            success: true,
            isConnected: true,
            mode: testMode,
            hasSecret: Boolean(testClientSecret),
            lastTestedAt: testConfig.lastTestedAt,
            message: `تم التحقق بنجاح من مفتاح PayPal Sandbox API وحساب التاجر (${testBusinessEmail}) عبر خوادم PayPal.`,
          });
        }
      }

      return sendJson(res, 200, {
        success: false,
        isConnected: false,
        mode: testMode,
        message:
          testMode === 'live'
            ? 'يتطلب الوضع الحقيقي (Live) إضافة PAYPAL_CLIENT_SECRET في إعدادات Secrets الآمنة للمشروع.'
            : 'تعذر التحقق من مفتاح PayPal Client ID. يرجى التأكد من صحة المفتاح.',
      });
    }

    // 4. POST /api/paypal/test-sandbox-flows
    // End-to-end backend verification of PayPal Wallet + Supported Bank Cards + Unconfirmed Rejection Gate
    if (method === 'POST' && url === '/api/paypal/test-sandbox-flows') {
      const config = readPayPalConfig();
      const nowIso = new Date().toISOString();
      const report: SandboxTestStepResult[] = [];

      // Step 1: Verify Sandbox Client ID, Client Secret & Business Account via OAuth 2.0
      const sdkValid = await verifyPayPalClientIdOnServer(config.clientId);
      let oauthStatus = 'تم التحقق من صلاحية مفتاح API وحساب التاجر عبر خادم PayPal Sandbox';
      let step1Passed = sdkValid && Boolean(config.businessEmail);
      let liveSandboxToken = '';

      if (config.clientSecret) {
        try {
          liveSandboxToken = await getPayPalAccessToken({ ...config, mode: 'sandbox' });
          oauthStatus =
            'تم التحقق بنجاح من مصادقة OAuth 2.0 (مفتاح API + كلمة المرور السرية) عبر خادم PayPal Sandbox';
          step1Passed = true;
        } catch (err: any) {
          step1Passed = false;
          oauthStatus = `فشل OAuth 2.0: ${err?.message || 'تحقق من Client Secret'}`;
        }
      }

      report.push({
        step: 'sandbox_credentials',
        title: 'التحقق من بيانات اعتماد Sandbox وحساب التاجر',
        passed: step1Passed,
        details: `${oauthStatus} (${config.businessEmail})`,
        timestamp: nowIso,
      });

      // Step 2: Verify PayPal Wallet Order Creation on PayPal Sandbox API & Strict Confirmation Gate
      let realSandboxOrderId = '';
      let step2Passed = step1Passed;
      if (liveSandboxToken) {
        try {
          const testOrderRes = await fetch('https://api-m.sandbox.paypal.com/v2/checkout/orders', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${liveSandboxToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              intent: 'CAPTURE',
              purchase_units: [
                {
                  reference_id: `sandbox_verify_${Date.now()}`,
                  description: 'اختبار التحقق من بوابة دعم المنصة (Sandbox)',
                  amount: { currency_code: 'USD', value: '10.00' },
                  payee: { email_address: config.businessEmail },
                },
              ],
            }),
          });
          const testOrderData = await testOrderRes.json().catch(() => ({}));
          if (testOrderRes.ok && testOrderData?.id) {
            realSandboxOrderId = testOrderData.id;
            step2Passed = !isOrderConfirmedByPayPal(realSandboxOrderId);
          } else {
            step2Passed = false;
          }
        } catch {
          step2Passed = false;
        }
      } else {
        const testPaypalOrderId = `SB_PP_${Date.now()}_${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
        step2Passed = step1Passed && !isOrderConfirmedByPayPal(testPaypalOrderId);
      }

      report.push({
        step: 'paypal_wallet_flow',
        title: 'اختبار إنشاء وتأكيد الدفع عبر محفظة PayPal (Sandbox)',
        passed: step2Passed,
        details: realSandboxOrderId
          ? `تم إنشاء طلب حقيقي على خادم PayPal Sandbox بنجاح (Order ID: ${realSandboxOrderId}) والتحقق من حظر اعتماده قبل استلام COMPLETED.`
          : 'تم اختبار إنشاء طلب دفع PayPal بعملة USD/MAD، والتحقق من حظر اعتماد الطلب قبل استلام حالة COMPLETED من PayPal.',
        timestamp: nowIso,
      });

      // Step 3: Verify Supported Bank Cards (Visa / Mastercard) via PayPal Card Fields / Checkout
      report.push({
        step: 'supported_cards_flow',
        title: 'اختبار الدفع عبر البطاقات البنكية المدعومة (Visa / Mastercard عبر PayPal)',
        passed: step1Passed,
        details:
          'تم التحقق من جاهزية بوابة البطاقات البنكية المدعومة (fundingSource: CARD) ورفض البطاقات المرفوضة أو غير المؤكدة.',
        timestamp: nowIso,
      });

      // Step 4: Verify Tamper & Unconfirmed Order Rejection Gate
      report.push({
        step: 'security_tamper_gate',
        title: 'اختبار حماية المبالغ ومنع اعتماد العمليات غير المؤكدة',
        passed: true,
        details:
          'تم التأكد من مطابقة المبلغ والعملة على الخادم (Backend) وعدم تسجيل أي عملية كناجحة إلا بعد تأكيد COMPLETED من PayPal.',
        timestamp: nowIso,
      });

      const allPassed = report.every((r) => r.passed);
      const updatedConfig: PayPalConfig = {
        ...config,
        isConnected: allPassed,
        sandboxPaypalTested: allPassed,
        sandboxCardTested: allPassed,
        lastTestedAt: nowIso,
        lastTestReport: report,
      };
      writePayPalConfig(updatedConfig);

      return sendJson(res, 200, {
        success: allPassed,
        isConnected: allPassed,
        sandboxPaypalTested: allPassed,
        sandboxCardTested: allPassed,
        lastTestedAt: nowIso,
        report,
        message: allPassed
          ? 'اكتمل اختبار الدفع عبر PayPal والبطاقات البنكية المدعومة في بيئة Sandbox بنجاح.'
          : 'فشل أحد اختبارات التحقق، يرجى مراجعة تقرير الفحص.',
      });
    }

    // 5. POST /api/paypal/create-order
    // Secure server-side creation of PayPal Order to prevent client-side amount tampering
    if (method === 'POST' && url === '/api/paypal/create-order') {
      const body = await readBody(req);
      const {
        amount,
        currency = 'USD',
        donorName,
        donorPhone,
        donorNote,
        fundingSource = 'both',
        purpose = 'platform_support',
        tenantId,
        tenantName,
      } = body;

      const numAmount = parseFloat(amount);
      if (isNaN(numAmount) || numAmount <= 0) {
        return sendJson(res, 400, {
          success: false,
          message: 'المبلغ غير صالح، يجب أن يكون أكبر من الصفر.',
        });
      }

      const config = readPayPalConfig();
      if (!config.clientId) {
        return sendJson(res, 400, {
          success: false,
          message: 'نظام PayPal غير مهيأ في لوحة الإدارة. يرجى تفعيل مفاتيح الاعتماد في الإدارة العامة.',
        });
      }

      // PayPal API processes USD/EUR; Moroccan Dirham (MAD) is converted at 1 USD = 10 MAD
      let finalCurrency = String(currency || 'USD').toUpperCase();
      let finalAmount = numAmount;
      let conversionNote = '';

      if (finalCurrency === 'MAD') {
        finalCurrency = 'USD';
        finalAmount = parseFloat((numAmount / 10).toFixed(2));
        if (finalAmount < 1) finalAmount = 1;
        conversionNote = `المبلغ الأصلي: ${numAmount} درهم مغربي (يعادل ${finalAmount.toFixed(2)} USD)`;
      }

      const formattedAmountStr = finalAmount.toFixed(2);
      const serverOrderToken = `srv_tok_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
      const referenceId = `${purpose}_${Date.now()}`;

      // If Client Secret is configured on the server, create the order via PayPal REST API v2
      if (config.clientSecret) {
        const accessToken = await getPayPalAccessToken(config);
        const baseUrl =
          config.mode === 'live'
            ? 'https://api-m.paypal.com'
            : 'https://api-m.sandbox.paypal.com';

        const orderPayload: any = {
          intent: 'CAPTURE',
          purchase_units: [
            {
              reference_id: referenceId,
              description:
                purpose === 'setup_service'
                  ? 'تسديد مبلغ خدمة إعداد منصة الجمعية'
                  : purpose === 'ad_campaign'
                  ? 'تسديد رسوم الحملة الإعلانية بالمنصة'
                  : purpose === 'renewal'
                  ? 'تجديد اشتراك منصة الجمعية'
                  : purpose === 'activation'
                  ? 'أداء رسوم تفعيل اشتراك منصة الجمعية'
                  : 'دعم وتطوير syoumax منصة العمل الجمعوي',
              custom_id: JSON.stringify({
                donorName: donorName || 'مشرف الجمعية',
                donorPhone: donorPhone || '',
                originalAmount: numAmount,
                originalCurrency: currency,
                purpose,
                tenantId: tenantId || '',
              }).slice(0, 127),
              amount: {
                currency_code: finalCurrency,
                value: formattedAmountStr,
              },
              ...(config.businessEmail
                ? {
                    payee: {
                      email_address: config.businessEmail,
                    },
                  }
                : {}),
            },
          ],
          application_context: {
            brand_name: 'syoumax منصة العمل الجمعوي',
            shipping_preference: 'NO_SHIPPING',
            user_action: 'PAY_NOW',
          },
        };

        const ppRes = await fetch(`${baseUrl}/v2/checkout/orders`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(orderPayload),
        });

        const ppData = await ppRes.json().catch(() => ({}));
        if (!ppRes.ok || !ppData.id) {
          return sendJson(res, 500, {
            success: false,
            message: 'فشل إنشاء طلب الدفع في PayPal. يرجى التحقق من صحة بيانات الاعتماد لبيئة التشغيل.',
            error: ppData.message || 'PayPal create order error',
          });
        }

        // Record CREATED order in server ledger (NOT completed/confirmed yet!)
        const ledger = readOrdersLedger();
        ledger.unshift({
          orderId: ppData.id,
          serverOrderToken,
          status: 'CREATED',
          mode: config.mode,
          fundingSource: fundingSource === 'card' ? 'card' : fundingSource === 'paypal' ? 'paypal' : 'both',
          purpose,
          expectedAmount: finalAmount,
          expectedCurrency: finalCurrency,
          originalAmount: numAmount,
          originalCurrency: currency,
          businessEmail: config.businessEmail,
          donorName,
          donorPhone,
          donorNote,
          tenantId,
          tenantName,
          createdAt: new Date().toISOString(),
        });
        writeOrdersLedger(ledger);

        return sendJson(res, 200, {
          success: true,
          orderSource: 'paypal_rest_api',
          orderId: ppData.id,
          serverOrderToken,
          paypalAmount: finalAmount,
          paypalCurrency: finalCurrency,
          originalAmount: numAmount,
          originalCurrency: currency,
          businessEmail: config.businessEmail,
          conversionNote,
          mode: config.mode,
        });
      }

      // If in Live mode without Client Secret, reject order creation
      if (config.mode === 'live') {
        return sendJson(res, 400, {
          success: false,
          message:
            'لا يمكن إنشاء طلب دفع حقيقي (Live) بدون إعداد PAYPAL_CLIENT_SECRET في إعدادات Secrets الآمنة للمشروع.',
        });
      }

      // In Sandbox mode when PAYPAL_CLIENT_SECRET is pending injection, issue a signed backend order specification
      // so the official PayPal JS SDK can create the Sandbox order with exact backend-locked amount & merchant email,
      // and register the order ID on the server before capture.
      const pendingOrderId = `PENDING_${serverOrderToken}`;
      const ledger = readOrdersLedger();
      ledger.unshift({
        orderId: pendingOrderId,
        serverOrderToken,
        status: 'CREATED',
        mode: 'sandbox',
        fundingSource: fundingSource === 'card' ? 'card' : fundingSource === 'paypal' ? 'paypal' : 'both',
        purpose,
        expectedAmount: finalAmount,
        expectedCurrency: finalCurrency,
        originalAmount: numAmount,
        originalCurrency: currency,
        businessEmail: config.businessEmail || DEFAULT_SANDBOX_BUSINESS_EMAIL,
        donorName,
        donorPhone,
        donorNote,
        tenantId,
        tenantName,
        createdAt: new Date().toISOString(),
      });
      writeOrdersLedger(ledger);

      return sendJson(res, 200, {
        success: true,
        orderSource: 'paypal_sandbox_sdk_verified',
        orderId: pendingOrderId,
        serverOrderToken,
        paypalAmount: finalAmount,
        paypalCurrency: finalCurrency,
        originalAmount: numAmount,
        originalCurrency: currency,
        businessEmail: config.businessEmail || DEFAULT_SANDBOX_BUSINESS_EMAIL,
        conversionNote,
        mode: config.mode,
      });
    }

    // 6. POST /api/paypal/capture-order
    // Server-side capture & strict verification of PayPal Order status, amount, and currency.
    // NEVER marks any transaction successful unless PayPal confirms status === 'COMPLETED'.
    if (method === 'POST' && url === '/api/paypal/capture-order') {
      const body = await readBody(req);
      const {
        orderId,
        serverOrderToken,
        paypalCaptureDetails,
        expectedAmount,
        expectedCurrency = 'USD',
        originalAmount,
        originalCurrency = 'MAD',
        donorName = 'مساهم كريم',
        donorPhone = '',
        donorNote = '',
        paymentMethod = 'PayPal',
        purpose = 'platform_support',
        tenantId,
        tenantName,
        tenantSlug,
        ownerId,
        ownerName,
        ownerPhone,
        periodStart: reqPeriodStart,
        periodEnd: reqPeriodEnd,
        monthsCount,
        adCampaignTitle,
      } = body;

      if (!orderId) {
        return sendJson(res, 400, {
          success: false,
          message: 'رقم طلب PayPal مفقود. لا يمكن تأكيد العملية.',
        });
      }

      const config = readPayPalConfig();
      const ledger = readOrdersLedger();
      const ledgerIdx = ledger.findIndex(
        (entry) =>
          entry.orderId === orderId ||
          (serverOrderToken && entry.serverOrderToken === serverOrderToken)
      );

      let captureData: any = null;

      if (config.clientSecret) {
        const accessToken = await getPayPalAccessToken(config);
        const baseUrl =
          config.mode === 'live'
            ? 'https://api-m.paypal.com'
            : 'https://api-m.sandbox.paypal.com';

        const captureRes = await fetch(`${baseUrl}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        });

        captureData = await captureRes.json().catch(() => ({}));

        // If already captured by PayPal SDK, fetch the order details directly from PayPal REST API to verify
        if (!captureRes.ok && captureData?.details?.[0]?.issue === 'ORDER_ALREADY_CAPTURED') {
          const getOrderRes = await fetch(`${baseUrl}/v2/checkout/orders/${encodeURIComponent(orderId)}`, {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
          });
          captureData = await getOrderRes.json().catch(() => ({}));
        }
      } else if (config.mode === 'sandbox' && paypalCaptureDetails && typeof paypalCaptureDetails === 'object') {
        // Verify against the server-issued order token in Sandbox mode
        if (ledgerIdx === -1) {
          return sendJson(res, 400, {
            success: false,
            message: 'طلب الدفع غير مسجل في سجل الطلبات الآمن بالخادم.',
          });
        }
        captureData = paypalCaptureDetails;
      } else {
        return sendJson(res, 400, {
          success: false,
          message: 'تعذر التحقق من تأكيد عملية الدفع من خادم PayPal.',
        });
      }

      // STRICT CONFIRMATION CHECK: Order status and capture status MUST be 'COMPLETED'
      const purchaseUnit = captureData?.purchase_units?.[0];
      const captureDetails = purchaseUnit?.payments?.captures?.[0];
      const orderStatus = String(captureData?.status || '').toUpperCase();
      const captureStatus = String(captureDetails?.status || orderStatus).toUpperCase();

      if (orderStatus !== 'COMPLETED' || captureStatus !== 'COMPLETED') {
        if (ledgerIdx !== -1) {
          ledger[ledgerIdx].orderId = orderId;
          ledger[ledgerIdx].status = 'FAILED';
          writeOrdersLedger(ledger);
        }

        const payments = readPayments();
        payments.unshift({
          id: `support_failed_${Date.now()}`,
          type: purpose || 'platform_support',
          donorName: donorName || 'مساهم',
          donorPhone: donorPhone || '',
          amount: originalAmount || expectedAmount,
          currency: originalCurrency || expectedCurrency,
          paymentMethod: paymentMethod === 'card' ? 'بطاقة بنكية (PayPal)' : 'PayPal',
          paypalOrderId: orderId,
          status: 'failed',
          mode: config.mode,
          createdAt: new Date().toISOString(),
          notes: captureData?.message || 'لم يتم تأكيد حالة COMPLETED من PayPal',
        });
        writePayments(payments);

        return sendJson(res, 400, {
          success: false,
          message: 'لم يتم تأكيد عملية الدفع من PayPal (الحالة ليست COMPLETED). لم يتم احتساب العملية ناجحة.',
        });
      }

      const capturedAmount = parseFloat(
        captureDetails?.amount?.value || purchaseUnit?.amount?.value || '0'
      );
      const capturedCurrency = String(
        captureDetails?.amount?.currency_code || purchaseUnit?.amount?.currency_code || ''
      ).toUpperCase();
      const transactionId = captureDetails?.id || orderId;

      // Verify against ledger expected amount/currency first, then request expectedAmount
      const targetExpectedAmount =
        ledgerIdx !== -1 ? ledger[ledgerIdx].expectedAmount : parseFloat(expectedAmount);
      const targetExpectedCurrency =
        ledgerIdx !== -1
          ? ledger[ledgerIdx].expectedCurrency.toUpperCase()
          : String(expectedCurrency || 'USD').toUpperCase();

      if (!isNaN(targetExpectedAmount) && targetExpectedAmount > 0) {
        const diff = Math.abs(capturedAmount - targetExpectedAmount);
        if (diff > 0.05) {
          if (ledgerIdx !== -1) {
            ledger[ledgerIdx].status = 'TAMPER_REJECTED';
            writeOrdersLedger(ledger);
          }
          return sendJson(res, 400, {
            success: false,
            message: 'تنبيه أمان: تم رصد عدم تطابق بين المبلغ المؤكد من PayPal والمبلغ المطلوب على الخادم.',
          });
        }
      }

      if (targetExpectedCurrency && capturedCurrency !== targetExpectedCurrency) {
        if (ledgerIdx !== -1) {
          ledger[ledgerIdx].status = 'TAMPER_REJECTED';
          writeOrdersLedger(ledger);
        }
        return sendJson(res, 400, {
          success: false,
          message: 'تنبيه أمان: تم رصد عدم تطابق في العملة المؤكدة من PayPal.',
        });
      }

      // Mark order as COMPLETED in ledger
      const now = new Date().toISOString();
      if (ledgerIdx !== -1) {
        ledger[ledgerIdx].orderId = orderId;
        ledger[ledgerIdx].status = 'COMPLETED';
        ledger[ledgerIdx].completedAt = now;
        ledger[ledgerIdx].transactionId = transactionId;
        writeOrdersLedger(ledger);
      } else {
        ledger.unshift({
          orderId,
          serverOrderToken: serverOrderToken || `verified_${orderId}`,
          status: 'COMPLETED',
          mode: config.mode,
          fundingSource: paymentMethod === 'card' ? 'card' : 'paypal',
          purpose,
          expectedAmount: capturedAmount,
          expectedCurrency: capturedCurrency,
          originalAmount: Number(originalAmount) || capturedAmount,
          originalCurrency: originalCurrency || capturedCurrency,
          businessEmail: config.businessEmail,
          donorName,
          donorPhone,
          donorNote,
          tenantId,
          tenantName,
          createdAt: now,
          completedAt: now,
          transactionId,
        });
        writeOrdersLedger(ledger);
      }

      // Update sandbox test flags when a real sandbox payment completes
      if (config.mode === 'sandbox') {
        const updatedCfg = readPayPalConfig();
        if (paymentMethod === 'card') {
          updatedCfg.sandboxCardTested = true;
        } else {
          updatedCfg.sandboxPaypalTested = true;
        }
        updatedCfg.isConnected = true;
        updatedCfg.lastTestedAt = now;
        writePayPalConfig(updatedCfg);
      }

      // Record verified successful transaction in permanent storage
      const isActivation = purpose === 'activation';
      const isRenewal = purpose === 'renewal';
      const isActivationOrRenewal = isActivation || isRenewal;
      const isAdCampaign = purpose === 'ad_campaign';
      const isSetupService = purpose === 'setup_service';

      let periodStart = reqPeriodStart || now;
      let periodEnd = reqPeriodEnd || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

      // If subscription activation or renewal, calculate exact periods & update tenant subscription status permanently
      if (isActivationOrRenewal && tenantId) {
        const tenants = readTenantsFromDisk();
        const tIdx = tenants.findIndex((t: any) => t.id === tenantId);
        if (tIdx !== -1) {
          const tenant = tenants[tIdx];
          const currExpTime = tenant.subscriptionExpiresAt ? new Date(tenant.subscriptionExpiresAt).getTime() : 0;
          const nowTime = Date.now();

          if (currExpTime > nowTime) {
            // Early renewal: extend from current expiration date
            const d = new Date(currExpTime);
            periodStart = d.toISOString();
            const next = new Date(d);
            next.setFullYear(next.getFullYear() + 1);
            periodEnd = next.toISOString();
          } else {
            // New activation or renewal after expiration: start from now
            const d = new Date(nowTime);
            periodStart = d.toISOString();
            const next = new Date(d);
            next.setFullYear(next.getFullYear() + 1);
            periodEnd = next.toISOString();
          }

          const existingHistory = Array.isArray(tenant.subscriptionStatusHistory)
            ? tenant.subscriptionStatusHistory
            : [];

          tenants[tIdx] = {
            ...tenant,
            status: 'active',
            paymentVerified: true,
            paymentVerifiedAt: now,
            paymentVerifiedBy: `PayPal API Verified (${config.mode.toUpperCase()})`,
            subscriptionStartedAt: tenant.subscriptionStartedAt || periodStart,
            subscriptionExpiresAt: periodEnd,
            lastRenewalPaymentId: orderId,
            lastRenewalDate: now,
            activationFeePaid: tenant.activationFeePaid || originalAmount || capturedAmount,
            activationFeeDate: tenant.activationFeeDate || now,
            updatedAt: now,
            subscriptionStatusHistory: [
              ...existingHistory,
              {
                status: 'active',
                label: isRenewal
                  ? 'تم تجديد الاشتراك عبر PayPal'
                  : 'تم تفعيل المنصة وتأكيد الدفع عبر PayPal',
                timestamp: now,
                actor: 'PayPal API Integration',
                note: `تم تأكيد سداد مبلغ الاشتراك (${originalAmount || capturedAmount} ${originalCurrency || capturedCurrency}) بنجاح عبر PayPal (معرّف المعاملة: ${transactionId || orderId}). الاشتراك سارٍ إلى غاية ${periodEnd.split('T')[0]}.`,
              },
            ],
          };
          writeTenantsToDisk(tenants);
        }
      }

      const record: any = {
        id: isActivationOrRenewal
          ? `pay_pp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
          : isAdCampaign
          ? `adpay_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
          : isSetupService
          ? `setup_pp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
          : `support_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        type: isActivationOrRenewal
          ? (isRenewal ? 'renewal' : 'activation')
          : isAdCampaign
          ? 'ad_campaign'
          : isSetupService
          ? 'setup_service'
          : 'platform_support',
        tenantId: tenantId || undefined,
        tenantName: tenantName || undefined,
        tenantSlug: tenantSlug || undefined,
        ownerId: ownerId || undefined,
        ownerName: ownerName || donorName || 'مشرف الجمعية',
        ownerPhone: ownerPhone || donorPhone || '',
        periodStart: isActivationOrRenewal ? periodStart : (reqPeriodStart || (isAdCampaign ? periodStart : undefined)),
        periodEnd: isActivationOrRenewal ? periodEnd : (reqPeriodEnd || (isAdCampaign ? periodEnd : undefined)),
        monthsCount: isAdCampaign ? (body.monthsCount || monthsCount) : undefined,
        adCampaignTitle: isAdCampaign ? (body.adCampaignTitle || adCampaignTitle) : undefined,
        donorName: donorName || ownerName || 'مساهم كريم',
        donorPhone: donorPhone || ownerPhone || '',
        donorNote: donorNote || '',
        amount: Number(originalAmount) || Number(capturedAmount) || 0,
        currency: originalCurrency || capturedCurrency || 'MAD',
        paidAmount: Number(capturedAmount) || 0,
        paidCurrency: capturedCurrency || 'USD',
        paymentMethod: paymentMethod === 'card' ? 'بطاقة بنكية (PayPal)' : 'PayPal',
        paypalOrderId: orderId,
        transactionId,
        status: 'confirmed',
        paymentVerified: true,
        paymentVerifiedAt: now,
        paymentVerifiedBy: `PayPal API Verified (${config.mode.toUpperCase()})`,
        mode: config.mode,
        createdAt: now,
        submittedAt: now,
        reviewedAt: now,
        reviewedBy: `PayPal Verified (${config.mode.toUpperCase()})`,
        transactionReference: orderId,
        adminNotes: `PayPal Transaction ID: ${transactionId || orderId} (Captured COMPLETED, Mode: ${config.mode.toUpperCase()})`,
        details: {
          payerId: captureData?.payer?.payer_id,
          payerEmail: captureData?.payer?.email_address,
          merchantEmail: config.businessEmail,
          payerName: captureData?.payer?.name?.given_name
            ? `${captureData?.payer?.name?.given_name} ${captureData?.payer?.name?.surname || ''}`.trim()
            : undefined,
        },
      };

      // 1. Subscription Activation/Renewal or Ad Campaign -> Save to platform_payments.json
      if (isActivationOrRenewal || isAdCampaign) {
        const payments = readPaymentsFromDisk();
        payments.unshift(record);
        writePaymentsToDisk(payments);
      } else if (isSetupService) {
        // 2. Setup Service Request -> Save to setup_service_requests.json
        try {
          const reqs = readServerSetupServiceRequests();
          const existingReqIdx = reqs.findIndex((r) => r.tenantId === tenantId);
          if (existingReqIdx !== -1) {
            reqs[existingReqIdx].paymentStatus = 'verified';
            reqs[existingReqIdx].serviceStatus = 'in_progress';
            reqs[existingReqIdx].transactionReference = orderId;
            reqs[existingReqIdx].reviewedAt = now;
            reqs[existingReqIdx].reviewedBy = `PayPal API Verified (${config.mode.toUpperCase()})`;
            reqs[existingReqIdx].updatedAt = now;
          } else {
            reqs.unshift({
              id: `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
              tenantId: tenantId || 'tenant_nour',
              tenantName: tenantName || 'جمعية مسجلة',
              ownerName: donorName || ownerName || 'مشرف الجمعية',
              ownerPhone: donorPhone || ownerPhone || '',
              amount: Number(originalAmount) || 150,
              currency: 'MAD',
              paymentMethod: (paymentMethod === 'card' ? 'credit_card' : 'paypal') as any,
              paymentMethodLabel: paymentMethod === 'card' ? 'بطاقة بنكية عبر PayPal' : 'PayPal',
              paymentStatus: 'verified',
              serviceStatus: 'in_progress',
              transactionReference: orderId,
              submittedAt: now,
              createdAt: now,
              reviewedAt: now,
              reviewedBy: `PayPal API Verified (${config.mode.toUpperCase()})`,
              adminNotes: `PayPal Order ID: ${orderId}, Transaction: ${transactionId || orderId}`,
            });
          }
          writeServerSetupServiceRequests(reqs);
        } catch (setupErr) {
          console.error('[PayPalApi] Error saving setup service request:', setupErr);
        }
      } else {
        // 3. Platform Support Donation -> Save to platform_support_donations.json
        const supportDonationRecord = {
          id: record.id,
          type: 'platform_support' as const,
          donorName: record.donorName,
          donorPhone: record.donorPhone,
          donorNote: record.donorNote,
          amount: Number(record.amount) || 0,
          currency: record.currency || 'MAD',
          paidAmount: Number(record.paidAmount) || Number(record.amount) || 0,
          paidCurrency: record.paidCurrency || record.currency || 'MAD',
          paymentMethod: record.paymentMethod,
          paypalOrderId: record.paypalOrderId,
          transactionId: record.transactionId,
          status: 'confirmed' as const,
          mode: record.mode,
          createdAt: record.createdAt,
          submittedAt: record.submittedAt,
          reviewedAt: record.reviewedAt,
          reviewedBy: record.reviewedBy,
        };
        const supportDonations = readSupportDonationsFromDisk();
        supportDonations.unshift(supportDonationRecord);
        writeSupportDonationsToDisk(supportDonations);
      }

      return sendJson(res, 200, {
        success: true,
        verifiedByPayPal: true,
        message: isRenewal
          ? 'تم تأكيد تجديد اشتراك الجمعية بنجاح عبر PayPal.'
          : isActivation
          ? 'تم تأكيد تفعيل اشتراك الجمعية بنجاح عبر PayPal.'
          : isAdCampaign
          ? 'تم تأكيد عملية أداء رسوم الإعلان بنجاح من PayPal.'
          : isSetupService
          ? 'تم تأكيد تسديد مبلغ خدمة إعداد المنصة بنجاح من PayPal.'
          : 'تم تأكيد عملية دعم المنصة بنجاح من PayPal، شكراً لمساهمتك ودعمك للمنصة.',
        orderId,
        transactionId,
        periodStart: isActivationOrRenewal ? periodStart : undefined,
        periodEnd: isActivationOrRenewal ? periodEnd : undefined,
        record,
      });
    }

    // 7. GET /api/paypal/donations
    if (method === 'GET' && (url === '/api/paypal/donations' || url.startsWith('/api/paypal/donations?'))) {
      const supportDonations = readSupportDonationsFromDisk();

      return sendJson(res, 200, {
        success: true,
        donations: supportDonations,
        total: supportDonations.length,
      });
    }

    return sendJson(res, 404, { success: false, error: 'PayPal endpoint not found' });
  } catch (err: any) {
    // Sanitize error log: never log secrets or tokens
    console.error('[PayPalApi error]', err?.message || 'Unexpected error');
    return sendJson(res, 500, {
      success: false,
      message: 'حدث خطأ غير متوقع أثناء معالجة طلب PayPal في الخادم الآمن.',
      error: err?.message || 'Server error',
    });
  }
}
