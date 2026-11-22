'use client';
import { useState } from 'react';
import { Party, PartyRole } from '@app-types/declaration';
import { GeneralInformationStepProps } from '@app-types/ui';
import SectionCard from '@components/ui/sectionCard';
import FormInput from '@components/ui/formInput';
import FormSelect from '@components/ui/formSelect';
import LookupInput from '@components/ui/lookupInput';
import PortalButton from '@components/ui/portalButton';
import PartySearchModal from '@components/declaration/lookups/partySearchModal';
import OverseasCustomerModal from '@components/declaration/overseasCustomerModal';
import PersonalCustomerModal from '@components/declaration/personalCustomerModal';
import { CARGO_CHANNELS, DECLARATION_TYPES, DOCUMENT_STATUSES, REGIME_TYPES, TRADE_TYPES } from '@constants/declarationData';
import { findParty } from '@utils/declaration';

type LookupField = 'exporterCode' | 'importerCode' | 'notifyPartyCode' | 'cargoHandlerCode' | 'agentCode';

const LOOKUPS: Record<LookupField, { role: PartyRole; title: string }> = {
  exporterCode: { role: 'exporter', title: 'Search Exporter' },
  importerCode: { role: 'importer', title: 'Search Importer' },
  notifyPartyCode: { role: 'notifyParty', title: 'Search Notify Party' },
  cargoHandlerCode: { role: 'cargoHandler', title: 'Search Cargo Handler' },
  agentCode: { role: 'agent', title: 'Search Agent' },
};

const CHANNEL_DIRECTION: Record<string, string> = { IMPORT: 'Inbound', EXPORT: 'Outbound', REEXPORT: 'Outbound', TRANSIT: 'Transit' };

const OrDivider = () => <p className="my-1.5 text-[11px] text-gray-500 md:ml-[162px]">— OR —</p>;

const GeneralInformationStep: React.FC<GeneralInformationStepProps> = ({
  formik,
  extraExporters,
  extraImporters,
  onAddExporter,
  onAddImporter,
}) => {
  const [lookup, setLookup] = useState<LookupField | null>(null);
  const [overseasOpen, setOverseasOpen] = useState(false);
  const [personalOpen, setPersonalOpen] = useState(false);
  const { values } = formik;

  const extraFor = (field: LookupField) => (field === 'exporterCode' ? extraExporters : field === 'importerCode' ? extraImporters : []);
  const nameFor = (field: LookupField) => findParty(LOOKUPS[field].role, values[field], extraFor(field))?.name;

  const pick = (field: LookupField, party: Party) => {
    formik.setFieldValue(field, party.code, true);
    formik.setFieldTouched(field, true, false);
    setLookup(null);
  };

  const lookupInput = (field: LookupField, label: string, required = false, info?: string) => (
    <LookupInput
      formik={formik}
      name={field}
      label={label}
      required={required}
      info={info}
      selectedName={nameFor(field)}
      onSearch={() => setLookup(field)}
    />
  );

  return (
    <>
      <SectionCard title="Declaration Header">
        <div className="grid gap-3 md:grid-cols-2 md:gap-x-6">
          <FormSelect
            formik={formik}
            name="regimeType"
            label="Regime Type"
            required
            options={REGIME_TYPES}
            info="The customs regime the goods are declared under"
            onValueChange={() => formik.setFieldValue('declarationType', '')}
          />
          <FormSelect
            formik={formik}
            name="declarationType"
            label="Declaration Type"
            required
            options={DECLARATION_TYPES[values.regimeType] ?? []}
            disabled={!values.regimeType}
            placeholder={values.regimeType ? '[Please Select]' : '[Select a Regime Type first]'}
          />
          <FormSelect
            formik={formik}
            name="cargoChannel"
            label={`Cargo Channel (${CHANNEL_DIRECTION[values.regimeType] ?? 'Inbound'})`}
            required
            options={CARGO_CHANNELS}
          />
          <FormInput
            formik={formik}
            name="clientReference"
            label="Client's Dec. Ref. No."
            required
            maxLength={20}
            info="Your own reference for this declaration, 3 to 20 characters"
          />
        </div>
      </SectionCard>

      <SectionCard title="Person/Parties">
        <div className="grid gap-3 md:grid-cols-2 md:gap-x-6">
          <div>
            {lookupInput('exporterCode', "Exporter's Code", true, 'Registered exporter code, or add an overseas customer below')}
            <OrDivider />
            <div className="flex flex-wrap items-center gap-3 md:ml-[162px]">
              <PortalButton onClick={() => setOverseasOpen(true)}>Add Overseas Customer</PortalButton>
              <label className="flex items-center gap-1.5 text-[12px] text-gray-700">
                <input
                  type="checkbox"
                  name="mraAeo"
                  checked={values.mraAeo}
                  onChange={formik.handleChange}
                  className="h-4 w-4 accent-portal-orange"
                />
                MRA AEO
              </label>
            </div>
          </div>
          <div>
            {lookupInput('importerCode', "Importer's Code", true, 'The consignee on the airway bill / bill of lading')}
            <OrDivider />
            <div className="md:ml-[162px]">
              <PortalButton onClick={() => setPersonalOpen(true)}>Personal Customer</PortalButton>
            </div>
          </div>
          {lookupInput('notifyPartyCode', 'Notify Party Code', false, 'Party to be notified on arrival (optional)')}
          {lookupInput('cargoHandlerCode', "Cargo Handler's Code", true)}
          {lookupInput('agentCode', "Agent's Code", true, 'The carrier or shipping agent')}
          <FormInput formik={formik} name="customsBroker" label="Customs Broker" disabled />
          <FormSelect
            formik={formik}
            name="tradeType"
            label="Trade Type"
            options={TRADE_TYPES}
            disabled
            info="Set by the declaration type"
          />
        </div>
      </SectionCard>

      <SectionCard title="Required Documents">
        <div className="grid gap-3 md:grid-cols-2 md:gap-x-6">
          <FormSelect formik={formik} name="invoiceDocument" label="Invoice" required options={DOCUMENT_STATUSES} />
          <FormSelect formik={formik} name="awbDocument" label="AWB / BOL" required options={DOCUMENT_STATUSES} />
          <FormSelect formik={formik} name="packingListDocument" label="Packing List" required options={DOCUMENT_STATUSES} />
          <FormSelect formik={formik} name="certificateOfOriginDocument" label="Cert. of Origin" required options={DOCUMENT_STATUSES} />
        </div>
      </SectionCard>

      {lookup ? (
        <PartySearchModal
          open
          role={LOOKUPS[lookup].role}
          title={LOOKUPS[lookup].title}
          extra={extraFor(lookup)}
          onSelect={party => pick(lookup, party)}
          onClose={() => setLookup(null)}
        />
      ) : null}
      <OverseasCustomerModal
        open={overseasOpen}
        onClose={() => setOverseasOpen(false)}
        onCreate={party => {
          onAddExporter(party);
          pick('exporterCode', party);
          setOverseasOpen(false);
        }}
      />
      <PersonalCustomerModal
        open={personalOpen}
        onClose={() => setPersonalOpen(false)}
        onCreate={party => {
          onAddImporter(party);
          pick('importerCode', party);
          setPersonalOpen(false);
        }}
      />
    </>
  );
};

export default GeneralInformationStep;
