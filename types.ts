
export enum Gender {
  Male = 'Male',
  Female = 'Female',
}

export enum AccountStatus {
  Pending = 'Pending',
  Approved = 'Approved',
  Gold = 'Gold',
  Black = 'Black',
}

export enum SubscriptionPlan {
  Free = 'Free',
  Gold = 'Gold',         // ¥19,800/月
  Platinum = 'Platinum', // ¥29,800/月
  VVIP = 'VVIP',         // ¥49,800/月
}

export interface UserProfile {
  id: string;
  name: string;
  phone: string;
  age: number;
  gender: Gender;
  occupation: string;
  income: string;
  education: string;
  location: string;
  height: number;
  bodyType: string;
  bio: string;
  imageUrls: string[];
  tags: string[];
  isVerified: boolean;
  status: AccountStatus;
  subscription: SubscriptionPlan;
  subscriptionStartedAt?: number;
  subscriptionUntil?: number;
  stripeSubscriptionId?: string;
  verificationImageUrl?: string;
  pendingDowngrade?: string;
  is_admin?: boolean;
  is_ai_generated?: boolean;
}

export interface Message {
  id: string;
  senderId: string;
  text: string;
  timestamp: number;
  isRead: boolean;
}

export interface Match {
  id: string;
  profile: UserProfile;
  lastMessage?: string;
  lastMessageTime?: number;
  unreadCount: number;
}

export interface Footprint {
  id: string;
  visitor: UserProfile;
  timestamp: number;
  isNew: boolean;
}

export interface LikeReceived {
  id: string;
  user: UserProfile;
  timestamp: number;
  isNew: boolean;
}

// ============================================
// DB Row <-> TypeScript type conversions
// ============================================

export function dbRowToProfile(row: any): UserProfile {
  return {
    id: row.id,
    name: row.name || '',
    phone: row.phone || '',
    age: row.age || 25,
    gender: row.gender as Gender || Gender.Male,
    occupation: row.occupation || '',
    income: row.income || '',
    education: row.education || '',
    location: row.location || '',
    height: row.height || 170,
    bodyType: row.body_type || '',
    bio: row.bio || '',
    imageUrls: row.image_urls || ['https://picsum.photos/seed/default/400/400'],
    tags: row.tags || [],
    isVerified: row.is_verified || false,
    status: row.status as AccountStatus || AccountStatus.Pending,
    subscription: row.subscription as SubscriptionPlan || SubscriptionPlan.Free,
    subscriptionStartedAt: row.subscription_started_at ? new Date(row.subscription_started_at).getTime() : undefined,
    subscriptionUntil: row.subscription_until ? new Date(row.subscription_until).getTime() : undefined,
    stripeSubscriptionId: row.stripe_subscription_id || undefined,
    verificationImageUrl: row.verification_image_url || undefined,
    pendingDowngrade: row.pending_downgrade || undefined,
    is_admin: row.is_admin || false,
    is_ai_generated: row.is_ai_generated || false,
  };
}

export function profileToDbRow(profile: Partial<UserProfile>): Record<string, any> {
  const row: Record<string, any> = {};
  if (profile.name !== undefined) row.name = profile.name;
  if (profile.phone !== undefined) row.phone = profile.phone;
  if (profile.age !== undefined) row.age = profile.age;
  if (profile.gender !== undefined) row.gender = profile.gender;
  if (profile.occupation !== undefined) row.occupation = profile.occupation;
  if (profile.income !== undefined) row.income = profile.income;
  if (profile.education !== undefined) row.education = profile.education;
  if (profile.location !== undefined) row.location = profile.location;
  if (profile.height !== undefined) row.height = profile.height;
  if (profile.bodyType !== undefined) row.body_type = profile.bodyType;
  if (profile.bio !== undefined) row.bio = profile.bio;
  if (profile.imageUrls !== undefined) row.image_urls = profile.imageUrls;
  if (profile.tags !== undefined) row.tags = profile.tags;
  if (profile.isVerified !== undefined) row.is_verified = profile.isVerified;
  if (profile.verificationImageUrl !== undefined) row.verification_image_url = profile.verificationImageUrl;
  if (profile.status !== undefined) row.status = profile.status;
  if (profile.subscription !== undefined) row.subscription = profile.subscription;
  if (profile.subscriptionStartedAt !== undefined) row.subscription_started_at = new Date(profile.subscriptionStartedAt).toISOString();
  if (profile.subscriptionUntil !== undefined) row.subscription_until = new Date(profile.subscriptionUntil).toISOString();
  if (profile.stripeSubscriptionId !== undefined) row.stripe_subscription_id = profile.stripeSubscriptionId;
  if (profile.pendingDowngrade !== undefined) row.pending_downgrade = profile.pendingDowngrade;
  return row;
}
