/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UserRole = 'Admin' | 'Treasurer' | 'Auditor' | 'Viewer';

export type TransactionStatus = 'Pending' | 'Approved' | 'Rejected';

export type TransactionType = 'Income' | 'Expense';

export type OrganizationCurrency = 'INR' | 'USD' | 'EUR' | 'GBP' | 'AED';

export const CURRENCY_SYMBOLS: Record<OrganizationCurrency, string> = {
  INR: '₹',
  USD: '$',
  EUR: '€',
  GBP: '£',
  AED: 'د.إ'
};

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  lastActiveOrgId?: string;
  joinedAt: string;
  phone?: string;
  bio?: string;
  preferredCurrency?: string;
  notificationPreferences?: {
    transactionEvents: boolean;
    memberActivities: boolean;
    campaignUpdates: boolean;
    whatsappAlerts: boolean;
  };
}

export interface Organization {
  id: string;
  name: string;
  logoUrl?: string;
  currency: OrganizationCurrency;
  createdAt: string;
  slug: string; // Used for public transparency page
  description?: string;
  transparencyEnabled?: boolean;
}

export interface OrganizationMember {
  id: string; // Unique relationship code or memberId
  orgId: string;
  userId: string;
  userName: string;
  userEmail: string;
  userAvatarUrl?: string;
  role: UserRole;
  status: 'Active' | 'Suspended';
  joinedAt: string;
}

export interface InviteLink {
  id: string;
  orgId: string;
  role: UserRole;
  code: string; // join code or token
  expiresAt: string | null;
  usageLimit: number | null;
  usageCount: number;
  isRevoked: boolean;
  createdAt: string;
  createdBy: string; // User ID
}

export interface Transaction {
  id: string;
  orgId: string;
  type: TransactionType;
  title: string;
  amount: number;
  category: string;
  description: string;
  date: string;
  status: TransactionStatus;
  receiptName?: string;
  receiptData?: string; // base64 URI or local URL for receipts
  createdAt: string;
  createdByUserId: string;
  createdByUserName: string;
  approvedByUserId?: string;
  approvedByUserName?: string;
  approvalDate?: string;
  campaignId?: string; // Opt linkage to fundraising campaign

  // Soft delete and Approval tracking fields
  deletedAt?: string | null;
  deletedBy?: string | null;
  deletionReason?: string | null;
  deletionStatus?: 'none' | 'requested' | 'approved' | 'rejected';
  deletionRequestedBy?: string | null;
  deletionRequestedAt?: string | null;
  deletionApprovedBy?: string | null;
  deletionApprovedAt?: string | null;
  deletionRejectedBy?: string | null;
  deletionRejectedAt?: string | null;
}

export interface Campaign {
  id: string;
  orgId: string;
  title: string;
  description: string;
  goalAmount: number;
  startDate: string;
  endDate: string;
  status: 'Active' | 'Completed' | 'Draft' | 'Paused';
  createdAt: string;
}

export interface AuditLog {
  id: string;
  orgId: string;
  userId: string;
  userName: string;
  action: string; // e.g., 'transaction_created', 'member_joined', etc.
  details: string; // brief human readable description
  ipAddress?: string;
  timestamp: string;
}

export interface OrganizationNotification {
  id: string;
  orgId: string;
  userId: string; // target user
  type: 'IncomeAdded' | 'ExpenseAdded' | 'TransactionApproved' | 'TransactionRejected' | 'DonationReceived' | 'MemberJoined' | string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;

  // Targeting preferences
  targetUserId?: string | null;
  targetRole?: UserRole | null;
  visibilityScope?: 'all_admins' | 'role_based' | 'user_specific' | 'public_members';
  relatedEntityType?: string;
  relatedEntityId?: string;
}

export interface UserSession {
  token: string;
  user: UserProfile;
}

export type BorrowType = 'borrowed_from_union' | 'borrowed_by_union';
export type BorrowStatus = 'active' | 'partially_paid' | 'fully_paid' | 'overdue' | 'waived';

export interface BorrowRecord {
  id: string;
  orgId: string;
  type: BorrowType;
  borrowerName: string;
  lenderName: string;
  amount: number;
  amountRepaid: number;
  balanceDue: number;
  purpose: string;
  dueDate: string;
  status: BorrowStatus;
  createdBy: string;
  createdByName?: string;
  approvedBy?: string | null;
  approvedByName?: string | null;
  createdAt: string;
  updatedAt: string;
  notes: string;
  publicVisible: boolean;
}

export interface BorrowRepayment {
  id: string;
  borrowRecordId: string;
  orgId: string;
  amount: number;
  paymentDate: string;
  paymentMethod: string;
  note: string;
  recordedBy: string;
  recordedByName?: string;
  createdAt: string;
  transactionId?: string | null;
}
