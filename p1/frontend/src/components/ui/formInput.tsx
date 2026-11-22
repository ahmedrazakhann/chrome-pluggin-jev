'use client';
import { FormInputProps } from '@app-types/ui';
import FieldRow from '@components/ui/fieldRow';
import { INPUT_CLASS, INPUT_ERROR_CLASS } from '@constants/styles';
import { fieldError } from '@utils/form';

const FormInput: React.FC<FormInputProps> = ({
  formik,
  name,
  label,
  required,
  info,
  disabled,
  className,
  type = 'text',
  placeholder,
  maxLength,
  uppercase,
  hint,
  addon,
}) => {
  const error = fieldError(formik, name);

  return (
    <FieldRow label={label} htmlFor={name} required={required} info={info} error={error} className={className}>
      <div className="flex gap-1.5">
        <input
          id={name}
          name={name}
          type={type}
          inputMode={type === 'number' ? 'decimal' : undefined}
          step={type === 'number' ? 'any' : undefined}
          value={formik.values[name] ?? ''}
          onChange={event => formik.setFieldValue(name, uppercase ? event.target.value.toUpperCase() : event.target.value)}
          onBlur={formik.handleBlur}
          placeholder={placeholder}
          maxLength={maxLength}
          disabled={disabled}
          required={required}
          aria-invalid={!!error}
          className={`${INPUT_CLASS} ${error ? INPUT_ERROR_CLASS : ''}`}
        />
        {addon}
      </div>
      {hint && !error ? <p className="mt-1 text-[11px] text-gray-500">{hint}</p> : null}
    </FieldRow>
  );
};

export default FormInput;
