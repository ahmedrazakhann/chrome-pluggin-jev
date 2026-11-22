'use client';
import { useRef, useState } from 'react';
import { useFormik } from 'formik';
import { ListPlus, RotateCcw, Save } from 'lucide-react';
import { Invoice, InvoiceFormValues } from '@app-types/declaration';
import { InvoiceFormProps } from '@app-types/ui';
import FormInput from '@components/ui/formInput';
import FormSelect from '@components/ui/formSelect';
import DateInput from '@components/ui/dateInput';
import LookupInput from '@components/ui/lookupInput';
import UnitSelect from '@components/ui/unitSelect';
import PortalButton from '@components/ui/portalButton';
import PartySearchModal from '@components/declaration/lookups/partySearchModal';
import { CURRENCIES, INCOTERMS, INVOICE_TYPES, PAYMENT_TERMS } from '@constants/declarationData';
import { invoiceSchema } from '@app/validations/declarationValidation';
import { findParty, formatMoney, invoiceCifAed, newId } from '@utils/declaration';

const CURRENCY_OPTIONS = CURRENCIES.map(currency => ({ value: currency.code, label: `${currency.code} - ${currency.name}` }));
const CURRENCY_SHORT = CURRENCIES.map(currency => ({ value: currency.code, label: currency.code }));

const toFormValues = (invoice?: Invoice): InvoiceFormValues => ({
  invoiceNo: invoice?.invoiceNo ?? '',
  invoiceDate: invoice?.invoiceDate ?? '',
  sellerCode: invoice?.sellerCode ?? '',
  pages: invoice ? String(invoice.pages) : '',
  termsOfDelivery: invoice?.termsOfDelivery ?? '',
  invoiceType: invoice?.invoiceType ?? '',
  insuranceCost: invoice ? String(invoice.insuranceCost) : '',
  insuranceCurrency: invoice?.insuranceCurrency ?? '',
  freightCost: invoice ? String(invoice.freightCost) : '',
  freightCurrency: invoice?.freightCurrency ?? '',
  currency: invoice?.currency ?? '',
  value: invoice ? String(invoice.value) : '',
  paymentTerm: invoice?.paymentTerm ?? '',
});

const InvoiceForm: React.FC<InvoiceFormProps> = ({ initial, extraSellers, exporterCode, existingInvoiceNos, onSave, onCancel }) => {
  const [sellerOpen, setSellerOpen] = useState(false);
  // Which button submitted: Save, or Save & Add Line Item
  const addLineItem = useRef(false);

  const formik = useFormik<InvoiceFormValues>({
    initialValues: toFormValues(initial),
    validationSchema: invoiceSchema(
      extraSellers,
      existingInvoiceNos.filter(no => no !== initial?.invoiceNo.toUpperCase())
    ),
    onSubmit: values => {
      onSave(
        {
          id: initial?.id ?? newId(),
          invoiceNo: values.invoiceNo.trim().toUpperCase(),
          invoiceDate: values.invoiceDate,
          sellerCode: values.sellerCode.trim().toUpperCase(),
          pages: Number(values.pages),
          termsOfDelivery: values.termsOfDelivery,
          invoiceType: values.invoiceType,
          insuranceCost: Number(values.insuranceCost),
          insuranceCurrency: values.insuranceCurrency,
          freightCost: Number(values.freightCost),
          freightCurrency: values.freightCurrency,
          currency: values.currency,
          value: Number(values.value),
          paymentTerm: values.paymentTerm,
          lineItems: initial?.lineItems ?? [],
        },
        addLineItem.current
      );
    },
  });

  const { values } = formik;
  const ready = values.value && values.currency && values.freightCurrency && values.insuranceCurrency;
  const cif = ready
    ? invoiceCifAed({
        ...(initial as Invoice),
        value: Number(values.value) || 0,
        currency: values.currency,
        freightCost: Number(values.freightCost) || 0,
        freightCurrency: values.freightCurrency,
        insuranceCost: Number(values.insuranceCost) || 0,
        insuranceCurrency: values.insuranceCurrency,
      })
    : null;
  const exporter = findParty('exporter', exporterCode, extraSellers);

  const submit = (withLineItem: boolean) => {
    addLineItem.current = withLineItem;
    formik.handleSubmit();
  };

  return (
    <div className="animate-fadeIn">
      <h3 className="mb-3 text-xl text-portal-red">{initial ? `Edit Invoice ${initial.invoiceNo}` : 'New'}</h3>
      <form
        onSubmit={event => {
          event.preventDefault();
          submit(false);
        }}
        noValidate
        className="rounded-sm border border-portal-line bg-white p-3 md:p-4"
      >
        <h4 className="mb-3 text-[13px] font-bold text-portal-red">Invoice Details</h4>
        <div className="grid gap-3 md:grid-cols-2 md:gap-x-6">
          <FormInput formik={formik} name="invoiceNo" label="Invoice No." required uppercase maxLength={20} />
          <DateInput formik={formik} name="invoiceDate" label="Invoice Date" required info="Date printed on the invoice, DD-MM-YYYY" />
          <div>
            <LookupInput
              formik={formik}
              name="sellerCode"
              label="Seller"
              required
              selectedName={findParty('exporter', values.sellerCode, extraSellers)?.name}
              onSearch={() => setSellerOpen(true)}
            />
            <div className="mt-1.5 md:ml-[162px]">
              <PortalButton
                className="!min-h-7 !px-2.5 !py-1 !text-[11px]"
                disabled={!exporter}
                title={exporter ? `Use ${exporter.name}` : 'Choose an exporter on step 1 first'}
                onClick={() => {
                  formik.setFieldValue('sellerCode', exporterCode, true);
                  formik.setFieldTouched('sellerCode', true, false);
                }}
              >
                Same as Exporter
              </PortalButton>
            </div>
          </div>
          <FormInput formik={formik} name="pages" label="No. of Pages" required type="number" />
          <FormSelect formik={formik} name="termsOfDelivery" label="Terms of Delivery" required options={INCOTERMS} />
          <FormSelect formik={formik} name="invoiceType" label="Invoice Type" required options={INVOICE_TYPES} />
          <FormInput
            formik={formik}
            name="insuranceCost"
            label="Insurance Cost"
            required
            type="number"
            addon={<UnitSelect formik={formik} name="insuranceCurrency" label="Insurance currency" options={CURRENCY_SHORT} />}
          />
          <FormInput
            formik={formik}
            name="freightCost"
            label="Freight Cost"
            required
            type="number"
            addon={<UnitSelect formik={formik} name="freightCurrency" label="Freight currency" options={CURRENCY_SHORT} />}
          />
          <FormSelect formik={formik} name="currency" label="Currency" required options={CURRENCY_OPTIONS} />
          <FormInput formik={formik} name="value" label="Value" required type="number" info="Total goods value in the invoice currency" />
          <FormSelect formik={formik} name="paymentTerm" label="Payment Term" required options={PAYMENT_TERMS} />
          <div className="grid grid-cols-1 gap-1 md:grid-cols-[150px_minmax(0,1fr)] md:gap-3">
            <span className="text-[12px] text-portal-label md:pt-2.5 md:text-right">CIF Value:</span>
            <output className="pt-2 text-[13px] font-semibold text-gray-800">{cif === null ? '—' : formatMoney(cif)}</output>
          </div>
        </div>
        {['insuranceCurrency', 'freightCurrency'].map(name =>
          (formik.touched[name] || formik.submitCount > 0) && formik.errors[name] ? (
            <p key={name} role="alert" className="mt-2 text-[12px] text-portal-red md:ml-[162px]">
              {formik.errors[name] as string}
            </p>
          ) : null
        )}
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <PortalButton type="submit" startIcon={<Save size={14} />}>
            Save
          </PortalButton>
          <PortalButton onClick={() => submit(true)} startIcon={<ListPlus size={14} />}>
            Save &amp; Add Line Item
          </PortalButton>
          <PortalButton onClick={onCancel} startIcon={<RotateCcw size={14} />}>
            Cancel
          </PortalButton>
        </div>
      </form>

      <PartySearchModal
        open={sellerOpen}
        role="exporter"
        title="Search Seller"
        extra={extraSellers}
        onClose={() => setSellerOpen(false)}
        onSelect={party => {
          formik.setFieldValue('sellerCode', party.code, true);
          formik.setFieldTouched('sellerCode', true, false);
          setSellerOpen(false);
        }}
      />
    </div>
  );
};

export default InvoiceForm;
