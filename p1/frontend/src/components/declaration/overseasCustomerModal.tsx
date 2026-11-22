'use client';
import { useFormik } from 'formik';
import { Save, X } from 'lucide-react';
import { OverseasCustomerValues } from '@app-types/declaration';
import { PartyModalProps } from '@app-types/ui';
import Modal from '@components/ui/modal';
import PortalButton from '@components/ui/portalButton';
import FormInput from '@components/ui/formInput';
import FormSelect from '@components/ui/formSelect';
import { COUNTRIES } from '@constants/declarationData';
import { overseasCustomerSchema } from '@app/validations/declarationValidation';

const INITIAL: OverseasCustomerValues = { name: '', country: '', city: '', address: '', phone: '', email: '' };
const COUNTRY_OPTIONS = COUNTRIES.filter(country => country.code !== 'AE').map(country => ({ value: country.code, label: country.name }));

// Registers an exporter that has no code yet; it gets a temporary OC- code for this declaration.
const OverseasCustomerModal: React.FC<PartyModalProps> = ({ open, onClose, onCreate }) => {
  const formik = useFormik<OverseasCustomerValues>({
    initialValues: INITIAL,
    validationSchema: overseasCustomerSchema,
    onSubmit: (values, helpers) => {
      onCreate({
        code: `OC-${Date.now().toString().slice(-6)}`,
        name: values.name.trim().toUpperCase(),
        country: values.country,
        city: values.city.trim(),
      });
      helpers.resetForm();
    },
  });

  const close = () => {
    formik.resetForm();
    onClose();
  };

  return (
    <Modal
      open={open}
      title="Add Overseas Customer"
      onClose={close}
      size="lg"
      footer={
        <>
          <PortalButton variant="orange" startIcon={<Save size={14} />} onClick={() => formik.handleSubmit()}>
            Add Customer
          </PortalButton>
          <PortalButton onClick={close} startIcon={<X size={14} />}>
            Cancel
          </PortalButton>
        </>
      }
    >
      <form onSubmit={formik.handleSubmit} noValidate className="grid gap-3 p-4">
        <FormInput formik={formik} name="name" label="Company Name" required uppercase />
        <FormSelect formik={formik} name="country" label="Country" required options={COUNTRY_OPTIONS} />
        <FormInput formik={formik} name="city" label="City" required />
        <FormInput formik={formik} name="address" label="Address" required />
        <FormInput formik={formik} name="phone" label="Phone" type="tel" placeholder="+91 484 1234567" />
        <FormInput formik={formik} name="email" label="Email" type="email" />
      </form>
    </Modal>
  );
};

export default OverseasCustomerModal;
