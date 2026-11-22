'use client';
import { useFormik } from 'formik';
import { Save, X } from 'lucide-react';
import { PersonalCustomerValues } from '@app-types/declaration';
import { PartyModalProps } from '@app-types/ui';
import Modal from '@components/ui/modal';
import PortalButton from '@components/ui/portalButton';
import FormInput from '@components/ui/formInput';
import FormSelect from '@components/ui/formSelect';
import { COUNTRIES, PERSONAL_ID_TYPES } from '@constants/declarationData';
import { personalCustomerSchema } from '@app/validations/declarationValidation';

const INITIAL: PersonalCustomerValues = { idType: 'EMIRATES_ID', idNumber: '', fullName: '', nationality: '', mobile: '' };
const COUNTRY_OPTIONS = COUNTRIES.map(country => ({ value: country.code, label: country.name }));

// An individual importing personal goods instead of a registered company.
const PersonalCustomerModal: React.FC<PartyModalProps> = ({ open, onClose, onCreate }) => {
  const formik = useFormik<PersonalCustomerValues>({
    initialValues: INITIAL,
    validationSchema: personalCustomerSchema,
    onSubmit: (values, helpers) => {
      onCreate({
        code: `PC-${values.idNumber.replace(/\D/g, '').slice(-7) || values.idNumber.slice(-7)}`,
        name: values.fullName.trim().toUpperCase(),
        country: 'AE',
        city: 'Dubai',
        vatRegistered: false,
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
      title="Personal Customer"
      onClose={close}
      size="lg"
      footer={
        <>
          <PortalButton variant="orange" startIcon={<Save size={14} />} onClick={() => formik.handleSubmit()}>
            Use as Importer
          </PortalButton>
          <PortalButton onClick={close} startIcon={<X size={14} />}>
            Cancel
          </PortalButton>
        </>
      }
    >
      <form onSubmit={formik.handleSubmit} noValidate className="grid gap-3 p-4">
        <FormSelect formik={formik} name="idType" label="ID Type" required options={PERSONAL_ID_TYPES} />
        <FormInput
          formik={formik}
          name="idNumber"
          label="ID Number"
          required
          uppercase
          placeholder={formik.values.idType === 'EMIRATES_ID' ? '784-1990-1234567-1' : 'N1234567'}
        />
        <FormInput formik={formik} name="fullName" label="Full Name" required uppercase />
        <FormSelect formik={formik} name="nationality" label="Nationality" required options={COUNTRY_OPTIONS} />
        <FormInput formik={formik} name="mobile" label="Mobile" required type="tel" placeholder="+971 50 123 4567" />
      </form>
    </Modal>
  );
};

export default PersonalCustomerModal;
