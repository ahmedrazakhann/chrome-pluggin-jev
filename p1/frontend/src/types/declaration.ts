export type CargoChannel = 'AIR' | 'SEA' | 'LAND';

export interface Option {
  value: string;
  label: string;
}

export interface Country {
  code: string;
  name: string;
}

export type PartyRole = 'importer' | 'exporter' | 'notifyParty' | 'cargoHandler' | 'agent';

export interface Party {
  code: string;
  name: string;
  country: string;
  city: string;
  // Trade licence expiry, DD-MM-YYYY
  licenseExpiry?: string;
  vatTrn?: string;
  vatRegistered?: boolean;
}

export interface Carrier {
  code: string;
  name: string;
  channel: CargoChannel;
  operator: string;
}

export interface Port {
  code: string;
  name: string;
  country: string;
  channel: CargoChannel;
}

export interface HsCode {
  code: string;
  description: string;
  // Customs duty as a fraction of CIF value, e.g. 0.05
  dutyRate: number;
}

export interface Currency {
  code: string;
  name: string;
  // Value of one unit in AED
  aedRate: number;
}

export interface PaymentReference {
  value: string;
  label: string;
  mode: string;
}

export interface Fee {
  key: string;
  label: string;
  amount: number;
}

export interface GeneralInformationValues {
  regimeType: string;
  declarationType: string;
  cargoChannel: CargoChannel | '';
  clientReference: string;
  exporterCode: string;
  mraAeo: boolean;
  importerCode: string;
  notifyPartyCode: string;
  cargoHandlerCode: string;
  agentCode: string;
  customsBroker: string;
  tradeType: string;
  invoiceDocument: string;
  awbDocument: string;
  packingListDocument: string;
  certificateOfOriginDocument: string;
}

export interface ShippingDetailsValues {
  carrierRegistrationNo: string;
  scheduledDate: string;
  mawb: string;
  hawb: string;
  originalLoadPort: string;
  portOfLoad: string;
  portOfDischarge: string;
  netWeight: string;
  netWeightUnit: string;
  grossWeight: string;
  grossWeightUnit: string;
  volume: string;
  volumeUnit: string;
  cargoType: string;
}

export interface PaymentDetailsValues {
  dutyPaymentMode: string;
  dutyPaymentReference: string;
  chargesPaymentMode: string;
  chargesPaymentReference: string;
  undertakingAccepted: boolean;
}

export type DeclarationValues = GeneralInformationValues & ShippingDetailsValues & PaymentDetailsValues;

export interface LineItem {
  id: string;
  hsCode: string;
  description: string;
  countryOfOrigin: string;
  quantity: number;
  unit: string;
  netWeight: number;
  grossWeight: number;
  value: number;
}

export interface Invoice {
  id: string;
  invoiceNo: string;
  invoiceDate: string;
  sellerCode: string;
  pages: number;
  termsOfDelivery: string;
  invoiceType: string;
  insuranceCost: number;
  insuranceCurrency: string;
  freightCost: number;
  freightCurrency: string;
  currency: string;
  value: number;
  paymentTerm: string;
  lineItems: LineItem[];
}

export interface InvoiceFormValues {
  invoiceNo: string;
  invoiceDate: string;
  sellerCode: string;
  pages: string;
  termsOfDelivery: string;
  invoiceType: string;
  insuranceCost: string;
  insuranceCurrency: string;
  freightCost: string;
  freightCurrency: string;
  currency: string;
  value: string;
  paymentTerm: string;
}

export interface LineItemFormValues {
  hsCode: string;
  description: string;
  countryOfOrigin: string;
  quantity: string;
  unit: string;
  netWeight: string;
  grossWeight: string;
  value: string;
}

export interface OverseasCustomerValues {
  name: string;
  country: string;
  city: string;
  address: string;
  phone: string;
  email: string;
}

export interface PersonalCustomerValues {
  idType: string;
  idNumber: string;
  fullName: string;
  nationality: string;
  mobile: string;
}

export interface SearchFilter {
  name: string;
  label: string;
  type: 'text' | 'select';
  options?: Option[];
}

export interface SearchColumn<T> {
  key: string;
  label: string;
  render: (row: T) => string;
}

export interface DutyBreakdown {
  cifAed: number;
  duty: number;
  fees: Fee[];
  feesTotal: number;
}
