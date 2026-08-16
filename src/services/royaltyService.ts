import { HERITAGE_BUSINESS } from '../config/heritageBusiness';
import { supabase } from '../lib/supabase';

export interface PaymentRecord {
  id?: string;
  amount: number;
  client_email: string;
  royalty_amount: number;
  created_at: string;
}

export const logPaymentAndCalculateRoyalty = async (amount: number, clientEmail: string) => {
  const royaltyAmount = amount * HERITAGE_BUSINESS.royalty.percentage;
  
  const { data, error } = await supabase
    .from('payments')
    .insert([{
      amount,
      client_email: clientEmail,
      royalty_amount: royaltyAmount,
      created_at: new Date().toISOString()
    }]);

  if (error) {
    console.error('Error logging payment:', error);
    throw error;
  }

  return { data, royaltyAmount };
};

export const getRoyaltyStats = async () => {
  const { data, error } = await supabase
    .from('payments')
    .select('royalty_amount, created_at');

  if (error) throw error;

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  let monthTotal = 0;
  let ytdTotal = 0;

  data.forEach((p: any) => {
    const date = new Date(p.created_at);
    if (date.getFullYear() === currentYear) {
      ytdTotal += p.royalty_amount;
      if (date.getMonth() === currentMonth) {
        monthTotal += p.royalty_amount;
      }
    }
  });

  return { monthTotal, ytdTotal };
};
