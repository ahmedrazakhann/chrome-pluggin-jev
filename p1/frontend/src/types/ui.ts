import { ReactNode } from 'react';
import { FormikProps } from 'formik';
import {
  CargoChannel,
  Carrier,
  DeclarationValues,
  HsCode,
  Invoice,
  Option,
  Party,
  PartyRole,
  Port,
  SearchColumn,
  SearchFilter,
} from '@app-types/declaration';

export interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'md' | 'lg' | 'xl';
}

export interface SectionCardProps {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}

export interface FieldRowProps {
  label: string;
  htmlFor?: string;
  required?: boolean;
  info?: string;
  error?: string;
  children: ReactNode;
  className?: string;
}

interface FormControlBase {
  // Any Formik instance whose values include `name`
  formik: FormikProps<any>;
  name: string;
  label: string;
  required?: boolean;
  info?: string;
  disabled?: boolean;
  className?: string;
}

export interface FormInputProps extends FormControlBase {
  type?: 'text' | 'number' | 'email' | 'tel';
  placeholder?: string;
  maxLength?: number;
  uppercase?: boolean;
  hint?: string;
  // Extra control rendered beside the input, e.g. a unit dropdown
  addon?: ReactNode;
}

export interface FormSelectProps extends FormControlBase {
  options: Option[];
  placeholder?: string;
  onValueChange?: (value: string) => void;
}

export interface UnitSelectProps {
  formik: FormikProps<any>;
  name: string;
  label: string;
  options: Option[];
}

export interface DateInputProps extends FormControlBase {
  hint?: string;
}

export interface LookupInputProps extends FormControlBase {
  onSearch: () => void;
  selectedName?: string;
  placeholder?: string;
}

export interface SearchModalProps<T> {
  open: boolean;
  title: string;
  filters: SearchFilter[];
  columns: SearchColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  matches: (row: T, values: Record<string, string>) => boolean;
  onSelect: (row: T) => void;
  onClose: () => void;
}

interface LookupModalBase<T> {
  open: boolean;
  onSelect: (row: T) => void;
  onClose: () => void;
}

export interface PartySearchModalProps extends LookupModalBase<Party> {
  role: PartyRole;
  title: string;
  extra?: Party[];
}

export interface PortSearchModalProps extends LookupModalBase<Port> {
  channel: CargoChannel;
  uaeOnly?: boolean;
}

export interface CarrierSearchModalProps extends LookupModalBase<Carrier> {
  channel: CargoChannel;
}

export type HsCodeSearchModalProps = LookupModalBase<HsCode>;

export interface StepperProps {
  steps: string[];
  current: number;
  furthest: number;
  onStepClick: (index: number) => void;
}

export interface GeneralInformationStepProps {
  formik: FormikProps<DeclarationValues>;
  extraExporters: Party[];
  extraImporters: Party[];
  onAddExporter: (party: Party) => void;
  onAddImporter: (party: Party) => void;
}

export interface ShippingDetailsStepProps {
  formik: FormikProps<DeclarationValues>;
  importer?: Party;
}

export interface InvoiceDetailsStepProps {
  invoices: Invoice[];
  onChange: (invoices: Invoice[]) => void;
  extraSellers: Party[];
  exporterCode: string;
  error?: string;
}

export interface InvoiceFormProps {
  initial?: Invoice;
  extraSellers: Party[];
  exporterCode: string;
  existingInvoiceNos: string[];
  onSave: (invoice: Invoice, addLineItem: boolean) => void;
  onCancel: () => void;
}

export interface LineItemModalProps {
  open: boolean;
  invoice?: Invoice;
  onSave: (invoice: Invoice) => void;
  onClose: () => void;
}

export interface PaymentDetailsStepProps {
  formik: FormikProps<DeclarationValues>;
  invoices: Invoice[];
  importer?: Party;
}

export interface PartyModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (party: Party) => void;
}

export interface SubmissionResultProps {
  declarationNumber: string;
  values: DeclarationValues;
  invoices: Invoice[];
  onStartNew: () => void;
}

export interface PortalButtonProps {
  children: ReactNode;
  type?: 'button' | 'submit';
  variant?: 'dark' | 'orange' | 'light' | 'danger';
  disabled?: boolean;
  startIcon?: ReactNode;
  endIcon?: ReactNode;
  className?: string;
  onClick?: () => void;
  title?: string;
}
