'use client';
import { useState } from 'react';
import { CargoChannel, Port } from '@app-types/declaration';
import { ShippingDetailsStepProps } from '@app-types/ui';
import SectionCard from '@components/ui/sectionCard';
import FormInput from '@components/ui/formInput';
import FormSelect from '@components/ui/formSelect';
import DateInput from '@components/ui/dateInput';
import LookupInput from '@components/ui/lookupInput';
import UnitSelect from '@components/ui/unitSelect';
import CarrierSearchModal from '@components/declaration/lookups/carrierSearchModal';
import PortSearchModal from '@components/declaration/lookups/portSearchModal';
import { CARGO_TYPES, MAWB_HINT, VOLUME_UNITS, WEIGHT_UNITS } from '@constants/declarationData';
import { countryName, findCarrier, findPort } from '@utils/declaration';

type PortField = 'originalLoadPort' | 'portOfLoad' | 'portOfDischarge';

const PORT_INFO: Record<PortField, string> = {
  originalLoadPort: 'Where the shipment started its journey',
  portOfLoad: 'Where the shipment was last loaded before arriving',
  portOfDischarge: 'Where it lands in the UAE; the code is the cargo terminal',
};

const ShippingDetailsStep: React.FC<ShippingDetailsStepProps> = ({ formik, importer }) => {
  const [portLookup, setPortLookup] = useState<PortField | null>(null);
  const [carrierOpen, setCarrierOpen] = useState(false);
  const { values } = formik;
  const channel = (values.cargoChannel || 'AIR') as CargoChannel;
  const direction = values.regimeType === 'IMPORT' ? 'Inbound' : 'Outbound';

  const portName = (code: string) => {
    const port = findPort(code);
    return port ? `${port.name}, ${countryName(port.country)}` : undefined;
  };

  const pickPort = (field: PortField, port: Port) => {
    formik.setFieldValue(field, port.code, true);
    formik.setFieldTouched(field, true, false);
    setPortLookup(null);
  };

  const portInput = (field: PortField, label: string) => (
    <LookupInput
      formik={formik}
      name={field}
      label={label}
      required
      info={PORT_INFO[field]}
      selectedName={portName(values[field])}
      onSearch={() => setPortLookup(field)}
    />
  );

  return (
    <>
      <SectionCard title={`${direction} - Shipping Details`}>
        <div className="grid gap-3 md:grid-cols-2 md:gap-x-6">
          <LookupInput
            formik={formik}
            name="carrierRegistrationNo"
            label="Carrier Registration No."
            required
            info={channel === 'AIR' ? 'Flight number, e.g. EK0523' : channel === 'SEA' ? 'Vessel IMO number' : 'Truck registration'}
            selectedName={findCarrier(values.carrierRegistrationNo)?.name}
            onSearch={() => setCarrierOpen(true)}
          />
          <DateInput formik={formik} name="scheduledDate" label="Scheduled Date" required />
          <FormInput
            formik={formik}
            name="mawb"
            label={channel === 'AIR' ? 'MAWB / BOL' : 'BOL / Consignment No.'}
            required
            uppercase
            maxLength={17}
            hint={MAWB_HINT[channel]}
          />
          <FormInput formik={formik} name="hawb" label={channel === 'AIR' ? 'HAWB' : 'House BOL'} uppercase maxLength={20} />
        </div>
      </SectionCard>

      <SectionCard title="Port Details">
        <div className="grid gap-3 md:grid-cols-2 md:gap-x-6">
          {portInput('originalLoadPort', 'Original Load Port')}
          {portInput('portOfLoad', 'Port of Load')}
          {portInput('portOfDischarge', 'Port of Discharge')}
        </div>
      </SectionCard>

      <SectionCard title="Cargo Weight/Volume/Type">
        <div className="grid gap-3 md:grid-cols-2 md:gap-x-6">
          <FormInput
            formik={formik}
            name="netWeight"
            label="Net Weight"
            type="number"
            addon={<UnitSelect formik={formik} name="netWeightUnit" label="Net weight unit" options={WEIGHT_UNITS} />}
          />
          <FormInput
            formik={formik}
            name="volume"
            label="Volume"
            type="number"
            addon={<UnitSelect formik={formik} name="volumeUnit" label="Volume unit" options={VOLUME_UNITS} />}
          />
          <FormInput
            formik={formik}
            name="grossWeight"
            label="Gross Weight"
            type="number"
            required
            addon={<UnitSelect formik={formik} name="grossWeightUnit" label="Gross weight unit" options={WEIGHT_UNITS} />}
          />
          <FormSelect formik={formik} name="cargoType" label="Cargo Type" required options={CARGO_TYPES} />
        </div>
        {['netWeightUnit', 'grossWeightUnit', 'volumeUnit'].map(name =>
          (formik.touched[name] || formik.submitCount > 0) && formik.errors[name] ? (
            <p key={name} role="alert" className="mt-2 text-[12px] text-portal-red md:ml-[162px]">
              {formik.errors[name] as string}
            </p>
          ) : null
        )}
      </SectionCard>

      <SectionCard title="Party Information">
        {importer ? (
          <dl className="grid gap-x-6 gap-y-1.5 text-[12px] md:grid-cols-2">
            <div className="flex gap-2">
              <dt className="text-gray-500">Importer:</dt>
              <dd className="font-semibold text-gray-800">
                {importer.name} ({importer.code})
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-gray-500">License Expires on:</dt>
              <dd className="font-semibold text-gray-800">{importer.licenseExpiry ?? '—'}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-gray-500">VAT TRN:</dt>
              <dd className="font-semibold text-gray-800">{importer.vatTrn ?? 'Not registered'}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-gray-500">City:</dt>
              <dd className="font-semibold text-gray-800">{importer.city}</dd>
            </div>
          </dl>
        ) : (
          <p className="text-[12px] text-gray-500">Select an importer on the General Information step.</p>
        )}
      </SectionCard>

      <CarrierSearchModal
        open={carrierOpen}
        channel={channel}
        onClose={() => setCarrierOpen(false)}
        onSelect={carrier => {
          formik.setFieldValue('carrierRegistrationNo', carrier.code, true);
          formik.setFieldTouched('carrierRegistrationNo', true, false);
          setCarrierOpen(false);
        }}
      />
      {portLookup ? (
        <PortSearchModal
          open
          channel={channel}
          uaeOnly={portLookup === 'portOfDischarge'}
          onSelect={port => pickPort(portLookup, port)}
          onClose={() => setPortLookup(null)}
        />
      ) : null}
    </>
  );
};

export default ShippingDetailsStep;
