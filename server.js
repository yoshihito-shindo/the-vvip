
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const { Resend } = require('resend');

const app = express();

// Supabase Admin client (server-side only, uses service role key)
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

// Resend email client
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const EMAIL_FROM = process.env.EMAIL_FROM || 'THE VVIP <onboarding@resend.dev>';

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
  next();
});

const STRIPE_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_mock';
const STRIPE_PUB_KEY = process.env.STRIPE_PUBLISHABLE_KEY || '';
const stripe = require('stripe')(STRIPE_KEY);

const STRIPE_PRICES = {
  Gold: process.env.STRIPE_PRICE_GOLD || '',
  Platinum: process.env.STRIPE_PRICE_PLATINUM || '',
  VVIP: process.env.STRIPE_PRICE_VVIP || '',
};

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
app.post('/api/create-subscription', async (req, res) => {
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
app.get('/api/subscription-status/:userId', async (req, res) => {
  const { userId } = req.params;

  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'Supabase is not configured on server' });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('subscription, subscription_started_at, subscription_until, stripe_subscription_id')
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
      isWithinCommitment,
      remainingDays,
    });
  } catch (error) {
    console.error('[SUBSCRIPTION STATUS ERROR]:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// Subscription: Cancel (with 3-month check)
// ============================================
app.post('/api/cancel-subscription', async (req, res) => {
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
// Admin: Approve/Reject user KYC
// ============================================
app.post('/api/admin/approve-user', async (req, res) => {
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
