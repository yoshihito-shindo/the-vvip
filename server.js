
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const { Resend } = require('resend');
const rateLimit = require('express-rate-limit');

const app = express();

// Supabase Admin client (server-side only, uses service role key)
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabaseAdmin = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

// Supabase client for JWT verification (uses anon key)
const supabaseAuth = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Resend email client
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const EMAIL_FROM = process.env.EMAIL_FROM || 'THE VVIP <onboarding@resend.dev>';

// CORS: 本番は自ドメインのみ許可
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['https://app.thevvip.jp', 'https://the-vvip.onrender.com'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (server-to-server, mobile apps, curl)
    if (!origin || ALLOWED_ORIGINS.includes(origin) || process.env.NODE_ENV === 'development') {
      callback(null, true);
    } else {
      callback(null, true); // Log but allow for now during rollout
      console.warn(`[CORS] Request from unauthorized origin: ${origin}`);
    }
  },
  credentials: true,
}));

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { error: 'リクエスト回数の上限に達しました。しばらくお待ちください。' },
  standardHeaders: true,
  legacyHeaders: false,
});
const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'リクエスト回数の上限に達しました。しばらくお待ちください。' },
});
app.use('/api/', apiLimiter);

// ============================================
// Auth Middleware
// ============================================
async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '認証が必要です。' });
  }

  const token = authHeader.split(' ')[1];
  if (!supabaseAuth) {
    return res.status(500).json({ error: 'Auth service not configured' });
  }

  try {
    const { data: { user }, error } = await supabaseAuth.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ error: '認証トークンが無効です。' });
    }
    req.authUser = user;
    next();
  } catch {
    return res.status(401).json({ error: '認証に失敗しました。' });
  }
}

async function requireAdmin(req, res, next) {
  if (!req.authUser || !supabaseAdmin) {
    return res.status(403).json({ error: '権限がありません。' });
  }

  try {
    const { data } = await supabaseAdmin
      .from('profiles')
      .select('is_admin')
      .eq('id', req.authUser.id)
      .single();

    if (!data?.is_admin) {
      return res.status(403).json({ error: '管理者権限が必要です。' });
    }
    next();
  } catch {
    return res.status(403).json({ error: '権限の確認に失敗しました。' });
  }
}

const STRIPE_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_mock';
const STRIPE_PUB_KEY = process.env.STRIPE_PUBLISHABLE_KEY || '';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';
const stripe = require('stripe')(STRIPE_KEY);

const STRIPE_PRICES = {
  Gold: process.env.STRIPE_PRICE_GOLD || '',
  Platinum: process.env.STRIPE_PRICE_PLATINUM || '',
  VVIP: process.env.STRIPE_PRICE_VVIP || '',
};

// Reverse lookup: priceId → planName
const PRICE_TO_PLAN = {};
Object.entries(STRIPE_PRICES).forEach(([plan, priceId]) => {
  if (priceId) PRICE_TO_PLAN[priceId] = plan;
});

// ============================================
// Helper: Send notification email
// ============================================
async function sendNotificationEmail(userId, subject, htmlBuilder) {
  if (!resend || !supabaseAdmin) return;
  try {
    const { data: userData } = await supabaseAdmin.auth.admin.getUserById(userId);
    const email = userData?.user?.email;
    if (!email) return;

    const { data: profileData } = await supabaseAdmin
      .from('profiles')
      .select('name')
      .eq('id', userId)
      .single();
    const name = profileData?.name || 'お客様';

    await resend.emails.send({
      from: EMAIL_FROM,
      to: email,
      subject,
      html: htmlBuilder(name),
    });
    console.log(`[EMAIL] Sent "${subject}" to ${email}`);
  } catch (err) {
    console.error('[EMAIL] Failed to send notification:', err.message);
  }
}

function buildEmailWrapper(title, bodyContent) {
  const appUrl = process.env.RENDER_EXTERNAL_URL || 'https://the-vvip.onrender.com';
  return `<!DOCTYPE html>
<html lang="ja">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#0a0a0a;font-family:'Helvetica Neue',Arial,'Hiragino Kaku Gothic ProN',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0a0a;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background-color:#111;border:1px solid #222;border-radius:16px;overflow:hidden;">
        <tr><td style="background:linear-gradient(135deg,#1a1a1a,#0d0d0d);padding:48px 40px;text-align:center;border-bottom:1px solid #B8860B;">
          <h1 style="margin:0;font-size:28px;font-weight:300;letter-spacing:8px;color:#D4AF37;font-family:Georgia,serif;">THE VVIP</h1>
          <p style="margin:8px 0 0;font-size:10px;letter-spacing:4px;color:#666;text-transform:uppercase;">Exclusive Members Club</p>
        </td></tr>
        <tr><td style="padding:48px 40px;">
          ${bodyContent}
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td align="center" style="padding:24px 0;">
              <a href="${appUrl}" style="display:inline-block;background:linear-gradient(135deg,#D4AF37,#B8860B);color:#000;text-decoration:none;padding:16px 48px;border-radius:50px;font-size:13px;font-weight:700;letter-spacing:3px;text-transform:uppercase;">アプリを開く</a>
            </td></tr>
          </table>
          <div style="margin-top:40px;padding-top:32px;border-top:1px solid #222;">
            <p style="color:#555;font-size:11px;line-height:1.8;margin:0;">ご不明な点がございましたら、お気軽にお問い合わせください。<br>THE VVIP コンシェルジュチーム</p>
          </div>
        </td></tr>
        <tr><td style="background-color:#0a0a0a;padding:24px 40px;text-align:center;border-top:1px solid #1a1a1a;">
          <p style="color:#333;font-size:10px;letter-spacing:2px;margin:0;">&copy; THE VVIP. All rights reserved.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ============================================
// Stripe Webhook (must be before express.json())
// ============================================
app.post('/api/stripe-webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  let event;

  if (STRIPE_WEBHOOK_SECRET) {
    const sig = req.headers['stripe-signature'];
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      console.error('[WEBHOOK] Signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }
  } else {
    // No secret configured — parse raw body (dev/test only)
    try {
      event = JSON.parse(req.body.toString());
    } catch {
      return res.status(400).send('Invalid JSON');
    }
    console.warn('[WEBHOOK] No STRIPE_WEBHOOK_SECRET set — signature not verified');
  }

  console.log(`[WEBHOOK] Received: ${event.type}`);

  try {
    switch (event.type) {
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        const subscriptionId = invoice.subscription;
        if (!subscriptionId || !supabaseAdmin) break;

        // Find user by stripe_subscription_id
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('id, subscription, pending_downgrade')
          .eq('stripe_subscription_id', subscriptionId)
          .single();

        if (!profile) {
          console.log('[WEBHOOK] No profile found for subscription:', subscriptionId);
          break;
        }

        if (profile.pending_downgrade) {
          // Execute pending downgrade
          const newPriceId = STRIPE_PRICES[profile.pending_downgrade];
          if (newPriceId) {
            const sub = await stripe.subscriptions.retrieve(subscriptionId);
            const itemId = sub.items.data[0]?.id;
            if (itemId) {
              await stripe.subscriptions.update(subscriptionId, {
                items: [{ id: itemId, price: newPriceId }],
                proration_behavior: 'none',
              });
            }
          }

          const now = new Date();
          const threeMonthsLater = new Date(now);
          threeMonthsLater.setMonth(threeMonthsLater.getMonth() + 3);

          await supabaseAdmin.from('profiles').update({
            subscription: profile.pending_downgrade,
            pending_downgrade: null,
            subscription_started_at: now.toISOString(),
            subscription_until: threeMonthsLater.toISOString(),
            payment_failed: false,
          }).eq('id', profile.id);

          console.log(`[WEBHOOK] Downgrade executed: ${profile.id} → ${profile.pending_downgrade}`);

          // Send downgrade notification email
          const downgradePlan = profile.pending_downgrade;
          sendNotificationEmail(profile.id, '【THE VVIP】プラン変更が完了しました', (name) =>
            buildEmailWrapper('プラン変更完了', `
              <p style="color:#999;font-size:14px;margin:0 0 24px;line-height:1.8;">${name} 様</p>
              <h2 style="color:#D4AF37;font-size:22px;font-weight:400;margin:0 0 24px;font-family:Georgia,serif;">プラン変更が完了しました</h2>
              <p style="color:#999;font-size:14px;line-height:2;margin:0 0 32px;">
                ご利用プランが <strong style="color:#fff;">${downgradePlan}</strong> プランに変更されました。<br>
                引き続き THE VVIP をお楽しみください。
              </p>
            `)
          );
        } else {
          // Extend subscription period
          const now = new Date();
          const threeMonthsLater = new Date(now);
          threeMonthsLater.setMonth(threeMonthsLater.getMonth() + 3);

          await supabaseAdmin.from('profiles').update({
            subscription_until: threeMonthsLater.toISOString(),
            payment_failed: false,
          }).eq('id', profile.id);

          console.log(`[WEBHOOK] Subscription renewed: ${profile.id}, until ${threeMonthsLater.toISOString()}`);

          // Send renewal notification email
          const untilDate = threeMonthsLater.toLocaleDateString('ja-JP');
          sendNotificationEmail(profile.id, '【THE VVIP】お支払いが完了しました', (name) =>
            buildEmailWrapper('お支払い完了', `
              <p style="color:#999;font-size:14px;margin:0 0 24px;line-height:1.8;">${name} 様</p>
              <h2 style="color:#D4AF37;font-size:22px;font-weight:400;margin:0 0 24px;font-family:Georgia,serif;">お支払いが完了しました</h2>
              <p style="color:#999;font-size:14px;line-height:2;margin:0 0 32px;">
                今月のサブスクリプション料金のお支払いが正常に処理されました。<br>
                次回更新日: <strong style="color:#fff;">${untilDate}</strong><br><br>
                引き続き THE VVIP をお楽しみください。
              </p>
            `)
          );
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const subscriptionId = invoice.subscription;
        if (!subscriptionId || !supabaseAdmin) break;

        await supabaseAdmin.from('profiles').update({
          payment_failed: true,
        }).eq('stripe_subscription_id', subscriptionId);

        console.log(`[WEBHOOK] Payment failed for subscription: ${subscriptionId}`);

        // Send payment failed email
        const { data: failedProfile } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .eq('stripe_subscription_id', subscriptionId)
          .single();

        if (failedProfile) {
          sendNotificationEmail(failedProfile.id, '【THE VVIP】お支払いに失敗しました', (name) =>
            buildEmailWrapper('お支払い失敗', `
              <p style="color:#999;font-size:14px;margin:0 0 24px;line-height:1.8;">${name} 様</p>
              <h2 style="color:#e74c3c;font-size:22px;font-weight:400;margin:0 0 24px;font-family:Georgia,serif;">お支払いに失敗しました</h2>
              <p style="color:#999;font-size:14px;line-height:2;margin:0 0 32px;">
                サブスクリプション料金のお支払いが正常に処理できませんでした。<br><br>
                お手数ですが、クレジットカード情報をご確認の上、<br>
                お支払い方法を更新してください。<br><br>
                <span style="color:#e74c3c;">お支払いが確認できない場合、サービスが制限される場合がございます。</span>
              </p>
            `)
          );
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        if (!supabaseAdmin) break;

        await supabaseAdmin.from('profiles').update({
          subscription: 'Free',
          stripe_subscription_id: null,
          subscription_started_at: null,
          subscription_until: null,
          pending_downgrade: null,
          payment_failed: false,
        }).eq('stripe_subscription_id', subscription.id);

        console.log(`[WEBHOOK] Subscription deleted: ${subscription.id}`);

        // Send cancellation email (find user by metadata)
        const cancelUserId = subscription.metadata?.userId;
        if (cancelUserId) {
          sendNotificationEmail(cancelUserId, '【THE VVIP】サブスクリプションが解約されました', (name) =>
            buildEmailWrapper('解約完了', `
              <p style="color:#999;font-size:14px;margin:0 0 24px;line-height:1.8;">${name} 様</p>
              <h2 style="color:#fff;font-size:22px;font-weight:400;margin:0 0 24px;font-family:Georgia,serif;">サブスクリプションが解約されました</h2>
              <p style="color:#999;font-size:14px;line-height:2;margin:0 0 32px;">
                サブスクリプションの解約が完了しました。<br>
                これまでのご利用、誠にありがとうございました。<br><br>
                いつでも再登録いただけますので、<br>
                またのご利用を心よりお待ちしております。
              </p>
            `)
          );
        }
        break;
      }
    }
  } catch (err) {
    console.error(`[WEBHOOK] Error handling ${event.type}:`, err.message);
  }

  res.json({ received: true });
});

app.use(express.json());

app.use((req, res, next) => {
  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
  next();
});

app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'online',
    identity: 'THE-VVIP-System-v2',
    stripe_mode: STRIPE_KEY.startsWith('sk_live') ? 'live' : 'test',
    has_pub_key: !!STRIPE_PUB_KEY,
    server_time: new Date().toISOString()
  });
});

// クライアント側で必要な設定情報を返す
app.get('/api/config', (req, res) => {
  res.status(200).json({
    publishableKey: STRIPE_PUB_KEY || null,
    mode: STRIPE_KEY.startsWith('sk_live') ? 'live' : 'test'
  });
});

// ============================================
// Subscription: Create Stripe Subscription
// ============================================
app.post('/api/create-subscription', requireAuth, strictLimiter, async (req, res) => {
  const { planId, paymentMethodId, userId } = req.body;

  if (STRIPE_KEY === 'sk_test_mock') {
    return res.status(400).json({ error: 'Stripe Secret Keyが設定されていません。' });
  }

  const priceId = STRIPE_PRICES[planId];
  if (!priceId) {
    return res.status(400).json({ error: `Invalid plan: ${planId}` });
  }

  try {
    // 1. Check if user already has a Stripe Customer ID
    let stripeCustomerId = null;
    if (supabaseAdmin && userId) {
      const { data } = await supabaseAdmin
        .from('profiles')
        .select('stripe_customer_id')
        .eq('id', userId)
        .single();
      stripeCustomerId = data?.stripe_customer_id;
    }

    // 2. Create or reuse Stripe Customer
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        metadata: { userId },
      });
      stripeCustomerId = customer.id;

      // Save customer ID to profile
      if (supabaseAdmin && userId) {
        await supabaseAdmin
          .from('profiles')
          .update({ stripe_customer_id: stripeCustomerId })
          .eq('id', userId);
      }
    }

    // 3. Attach payment method to customer
    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: stripeCustomerId,
    });
    await stripe.customers.update(stripeCustomerId, {
      invoice_settings: { default_payment_method: paymentMethodId },
    });

    // 4. Create subscription (minimum 3 months commitment)
    const threeMonthsLater = Math.floor(Date.now() / 1000) + (90 * 24 * 60 * 60);
    const subscription = await stripe.subscriptions.create({
      customer: stripeCustomerId,
      items: [{ price: priceId }],
      metadata: { userId, planId, min_commitment_until: new Date(threeMonthsLater * 1000).toISOString() },
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand: ['latest_invoice.payment_intent'],
    });

    const clientSecret = subscription.latest_invoice?.payment_intent?.client_secret;

    res.json({
      subscriptionId: subscription.id,
      clientSecret,
      status: subscription.status,
    });
  } catch (error) {
    console.error('[STRIPE SUBSCRIPTION ERROR]:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// Subscription: Get subscription status
// ============================================
app.get('/api/subscription-status/:userId', requireAuth, async (req, res) => {
  const { userId } = req.params;

  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'Supabase is not configured on server' });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('subscription, subscription_started_at, subscription_until, stripe_subscription_id, pending_downgrade')
      .eq('id', userId)
      .single();

    if (error) throw error;

    const now = new Date();
    const commitmentEnd = data.subscription_until ? new Date(data.subscription_until) : null;
    const isWithinCommitment = commitmentEnd ? now < commitmentEnd : false;
    const remainingDays = commitmentEnd
      ? Math.max(0, Math.ceil((commitmentEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
      : 0;

    res.json({
      subscription: data.subscription,
      startedAt: data.subscription_started_at,
      commitmentUntil: data.subscription_until,
      stripeSubscriptionId: data.stripe_subscription_id,
      pendingDowngrade: data.pending_downgrade || null,
      isWithinCommitment,
      remainingDays,
    });
  } catch (error) {
    console.error('[SUBSCRIPTION STATUS ERROR]:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// Subscription: Change plan (upgrade/downgrade)
// ============================================
const PLAN_TIER = { Gold: 1, Platinum: 2, VVIP: 3 };

app.post('/api/change-subscription', requireAuth, strictLimiter, async (req, res) => {
  const { userId, newPlanId } = req.body;

  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'Supabase is not configured on server' });
  }
  if (STRIPE_KEY === 'sk_test_mock') {
    return res.status(400).json({ error: 'Stripe Secret Keyが設定されていません。' });
  }

  const newPriceId = STRIPE_PRICES[newPlanId];
  if (!newPriceId) {
    return res.status(400).json({ error: `無効なプラン: ${newPlanId}` });
  }

  try {
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('subscription, stripe_subscription_id, pending_downgrade')
      .eq('id', userId)
      .single();

    if (profileError) throw profileError;

    if (!profile.stripe_subscription_id) {
      return res.status(400).json({ error: '有効なサブスクリプションがありません。' });
    }

    const currentTier = PLAN_TIER[profile.subscription] || 0;
    const newTier = PLAN_TIER[newPlanId] || 0;

    if (currentTier === newTier) {
      return res.status(400).json({ error: '現在と同じプランです。' });
    }

    // Get current subscription to find the item ID
    const subscription = await stripe.subscriptions.retrieve(profile.stripe_subscription_id);
    const itemId = subscription.items.data[0]?.id;
    if (!itemId) {
      return res.status(400).json({ error: 'サブスクリプション情報の取得に失敗しました。' });
    }

    if (newTier > currentTier) {
      // === UPGRADE: immediate with proration ===
      await stripe.subscriptions.update(profile.stripe_subscription_id, {
        items: [{ id: itemId, price: newPriceId }],
        proration_behavior: 'create_prorations',
        metadata: { ...subscription.metadata, planId: newPlanId },
      });

      await supabaseAdmin
        .from('profiles')
        .update({ subscription: newPlanId, pending_downgrade: null })
        .eq('id', userId);

      console.log(`[PLAN CHANGE] User ${userId}: ${profile.subscription} → ${newPlanId} (upgrade, immediate)`);
      res.json({ success: true, type: 'upgrade', message: `${newPlanId}プランにアップグレードしました。差額は日割りで請求されます。` });

    } else {
      // === DOWNGRADE: at next billing period ===
      await stripe.subscriptions.update(profile.stripe_subscription_id, {
        metadata: { ...subscription.metadata, planId: newPlanId, pending_downgrade: newPlanId },
      });

      await supabaseAdmin
        .from('profiles')
        .update({ pending_downgrade: newPlanId })
        .eq('id', userId);

      console.log(`[PLAN CHANGE] User ${userId}: ${profile.subscription} → ${newPlanId} (downgrade, scheduled)`);
      res.json({ success: true, type: 'downgrade', message: `次回更新時に${newPlanId}プランに変更されます。` });
    }
  } catch (error) {
    console.error('[CHANGE SUBSCRIPTION ERROR]:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// Subscription: Cancel (with 3-month check)
// ============================================
app.post('/api/cancel-subscription', requireAuth, strictLimiter, async (req, res) => {
  const { userId } = req.body;

  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'Supabase is not configured on server' });
  }

  try {
    // 1. Get current subscription info
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('subscription, subscription_until, stripe_subscription_id')
      .eq('id', userId)
      .single();

    if (profileError) throw profileError;

    if (profile.subscription === 'Free') {
      return res.status(400).json({ error: '現在有料プランに加入していません。' });
    }

    // 2. Check 3-month commitment
    const now = new Date();
    const commitmentEnd = profile.subscription_until ? new Date(profile.subscription_until) : null;

    if (commitmentEnd && now < commitmentEnd) {
      const remainingDays = Math.ceil((commitmentEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return res.status(403).json({
        error: `最低契約期間内のため解約できません。残り${remainingDays}日（${commitmentEnd.toLocaleDateString('ja-JP')}まで）`,
        remainingDays,
        commitmentUntil: profile.subscription_until,
      });
    }

    // 3. Cancel on Stripe if subscription exists
    if (profile.stripe_subscription_id && STRIPE_KEY !== 'sk_test_mock') {
      await stripe.subscriptions.cancel(profile.stripe_subscription_id);
      console.log(`[STRIPE] Cancelled subscription: ${profile.stripe_subscription_id}`);
    }

    // 4. Update DB
    await supabaseAdmin
      .from('profiles')
      .update({
        subscription: 'Free',
        stripe_subscription_id: null,
        subscription_started_at: null,
        subscription_until: null,
      })
      .eq('id', userId);

    res.json({ success: true, message: 'サブスクリプションを解約しました。' });
  } catch (error) {
    console.error('[CANCEL SUBSCRIPTION ERROR]:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// Admin: Billing dashboard data
// ============================================
app.get('/api/admin/billing', requireAuth, requireAdmin, async (req, res) => {
  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'Supabase is not configured on server' });
  }

  try {
    // 1. Subscriber counts from DB
    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('subscription')
      .neq('subscription', 'Free')
      .eq('is_ai_generated', false);

    const subscribers = { Gold: 0, Platinum: 0, VVIP: 0 };
    (profiles || []).forEach(p => {
      if (subscribers[p.subscription] !== undefined) subscribers[p.subscription]++;
    });

    // 2. Recent charges from Stripe
    let recentPayments = [];
    let totalRevenue = 0;
    let monthlyRevenue = 0;

    if (STRIPE_KEY !== 'sk_test_mock') {
      const now = new Date();
      const monthStart = Math.floor(new Date(now.getFullYear(), now.getMonth(), 1).getTime() / 1000);

      // Recent 20 successful charges
      const charges = await stripe.charges.list({ limit: 20, status: 'succeeded' });
      recentPayments = charges.data.map(c => ({
        id: c.id,
        amount: c.amount,
        currency: c.currency,
        created: c.created,
        description: c.description || '',
        customer: c.customer,
      }));

      // Monthly revenue
      const monthCharges = await stripe.charges.list({ created: { gte: monthStart }, status: 'succeeded', limit: 100 });
      monthlyRevenue = monthCharges.data.reduce((sum, c) => sum + c.amount, 0);

      // Total revenue (balance transactions)
      const balance = await stripe.balance.retrieve();
      totalRevenue = balance.available.reduce((sum, b) => sum + b.amount, 0) + balance.pending.reduce((sum, b) => sum + b.amount, 0);
    }

    res.json({
      subscribers,
      totalSubscribers: Object.values(subscribers).reduce((a, b) => a + b, 0),
      recentPayments,
      monthlyRevenue,
      totalRevenue,
    });
  } catch (error) {
    console.error('[ADMIN BILLING ERROR]:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// Account: Delete account
// ============================================
app.post('/api/delete-account', requireAuth, strictLimiter, async (req, res) => {
  const { userId } = req.body;

  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'Supabase is not configured on server' });
  }

  // Verify the requesting user is the account owner
  if (req.authUser.id !== userId) {
    return res.status(403).json({ error: '自分のアカウントのみ削除できます。' });
  }

  try {
    // 1. Get profile to check for Stripe subscription
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('stripe_subscription_id, stripe_customer_id')
      .eq('id', userId)
      .single();

    // 2. Cancel Stripe subscription if exists
    if (profile?.stripe_subscription_id && STRIPE_KEY !== 'sk_test_mock') {
      try {
        await stripe.subscriptions.cancel(profile.stripe_subscription_id);
        console.log(`[DELETE] Cancelled Stripe subscription: ${profile.stripe_subscription_id}`);
      } catch (stripeErr) {
        console.warn(`[DELETE] Stripe cancel failed (may already be cancelled):`, stripeErr.message);
      }
    }

    // 3. Delete profile from DB
    const { error: deleteError } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('id', userId);
    if (deleteError) throw deleteError;

    // 4. Delete auth user
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (authError) throw authError;

    console.log(`[DELETE] Account deleted: ${userId}`);
    res.json({ success: true, message: 'アカウントを削除しました。' });
  } catch (error) {
    console.error('[DELETE ACCOUNT ERROR]:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// Admin: Get signed URL for verification image
// ============================================
app.get('/api/admin/verification-image/:userId', requireAuth, requireAdmin, async (req, res) => {
  const { userId } = req.params;

  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'Supabase is not configured on server' });
  }

  try {
    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('verification_image_url')
      .eq('id', userId)
      .single();

    if (error) throw error;
    if (!profile?.verification_image_url) {
      return res.status(404).json({ error: '身分証画像が見つかりません。' });
    }

    // Extract storage path from full URL
    // URL format: https://xxx.supabase.co/storage/v1/object/public/verification-docs/userId/file.jpg
    const url = profile.verification_image_url;
    const bucketPath = url.includes('/verification-docs/')
      ? url.split('/verification-docs/')[1]
      : null;

    if (!bucketPath) {
      return res.status(400).json({ error: '画像パスの解析に失敗しました。' });
    }

    const { data: signedData, error: signError } = await supabaseAdmin.storage
      .from('verification-docs')
      .createSignedUrl(bucketPath, 3600); // 1 hour

    if (signError) throw signError;

    res.json({ signedUrl: signedData.signedUrl });
  } catch (error) {
    console.error('[VERIFICATION IMAGE ERROR]:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// Admin: Approve/Reject user KYC
// ============================================
app.post('/api/admin/approve-user', requireAuth, requireAdmin, async (req, res) => {
  const { userId, action } = req.body;

  if (!userId || !['approve', 'reject'].includes(action)) {
    return res.status(400).json({ error: 'userId and action (approve|reject) are required' });
  }

  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'Supabase is not configured on server' });
  }

  try {
    // 1. Update profile status
    if (action === 'approve') {
      const { error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({ status: 'Gold', is_verified: true })
        .eq('id', userId);
      if (updateError) throw updateError;
    } else {
      const { error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({ status: 'Pending', is_verified: false, verification_image_url: null })
        .eq('id', userId);
      if (updateError) throw updateError;
    }

    // 2. Get user email from auth.users
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (userError) {
      console.error('[EMAIL] Failed to get user email:', userError.message);
      return res.json({ success: true, emailSent: false, reason: 'Could not retrieve user email' });
    }

    const userEmail = userData?.user?.email;
    if (!userEmail) {
      return res.json({ success: true, emailSent: false, reason: 'User has no email' });
    }

    // 3. Get user name from profiles
    const { data: profileData } = await supabaseAdmin
      .from('profiles')
      .select('name')
      .eq('id', userId)
      .single();
    const userName = profileData?.name || 'お客様';

    // 4. Send email via Resend
    if (!resend) {
      console.warn('[EMAIL] RESEND_API_KEY not set, skipping email');
      return res.json({ success: true, emailSent: false, reason: 'RESEND_API_KEY not configured' });
    }

    const emailHtml = action === 'approve'
      ? buildApprovalEmail(userName)
      : buildRejectionEmail(userName);

    const emailSubject = action === 'approve'
      ? '【THE VVIP】本人確認が承認されました'
      : '【THE VVIP】本人確認の再提出のお願い';

    const { error: emailError } = await resend.emails.send({
      from: EMAIL_FROM,
      to: userEmail,
      subject: emailSubject,
      html: emailHtml,
    });

    if (emailError) {
      console.error('[EMAIL] Send failed:', emailError);
      return res.json({ success: true, emailSent: false, reason: emailError.message });
    }

    console.log(`[EMAIL] ${action} notification sent to ${userEmail}`);
    res.json({ success: true, emailSent: true });

  } catch (error) {
    console.error('[ADMIN ERROR]:', error.message);
    res.status(500).json({ error: error.message });
  }
});

function buildApprovalEmail(userName) {
  const appUrl = process.env.RENDER_EXTERNAL_URL || 'https://the-vvip.onrender.com';
  return `<!DOCTYPE html>
<html lang="ja">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#0a0a0a;font-family:'Helvetica Neue',Arial,'Hiragino Kaku Gothic ProN',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0a0a;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background-color:#111;border:1px solid #222;border-radius:16px;overflow:hidden;">
        <tr><td style="background:linear-gradient(135deg,#1a1a1a,#0d0d0d);padding:48px 40px;text-align:center;border-bottom:1px solid #B8860B;">
          <h1 style="margin:0;font-size:28px;font-weight:300;letter-spacing:8px;color:#D4AF37;font-family:Georgia,serif;">THE VVIP</h1>
          <p style="margin:8px 0 0;font-size:10px;letter-spacing:4px;color:#666;text-transform:uppercase;">Exclusive Members Club</p>
        </td></tr>
        <tr><td style="padding:48px 40px;">
          <p style="color:#999;font-size:14px;margin:0 0 24px;line-height:1.8;">${userName} 様</p>
          <h2 style="color:#D4AF37;font-size:22px;font-weight:400;margin:0 0 24px;font-family:Georgia,serif;">本人確認が承認されました</h2>
          <p style="color:#999;font-size:14px;line-height:2;margin:0 0 32px;">
            この度は本人確認書類のご提出、誠にありがとうございます。<br>
            厳正な審査の結果、お客様の本人確認が完了いたしました。<br><br>
            これより、THE VVIP の全てのサービスをご利用いただけます。
          </p>
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td align="center" style="padding:16px 0;">
              <a href="${appUrl}" style="display:inline-block;background:linear-gradient(135deg,#D4AF37,#B8860B);color:#000;text-decoration:none;padding:16px 48px;border-radius:50px;font-size:13px;font-weight:700;letter-spacing:3px;text-transform:uppercase;">ラウンジへ入る</a>
            </td></tr>
          </table>
          <div style="margin-top:40px;padding-top:32px;border-top:1px solid #222;">
            <p style="color:#555;font-size:11px;line-height:1.8;margin:0;">ご不明な点がございましたら、お気軽にお問い合わせください。<br>THE VVIP コンシェルジュチーム</p>
          </div>
        </td></tr>
        <tr><td style="background-color:#0a0a0a;padding:24px 40px;text-align:center;border-top:1px solid #1a1a1a;">
          <p style="color:#333;font-size:10px;letter-spacing:2px;margin:0;">&copy; THE VVIP. All rights reserved.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function buildRejectionEmail(userName) {
  const appUrl = process.env.RENDER_EXTERNAL_URL || 'https://the-vvip.onrender.com';
  return `<!DOCTYPE html>
<html lang="ja">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#0a0a0a;font-family:'Helvetica Neue',Arial,'Hiragino Kaku Gothic ProN',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0a0a;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background-color:#111;border:1px solid #222;border-radius:16px;overflow:hidden;">
        <tr><td style="background:linear-gradient(135deg,#1a1a1a,#0d0d0d);padding:48px 40px;text-align:center;border-bottom:1px solid #B8860B;">
          <h1 style="margin:0;font-size:28px;font-weight:300;letter-spacing:8px;color:#D4AF37;font-family:Georgia,serif;">THE VVIP</h1>
          <p style="margin:8px 0 0;font-size:10px;letter-spacing:4px;color:#666;text-transform:uppercase;">Exclusive Members Club</p>
        </td></tr>
        <tr><td style="padding:48px 40px;">
          <p style="color:#999;font-size:14px;margin:0 0 24px;line-height:1.8;">${userName} 様</p>
          <h2 style="color:#fff;font-size:22px;font-weight:400;margin:0 0 24px;font-family:Georgia,serif;">本人確認書類の再提出のお願い</h2>
          <p style="color:#999;font-size:14px;line-height:2;margin:0 0 32px;">
            ご提出いただいた本人確認書類を確認いたしましたが、<br>
            以下の理由により承認に至りませんでした。<br><br>
            ・書類の内容が確認できなかった<br>
            ・画像が不鮮明であった<br><br>
            お手数ですが、再度書類をご提出いただけますようお願い申し上げます。
          </p>
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td align="center" style="padding:16px 0;">
              <a href="${appUrl}" style="display:inline-block;background:linear-gradient(135deg,#D4AF37,#B8860B);color:#000;text-decoration:none;padding:16px 48px;border-radius:50px;font-size:13px;font-weight:700;letter-spacing:3px;text-transform:uppercase;">再提出する</a>
            </td></tr>
          </table>
          <div style="margin-top:40px;padding-top:32px;border-top:1px solid #222;">
            <p style="color:#555;font-size:11px;line-height:1.8;margin:0;">ご不明な点がございましたら、お気軽にお問い合わせください。<br>THE VVIP コンシェルジュチーム</p>
          </div>
        </td></tr>
        <tr><td style="background-color:#0a0a0a;padding:24px 40px;text-align:center;border-top:1px solid #1a1a1a;">
          <p style="color:#333;font-size:10px;letter-spacing:2px;margin:0;">&copy; THE VVIP. All rights reserved.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

const distPath = path.join(__dirname, 'dist');
const staticPath = fs.existsSync(distPath) ? distPath : __dirname;
app.use(express.static(staticPath));

app.get('*', (req, res) => {
  if (req.url.startsWith('/api/')) {
    return res.status(404).json({ error: 'API not found' });
  }
  const indexPath = path.join(staticPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('Web assets missing.');
  }
});

const PORT = process.env.PORT || 3001;
app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`
  ==========================================
  🚀 THE VVIP DEPLOYED SUCCESSFULLY
  ==========================================
  Port: ${PORT}
  Stripe Secret: ${STRIPE_KEY.startsWith('sk_live') ? 'LIVE (SET)' : STRIPE_KEY === 'sk_test_mock' ? 'NOT SET' : 'TEST (SET)'}
  Stripe Public: ${STRIPE_PUB_KEY ? 'SET (' + STRIPE_PUB_KEY.substring(0, 7) + '...)' : 'NOT SET'}
  Backend URL: ${process.env.RENDER_EXTERNAL_URL || 'http://localhost:'+PORT}
  ==========================================
  `);
});
