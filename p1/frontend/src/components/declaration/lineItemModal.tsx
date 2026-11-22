'use client';
import { useState } from 'react';
import { useFormik } from 'formik';
import { Plus, Trash2, X } from 'lucide-react';
import { LineItemFormValues } from '@app-types/declaration';
import { LineItemModalProps } from '@app-types/ui';
import Modal from '@components/ui/modal';
import PortalButton from '@components/ui/portalButton';
import FormInput from '@components/ui/formInput';
import FormSelect from '@components/ui/formSelect';
import LookupInput from '@components/ui/lookupInput';
import HsCodeSearchModal from '@components/declaration/lookups/hsCodeSearchModal';
import { COUNTRIES, LINE_ITEM_UNITS } from '@constants/declarationData';
import { lineItemSchema } from '@app/validations/declarationValidation';
import { countryName, findHsCode, formatMoney, lineItemsTotal, newId } from '@utils/declaration';

const INITIAL: LineItemFormValues = {
  hsCode: '',
  description: '',
  countryOfOrigin: '',
  quantity: '',
  unit: '',
  netWeight: '',
  grossWeight: '',
  value: '',
};
const COUNTRY_OPTIONS = COUNTRIES.map(country => ({ value: country.code, label: country.name }));

// Line items for one invoice: add form on top, the items already added underneath.
const LineItemModal: React.FC<LineItemModalProps> = ({ open, invoice, onSave, onClose }) => {
  const [hsOpen, setHsOpen] = useState(false);

  const formik = useFormik<LineItemFormValues>({
    initialValues: INITIAL,
    validationSchema: lineItemSchema,
    onSubmit: (values, helpers) => {
      if (!invoice) return;
      onSave({
        ...invoice,
        lineItems: [
          ...invoice.lineItems,
          {
            id: newId(),
            hsCode: values.hsCode.trim(),
            description: values.description.trim(),
            countryOfOrigin: values.countryOfOrigin,
            quantity: Number(values.quantity),
            unit: values.unit,
            netWeight: Number(values.netWeight),
            grossWeight: Number(values.grossWeight),
            value: Number(values.value),
          },
        ],
      });
      helpers.resetForm();
    },
  });

  if (!invoice) return null;

  const total = lineItemsTotal(invoice.lineItems);
  const remaining = invoice.value - total;

  const close = () => {
    formik.resetForm();
    onClose();
  };

  return (
    <Modal
      open={open}
      title={`Line Items - Invoice ${invoice.invoiceNo}`}
      onClose={close}
      size="xl"
      footer={
        <>
          <PortalButton variant="orange" startIcon={<Plus size={14} />} onClick={() => formik.handleSubmit()}>
            Add Line Item
          </PortalButton>
          <PortalButton onClick={close} startIcon={<X size={14} />}>
            Done
          </PortalButton>
        </>
      }
    >
      <form onSubmit={formik.handleSubmit} noValidate className="p-4">
        <h3 className="mb-3 text-[13px] font-bold text-portal-red">Add Line Item</h3>
        <div className="grid gap-3 md:grid-cols-2 md:gap-x-6">
          <LookupInput
            formik={formik}
            name="hsCode"
            label="HS Code"
            required
            info="8-digit harmonised system code; it sets the duty rate"
            selectedName={findHsCode(formik.values.hsCode)?.description}
            onSearch={() => setHsOpen(true)}
          />
          <FormInput formik={formik} name="description" label="Goods Description" required maxLength={200} />
          <FormSelect formik={formik} name="countryOfOrigin" label="Country of Origin" required options={COUNTRY_OPTIONS} />
          <FormInput formik={formik} name="quantity" label="Quantity" required type="number" />
          <FormSelect formik={formik} name="unit" label="Unit" required options={LINE_ITEM_UNITS} />
          <FormInput formik={formik} name="value" label={`Value (${invoice.currency})`} required type="number" />
          <FormInput formik={formik} name="netWeight" label="Net Weight (KG)" required type="number" />
          <FormInput formik={formik} name="grossWeight" label="Gross Weight (KG)" required type="number" />
        </div>
        {/* Enter in any field adds the item */}
        <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
      </form>

      <div className="border-t border-portal-line px-4 pb-4 pt-3">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-[13px] font-bold text-portal-red">Added Line Items ({invoice.lineItems.length})</h3>
          <p className={`text-[12px] ${Math.abs(remaining) < 0.005 ? 'text-green-700' : 'text-amber-700'}`}>
            Items total {formatMoney(total, invoice.currency)} of invoice value {formatMoney(invoice.value, invoice.currency)}
            {Math.abs(remaining) >= 0.005
              ? ` (${formatMoney(Math.abs(remaining), invoice.currency)} ${remaining > 0 ? 'left' : 'over'})`
              : ''}
          </p>
        </div>
        {invoice.lineItems.length === 0 ? (
          <p className="py-4 text-center text-[12px] text-gray-500">No line items yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-[12px]">
              <thead>
                <tr className="bg-gray-100 text-gray-700">
                  {['#', 'HS Code', 'Description', 'Origin', 'Qty', 'Net / Gross (KG)', 'Value', ''].map(heading => (
                    <th key={heading} className="px-2 py-2 font-semibold">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {invoice.lineItems.map((item, index) => (
                  <tr key={item.id} className="border-b border-gray-100">
                    <td className="px-2 py-1.5">{index + 1}</td>
                    <td className="px-2 py-1.5">{item.hsCode}</td>
                    <td className="px-2 py-1.5">{item.description}</td>
                    <td className="px-2 py-1.5">{countryName(item.countryOfOrigin)}</td>
                    <td className="px-2 py-1.5">
                      {item.quantity} {item.unit}
                    </td>
                    <td className="px-2 py-1.5">
                      {item.netWeight} / {item.grossWeight}
                    </td>
                    <td className="px-2 py-1.5">{formatMoney(item.value, invoice.currency)}</td>
                    <td className="px-2 py-1.5">
                      <button
                        type="button"
                        aria-label={`Remove line item ${index + 1}`}
                        title="Remove"
                        onClick={() => onSave({ ...invoice, lineItems: invoice.lineItems.filter(entry => entry.id !== item.id) })}
                        className="rounded-sm p-1 text-portal-red hover:bg-red-50"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <HsCodeSearchModal
        open={hsOpen}
        onClose={() => setHsOpen(false)}
        onSelect={hs => {
          formik.setFieldValue('hsCode', hs.code, true);
          formik.setFieldTouched('hsCode', true, false);
          if (!formik.values.description) formik.setFieldValue('description', hs.description);
          setHsOpen(false);
        }}
      />
    </Modal>
  );
};

export default LineItemModal;
