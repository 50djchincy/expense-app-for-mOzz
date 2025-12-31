export type UserRole = 'ADMIN' | 'MANAGER' | 'STAFF';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  createdAt: number;
}

export type AccountType = 'ASSET' | 'LIABILITY' | 'RECEIVABLE' | 'REVENUE' | 'EXPENSE';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  balance: number;
  icon: string;
}

// NEW: Contact Interface for Vendors/Suppliers
export interface Contact {
  id: string;
  name: string;
  type: 'VENDOR' | 'SUPPLIER' | 'OTHER';
  phone?: string;
  email?: string;
  defaultCategory?: string; // Helper to auto-fill category
  taxId?: string;
  notes?: string;
}

export interface Customer {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  totalDebt: number;
  createdAt: number;
}

export interface Transaction {
  id: string;
  date: number;
  amount: number;
  fromAccountId: string;
  toAccountId: string;
  description: string;
  category: string;
  createdBy: string;
  receiptUrl?: string;
  
  // Updated for Pending/IOU Workflow
  isSettled?: boolean;      // False if "Payment Pending"
  dueDate?: number;         // Date when the payment is due (for 7-day alerts)
  contactId?: string;       // Link to the Contact (Vendor)
  
  staffId?: string;
  customerId?: string;      // Link for Credit Bills (Receivables)
  notes?: string;
}

export interface StaffMember {
  id: string;
  name: string;
  role: string;
  salary: number;
  loanBalance: number;
  loanInstallment: number;
  color: string;
  isActive: boolean;
  joinedAt: number;
}

export interface HolidayRecord {
  id: string;
  staffId: string;
  date: string; // YYYY-MM-DD
}

export interface HikingBarTransaction {
  id: string;
  date: number;
  amount: number;
  description: string;
  status: 'PENDING' | 'RECONCILED';
  reconciledAt?: number;
  reconciledBy?: string;
  settlementData?: {
    cash: number;
    card: number;
    serviceCharge: number;
    contra: number;
  };
}

export interface Shift {
  id: string;
  status: 'OPEN' | 'CLOSED';
  openedAt: number;
  openedBy: string;
  openingFloat: number;
  closedAt?: number;
  closedBy?: string;
  
  totalSales?: number;
  cardPayments?: number;
  creditBills?: number;
  creditBillCustomerId?: string;
  hikingBarSales?: number;
  foreignCurrencyAmount?: number;
  foreignCurrencyNotes?: string;
  
  expectedCash?: number;
  actualCash?: number;
  variance?: number;
  
  notes?: string;
}

export interface ExpenseTemplate {
  id: string;
  name: string;
  amount: number;
  category: string;
  fromAccountId: string;
  description: string;
}

export interface RecurringExpense {
  id: string;
  name: string;
  // Amount is now optional or treated as a "Default Estimate" since actuals vary
  amount: number; 
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  
  // Configuration for Auto-Filling the Payment Modal
  fromAccountId: string;
  category: string;
  description: string;
  
  // Logic for Reminders
  nextDueDate: number; // The specific date the next bill is expected
  isActive: boolean;
  
  // Removed strict automation fields like 'lastGenerated' if they are no longer used for auto-deduction
  contactId?: string; // Optional link to vendor
}