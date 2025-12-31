
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
  isSettled?: boolean;
  staffId?: string;
  customerId?: string; // Link for Credit Bills
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
  amount: number;
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  fromAccountId: string;
  category: string;
  description: string;
  lastGenerated?: number;
  isActive: boolean;
}
