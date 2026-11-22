import {
  AGENTS,
  CARGO_HANDLERS,
  CARRIERS,
  COUNTRIES,
  CURRENCIES,
  EXPORTERS,
  FEES,
  HS_CODES,
  IMPORTERS,
  NOTIFY_PARTIES,
  PATTERNS,
  PORTS,
  WEIGHT_IN_KG,
} from '@constants/declarationData';
import { DutyBreakdown, Invoice, LineItem, Party, PartyRole } from '@app-types/declaration';

export const PARTY_LISTS: Record<PartyRole, Party[]> = {
  importer: IMPORTERS,
  exporter: EXPORTERS,
  notifyParty: NOTIFY_PARTIES,
  cargoHandler: CARGO_HANDLERS,
  agent: AGENTS,
};

export const findParty = (role: PartyRole, code: string, extra: Party[] = []): Party | undefined =>
  [...PARTY_LISTS[role], ...extra].find(party => party.code === code.trim().toUpperCase());

export const findCarrier = (code: string) => CARRIERS.find(carrier => carrier.code === code.trim().toUpperCase());

export const findPort = (code: string) => PORTS.find(port => port.code === code.trim().toUpperCase());

export const findHsCode = (code: string) => HS_CODES.find(hs => hs.code === code.trim());

export const countryName = (code: string) => COUNTRIES.find(country => country.code === code)?.name ?? code;

export const toAed = (amount: number, currency: string) => amount * (CURRENCIES.find(item => item.code === currency)?.aedRate ?? 1);

export const formatMoney = (amount: number, currency = 'AED') =>
  `${currency} ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const newId = () => Math.random().toString(36).slice(2, 10);

// DD-MM-YYYY -> Date, or null when the text is not a real calendar date
export const parseDisplayDate = (value: string): Date | null => {
  if (!PATTERNS.ddmmyyyy.test(value ?? '')) return null;
  const [day, month, year] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
};

export const toDisplayDate = (isoDate: string) => {
  const [year, month, day] = isoDate.split('-');
  return year && month && day ? `${day}-${month}-${year}` : '';
};

export const toIsoDate = (displayDate: string) => {
  const date = parseDisplayDate(displayDate);
  if (!date) return '';
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

export const startOfToday = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
};

export const weightInKg = (value: string | number, unit: string) => Number(value) * (WEIGHT_IN_KG[unit] ?? 1);

// CIF = goods value + freight + insurance, all converted to AED
export const invoiceCifAed = (invoice: Invoice) =>
  toAed(invoice.value, invoice.currency) +
  toAed(invoice.freightCost, invoice.freightCurrency) +
  toAed(invoice.insuranceCost, invoice.insuranceCurrency);

export const lineItemsTotal = (items: LineItem[]) => items.reduce((sum, item) => sum + item.value, 0);

// Duty is charged per line item on its share of the invoice CIF, at the HS code's rate
export const calculateDuty = (invoices: Invoice[]): DutyBreakdown => {
  let cifAed = 0;
  let duty = 0;
  for (const invoice of invoices) {
    const cif = invoiceCifAed(invoice);
    const itemsValue = lineItemsTotal(invoice.lineItems);
    cifAed += cif;
    for (const item of invoice.lineItems) {
      const share = itemsValue > 0 ? item.value / itemsValue : 0;
      duty += cif * share * (findHsCode(item.hsCode)?.dutyRate ?? 0.05);
    }
  }
  const feesTotal = FEES.reduce((sum, fee) => sum + fee.amount, 0);
  return { cifAed, duty: Math.round(duty * 100) / 100, fees: FEES, feesTotal };
};

export const generateDeclarationNumber = () =>
  `DEC-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 1e6)).padStart(6, '0')}`;

// Parses the pipe-delimited .txt invoice upload (format in INVOICE_UPLOAD_SAMPLE).
export const parseInvoiceUpload = (text: string): { invoices: Invoice[]; errors: string[] } => {
  const invoices: Invoice[] = [];
  const errors: string[] = [];
  const number = (value: string, line: number, label: string) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) errors.push(`Line ${line}: ${label} must be a positive number`);
    return parsed;
  };

  text.split(/\r?\n/).forEach((raw, index) => {
    const line = index + 1;
    const row = raw.trim();
    if (!row || row.startsWith('#')) return;
    const parts = row.split('|').map(part => part.trim());
    if (parts[0] === 'INV') {
      if (parts.length !== 14) return errors.push(`Line ${line}: INV needs 13 fields, found ${parts.length - 1}`);
      const [
        ,
        invoiceNo,
        invoiceDate,
        sellerCode,
        pages,
        terms,
        type,
        currency,
        value,
        freight,
        freightCurrency,
        insurance,
        insuranceCurrency,
        paymentTerm,
      ] = parts;
      if (!parseDisplayDate(invoiceDate)) errors.push(`Line ${line}: invoice date must be DD-MM-YYYY`);
      invoices.push({
        id: newId(),
        invoiceNo,
        invoiceDate,
        sellerCode,
        pages: number(pages, line, 'pages'),
        termsOfDelivery: terms,
        invoiceType: type,
        currency,
        value: number(value, line, 'value'),
        freightCost: number(freight, line, 'freight'),
        freightCurrency,
        insuranceCost: number(insurance, line, 'insurance'),
        insuranceCurrency,
        paymentTerm,
        lineItems: [],
      });
    } else if (parts[0] === 'ITEM') {
      const invoice = invoices[invoices.length - 1];
      if (!invoice) return errors.push(`Line ${line}: ITEM appears before any INV line`);
      if (parts.length !== 9) return errors.push(`Line ${line}: ITEM needs 8 fields, found ${parts.length - 1}`);
      const [, hsCode, description, origin, quantity, unit, netWeight, grossWeight, value] = parts;
      if (!findHsCode(hsCode)) errors.push(`Line ${line}: unknown HS code ${hsCode}`);
      invoice.lineItems.push({
        id: newId(),
        hsCode,
        description,
        countryOfOrigin: origin,
        quantity: number(quantity, line, 'quantity'),
        unit,
        netWeight: number(netWeight, line, 'net weight'),
        grossWeight: number(grossWeight, line, 'gross weight'),
        value: number(value, line, 'value'),
      });
    } else {
      errors.push(`Line ${line}: must start with INV or ITEM`);
    }
  });

  if (!invoices.length && !errors.length) errors.push('The file has no INV lines');
  return { invoices, errors };
};
