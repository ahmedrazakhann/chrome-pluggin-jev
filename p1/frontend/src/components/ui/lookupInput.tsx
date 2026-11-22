'use client';
import { Search } from 'lucide-react';
import { LookupInputProps } from '@app-types/ui';
import FieldRow from '@components/ui/fieldRow';
import { ICON_BUTTON_CLASS, INPUT_CLASS, INPUT_ERROR_CLASS } from '@constants/styles';
import { fieldError } from '@utils/form';

// Code field with a search button that opens a lookup popup; the matched name shows underneath.
const LookupInput: React.FC<LookupInputProps> = ({
  formik,
  name,
  label,
  required,
  info,
  disabled,
  className,
  onSearch,
  selectedName,
  placeholder,
}) => {
  const error = fieldError(formik, name);
  const hasValue = !!formik.values[name];

  return (
    <FieldRow label={label} htmlFor={name} required={required} info={info} error={error} className={className}>
      <div className="flex gap-1.5">
        <input
          id={name}
          name={name}
          type="text"
          value={formik.values[name] ?? ''}
          onChange={event => formik.setFieldValue(name, event.target.value.toUpperCase())}
          onBlur={formik.handleBlur}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          aria-invalid={!!error}
          autoComplete="off"
          className={`${INPUT_CLASS} ${error ? INPUT_ERROR_CLASS : ''}`}
        />
        <button
          type="button"
          onClick={onSearch}
          disabled={disabled}
          aria-label={`Search ${label}`}
          title={`Search ${label}`}
          className={`${ICON_BUTTON_CLASS} ${hasValue ? 'bg-portal-orange hover:brightness-95' : 'bg-portal-ink hover:bg-black'}`}
        >
          <Search size={15} strokeWidth={2.5} />
        </button>
      </div>
      {selectedName ? <p className="mt-1 text-[12px] font-medium uppercase text-gray-700">{selectedName}</p> : null}
    </FieldRow>
  );
};

export default LookupInput;
