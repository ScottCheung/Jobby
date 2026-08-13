'use client';
import { Button, CardWithNorth } from '@jobby/ui';

import { useEffect, useState } from 'react';
import { BookOpenText, Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import { api } from '@/lib/api';
import type { CoreProfileField, FieldMappingRule } from '@/lib/types';
import { coreFieldCategories, coreFieldCategoryForKey, coreFieldLabel } from '@/lib/core-field-categories';
import { Field } from '@/components/forms';


import { useGlobalModalStore } from '@/lib/store/global-modal-store';

function MappingRuleEditor({
  value,
  coreFields,
  onSave,
  onClose,
}: {
  value?: FieldMappingRule;
  coreFields: CoreProfileField[];
  onSave: (value: Omit<FieldMappingRule, 'id' | 'user_id' | 'normalized_alias' | 'is_user_defined' | 'times_used' | 'last_used_at' | 'created_at' | 'updated_at'>) => Promise<void>;
  onClose: () => void;
}) {
  const [alias, setAlias] = useState(value?.alias || '');
  const [coreKey, setCoreKey] = useState(value?.core_field_key || coreFields[0]?.core_field_key || '');
  const [scene, setScene] = useState(value?.scene || 'generic');
  const [features, setFeatures] = useState((value?.semantic_features || []).join(', '));
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!alias.trim() || !coreKey.trim()) return;
    setSaving(true);
    try {
      await onSave({
        alias: alias.trim(),
        core_field_key: coreKey.trim(),
        scene: scene.trim() || 'generic',
        semantic_features: features.split(',').map((item) => item.trim().toLowerCase()).filter(Boolean),
        field_type: value?.field_type || null,
        value_transform: value?.value_transform || {},
        confidence: 100,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className='flex w-full flex-col'>
      <header className='header'>
        <h2 className='title-section text-ink-primary'>{value ? 'Edit mapping rule' : 'New mapping rule'}</h2>
        <Button variant='toolbar' size='icon' Icon={X} onClick={onClose} aria-label='Close' />
      </header>
      <div className='body grid grid-cols-1 gap-4 py-5! sm:grid-cols-2'>
        <Field label='Form field alias' value={alias} onChange={setAlias} required />
        <div>
          <label className='mb-1.5 block text-sm text-ink-secondary'>Core field</label>
          <select
            value={coreKey}
            onChange={(event) => setCoreKey(event.target.value)}
            className='h-11 w-full rounded-md border border-border bg-background px-3 text-sm text-ink-primary'
          >
            {!coreFields.length && <option value=''>No core fields available</option>}
            {coreFieldCategories.map((category) => {
              const fields = coreFields.filter((field) => coreFieldCategoryForKey(field.core_field_key) === category.id);
              if (!fields.length) return null;
              return (
                <optgroup key={category.id} label={category.label}>
                  {fields.map((field) => (
                    <option key={field.core_field_key} value={field.core_field_key}>
                      {coreFieldLabel(field)}
                    </option>
                  ))}
                </optgroup>
              );
            })}
          </select>
        </div>
        <Field label='Scene' value={scene} onChange={setScene} hint='generic, job_application, visa_application' />
        <Field label='Semantic features' value={features} onChange={setFeatures} hint='Comma-separated intent signals' />
      </div>
      <footer className='footer'>
        <Button variant='ghost' onClick={onClose}>Cancel</Button>
        <Button Icon={Check} onClick={() => void handleSave()} isLoading={saving} disabled={!alias.trim() || !coreKey.trim()}>
          Save rule
        </Button>
      </footer>
    </div>
  );
}

export function FieldMappingRulesPanel({ id = 'field-mappings' }: { id?: string }) {
  const [mappingRules, setMappingRules] = useState<FieldMappingRule[]>([]);
  const [coreFields, setCoreFields] = useState<CoreProfileField[]>([]);
  const [loading, setLoading] = useState(true);
  const openModal = useGlobalModalStore((state) => state.actions.openModal);
  const closeModal = useGlobalModalStore((state) => state.actions.closeModal);

  useEffect(() => {
    let active = true;
    void Promise.all([api.fieldMappingRules(true), api.profile()])
      .then(([rules, profile]) => {
        if (!active) return;
        setMappingRules(rules);
        setCoreFields(profile.fields || []);
      })
      .catch(() => {
        if (active) {
          setMappingRules([]);
          setCoreFields([]);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const editMappingRule = (rule?: FieldMappingRule) => openModal({
    className: 'w-[94vw] max-w-2xl flex rounded-lg',
    content: (
      <MappingRuleEditor
        value={rule}
        coreFields={coreFields}
        onClose={closeModal}
        onSave={async (payload) => {
          const saved = rule ? await api.updateFieldMappingRule({ ...rule, ...payload }) : await api.createFieldMappingRule(payload);
          setMappingRules((current) => rule ? current.map((item) => item.id === saved.id ? saved : item) : [saved, ...current]);
        }}
      />
    ),
    onClose: closeModal,
  });

  const deleteMappingRule = async (rule: FieldMappingRule) => {
    await api.deleteFieldMappingRule(rule.id);
    setMappingRules((current) => current.filter((item) => item.id !== rule.id));
  };

  const customRules = mappingRules.filter((rule) => rule.is_user_defined);
  const systemCount = mappingRules.length - customRules.length;

  return (
    <section id={id} className='scroll-mt-5'>
      <CardWithNorth title='Field Mapping Rules' size='sm'>
        <div className='mb-4 flex items-center gap-2 text-xs text-ink-secondary'>
          <BookOpenText className='h-4 w-4' />
          <span>{customRules.length} custom · {systemCount} system</span>
          <Button variant='secondary' size='sm' Icon={Plus} onClick={() => editMappingRule()} className='ml-auto' disabled={!coreFields.length}>
            Add rule
          </Button>
        </div>
        {loading ? (
          <p className='py-6 text-center text-sm text-ink-secondary'>Loading field mappings...</p>
        ) : (
          <div className='divide-y divide-border/60'>
            {customRules.slice(0, 8).map((rule) => (
              <div key={rule.id} className='flex items-center gap-3 py-3'>
                <div className='min-w-0 flex-1'>
                  <p className='truncate text-sm font-medium text-ink-primary'>{rule.alias}</p>
                  <p className='truncate text-xs text-ink-secondary'>{rule.scene} -&gt; {rule.core_field_key} | {rule.confidence}%</p>
                </div>
                <Button variant='toolbar' size='icon' Icon={Pencil} onClick={() => editMappingRule(rule)} aria-label='Edit mapping rule' />
                <Button variant='toolbar' size='icon' Icon={Trash2} onClick={() => void deleteMappingRule(rule)} aria-label='Delete mapping rule' />
              </div>
            ))}
            {customRules.length === 0 && (
              <p className='py-6 text-center text-sm text-ink-secondary'>Manual corrections confirmed in the extension will appear here.</p>
            )}
          </div>
        )}
        {!loading && !coreFields.length && (
          <p className='mt-3 text-xs text-ink-secondary'>Add a core Profile value before creating a custom mapping.</p>
        )}
      </CardWithNorth>
    </section>
  );
}
