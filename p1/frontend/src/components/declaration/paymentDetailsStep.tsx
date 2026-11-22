'use client';
import { useState } from 'react';
import { Info } from 'lucide-react';
import { PaymentDetailsStepProps } from '@app-types/ui';
import Modal from '@components/ui/modal';
import PortalButton from '@components/ui/portalButton';
import { INPUT_CLASS, INPUT_ERROR_CLASS } from '@constants/styles';
import { PAYMENT_MODES, PAYMENT_REFERENCES } from '@constants/declarationData';
import { calculateDuty, formatMoney } from '@utils/declaration';
import { fieldError } from '@utils/form';

const PaymentDetailsStep: React.FC<PaymentDetailsStepProps> = ({ formik, invoices, importer }) => {
  const [termsOpen, setTermsOpen] = useState(false);
  const { duty, fees, feesTotal, cifAed } = calculateDuty(invoices);
  const { values } = formik;

  const paymentSelect = (name: string, label: string, options: { value: string; label: string }[], onChange?: () => void) => {
    const error = fieldError(formik, name);
    return (
      <div>
        <select
          id={name}
          name={name}
          aria-label={label}
          value={values[name] ?? ''}
          onChange={event => {
            formik.setFieldValue(name, event.target.value);
            onChange?.();
          }}
          onBlur={formik.handleBlur}
          aria-invalid={!!error}
          className={`${INPUT_CLASS} ${error ? INPUT_ERROR_CLASS : ''}`}
        >
          <option value="">[Please Select]</option>
          {options.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {error ? (
          <p role="alert" className="mt-1 text-[12px] text-portal-red">
            {error}
          </p>
        ) : null}
      </div>
    );
  };

  const paymentRow = (prefix: 'duty' | 'charges', what: string) => {
    const mode = values[`${prefix}PaymentMode`];
    return (
      <div className="grid gap-2 md:grid-cols-2 md:gap-6">
        {paymentSelect(`${prefix}PaymentMode`, `Payment mode for ${what}`, PAYMENT_MODES, () =>
          formik.setFieldValue(`${prefix}PaymentReference`, '')
        )}
        {paymentSelect(
          `${prefix}PaymentReference`,
          `Payment reference for ${what}`,
          PAYMENT_REFERENCES.filter(reference => reference.mode === mode)
        )}
      </div>
    );
  };

  const undertakingError = fieldError(formik, 'undertakingAccepted');

  return (
    <>
      {importer && importer.vatRegistered === false ? (
        <p className="mb-3 flex items-start gap-2 rounded-sm bg-sky-100 px-3 py-2.5 text-[12px] text-sky-900">
          <Info size={15} className="mt-0.5 shrink-0" />
          Importer is not registered in the Federal Tax Authority system. Customs clearance will be given only after the tax authority
          approves VAT.
        </p>
      ) : null}

      <section className="mb-4">
        <h3 className="mb-1.5 text-[13px] font-bold text-portal-red">Payment Details</h3>
        <div className="rounded-sm border border-portal-line bg-white p-3 md:p-4">
          <div className="mb-3 hidden gap-6 md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
            <span />
            <div className="grid grid-cols-2 gap-6 text-[12px] font-semibold text-gray-700">
              <span>
                Payment Mode <span className="text-portal-red">*</span>
              </span>
              <span>
                Payment Reference <span className="text-portal-red">*</span>
              </span>
            </div>
          </div>

          <div className="grid gap-3 border-b border-gray-100 pb-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] md:gap-6">
            <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-[12px] md:grid-cols-[minmax(0,1fr)_120px]">
              <dt className="font-semibold text-gray-800 md:text-right">Custom Duty / Tax:</dt>
              <dd className="font-semibold text-gray-800">{formatMoney(duty)}</dd>
              <dt className="text-gray-600 md:text-right">Duty:</dt>
              <dd className="text-gray-700">{formatMoney(duty)}</dd>
              <dt className="text-gray-500 md:text-right">CIF value (AED):</dt>
              <dd className="text-gray-500">{formatMoney(cifAed)}</dd>
            </dl>
            {duty > 0 ? paymentRow('duty', 'customs duty') : <p className="text-[12px] text-gray-500">No duty payable on these goods.</p>}
          </div>

          <div className="grid gap-3 pt-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] md:gap-6">
            <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-[12px] md:grid-cols-[minmax(0,1fr)_120px]">
              <dt className="font-semibold text-gray-800 md:text-right">Other Charges:</dt>
              <dd className="font-semibold text-gray-800">{formatMoney(feesTotal)}</dd>
              {fees.map(fee => (
                <FeeRow key={fee.key} label={fee.label} amount={fee.amount} />
              ))}
            </dl>
            {paymentRow('charges', 'other charges')}
          </div>
        </div>
      </section>

      <div
        className={`rounded-sm border px-3 py-3 text-[12px] leading-relaxed text-gray-800 ${undertakingError ? 'border-portal-red bg-red-50' : 'border-green-200 bg-green-50'}`}
      >
        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            id="undertakingAccepted"
            name="undertakingAccepted"
            checked={values.undertakingAccepted}
            onChange={formik.handleChange}
            className="mt-0.5 h-4 w-4 shrink-0 accent-portal-orange"
          />
          <span>
            I, the undersigned, being authorized by <strong>{importer?.name ?? 'the importer'}</strong> for the purposes of using the
            electronic services of this portal, declare and undertake to comply with the terms and conditions referred to hereinafter,
            without prejudice to any obligations and provisions in the customs law, policies and decisions. I, the Authorized Person, have
            carefully read and fully understood the{' '}
            <button type="button" onClick={() => setTermsOpen(true)} className="text-blue-700 underline">
              Terms and Conditions
            </button>{' '}
            and accept them.
          </span>
        </label>
        {undertakingError ? (
          <p role="alert" className="mt-1.5 pl-6 text-portal-red">
            {undertakingError}
          </p>
        ) : null}
      </div>

      <Modal
        open={termsOpen}
        title="Terms and Conditions"
        onClose={() => setTermsOpen(false)}
        size="md"
        footer={<PortalButton onClick={() => setTermsOpen(false)}>Close</PortalButton>}
      >
        <ol className="list-decimal space-y-2 p-5 pl-9 text-[13px] text-gray-700">
          <li>The declarant is responsible for the accuracy of every value entered in this declaration.</li>
          <li>Duty and fees are calculated from the declared CIF value and HS codes and may be reassessed on inspection.</li>
          <li>Documents marked &quot;To Follow&quot; must be presented within 30 days of clearance.</li>
          <li>This is a sandbox: submissions are not sent to any customs authority and no payment is taken.</li>
        </ol>
      </Modal>
    </>
  );
};

const FeeRow: React.FC<{ label: string; amount: number }> = ({ label, amount }) => (
  <>
    <dt className="text-gray-600 md:text-right">{label}:</dt>
    <dd className="text-gray-700">{formatMoney(amount)}</dd>
  </>
);

export default PaymentDetailsStep;
