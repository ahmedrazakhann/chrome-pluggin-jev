'use client';
import { Fragment, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { ChevronDown, Download, FileText, Pencil, Plus, Trash2, Upload } from 'lucide-react';
import { Invoice } from '@app-types/declaration';
import { InvoiceDetailsStepProps } from '@app-types/ui';
import SectionCard from '@components/ui/sectionCard';
import PortalButton from '@components/ui/portalButton';
import InvoiceForm from '@components/declaration/invoiceForm';
import LineItemModal from '@components/declaration/lineItemModal';
import { INCOTERMS, INVOICE_UPLOAD_SAMPLE } from '@constants/declarationData';
import { invoiceSchema, lineItemSchema } from '@app/validations/declarationValidation';
import { countryName, formatMoney, parseInvoiceUpload, toAed } from '@utils/declaration';

const ACTION_BUTTON = 'inline-flex h-7 w-7 items-center justify-center rounded-sm bg-portal-ink text-white hover:bg-black';

const InvoiceDetailsStep: React.FC<InvoiceDetailsStepProps> = ({ invoices, onChange, extraSellers, exporterCode, error }) => {
  const [editing, setEditing] = useState<Invoice | 'new' | null>(null);
  const [lineItemsFor, setLineItemsFor] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [uploadErrors, setUploadErrors] = useState<string[]>([]);
  const [fileName, setFileName] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const grandTotal = invoices.reduce((sum, invoice) => sum + toAed(invoice.value, invoice.currency), 0);
  const invoiceNos = invoices.map(invoice => invoice.invoiceNo.toUpperCase());

  const saveInvoice = (invoice: Invoice, addLineItem: boolean) => {
    const exists = invoices.some(item => item.id === invoice.id);
    onChange(exists ? invoices.map(item => (item.id === invoice.id ? invoice : item)) : [...invoices, invoice]);
    setEditing(null);
    toast.success(`Invoice ${invoice.invoiceNo} saved`);
    if (addLineItem) setLineItemsFor(invoice.id);
  };

  const removeInvoice = (invoice: Invoice) => {
    if (!window.confirm(`Delete invoice ${invoice.invoiceNo} and its ${invoice.lineItems.length} line item(s)?`)) return;
    onChange(invoices.filter(item => item.id !== invoice.id));
  };

  const downloadSample = () => {
    const url = URL.createObjectURL(new Blob([INVOICE_UPLOAD_SAMPLE], { type: 'text/plain' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'invoice-upload-sample.txt';
    link.click();
    URL.revokeObjectURL(url);
  };

  const upload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return setUploadErrors(['Choose a .txt file to upload.']);
    if (!file.name.toLowerCase().endsWith('.txt'))
      return setUploadErrors(['Only .txt files are accepted. PDF and Excel files cannot be uploaded.']);
    if (file.size > 512 * 1024) return setUploadErrors(['The file is larger than 512 KB.']);

    const { invoices: parsed, errors } = parseInvoiceUpload(await file.text());
    // Run each parsed invoice and line item through the same rules as the manual forms
    for (const invoice of parsed) {
      const asForm = Object.fromEntries(
        Object.entries(invoice).map(([key, value]) => [key, typeof value === 'number' ? String(value) : value])
      );
      try {
        await invoiceSchema(extraSellers, invoiceNos).validate(asForm, { abortEarly: false });
      } catch (validation) {
        errors.push(...(validation as { errors: string[] }).errors.map(message => `Invoice ${invoice.invoiceNo}: ${message}`));
      }
      for (const [index, item] of invoice.lineItems.entries()) {
        try {
          await lineItemSchema.validate(item, { abortEarly: false });
        } catch (validation) {
          errors.push(
            ...(validation as { errors: string[] }).errors.map(message => `Invoice ${invoice.invoiceNo}, item ${index + 1}: ${message}`)
          );
        }
      }
    }

    if (errors.length) return setUploadErrors(errors);
    setUploadErrors([]);
    setFileName('');
    if (fileRef.current) fileRef.current.value = '';
    onChange([...invoices, ...parsed]);
    toast.success(`${parsed.length} invoice(s) uploaded`);
  };

  if (editing) {
    return (
      <InvoiceForm
        initial={editing === 'new' ? undefined : editing}
        extraSellers={extraSellers}
        exporterCode={exporterCode}
        existingInvoiceNos={invoiceNos}
        onSave={saveInvoice}
        onCancel={() => setEditing(null)}
      />
    );
  }

  return (
    <>
      {error ? (
        <p role="alert" className="mb-3 rounded-sm border border-portal-red/30 bg-red-50 px-3 py-2 text-[12px] text-portal-red">
          {error}
        </p>
      ) : null}

      {invoices.length ? (
        <SectionCard title="Invoice Details">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-[12px]">
              <thead>
                <tr className="bg-gray-100 text-gray-700">
                  {['Invoice No.', 'Invoice Date', 'Terms of Delivery', 'Value', 'No. of Line Items', 'Action'].map(heading => (
                    <th key={heading} className="px-3 py-2 font-semibold">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {invoices.map(invoice => (
                  <Fragment key={invoice.id}>
                    <tr className="border-b border-gray-100">
                      <td className="px-3 py-2">{invoice.invoiceNo}</td>
                      <td className="px-3 py-2">{invoice.invoiceDate}</td>
                      <td className="px-3 py-2" title={INCOTERMS.find(term => term.value === invoice.termsOfDelivery)?.label}>
                        {invoice.termsOfDelivery}
                      </td>
                      <td className="px-3 py-2">
                        {invoice.currency} {invoice.value.toLocaleString('en-US')}
                      </td>
                      <td className="px-3 py-2">{invoice.lineItems.length} line item(s)</td>
                      <td className="px-3 py-1.5">
                        <div className="flex gap-1">
                          <button
                            type="button"
                            className={ACTION_BUTTON}
                            aria-label={`View line items of ${invoice.invoiceNo}`}
                            title="View line items"
                            aria-expanded={expanded === invoice.id}
                            onClick={() => setExpanded(expanded === invoice.id ? null : invoice.id)}
                          >
                            <ChevronDown size={14} className={expanded === invoice.id ? 'rotate-180' : ''} />
                          </button>
                          <button
                            type="button"
                            className={ACTION_BUTTON}
                            aria-label={`Edit invoice ${invoice.invoiceNo}`}
                            title="Edit invoice"
                            onClick={() => setEditing(invoice)}
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            type="button"
                            className={ACTION_BUTTON}
                            aria-label={`Add line items to ${invoice.invoiceNo}`}
                            title="Add line items"
                            onClick={() => setLineItemsFor(invoice.id)}
                          >
                            <Plus size={14} />
                          </button>
                          <button
                            type="button"
                            className={ACTION_BUTTON}
                            aria-label={`Delete invoice ${invoice.invoiceNo}`}
                            title="Delete invoice"
                            onClick={() => removeInvoice(invoice)}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expanded === invoice.id ? (
                      <tr className="bg-orange-50/40">
                        <td colSpan={6} className="px-3 py-2">
                          {invoice.lineItems.length ? (
                            <ul className="space-y-1">
                              {invoice.lineItems.map((item, index) => (
                                <li key={item.id} className="text-gray-700">
                                  {index + 1}. <span className="font-medium">{item.hsCode}</span> {item.description} - {item.quantity}{' '}
                                  {item.unit}, {countryName(item.countryOfOrigin)}, {formatMoney(item.value, invoice.currency)}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-gray-500">No line items yet. Use + to add them.</p>
                          )}
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[12px] font-semibold text-gray-800">Grand Total: {formatMoney(grandTotal)}</p>
        </SectionCard>
      ) : null}

      <SectionCard title="Add/Upload Invoice">
        <div className="flex flex-col items-stretch gap-3 md:flex-row md:items-center md:justify-around">
          <PortalButton onClick={() => setEditing('new')} startIcon={<Plus size={14} />}>
            Add Invoice
          </PortalButton>
          <span className="text-center text-[12px] text-gray-600">Or Upload</span>
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex min-w-0 items-center gap-1.5">
              <label className="flex h-9 min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-sm border border-portal-line bg-white px-2 text-[12px] text-gray-600 md:w-72">
                <span className="shrink-0 rounded-sm border border-gray-300 bg-gray-50 px-2 py-0.5 text-gray-800">Choose File</span>
                <span className="truncate">{fileName || 'No file chosen'}</span>
                <input
                  ref={fileRef}
                  type="file"
                  name="invoiceUpload"
                  accept=".txt,text/plain"
                  className="sr-only"
                  onChange={event => {
                    setFileName(event.target.files?.[0]?.name ?? '');
                    setUploadErrors([]);
                  }}
                />
              </label>
              <PortalButton onClick={upload} startIcon={<Upload size={14} />}>
                Upload
              </PortalButton>
            </div>
            <button
              type="button"
              onClick={downloadSample}
              className="flex items-center gap-1 self-start text-[11px] text-blue-700 hover:underline"
            >
              <Download size={12} /> Download the .txt upload format
            </button>
          </div>
        </div>
        {uploadErrors.length ? (
          <ul role="alert" className="mt-3 max-h-40 list-disc space-y-0.5 overflow-y-auto pl-5 text-[12px] text-portal-red">
            {uploadErrors.map(message => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        ) : null}
        {!invoices.length ? (
          <p className="mt-3 flex items-center justify-center gap-1.5 text-[12px] text-gray-500">
            <FileText size={14} /> No invoices added yet.
          </p>
        ) : null}
      </SectionCard>

      <LineItemModal
        open={!!lineItemsFor}
        invoice={invoices.find(invoice => invoice.id === lineItemsFor)}
        onSave={invoice => onChange(invoices.map(item => (item.id === invoice.id ? invoice : item)))}
        onClose={() => setLineItemsFor(null)}
      />
    </>
  );
};

export default InvoiceDetailsStep;
