/**
 * Dynamic Contact Fields Container
 * Groups and renders all dynamic industry fields for a contact form.
 */

import React from 'react';
import DynamicFieldRenderer from './DynamicFieldRenderer';

export default function DynamicContactFields({
  fields = [],
  values = {},
  onChange,
  errors = {},
  disabled = false,
}) {
  if (!fields || fields.length === 0) {
    return null;
  }

  // Filter fields that are configured to show in form
  const visibleFields = fields
    .filter((f) => f.showInForm !== false)
    .sort((a, b) => (a.order || 50) - (b.order || 50));

  // Partition into primary business interest and qualification groups
  const interestFields = visibleFields.filter((f) => f.group === 'businessInterest');
  const qualificationFields = visibleFields.filter((f) => f.group !== 'businessInterest');

  return (
    <div className="space-y-6">
      {/* Primary Offering / Interest Fields */}
      {interestFields.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
            <span className="w-1.5 h-4 bg-teal-600 rounded-full" />
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Business Interest & Preferences
            </h4>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {interestFields.map((field) => (
              <DynamicFieldRenderer
                key={field.key}
                field={field}
                value={values[field.key]}
                onChange={onChange}
                error={errors[field.key]}
                disabled={disabled}
              />
            ))}
          </div>
        </div>
      )}

      {/* Qualification & Scheduling Fields */}
      {qualificationFields.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
            <span className="w-1.5 h-4 bg-amber-500 rounded-full" />
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Qualification & Follow-up
            </h4>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {qualificationFields.map((field) => (
              <DynamicFieldRenderer
                key={field.key}
                field={field}
                value={values[field.key]}
                onChange={onChange}
                error={errors[field.key]}
                disabled={disabled}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
