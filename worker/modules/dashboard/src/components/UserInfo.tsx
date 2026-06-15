
interface UserInfoProps {
  data: Record<string, any>;
  onChange: (key: string, value: any) => void;
}

export default function UserInfo({ data, onChange }: UserInfoProps) {
  const fields = [
    { key: 'first_name', label: 'First Name', type: 'text' },
    { key: 'middle_name', label: 'Middle Name', type: 'text' },
    { key: 'last_name', label: 'Last Name', type: 'text' },
    { key: 'phone_number', label: 'Phone Number', type: 'text' },
    { key: 'current_city', label: 'Current City', type: 'text' },
    { key: 'street', label: 'Street Address', type: 'text' },
    { key: 'state', label: 'State', type: 'text' },
    { key: 'zipcode', label: 'Zip/Postal Code', type: 'text' },
    { key: 'country', label: 'Country', type: 'text' },
    { key: 'ethnicity', label: 'Ethnicity/Race', type: 'select', options: ["Decline", "Hispanic/Latino", "American Indian or Alaska Native", "Asian", "Black or African American", "Native Hawaiian or Other Pacific Islander", "White", "Other"] },
    { key: 'gender', label: 'Gender', type: 'select', options: ["Male", "Female", "Other", "Decline"] },
    { key: 'gender_identity', label: 'Gender Identity', type: 'text' },
    { key: 'disability_status', label: 'Disability Status', type: 'select', options: ["Yes", "No", "Decline"] },
    { key: 'veteran_status', label: 'Veteran Status', type: 'select', options: ["Yes", "No", "Decline"] }
  ];

  return (
    <div className="bot-grid-form">
      {fields.map((field) => {
        const val = data[field.key] !== undefined ? data[field.key] : '';
        return (
          <div className="bot-form-group" key={field.key}>
            <label htmlFor={`p-${field.key}`}>{field.label}</label>
            {field.type === 'select' ? (
              <select
                id={`p-${field.key}`}
                value={val}
                onChange={(e) => onChange(field.key, e.target.value)}
              >
                {field.options?.map((opt) => (
                  <option value={opt} key={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                id={`p-${field.key}`}
                value={val}
                onChange={(e) => onChange(field.key, e.target.value)}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
