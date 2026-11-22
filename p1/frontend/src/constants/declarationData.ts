// Reference data for the customs declaration form: every dropdown, search popup and
// fee in the form reads from here. It is sample data for a sandbox, not a real registry.
import { Carrier, CargoChannel, Country, Currency, Fee, HsCode, Option, Party, PaymentReference, Port } from '@app-types/declaration';

export const STEPS = ['General Information', 'Shipping Details', 'Invoice Details', 'Payment Details'];

export const REGIME_TYPES: Option[] = [
  { value: 'IMPORT', label: 'Import' },
  { value: 'EXPORT', label: 'Export' },
  { value: 'TRANSIT', label: 'Transit' },
  { value: 'REEXPORT', label: 'Re-Export' },
];

export const DECLARATION_TYPES: Record<string, Option[]> = {
  IMPORT: [
    { value: 'IMP_LOCAL_ROW', label: 'Import to Local from ROW' },
    { value: 'IMP_LOCAL_FZ', label: 'Import to Local from Free Zone' },
    { value: 'IMP_TEMP', label: 'Temporary Import' },
    { value: 'IMP_REEXPORT', label: 'Import for Re-Export' },
  ],
  EXPORT: [
    { value: 'EXP_LOCAL_ROW', label: 'Export from Local to ROW' },
    { value: 'EXP_LOCAL_FZ', label: 'Export from Local to Free Zone' },
    { value: 'EXP_TEMP', label: 'Temporary Export' },
  ],
  TRANSIT: [
    { value: 'TRN_ROW_ROW', label: 'Transit from ROW to ROW' },
    { value: 'TRN_FZ_ROW', label: 'Transit from Free Zone to ROW' },
  ],
  REEXPORT: [
    { value: 'REX_LOCAL_ROW', label: 'Re-Export from Local to ROW' },
    { value: 'REX_FZ_ROW', label: 'Re-Export from Free Zone to ROW' },
  ],
};

export const CARGO_CHANNELS: Option[] = [
  { value: 'AIR', label: 'Air' },
  { value: 'SEA', label: 'Sea' },
  { value: 'LAND', label: 'Land' },
];

export const TRADE_TYPES: Option[] = [
  { value: 'NON_ECOM', label: 'Non E-Commerce' },
  { value: 'ECOM_B2B', label: 'E-Commerce B2B' },
  { value: 'ECOM_B2C', label: 'E-Commerce B2C' },
];

export const DOCUMENT_STATUSES: Option[] = [
  { value: 'ORIGINAL', label: 'Attached - Original' },
  { value: 'COPY', label: 'Attached - Copy' },
  { value: 'TO_FOLLOW', label: 'To Follow' },
  { value: 'NOT_REQUIRED', label: 'Not Required' },
];

// The customs broker is the logged-in agency in the real portal; here it is fixed.
export const CUSTOMS_BROKER: Party = {
  code: 'AE-1062246',
  name: 'MOMENTUM LOGISTIC LLC',
  country: 'AE',
  city: 'Dubai',
  licenseExpiry: '01-02-2027',
  vatTrn: '100345678900003',
  vatRegistered: true,
};

export const COUNTRIES: Country[] = [
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'AU', name: 'Australia' },
  { code: 'BD', name: 'Bangladesh' },
  { code: 'BE', name: 'Belgium' },
  { code: 'BR', name: 'Brazil' },
  { code: 'CA', name: 'Canada' },
  { code: 'CH', name: 'Switzerland' },
  { code: 'CN', name: 'China' },
  { code: 'DE', name: 'Germany' },
  { code: 'EG', name: 'Egypt' },
  { code: 'ES', name: 'Spain' },
  { code: 'FR', name: 'France' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'HK', name: 'Hong Kong' },
  { code: 'ID', name: 'Indonesia' },
  { code: 'IN', name: 'India' },
  { code: 'IT', name: 'Italy' },
  { code: 'JP', name: 'Japan' },
  { code: 'KE', name: 'Kenya' },
  { code: 'KR', name: 'South Korea' },
  { code: 'LK', name: 'Sri Lanka' },
  { code: 'MY', name: 'Malaysia' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'OM', name: 'Oman' },
  { code: 'PH', name: 'Philippines' },
  { code: 'PK', name: 'Pakistan' },
  { code: 'QA', name: 'Qatar' },
  { code: 'SA', name: 'Saudi Arabia' },
  { code: 'SG', name: 'Singapore' },
  { code: 'TH', name: 'Thailand' },
  { code: 'TR', name: 'Turkey' },
  { code: 'US', name: 'United States' },
  { code: 'VN', name: 'Vietnam' },
  { code: 'ZA', name: 'South Africa' },
];

export const IMPORTERS: Party[] = [
  CUSTOMS_BROKER,
  {
    code: 'AE-1048821',
    name: 'AL NOOR GENERAL TRADING LLC',
    country: 'AE',
    city: 'Dubai',
    licenseExpiry: '14-08-2027',
    vatTrn: '100212345600003',
    vatRegistered: true,
  },
  {
    code: 'AE-1071190',
    name: 'DESERT PEARL ELECTRONICS FZE',
    country: 'AE',
    city: 'Dubai',
    licenseExpiry: '30-04-2027',
    vatTrn: '100498765400003',
    vatRegistered: true,
  },
  {
    code: 'AE-1033457',
    name: 'GULF HORIZON FOODSTUFF TRADING',
    country: 'AE',
    city: 'Sharjah',
    licenseExpiry: '22-12-2026',
    vatRegistered: false,
  },
  {
    code: 'AE-1089012',
    name: 'EMIRATES MEDICAL SUPPLIES CO',
    country: 'AE',
    city: 'Abu Dhabi',
    licenseExpiry: '05-09-2027',
    vatTrn: '100887766500003',
    vatRegistered: true,
  },
  {
    code: 'AE-1024678',
    name: 'SILVER SANDS TEXTILES LLC',
    country: 'AE',
    city: 'Dubai',
    licenseExpiry: '18-03-2027',
    vatTrn: '100334455600003',
    vatRegistered: true,
  },
  {
    code: 'AE-1095533',
    name: 'BLUE WAVE AUTO SPARE PARTS',
    country: 'AE',
    city: 'Ajman',
    licenseExpiry: '11-06-2027',
    vatRegistered: false,
  },
  {
    code: 'AE-1057741',
    name: 'FALCON BUILDING MATERIALS TRADING',
    country: 'AE',
    city: 'Dubai',
    licenseExpiry: '27-01-2028',
    vatTrn: '100776655400003',
    vatRegistered: true,
  },
  {
    code: 'AE-1012209',
    name: 'OASIS COSMETICS & PERFUMES LLC',
    country: 'AE',
    city: 'Dubai',
    licenseExpiry: '09-10-2027',
    vatTrn: '100665544300003',
    vatRegistered: true,
  },
  {
    code: 'AE-1066318',
    name: 'NEW CITY FURNITURE TRADING',
    country: 'AE',
    city: 'Ras Al Khaimah',
    licenseExpiry: '02-07-2027',
    vatTrn: '100554433200003',
    vatRegistered: true,
  },
];

export const EXPORTERS: Party[] = [
  { code: 'IN-EXP-20431', name: 'KERALA SPICES EXPORT HOUSE PVT LTD', country: 'IN', city: 'Kochi' },
  { code: 'IN-EXP-20877', name: 'MUMBAI TEXTILE MILLS LTD', country: 'IN', city: 'Mumbai' },
  { code: 'IN-EXP-21102', name: 'BANGALORE ELECTRONICS COMPONENTS', country: 'IN', city: 'Bengaluru' },
  { code: 'CN-EXP-88012', name: 'SHENZHEN BRIGHTSTAR TECHNOLOGY CO LTD', country: 'CN', city: 'Shenzhen' },
  { code: 'CN-EXP-88340', name: 'NINGBO HOMEWARE MANUFACTURING CO', country: 'CN', city: 'Ningbo' },
  { code: 'CN-EXP-89115', name: 'GUANGZHOU AUTO PARTS INDUSTRY LTD', country: 'CN', city: 'Guangzhou' },
  { code: 'PK-EXP-40217', name: 'SIALKOT SURGICAL INSTRUMENTS CO', country: 'PK', city: 'Sialkot' },
  { code: 'PK-EXP-40590', name: 'FAISALABAD COTTON WEAVERS LTD', country: 'PK', city: 'Faisalabad' },
  { code: 'DE-EXP-11208', name: 'BAVARIA MEDTECH GMBH', country: 'DE', city: 'Munich' },
  { code: 'IT-EXP-30451', name: 'MILANO FURNITURE DESIGN SRL', country: 'IT', city: 'Milan' },
  { code: 'TR-EXP-50122', name: 'ISTANBUL CERAMICS SANAYI AS', country: 'TR', city: 'Istanbul' },
  { code: 'US-EXP-70019', name: 'PACIFIC NUTRITION INC', country: 'US', city: 'Los Angeles' },
  { code: 'GB-EXP-60374', name: 'THAMES BEAUTY LABORATORIES LTD', country: 'GB', city: 'London' },
  { code: 'TH-EXP-91005', name: 'BANGKOK FRESH FRUITS CO LTD', country: 'TH', city: 'Bangkok' },
  { code: 'VN-EXP-93310', name: 'SAIGON COFFEE ROASTERS JSC', country: 'VN', city: 'Ho Chi Minh City' },
];

export const NOTIFY_PARTIES: Party[] = [
  { code: 'AE-2004517', name: 'SWIFT CLEARING & FORWARDING LLC', country: 'AE', city: 'Dubai' },
  { code: 'AE-2009983', name: 'PRIME CARGO SERVICES LLC', country: 'AE', city: 'Dubai' },
  { code: 'AE-2011246', name: 'GLOBAL LINK SHIPPING AGENCY', country: 'AE', city: 'Sharjah' },
  { code: 'AE-2016620', name: 'ARABIAN GATEWAY LOGISTICS', country: 'AE', city: 'Dubai' },
  { code: 'AE-2021354', name: 'CITYLINE FREIGHT SOLUTIONS', country: 'AE', city: 'Abu Dhabi' },
];

export const CARGO_HANDLERS: Party[] = [
  { code: 'AE-3000112', name: 'DUBAI AIRPORT CARGO TERMINAL OPERATOR', country: 'AE', city: 'Dubai' },
  { code: 'AE-3000245', name: 'DWC CARGO HANDLING SERVICES', country: 'AE', city: 'Dubai' },
  { code: 'AE-3000378', name: 'JEBEL ALI CONTAINER TERMINAL OPERATOR', country: 'AE', city: 'Dubai' },
  { code: 'AE-3000491', name: 'PORT RASHID BREAKBULK HANDLING', country: 'AE', city: 'Dubai' },
  { code: 'AE-3000524', name: 'HATTA LAND BORDER CARGO SERVICES', country: 'AE', city: 'Hatta' },
];

export const AGENTS: Party[] = [
  { code: 'AE-4001108', name: 'EMIRATES SKYCARGO AGENCY', country: 'AE', city: 'Dubai' },
  { code: 'AE-4001736', name: 'AIR INDIA CARGO SALES AGENT', country: 'AE', city: 'Dubai' },
  { code: 'AE-4002291', name: 'MAERSK LINE UAE AGENCY', country: 'AE', city: 'Dubai' },
  { code: 'AE-4002854', name: 'MSC SHIPPING AGENCY LLC', country: 'AE', city: 'Dubai' },
  { code: 'AE-4003317', name: 'GULF ROAD TRANSPORT AGENCY', country: 'AE', city: 'Sharjah' },
  { code: 'AE-4003970', name: 'QATAR AIRWAYS CARGO GSA', country: 'AE', city: 'Dubai' },
];

export const CARRIERS: Carrier[] = [
  { code: 'EK0523', name: 'EK 523 Kochi - Dubai', channel: 'AIR', operator: 'Emirates' },
  { code: 'EK0501', name: 'EK 501 Mumbai - Dubai', channel: 'AIR', operator: 'Emirates' },
  { code: 'EK0511', name: 'EK 511 Delhi - Dubai', channel: 'AIR', operator: 'Emirates' },
  { code: 'EK0363', name: 'EK 363 Hong Kong - Dubai', channel: 'AIR', operator: 'Emirates' },
  { code: 'EK9931', name: 'EK 9931 Shanghai - Dubai Freighter', channel: 'AIR', operator: 'Emirates' },
  { code: 'AI0933', name: 'AI 933 Kochi - Dubai', channel: 'AIR', operator: 'Air India' },
  { code: 'AI0983', name: 'AI 983 Delhi - Dubai', channel: 'AIR', operator: 'Air India' },
  { code: 'FZ0434', name: 'FZ 434 Bengaluru - Dubai', channel: 'AIR', operator: 'flydubai' },
  { code: 'PK0213', name: 'PK 213 Karachi - Dubai', channel: 'AIR', operator: 'Pakistan International' },
  { code: 'QR1018', name: 'QR 1018 Doha - Dubai', channel: 'AIR', operator: 'Qatar Airways' },
  { code: 'LH8410', name: 'LH 8410 Frankfurt - Dubai Freighter', channel: 'AIR', operator: 'Lufthansa Cargo' },
  { code: 'TK0762', name: 'TK 762 Istanbul - Dubai', channel: 'AIR', operator: 'Turkish Airlines' },
  { code: 'IMO9778791', name: 'MAERSK HONAM', channel: 'SEA', operator: 'Maersk Line' },
  { code: 'IMO9839179', name: 'MSC GULSUN', channel: 'SEA', operator: 'MSC' },
  { code: 'IMO9795610', name: 'CMA CGM JACQUES SAADE', channel: 'SEA', operator: 'CMA CGM' },
  { code: 'IMO9708801', name: 'COSCO SHIPPING UNIVERSE', channel: 'SEA', operator: 'COSCO' },
  { code: 'IMO9461867', name: 'ONE APUS', channel: 'SEA', operator: 'Ocean Network Express' },
  { code: 'IMO9525338', name: 'HAPAG EXPRESS DUBAI', channel: 'SEA', operator: 'Hapag-Lloyd' },
  { code: 'TRK-OM-48213', name: 'Truck OM 48213 (Muscat - Hatta)', channel: 'LAND', operator: 'Oman Road Freight' },
  { code: 'TRK-SA-77120', name: 'Truck SA 77120 (Riyadh - Ghuwaifat)', channel: 'LAND', operator: 'Saudi Land Transport' },
  { code: 'TRK-AE-10457', name: 'Truck AE 10457 (Sharjah - Dubai)', channel: 'LAND', operator: 'Gulf Road Transport' },
];

const airport = (code: string, name: string, country: string): Port => ({ code, name, country, channel: 'AIR' });
const seaport = (code: string, name: string, country: string): Port => ({ code, name, country, channel: 'SEA' });
const landPort = (code: string, name: string, country: string): Port => ({ code, name, country, channel: 'LAND' });

export const PORTS: Port[] = [
  airport('IXA', 'Agartala', 'IN'),
  airport('AGX', 'Agatti Island', 'IN'),
  airport('AGR', 'Agra', 'IN'),
  airport('AMD', 'Ahmedabad', 'IN'),
  airport('AJL', 'Aizawl', 'IN'),
  airport('AKD', 'Akola', 'IN'),
  airport('IXD', 'Allahabad', 'IN'),
  airport('IXV', 'Along', 'IN'),
  airport('ATQ', 'Amritsar', 'IN'),
  airport('QNB', 'Anand - Off-line Point', 'IN'),
  airport('IXU', 'Aurangabad', 'IN'),
  airport('BLR', 'Bengaluru', 'IN'),
  airport('BHO', 'Bhopal', 'IN'),
  airport('BBI', 'Bhubaneswar', 'IN'),
  airport('MAA', 'Chennai', 'IN'),
  airport('CJB', 'Coimbatore', 'IN'),
  airport('DEL', 'Delhi', 'IN'),
  airport('GOI', 'Goa', 'IN'),
  airport('HYD', 'Hyderabad', 'IN'),
  airport('JAI', 'Jaipur', 'IN'),
  airport('COK', 'Kochi', 'IN'),
  airport('CCU', 'Kolkata', 'IN'),
  airport('CCJ', 'Kozhikode', 'IN'),
  airport('LKO', 'Lucknow', 'IN'),
  airport('IXM', 'Madurai', 'IN'),
  airport('IXE', 'Mangaluru', 'IN'),
  airport('BOM', 'Mumbai', 'IN'),
  airport('NAG', 'Nagpur', 'IN'),
  airport('PNQ', 'Pune', 'IN'),
  airport('TRV', 'Thiruvananthapuram', 'IN'),
  airport('TRZ', 'Tiruchirappalli', 'IN'),
  airport('VNS', 'Varanasi', 'IN'),
  airport('KHI', 'Karachi', 'PK'),
  airport('LHE', 'Lahore', 'PK'),
  airport('ISB', 'Islamabad', 'PK'),
  airport('SKT', 'Sialkot', 'PK'),
  airport('PVG', 'Shanghai Pudong', 'CN'),
  airport('PEK', 'Beijing Capital', 'CN'),
  airport('CAN', 'Guangzhou Baiyun', 'CN'),
  airport('SZX', 'Shenzhen Bao an', 'CN'),
  airport('HKG', 'Hong Kong', 'HK'),
  airport('SIN', 'Singapore Changi', 'SG'),
  airport('BKK', 'Bangkok Suvarnabhumi', 'TH'),
  airport('SGN', 'Ho Chi Minh City', 'VN'),
  airport('CMB', 'Colombo', 'LK'),
  airport('DAC', 'Dhaka', 'BD'),
  airport('IST', 'Istanbul', 'TR'),
  airport('FRA', 'Frankfurt', 'DE'),
  airport('MUC', 'Munich', 'DE'),
  airport('MXP', 'Milan Malpensa', 'IT'),
  airport('LHR', 'London Heathrow', 'GB'),
  airport('CDG', 'Paris Charles de Gaulle', 'FR'),
  airport('AMS', 'Amsterdam Schiphol', 'NL'),
  airport('JFK', 'New York JFK', 'US'),
  airport('LAX', 'Los Angeles', 'US'),
  airport('DOH', 'Doha Hamad', 'QA'),
  airport('RUH', 'Riyadh', 'SA'),
  airport('MCT', 'Muscat', 'OM'),
  airport('NBO', 'Nairobi', 'KE'),
  airport('DXB', 'Dubai International - Cargo Terminal', 'AE'),
  airport('DWC', 'Dubai World Central - Al Maktoum Cargo', 'AE'),
  airport('SHJ', 'Sharjah International', 'AE'),
  airport('AUH', 'Abu Dhabi International', 'AE'),
  seaport('INNSA', 'Nhava Sheva (JNPT)', 'IN'),
  seaport('INMUN', 'Mundra', 'IN'),
  seaport('INMAA', 'Chennai Port', 'IN'),
  seaport('INCOK', 'Cochin Port', 'IN'),
  seaport('PKKHI', 'Karachi Port', 'PK'),
  seaport('PKBQM', 'Port Qasim', 'PK'),
  seaport('CNSHA', 'Shanghai', 'CN'),
  seaport('CNNGB', 'Ningbo', 'CN'),
  seaport('CNSZX', 'Shenzhen (Yantian)', 'CN'),
  seaport('CNCAN', 'Guangzhou (Nansha)', 'CN'),
  seaport('SGSIN', 'Singapore', 'SG'),
  seaport('MYPKG', 'Port Klang', 'MY'),
  seaport('LKCMB', 'Colombo Port', 'LK'),
  seaport('TRIST', 'Istanbul (Ambarli)', 'TR'),
  seaport('ITGOA', 'Genoa', 'IT'),
  seaport('DEHAM', 'Hamburg', 'DE'),
  seaport('NLRTM', 'Rotterdam', 'NL'),
  seaport('BEANR', 'Antwerp', 'BE'),
  seaport('GBFXT', 'Felixstowe', 'GB'),
  seaport('USNYC', 'New York / New Jersey', 'US'),
  seaport('USLAX', 'Los Angeles', 'US'),
  seaport('AEJEA', 'Jebel Ali', 'AE'),
  seaport('AEPRA', 'Port Rashid', 'AE'),
  seaport('AEKLF', 'Khor Fakkan', 'AE'),
  landPort('OMHAT', 'Hatta Border (Oman side)', 'OM'),
  landPort('SABAT', 'Al Batha Border', 'SA'),
  landPort('AEHAT', 'Hatta Land Border', 'AE'),
  landPort('AEGHU', 'Ghuwaifat Land Border', 'AE'),
];

export const WEIGHT_UNITS: Option[] = [
  { value: 'KG', label: 'Kilogram (KG)' },
  { value: 'TON', label: 'Metric Ton (TON)' },
  { value: 'LB', label: 'Pound (LB)' },
  { value: 'G', label: 'Gram (G)' },
];

// Kilograms per unit, used to compare net and gross weight across units
export const WEIGHT_IN_KG: Record<string, number> = { KG: 1, TON: 1000, LB: 0.453592, G: 0.001 };

export const VOLUME_UNITS: Option[] = [
  { value: 'CBM', label: 'Cubic Metre (CBM)' },
  { value: 'LTR', label: 'Litre (LTR)' },
  { value: 'CFT', label: 'Cubic Feet (CFT)' },
];

export const CARGO_TYPES: Option[] = [
  { value: 'GENERAL', label: 'General Cargo' },
  { value: 'PERISHABLE', label: 'Perishable' },
  { value: 'DANGEROUS', label: 'Dangerous Goods' },
  { value: 'VALUABLE', label: 'Valuable Cargo' },
  { value: 'PHARMA', label: 'Pharmaceutical (Temperature Controlled)' },
  { value: 'LIVE_ANIMALS', label: 'Live Animals' },
  { value: 'PERSONAL_EFFECTS', label: 'Personal Effects' },
];

export const INCOTERMS: Option[] = [
  { value: 'EXW', label: 'EXW - Ex Works' },
  { value: 'FCA', label: 'FCA - Free Carrier' },
  { value: 'FAS', label: 'FAS - Free Alongside Ship' },
  { value: 'FOB', label: 'FOB - Free On Board' },
  { value: 'CFR', label: 'CFR - Cost and Freight' },
  { value: 'CIF', label: 'CIF - Cost, Insurance and Freight' },
  { value: 'CPT', label: 'CPT - Carriage Paid To' },
  { value: 'CIP', label: 'CIP - Carriage and Insurance Paid To' },
  { value: 'DAP', label: 'DAP - Delivered At Place' },
  { value: 'DPU', label: 'DPU - Delivered At Place Unloaded' },
  { value: 'DDP', label: 'DDP - Delivered Duty Paid' },
];

export const INVOICE_TYPES: Option[] = [
  { value: 'COMMERCIAL', label: 'Commercial Invoice' },
  { value: 'PROFORMA', label: 'Proforma Invoice' },
  { value: 'CONSULAR', label: 'Consular Invoice' },
  { value: 'CUSTOMS', label: 'Customs Invoice' },
];

export const PAYMENT_TERMS: Option[] = [
  { value: 'ADVANCE', label: 'Advance Payment' },
  { value: 'LC', label: 'Letter of Credit' },
  { value: 'CAD', label: 'Cash Against Documents' },
  { value: 'OPEN', label: 'Open Account' },
  { value: 'CONSIGNMENT', label: 'Consignment' },
];

export const CURRENCIES: Currency[] = [
  { code: 'AED', name: 'UAE Dirham', aedRate: 1 },
  { code: 'USD', name: 'US Dollar', aedRate: 3.6725 },
  { code: 'EUR', name: 'Euro', aedRate: 3.98 },
  { code: 'GBP', name: 'Pound Sterling', aedRate: 4.65 },
  { code: 'INR', name: 'Indian Rupee', aedRate: 0.0438 },
  { code: 'PKR', name: 'Pakistani Rupee', aedRate: 0.0132 },
  { code: 'CNY', name: 'Chinese Yuan', aedRate: 0.507 },
  { code: 'JPY', name: 'Japanese Yen', aedRate: 0.0245 },
  { code: 'SAR', name: 'Saudi Riyal', aedRate: 0.979 },
  { code: 'TRY', name: 'Turkish Lira', aedRate: 0.107 },
  { code: 'THB', name: 'Thai Baht', aedRate: 0.104 },
  { code: 'VND', name: 'Vietnamese Dong', aedRate: 0.000145 },
];

export const LINE_ITEM_UNITS: Option[] = [
  { value: 'PCS', label: 'Pieces (PCS)' },
  { value: 'KG', label: 'Kilogram (KG)' },
  { value: 'CTN', label: 'Carton (CTN)' },
  { value: 'SET', label: 'Set (SET)' },
  { value: 'LTR', label: 'Litre (LTR)' },
  { value: 'MTR', label: 'Metre (MTR)' },
  { value: 'PR', label: 'Pair (PR)' },
  { value: 'DZN', label: 'Dozen (DZN)' },
];

export const HS_CODES: HsCode[] = [
  { code: '09041100', description: 'Pepper, neither crushed nor ground', dutyRate: 0.05 },
  { code: '09083100', description: 'Cardamoms, neither crushed nor ground', dutyRate: 0.05 },
  { code: '09012100', description: 'Coffee, roasted, not decaffeinated', dutyRate: 0.05 },
  { code: '08045020', description: 'Mangoes, fresh', dutyRate: 0 },
  { code: '08039000', description: 'Bananas, fresh', dutyRate: 0 },
  { code: '10063020', description: 'Basmati rice, semi-milled or wholly milled', dutyRate: 0 },
  { code: '04021000', description: 'Milk powder, fat content not exceeding 1.5%', dutyRate: 0 },
  { code: '21069090', description: 'Food preparations, not elsewhere specified', dutyRate: 0.05 },
  { code: '22021000', description: 'Waters with added sugar or flavour (soft drinks)', dutyRate: 0.05 },
  { code: '24022000', description: 'Cigarettes containing tobacco', dutyRate: 1 },
  { code: '30049000', description: 'Medicaments, packaged for retail sale', dutyRate: 0 },
  { code: '30051000', description: 'Adhesive dressings and bandages', dutyRate: 0 },
  { code: '33030000', description: 'Perfumes and toilet waters', dutyRate: 0.05 },
  { code: '33049900', description: 'Beauty and skin-care preparations', dutyRate: 0.05 },
  { code: '39241000', description: 'Plastic tableware and kitchenware', dutyRate: 0.05 },
  { code: '42022200', description: 'Handbags with outer surface of textile', dutyRate: 0.05 },
  { code: '52083200', description: 'Woven cotton fabrics, dyed', dutyRate: 0.05 },
  { code: '61091000', description: 'T-shirts and vests of cotton, knitted', dutyRate: 0.05 },
  { code: '62034200', description: 'Men s trousers of cotton, not knitted', dutyRate: 0.05 },
  { code: '64039900', description: 'Footwear with leather uppers', dutyRate: 0.05 },
  { code: '69089000', description: 'Glazed ceramic tiles', dutyRate: 0.05 },
  { code: '72142000', description: 'Steel bars with deformations (rebar)', dutyRate: 0.05 },
  { code: '73239300', description: 'Stainless steel kitchenware', dutyRate: 0.05 },
  { code: '84151000', description: 'Air conditioning machines, wall or window type', dutyRate: 0.05 },
  { code: '84713000', description: 'Portable computers (laptops)', dutyRate: 0 },
  { code: '84716000', description: 'Computer input or output units', dutyRate: 0 },
  { code: '85171300', description: 'Smartphones', dutyRate: 0 },
  { code: '85235100', description: 'Solid-state storage devices', dutyRate: 0 },
  { code: '85287200', description: 'Television receivers, colour', dutyRate: 0.05 },
  { code: '85044000', description: 'Static converters (power adapters, chargers)', dutyRate: 0.05 },
  { code: '87083000', description: 'Brakes and parts for motor vehicles', dutyRate: 0.05 },
  { code: '87089900', description: 'Other parts and accessories for motor vehicles', dutyRate: 0.05 },
  { code: '90181900', description: 'Electro-diagnostic apparatus', dutyRate: 0 },
  { code: '90189090', description: 'Medical and surgical instruments', dutyRate: 0 },
  { code: '94016100', description: 'Upholstered seats with wooden frames', dutyRate: 0.05 },
  { code: '94035000', description: 'Wooden bedroom furniture', dutyRate: 0.05 },
  { code: '95030090', description: 'Toys, not elsewhere specified', dutyRate: 0.05 },
  { code: '71131900', description: 'Jewellery of precious metal', dutyRate: 0.05 },
];

export const PAYMENT_MODES: Option[] = [
  { value: 'CDR', label: 'CDR Account' },
  { value: 'CARD', label: 'Credit / Debit Card' },
  { value: 'BANK_GUARANTEE', label: 'Bank Guarantee' },
  { value: 'CASH_DEPOSIT', label: 'Cash Deposit Receipt' },
];

export const PAYMENT_REFERENCES: PaymentReference[] = [
  { value: 'CDR-1002345', label: 'CDR-1002345 (Balance AED 25,000.00)', mode: 'CDR' },
  { value: 'CDR-1007781', label: 'CDR-1007781 (Balance AED 3,150.00)', mode: 'CDR' },
  { value: 'CARD-ONLINE', label: 'Pay online after submission', mode: 'CARD' },
  { value: 'BG-55120931', label: 'BG-55120931 (Valid to 31-12-2026)', mode: 'BANK_GUARANTEE' },
  { value: 'BG-55127704', label: 'BG-55127704 (Valid to 30-06-2027)', mode: 'BANK_GUARANTEE' },
  { value: 'CDP-88214', label: 'CDP-88214 (AED 10,000.00)', mode: 'CASH_DEPOSIT' },
];

export const FEES: Fee[] = [
  { key: 'registration', label: 'Registration Fee', amount: 50 },
  { key: 'knowledge', label: 'Knowledge-Innovation Dirham Charge', amount: 20 },
  { key: 'archive', label: 'e-Archive service fee', amount: 5 },
];

export const PERSONAL_ID_TYPES: Option[] = [
  { value: 'EMIRATES_ID', label: 'Emirates ID' },
  { value: 'PASSPORT', label: 'Passport' },
];

export const PATTERNS = {
  partyCode: /^AE-\d{7}$/,
  emiratesId: /^784-\d{4}-\d{7}-\d$/,
  passport: /^[A-Z0-9]{6,9}$/,
  mawbAir: /^\d{11}$/,
  billOfLading: /^[A-Z0-9]{8,17}$/,
  reference: /^[A-Za-z0-9\-/]{3,20}$/,
  ddmmyyyy: /^\d{2}-\d{2}-\d{4}$/,
  hsCode: /^\d{8}$/,
  phone: /^\+?[0-9\s-]{7,16}$/,
};

export const MAWB_HINT: Record<CargoChannel, string> = {
  AIR: '11 digits: 3-digit airline prefix + 8-digit serial',
  SEA: 'Bill of lading, 8 to 17 letters or digits',
  LAND: 'Consignment note, 8 to 17 letters or digits',
};

// Sample invoice upload, the only format the upload accepts (.txt, pipe-delimited)
export const INVOICE_UPLOAD_SAMPLE = [
  '# INV|invoice no|invoice date (DD-MM-YYYY)|seller code|pages|terms of delivery|invoice type|currency|value|freight|freight currency|insurance|insurance currency|payment term',
  '# ITEM|hs code|description|country of origin|quantity|unit|net weight (kg)|gross weight (kg)|value',
  'INV|KSE-2026-0147|18-11-2026|IN-EXP-20431|3|CIF|COMMERCIAL|USD|2500|180|USD|25|USD|LC',
  'ITEM|09041100|Black pepper, whole, 25 kg bags|IN|40|CTN|1000|1040|1500',
  'ITEM|09083100|Green cardamom, 10 kg bags|IN|20|CTN|200|215|1000',
].join('\n');
