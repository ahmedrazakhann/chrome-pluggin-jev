import * as Yup from 'yup';
import { PATTERNS } from '@constants/declarationData';
import { CargoChannel, Party } from '@app-types/declaration';
import { findCarrier, findHsCode, findParty, findPort, parseDisplayDate, startOfToday, weightInKg } from '@utils/declaration';

const required = (label: string) => `${label} is required`;

const partyCode = (label: string, role: Parameters<typeof findParty>[0], extra: Party[], isRequired: boolean) => {
  const base = Yup.string().trim();
  return (isRequired ? base.required(required(label)) : base).test(
    'known-party',
    `${label} was not found. Use the search to pick a registered code`,
    value => !value || !!findParty(role, value, extra)
  );
};

const positiveNumber = (label: string) =>
  Yup.number().typeError(`${label} must be a number`).required(required(label)).moreThan(0, `${label} must be greater than 0`);

const nonNegativeNumber = (label: string) =>
  Yup.number().typeError(`${label} must be a number`).required(required(label)).min(0, `${label} cannot be negative`);

const displayDate = (label: string) =>
  Yup.string()
    .required(required(label))
    .matches(PATTERNS.ddmmyyyy, `${label} must be in DD-MM-YYYY format`)
    .test('real-date', `${label} is not a valid date`, value => !value || !!parseDisplayDate(value));

export const generalInformationSchema = (extraExporters: Party[], extraImporters: Party[]) =>
  Yup.object({
    regimeType: Yup.string().required(required('Regime Type')),
    declarationType: Yup.string().required(required('Declaration Type')),
    cargoChannel: Yup.string().required(required('Cargo Channel')),
    clientReference: Yup.string()
      .trim()
      .required(required("Client's Dec. Ref. No."))
      .matches(PATTERNS.reference, 'Use 3 to 20 letters, digits, "-" or "/"'),
    exporterCode: partyCode("Exporter's Code", 'exporter', extraExporters, true).required(
      "Enter an Exporter's Code or add an overseas customer"
    ),
    importerCode: partyCode("Importer's Code", 'importer', extraImporters, true),
    notifyPartyCode: partyCode('Notify Party Code', 'notifyParty', [], false),
    cargoHandlerCode: partyCode("Cargo Handler's Code", 'cargoHandler', [], true),
    agentCode: partyCode("Agent's Code", 'agent', [], true),
    invoiceDocument: Yup.string().required(required('Invoice')),
    awbDocument: Yup.string().required(required('AWB / BOL')),
    packingListDocument: Yup.string().required(required('Packing List')),
    certificateOfOriginDocument: Yup.string().required(required('Cert. of Origin')),
  });

const knownPort = (label: string, channel: CargoChannel, uaeOnly: boolean) =>
  Yup.string()
    .trim()
    .required(required(label))
    .test('known-port', `${label} was not found for this cargo channel. Use the search to pick a port`, value => {
      const port = value ? findPort(value) : undefined;
      return !value || (!!port && port.channel === channel);
    })
    .test('uae-port', `${label} must be a port in the UAE`, value => {
      const port = value ? findPort(value) : undefined;
      return !uaeOnly || !port || port.country === 'AE';
    });

export const shippingDetailsSchema = (channel: CargoChannel) =>
  Yup.object({
    carrierRegistrationNo: Yup.string()
      .trim()
      .required(required('Carrier Registration No.'))
      .test('known-carrier', 'Carrier was not found for this cargo channel. Use the search', value => {
        const carrier = value ? findCarrier(value) : undefined;
        return !value || (!!carrier && carrier.channel === channel);
      }),
    scheduledDate: displayDate('Scheduled Date').test('not-old', 'Scheduled Date cannot be more than 30 days in the past', value => {
      const date = parseDisplayDate(value ?? '');
      return !date || date.getTime() >= startOfToday().getTime() - 30 * 86_400_000;
    }),
    mawb: Yup.string()
      .trim()
      .required(required('MAWB / BOL'))
      .matches(channel === 'AIR' ? PATTERNS.mawbAir : PATTERNS.billOfLading, {
        message: channel === 'AIR' ? 'MAWB must be exactly 11 digits' : 'BOL must be 8 to 17 capital letters or digits',
      }),
    hawb: Yup.string()
      .trim()
      .matches(/^[A-Za-z0-9-]{4,20}$/, { message: 'HAWB must be 4 to 20 letters, digits or "-"', excludeEmptyString: true }),
    originalLoadPort: knownPort('Original Load Port', channel, false),
    portOfLoad: knownPort('Port of Load', channel, false),
    portOfDischarge: knownPort('Port of Discharge', channel, true),
    netWeight: Yup.number().typeError('Net Weight must be a number').min(0, 'Net Weight cannot be negative'),
    netWeightUnit: Yup.string().when('netWeight', {
      is: (value: number) => value !== undefined && value !== null && !Number.isNaN(value),
      then: schema => schema.required('Select a unit for Net Weight'),
    }),
    grossWeight: positiveNumber('Gross Weight').test('gross-vs-net', 'Gross Weight cannot be less than Net Weight', function (value) {
      const { netWeight, netWeightUnit, grossWeightUnit } = this.parent;
      if (!value || !netWeight || !netWeightUnit || !grossWeightUnit) return true;
      return weightInKg(value, grossWeightUnit) >= weightInKg(netWeight, netWeightUnit);
    }),
    grossWeightUnit: Yup.string().required('Select a unit for Gross Weight'),
    volume: Yup.number().typeError('Volume must be a number').min(0, 'Volume cannot be negative'),
    volumeUnit: Yup.string().when('volume', {
      is: (value: number) => value !== undefined && value !== null && !Number.isNaN(value),
      then: schema => schema.required('Select a unit for Volume'),
    }),
    cargoType: Yup.string().required(required('Cargo Type')),
  });

export const paymentDetailsSchema = (dutyDue: boolean) =>
  Yup.object({
    dutyPaymentMode: dutyDue ? Yup.string().required('Select a payment mode for the duty') : Yup.string(),
    dutyPaymentReference: dutyDue ? Yup.string().required('Select a payment reference for the duty') : Yup.string(),
    chargesPaymentMode: Yup.string().required('Select a payment mode for the other charges'),
    chargesPaymentReference: Yup.string().required('Select a payment reference for the other charges'),
    undertakingAccepted: Yup.boolean().oneOf([true], 'You must accept the undertaking before submitting'),
  });

export const invoiceSchema = (extraSellers: Party[], existingInvoiceNos: string[]) =>
  Yup.object({
    invoiceNo: Yup.string()
      .trim()
      .required(required('Invoice No.'))
      .matches(PATTERNS.reference, 'Use 3 to 20 letters, digits, "-" or "/"')
      .test(
        'unique',
        'This invoice number is already on the declaration',
        value => !existingInvoiceNos.includes((value ?? '').trim().toUpperCase())
      ),
    invoiceDate: displayDate('Invoice Date').test('not-future', 'Invoice Date cannot be in the future', value => {
      const date = parseDisplayDate(value ?? '');
      return !date || date.getTime() <= startOfToday().getTime();
    }),
    sellerCode: partyCode('Seller', 'exporter', extraSellers, true),
    pages: Yup.number()
      .typeError('No. of Pages must be a whole number')
      .required(required('No. of Pages'))
      .integer('No. of Pages must be a whole number')
      .min(1, 'No. of Pages must be at least 1')
      .max(999, 'No. of Pages cannot exceed 999'),
    termsOfDelivery: Yup.string().required(required('Terms of Delivery')),
    invoiceType: Yup.string().required(required('Invoice Type')),
    insuranceCost: nonNegativeNumber('Insurance Cost'),
    insuranceCurrency: Yup.string().required('Select the insurance currency'),
    freightCost: nonNegativeNumber('Freight Cost'),
    freightCurrency: Yup.string().required('Select the freight currency'),
    currency: Yup.string().required(required('Currency')),
    value: positiveNumber('Value'),
    paymentTerm: Yup.string().required(required('Payment Term')),
  });

export const lineItemSchema = Yup.object({
  hsCode: Yup.string()
    .trim()
    .required(required('HS Code'))
    .matches(PATTERNS.hsCode, 'HS Code must be 8 digits')
    .test('known-hs', 'HS Code was not found. Use the search', value => !value || !!findHsCode(value)),
  description: Yup.string().trim().required(required('Goods Description')).min(5, 'Describe the goods in at least 5 characters'),
  countryOfOrigin: Yup.string().required(required('Country of Origin')),
  quantity: positiveNumber('Quantity'),
  unit: Yup.string().required(required('Unit')),
  netWeight: positiveNumber('Net Weight'),
  grossWeight: positiveNumber('Gross Weight').test('gross-vs-net', 'Gross Weight cannot be less than Net Weight', function (value) {
    return !value || !this.parent.netWeight || Number(value) >= Number(this.parent.netWeight);
  }),
  value: positiveNumber('Value'),
});

export const overseasCustomerSchema = Yup.object({
  name: Yup.string().trim().required(required('Company Name')).min(3, 'Company Name is too short'),
  country: Yup.string().required(required('Country')).notOneOf(['AE'], 'Overseas customers must be outside the UAE'),
  city: Yup.string().trim().required(required('City')),
  address: Yup.string().trim().required(required('Address')).min(10, 'Enter the full address'),
  phone: Yup.string().trim().matches(PATTERNS.phone, { message: 'Enter a valid phone number', excludeEmptyString: true }),
  email: Yup.string().trim().email('Enter a valid email address'),
});

export const personalCustomerSchema = Yup.object({
  idType: Yup.string().required(required('ID Type')),
  idNumber: Yup.string()
    .trim()
    .required(required('ID Number'))
    .when('idType', {
      is: 'EMIRATES_ID',
      then: schema => schema.matches(PATTERNS.emiratesId, 'Emirates ID must look like 784-1990-1234567-1'),
      otherwise: schema => schema.matches(PATTERNS.passport, 'Passport number must be 6 to 9 capital letters or digits'),
    }),
  fullName: Yup.string().trim().required(required('Full Name')).min(3, 'Full Name is too short'),
  nationality: Yup.string().required(required('Nationality')),
  mobile: Yup.string().trim().required(required('Mobile')).matches(PATTERNS.phone, 'Enter a valid mobile number'),
});
