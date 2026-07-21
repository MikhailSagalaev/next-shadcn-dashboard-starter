export type YooKassaApiSuccess<T> = { ok: true; data: T };
export type YooKassaApiFailure = { ok: false; status: number; body: string };
export type YooKassaApiResult<T> = YooKassaApiSuccess<T> | YooKassaApiFailure;

export type YooKassaAmount = {
  value: string;
  currency: string;
};

export type YooKassaPaymentPayload = {
  amount: YooKassaAmount;
  capture: boolean;
  description: string;
  confirmation?: {
    type: 'redirect';
    return_url: string;
  };
  payment_method_id?: string;
  save_payment_method?: boolean;
  metadata?: Record<string, string>;
};

export type YooKassaPayment = Record<string, unknown> & {
  id: string;
  status: 'pending' | 'waiting_for_capture' | 'succeeded' | 'canceled';
  paid?: boolean;
  amount: YooKassaAmount;
  metadata?: Record<string, string>;
};

export type YooKassaVatCode = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

export type YooKassaPaymentMode =
  | 'full_prepayment'
  | 'partial_prepayment'
  | 'advance'
  | 'full_payment'
  | 'partial_payment'
  | 'credit'
  | 'credit_payment';

export type YooKassaPaymentSubject =
  | 'commodity'
  | 'excise'
  | 'job'
  | 'service'
  | 'gambling_bet'
  | 'gambling_prize'
  | 'lottery'
  | 'lottery_prize'
  | 'intellectual_activity'
  | 'payment'
  | 'agent_commission'
  | 'composite'
  | 'another'
  | 'property_right'
  | 'non_operating_gain'
  | 'insurance_premium'
  | 'sales_tax'
  | 'resort_fee'
  | 'marked'
  | 'non_marked'
  | 'marked_excise'
  | 'non_marked_excise'
  | 'fine'
  | 'tax'
  | 'lien'
  | 'cost'
  | 'agent_withdrawals'
  | 'pension_insurance_without_payouts'
  | 'pension_insurance_with_payouts'
  | 'health_insurance_without_payouts'
  | 'health_insurance_with_payouts'
  | 'health_insurance'
  | 'casino';

export type YooKassaMeasure =
  | 'piece'
  | 'gram'
  | 'kilogram'
  | 'ton'
  | 'centimeter'
  | 'decimeter'
  | 'meter'
  | 'square_centimeter'
  | 'square_decimeter'
  | 'square_meter'
  | 'milliliter'
  | 'liter'
  | 'cubic_meter'
  | 'kilowatt_hour'
  | 'gigacalorie'
  | 'day'
  | 'hour'
  | 'minute'
  | 'second'
  | 'kilobyte'
  | 'megabyte'
  | 'gigabyte'
  | 'terabyte'
  | 'another';

export type YooKassaReceiptItem = {
  description: string;
  quantity: string;
  amount: YooKassaAmount;
  vat_code: YooKassaVatCode;
  payment_mode?: YooKassaPaymentMode;
  payment_subject?: YooKassaPaymentSubject;
  measure?: YooKassaMeasure;
  mark_code_info?: {
    gs_1m: string;
  };
  mark_mode?: '0';
  mark_quantity?: {
    numerator: number;
    denominator: number;
  };
  country_of_origin_code?: string;
  customs_declaration_number?: string;
  excise?: string;
  product_code?: string;
};

export type YooKassaReceiptCustomer = {
  full_name?: string;
  inn?: string;
  email?: string;
  phone?: string;
};

export type YooKassaSettlement = {
  type: 'cashless' | 'prepayment' | 'postpayment' | 'consideration';
  amount: YooKassaAmount;
};

export type YooKassaCreateReceiptPayload = {
  type: 'payment' | 'refund';
  payment_id?: string;
  refund_id?: string;
  customer: YooKassaReceiptCustomer;
  items: YooKassaReceiptItem[];
  settlements?: YooKassaSettlement[];
  send?: boolean;
  tax_system_code?: 1 | 2 | 3 | 4 | 5 | 6;
  on_behalf_of?: string;
  internet?: boolean;
  timezone?: number;
  receipt_industry_details?: Array<Record<string, string>>;
  receipt_operational_details?: Record<string, unknown>;
};

export type YooKassaReceipt = Record<string, unknown> & {
  id: string;
  type: 'payment' | 'refund';
  status: 'pending' | 'succeeded' | 'canceled';
  payment_id?: string;
  refund_id?: string;
  items?: YooKassaReceiptItem[];
};

export type YooKassaReceiptList = Record<string, unknown> & {
  type?: 'list';
  items: YooKassaReceipt[];
  next_cursor?: string;
};

export type YooKassaCreateRefundPayload = {
  payment_id: string;
  amount?: YooKassaAmount;
  description?: string;
  sources?: Array<{
    account_id: string;
    amount: YooKassaAmount;
  }>;
  receipt?: {
    customer: YooKassaReceiptCustomer;
    items: YooKassaReceiptItem[];
    tax_system_code?: 1 | 2 | 3 | 4 | 5 | 6;
  };
};

export type YooKassaRefund = Record<string, unknown> & {
  id: string;
  payment_id: string;
  status: 'pending' | 'succeeded' | 'canceled';
  amount: YooKassaAmount;
};
