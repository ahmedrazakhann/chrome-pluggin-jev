'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { ChevronLeft, ChevronRight, Send } from 'lucide-react';
import { CargoChannel, DeclarationValues, Invoice, Party } from '@app-types/declaration';
import PortalHeader from '@components/declaration/portalHeader';
import Stepper from '@components/declaration/stepper';
import GeneralInformationStep from '@components/declaration/generalInformationStep';
import ShippingDetailsStep from '@components/declaration/shippingDetailsStep';
import InvoiceDetailsStep from '@components/declaration/invoiceDetailsStep';
import PaymentDetailsStep from '@components/declaration/paymentDetailsStep';
import SubmissionResult from '@components/declaration/submissionResult';
import PortalButton from '@components/ui/portalButton';
import { CUSTOMS_BROKER, DECLARATION_TYPES, STEPS } from '@constants/declarationData';
import { generalInformationSchema, paymentDetailsSchema, shippingDetailsSchema } from '@app/validations/declarationValidation';
import { calculateDuty, findParty, generateDeclarationNumber, lineItemsTotal } from '@utils/declaration';
import { validateFields } from '@utils/form';

const INITIAL_VALUES: DeclarationValues = {
  regimeType: 'IMPORT',
  declarationType: 'IMP_LOCAL_ROW',
  cargoChannel: 'AIR',
  clientReference: '',
  exporterCode: '',
  mraAeo: false,
  importerCode: '',
  notifyPartyCode: '',
  cargoHandlerCode: '',
  agentCode: '',
  customsBroker: CUSTOMS_BROKER.code,
  tradeType: 'NON_ECOM',
  invoiceDocument: '',
  awbDocument: '',
  packingListDocument: '',
  certificateOfOriginDocument: '',
  carrierRegistrationNo: '',
  scheduledDate: '',
  mawb: '',
  hawb: '',
  originalLoadPort: '',
  portOfLoad: '',
  portOfDischarge: '',
  netWeight: '',
  netWeightUnit: '',
  grossWeight: '',
  grossWeightUnit: '',
  volume: '',
  volumeUnit: '',
  cargoType: '',
  dutyPaymentMode: '',
  dutyPaymentReference: '',
  chargesPaymentMode: '',
  chargesPaymentReference: '',
  undertakingAccepted: false,
};

// Every invoice needs line items whose values add up to the invoice value.
const invoicesError = (invoices: Invoice[]) => {
  if (!invoices.length) return 'Add at least one invoice before continuing.';
  const empty = invoices.find(invoice => !invoice.lineItems.length);
  if (empty) return `Invoice ${empty.invoiceNo} has no line items. Use + in its row to add them.`;
  const mismatched = invoices.find(invoice => Math.abs(lineItemsTotal(invoice.lineItems) - invoice.value) >= 0.005);
  if (mismatched)
    return `The line items of invoice ${mismatched.invoiceNo} must add up to its value (${mismatched.currency} ${mismatched.value}).`;
  return undefined;
};

const Page = () => {
  const [step, setStep] = useState(0);
  const [furthest, setFurthest] = useState(0);
  const [extraExporters, setExtraExporters] = useState<Party[]>([]);
  const [extraImporters, setExtraImporters] = useState<Party[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [invoiceError, setInvoiceError] = useState<string>();
  const [declarationNumber, setDeclarationNumber] = useState('');

  const dutyDue = calculateDuty(invoices).duty > 0;

  // Formik validates against the schema of the step on screen (kept in the ref below).
  const schemaRef = useRef<Yup.ObjectSchema<any>>(Yup.object({}));
  const formik = useFormik<DeclarationValues>({
    initialValues: INITIAL_VALUES,
    validationSchema: () => schemaRef.current,
    onSubmit: () => undefined,
  });

  const channel = (formik.values.cargoChannel || 'AIR') as CargoChannel;
  const stepSchema = useMemo<Yup.ObjectSchema<any>>(
    () =>
      [
        generalInformationSchema(extraExporters, extraImporters),
        shippingDetailsSchema(channel),
        Yup.object({}),
        paymentDetailsSchema(dutyDue),
      ][step],
    [step, extraExporters, extraImporters, channel, dutyDue]
  );
  const { validateForm } = formik;
  useEffect(() => {
    schemaRef.current = stepSchema;
    // Re-check with the new rules, e.g. a just-added overseas customer is now a known exporter code
    validateForm();
  }, [stepSchema, validateForm]);

  const importer = findParty('importer', formik.values.importerCode, extraImporters);
  const declarationLabel = DECLARATION_TYPES[formik.values.regimeType]?.find(type => type.value === formik.values.declarationType)?.label;

  const goTo = (index: number) => {
    setStep(index);
    setFurthest(Math.max(furthest, index));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const stepIsValid = async () => {
    if (step === 2) {
      const error = invoicesError(invoices);
      setInvoiceError(error);
      return !error;
    }
    return validateFields(formik, Object.keys(stepSchema.fields));
  };

  const next = async () => {
    if (await stepIsValid()) goTo(step + 1);
  };

  const submit = async () => {
    if (await stepIsValid()) {
      setDeclarationNumber(generateDeclarationNumber());
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const startNew = () => {
    formik.resetForm();
    setInvoices([]);
    setExtraExporters([]);
    setExtraImporters([]);
    setInvoiceError(undefined);
    setDeclarationNumber('');
    setStep(0);
    setFurthest(0);
  };

  return (
    <div className="min-h-screen bg-portal-page">
      <PortalHeader />
      <div className="mx-auto max-w-[1400px] px-3 py-4 md:px-6 md:py-6">
        <div className="mb-3 text-[11px] leading-snug text-gray-800 md:text-[12px]">
          <p className="font-bold">Important Update:</p>
          <p>
            Declarations submitted through this sandbox are for testing only. Values are validated like the live service, but nothing is
            sent to a customs authority and no payment is taken.
          </p>
        </div>

        <main className="rounded-sm bg-white px-3 py-4 shadow-sm ring-1 ring-black/5 md:px-6 md:py-6">
          {declarationNumber ? (
            <SubmissionResult declarationNumber={declarationNumber} values={formik.values} invoices={invoices} onStartNew={startNew} />
          ) : (
            <>
              <h1 className="mb-5 text-lg text-portal-red md:text-2xl">New{declarationLabel ? ` - ${declarationLabel}` : ''}</h1>
              <Stepper steps={STEPS} current={step} furthest={furthest} onStepClick={goTo} />

              <div key={step} className="animate-fadeIn">
                {step === 0 ? (
                  <GeneralInformationStep
                    formik={formik}
                    extraExporters={extraExporters}
                    extraImporters={extraImporters}
                    onAddExporter={party => setExtraExporters([...extraExporters, party])}
                    onAddImporter={party => setExtraImporters([...extraImporters, party])}
                  />
                ) : null}
                {step === 1 ? <ShippingDetailsStep formik={formik} importer={importer} /> : null}
                {step === 2 ? (
                  <InvoiceDetailsStep
                    invoices={invoices}
                    onChange={updated => {
                      setInvoices(updated);
                      setInvoiceError(undefined);
                    }}
                    extraSellers={extraExporters}
                    exporterCode={formik.values.exporterCode}
                    error={invoiceError}
                  />
                ) : null}
                {step === 3 ? <PaymentDetailsStep formik={formik} invoices={invoices} importer={importer} /> : null}
              </div>

              <div className="mt-5 flex justify-center gap-2">
                {step > 0 ? (
                  <PortalButton onClick={() => goTo(step - 1)} startIcon={<ChevronLeft size={14} />} className="min-w-28">
                    Previous
                  </PortalButton>
                ) : null}
                {step < STEPS.length - 1 ? (
                  <PortalButton onClick={next} endIcon={<ChevronRight size={14} />} className="min-w-28">
                    Next
                  </PortalButton>
                ) : (
                  <PortalButton variant="orange" onClick={submit} startIcon={<Send size={14} />} className="min-w-28">
                    Submit
                  </PortalButton>
                )}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
};

export default Page;
