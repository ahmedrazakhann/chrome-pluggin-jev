'use client';
import { UnitSelectProps } from '@app-types/ui';
import { INPUT_CLASS, INPUT_ERROR_CLASS } from '@constants/styles';
import { fieldError } from '@utils/form';

// Compact dropdown that sits beside a number input (weight, volume, currency).
const UnitSelect: React.FC<UnitSelectProps> = ({ formik, name, label, options }) => {
  const error = fieldError(formik, name);

  return (
    <select
      id={name}
      name={name}
      aria-label={label}
      title={error || label}
      value={formik.values[name] ?? ''}
      onChange={formik.handleChange}
      onBlur={formik.handleBlur}
      aria-invalid={!!error}
      className={`${INPUT_CLASS} ${error ? INPUT_ERROR_CLASS : ''} w-[46%] shrink-0 md:w-[55%]`}
    >
      <option value="">[Please Select]</option>
      {options.map(option => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
};

export default UnitSelect;
