import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { collection, query, onSnapshot, doc, setDoc, writeBatch, increment, getDoc, addDoc } from 'firebase/firestore';
import { db, getFullPath } from './firebase';
import { Account, Transaction, ExpenseTemplate, Shift } from './types';
import { useAuth } from './AuthContext';

interface AccountsContextType {
  accounts: Account[];
  transactions: Transaction[];
  shifts: Shift[];
  expenseTemplates: ExpenseTemplate[];
  loading: boolean;
  isSandbox: boolean;
  transferFunds: (
    fromId: string, 
    toId: string, 
    amount: number, 
    description: string, 
    category: string,
    metadata?: any
  ) => Promise<void>;
  saveEntity: (collection: string, data: any) => Promise<void>;
  updateEntity: (collection: string, id: string, data: any) => Promise<void>;
  resetSandbox: () => void;
  // [NEW]: Add adjustBalance to the interface
  adjustBalance: (accountId: string, newBalance: number, reason: string) => Promise<void>;
}

const AccountsContext = createContext<AccountsContextType | undefined>(undefined);

const INITIAL_ACCOUNTS: Account[] = [
  { id: 'till_float', name: 'Register Cash (Till)', type: 'ASSET', balance: 150, icon: 'Wallet' },
  { id: 'business_bank', name: 'Business Bank', type: 'ASSET', balance: 5000, icon: 'Building' },
  { id: 'staff_card', name: 'Staff Card', type: 'LIABILITY', balance: 0, icon: 'CreditCard' },
  { id: 'mozzarella_card_payment', name: 'Mozzarella Card Payments', type: 'ASSET', balance: 0, icon: 'CreditCard' },
  { id: 'hiking_bar_rec', name: 'Hiking Bar Receivable', type: 'RECEIVABLE', balance: 0, icon: 'Handshake' },
  { id: 'hiking_bar_card_payment', name: 'Hiking Bar Card Payment', type: 'ASSET', balance: 0, icon: 'SmartphoneNfc' },
  { id: 'pending_bills', name: 'Pending Bills (To Pay)', type: 'LIABILITY', balance: 0, icon: 'FileText' },
  { id: 'customer_receivables', name: 'Bills to Received (Customers)', type: 'RECEIVABLE', balance: 0, icon: 'Users' },
  { id: 'operational_expenses', name: 'Operational Expenses', type: 'EXPENSE', balance: 0, icon: 'TrendingDown' },
  { id: 'payroll_expenses', name: 'Payroll & Salaries', type: 'EXPENSE', balance: 0, icon: 'Users' },
  { id: 'staff_advances_rec', name: 'Staff Advances', type: 'RECEIVABLE', balance: 0, icon: 'History' },
  { id: 'service_fee_income', name: 'Total Gross Sales (Revenue)', type: 'REVENUE', balance: 0, icon: 'Zap' },
  { id: 'foreign_currency_reserve', name: 'Foreign Currency Reserve', type: 'ASSET', balance: 0, icon: 'SmartphoneNfc' },
  // [NEW]: Equity Account for Balance Adjustments
  { id: 'equity_adjustments', name: 'Equity & Adjustments', type: 'EQUITY', balance: 0, icon: 'Scale' },
];

export const AccountsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, profile, isSandbox } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [expenseTemplates, setExpenseTemplates] = useState<ExpenseTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  const getSandboxData = <T,>(key: string, fallback: T): T => {
    const stored = localStorage.getItem(`mozz_sb_${key}`);
    return stored ? JSON.parse(stored) : fallback;
  };

  const setSandboxData = (key: string, data: any) => {
    localStorage.setItem(`mozz_sb_${key}`, JSON.stringify(data));
  };

  useEffect(() => {
    if (isSandbox) {
      setAccounts(getSandboxData('accounts', INITIAL_ACCOUNTS));
      const txs = getSandboxData('transactions', []);
      txs.sort((a: any, b: any) => b.date - a.date);
      setTransactions(txs);
      setShifts(getSandboxData('shifts', []));
      setExpenseTemplates(getSandboxData('expense_templates', []));
      setLoading(false);
      return;
    }

    if (!user || user.isAnonymous) {
      setAccounts([]);
      setLoading(true);
      return;
    }

    const unsubAccounts = onSnapshot(query(collection(db, getFullPath('accounts'))), (snap) => {
      const fetched = snap.docs.map(d => ({ ...d.data(), id: d.id } as Account));
      if (fetched.length === 0) {
          const batch = writeBatch(db);
          INITIAL_ACCOUNTS.forEach(a => batch.set(doc(db, getFullPath('accounts'), a.id), a));
          batch.commit();
      } else {
          setAccounts(fetched);
      }
    });

    const unsubTxs = onSnapshot(query(collection(db, getFullPath('transactions'))), (snap) => {
      const fetched = snap.docs.map(d => ({ ...d.data(), id: d.id } as Transaction));
      fetched.sort((a, b) => b.date - a.date);
      setTransactions(fetched);
    });

    const unsubShifts = onSnapshot(query(collection(db, getFullPath('shifts'))), (snap) => {
      setShifts(snap.docs.map(d => ({ ...d.data(), id: d.id } as Shift)));
    });

    const unsubTemplates = onSnapshot(collection(db, getFullPath('expense_templates')), (snap) => {
      setExpenseTemplates(snap.docs.map(d => ({ ...d.data(), id: d.id } as ExpenseTemplate)));
      setLoading(false);
    });

    return () => {
      unsubAccounts();
      unsubTxs();
      unsubShifts();
      unsubTemplates();
    };
  }, [user, isSandbox]);

  const transferFunds = useCallback(async (
    fromId: string, 
    toId: string, 
    amount: number, 
    description: string, 
    category: string,
    metadata: any = {}
  ) => {
    if (amount <= 0) return;

    if (isSandbox) {
      const currentAccounts = getSandboxData('accounts', INITIAL_ACCOUNTS);
      const updatedAccounts = currentAccounts.map(acc => {
        if (acc.id === fromId) {
          // [UPDATE]: Treat EQUITY like LIABILITY for Sandbox
          const delta = (acc.type === 'LIABILITY' || acc.type === 'EQUITY') ? amount : -amount;
          return { ...acc, balance: acc.balance + delta };
        }
        if (acc.id === toId) {
          // [UPDATE]: Treat EQUITY like LIABILITY for Sandbox
          const delta = (acc.type === 'LIABILITY' || acc.type === 'EQUITY') ? -amount : amount;
          return { ...acc, balance: acc.balance + delta };
        }
        return acc;
      });
      setSandboxData('accounts', updatedAccounts);
      setAccounts(updatedAccounts);

      const txs = getSandboxData<Transaction[]>('transactions', []);
      const newTx: Transaction = {
        id: `tx_sb_${Date.now()}`,
        date: Date.now(),
        amount,
        fromAccountId: fromId,
        toAccountId: toId,
        description,
        category,
        createdBy: 'sandbox_user',
        isSettled: metadata.isSettled ?? true, // Respect metadata if provided
        ...metadata
      };
      txs.unshift(newTx);
      setSandboxData('transactions', txs);
      setTransactions(txs);
      return;
    }

    const batch = writeBatch(db);
    const fromAcc = accounts.find(a => a.id === fromId);
    const toAcc = accounts.find(a => a.id === toId);
    if (!fromAcc || !toAcc) throw new Error("Account not found");

    // [UPDATE]: Treat EQUITY like LIABILITY for Firestore updates
    const fromDelta = (fromAcc.type === 'LIABILITY' || fromAcc.type === 'EQUITY') ? amount : -amount;
    const toDelta = (toAcc.type === 'LIABILITY' || toAcc.type === 'EQUITY') ? -amount : amount;

    batch.update(doc(db, getFullPath('accounts'), fromId), { balance: increment(fromDelta) });
    batch.update(doc(db, getFullPath('accounts'), toId), { balance: increment(toDelta) });

    const txId = `tx_${Date.now()}`;
    batch.set(doc(db, getFullPath('transactions'), txId), {
      id: txId,
      date: Date.now(),
      amount,
      fromAccountId: fromId,
      toAccountId: toId,
      description,
      category,
      createdBy: profile?.uid || 'system',
      isSettled: metadata.isSettled ?? true, // Default to true unless specified
      ...metadata
    });

    await batch.commit();
  }, [accounts, profile, isSandbox]);

  // [NEW]: Smart Adjust Logic
  const adjustBalance = async (accountId: string, newBalance: number, reason: string) => {
    const account = accounts.find(a => a.id === accountId);
    if (!account) throw new Error("Account not found");

    const currentBalance = account.balance;
    const diff = newBalance - currentBalance;

    if (diff === 0) return;

    // Logic: If Balance goes UP (Positive Diff), money comes FROM Equity TO Account.
    //        If Balance goes DOWN (Negative Diff), money goes FROM Account TO Equity.
    const amount = Math.abs(diff);

    if (diff > 0) {
      // Balance increased -> Equity Injection
      await transferFunds(
        'equity_adjustments', 
        accountId, 
        amount, 
        `Manual Adjustment: ${reason}`, 
        'Adjustment'
      );
    } else {
      // Balance decreased -> Write-off to Equity
      await transferFunds(
        accountId, 
        'equity_adjustments', 
        amount, 
        `Manual Adjustment: ${reason}`, 
        'Adjustment'
      );
    }
  };

  const saveEntity = async (coll: string, data: any) => {
    if (isSandbox) {
      const existing = getSandboxData<any[]>(coll, []);
      const newEntity = { ...data, id: `${coll}_sb_${Date.now()}` };
      const updated = [newEntity, ...existing];
      setSandboxData(coll, updated);
      if (coll === 'shifts') setShifts(updated);
      if (coll === 'expense_templates') setExpenseTemplates(updated);
      if (coll === 'transactions') setTransactions(updated);
      return;
    }
    await addDoc(collection(db, getFullPath(coll)), data);
  };

  const updateEntity = async (coll: string, id: string, data: any) => {
    if (isSandbox) {
      const existing = getSandboxData<any[]>(coll, []);
      const updated = existing.map(item => item.id === id ? { ...item, ...data } : item);
      setSandboxData(coll, updated);
      if (coll === 'shifts') setShifts(updated);
      if (coll === 'expense_templates') setExpenseTemplates(updated);
      if (coll === 'transactions') setTransactions(updated);
      return;
    }
    await setDoc(doc(db, getFullPath(coll), id), data, { merge: true });
  };

  const resetSandbox = () => {
    const keys = Object.keys(localStorage);
    keys.forEach(k => {
      if (k.startsWith('mozz_sb_')) localStorage.removeItem(k);
    });
    window.location.reload();
  };

  return (
    <div className="max-w-7xl mx-auto h-full">
      <AccountsContext.Provider value={{ 
        accounts, transactions, shifts, expenseTemplates, 
        loading, isSandbox, transferFunds, saveEntity, updateEntity, resetSandbox,
        adjustBalance // Export the new function
      }}>
        {children}
      </AccountsContext.Provider>
    </div>
  );
};

export const useAccounts = () => {
  const context = useContext(AccountsContext);
  if (!context) throw new Error("useAccounts must be used within an AccountsProvider");
  return context;
};