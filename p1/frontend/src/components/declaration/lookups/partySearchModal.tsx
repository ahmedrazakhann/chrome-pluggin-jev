'use client';
import { Party } from '@app-types/declaration';
import { PartySearchModalProps } from '@app-types/ui';
import SearchModal from '@components/ui/searchModal';
import { COUNTRIES } from '@constants/declarationData';
import { countryName, PARTY_LISTS } from '@utils/declaration';

const COUNTRY_OPTIONS = COUNTRIES.map(country => ({ value: country.code, label: country.name }));

const PartySearchModal: React.FC<PartySearchModalProps> = ({ open, role, title, extra = [], onSelect, onClose }) => (
  <SearchModal<Party>
    open={open}
    title={title}
    filters={[
      { name: 'code', label: 'Code', type: 'text' },
      { name: 'name', label: 'Name', type: 'text' },
      { name: 'country', label: 'Country', type: 'select', options: COUNTRY_OPTIONS },
    ]}
    columns={[
      { key: 'code', label: 'Code', render: party => party.code },
      { key: 'name', label: 'Name', render: party => party.name },
      { key: 'city', label: 'City', render: party => party.city },
      { key: 'country', label: 'Country', render: party => countryName(party.country).toUpperCase() },
    ]}
    rows={[...PARTY_LISTS[role], ...extra]}
    rowKey={party => party.code}
    matches={(party, values) =>
      (!values.code || party.code.includes(values.code.toUpperCase())) &&
      (!values.name || party.name.toLowerCase().includes(values.name.toLowerCase())) &&
      (!values.country || party.country === values.country)
    }
    onSelect={onSelect}
    onClose={onClose}
  />
);

export default PartySearchModal;
