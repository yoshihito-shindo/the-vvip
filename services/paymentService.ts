import { supabase } from './supabaseClient';
import { SubscriptionPlan } from '../types';

export const paymentService = {
  async recordPayment(
    userId: string,
    plan: SubscriptionPlan,
    amount: number,
    stripeSubscriptionId?: string
  ): Promise<void> {
    const { error } = await supabase.from('payments').insert({
      user_id: userId,
      plan,
      amount,
      stripe_payment_intent_id: stripeSubscriptionId || null,
      status: 'succeeded',
    });
    if (error) throw error;

    // Update user's subscription and commitment period
    const now = new Date();
    const threeMonthsLater = new Date(now);
    threeMonthsLater.setMonth(threeMonthsLater.getMonth() + 3);

    await supabase.from('profiles').update({
      subscription: plan,
      stripe_subscription_id: stripeSubscriptionId || null,
      subscription_started_at: now.toISOString(),
      subscription_until: threeMonthsLater.toISOString(),
    }).eq('id', userId);
  },

  async getPaymentHistory(userId: string) {
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },
};
