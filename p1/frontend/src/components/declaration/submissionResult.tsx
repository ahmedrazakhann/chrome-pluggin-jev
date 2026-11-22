'use client';
import { useState } from 'react';
import { CheckCircle2, FilePlus2 } from 'lucide-react';
import { SubmissionResultProps } from '@app-types/ui';
import PortalButton from '@components/ui/portalButton';
import { DECLARATION_TYPES } from '@constants/declarationData';
import { calculateDuty, findParty, formatMoney } from '@utils/declaration';

const SubmissionResult: React.FC<SubmissionResultProps> = ({ declarationNumber, values, invoices, onStartNew }) => {
  const [showData, setShowData] = useState(false);
  const { duty, feesTotal } = calculateDuty(invoices);
  const declarationType = DECLARATION_TYPES[values.regimeType]?.find(type => type.value === values.declarationType)?.label;
  const lineItems = invoices.reduce((sum, invoice) => sum + invoice.lineItems.length, 0);

  const rows: [string, string][] = [
    ['Declaration No.', declarationNumber],
    ['Declaration Type', declarationType ?? values.declarationType],
    ["Client's Ref. No.", values.clientReference],
    ['Importer', `${findParty('importer', values.importerCode)?.name ?? ''} (${values.importerCode})`],
    ['MAWB / BOL', values.mawb],
    ['Invoices / Line Items', `${invoices.length} / ${lineItems}`],
    ['Total Payable', formatMoney(duty + feesTotal)],
  ];

  return (
    <div className="animate-fadeIn mx-auto max-w-2xl py-6 text-center">
      <CheckCircle2 size={52} className="mx-auto text-green-600" />
      <h2 className="mt-3 text-xl font-semibold text-gray-900">Declaration submitted</h2>
      <p className="mt-1 text-[13px] text-gray-600">This is a sandbox: nothing was sent to a customs authority and no payment was taken.</p>
      <dl className="mt-5 divide-y divide-gray-100 rounded-sm border border-portal-line bg-white text-left text-[13px]">
        {rows.map(([label, value]) => (
          <div key={label} className="grid grid-cols-[150px_1fr] gap-3 px-4 py-2">
            <dt className="text-gray-500">{label}</dt>
            <dd className="font-medium text-gray-900" data-testid={label === 'Declaration No.' ? 'declaration-number' : undefined}>
              {value}
            </dd>
          </div>
        ))}
      </dl>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <PortalButton variant="orange" onClick={onStartNew} startIcon={<FilePlus2 size={14} />}>
          Start a New Declaration
        </PortalButton>
        <PortalButton variant="light" onClick={() => setShowData(!showData)}>
          {showData ? 'Hide' : 'Show'} submitted data
        </PortalButton>
      </div>
      {showData ? (
        <pre className="mt-4 max-h-96 overflow-auto rounded-sm bg-gray-900 p-4 text-left text-[11px] text-gray-100">
          {JSON.stringify({ declarationNumber, ...values, invoices }, null, 2)}
        </pre>
      ) : null}
    </div>
  );
};

export default SubmissionResult;
